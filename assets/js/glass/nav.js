// Glass v5 components: glass tabs (active tab detaches as its own pill), icon pill (active item expands), notch bar (a bubble lifts out of the bar).
// They follow the navigation video; each takes a `tone` colour and tracks layout with rAF so the sliding shapes stay exact while labels expand.
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from '../vendor/vue.esm-browser.prod.js';
import { PATHS } from './ui.js';

Object.assign(PATHS, {
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', cart: 'M4 5h2l2 10h10l2-7H7M10 20h.01M17 20h.01', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
    prev: 'M18 6v12M16 12L7 6v12z', next: 'M6 6v12M8 12l9-6v12z', play: 'M8 5l11 7-11 7z', phoneFill: 'M6 4h4l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v4a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z',
    inbox: 'M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5', target: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', building: 'M5 20V5h9v15M14 10h5v10M8 9h3M8 13h3M8 17h3', doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
    pipe: 'M5 5h4v14H5zM10 5h4v9h-4zM15 5h4v5h-4z', clock: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 8v4l3 2', chartbar: 'M5 20V10M12 20V4M19 20v-7', grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
});

// run fn every frame for ms (layout that animates through CSS transitions is read each frame)
function track(fn, ms = 650) { const t0 = performance.now(); const step = () => { fn(); if (performance.now() - t0 < ms) requestAnimationFrame(step); }; requestAnimationFrame(step); }

export const GlassTabs = {
    props: {items: Array, modelValue: String, tone: String},
    emits: ['update:modelValue'],
    setup(p) {
        const root = ref(null), btns = ref([]), s = ref({l: [0, 0], a: [0, 0], r: [0, 0]});
        const idx = computed(() => p.items.findIndex(i => i.id === p.modelValue));
        const measure = () => {
            const b = btns.value; if (!b.length || idx.value < 0) return; const n = b.length - 1, a = idx.value;
            const span = (x, y) => [b[x].offsetLeft, b[y].offsetLeft + b[y].offsetWidth - b[x].offsetLeft];
            s.value = {a: span(a, a), l: a > 0 ? span(0, a - 1) : [0, 0], r: a < n ? span(a + 1, n) : [0, 0]};
        };
        let ro = null;
        onMounted(() => { measure(); addEventListener('resize', measure); document.fonts?.ready.then(measure); if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(root.value); btns.value.forEach(b => b && ro.observe(b)); } });
        onBeforeUnmount(() => { removeEventListener('resize', measure); ro?.disconnect(); });
        watch(() => p.modelValue, () => track(measure));
        watch(() => p.items, () => nextTick(measure), {deep: true});
        const st = k => ({left: s.value[k][0] + 'px', width: s.value[k][1] + 'px', opacity: s.value[k][1] ? 1 : 0});
        return {root, btns, st, idx};
    },
    template: `<div class="gtabs" ref="root" :style="tone ? {'--tone': tone} : null" role="tablist"><i class="gt gt-l" :style="st('l')"></i><i class="gt gt-r" :style="st('r')"></i><i class="gt gt-a" :style="st('a')"></i>
        <button v-for="(i, k) in items" :key="i.id" :ref="el => btns[k] = el" role="tab" :aria-selected="i.id === modelValue" :class="{on: i.id === modelValue}" @click="$emit('update:modelValue', i.id)">{{ i.label }}</button></div>`,
};

export const IconPill = {   // capsule of icons; the active one expands to icon + label on a sliding thumb. The slot holds a detached round button (cart)
    props: {items: Array, modelValue: String, tone: String},
    emits: ['update:modelValue'],
    setup(p) {
        const btns = ref([]), th = ref([0, 0]);
        const idx = computed(() => p.items.findIndex(i => i.id === p.modelValue));
        const measure = () => { const b = btns.value[idx.value]; if (b) th.value = [b.offsetLeft, b.offsetWidth]; };
        onMounted(() => { measure(); addEventListener('resize', measure); }); onBeforeUnmount(() => removeEventListener('resize', measure));
        watch(() => p.modelValue, () => track(measure));
        return {btns, th};
    },
    template: `<div class="ipillw" :style="tone ? {'--tone': tone} : null"><div class="ipill" role="tablist"><i class="ip-th" :style="{left: th[0] + 'px', width: th[1] + 'px'}"></i>
        <button v-for="(i, k) in items" :key="i.id" :ref="el => btns[k] = el" role="tab" :aria-label="i.label" :aria-selected="i.id === modelValue" :class="{on: i.id === modelValue}" @click="$emit('update:modelValue', i.id)"><Ico :n="i.icon" :s="19"/><span>{{ i.on || i.label }}</span></button></div><slot/></div>`,
};

export const NotchBar = {   // bottom bar: a bubble lifts out of the bar over the active icon and the bar's glass dips around it
    props: {items: Array, modelValue: String, badges: Object, tone: String},
    emits: ['update:modelValue'],
    setup(p) {
        const root = ref(null), W = ref(360), H = 62, R = 20, NW = 33, ND = 27, PAD = 20, x = ref(0);
        const n = computed(() => p.items.length), idx = computed(() => Math.max(0, p.items.findIndex(i => i.id === p.modelValue)));
        const cx = i => PAD + (i + .5) * (W.value - PAD * 2) / n.value;
        let raf = 0, first = true;
        function go(to) { cancelAnimationFrame(raf); const from = x.value, t0 = performance.now(), D = 460; if (first) { x.value = to; first = false; return; }
            const step = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); x.value = from + (to - from) * e; if (k < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { W.value = root.value.clientWidth; x.value = cx(idx.value); }) : null;
        onMounted(() => { W.value = root.value.clientWidth; ro && ro.observe(root.value); go(cx(idx.value)); }); onBeforeUnmount(() => { ro && ro.disconnect(); cancelAnimationFrame(raf); });
        watch(idx, i => go(cx(i)));
        const has = computed(() => p.items.some(i => i.id === p.modelValue));
        const d = computed(() => { const w = W.value, c = x.value;   // a page that is not in the bar gets a flat top, no empty dip
            const dip = !has.value ? '' : ' H' + (c - NW) + ' C' + (c - NW + 17) + ',0 ' + (c - 25) + ',' + ND + ' ' + c + ',' + ND + ' C' + (c + 25) + ',' + ND + ' ' + (c + NW - 17) + ',0 ' + (c + NW) + ',0';
            return 'M' + R + ',0' + dip + ' H' + (w - R)
            + ' A' + R + ',' + R + ' 0 0 1 ' + w + ',' + R + ' V' + (H - R) + ' A' + R + ',' + R + ' 0 0 1 ' + (w - R) + ',' + H + ' H' + R + ' A' + R + ',' + R + ' 0 0 1 0,' + (H - R) + ' V' + R + ' A' + R + ',' + R + ' 0 0 1 ' + R + ',0 Z'; });
        return {root, W, H, d, x, PAD, cur: computed(() => p.items[idx.value]), has};
    },
    template: `<nav class="notch" ref="root" :style="tone ? {'--tone': tone} : null" aria-label="Main"><div class="notch__glass" :style="{clipPath: 'path(\\'' + d + '\\')'}"></div>
        <svg class="notch__rim" :width="W" :height="H" aria-hidden="true"><path :d="d"/></svg>
        <div class="notch__items" :style="{padding: '0 ' + PAD + 'px'}"><button v-for="i in items" :key="i.id" :class="{on: i.id === modelValue}" :aria-label="i.label" :aria-current="i.id === modelValue ? 'page' : null" @click="$emit('update:modelValue', i.id)"><Ico :n="i.icon" :s="21"/><em v-if="badges && badges[i.id]">{{ badges[i.id] }}</em></button></div>
        <span class="notch__bubble" v-show="has" :style="{left: x + 'px'}"><Ico :n="cur.icon" :s="22"/></span><span class="notch__label" v-show="has" :style="{left: x + 'px'}">{{ cur.label }}</span></nav>`,
};
