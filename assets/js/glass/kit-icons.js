// Glass kit v6, icons: one `Icon` component for every set, a searchable browser and an icon font showcase (see docs/GLASS-KIT.md). Register with `registerKitIcons(app)`, try them in `DemoIcons`.
// Sets: "ui" (the stroke paths of the kit, PATHS), "bi" (Bootstrap Icons font, MIT), "lucide" (Lucide SVG sprite, ISC). The vendor files in ../vendor/ext/ are fetched only when first used.
// Styled by scss/kit/_icons.scss.
import { h, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, nextTick } from '../vendor/vue.esm-browser.prod.js';
import { PATHS, toast } from './ui.js';
import { loadStyle, vendorUrl } from './ext-loader.js';

export const ICON_SETS = [{v: 'lucide', l: 'Lucide'}, {v: 'bi', l: 'Bootstrap'}, {v: 'ui', l: 'UI kit'}];
const STROKE = {ui: 1.8, lucide: 2};   // the default stroke width of each stroke set (the font set has none)

// ---------- loaders ----------
const once = fn => { let job = null; return () => job || (job = fn().catch(e => { job = null; throw e; })); };   // one shared request; a failed one may be tried again
async function fetchVendor(path) {
    const res = await fetch(vendorUrl(path));
    if (!res.ok) throw new Error('Could not load ' + path + ' (' + res.status + ')');
    return res;
}

export const loadBootstrapCss = () => loadStyle('bootstrap-icons/bootstrap-icons.min.css');
export const loadBootstrapNames = once(async () => {
    const [res] = await Promise.all([fetchVendor('bootstrap-icons/bootstrap-icons.json'), loadBootstrapCss()]);
    return Object.keys(await res.json()).sort();
});

// the only shapes and attributes copied out of the sprite: nothing else of the file reaches the page
const SHAPES = {path: ['d'], circle: ['cx', 'cy', 'r'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry'], line: ['x1', 'y1', 'x2', 'y2'], ellipse: ['cx', 'cy', 'rx', 'ry'], polyline: ['points'], polygon: ['points']};
const lucide = shallowRef(null);   // {icons: Map name -> shapes, alias: Map old name -> name, names: [], words: Map name -> 'alias alias'}
export const loadLucide = once(async () => {
    const text = await (await fetchVendor('lucide-static/sprite.svg')).text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const icons = new Map(), alias = new Map(), words = new Map();
    doc.querySelectorAll('symbol[id]').forEach(symbol => {
        const kids = [...symbol.children];
        if (kids.length === 1 && kids[0].localName === 'use') { alias.set(symbol.id, (kids[0].getAttribute('href') || '').slice(1)); return; }
        icons.set(symbol.id, kids.filter(k => Object.hasOwn(SHAPES, k.localName)).map(k => {
            const attrs = {};
            [...SHAPES[k.localName], 'fill'].forEach(a => { if (k.hasAttribute(a)) attrs[a] = k.getAttribute(a); });
            return [k.localName, attrs];
        }));
    });
    if (!icons.size) throw new Error('The Lucide sprite has no icons');
    alias.forEach((to, from) => words.set(to, (words.get(to) ? words.get(to) + ' ' : '') + from));
    lucide.value = {icons, alias, words, names: [...icons.keys()].sort()};
    return lucide.value;
});

// names (and, for Lucide, former names) of one set
export async function loadIconSet(set) {
    if (set === 'bi') return {names: await loadBootstrapNames(), words: new Map()};
    if (set === 'lucide') { const d = await loadLucide(); return {names: d.names, words: d.words}; }
    return {names: Object.keys(PATHS).sort(), words: new Map()};
}

// ---------- helpers ----------
// the usage snippet of an icon; only what differs from the defaults is written
export function iconSnippet(set, name, {size = 20, stroke = null, color = ''} = {}) {
    let out = '<Icon set="' + set + '" name="' + name + '"';
    if (+size !== 20) out += ' :size="' + size + '"';
    if (set !== 'bi' && stroke != null && +stroke !== STROKE[set]) out += ' :stroke="' + stroke + '"';
    if (color) out += ' color="' + color + '"';
    return out + ' />';
}
export async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* plain http or a blocked clipboard: use the old way */ }
    const back = document.activeElement, area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area); area.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove(); back?.focus?.({preventScroll: true});
    return ok;
}
async function copyWithToast(text, what) {
    const ok = await copyText(text);
    ok ? toast('Copied ' + what) : toast('Copy is blocked. Select the code and copy it by hand.', 'err');
    return ok;
}

// ---------- Icon ----------
export const Icon = {
    name: 'KIcon',
    props: {
        name: {type: String, required: true},
        set: {type: String, default: 'ui', validator: v => ICON_SETS.some(s => s.v === v)},
        size: {type: [Number, String], default: 20},   // pixels, or any CSS length such as "1.25em"
        stroke: {type: [Number, String], default: null},
        color: String,
        spin: Boolean,
        label: String,   // accessible name; without it the icon is decorative and hidden from screen readers
    },
    setup(p) {
        watch(() => p.set, set => {
            const job = set === 'bi' ? loadBootstrapCss() : set === 'lucide' ? loadLucide() : null;
            job?.catch(e => console.warn('icons', e));
        }, {immediate: true});
        return () => {
            const length = Number.isFinite(+p.size) ? p.size + 'px' : p.size, color = p.color || null;
            let child = null, missing = false;
            if (p.set === 'bi') {
                child = h('i', {class: ['bi', 'bi-' + p.name.replace(/^bi-/, '')], style: {fontSize: length, color}, 'aria-hidden': 'true'});
            } else {
                const style = {color}, base = {class: 'ico', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false'};
                if (p.set === 'lucide') {
                    const data = lucide.value, shapes = data && data.icons.get(data.alias.get(p.name) || p.name);
                    missing = !!data && !shapes;
                    child = h('svg', {...base, fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', style: {...style, strokeWidth: p.stroke ?? STROKE.lucide}},
                        (shapes || []).map(([tag, attrs]) => h(tag, attrs)));
                } else {
                    missing = !PATHS[p.name];
                    child = h('svg', {...base, style: {...style, strokeWidth: p.stroke ?? null}}, [h('path', {d: PATHS[p.name] || ''})]);
                }
            }
            return h('span', {
                class: ['k-icon', {'is-spin': p.spin, 'is-missing': missing}], style: {width: length, height: length},
                role: p.label ? 'img' : null, 'aria-label': p.label || null, 'aria-hidden': p.label ? null : 'true',
            }, [child]);
        };
    },
};

// ---------- IconBrowser ----------
const COLOURS = [{v: '', l: 'Text'}, {v: 'var(--accent-c)', l: 'Accent'}, {v: 'var(--ok)', l: 'Success'}, {v: 'var(--warn)', l: 'Warning'}, {v: 'var(--bad)', l: 'Danger'}];
const norm = s => s.trim().toLowerCase().replace(/[\s_-]+/g, '-').replace(/^-|-$/g, '');
// best matches first: exact name, start of the name, part of the name, all words in the name, then former names
function searchNames(names, words, term) {
    const q = norm(term); if (!q) return names;
    const parts = q.split('-'), buckets = [[], [], [], [], []];
    for (const n of names) {
        if (n === q) buckets[0].push(n);
        else if (n.startsWith(q)) buckets[1].push(n);
        else if (n.includes(q)) buckets[2].push(n);
        else if (parts.every(x => n.includes(x))) buckets[3].push(n);
        else { const old = words.get(n); if (old && parts.every(x => (n + ' ' + old).includes(x))) buckets[4].push(n); }
    }
    return buckets.flat();
}

export const IconBrowser = {
    name: 'KIconBrowser',
    components: {Icon},
    props: {set: {type: String, default: 'lucide'}, height: {type: Number, default: 420}},
    emits: ['update:set', 'copy'],
    setup(p, {emit}) {
        const cur = ref(p.set), status = ref('loading'), data = shallowRef({names: [], words: new Map()});
        const q = ref(''), term = ref(''), selected = ref('');
        const size = ref(24), stroke = ref(null), color = ref(''), light = ref(false);
        const strokeShown = computed(() => stroke.value ?? STROKE[cur.value] ?? 2);

        // loading: only the answer for the set that is still chosen counts
        let ticket = 0;
        async function load() {
            const mine = ++ticket, set = cur.value; status.value = 'loading'; selected.value = ''; data.value = {names: [], words: new Map()};
            try {
                const got = await loadIconSet(set); if (mine !== ticket) return;
                data.value = got; selected.value = ['house', 'home'].find(n => got.names.includes(n)) || got.names[0] || ''; status.value = 'ready';
            } catch (e) { if (mine !== ticket) return; console.warn('icons', e); status.value = 'error'; }
        }
        watch(cur, load, {immediate: true});
        watch(() => p.set, v => cur.value = v);
        const pickSet = v => { cur.value = v; emit('update:set', v); };
        const root = ref(null);
        function setKeys(e) {
            const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key]; if (!step) return;
            e.preventDefault();
            const i = ICON_SETS.findIndex(s => s.v === cur.value); pickSet(ICON_SETS[(i + step + ICON_SETS.length) % ICON_SETS.length].v);
            nextTick(() => root.value.querySelector('.k-icb__sets [aria-selected="true"]')?.focus());
        }

        // search, debounced
        let timer = 0;
        watch(q, v => { clearTimeout(timer); timer = setTimeout(() => term.value = v, 180); });
        const clear = () => { clearTimeout(timer); q.value = ''; term.value = ''; };
        const list = computed(() => searchNames(data.value.names, data.value.words, term.value));
        const count = computed(() => status.value !== 'ready' ? '' : term.value.trim() ? list.value.length.toLocaleString('en') + ' of ' + data.value.names.length.toLocaleString('en') + ' icons' : data.value.names.length.toLocaleString('en') + ' icons');

        // virtual grid: only the rows in view (plus a few around them, plus the row that holds the focus) are in the page
        const view = ref(null), width = ref(320), viewH = ref(p.height), top = ref(0), active = ref(0);
        const cellH = computed(() => size.value + 48);
        const cols = computed(() => Math.max(1, Math.floor(width.value / Math.max(84, size.value + 40))));
        const rowCount = computed(() => Math.ceil(list.value.length / cols.value));
        const rows = computed(() => {
            const total = rowCount.value; if (!total) return [];
            const first = Math.max(0, Math.min(total - 1, Math.floor(top.value / cellH.value) - 3)), last = Math.min(total - 1, Math.ceil((top.value + viewH.value) / cellH.value) + 3);
            const wanted = new Set(); for (let r = first; r <= last; r++) wanted.add(r);
            wanted.add(Math.min(total - 1, Math.floor(active.value / cols.value)));
            return [...wanted].sort((a, b) => a - b).map(r => ({r, cells: list.value.slice(r * cols.value, (r + 1) * cols.value).map((name, k) => ({name, k, i: r * cols.value + k}))}));
        });
        watch(list, () => { active.value = 0; top.value = 0; if (view.value) view.value.scrollTop = 0; });
        let frame = 0;
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (view.value) top.value = view.value.scrollTop; }); };
        let observer = null;
        const measure = () => { const el = view.value; if (el && el.clientWidth) { width.value = el.clientWidth; viewH.value = el.clientHeight; } };
        onMounted(() => { measure(); observer = new ResizeObserver(measure); observer.observe(view.value); });
        onBeforeUnmount(() => { observer?.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame); ticket++; });
        function focusCell(i) {
            const el = view.value; if (!el || !list.value.length) return;
            const at = Math.max(0, Math.min(list.value.length - 1, i)), y = Math.floor(at / cols.value) * cellH.value;
            active.value = at;
            if (y < el.scrollTop) el.scrollTop = y; else if (y + cellH.value > el.scrollTop + el.clientHeight) el.scrollTop = y + cellH.value - el.clientHeight;
            top.value = el.scrollTop;
            nextTick(() => el.querySelector('[data-i="' + at + '"]')?.focus({preventScroll: true}));
        }
        function gridKeys(e) {
            const i = active.value, c = cols.value, page = Math.max(1, Math.floor(viewH.value / cellH.value)) * c, all = e.ctrlKey || e.metaKey;
            const to = {ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + c < list.value.length ? i + c : i, ArrowUp: i - c >= 0 ? i - c : i, PageDown: i + page, PageUp: i - page,
                Home: all ? 0 : i - i % c, End: all ? list.value.length - 1 : i - i % c + c - 1}[e.key];
            if (to === undefined) return;
            e.preventDefault(); focusCell(to);
        }

        // colour choice: a radio group with arrow keys, plus a free colour
        const custom = ref('#3b82f6');
        const isCustom = computed(() => !COLOURS.some(c => c.v === color.value));
        const pickCustom = e => { custom.value = e.target.value; color.value = e.target.value; };
        function colourKeys(e) {
            const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key]; if (!step) return;
            e.preventDefault();
            const i = Math.max(0, COLOURS.findIndex(c => c.v === color.value)), next = (i + step + COLOURS.length) % COLOURS.length;
            color.value = COLOURS[next].v;
            nextTick(() => root.value.querySelectorAll('.k-icb__sw [role="radio"]')[next]?.focus());
        }

        // copy
        const snippet = computed(() => selected.value ? iconSnippet(cur.value, selected.value, {size: size.value, stroke: stroke.value, color: color.value}) : '');
        const extra = computed(() => !selected.value ? null
            : cur.value === 'bi' ? {l: 'Copy font tag', text: '<i class="bi bi-' + selected.value + '"></i>'}
            : cur.value === 'ui' ? {l: 'Copy Ico tag', text: '<Ico n="' + selected.value + '" :s="' + size.value + '"/>'} : null);
        async function copy(text, what) { if (await copyWithToast(text, what)) emit('copy', {set: cur.value, name: selected.value, snippet: text}); }
        function pick(cell) { active.value = cell.i; selected.value = cell.name; copy(snippet.value, 'the snippet for ' + cell.name); }
        const copyName = () => copy(selected.value, 'the name ' + selected.value);

        return {ICON_SETS, COLOURS, root, cur, status, load, q, term, clear, list, count, pickSet, setKeys, size, stroke, strokeShown, color, custom, isCustom, pickCustom, colourKeys, light,
            view, cellH, cols, rowCount, rows, active, onScroll, gridKeys, focusCell, selected, snippet, extra, pick, copy, copyName};
    },
    template: `<div class="k-icb" ref="root">
        <div class="k-icb__bar">
            <Segmented class="k-icb__sets" aria-label="Icon set" :model-value="cur" :options="ICON_SETS" @update:model-value="pickSet" @keydown="setKeys"/>
            <div class="k-icb__search" role="search"><Ico n="search" :s="16"/>
                <input type="search" v-model="q" placeholder="Search by name, for example arrow right" aria-label="Search icons by name" autocomplete="off" spellcheck="false" @keydown.esc.prevent="clear" @keydown.down.prevent="focusCell(active)">
                <button v-if="q" type="button" class="k-icb__x" aria-label="Clear the search" @click="clear"><Ico n="x" :s="14"/></button></div>
        </div>
        <div class="k-icb__ctl">
            <label class="slider"><span>Size<b>{{ size }}px</b></span><input type="range" min="14" max="64" step="1" v-model.number="size" :style="{'--p': (size - 14) / 50 * 100 + '%'}"></label>
            <label class="slider" :class="{'k-icb__off': cur === 'bi'}"><span>Stroke<b>{{ cur === 'bi' ? 'font icon' : strokeShown }}</b></span><input type="range" min="0.5" max="3" step="0.1" :value="strokeShown" :disabled="cur === 'bi'" :style="{'--p': (strokeShown - .5) / 2.5 * 100 + '%'}" @input="stroke = +$event.target.value"></label>
            <div class="k-icb__col"><span>Colour</span><div class="k-icb__sw">
                <div role="radiogroup" aria-label="Colour" @keydown="colourKeys"><button v-for="(c, i) in COLOURS" :key="c.l" type="button" role="radio" :aria-checked="color === c.v" :tabindex="color === c.v || (isCustom && !i) ? 0 : -1" :aria-label="c.l" :title="c.l" :class="{on: color === c.v}" @click="color = c.v"><i :style="{background: c.v || 'rgb(var(--text-rgb))'}"></i></button></div>
                <label class="k-icb__pick" :class="{on: isCustom}" title="Custom colour"><input type="color" :value="custom" aria-label="Custom colour" @input="pickCustom" @click="pickCustom"><i :style="{background: custom}"></i></label></div></div>
        </div>
        <p class="k-icb__count" role="status">{{ count }}</p>
        <div class="k-icb__body">
            <div class="k-icb__view" ref="view" :style="{height: 'min(' + height + 'px, 70vh)'}" @scroll.passive="onScroll">
                <div v-if="status === 'loading'" class="k-icb__state" aria-busy="true"><Skeleton :n="5"/></div>
                <div v-else-if="status === 'error'" class="k-icb__state" role="alert"><p>This icon set could not be loaded.</p><button type="button" class="btn" @click="load">Try again</button></div>
                <div v-else-if="!list.length" class="k-icb__state"><Empty :text="'No icon is called ' + term.trim()"/><button type="button" class="btn" @click="clear">Clear the search</button></div>
                <div v-else class="k-icb__grid" role="grid" aria-label="Icons. Press Enter to copy the snippet." :aria-rowcount="rowCount" :aria-colcount="cols" :style="{height: rowCount * cellH + 'px'}" @keydown="gridKeys">
                    <div v-for="row in rows" :key="row.r" class="k-icb__row" role="row" :aria-rowindex="row.r + 1" :style="{height: cellH + 'px', transform: 'translateY(' + row.r * cellH + 'px)', gridTemplateColumns: 'repeat(' + cols + ', minmax(0, 1fr))'}">
                        <div v-for="c in row.cells" :key="cur + c.name" role="gridcell" :aria-colindex="c.k + 1" :aria-selected="c.name === selected">
                            <button type="button" class="k-icb__cell" :class="{on: c.name === selected}" :data-i="c.i" :tabindex="c.i === active ? 0 : -1" :title="c.name" :aria-label="'Copy ' + c.name" @click="pick(c)" @focus="active = c.i">
                                <Icon :set="cur" :name="c.name" :size="size" :stroke="stroke" :color="color"/><span aria-hidden="true">{{ c.name }}</span></button></div></div></div>
            </div>
            <aside class="k-icb__prev" :class="{'is-light': light}" aria-label="Preview">
                <Toggle v-model="light" label="Light preview"/>
                <template v-if="selected">
                    <div class="k-icb__stage"><Icon :set="cur" :name="selected" :size="96" :stroke="stroke" :color="color" :label="selected + ', large'"/><Icon :set="cur" :name="selected" :size="size" :stroke="stroke" :color="color" :label="selected + ', ' + size + ' pixels'"/></div>
                    <b class="k-icb__name">{{ selected }}</b>
                    <code class="k-icode">{{ snippet }}</code>
                    <div class="k-icb__acts"><button type="button" class="btn primary" @click="copy(snippet, 'the snippet for ' + selected)"><Ico n="check" :s="16"/>Copy snippet</button>
                        <button v-if="extra" type="button" class="btn" @click="copy(extra.text, 'the tag for ' + selected)">{{ extra.l }}</button><button type="button" class="btn" @click="copyName">Copy name</button></div>
                </template>
                <p v-else class="k-icb__none">No icon selected.</p>
            </aside>
        </div></div>`,
};

// ---------- IconFontDemo ----------
export const IconFontDemo = {
    name: 'KIconFontDemo',
    setup() {
        const failed = ref(false), syncing = ref(false); let timer = 0;
        const load = () => { failed.value = false; loadBootstrapCss().catch(e => { console.warn('icons', e); failed.value = true; }); };
        onMounted(load); onBeforeUnmount(() => clearTimeout(timer));
        const sync = () => { if (syncing.value) return; syncing.value = true; timer = setTimeout(() => { syncing.value = false; toast('42 invoices synced'); }, 2200); };
        const code = '<button class="btn primary">\n  <i class="bi bi-send" aria-hidden="true"></i> Send invoice\n</button>\n\n<button class="icon-btn" aria-label="Print">\n  <i class="bi bi-printer" aria-hidden="true"></i>\n</button>';
        const rows = [
            {icon: 'check-circle-fill', tone: 'ok', title: 'INV-2041, Northwind', note: 'Paid by bank transfer', sum: '$12,400'},
            {icon: 'hourglass-split', tone: 'warn', title: 'INV-2042, Fabrikam', note: 'Due in 3 days', sum: '$8,150'},
            {icon: 'exclamation-triangle-fill', tone: 'bad', title: 'INV-2038, Contoso', note: 'Overdue by 12 days', sum: '$3,980'},
        ];
        return {failed, load, syncing, sync, code, rows, toast, copyCode: () => copyWithToast(code, 'the button markup')};
    },
    template: `<div class="k-ifd">
        <div v-if="failed" class="k-ifd__fail" role="alert"><p>The icon font could not be loaded.</p><button type="button" class="btn" @click="load">Try again</button></div>
        <section><h4>Inline with text</h4><p>Reach the team by <i class="bi bi-envelope" aria-hidden="true"></i> email or <i class="bi bi-telephone" aria-hidden="true"></i> phone. Orders placed before noon <i class="bi bi-truck" aria-hidden="true"></i> ship the same day. The icon takes the size and colour of the text around it.</p>
            <div class="k-ifd__sizes"><span v-for="s in [14, 18, 24, 32, 44]" :key="s" :style="{fontSize: s + 'px'}"><i class="bi bi-box-seam" aria-hidden="true"></i><small>{{ s }}px</small></span></div></section>
        <section><h4>With buttons</h4><div class="k-ifd__btns">
            <button type="button" class="btn primary" @click="toast('Invoice sent to Northwind')"><i class="bi bi-send" aria-hidden="true"></i>Send invoice</button>
            <button type="button" class="btn" @click="toast('Report downloaded')"><i class="bi bi-download" aria-hidden="true"></i>Download report</button>
            <button type="button" class="btn" :aria-busy="syncing" @click="sync"><i class="bi bi-arrow-repeat" :class="{'k-ifd__spin': syncing}" aria-hidden="true"></i>{{ syncing ? 'Syncing' : 'Sync now' }}</button>
            <button type="button" class="btn" @click="toast('Opening the next order')">Next order<i class="bi bi-arrow-right" aria-hidden="true"></i></button>
            <button type="button" class="btn danger" @click="toast('Draft deleted')"><i class="bi bi-trash" aria-hidden="true"></i>Delete draft</button>
            <button type="button" class="icon-btn k-ifd__ib" aria-label="Print" title="Print" @click="toast('Sent to the printer')"><i class="bi bi-printer" aria-hidden="true"></i></button>
            <button type="button" class="icon-btn k-ifd__ib" aria-label="Share" title="Share" @click="toast('Share link created')"><i class="bi bi-share" aria-hidden="true"></i></button></div></section>
        <section><h4>In a list</h4><ul class="k-ifd__list"><li v-for="r in rows" :key="r.title"><i class="bi" :class="['bi-' + r.icon, 't-' + r.tone]" aria-hidden="true"></i><div><b>{{ r.title }}</b><small>{{ r.note }}</small></div><b>{{ r.sum }}</b></li></ul></section>
        <section><h4>Markup</h4><pre class="k-icode"><code>{{ code }}</code></pre><button type="button" class="btn" @click="copyCode"><i class="bi bi-clipboard" aria-hidden="true"></i>Copy markup</button></section></div>`,
};

// ---------- DemoIcons ----------
export const DemoIcons = {
    name: 'KDemoIcons',
    components: {Icon, IconBrowser, IconFontDemo},
    setup() {
        const busy = ref(true);
        const TILES = [   // the same business actions drawn with each set
            {l: 'Invoices', lucide: 'file-text', bi: 'file-earmark-text', ui: 'download'}, {l: 'Payments', lucide: 'wallet', bi: 'wallet2', ui: 'wallet'}, {l: 'Customers', lucide: 'users', bi: 'people', ui: 'users'},
            {l: 'Messages', lucide: 'mail', bi: 'envelope', ui: 'mail'}, {l: 'Alerts', lucide: 'bell', bi: 'bell', ui: 'bell'}, {l: 'Revenue', lucide: 'trending-up', bi: 'graph-up-arrow', ui: 'trend'}, {l: 'Settings', lucide: 'settings', bi: 'gear', ui: 'gear'},
        ];
        const NOTES = [
            ['Register', "import { registerKitIcons } from './kit-icons.js';\nregisterKitIcons(app);"],
            ['One component, three sets', '<Icon set="lucide" name="truck" :size="24" :stroke="1.5" />\n<Icon set="bi" name="truck" :size="24" color="var(--ok)" />\n<Icon set="ui" name="wallet" />'],
            ['Accessible and busy states', '<Icon set="lucide" name="triangle-alert" label="Payment overdue" />\n<Icon set="lucide" name="loader-circle" spin label="Loading orders" />'],
            ['Browser', '<IconBrowser set="bi" :height="480" @copy="onCopy" />'],
        ];
        return {SETS: ICON_SETS, TILES, NOTES, busy, copy: text => copyWithToast(text, 'the example')};
    },
    template: `<div class="k-idm">
        <Holder title="Icon" sub="One component for the kit icons, Bootstrap Icons and Lucide">
            <div v-for="s in SETS" :key="s.v" class="k-idm__set"><h4>{{ s.l }}</h4><ul class="k-idm__tiles"><li v-for="t in TILES" :key="t.l"><Icon :set="s.v" :name="t[s.v]" :size="26"/><small>{{ t.l }}</small></li></ul></div>
            <div class="k-idm__grid">
                <Card><h4>Size</h4><div class="k-idm__row"><Icon v-for="n in [16, 20, 28, 40]" :key="n" set="lucide" name="package" :size="n"/></div></Card>
                <Card><h4>Stroke</h4><div class="k-idm__row"><Icon v-for="n in [1, 1.5, 2, 2.75]" :key="n" set="lucide" name="package" :size="32" :stroke="n"/></div></Card>
                <Card><h4>Colour</h4><div class="k-idm__row"><Icon set="lucide" name="circle-check" :size="30" color="var(--ok)" label="Paid"/><Icon set="lucide" name="clock" :size="30" color="var(--warn)" label="Waiting"/><Icon set="bi" name="x-octagon-fill" :size="28" color="var(--bad)" label="Failed"/><Icon set="ui" name="star" :size="30" color="var(--accent-c)" label="Favourite"/></div></Card>
                <Card><h4>Spin</h4><div class="k-idm__row"><Icon set="lucide" name="loader-circle" :size="30" :spin="busy" label="Loading orders"/><Icon set="bi" name="arrow-repeat" :size="30" :spin="busy" label="Syncing"/><Icon set="ui" name="gear" :size="30" :spin="busy" label="Working"/></div><Toggle v-model="busy" label="Spinning"/></Card>
            </div></Holder>
        <Holder title="Icon browser" sub="Search a set, set size, stroke and colour, then click an icon to copy its snippet"><IconBrowser/></Holder>
        <Holder title="Icon font" sub="Bootstrap Icons straight in the markup"><IconFontDemo/></Holder>
        <Holder title="Usage" sub="What to write and what it costs">
            <div class="k-idm__grid"><Card v-for="n in NOTES" :key="n[0]"><h4>{{ n[0] }}</h4><pre class="k-icode"><code>{{ n[1] }}</code></pre><button type="button" class="btn" @click="copy(n[1])">Copy</button></Card></div>
            <ul class="k-idm__notes">
                <li><b>Props:</b> name, set (ui, bi or lucide), size, stroke, color, spin, label.</li>
                <li><b>Loading:</b> a page that shows no icon of a set never downloads it. Bootstrap Icons costs about 85 KB of CSS plus a 131 KB font, Lucide one 604 KB sprite (less when the server compresses it). The kit icons cost nothing.</li>
                <li><b>Accessibility:</b> give a label only when the icon carries meaning on its own. Next to text, leave it out. An icon-only button gets its name on the button.</li>
                <li><b>Stroke:</b> works on the kit icons and Lucide. Bootstrap Icons is a font, so pick its filled (-fill) names for more weight.</li>
                <li><b>Licences:</b> Bootstrap Icons is MIT, Lucide is ISC (some icons MIT, from Feather). Both licence files sit next to the vendor files.</li>
            </ul></Holder></div>`,
};

export function registerKitIcons(app) {
    Object.entries({Icon, IconBrowser, IconFontDemo, DemoIcons}).forEach(([k, v]) => app.component(k, v));
}
