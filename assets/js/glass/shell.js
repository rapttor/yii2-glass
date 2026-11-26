// The app shell: the sidebar with four states, the hover helper panel and the mega menu. All content comes from createGlassApp() (app.js),
// which provides it as inject('glass'): {nav, brand, user, card}.
//
// Sidebar states (mode):
//   pinned     expanded, pushes the page (a grid column)
//   collapsed  icon rail, the buttons magnify like the OS X dock
//   hover      icon rail in the layout; on hover it opens over the page with a darkened backdrop
//   mini       no sidebar; the brand button (top left) opens the full-screen mega menu
// In every state except mini, hovering an item darkens the page and shows a helper panel with that item's sub pages as cards.
import { ref, computed, watch, inject, onMounted, onBeforeUnmount, nextTick } from '../vendor/vue.esm-browser.prod.js';
import { PATHS } from './ui.js';
import { dockMagnify } from './dock-magnify.js';

Object.assign(PATHS, {
    layout: 'M4 5h16v14H4zM10 5v14', grid9: 'M5 5h4v4H5zM15 5h4v4h-4zM5 15h4v4H5zM15 15h4v4h-4z', pin: 'M9 4h6l-1 5 3 3H7l3-3zM12 12v8', pinOff: 'M9 4h6l-1 5 3 3H7l3-3zM12 12v8M4 4l16 16',
    pushL: 'M4 5h16v14H4zM9 5v14M13 12h4M15 10l2 2-2 2', rail: 'M4 5h16v14H4zM8 5v14', overlay: 'M4 5h16v14H4zM8 5v14M11 9h6M11 12h6M11 15h4', minim: 'M4 7h6M4 12h10M4 17h8M16 14l3 3 3-3', book: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12',
    sliders: 'M5 7h6M15 7h4M5 17h2M11 17h8M13 5v4M9 15v4', puzzle: 'M9 4h4v3a2 2 0 1 1 0 4v3H9v-2a2 2 0 1 0-3 0v2H3V9h3V7a2 2 0 1 1 3 0z', layers: 'M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4', table: 'M4 5h16v14H4zM4 10h16M10 5v14', msg: 'M5 5h14v10H10l-5 4z',
    fileText: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6', cursor: 'M6 4l12 7-5 2-2 5z', info: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 11v5M12 8h.01', bolt: 'M13 3L5 13h6l-1 8 8-10h-6z', zap: 'M13 3L5 13h6l-1 8 8-10h-6z',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
});

export const flatten = nav => nav.flatMap(s => s.items.map(i => ({...i, section: s.label})));

export const MODES = [
    {v: 'pinned', label: 'Expanded', desc: 'Pushes the page', icon: 'pushL'}, {v: 'collapsed', label: 'Collapsed', desc: 'Icons only', icon: 'rail'},
    {v: 'hover', label: 'Expand on hover', desc: 'Opens over the page', icon: 'overlay'}, {v: 'mini', label: 'Minimise', desc: 'Brand button and mega menu', icon: 'minim'},
];

export const GlassSidebar = {
    props: {mode: String, current: String, badges: Object, pinCard: Boolean},
    emits: ['go', 'mode', 'pin', 'item', 'leave', 'hover'],
    setup(p, {emit}) {
        const g = inject('glass');
        const root = ref(null), hovering = ref(false), menu = ref(false); let t = 0, dm = null;
        const rail = computed(() => p.mode === 'collapsed' || (p.mode === 'hover' && !hovering.value));
        const enter = () => { clearTimeout(t); hovering.value = true; emit('hover', true); };
        const leave = () => { clearTimeout(t); t = setTimeout(() => { hovering.value = false; menu.value = false; emit('hover', false); }, 160); emit('leave'); };
        const attach = () => { dm?.destroy(); dm = root.value ? dockMagnify(root.value, '.side6__logo, .nav6 button', {enabled: () => rail.value && p.mode === 'collapsed' || (p.mode === 'hover' && rail.value), max: 1.5, sigma: 44, active: '.on'}) : null; };
        onMounted(() => nextTick(attach)); onBeforeUnmount(() => { dm?.destroy(); clearTimeout(t); });
        watch(() => p.mode, () => { hovering.value = false; menu.value = false; nextTick(() => dm?.refresh()); });
        const logo = () => { if (p.mode === 'collapsed' || p.mode === 'hover') emit('mode', 'pinned'); };
        const item = (it, e) => emit('item', it, e.currentTarget.closest('.side6').getBoundingClientRect().right);
        const pick = m => { menu.value = false; emit('mode', m); };
        return {g, root, hovering, menu, rail, enter, leave, logo, item, pick, MODES};
    },
    template: `<div class="side6w" :class="'m-' + mode" @pointerenter="enter" @pointerleave="leave">
        <aside class="side6" :class="{rail, over: mode === 'hover' && hovering}" ref="root" aria-label="Main navigation">
            <div class="side6__head"><button class="side6__logo logo5" @click="logo" :aria-label="rail ? 'Expand sidebar' : g.brand.name">{{ g.brand.logo }}</button><b class="side6__brand">{{ g.brand.name }}</b><small v-if="g.brand.tag" class="side6__pro">{{ g.brand.tag }}</small>
                <button class="s6btn" @click="menu = !menu" :aria-expanded="menu" aria-label="Sidebar layout"><Ico n="layout" :s="17"/></button>
                <Transition name="fade"><div v-if="menu" class="s6menu" role="menu"><button v-for="m in MODES" :key="m.v" role="menuitemradio" :aria-checked="mode === m.v" :class="{on: mode === m.v}" @click="pick(m.v)"><Ico :n="m.icon" :s="18"/><span><b>{{ m.label }}</b><small>{{ m.desc }}</small></span></button></div></Transition></div>
            <nav class="side6__scroll nav6">
                <template v-for="s in g.nav" :key="s.id"><h6>{{ s.label }}</h6>
                    <button v-for="i in s.items" :key="i.id" :class="{on: current === i.id}" :aria-label="i.label" :aria-current="current === i.id ? 'page' : null" @click="$emit('go', i.id)" @pointerenter="item(i, $event)" @focus="item(i, $event)"><Ico :n="i.icon" :s="19"/><span>{{ i.label }}</span><em v-if="badges && badges[i.id]">{{ badges[i.id] }}</em></button></template>
                <div v-if="g.card && !pinCard" class="quota"><div><small>{{ g.card.title }}</small><b>{{ g.card.value }}</b></div><div class="prog"><i :style="{width: g.card.percent + '%'}"></i></div><small>{{ g.card.note }}</small><button class="pinbtn" @click="$emit('pin', true)" aria-label="Pin this card to the bottom"><Ico n="pin" :s="14"/></button></div>
            </nav>
            <div v-if="g.user || (g.card && pinCard)" class="side6__foot"><div v-if="g.card && pinCard" class="quota fixed"><div><small>{{ g.card.title }}</small><b>{{ g.card.value }}</b></div><div class="prog"><i :style="{width: g.card.percent + '%'}"></i></div><small>{{ g.card.note }}</small><button class="pinbtn on" @click="$emit('pin', false)" aria-label="Unpin this card"><Ico n="pinOff" :s="14"/></button></div>
                <div v-if="g.user" class="me5"><Avatar :name="g.user.name" :size="36"/><div><b>{{ g.user.name }}</b><small>{{ g.user.role }}</small></div></div></div>
        </aside></div>`,
};

export const GlassHelper = {
    props: {item: Object, left: Number},
    emits: ['go', 'keep', 'leave'],
    template: `<Transition name="hp"><section v-if="item" class="hp" :style="{left: left + 'px'}" aria-label="Menu helper" @pointerenter="$emit('keep')" @pointerleave="$emit('leave')">
        <header class="hp__h"><span class="hp__ic"><Ico :n="item.icon" :s="24"/></span><div><small>{{ item.section }}</small><h2>{{ item.label }}</h2><p v-if="item.help">{{ item.help }}</p></div><button class="btn primary" @click="$emit('go', item.id)">Open {{ item.label }}<Ico n="chev" :s="16"/></button></header>
        <div v-if="item.tips && item.tips.length" class="hp__tips"><Ico n="info" :s="15"/><span v-for="t in item.tips" :key="t">{{ t }}</span></div>
        <div v-if="item.sub && item.sub.length" class="hp__grid"><div v-for="s in item.sub" :key="s.k" class="hp__card" role="link" tabindex="0" @click="$emit('go', item.id, s.k)" @keydown.enter="$emit('go', item.id, s.k)">
            <span class="hp__cic"><Ico :n="s.icon || 'chev'" :s="19"/></span><b>{{ s.title }}</b><small>{{ s.desc }}</small><span v-if="s.links" class="hp__links"><a v-for="l in s.links" :key="l.label" :href="l.href" @click.stop>{{ l.label }}</a></span></div></div>
        <p v-else class="hp__none">This page has no sub pages.</p></section></Transition>`,
};

export const GlassMega = {
    props: {open: Boolean, current: String},
    emits: ['close', 'go'],
    setup(p, {emit}) {
        const g = inject('glass'), q = ref(''), input = ref(null);
        const sections = computed(() => { const t = q.value.trim().toLowerCase(); if (!t) return g.nav;
            return g.nav.map(s => ({...s, items: s.items.filter(i => (i.label + (i.help || '') + (i.sub || []).map(x => x.title + (x.desc || '')).join(' ')).toLowerCase().includes(t))})).filter(s => s.items.length); });
        watch(() => p.open, o => { if (o) { q.value = ''; nextTick(() => input.value?.focus()); } document.documentElement.classList.toggle('v4-lock', o); });
        const esc = e => { if (e.key === 'Escape' && p.open) emit('close'); };
        onMounted(() => addEventListener('keydown', esc)); onBeforeUnmount(() => removeEventListener('keydown', esc));
        return {g, q, input, sections};
    },
    template: `<Teleport to=".v4"><Transition name="mega"><div v-if="open" class="mega" role="dialog" aria-modal="true" aria-label="Menu" @click.self="$emit('close')"><div class="mega__panel">
        <header class="mega__bar"><span class="logo5">{{ g.brand.logo }}</span><b>{{ g.brand.name }}</b><label class="mega__search"><Ico n="search" :s="17"/><input ref="input" v-model="q" placeholder="Search the menu" aria-label="Search the menu"></label><button class="icon-btn" @click="$emit('close')" aria-label="Close menu"><Ico n="x" :s="20"/></button></header>
        <div class="mega__body"><section v-for="s in sections" :key="s.id" class="mega__sec"><h3>{{ s.label }}</h3><div class="mega__grid">
            <article v-for="i in s.items" :key="i.id" class="mega__card" :class="{on: current === i.id}"><button class="mega__main" @click="$emit('go', i.id)"><span class="hp__ic"><Ico :n="i.icon" :s="22"/></span><span><b>{{ i.label }}</b><small>{{ i.help }}</small></span></button>
                <ul v-if="i.sub && i.sub.length"><li v-for="x in i.sub" :key="x.k"><button @click="$emit('go', i.id, x.k)"><Ico :n="x.icon || 'chev'" :s="15"/><span>{{ x.title }}<small>{{ x.desc }}</small></span></button></li></ul></article></div></section>
            <p v-if="!sections.length" class="hp__none">Nothing matches “{{ q }}”.</p></div></div></div></Transition></Teleport>`,
};
