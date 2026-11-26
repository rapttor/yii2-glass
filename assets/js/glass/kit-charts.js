// Glass kit, third-party charts: ExtChartJs (Chart.js 4), ExtApex (ApexCharts 4.7.0, the last MIT release) and ExtUPlot (uPlot, large time series).
// Vue 3 browser build, no build step. Libraries live in js/vendor/ext/ and load on demand. Styled by scss/kit/_charts.scss (class prefix k-).
// Register with `registerKitCharts(app)`; `DemoCharts` shows everything live.
// Do not upgrade ApexCharts: 5.0.0 and later ship a revenue-limited licence file.
import { reactive, ref, shallowRef, computed, watch, toRaw, onMounted, onBeforeUnmount } from '../vendor/vue.esm-browser.prod.js';
import { loadScript, loadStyle, tokens, onThemeChange } from './ext-loader.js';

// ---------- plain data helpers ----------
const isPlain = v => !!v && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v));
// The libraries write into the objects they get, so they receive copies without Vue proxies. Functions, dates and gradients pass through.
function plain(v) {
    const r = toRaw(v);
    if (Array.isArray(r)) return r.map(plain);
    if (isPlain(r)) return Object.fromEntries(Object.entries(r).map(([k, x]) => [k, plain(x)]));
    return r;
}
// deep merge of plain objects; arrays and everything else in `over` replace the base value
function merge(base, over) {
    if (!isPlain(base) || !isPlain(over)) return over === undefined ? base : over;
    const out = {...base};
    Object.entries(over).forEach(([k, v]) => { out[k] = merge(base[k], v); });
    return out;
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const px = v => typeof v === 'number' || /^\d+$/.test(v) ? v + 'px' : v;
const compact = new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1});

// ---------- theme ----------
let probe = null;
// any CSS colour (hex, rgb, hsl, oklch ...) to [r, g, b], read back through a canvas
function channels(css) {
    probe ||= Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d', {willReadFrequently: true});
    probe.fillStyle = '#808080'; probe.fillStyle = css;
    const s = probe.fillStyle;
    if (s[0] === '#') return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
    if (s.startsWith('rgb')) return s.match(/[\d.]+/g).slice(0, 3).map(Number);
    probe.clearRect(0, 0, 1, 1); probe.fillRect(0, 0, 1, 1);
    return [...probe.getImageData(0, 0, 1, 1).data].slice(0, 3);
}
const toHex = c => '#' + c.map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
// The kit tokens in forms every chart library can parse (hex and comma rgba). `options` props may be a function of this object.
export function chartTheme() {
    const k = tokens(), hex = c => toHex(channels(c)), alpha = (c, a) => `rgba(${channels(c).join(', ')}, ${a})`;
    const mix = (a, b, share) => { const x = channels(a), y = channels(b); return toHex(x.map((n, i) => n * share + y[i] * (1 - share))); };
    const palette = [...new Set(k.palette.map(hex))], named = {accent: hex(k.accent), ok: hex(k.ok), warn: hex(k.warn), bad: hex(k.bad)};
    // tone: palette index, 'accent' | 'ok' | 'warn' | 'bad', or any CSS colour
    const color = (tone, i = 0) => tone == null ? palette[i % palette.length] : typeof tone === 'number' ? palette[tone % palette.length] : named[tone] || tone;
    return {...named, accentInk: hex(k.accentInk), dark: k.dark, font: k.font, text: alpha(k.text, 1), muted: alpha(k.text, .7), line: alpha(k.text, .18), grid: alpha(k.text, .11),
        tint: hex(k.tint), tip: alpha(k.tint, .95), palette, alpha, mix, color};
}

// ---------- shared life cycle: load the library, draw, follow the theme, clean up ----------
function useChart({load, make, repaint, drop}) {
    const state = reactive({loading: true, error: ''});
    let lib = null, alive = true, stop = null, late = 0, seen = '';
    const theme = () => { seen = JSON.stringify(tokens()); return chartTheme(); };
    const fail = e => { console.warn('chart', e); state.error = 'This chart could not be drawn. ' + (e && e.message || e); };
    const guard = fn => { if (!alive || !lib) return; try { state.error = ''; fn(lib); } catch (e) { fail(e); } };
    async function boot() {
        state.loading = true; state.error = '';
        try { lib = await load(); if (!lib) throw new Error('The chart library did not start.'); guard(l => { drop(); make(l); }); }
        catch (e) { fail(e); }
        finally { state.loading = false; }
    }
    const check = () => { if (JSON.stringify(tokens()) !== seen) guard(repaint); };
    onMounted(() => {
        // the accent colour eases for .45 s after a change, so look a second time when it has settled
        stop = onThemeChange(() => { check(); clearTimeout(late); late = setTimeout(check, 520); });
        boot();
    });
    onBeforeUnmount(() => { alive = false; clearTimeout(late); stop && stop(); drop(); });
    return {state, boot, theme, guard, fail, alive: () => alive};
}
const STATUS = `<div v-if="state.loading" class="k-xc__wait" aria-hidden="true"></div>
    <div v-if="state.error" class="k-xc__msg" role="alert"><p>{{ state.error }}</p><button type="button" class="btn" @click="boot">Try again</button></div>`;

// ---------- Chart.js ----------
const CARTESIAN = ['line', 'bar', 'scatter', 'bubble'];
const SLICED = ['doughnut', 'pie', 'polarArea'];
// default colours and shapes of one dataset; everything the caller sets wins
function paintDataset({tone, ...ds}, i, type, t, count) {
    const kind = ds.type || type, c = t.color(Array.isArray(tone) ? null : tone, i);
    let base;
    if (SLICED.includes(kind)) {
        const slices = Array.from({length: Math.max(count, (ds.data || []).length)}, (_, j) => t.color(Array.isArray(tone) ? tone[j] : null, j));
        base = kind === 'polarArea' ? {backgroundColor: slices.map(s => t.alpha(s, .68)), borderColor: slices, borderWidth: 1}
            : {backgroundColor: slices, borderColor: 'transparent', borderWidth: 0, spacing: 2, borderRadius: 4, hoverOffset: 6};
    } else if (kind === 'bar') base = {backgroundColor: t.alpha(c, .85), hoverBackgroundColor: c, borderColor: c, borderWidth: 0, borderRadius: 5, maxBarThickness: 36};
    else if (kind === 'radar') base = {borderColor: c, backgroundColor: t.alpha(c, .18), pointBackgroundColor: c, borderWidth: 2, pointRadius: 3, fill: true};
    else if (kind === 'bubble' || kind === 'scatter') base = {borderColor: c, backgroundColor: t.alpha(c, .5), hoverBackgroundColor: t.alpha(c, .75), borderWidth: 1.5};
    else {
        const fade = ({chart}) => {
            const area = chart.chartArea; if (!area) return t.alpha(c, .2);
            const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom); g.addColorStop(0, t.alpha(c, .45)); g.addColorStop(1, t.alpha(c, .03)); return g;
        };
        base = {borderColor: c, backgroundColor: ds.fill ? fade : c, pointBackgroundColor: c, pointBorderColor: c, borderWidth: 2.5, tension: .35, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 12};
    }
    return {...base, ...ds};
}
function chartJsBase(type, datasets, user, t) {
    const scales = {};
    if (CARTESIAN.includes(type)) {
        const ids = new Set(['x', 'y', ...Object.keys(user.scales || {}), ...datasets.flatMap(d => [d.xAxisID, d.yAxisID].filter(Boolean))]);
        ids.forEach(id => { scales[id] = {border: {display: false}, grid: {color: t.grid}, ticks: {color: t.muted, maxRotation: 0, autoSkipPadding: 12}, title: {color: t.muted}}; });
        if (type === 'line' || type === 'bar') scales[user.indexAxis === 'y' ? 'y' : 'x'].grid.display = false;
    } else if (type === 'radar' || type === 'polarArea') {
        scales.r = {grid: {color: t.grid}, angleLines: {color: t.grid}, pointLabels: {color: t.muted}, ticks: {color: t.muted, backdropColor: 'transparent', maxTicksLimit: 5}};
    }
    return {
        responsive: true, maintainAspectRatio: false, color: t.muted, scales,
        ...(reduced() ? {animation: false} : {}),
        ...(type === 'line' || type === 'bar' ? {interaction: {mode: 'index', intersect: false}} : {}),
        ...(type === 'doughnut' ? {cutout: '68%'} : {}),
        plugins: {
            legend: {position: SLICED.includes(type) ? 'bottom' : 'top', labels: {color: t.muted, usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 14}},
            title: {color: t.text}, subtitle: {color: t.muted},
            tooltip: {backgroundColor: t.tip, titleColor: t.text, bodyColor: t.text, footerColor: t.muted, borderColor: t.line, borderWidth: 1, cornerRadius: 10, padding: 10, boxPadding: 5, usePointStyle: true},
        },
    };
}

export const ExtChartJs = {
    props: {type: {type: String, default: 'line'}, data: {type: Object, default: () => ({labels: [], datasets: []})}, options: {type: [Object, Function], default: () => ({})},
        height: {type: [Number, String], default: 280}, label: String},
    emits: ['ready', 'select'],
    setup(p, {emit, expose}) {
        const el = ref(null);
        let chart = null;
        function config() {
            const t = C.theme(), data = plain(p.data) || {}, labels = data.labels || [];
            const datasets = (data.datasets || []).map((d, i) => paintDataset(d, i, p.type, t, labels.length));
            const user = plain(typeof p.options === 'function' ? p.options(t) : p.options) || {};
            const options = merge(chartJsBase(p.type, datasets, user, t), user);
            options.onClick = (e, hits, c) => {
                user.onClick && user.onClick(e, hits, c);
                if (!hits.length) return;
                const {datasetIndex, index} = hits[0], ds = c.data.datasets[datasetIndex];
                emit('select', {datasetIndex, index, label: (c.data.labels || [])[index] ?? ds.label, value: ds.data[index]});
            };
            return {type: p.type, data: {...data, labels, datasets}, options, t};
        }
        const drop = () => { chart && chart.destroy(); chart = null; };
        function make(Chart) {
            const {t, ...cfg} = config();
            Object.assign(Chart.defaults, {color: t.muted, borderColor: t.grid}); Chart.defaults.font.family = t.font;
            chart = new Chart(el.value, cfg);
            emit('ready', chart);
        }
        // keep the dataset objects (matched by id, label or position) so Chart.js animates from the old values and remembers hidden series
        function apply(mode) {
            const {t, data, options} = config(), old = [...chart.data.datasets], key = (d, i) => d.id ?? d.label ?? i;
            const keys = old.map(key);
            chart.data.labels = data.labels;
            chart.data.datasets = data.datasets.map((next, i) => {
                const j = keys.indexOf(key(next, i)); if (j < 0) return next;
                const kept = old[j]; keys[j] = Symbol('used');
                Object.keys(kept).forEach(k => { if (!(k in next) && k[0] !== '_') delete kept[k]; });
                return Object.assign(kept, next);
            });
            Object.assign(chart.constructor.defaults, {color: t.muted, borderColor: t.grid});
            chart.options = options;
            chart.update(mode);
        }
        const C = useChart({load: () => loadScript('chart.js/chart.umd.min.js', {global: 'Chart'}), make, drop, repaint: () => chart && apply('none')});
        watch(() => p.type, () => C.guard(Chart => { drop(); make(Chart); }));
        watch([() => p.data, () => p.options], () => C.guard(() => chart && apply()), {deep: true});
        const aria = computed(() => p.label || p.type + ' chart: ' + ((p.data && p.data.datasets) || []).map(d => d.label).filter(Boolean).join(', '));
        expose({chart: () => chart});
        return {el, aria, state: C.state, boot: C.boot, css: computed(() => px(p.height))};
    },
    template: `<div class="k-xc k-chartjs" :style="{height: css}" :aria-busy="state.loading"><div class="k-xc__box"><canvas ref="el" role="img" :aria-label="aria"></canvas></div>${STATUS}</div>`,
};

// ---------- ApexCharts ----------
function apexBase(type, t) {
    const gap = {width: 2, colors: [t.tint]};
    const byType = {
        area: {fill: {type: 'gradient', gradient: {opacityFrom: .5, opacityTo: .03}}},
        radialBar: {stroke: {lineCap: 'round'}, plotOptions: {radialBar: {track: {background: t.grid}, dataLabels: {name: {color: t.muted}, value: {color: t.text}, total: {color: t.muted}}}}},
        heatmap: {stroke: gap},
        treemap: {stroke: gap, dataLabels: {enabled: true}},
        candlestick: {stroke: {width: 1}, plotOptions: {candlestick: {colors: {upward: t.ok, downward: t.bad}}}},
        donut: {stroke: gap}, pie: {stroke: gap},
    };
    return merge({
        chart: {type, background: 'transparent', foreColor: t.muted, fontFamily: t.font, toolbar: {show: false}, zoom: {enabled: false}, parentHeightOffset: 0,
            animations: {enabled: !reduced(), speed: 450}},
        colors: t.palette, dataLabels: {enabled: false}, stroke: {curve: 'smooth', width: 2},
        grid: {borderColor: t.grid}, legend: {labels: {colors: t.muted}}, markers: {strokeColors: t.tint},
        xaxis: {axisBorder: {color: t.line}, axisTicks: {color: t.line}, crosshairs: {stroke: {color: t.line}}},
        tooltip: {theme: t.dark ? 'dark' : 'light'},
    }, byType[type] || {});
}

export const ExtApex = {
    props: {type: {type: String, default: 'line'}, series: {type: Array, default: () => []}, options: {type: [Object, Function], default: () => ({})},
        height: {type: Number, default: 280}, label: String},
    emits: ['ready', 'select'],
    setup(p, {emit, expose}) {
        const el = ref(null);
        let chart = null, pending = false, queue = Promise.resolve(), rendering = null;
        function config() {
            const t = C.theme(), user = plain(typeof p.options === 'function' ? p.options(t) : p.options) || {};
            delete user.theme;   // ApexCharts' own theme option would replace the kit's text colour and paint a background
            const own = (user.chart && user.chart.events) || {};
            return merge(merge(apexBase(p.type, t), user), {series: plain(p.series), chart: {type: p.type, height: p.height, events: {
                dataPointSelection: (e, c, at) => { own.dataPointSelection && own.dataPointSelection(e, c, at); emit('select', {seriesIndex: at.seriesIndex, dataPointIndex: at.dataPointIndex}); },
            }}});
        }
        const drop = () => { const old = chart; chart = null; pending = false; if (old) try { old.destroy(); } catch (e) { console.warn('apex destroy', e); } };
        function make(Apex) {
            const next = new Apex(el.value, config());
            chart = next;
            rendering = Promise.resolve(next.render()).then(() => { if (chart === next) emit('ready', next); }).catch(e => { if (chart === next) C.fail(e); });
            queue = queue.then(() => rendering);
        }
        // updates wait for the running render and several changes in one tick become one redraw
        function update() {
            if (pending || !chart) return;
            pending = true;
            queue = queue.then(() => { pending = false; return chart && chart.updateOptions(config(), false, !reduced(), false); }).catch(e => { if (chart) console.warn('apex update', e); });
        }
        const C = useChart({load: () => loadScript('apexcharts/apexcharts.min.js', {global: 'ApexCharts'}), make, drop, repaint: update});
        // a new type means a new chart, created only after the running render has finished
        watch(() => p.type, () => { queue = queue.then(() => { C.guard(Apex => { drop(); make(Apex); }); return rendering; }); });
        watch([() => p.series, () => p.options, () => p.height], () => C.guard(update), {deep: true});
        expose({chart: () => chart});
        return {el, state: C.state, boot: C.boot, css: computed(() => px(p.height)), aria: computed(() => p.label || p.type + ' chart')};
    },
    template: `<div class="k-xc k-apex" :style="{minHeight: css}" role="group" :aria-label="aria" :aria-busy="state.loading"><div class="k-xc__box"><div ref="el"></div></div>${STATUS}</div>`,
};

// ---------- uPlot ----------
export const ExtUPlot = {
    // data: [xs, ys1, ys2, ...] (x in seconds when `time`). Replace the arrays (or push to them) to update; editing single values in place is not watched.
    // series: one per y array: {label, tone, stroke, fill (true or colour), format(v), width, scale, show, dash}
    props: {data: {type: Array, default: () => []}, series: {type: Array, default: () => []}, options: {type: [Object, Function], default: () => ({})},
        height: {type: Number, default: 300}, time: {type: Boolean, default: true}, xLabel: String, label: String},
    emits: ['ready', 'range'],
    setup(p, {emit, expose}) {
        const el = ref(null);
        let plot = null, observer = null, frame = 0;
        // copies, so that a push into the caller's arrays does not change what the plot holds before it is told
        const raw = () => { const d = toRaw(p.data).map(a => toRaw(a).slice()); return d.length ? d : Array.from({length: p.series.length + 1}, () => []); };
        const extent = () => { const x = plot && plot.data[0]; return x && x.length > 1 ? [x[0], x[x.length - 1]] : null; };
        const zoomRange = () => { const e = extent(); if (!e) return null; const {min, max} = plot.scales.x; return min != null && (min > e[0] || max < e[1]) ? {min, max} : null; };
        function config(width) {
            const t = C.theme(), user = plain(typeof p.options === 'function' ? p.options(t) : p.options) || {}, count = Math.max(raw().length - 1, 0);
            const series = Array.from({length: count}, (_, i) => {
                const {tone, fill, format, stroke, label, ...rest} = p.series[i] || {}, c = stroke || t.color(tone, i);
                const one = {width: 1.5, ...plain(rest), label: label || 'Series ' + (i + 1), stroke: c};
                if (fill) one.fill = fill === true ? t.alpha(c, .16) : fill;
                if (format) one.value = (u, v) => v == null ? '--' : format(v);
                return one;
            });
            const axis = () => ({stroke: t.muted, font: '11px ' + t.font, labelFont: '600 12px ' + t.font, grid: {stroke: t.grid, width: 1}, ticks: {stroke: t.grid, width: 1}});
            const yAxis = () => ({...axis(), size: 52, values: (u, vals) => vals.map(v => v == null ? '' : compact.format(v))});
            const mine = user.axes || [], axes = Array.from({length: Math.max(2, mine.length)}, (_, i) => merge(i ? yAxis() : axis(), mine[i] || {}));
            const {axes: _a, series: _s, hooks = {}, ...rest} = user;
            return merge({
                width, height: p.height, scales: {x: {time: p.time}},
                cursor: {drag: {x: true, y: false}, points: {size: 8}},
                series: [{label: p.xLabel || (p.time ? 'Time' : 'X')}, ...series], axes,
                hooks: {...hooks, setScale: [...(hooks.setScale || []), (u, key) => { if (key === 'x') emit('range', {min: u.scales.x.min, max: u.scales.x.max}); }]},
            }, rest);
        }
        const drop = () => { cancelAnimationFrame(frame); plot && plot.destroy(); plot = null; };
        function make(UPlot, keep) {
            const opts = config(el.value.clientWidth || 600);
            if (keep && keep.shown.length === opts.series.length) opts.series.forEach((s, i) => { if (i) s.show = keep.shown[i]; });
            plot = new UPlot(opts, raw(), el.value);
            if (keep && keep.range) plot.setScale('x', keep.range);
            // uPlot listens to the mouse only: a finger drag moves the crosshair, a vertical swipe still scrolls the page
            const over = plot.over, here = plot;
            const touch = e => { if (e.pointerType !== 'touch') return; const r = over.getBoundingClientRect(); here.setCursor({left: e.clientX - r.left, top: e.clientY - r.top}); };
            over.addEventListener('pointerdown', touch); over.addEventListener('pointermove', touch);
            emit('ready', plot);
        }
        // draw again with new colours or options, keeping the zoom and the hidden series
        function remake(UPlot) {
            const keep = plot && {range: zoomRange(), shown: plot.series.map(s => s.show)};
            drop(); make(UPlot, keep);
        }
        const C = useChart({load: () => Promise.all([loadScript('uplot/uPlot.iife.min.js', {global: 'uPlot'}), loadStyle('uplot/uPlot.min.css')]).then(r => r[0]), make, drop, repaint: remake});
        watch(() => { const d = p.data || []; return [d, d.length, ...d.map(a => a && a.length), ...d]; }, () => C.guard(UPlot => {
            if (!plot) return;
            const next = raw(); if (next.length !== plot.series.length) return remake(UPlot);
            // keep the zoom as far as the new data still covers it
            const zoomed = zoomRange(), x = next[0], from = zoomed && Math.max(zoomed.min, x[0]), to = zoomed && Math.min(zoomed.max, x[x.length - 1]);
            if (zoomed && from < to) { plot.setData(next, false); plot.setScale('x', {min: from, max: to}); } else plot.setData(next);
        }));
        watch([() => p.series, () => p.options, () => p.time, () => p.xLabel], () => C.guard(remake), {deep: true});
        watch(() => p.height, h => C.guard(() => plot && plot.setSize({width: plot.width, height: h})));

        // x window: factor < 1 zooms in around the middle; shift moves by a share of the visible width
        function view(factor = 1, shift = 0) {
            const e = extent(); if (!e) return;
            const {min, max} = plot.scales.x, full = e[1] - e[0], smallest = full / (plot.data[0].length - 1) * 10;
            const w = Math.min(full, Math.max(smallest, (max - min) * factor)), from = Math.min(e[1] - w, Math.max(e[0], (min + max) / 2 - w / 2 + w * shift));
            plot.setScale('x', {min: from, max: from + w});
        }
        const zoom = factor => view(factor), pan = share => view(1, share);
        const reset = () => { const e = extent(); e && plot.setScale('x', {min: e[0], max: e[1]}); };
        function onKey(e) {
            if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
            const act = {'+': () => zoom(.6), '=': () => zoom(.6), '-': () => zoom(1 / .6), ArrowLeft: () => pan(-.25), ArrowRight: () => pan(.25), '0': reset, Escape: reset}[e.key];
            if (act) { e.preventDefault(); act(); }
        }
        onMounted(() => {
            observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { const w = el.value && el.value.clientWidth; if (plot && w && w !== plot.width) plot.setSize({width: w, height: p.height}); }); });
            observer.observe(el.value);
        });
        onBeforeUnmount(() => observer && observer.disconnect());
        expose({chart: () => plot, zoom, pan, reset});
        return {el, onKey, state: C.state, boot: C.boot, css: computed(() => px(p.height)),
            aria: computed(() => (p.label || 'Time series chart') + '. Plus and minus zoom, left and right arrows move, 0 resets.')};
    },
    template: `<div class="k-xc k-uplot" :style="{minHeight: css}" role="group" tabindex="0" :aria-label="aria" :aria-busy="state.loading" @keydown="onKey"><div ref="el" class="k-uplot__host"></div>${STATUS}</div>`,
};

// ---------- showcase ----------
function random(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const usd = v => '$' + compact.format(v);

// every call returns a fresh set of sample figures; `vary` is 0 on first load, so the page opens with the same numbers each time
function sample(rnd, vary) {
    const j = v => Math.max(1, Math.round(v * (1 + (rnd() - .5) * vary)));
    const list = a => a.map(j), score = a => a.map(v => Math.min(100, j(v)));
    const revenue = list([182, 168, 194, 221, 236, 228, 254, 247, 268, 291, 312, 338]), costs = list([141, 138, 149, 158, 166, 171, 175, 182, 186, 193, 201, 214]);
    const bubbles = (n, x, y) => Array.from({length: n}, () => ({x: j(x + (rnd() - .5) * x), y: j(y + (rnd() - .5) * y), r: Math.round(5 + rnd() * 14)}));
    const day = Date.UTC(2026, 9, 1), DAY = 86400000;
    let close = 142;
    const candles = Array.from({length: 40}, (_, i) => {
        const open = close; close = Math.max(40, open + (rnd() - .47) * 9);
        const high = Math.max(open, close) + rnd() * 4, low = Math.min(open, close) - rnd() * 4;
        return {x: day + i * DAY, y: [open, high, low, close].map(v => +v.toFixed(2))};
    });
    const spark = base => Array.from({length: 20}, (_, i) => j(base * (.7 + i * .018 + rnd() * .12)));
    return {
        line: {labels: MONTHS, datasets: [{label: 'Revenue', data: revenue}, {label: 'Costs', data: costs}, {label: 'Forecast', data: list(revenue.map(v => v * 1.06)), borderDash: [6, 5], tone: 'warn'}]},
        area: {labels: MONTHS, datasets: [{label: 'New customers', data: list([34, 38, 41, 52, 49, 58, 63, 61, 72, 78, 84, 96]), fill: true}, {label: 'Churned', data: list([12, 11, 14, 13, 15, 12, 16, 14, 13, 17, 15, 14]), fill: true, tone: 'bad'}]},
        bar: {labels: ['Platform', 'Support', 'Training', 'Hardware', 'Services', 'Add-ons'], datasets: [{label: 'Sales, thousand $', data: list([412, 236, 98, 174, 289, 121])}]},
        stacked: {labels: MONTHS.slice(6), datasets: [{label: 'Online', data: list([42, 48, 51, 50, 58, 64])}, {label: 'Retail', data: list([31, 29, 34, 36, 35, 41])}, {label: 'Partners', data: list([12, 16, 15, 18, 22, 25])}]},
        doughnut: {labels: ['EMEA', 'Americas', 'APAC', 'Middle East', 'Africa'], datasets: [{label: 'Revenue share', data: list([42, 31, 18, 6, 3])}]},
        radar: {labels: ['Speed', 'Quality', 'Support', 'Price', 'Reach', 'Security'], datasets: [{label: 'This quarter', data: score([78, 86, 72, 64, 58, 91])}, {label: 'Last quarter', data: score([66, 80, 76, 70, 49, 84])}]},
        polar: {labels: ['Search', 'Referral', 'Email', 'Social', 'Events'], datasets: [{label: 'Leads', data: list([64, 48, 36, 29, 18])}]},
        bubble: {datasets: [{label: 'Enterprise', data: bubbles(9, 70, 62)}, {label: 'Mid-market', data: bubbles(11, 38, 40)}]},
        mixed: {labels: MONTHS.slice(4), datasets: [{label: 'Orders', data: list([320, 345, 362, 338, 391, 420, 446, 478]), yAxisID: 'y', order: 2}, {type: 'line', label: 'Margin %', data: list([21, 23, 22, 25, 27, 26, 29, 31]), yAxisID: 'y1', tone: 'warn', pointRadius: 3, order: 1}]},
        apexArea: [{name: 'Subscriptions', data: list([64, 71, 69, 83, 92, 90, 104, 111, 108, 125, 134, 148])}, {name: 'One-off', data: list([38, 44, 41, 46, 52, 48, 57, 55, 61, 59, 68, 72])}],
        radial: score([82, 67, 54]),
        heat: DAYS.map(name => ({name, data: HOURS.map((h, i) => ({x: h + ':00', y: j(12 + 48 * Math.exp(-Math.pow((i - 3) / 2.2, 2)) + 30 * Math.exp(-Math.pow((i - 7) / 1.8, 2)) + rnd() * 8)}))})).reverse(),
        tree: [{data: [['Northwind', 218], ['Contoso', 174], ['Fabrikam', 146], ['Globex', 121], ['Initech', 94], ['Umbrella', 78], ['Hooli', 61], ['Soylent', 47], ['Acme', 38], ['Wonka', 26]].map(([x, y]) => ({x, y: j(y)}))}],
        candles: [{name: 'Share price', data: candles}],
        sparks: [{id: 'mrr', label: 'Monthly revenue', unit: usd, data: spark(312000), tone: 'accent', type: 'area'}, {id: 'orders', label: 'Orders', unit: v => compact.format(v), data: spark(4780), tone: 1, type: 'bar'},
            {id: 'conv', label: 'Conversion', unit: v => (v / 10).toFixed(1) + '%', data: spark(48), tone: 'ok', type: 'line'}, {id: 'tickets', label: 'Open tickets', unit: String, data: spark(64), tone: 'warn', type: 'area'}]
            .map(s => ({...s, series: [{name: s.label, data: s.data}]})),
    };
}
// one point per minute, ending now: requests, errors and response time
function traffic(n, seed) {
    const rnd = random(seed), start = Math.floor(Date.now() / 60000) * 60 - (n - 1) * 60;
    const x = new Array(n), req = new Array(n), err = new Array(n), ms = new Array(n);
    let drift = 0;
    for (let i = 0; i < n; i++) {
        x[i] = start + i * 60; drift = drift * .995 + (rnd() - .5) * 14;
        const load = 620 + 330 * Math.sin(x[i] / 86400 * 2 * Math.PI - 2) + drift;
        req[i] = Math.max(20, Math.round(load + rnd() * 70));
        err[i] = Math.max(0, Math.round(req[i] * .03 + rnd() * 12 + (rnd() > .998 ? 160 : 0)));
        ms[i] = Math.max(20, Math.round(70 + req[i] * .09 + rnd() * 26 + (rnd() > .997 ? 180 : 0)));
    }
    return [x, req, err, ms];
}

export const DemoCharts = {
    setup() {
        let round = 1;
        const d = reactive(sample(random(20261126), 0));
        const points = ref('20000'), plot = ref(null), series = shallowRef(traffic(+points.value, 5)), picked = ref('');
        const lineType = ref('line'), apexType = ref('area');
        watch(points, n => { series.value = traffic(+n, 5 + round); });
        function shuffle() {
            const next = sample(random(97 + round++ * 7919), .5);
            // Chart.js sets are edited in place (the deep watch picks it up), the rest is replaced
            Object.keys(next).forEach(k => {
                if (next[k].datasets) next[k].datasets.forEach((ds, i) => { d[k].datasets[i].data.splice(0, Infinity, ...ds.data); });
                else d[k] = next[k];
            });
            series.value = traffic(+points.value, 5 + round);
        }
        const select = s => { picked.value = s.label + ': ' + (typeof s.value === 'object' ? JSON.stringify(s.value) : s.value); };

        const stackedOpts = {scales: {x: {stacked: true}, y: {stacked: true}}};
        const barOpts = {indexAxis: 'y', plugins: {legend: {display: false}}};
        const bubbleOpts = {scales: {x: {title: {display: true, text: 'Deal size, thousand $'}}, y: {title: {display: true, text: 'Win rate %'}}}};
        const mixedOpts = {scales: {y: {beginAtZero: true}, y1: {position: 'right', beginAtZero: true, grid: {display: false}, ticks: {callback: v => v + '%'}}}};
        const radarOpts = {scales: {r: {min: 0, max: 100}}};

        const apexAreaOpts = {xaxis: {categories: MONTHS}, yaxis: {labels: {formatter: v => '$' + Math.round(v) + 'k'}}, legend: {position: 'top', horizontalAlign: 'left'}};
        const radialOpts = {labels: ['Revenue', 'Renewals', 'Upsell'], plotOptions: {radialBar: {hollow: {size: '34%'}, dataLabels: {total: {show: true, label: 'Average', formatter: w => Math.round(w.globals.seriesTotals.reduce((a, b) => a + b, 0) / w.globals.series.length) + '%'}}}},
            legend: {show: true, position: 'bottom'}};
        const heatOpts = t => ({plotOptions: {heatmap: {enableShades: false, radius: 5, colorScale: {ranges: [[0, 20, .16], [21, 32, .34], [33, 44, .52], [45, 56, .72], [57, 10000, 1]]
            .map(([from, to, share]) => ({from, to, color: t.mix(t.accent, t.tint, share), name: from > 56 ? '57+' : from + '-' + to}))}}}, legend: {position: 'bottom'}});
        const treeOpts = {plotOptions: {treemap: {distributed: true, enableShades: false}}, legend: {show: false}, tooltip: {y: {formatter: v => '$' + v + 'k'}}};
        const candleOpts = {xaxis: {type: 'datetime'}, yaxis: {decimalsInFloat: 0, tooltip: {enabled: true}}};
        const sparkOpts = Object.fromEntries(['accent', 1, 'ok', 'warn'].map(tone => [tone, t => ({colors: [t.color(tone)], chart: {sparkline: {enabled: true}}, plotOptions: {bar: {columnWidth: '68%', borderRadius: 2}}, tooltip: {x: {show: false}}})]));

        const plotSeries = [{label: 'Requests/min', tone: 'accent', fill: true, format: v => v.toLocaleString('en-US')}, {label: 'Errors/min', tone: 'bad', format: v => v.toLocaleString('en-US')}, {label: 'Response', tone: 1, scale: 'ms', format: v => v + ' ms'}];
        const plotOpts = {axes: [{}, {}, {scale: 'ms', side: 1, grid: {show: false}, values: (u, vals) => vals.map(v => v + ' ms')}]};

        return {d, points, plot, series, picked, lineType, apexType, shuffle, select, stackedOpts, barOpts, bubbleOpts, mixedOpts, radarOpts, apexAreaOpts, radialOpts, heatOpts, treeOpts, candleOpts, sparkOpts, plotSeries, plotOpts,
            count: computed(() => series.value[0].length.toLocaleString('en-US'))};
    },
    template: `<div class="page k-gal">
        <Holder title="Business dashboard" sub="Chart.js, ApexCharts and uPlot in the current theme. Change the accent or the scheme and they follow."><template #actions><button type="button" class="btn primary" @click="shuffle"><Ico n="trend" :s="16"/>Randomise data</button></template></Holder>
        <div class="k-gal__sparks"><Card v-for="s in d.sparks" :key="s.id" class="k-gal__spark"><small>{{ s.label }}</small><b>{{ s.unit(s.series[0].data[s.series[0].data.length - 1]) }}</b><ExtApex :type="s.type" :series="s.series" :options="sparkOpts[s.tone]" :height="56" :label="s.label + ' trend'"/></Card></div>

        <h3 class="k-gal__h">Chart.js</h3>
        <div class="k-gal__grid">
            <Holder title="Line" sub="Revenue and costs, thousand $. Switching the type creates a new chart."><template #actions><Segmented v-model="lineType" :options="[{v: 'line', l: 'Line'}, {v: 'bar', l: 'Bar'}]"/></template><ExtChartJs :type="lineType" :data="d.line" @select="select"/><small aria-live="polite">{{ picked || 'Tap a point to select it.' }}</small></Holder>
            <Holder title="Area" sub="Customers won and lost"><ExtChartJs type="line" :data="d.area"/></Holder>
            <Holder title="Bar" sub="Sales by product line"><ExtChartJs type="bar" :data="d.bar" :options="barOpts"/></Holder>
            <Holder title="Stacked bar" sub="Revenue by channel, thousand $"><ExtChartJs type="bar" :data="d.stacked" :options="stackedOpts"/></Holder>
            <Holder title="Doughnut" sub="Revenue by region, %"><ExtChartJs type="doughnut" :data="d.doughnut"/></Holder>
            <Holder title="Radar" sub="Customer scorecard"><ExtChartJs type="radar" :data="d.radar" :options="radarOpts"/></Holder>
            <Holder title="Polar area" sub="Leads by source"><ExtChartJs type="polarArea" :data="d.polar"/></Holder>
            <Holder title="Bubble" sub="Open deals: size, win rate and effort"><ExtChartJs type="bubble" :data="d.bubble" :options="bubbleOpts"/></Holder>
            <Holder class="k-gal__wide" title="Mixed" sub="Orders as bars, margin as a line on its own axis"><ExtChartJs type="bar" :data="d.mixed" :options="mixedOpts"/></Holder></div>

        <h3 class="k-gal__h">ApexCharts</h3>
        <div class="k-gal__grid">
            <Holder class="k-gal__wide" title="Recurring and one-off sales"><template #actions><Segmented v-model="apexType" :options="[{v: 'area', l: 'Area'}, {v: 'line', l: 'Line'}, {v: 'bar', l: 'Bar'}]"/></template><ExtApex :type="apexType" :series="d.apexArea" :options="apexAreaOpts" :height="300"/></Holder>
            <Holder title="Radial bars" sub="Quarter targets"><ExtApex type="radialBar" :series="d.radial" :options="radialOpts" :height="300" label="Quarter targets"/></Holder>
            <Holder title="Heatmap" sub="Support calls by weekday and hour"><ExtApex type="heatmap" :series="d.heat" :options="heatOpts" :height="300" label="Support calls heatmap"/></Holder>
            <Holder title="Treemap" sub="Largest accounts, thousand $"><ExtApex type="treemap" :series="d.tree" :options="treeOpts" :height="300" label="Largest accounts"/></Holder>
            <Holder title="Candlestick" sub="Daily share price, 40 days"><ExtApex type="candlestick" :series="d.candles" :options="candleOpts" :height="300" label="Daily share price"/></Holder></div>

        <h3 class="k-gal__h">uPlot</h3>
        <Holder title="Service traffic" :sub="count + ' minutes per series. Drag to zoom, double click to reset.'">
            <div class="k-gal__tools"><Segmented v-model="points" :options="[{v: '5000', l: '5k'}, {v: '20000', l: '20k'}, {v: '100000', l: '100k'}]"/>
                <button type="button" class="chip" @click="plot.zoom(.6)">Zoom in</button><button type="button" class="chip" @click="plot.zoom(1 / .6)">Zoom out</button>
                <button type="button" class="chip" @click="plot.pan(-.5)">Earlier</button><button type="button" class="chip" @click="plot.pan(.5)">Later</button><button type="button" class="chip" @click="plot.reset()">Reset</button></div>
            <ExtUPlot ref="plot" :data="series" :series="plotSeries" :options="plotOpts" :height="320" label="Service traffic per minute"/></Holder></div>`,
};

export function registerKitCharts(app) {
    Object.entries({ExtChartJs, ExtApex, ExtUPlot, DemoCharts}).forEach(([k, v]) => app.component(k, v));
}
