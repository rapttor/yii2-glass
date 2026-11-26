// Glass kit, knobs and dials: one rotary control with five looks. Register with `registerKitKnobs(app)`; `DemoKnobs` shows them all.
// Styles: scss/kit/_knobs.scss (class prefix k-knob). Needs the global Ico, Badge, Card, Holder and Segmented of the v4 kit.
import { ref, computed, onMounted, nextTick, inject } from '../vendor/vue.esm-browser.prod.js';
import { PATHS } from './ui.js';

Object.assign(PATHS, {
    knobsound: 'M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11',
    knobmute: 'M4 9h4l5-4v14l-5-4H4zM16 9.5l5 5M21 9.5l-5 5',
});

// ---------- maths (no DOM). Angles are degrees clockwise from 12 o'clock; the dial sweeps 270, the 90 at the bottom is the dead zone. ----------
const SWEEP = 270;
const SLACK = (360 - SWEEP) / SWEEP;   // a circular drag may overshoot by the dead zone and come back without the value moving early
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fracToAngle = f => -SWEEP / 2 + f * SWEEP;
const pointerAngle = (dx, dy) => Math.atan2(dx, -dy) * 180 / Math.PI;
const wrapDeg = d => ((d + 180) % 360 + 360) % 360 - 180;   // shortest way round, so crossing 6 o'clock never counts as a full turn back
const polar = (deg, r) => { const a = deg * Math.PI / 180; return [+(50 + r * Math.sin(a)).toFixed(3), +(50 - r * Math.cos(a)).toFixed(3)]; };
const arcPath = r => 'M' + polar(-SWEEP / 2, r).join(' ') + 'A' + r + ' ' + r + ' 0 ' + (SWEEP > 180 ? 1 : 0) + ' 1 ' + polar(SWEEP / 2, r).join(' ');
const arcLength = r => r * SWEEP * Math.PI / 180;
const decimals = n => { const m = /(?:\.(\d+))?(?:e-(\d+))?$/.exec(String(n)); return Math.min(10, (m[1]?.length || 0) + +(m[2] || 0)); };
// Nearest point of the grid base + n * step; the two ends are always reachable, also when the range is not a multiple of the step.
function snap(v, min, max, step, base) {
    if (!(v > min)) return min; if (v >= max) return max;
    const g = base + Math.round((v - base) / step) * step;
    if (g > max || max - v < Math.abs(v - g)) return max;
    if (g < min || v - min < Math.abs(v - g)) return min;
    return +g.toFixed(Math.max(decimals(step), decimals(base)));
}
// n grid points away from v; an off-grid value first goes to the next point in that direction.
function nudge(v, n, min, max, step, base) {
    const q = (v - base) / step, g = base + ((n > 0 ? Math.floor(q + 1e-6) : Math.ceil(q - 1e-6)) + n) * step;
    return clamp(+g.toFixed(Math.max(decimals(step), decimals(base))), min, max);
}
// Drag intent, fixed at the first movement. (x, y) is the start relative to the centre, (dx, dy) the movement.
// On the face: linear (up or right raises). On the rim: movement along the circle turns the dial, movement across it is linear.
function dragMode(x, y, dx, dy, radius) {
    const r = Math.hypot(x, y); if (r < radius * .66) return 'linear';
    return Math.abs(dy * x - dx * y) >= Math.abs(dx * x + dy * y) ? 'turn' : 'linear';
}
// Value <-> position (0..1). `marks`: only those values, evenly spaced. `origin` (bipolar): that value sits at 12 o'clock, each side scales on its own.
function makeScale({min = 0, max = 100, step = 1, fineStep, marks, bipolar, origin}) {
    if (marks?.length > 1) {
        const vals = marks.map(m => typeof m === 'object' ? m.v : m), n = vals.length - 1;
        const idx = v => vals.reduce((best, x, i) => Math.abs(x - v) < Math.abs(vals[best] - v) ? i : best, 0);
        return {min: Math.min(...vals), max: Math.max(...vals), clean: v => vals[idx(v)], toFrac: v => idx(v) / n, fromFrac: f => vals[Math.round(clamp(f, 0, 1) * n)],
            move: (v, k) => vals[clamp(idx(v) + k, 0, n)], page: Math.max(1, Math.round(n / 4)), first: vals[0], last: vals[n]};
    }
    const st = step > 0 ? step : 1, fs = fineStep > 0 ? fineStep : st;
    const o = bipolar ? clamp(origin ?? (min < 0 && max > 0 ? 0 : (min + max) / 2), min, max) : min;
    const toFrac = v => {
        v = clamp(v, min, max);
        if (!bipolar) return max > min ? (v - min) / (max - min) : 0;
        return v < o ? .5 * (v - min) / (o - min) : .5 + (max > o ? .5 * (v - o) / (max - o) : 0);
    };
    const fromFrac = (f, fine) => {
        if (f <= 0) return min; if (f >= 1) return max;
        const s = fine ? fs : st;
        if (bipolar && !fine && s / (max - min) < .01 && Math.abs(f - .5) < .015) return o;   // soft detent at the centre for fine-grained scales
        const raw = !bipolar ? min + f * (max - min) : f < .5 ? o - (.5 - f) * 2 * (o - min) : o + (f - .5) * 2 * (max - o);
        return snap(raw, min, max, s, o);
    };
    return {min, max, origin: o, clean: v => clamp(v, min, max), toFrac, fromFrac, move: (v, k, fine) => nudge(v, k, min, max, fine ? fs : st, o),
        page: Math.max(1, Math.round((max - min) / 10 / st)), first: min, last: max};
}
export const knobMath = {SWEEP, SLACK, clamp, fracToAngle, pointerAngle, wrapDeg, polar, arcPath, arcLength, decimals, snap, nudge, dragMode, makeScale};

// ---------- wheel: remember when the page was last scrolled, so a knob passing under a resting pointer never takes over that gesture ----------
let pageWheelAt = -1e9, watching = false;
function watchPageWheel() {
    if (watching) return; watching = true;
    addEventListener('wheel', e => { if (!e.target.closest?.('.k-knob__dial')) pageWheelAt = e.timeStamp; }, {capture: true, passive: true});
}

let uid = 0;
const SIZES = {arc: 96, dial: 96, steps: 160, bipolar: 112, thermo: 240};

// ---------- the knob ----------
export const Knob = {
    props: {
        modelValue: Number, variant: {type: String, default: 'arc'},   // arc | dial | steps | bipolar | thermo
        min: {type: Number, default: 0}, max: {type: Number, default: 100}, step: {type: Number, default: 1}, fineStep: Number, pageStep: Number,
        defaultValue: Number, origin: Number, marks: Array, marker: Number,   // marks: [value | {v, l}] (steps); marker: a second, read-only value (thermo: current reading)
        size: Number, label: String, ariaLabel: String, hideLabel: Boolean, hideValue: Boolean, unit: {type: String, default: ''}, format: Function, color: String, negColor: String, disabled: Boolean,
    },
    emits: ['update:modelValue', 'change'],   // change: once a drag ends, and after each key, wheel, tap or reset
    setup(p, {emit}) {
        const fc = inject('kfield', {}), id = 'knob-' + (++uid), el = ref(null), dragging = ref(false);
        const bip = computed(() => p.variant === 'bipolar');
        const sc = computed(() => makeScale({min: p.min, max: p.max, step: p.step, fineStep: p.fineStep, marks: p.variant === 'steps' ? p.marks : null, bipolar: bip.value, origin: p.origin}));
        const initial = p.modelValue;
        const fallback = () => p.defaultValue ?? (bip.value ? sc.value.origin : initial ?? sc.value.first);
        const valid = v => typeof v === 'number' && !Number.isNaN(v);
        const value = computed(() => sc.value.clean(valid(p.modelValue) ? p.modelValue : fallback()));

        // `shadow` bridges the gap until the parent's new value arrives, so quick successive events build on each other
        let shadow = null;
        const cur = () => shadow ?? value.value;
        function apply(v) { if (p.disabled || v === cur()) return false; shadow = v; emit('update:modelValue', v); nextTick(() => { shadow = null; }); return true; }
        const commit = v => { if (apply(v)) emit('change', v); };
        const reset = () => commit(sc.value.clean(fallback()));

        // pointer: every drag is relative to where it started, so the value never jumps to the pointer
        let drag = null, lastTap = null, armed = false;   // armed: the mouse was moved onto the knob (used by the wheel)
        function down(e) {
            if (p.disabled || e.button > 0 || (drag && el.value.hasPointerCapture(drag.id))) return;
            e.preventDefault(); el.value.focus({preventScroll: true});
            try { el.value.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
            const r = el.value.getBoundingClientRect(), mark = e.target.closest?.('[data-k]');
            drag = {id: e.pointerId, x: e.clientX, y: e.clientY, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2, mode: '', f: sc.value.toFrac(cur()), angle: null, start: cur(), end: cur(), mark: mark ? +mark.dataset.k : null};
        }
        function move(e) {
            if (e.pointerType === 'mouse') armed = true;
            const d = drag; if (!d || e.pointerId !== d.id) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (!d.mode) {
                if (Math.hypot(dx, dy) < 4) return;
                d.mode = dragMode(d.x - d.cx, d.y - d.cy, dx, dy, d.r); d.angle = pointerAngle(d.x - d.cx, d.y - d.cy); dragging.value = true;
            }
            const rate = e.shiftKey ? .1 : 1;
            if (d.mode === 'linear') d.f = clamp(d.f + (dx - dy) / Math.max(200, d.r * 2) * rate, 0, 1);
            else {
                const x = e.clientX - d.cx, y = e.clientY - d.cy;
                if (Math.hypot(x, y) < d.r * .2) d.angle = null;   // next to the centre the angle is meaningless
                else { const a = pointerAngle(x, y); if (d.angle !== null) d.f = clamp(d.f + wrapDeg(a - d.angle) / SWEEP * rate, -SLACK, 1 + SLACK); d.angle = a; }
            }
            d.x = e.clientX; d.y = e.clientY;
            const v = sc.value.fromFrac(clamp(d.f, 0, 1), e.shiftKey);
            if (apply(v)) d.end = v;
        }
        function finish(e, tap) {
            const d = drag; if (!d || e.pointerId !== d.id) return;
            drag = null; dragging.value = false;
            if (d.mode) { lastTap = null; if (d.end !== d.start) emit('change', d.end); return; }
            if (!tap) return;
            // a double click or double tap resets; handled here because dblclick is unreliable with touch-action: none and also fires after two quick drags
            if (lastTap && e.timeStamp - lastTap.t < 400 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) { lastTap = null; reset(); return; }
            lastTap = {t: e.timeStamp, x: e.clientX, y: e.clientY};
            if (d.mark !== null) commit(d.mark);   // a tap on a tick label picks that step
        }

        function key(e) {
            if (p.disabled || e.ctrlKey || e.metaKey || e.altKey) return;
            const s = sc.value, big = p.pageStep && !p.marks ? Math.max(1, Math.round(p.pageStep / p.step)) : s.page;
            const steps = {ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: big, PageDown: -big}[e.key];
            if (steps) { e.preventDefault(); commit(s.move(cur(), steps, e.shiftKey && Math.abs(steps) === 1)); }
            else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); commit(e.key === 'Home' ? s.first : s.last); }
            else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); reset(); }
        }

        // wheel: only when focused, or after the mouse was moved onto the knob while the page was at rest. At either end the page scrolls as usual.
        let wheelAt = -1e9, travel = 0;
        function wheel(e) {
            const d = e.deltaY || (e.shiftKey ? e.deltaX : 0);   // some systems turn Shift + wheel into a horizontal wheel
            if (p.disabled || e.ctrlKey || !d || (!e.shiftKey && Math.abs(e.deltaX) > Math.abs(e.deltaY))) return;
            const t = e.timeStamp, dir = d < 0 ? 1 : -1;
            if (t - wheelAt > 400) {   // a new gesture: may the knob take it?
                const focused = document.activeElement === el.value;
                if (t - pageWheelAt < 400 || (!focused && !armed) || sc.value.move(cur(), dir, e.shiftKey) === cur()) { pageWheelAt = t; return; }
                travel = 0;
            }
            e.preventDefault(); wheelAt = t;
            const px = Math.abs(d) * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1);
            travel += px;
            if (px >= 40 || travel >= 40) { travel = 0; commit(sc.value.move(cur(), dir, e.shiftKey)); }   // one mouse notch, or 40 px of trackpad, per step
        }
        onMounted(watchPageWheel);

        // ---------- view ----------
        const size = computed(() => Math.max(44, p.size || SIZES[p.variant] || 96));
        const frac = computed(() => sc.value.toFrac(value.value));
        const from = computed(() => bip.value ? .5 : 0);
        const angle = computed(() => fracToAngle(frac.value));
        const ring = computed(() => p.variant === 'arc' || bip.value || p.variant === 'dial');
        const cap = computed(() => p.variant === 'dial' || p.variant === 'steps');
        const inside = computed(() => !cap.value && size.value >= 72);
        const dec = computed(() => Math.max(decimals(p.step), decimals(p.fineStep ?? 0)));
        const num = v => (bip.value && sc.value.origin === 0 && v > 0 ? '+' : '') + v.toFixed(dec.value);
        const show = v => p.format ? String(p.format(v)) : num(v) + p.unit;
        const text = computed(() => show(value.value));
        const radius = computed(() => p.variant === 'dial' ? 45.5 : 42);
        const seg = computed(() => {   // the lit part of the ring, as a dash in real path units
            const a = Math.min(from.value, frac.value), b = Math.max(from.value, frac.value), len = arcLength(radius.value);
            return {strokeDasharray: (b - a) * len + 'px ' + 2 * len + 'px', strokeDashoffset: -a * len + 'px', opacity: b - a > .001 ? 1 : 0};
        });
        const line = (f, r1, r2) => { const a = fracToAngle(f), [x1, y1] = polar(a, r1), [x2, y2] = polar(a, r2); return {x1, y1, x2, y2}; };
        const marker = computed(() => p.variant === 'thermo' && valid(p.marker) ? fracToAngle(sc.value.toFrac(p.marker)) : null);
        const steps = computed(() => {
            if (p.variant !== 'steps') return [];
            let list = p.marks?.length > 1 ? p.marks.map(m => typeof m === 'object' ? m : {v: m}) : null;
            if (!list) {   // no marks: label every step when there are few, else six evenly spread values
                const s = sc.value, n = Math.round((s.max - s.min) / (p.step || 1)), count = n >= 1 && n <= 10 ? n : 5;
                list = [...new Set(Array.from({length: count + 1}, (_, i) => s.fromFrac(i / count)))].map(v => ({v}));
            }
            return list.map(m => { const f = sc.value.toFrac(m.v), [x, y] = polar(fracToAngle(f), 45);
                return {v: m.v, f, l: m.l ?? m.v, on: m.v === value.value, style: {left: x + '%', top: y + '%'}}; });
        });
        const ticks = computed(() => {
            const f = frac.value, lit = (t, a, b) => t >= Math.min(a, b) - 1e-6 && t <= Math.max(a, b) + 1e-6;
            if (p.variant === 'steps') return steps.value.map(s => ({...line(s.f, 31, 36), key: s.v, on: s.f <= f + 1e-6}));
            if (p.variant !== 'thermo') return [];
            // thermostat: lit between the current reading and the target, or from the start when there is no reading
            const a = marker.value === null ? 0 : sc.value.toFrac(p.marker), none = marker.value !== null && Math.abs(a - f) < 1e-6;
            return Array.from({length: 55}, (_, i) => ({...line(i / 54, 40.5, 47.5), key: i, on: !none && lit(i / 54, a, f)}));
        });
        const cls = computed(() => ['k-knob--' + p.variant, {dis: p.disabled, drag: dragging.value, small: size.value < 72, neg: bip.value && value.value < sc.value.origin}]);
        const style = computed(() => ({'--k-size': size.value + 'px', '--k-w': Math.max(64, size.value + (p.variant === 'steps' ? 40 : 0)) + 'px',
            '--k-c': (bip.value && value.value < sc.value.origin && p.negColor) || p.color || 'var(--accent-c)'}));
        const labelled = computed(() => p.label && !p.hideLabel ? id + '-l' : !p.ariaLabel && !p.label ? fc.labelId : null);
        return {fc, id, el, sc, value, text, num, angle, ring, cap, inside, radius, seg, ticks, steps, marker, cls, style, labelled, bip, line, arcPath, polar,
            down, move, key, wheel, up: e => finish(e, true), cancel: e => finish(e, false), leave: () => { armed = false; }, focus: () => el.value.focus()};
    },
    template: `<div class="k-knob" :class="cls" :style="style">
        <div ref="el" class="k-knob__dial" role="slider" :id="fc.id || id" :tabindex="disabled ? -1 : 0" :aria-labelledby="labelled" :aria-label="labelled ? null : (ariaLabel || label || 'Value')" :aria-describedby="fc.describedby"
            :aria-valuemin="sc.min" :aria-valuemax="sc.max" :aria-valuenow="value" :aria-valuetext="text" :aria-disabled="disabled || null" :aria-invalid="fc.invalid || null"
            @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancel" @lostpointercapture="cancel" @pointerleave="leave" @keydown="key" @wheel="wheel" @dragstart.prevent @contextmenu.prevent>
            <div v-if="variant === 'thermo'" class="k-knob__disc"></div>
            <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <template v-if="ring"><path class="k-knob__track" :d="arcPath(radius)"/><path class="k-knob__fill" :d="arcPath(radius)" :style="seg"/></template>
                <line v-for="t in ticks" :key="t.key" class="k-knob__tick" :class="{on: t.on}" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"/>
                <line v-if="bip" class="k-knob__zero" v-bind="line(.5, 35.5, 49)"/>
                <g v-if="marker !== null" class="k-knob__turn" :style="{transform: 'rotate(' + marker + 'deg)'}"><circle class="k-knob__marker" cx="50" cy="13.5" r="2"/></g>
                <g v-if="variant === 'arc' || bip || variant === 'thermo'" class="k-knob__turn" :style="{transform: 'rotate(' + angle + 'deg)'}"><circle class="k-knob__thumb" cx="50" :cy="variant === 'thermo' ? 6 : 8" :r="variant === 'thermo' ? 4.6 : 3"/></g>
            </svg>
            <template v-if="cap"><div class="k-knob__cap"></div><div class="k-knob__rot" :style="{transform: 'rotate(' + angle + 'deg)'}"><i></i></div></template>
            <div v-if="inside && (!hideValue || $slots.default)" class="k-knob__mid" aria-hidden="true">
                <b v-if="!hideValue"><template v-if="format">{{ text }}</template><template v-else>{{ num(value) }}<small v-if="unit">{{ unit }}</small></template></b><slot :value="value" :text="text"/></div>
            <span v-for="s in steps" :key="s.v" class="k-knob__mk" :class="{on: s.on}" :style="s.style" :data-k="s.v" aria-hidden="true">{{ s.l }}</span>
        </div>
        <b v-if="!inside && !hideValue" class="k-knob__v" aria-hidden="true">{{ text }}</b>
        <span v-if="label && !hideLabel" :id="id + '-l'" class="k-knob__l" @click="focus">{{ label }}</span>
    </div>`,
};

// ---------- showcase ----------
const money = n => n.toLocaleString('en', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' EUR';

export const DemoKnobs = {
    components: {Knob},
    setup() {
        const channels = ref([
            {id: 'mic', name: 'Reception mic', gain: 68, pan: 0, on: true}, {id: 'music', name: 'Shop music', gain: 42, pan: -20, on: true},
            {id: 'pa', name: 'Announcements', gain: 80, pan: 15, on: true}, {id: 'call', name: 'Video call', gain: 55, pan: 0, on: false},
        ]);
        const pan = v => v === 0 ? 'C' : (v < 0 ? 'L ' : 'R ') + Math.abs(v);
        const room = ref(19.5), target = ref(21.5), mode = ref('Comfort');
        const status = computed(() => mode.value === 'Off' ? 'Heating off' : target.value > room.value ? 'Heating' : target.value < room.value ? 'Cooling' : 'On target');
        const heat = computed(() => status.value === 'Heating' ? 'var(--warn)' : 'var(--accent-c)');
        const setMode = m => { mode.value = m; if (m === 'Comfort') target.value = 21.5; else if (m === 'Eco') target.value = 18; };
        const list = 1240, adjust = ref(-10), price = computed(() => list * (1 + adjust.value / 100));
        const volume = ref(60), muted = ref(false), saved = ref('');
        const terms = ref(14), priority = ref(3), PRIORITY = ['Lowest', 'Low', 'Normal', 'High', 'Urgent'];
        const sizes = ref([30, 50, 70]), locked = ref(35);
        return {channels, pan, room, target, mode, status, heat, setMode, list, adjust, price, money, volume, muted, saved, terms, priority, sizes, locked,
            termMarks: [{v: 0, l: 'Now'}, 7, 14, 30, 45, 60],   // uneven values, evenly spaced on the dial
            termText: v => v ? v + ' days' : 'On receipt', prio: v => PRIORITY[v - 1]};
    },
    template: `<div class="page k-knob-demo">
        <Holder title="Audio mixer" sub="Drag up and down on the face, or around the rim. Shift is finer, a double click resets.">
            <div class="k-knob-mix"><Card v-for="c in channels" :key="c.id" class="k-knob-strip" role="group" :aria-label="c.name">
                <h4>{{ c.name }}</h4>
                <Knob v-model="c.gain" variant="dial" :size="84" :default-value="60" :disabled="!c.on" unit="%" label="Gain" :aria-label="c.name + ' gain'"/>
                <Knob v-model="c.pan" variant="bipolar" :size="56" :min="-50" :max="50" :step="5" :format="pan" :disabled="!c.on" label="Pan"/>
                <button type="button" class="k-knob-btn" :class="{on: !c.on}" :aria-pressed="!c.on" :aria-label="'Mute ' + c.name" @click="c.on = !c.on"><Ico :n="c.on ? 'knobsound' : 'knobmute'" :s="18"/><span>{{ c.on ? 'Mute' : 'Muted' }}</span></button>
            </Card></div>
        </Holder>
        <div class="k-knob-gal">
            <Holder title="Thermostat" sub="Meeting room 2. Shift adjusts in tenths.">
                <template #actions><Badge :kind="status === 'Heating' ? 'y' : status === 'Heating off' ? 'n' : 'b'">{{ status }}</Badge></template>
                <Card class="k-knob-card"><Knob v-model="target" variant="thermo" :min="14" :max="28" :step="0.5" :fine-step="0.1" :default-value="21" :marker="room" :color="heat" :disabled="mode === 'Off'" unit="°C" label="Target temperature">
                    <small>Room {{ room.toFixed(1) }}°C</small></Knob>
                    <Segmented :model-value="mode" :options="['Comfort', 'Eco', 'Off']" @update:model-value="setMode"/></Card>
            </Holder>
            <Holder title="Discount or markup" sub="Zero sits at the top: left is a discount, right a markup.">
                <Card class="k-knob-card"><Knob v-model="adjust" variant="bipolar" :size="160" :min="-30" :max="50" unit="%" neg-color="var(--warn)" label="Price adjustment"/>
                    <dl class="k-knob-sum"><div><dt>List price</dt><dd>{{ money(list) }}</dd></div><div><dt>{{ adjust < 0 ? 'Discount' : 'Markup' }}</dt><dd>{{ money(price - list) }}</dd></div><div class="total"><dt>Offer price</dt><dd aria-live="polite">{{ money(price) }}</dd></div></dl></Card>
            </Holder>
            <Holder title="Notification volume" sub="Steps of five. The change event saves once per adjustment.">
                <Card class="k-knob-card"><Knob v-model="volume" :size="144" :step="5" :default-value="60" :disabled="muted" unit="%" label="Alerts and chimes" @change="saved = 'Saved ' + $event + '%'"><small>{{ muted ? 'Muted' : 'Volume' }}</small></Knob>
                    <button type="button" class="k-knob-btn" :class="{on: muted}" :aria-pressed="muted" @click="muted = !muted"><Ico :n="muted ? 'knobmute' : 'knobsound'" :s="18"/><span>{{ muted ? 'Unmute' : 'Mute' }}</span></button>
                    <small class="k-knob-note" role="status">{{ saved || 'Not changed yet' }}</small></Card>
            </Holder>
            <Holder title="Stepped dials" sub="Only the marked values. Tap a label to pick it.">
                <Card class="k-knob-card"><div class="k-knob-row"><Knob v-model="terms" variant="steps" :marks="termMarks" :default-value="14" :format="termText" label="Payment terms"/>
                    <Knob v-model="priority" variant="steps" :min="1" :max="5" :default-value="3" :format="prio" label="Ticket priority"/></div></Card>
            </Holder>
            <Holder title="Sizes and states" sub="From the 44 px minimum up, and disabled">
                <Card class="k-knob-card"><div class="k-knob-row"><Knob v-model="sizes[0]" :size="44" label="Small"/><Knob v-model="sizes[1]" :size="64" variant="dial" label="Medium"/><Knob v-model="sizes[2]" :size="96" label="Large"/><Knob :model-value="locked" :size="96" variant="dial" unit="%" disabled label="Locked"/></div></Card>
            </Holder>
        </div></div>`,
};

export function registerKitKnobs(app) {
    Object.entries({Knob, DemoKnobs}).forEach(([k, c]) => app.component(k, c));
}
