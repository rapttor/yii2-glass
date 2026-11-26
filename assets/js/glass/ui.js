// UI kit of the glass admin boilerplate: small Vue 3 components, no build step. Register them with `registerUi(app)`.
// Everything is styled by css/glass.css (frosted glass tokens) and reads yii2-themes variables (--brand, --brand-ink).
import { h, ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from '../vendor/vue.esm-browser.prod.js';

export const toasts = reactive([]);
export function toast(text, kind = 'ok') {
    const t = {id: Math.random(), text, kind}; toasts.push(t);
    setTimeout(() => { const i = toasts.indexOf(t); if (i > -1) toasts.splice(i, 1); }, 3200);
}

export const PATHS = {
    home: 'M4 11l8-6 8 6v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', bag: 'M6 8h12l1 12H5zM9 8a3 3 0 0 1 6 0', users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c.6-3.2 3-4.5 6-4.5s5.4 1.3 6 4.5M16 5.5a3 3 0 0 1 0 5.5M18 14.8c1.7.5 2.7 1.8 3 4',
    check: 'M5 12.5l4.5 4.5L19 7', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.3 3h-4l-.3 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.3 2.6h4l.3-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', bell: 'M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18',
    chev: 'M9 6l6 6-6 6', down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6', menu: 'M4 7h16M4 12h16M4 17h10', sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01', trend: 'M4 17l5-5 3 3 7-8M15 7h4v4', wallet: 'M4 7h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 7l11-3M16 13h2',
    mail: 'M4 6h16v12H4zM4 7l8 6 8-6', phone: 'M6 4h4l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v4a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z', download: 'M12 4v11M7 11l5 5 5-5M5 20h14', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
    filter: 'M4 6h16M7 12h10M10 18h4', dots: 'M6 12h.01M12 12h.01M18 12h.01', cal: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4', star: 'M12 4l2.3 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.8 2.7 1.1-5.4-4-3.7L9.7 9z', logout: 'M10 5H5v14h5M14 8l4 4-4 4M18 12H9', install: 'M12 3v10M8 9l4 4 4-4M5 15v4h14v-4', wifi: 'M3 9a14 14 0 0 1 18 0M6 13a9 9 0 0 1 12 0M9.5 16.5a4 4 0 0 1 5 0M12 20h.01',
};

export const Ico = {
    props: {n: String, s: {type: Number, default: 20}},
    setup: p => () => h('svg', {class: 'ico', width: p.s, height: p.s, viewBox: '0 0 24 24', 'aria-hidden': 'true'}, [h('path', {d: PATHS[p.n] || ''})]),
};

export const Holder = {   // a frosted section that holds components
    props: {title: String, sub: String, flat: Boolean},
    template: `<section class="holder" :class="{flat}"><header v-if="title || $slots.actions" class="holder__h"><div><h3>{{ title }}</h3><p v-if="sub">{{ sub }}</p></div><div class="holder__a"><slot name="actions"/></div></header><slot/></section>`,
};
export const Card = {     // a lighter frosted card inside a holder
    props: {tag: {type: String, default: 'div'}, tap: Boolean},
    template: `<component :is="tag" class="gcard" :class="{tap}"><slot/></component>`,
};
export const Badge = {
    props: {kind: {type: String, default: 'n'}},
    template: `<span class="badge" :class="'b-' + kind"><slot/></span>`,
};
export const Avatar = {
    props: {name: String, size: {type: Number, default: 34}, hue: Number},
    setup(p) {
        const initials = computed(() => (p.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase());
        const hue = computed(() => p.hue ?? ([...(p.name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360);
        return {initials, hue};
    },
    template: `<span class="av" :style="{width: size + 'px', height: size + 'px', fontSize: size * .36 + 'px', '--h': hue}">{{ initials }}</span>`,
};
export const Segmented = {
    props: {modelValue: String, options: Array},
    emits: ['update:modelValue'],
    template: `<div class="seg" role="tablist"><button v-for="o in options" :key="o.v ?? o" role="tab" :aria-selected="(o.v ?? o) === modelValue" :class="{on: (o.v ?? o) === modelValue}" @click="$emit('update:modelValue', o.v ?? o)">{{ o.l ?? o }}</button><i class="seg__thumb" :style="{'--i': options.findIndex(o => (o.v ?? o) === modelValue), '--n': options.length}"></i></div>`,
};
export const Chips = {
    props: {modelValue: Array, options: Array},
    emits: ['update:modelValue'],
    setup(p, {emit}) { const tog = o => emit('update:modelValue', p.modelValue.includes(o) ? p.modelValue.filter(x => x !== o) : [...p.modelValue, o]); return {tog}; },
    template: `<div class="chips"><button v-for="o in options" :key="o" class="chip" :class="{on: modelValue.includes(o)}" @click="tog(o)">{{ o }}</button></div>`,
};
export const Toggle = {
    props: {modelValue: Boolean, label: String},
    emits: ['update:modelValue'],
    template: `<label class="tog"><span v-if="label">{{ label }}</span><button type="button" role="switch" :aria-checked="modelValue" :class="{on: modelValue}" @click="$emit('update:modelValue', !modelValue)"><i></i></button></label>`,
};
export const Field = {
    props: {modelValue: [String, Number], label: String, type: {type: String, default: 'text'}, placeholder: String, options: Array, rows: Number, icon: String, hint: String},
    emits: ['update:modelValue'],
    template: `<label class="field"><span v-if="label">{{ label }}</span><div class="field__box"><Ico v-if="icon" :n="icon" :s="16"/>
        <select v-if="options" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="o in options" :key="o">{{ o }}</option></select>
        <textarea v-else-if="rows" :rows="rows" :value="modelValue" :placeholder="placeholder" @input="$emit('update:modelValue', $event.target.value)"></textarea>
        <input v-else :type="type" :value="modelValue" :placeholder="placeholder" @input="$emit('update:modelValue', type === 'number' ? +$event.target.value : $event.target.value)"></div><small v-if="hint">{{ hint }}</small></label>`,
};
export const Slider = {
    props: {modelValue: Number, min: {type: Number, default: 0}, max: {type: Number, default: 100}, label: String, unit: {type: String, default: ''}},
    emits: ['update:modelValue'],
    template: `<label class="slider"><span>{{ label }}<b>{{ modelValue }}{{ unit }}</b></span><input type="range" :min="min" :max="max" :value="modelValue" :style="{'--p': (modelValue - min) / (max - min) * 100 + '%'}" @input="$emit('update:modelValue', +$event.target.value)"></label>`,
};
export const Stepper = {
    props: {modelValue: Number, min: {type: Number, default: 0}, max: {type: Number, default: 99}},
    emits: ['update:modelValue'],
    template: `<span class="step"><button type="button" @click="$emit('update:modelValue', Math.max(min, modelValue - 1))" aria-label="Less">−</button><b>{{ modelValue }}</b><button type="button" @click="$emit('update:modelValue', Math.min(max, modelValue + 1))" aria-label="More">+</button></span>`,
};
export const Progress = {
    props: {value: Number, kind: String},
    template: `<div class="prog" :class="kind"><i :style="{width: value + '%'}"></i></div>`,
};
export const Collapse = {   // expands and shrinks smoothly (grid-template-rows 0fr -> 1fr)
    props: {open: Boolean},
    template: `<div class="collapse" :class="{open}"><div class="collapse__in"><slot/></div></div>`,
};
export const Accordion = {
    props: {title: String, sub: String, icon: String, start: Boolean},
    setup(p) { const open = ref(p.start); return {open}; },
    template: `<div class="acc" :class="{open}"><button class="acc__h" @click="open = !open" :aria-expanded="open"><Ico v-if="icon" :n="icon" :s="18"/><span><b>{{ title }}</b><small v-if="sub">{{ sub }}</small></span><Ico n="down" :s="18" class="acc__c"/></button><Collapse :open="open"><div class="acc__b"><slot/></div></Collapse></div>`,
};
export const Spark = {
    props: {data: Array, color: String},
    setup(p) {
        const pts = computed(() => { const mx = Math.max(...p.data), mn = Math.min(...p.data), n = p.data.length - 1;
            return p.data.map((v, i) => (i / n * 100).toFixed(1) + ',' + (28 - (v - mn) / Math.max(1, mx - mn) * 24).toFixed(1)).join(' '); });
        return {pts};
    },
    template: `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline :points="pts" :style="{stroke: color}"/></svg>`,
};
export const Stat = {
    props: {label: String, value: String, delta: String, down: Boolean, data: Array, icon: String},
    template: `<Card class="stat"><div class="stat__t"><span class="stat__i"><Ico :n="icon || 'trend'" :s="16"/></span><small>{{ label }}</small></div><b>{{ value }}</b><div class="stat__f"><Badge :kind="down ? 'r' : 'g'">{{ delta }}</Badge><Spark v-if="data" :data="data"/></div></Card>`,
};
export const AreaChart = {
    props: {data: Array, labels: Array},
    setup(p) {
        const W = 600, H = 200, shown = ref(false);
        const pts = computed(() => { const mx = Math.max(...p.data) * 1.15, n = p.data.length - 1; return p.data.map((v, i) => [i / n * W, H - 10 - v / mx * (H - 30)]); });
        const line = computed(() => pts.value.map(([x, y], i, a) => {
            if (!i) return 'M' + x + ',' + y; const [px, py] = a[i - 1], cx = (px + x) / 2; return 'C' + cx + ',' + py + ' ' + cx + ',' + y + ' ' + x + ',' + y; }).join(' '));
        const area = computed(() => line.value + ' L' + W + ',' + H + ' L0,' + H + ' Z');
        const hover = ref(-1);
        onMounted(() => requestAnimationFrame(() => shown.value = true));
        watch(() => p.data, () => { shown.value = false; requestAnimationFrame(() => requestAnimationFrame(() => shown.value = true)); });
        function move(e) { const r = e.currentTarget.getBoundingClientRect(); hover.value = Math.max(0, Math.min(p.data.length - 1, Math.round((e.clientX - r.left) / r.width * (p.data.length - 1)))); }
        return {W, H, line, area, shown, pts, hover, move};
    },
    template: `<div class="chart" @pointermove="move" @pointerleave="hover = -1"><svg :viewBox="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" :class="{shown}"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent-c)" stop-opacity=".55"/><stop offset="1" stop-color="var(--accent-c)" stop-opacity="0"/></linearGradient></defs>
        <g class="grid"><line v-for="i in 4" :key="i" x1="0" :y1="i * 44" :x2="W" :y2="i * 44"/></g><path class="area" :d="area" fill="url(#ga)"/><path class="line" :d="line"/>
        <g v-if="hover > -1"><line class="cur" :x1="pts[hover][0]" y1="0" :x2="pts[hover][0]" :y2="H"/><circle :cx="pts[hover][0]" :cy="pts[hover][1]" r="5"/></g></svg>
        <div v-if="hover > -1" class="chart__tip" :style="{left: hover / (data.length - 1) * 100 + '%'}"><b>{{ data[hover].toLocaleString() }}</b><small>{{ labels[hover] }}</small></div>
        <div class="chart__x"><span v-for="(l, i) in labels" :key="i" v-show="i % Math.ceil(labels.length / 6) === 0">{{ l }}</span></div></div>`,
};
export const Donut = {
    props: {parts: Array},
    setup(p) { const grad = computed(() => { let a = 0; return p.parts.map(x => { const s = a; a += x.v; return x.c + ' ' + s + '% ' + a + '%'; }).join(','); }); return {grad}; },
    template: `<div class="donutw"><div class="donut" :style="{background: 'conic-gradient(' + grad + ')'}"><span><slot/></span></div><ul><li v-for="x in parts" :key="x.l"><i :style="{background: x.c}"></i>{{ x.l }}<b>{{ x.v }}%</b></li></ul></div>`,
};
export const Skeleton = {
    props: {n: {type: Number, default: 3}},
    template: `<div class="skel"><i v-for="i in n" :key="i" :style="{width: 40 + (i * 23) % 55 + '%'}"></i></div>`,
};
export const Empty = { props: {text: String}, template: `<div class="empty"><Ico n="search" :s="28"/><p>{{ text }}</p></div>` };

// bottom sheet on phones (drag the handle down to close), centered dialog on large screens
export const Sheet = {
    props: {open: Boolean, title: String, wide: Boolean},
    emits: ['close'],
    setup(p, {emit}) {
        const dy = ref(0), drag = ref(false); let y0 = 0;
        const down = e => { drag.value = true; y0 = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); };
        const move = e => { if (drag.value) dy.value = Math.max(0, e.clientY - y0); };
        const up = () => { drag.value = false; if (dy.value > 110) emit('close'); dy.value = 0; };
        const esc = e => e.key === 'Escape' && p.open && emit('close');
        onMounted(() => addEventListener('keydown', esc)); onBeforeUnmount(() => removeEventListener('keydown', esc));
        watch(() => p.open, o => document.documentElement.classList.toggle('v4-lock', o));
        return {dy, drag, down, move, up};
    },
    template: `<Teleport to=".v4"><Transition name="sheet"><div v-if="open" class="sheetw" @click.self="$emit('close')"><div class="sheet" :class="{wide, drag}" role="dialog" aria-modal="true" :style="{transform: dy ? 'translateY(' + dy + 'px)' : ''}">
        <div class="sheet__grab" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"><i></i></div>
        <header v-if="title" class="sheet__h"><h3>{{ title }}</h3><button class="icon-btn" @click="$emit('close')" aria-label="Close"><Ico n="x" :s="18"/></button></header>
        <div class="sheet__b"><slot/></div></div></div></Transition></Teleport>`,
};
export const Toasts = {
    setup: () => ({toasts}),
    template: `<div class="toasts" aria-live="polite"><TransitionGroup name="toast"><div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind"><Ico :n="t.kind === 'err' ? 'x' : 'check'" :s="16"/>{{ t.text }}</div></TransitionGroup></div>`,
};

// navigation dock: bottom bar on phones (the active item expands to show its label), sidebar that expands and shrinks on desktop
export const Dock = {
    props: {items: Array, modelValue: String, wide: Boolean, badges: Object},
    emits: ['update:modelValue', 'toggle'],
    template: `<nav class="dock" :class="{wide}" aria-label="Main"><button class="dock__logo" @click="$emit('toggle')" :aria-label="wide ? 'Shrink menu' : 'Expand menu'"><span>G</span><b>Glass Admin</b><Ico :n="wide ? 'chev' : 'menu'" :s="16" class="dock__t"/></button>
        <div class="dock__items"><button v-for="i in items" :key="i.id" class="dock__i" :class="{on: modelValue === i.id}" :aria-current="modelValue === i.id ? 'page' : null" :title="i.label" @click="$emit('update:modelValue', i.id)"><Ico :n="i.icon" :s="22"/><span>{{ i.label }}</span><em v-if="badges && badges[i.id]">{{ badges[i.id] }}</em></button></div></nav>`,
};

export function registerUi(app) {
    Object.entries({Ico, Holder, Card, Badge, Avatar, Segmented, Chips, Toggle, Field, Slider, Stepper, Progress, Collapse, Accordion, Spark, Stat, AreaChart, Donut, Skeleton, Empty, Sheet, Toasts, Dock})
        .forEach(([k, v]) => app.component(k, v));
}
