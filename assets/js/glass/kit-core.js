// Glass kit v6: core. Carousel, ButtonGroup, Toolbar, KCard, PricingCard, ListGroup, Navbar, CloseButton, Placeholder, Ratio, Divider, Kbd, CodeBlock, Offcanvas.
// Styled by scss/kit/_core.scss, which also holds the utility and layout CSS (containers, grid, flex, spacing, ...). Showcases: DemoFoundations, DemoLayout, DemoComponents.
// Offcanvas and the showcases use global components of other files (Drawer, Modal, ...) by tag name; nothing is imported from them.
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance, h, Fragment, Comment, Text } from '../vendor/vue.esm-browser.prod.js';
import { PATHS, toast } from './ui.js';

const ADD = {chevl: 'M15 6l-6 6 6 6', copy: 'M8 8h11v12H8zM5 16V4h11', pause: 'M9 6v12M15 6v12', play: 'M8 5l11 7-11 7z', edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4'};
Object.keys(ADD).forEach(k => { PATHS[k] ??= ADD[k]; });

// ---------- helpers ----------
export const BREAKPOINTS = {xs: 0, sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400};   // the same numbers as in _core.scss
export const breakpointOf = w => Object.keys(BREAKPOINTS).reduce((a, k) => w >= BREAKPOINTS[k] ? k : a, 'xs');
export function useBreakpoint() {   // -> {width, bp} of the viewport, live. Call inside setup().
    const width = ref(typeof innerWidth === 'number' ? innerWidth : 0), bp = computed(() => breakpointOf(width.value));
    const on = () => { width.value = innerWidth; };
    onMounted(() => { on(); addEventListener('resize', on); }); onBeforeUnmount(() => removeEventListener('resize', on));
    return {width, bp};
}
let _uid = 0;
const uid = p => p + (++_uid);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mm = q => typeof matchMedia === 'function' && matchMedia(q).matches;
function useWidth(el, initial) {   // width of an element, kept current with ResizeObserver
    const w = ref(initial); let ro = null;
    const read = () => { if (el.value && el.value.offsetWidth) w.value = el.value.offsetWidth; };
    onMounted(() => { read(); if (typeof ResizeObserver !== 'undefined' && el.value) { ro = new ResizeObserver(read); ro.observe(el.value); } });
    onBeforeUnmount(() => ro && ro.disconnect());
    return w;
}

// ---------- Carousel ----------
// Slides: `items` [{id?, title, text, image, alt, bg, href}] (custom markup with the #slide="{item, index, active}" slot), or child elements in the default / #slides slot.
// perView: a number, or {minWidth: n} / {md: 2, lg: 3} matched against the width of the carousel itself. Fade always shows one slide. Loop rewinds to the other end.
const flatten = nodes => (nodes || []).flatMap(n => n.type === Fragment ? flatten(n.children) : n.type === Comment || (n.type === Text && !String(n.children).trim()) ? [] : [n]);
export const Carousel = {
    name: 'Carousel',
    props: {items: Array, modelValue: {type: Number, default: 0}, perView: {type: [Number, Object], default: 1}, gap: {type: Number, default: 12}, arrows: {type: Boolean, default: true}, dots: {type: Boolean, default: true},
        thumbnails: Boolean, autoplay: {type: Number, default: 0}, transition: {type: String, default: 'slide'}, loop: {type: Boolean, default: true}, label: {type: String, default: 'Carousel'}},
    emits: ['update:modelValue', 'change'],
    setup(p, {emit, slots, expose}) {
        const root = ref(null), vp = ref(null), idx = ref(p.modelValue), dx = ref(0), drag = ref(false), hover = ref(false), focus = ref(false), stopped = ref(false), hidden = ref(false);
        const width = useWidth(root, 360), count = ref(p.items ? p.items.length : 0), still = mm('(prefers-reduced-motion: reduce)');
        const per = computed(() => {
            if (p.transition === 'fade') return 1;
            if (typeof p.perView === 'number') return Math.max(1, p.perView);
            return Object.entries(p.perView).map(([k, v]) => [BREAKPOINTS[k] ?? +k, v]).sort((a, b) => a[0] - b[0]).reduce((a, [min, v]) => width.value >= min ? v : a, 1);
        });
        const max = computed(() => Math.max(0, count.value - per.value)), cur = computed(() => clamp(idx.value, 0, max.value));
        const playing = computed(() => p.autoplay > 0 && !still && !stopped.value && !hover.value && !focus.value && !drag.value && !hidden.value && max.value > 0 && (p.loop || cur.value < max.value));
        const go = i => {
            const c = cur.value, n = i > max.value ? (p.loop && c >= max.value ? 0 : max.value) : i < 0 ? (p.loop && c <= 0 ? max.value : 0) : i;
            if (n === c) return; idx.value = n; emit('update:modelValue', n); emit('change', n);
        };
        const next = () => go(cur.value + 1), prev = () => go(cur.value - 1);
        let timer = 0;
        watch([playing, cur, () => p.autoplay], () => { clearTimeout(timer); if (playing.value) timer = setTimeout(next, p.autoplay); });
        watch(() => p.modelValue, v => { idx.value = v; });
        const onVis = () => { hidden.value = document.hidden; };
        onMounted(() => { document.addEventListener('visibilitychange', onVis); if (playing.value) timer = setTimeout(next, p.autoplay); });
        onBeforeUnmount(() => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); });

        // swipe: capture starts only after a clear horizontal move, so taps and vertical scrolling keep working
        let st = null, moved = false;
        const down = e => { moved = false; if (e.button > 0 || max.value === 0 || e.target.closest('input,textarea,select,[data-no-swipe]')) return; st = {x: e.clientX, y: e.clientY, t: e.timeStamp}; };
        const move = e => {
            if (!st) return; const mx = e.clientX - st.x, my = e.clientY - st.y;
            if (!drag.value) {
                if (e.pointerType === 'mouse' && !(e.buttons & 1)) { st = null; return; }
                if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { drag.value = moved = true; e.currentTarget.setPointerCapture?.(e.pointerId); } else { if (Math.abs(my) > 8) st = null; return; }
            }
            dx.value = !p.loop && ((cur.value === 0 && mx > 0) || (cur.value === max.value && mx < 0)) ? mx * .3 : mx;
        };
        const up = e => {
            if (st && drag.value) {
                const step = (vp.value.offsetWidth + p.gap) / per.value, d = dx.value;
                let n = Math.round(-d / step);
                if (!n && (Math.abs(d) > 48 || (Math.abs(d) > 16 && Math.abs(d) / Math.max(1, e.timeStamp - st.t) > .4))) n = d < 0 ? 1 : -1;
                if (n) go(cur.value + n);
            }
            cancel();
        };
        // the click of a mouse drag fires before the timeout, so only that one is swallowed (see below)
        const cancel = () => { st = null; drag.value = false; dx.value = 0; if (moved) setTimeout(() => { moved = false; }); };
        const swallow = e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };   // a drag must not click the link under the pointer
        const key = e => {
            if (e.target.closest('input,textarea,select,[contenteditable=true]')) return;
            const to = {ArrowLeft: cur.value - 1, ArrowRight: cur.value + 1, Home: 0, End: max.value}[e.key];
            if (to === undefined) return; e.preventDefault(); go(to);
        };
        const toggle = () => { stopped.value = !stopped.value; if (!stopped.value) hover.value = focus.value = false; };   // pressing play wins over hover and focus
        expose({next, prev, go});

        const card = it => h(it.href ? 'a' : 'div', {class: 'k-car__card', href: it.href, style: it.bg ? {background: it.bg} : null}, [
            it.image ? h('img', {src: it.image, alt: it.alt || '', draggable: false}) : null,
            it.title || it.text ? h('div', {class: 'k-car__cap'}, [it.title ? h('b', it.title) : null, it.text ? h('small', it.text) : null]) : null]);
        const icon = n => h('svg', {class: 'ico', width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true'}, [h('path', {d: PATHS[n]})]);
        const btn = (cls, label, onClick, kids, more) => h('button', {type: 'button', class: cls, 'aria-label': label, onClick, ...more}, kids);

        return () => {
            const nodes = p.items
                ? p.items.map((item, i) => slots.slide ? slots.slide({item, index: i, active: i >= cur.value && i < cur.value + per.value}) : card(item))
                : flatten((slots.slides || slots.default)?.());
            const n = nodes.length; if (count.value !== n) count.value = n;
            const at = clamp(idx.value, 0, Math.max(0, n - per.value)), last = Math.max(0, n - per.value), fade = p.transition === 'fade';
            const shown = i => i >= at && i < at + per.value;
            const title = i => p.items?.[i]?.title;
            return h('div', {ref: root, class: ['k-car', 'k-car--' + (fade ? 'fade' : 'slide'), {drag: drag.value}], role: 'region', 'aria-roledescription': 'carousel', 'aria-label': p.label, tabindex: 0,
                style: {'--per': per.value, '--gap': p.gap + 'px'}, onKeydown: key,
                onFocusin: () => { focus.value = true; }, onFocusout: e => { if (!root.value.contains(e.relatedTarget)) focus.value = false; },
                onPointerenter: e => { if (e.pointerType === 'mouse') hover.value = true; }, onPointerleave: () => { hover.value = false; }}, [
                h('div', {class: 'k-car__stage'}, [
                    h('div', {ref: vp, class: 'k-car__vp', onPointerdown: down, onPointermove: move, onPointerup: up, onPointercancel: cancel, onClickCapture: swallow, onDragstart: e => e.preventDefault()}, [
                        h('div', {class: 'k-car__track', style: fade ? null : {transform: `translate3d(calc((100% + ${p.gap}px) * ${-at / per.value} + ${dx.value}px), 0, 0)`}},
                            nodes.map((node, i) => h('div', {key: p.items?.[i]?.id ?? i, class: ['k-car__slide', {on: shown(i)}], role: 'group', 'aria-roledescription': 'slide', 'aria-label': (i + 1) + ' of ' + n, 'aria-hidden': shown(i) ? null : 'true', inert: !shown(i)}, [node])))]),
                    p.arrows && last ? [btn('k-car__arrow prev', 'Previous slide', prev, [icon('chevl')], {disabled: !p.loop && at === 0}), btn('k-car__arrow next', 'Next slide', next, [icon('chev')], {disabled: !p.loop && at === last})] : null]),
                last && (p.dots || p.autoplay) ? h('div', {class: 'k-car__ctrl'}, [
                    p.autoplay && !still ? btn('k-car__play', stopped.value ? 'Start automatic slides' : 'Stop automatic slides', toggle, [icon(stopped.value ? 'play' : 'pause')]) : null,
                    p.dots && !p.thumbnails ? h('div', {class: 'k-car__dots'}, Array.from({length: last + 1}, (_, i) => btn(['k-car__dot', {on: i === at}], 'Go to slide ' + (i + 1), () => go(i), [h('i')], {'aria-current': i === at ? 'true' : null}))) : null]) : null,
                p.thumbnails && n > 1 ? h('div', {class: 'k-car__thumbs'}, Array.from({length: n}, (_, i) => {
                    const it = p.items?.[i] || {};
                    return btn(['k-car__thumb', {on: shown(i)}], 'Show slide ' + (i + 1) + (title(i) ? ': ' + title(i) : ''), () => go(i),
                        [it.thumb || it.image ? h('img', {src: it.thumb || it.image, alt: '', draggable: false}) : it.bg ? h('i', {style: {background: it.bg}}) : h('span', String(i + 1))], {key: i, 'aria-current': shown(i) ? 'true' : null});
                })) : null,
                h('span', {class: 'k-visually-hidden', 'aria-live': playing.value ? 'off' : 'polite', 'aria-atomic': 'true'},
                    n ? (per.value > 1 ? `Slides ${at + 1} to ${Math.min(n, at + per.value)} of ${n}` : `Slide ${at + 1} of ${n}${title(at) ? ': ' + title(at) : ''}`) : '')]);
        };
    },
};

// ---------- ButtonGroup and Toolbar ----------
// items: [{id, label, icon, iconOnly, disabled}]. With v-model it is a toggle group (`multiple` makes the value an array); without v-model the buttons are plain actions.
export const ButtonGroup = {
    name: 'ButtonGroup',
    props: {items: Array, modelValue: {type: [String, Number, Array], default: undefined}, multiple: Boolean, vertical: Boolean, size: String, label: String},
    emits: ['update:modelValue', 'pick'],
    setup(p, {emit}) {
        const toggles = computed(() => p.modelValue !== undefined);
        const on = it => toggles.value && (p.multiple ? (p.modelValue || []).includes(it.id) : p.modelValue === it.id);
        const pick = it => {
            if (toggles.value) { const v = p.modelValue || []; emit('update:modelValue', p.multiple ? (on(it) ? v.filter(x => x !== it.id) : [...v, it.id]) : it.id); }
            emit('pick', it);
        };
        return {toggles, on, pick};
    },
    template: `<div class="k-btng" :class="[size && 'k-btng--' + size, {'k-btng--v': vertical}]" role="group" :aria-label="label">
        <button v-for="it in items" :key="it.id" type="button" class="btn" :class="{primary: on(it)}" :disabled="it.disabled" :aria-pressed="toggles ? on(it) : null" :aria-label="it.iconOnly ? it.label : null" :title="it.iconOnly ? it.label : null" @click="pick(it)">
            <Ico v-if="it.icon" :n="it.icon" :s="16"/><span v-if="it.label && !it.iconOnly">{{ it.label }}</span></button><slot/></div>`,
};
export const Toolbar = {   // one tab stop; arrow keys, Home and End move between the buttons and links inside
    name: 'Toolbar',
    props: {label: {type: String, default: 'Toolbar'}, vertical: Boolean},
    setup(p) {
        const el = ref(null); let last = null;
        const list = () => el.value ? [...el.value.querySelectorAll('button:not(:disabled), a[href]')] : [];
        const sync = cur => { const l = list(); last = l.includes(cur) ? cur : l.includes(last) ? last : l[0]; l.forEach(b => { b.tabIndex = b === last ? 0 : -1; }); };
        const key = e => {
            const l = list(), i = l.indexOf(e.target); if (i < 0) return;
            const to = {[p.vertical ? 'ArrowUp' : 'ArrowLeft']: i - 1, [p.vertical ? 'ArrowDown' : 'ArrowRight']: i + 1, Home: 0, End: l.length - 1}[e.key];
            if (to === undefined) return; e.preventDefault(); const b = l[(to + l.length) % l.length]; sync(b); b.focus();
        };
        onMounted(() => nextTick(() => sync()));
        return {el, key, sync, resync: () => sync()};
    },
    updated() { this.resync(); },
    template: `<div ref="el" class="k-toolbar" :class="{'k-toolbar--v': vertical}" role="toolbar" :aria-label="label" :aria-orientation="vertical ? 'vertical' : 'horizontal'" @keydown="key" @focusin="sync($event.target)"><slot/></div>`,
};

// ---------- Cards (the stat card is `Stat` from js/glass/ui.js) ----------
export const KCard = {   // slots: media, header, default, footer. With href or `tap` do not put other controls inside.
    name: 'KCard',
    props: {title: String, subtitle: String, image: String, imageAlt: String, media: String, horizontal: Boolean, ruled: Boolean, tap: Boolean, href: String, tag: {type: String, default: 'article'}},
    template: `<component :is="href ? 'a' : tag" class="k-card" :class="{'k-card--h': horizontal, 'k-card--ruled': ruled, 'k-card--tap': tap || href}" :href="href">
        <div v-if="image || media || $slots.media" class="k-card__m" :style="media ? {background: media} : null"><slot name="media"><img v-if="image" :src="image" :alt="imageAlt || ''" loading="lazy"></slot></div>
        <div class="k-card__c"><header v-if="title || $slots.header" class="k-card__h"><slot name="header"><h4>{{ title }}</h4><small v-if="subtitle">{{ subtitle }}</small></slot></header>
            <div v-if="$slots.default" class="k-card__b"><slot/></div><footer v-if="$slots.footer" class="k-card__f"><slot name="footer"/></footer></div></component>`,
};
export const PricingCard = {   // features: ['text', {text, off: true}]
    name: 'PricingCard',
    props: {name: String, price: [String, Number], currency: String, period: String, text: String, features: {type: Array, default: () => []}, cta: {type: String, default: 'Choose plan'}, featured: Boolean, badge: String, disabled: Boolean},
    emits: ['select'],
    setup: p => ({list: computed(() => p.features.map(f => typeof f === 'string' ? {text: f} : f))}),
    template: `<article class="k-price" :class="{'k-price--featured': featured}"><header class="k-price__h"><h4>{{ name }}</h4><Badge v-if="badge" kind="b">{{ badge }}</Badge></header>
        <div class="k-price__v"><b>{{ currency }}{{ price }}</b><small v-if="period">{{ period }}</small></div><p v-if="text">{{ text }}</p>
        <ul><li v-for="f in list" :key="f.text" :class="{off: f.off}"><Ico :n="f.off ? 'x' : 'check'" :s="16"/><span>{{ f.text }}<span v-if="f.off" class="k-visually-hidden"> (not included)</span></span></li></ul>
        <slot name="cta"><button type="button" class="btn" :class="{primary: featured}" :disabled="disabled" @click="$emit('select', name)">{{ cta }}</button></slot></article>`,
};

// ---------- ListGroup ----------
// items: [{id, title, text, icon, meta, badge, badgeKind ('g'|'y'|'r'|'b'|'n'), href, disabled, actions: [{id, icon, label}]}]
export const ListGroup = {
    name: 'ListGroup',
    props: {items: {type: Array, default: () => []}, modelValue: {type: [String, Number], default: null}, actionable: Boolean, flush: Boolean, numbered: Boolean, label: String},
    emits: ['update:modelValue', 'select', 'action'],
    setup(p, {emit}) {
        const tagOf = it => it.href && !it.disabled ? 'a' : p.actionable ? 'button' : 'div';
        const pick = (it, e) => { if (it.disabled || tagOf(it) === 'div') return; if (it.href === '#') e.preventDefault(); emit('update:modelValue', it.id); emit('select', it); };
        return {tagOf, pick};
    },
    template: `<component :is="numbered ? 'ol' : 'ul'" class="k-listg" :class="{'k-listg--flush': flush, 'k-listg--numbered': numbered}" :aria-label="label">
        <li v-for="it in items" :key="it.id" class="k-listg__i" :class="{on: it.id === modelValue, off: it.disabled}">
            <component :is="tagOf(it)" class="k-listg__m" :type="tagOf(it) === 'button' ? 'button' : null" :href="tagOf(it) === 'a' ? it.href : null" :disabled="tagOf(it) === 'button' && it.disabled ? true : null" :aria-current="it.id === modelValue ? 'true' : null" @click="pick(it, $event)">
                <slot name="item" :item="it" :active="it.id === modelValue"><Ico v-if="it.icon" :n="it.icon" :s="18"/><span class="k-listg__t"><b>{{ it.title }}</b><small v-if="it.text">{{ it.text }}</small></span>
                    <span v-if="it.meta" class="k-listg__meta">{{ it.meta }}</span><Badge v-if="it.badge != null" :kind="it.badgeKind || 'n'">{{ it.badge }}</Badge></slot></component>
            <span v-if="it.actions" class="k-listg__a"><button v-for="a in it.actions" :key="a.id" type="button" class="icon-btn" :disabled="it.disabled" :aria-label="a.label + ': ' + it.title" :title="a.label" @click="$emit('action', {item: it, action: a})"><Ico :n="a.icon" :s="17"/></button></span></li></component>`,
};

// ---------- Navbar: collapses behind a hamburger when the navbar itself is narrower than collapseAt ----------
// links: [{id, label, href, icon, badge, disabled}]; slots: brand, actions (always visible), default (extra content under the links)
export const Navbar = {
    name: 'Navbar',
    props: {brand: String, brandHref: {type: String, default: '#'}, links: {type: Array, default: () => []}, modelValue: String, collapseAt: {type: Number, default: 768}, sticky: Boolean, label: {type: String, default: 'Main'}},
    emits: ['update:modelValue', 'navigate', 'brand'],
    setup(p, {emit}) {
        const el = ref(null), tog = ref(null), open = ref(false), id = uid('k-nav'), w = useWidth(el, typeof innerWidth === 'number' ? innerWidth : 1024);
        const narrow = computed(() => w.value < p.collapseAt);
        watch(narrow, () => { open.value = false; });
        const go = (l, e) => { if (!l.href || l.href === '#') e.preventDefault(); open.value = false; emit('update:modelValue', l.id); emit('navigate', l); };
        const brandClick = e => { if (p.brandHref === '#') e.preventDefault(); emit('brand'); };
        const esc = () => { if (!open.value) return; open.value = false; tog.value?.focus(); };
        return {el, tog, open, id, narrow, go, brandClick, esc};
    },
    template: `<nav ref="el" class="k-navbar" :class="{'k-navbar--narrow': narrow, 'k-navbar--sticky': sticky}" :aria-label="label" @keydown.esc="esc">
        <a class="k-navbar__brand" :href="brandHref" @click="brandClick"><slot name="brand"><span class="k-navbar__logo" aria-hidden="true">{{ (brand || '?').slice(0, 1) }}</span><b>{{ brand }}</b></slot></a>
        <Collapse class="k-navbar__c" :open="!narrow || open"><div :id="id" :inert="narrow && !open"><ul class="k-navbar__links">
            <li v-for="l in links" :key="l.id"><component :is="l.href && !l.disabled ? 'a' : 'button'" class="k-navbar__link" :class="{on: l.id === modelValue}" :href="l.disabled ? null : l.href" :type="l.href && !l.disabled ? null : 'button'" :disabled="l.disabled ? true : null" :aria-current="l.id === modelValue ? 'page' : null" @click="l.disabled || go(l, $event)">
                <Ico v-if="l.icon" :n="l.icon" :s="16"/><span>{{ l.label }}</span><Badge v-if="l.badge != null">{{ l.badge }}</Badge></component></li></ul><slot/></div></Collapse>
        <div class="k-navbar__actions"><slot name="actions"/></div>
        <button v-if="narrow" ref="tog" type="button" class="icon-btn k-navbar__tog" :aria-expanded="open" :aria-controls="id" :aria-label="open ? 'Close menu' : 'Open menu'" @click="open = !open"><Ico :n="open ? 'x' : 'menu'" :s="20"/></button></nav>`,
};

// ---------- small parts ----------
export const CloseButton = {   // the click listener falls through to the button
    name: 'CloseButton',
    props: {label: {type: String, default: 'Close'}, size: {type: Number, default: 18}, solid: Boolean},
    template: `<button type="button" class="k-close" :class="{'k-close--solid': solid}" :aria-label="label"><Ico n="x" :s="size"/></button>`,
};
export const Placeholder = {   // variant: text | block | circle | media | card; animation: shimmer | pulse | none. Single bars: class="k-ph"
    name: 'Placeholder',
    props: {variant: {type: String, default: 'text'}, lines: {type: Number, default: 3}, width: String, height: String, animation: {type: String, default: 'shimmer'}, label: {type: String, default: 'Loading'}},
    setup: p => ({cls: computed(() => ({'k-ph--pulse': p.animation === 'pulse', 'k-ph--still': p.animation === 'none'}))}),
    template: `<div class="k-phw" :style="width ? {width} : null" role="status" :aria-label="label" aria-busy="true">
        <i v-if="variant === 'block' || variant === 'card'" class="k-ph k-ph--block" :class="cls" :style="height ? {height} : null"></i>
        <i v-if="variant === 'circle'" class="k-ph k-ph--circle" :class="cls" :style="height ? {height, width: height} : null"></i>
        <div v-if="variant === 'media'" class="k-phw__row"><i class="k-ph k-ph--circle" :class="cls"></i><div><i class="k-ph" :class="cls" style="width:55%"></i><i class="k-ph" :class="cls" style="width:80%"></i></div></div>
        <template v-if="variant === 'text' || variant === 'card'"><i v-for="i in lines" :key="i" class="k-ph" :class="cls" :style="{width: i === lines && lines > 1 ? '60%' : (100 - (i * 13) % 18) + '%', height: variant === 'text' ? height : null}"></i></template></div>`,
};
export const Ratio = {
    name: 'Ratio',
    props: {ratio: {type: [String, Number], default: '16 / 9'}},
    template: `<div class="k-ratio" :style="{aspectRatio: String(ratio).replace(':', ' / ')}"><slot/></div>`,
};
export const Divider = {
    name: 'Divider',
    props: {label: String, vertical: Boolean, align: {type: String, default: 'center'}, dashed: Boolean},
    template: `<div class="k-divider" :class="['k-divider--' + align, {'k-divider--v': vertical, 'k-divider--dashed': dashed, 'k-divider--bare': !label && !$slots.default}]" role="separator" :aria-orientation="vertical ? 'vertical' : 'horizontal'" :aria-label="label"><span v-if="label || $slots.default"><slot>{{ label }}</slot></span></div>`,
};
export const Kbd = {   // <Kbd keys="Ctrl+K"/>, :keys="['Shift', 'Enter']" or <Kbd>Esc</Kbd>
    name: 'Kbd',
    props: {keys: [String, Array]},
    setup: p => ({list: computed(() => Array.isArray(p.keys) ? p.keys : p.keys ? p.keys.split(/\+(?!$)/) : [])}),
    template: `<span class="k-keys"><template v-for="(k, i) in list" :key="i"><span v-if="i">+</span><kbd class="k-key">{{ k }}</kbd></template><kbd v-if="!list.length" class="k-key"><slot/></kbd></span>`,
};

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* no permission or plain http: fall back */ }
    const prev = document.activeElement, t = document.createElement('textarea'); let ok = false;
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;opacity:0'; document.body.appendChild(t); t.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove(); prev?.focus?.({preventScroll: true}); return ok;
}
export const CodeBlock = {
    name: 'CodeBlock',
    props: {code: {type: String, default: ''}, lang: String, title: String, wrap: Boolean},
    emits: ['copy'],
    setup(p, {emit}) {
        const state = ref(''); let t = 0;
        const copy = async () => { const ok = await copyText(p.code); state.value = ok ? 'Copied' : 'Copy failed'; emit('copy', ok); clearTimeout(t); t = setTimeout(() => { state.value = ''; }, 2000); };
        onBeforeUnmount(() => clearTimeout(t));
        return {state, copy};
    },
    template: `<div class="k-code" :class="{'k-code--wrap': wrap}"><div class="k-code__h"><span>{{ title || lang || 'Code' }}</span><button type="button" class="k-code__copy" aria-label="Copy code" @click="copy"><Ico :n="state === 'Copied' ? 'check' : 'copy'" :s="15"/><span aria-hidden="true">{{ state || 'Copy' }}</span></button></div>
        <pre tabindex="0" :aria-label="title || 'Code sample'"><code :data-lang="lang">{{ code }}</code></pre><span class="k-visually-hidden" role="status">{{ state }}</span></div>`,
};

// ---------- Offcanvas: the kit Drawer (js/glass/kit-overlay.js) with all four placements. Without it, the v4 Sheet is used. ----------
export const Offcanvas = {
    name: 'Offcanvas', inheritAttrs: false,
    props: {modelValue: Boolean, placement: {type: String, default: 'right'}, title: String, width: {type: [String, Number], default: 'md'}, height: {type: [String, Number], default: 360},
        closeOnBackdrop: {type: Boolean, default: true}, persistent: Boolean, hideClose: Boolean, z: {type: Number, default: 90}},
    emits: ['update:modelValue', 'close'],
    setup(p, {emit, attrs}) {
        const hasDrawer = !!getCurrentInstance().appContext.components.Drawer;
        const vertical = computed(() => p.placement === 'top' || p.placement === 'bottom');
        // top and bottom: set the height and stop the Drawer's sideways swipe-to-close, which has no meaning there
        const extra = () => vertical.value ?   // a function: attrs are not reactive, so nothing may cache them
             {...attrs, style: [attrs.style, {'--dh': typeof p.height === 'number' ? p.height + 'px' : p.height}], onPointerdown: e => e.stopImmediatePropagation()} : {...attrs};
        const close = () => { emit('update:modelValue', false); emit('close'); };
        return {hasDrawer, extra, close};
    },
    template: `<Drawer v-if="hasDrawer" v-bind="extra()" :model-value="modelValue" :side="placement" :title="title" :width="width" :close-on-backdrop="closeOnBackdrop" :persistent="persistent" :hide-close="hideClose" :z="z" @update:model-value="$emit('update:modelValue', $event)" @close="$emit('close')">
            <template v-if="$slots.header" #header><slot name="header"/></template><template #default="s"><slot v-bind="s || {}"/></template><template v-if="$slots.footer" #footer="s"><slot name="footer" v-bind="s || {}"/></template></Drawer>
        <Sheet v-else :open="modelValue" :title="title" @close="close"><slot :close="close"/><div v-if="$slots.footer" class="actions"><slot name="footer" :close="close"/></div></Sheet>`,
};

const KIT_CORE = {Carousel, ButtonGroup, Toolbar, KCard, PricingCard, ListGroup, Navbar, CloseButton, Placeholder, Ratio, Divider, Kbd, CodeBlock, Offcanvas};

// ============================================================================ showcases
const range = n => Array.from({length: n}, (_, i) => i + 1);

export const DemoFoundations = {
    name: 'DemoFoundations',
    components: KIT_CORE,
    setup() {
        const {width, bp} = useBreakpoint(), el = ref(null), tokens = reactive([
            {name: 'Text', css: 'rgb(var(--text-rgb))', v: '--text-rgb', cls: 'k-text-body'}, {name: 'Muted', css: 'var(--muted)', v: '--muted', cls: 'k-text-muted'},
            {name: 'Accent', css: 'var(--accent-c)', v: '--accent-c', cls: 'k-text-accent, k-bg-accent'}, {name: 'Success', css: 'var(--ok)', v: '--ok', cls: 'k-text-ok, k-bg-ok'},
            {name: 'Warning', css: 'var(--warn)', v: '--warn', cls: 'k-text-warn, k-bg-warn'}, {name: 'Danger', css: 'var(--bad)', v: '--bad', cls: 'k-text-bad, k-bg-bad'},
            {name: 'Accent ink on accent', css: 'var(--accent-ink)', on: 'var(--accent-c)', v: '--accent-ink', cls: 'k-fill-accent'},
        ].map(t => ({...t, ratio: 0})));
        // Contrast is measured: both colours are painted on a 1px canvas (so alpha and any colour syntax resolve), against the solid --tint surface.
        function measure() {
            const host = el.value; if (!host || !host.appendChild) return;
            const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext && cv.getContext('2d', {willReadFrequently: true}); if (!g) return;
            const probe = document.createElement('span'); host.appendChild(probe);
            const css = c => { probe.style.color = c; return getComputedStyle(probe).color; };
            const paint = list => { list.forEach(c => { g.fillStyle = css(c); g.fillRect(0, 0, 1, 1); }); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); };
            const lum = rgb => rgb.map(v => { const s = v / 255; return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
            tokens.forEach(t => { const base = ['rgb(var(--tint))', ...(t.on ? [t.on] : [])], a = lum(paint(base)), b = lum(paint([...base, t.css])); t.ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); });
            probe.remove();
        }
        let mo = null, t1 = 0;
        const later = () => { clearTimeout(t1); t1 = setTimeout(measure, 600); };   // the look tokens transition for half a second
        onMounted(() => { measure(); later(); const r = document.querySelector('.v4'); if (r && typeof MutationObserver !== 'undefined') { mo = new MutationObserver(later); mo.observe(r, {attributes: true, attributeFilter: ['data-scheme', 'data-look', 'style', 'class']}); } });
        onBeforeUnmount(() => { mo && mo.disconnect(); clearTimeout(t1); });
        const grade = r => r >= 7 ? ['AAA', 'g'] : r >= 4.5 ? ['AA', 'g'] : r >= 3 ? ['Large text only', 'y'] : ['Decoration only', 'r'];
        return {el, width, bp, tokens, grade, range, BREAKPOINTS, bps: Object.entries(BREAKPOINTS),
            sizes: ['4xl', '3xl', '2xl', 'xl', 'lg', 'base', 'sm', 'xs'], weights: ['light', 'normal', 'medium', 'semibold', 'bold', 'black'], space: [0, 4, 8, 12, 16, 24, 32, 48, 64],
            radii: ['0', 's', 'm', 'l', 'pill', 'circle'], shadows: ['k-shadow-none', 'k-shadow-sm', 'k-shadow', 'k-shadow-lg', 'k-shadow-xl'],
            layers: [['Utilities', 'k-z-0 to k-z-50', '0 to 50'], ['Top bar, sticky navbar', '.bar, .k-navbar--sticky', '20 to 25'], ['Dock', '.dock', '30'], ['Sheet', '.sheetw', '50'], ['Toasts', '.toasts', '60'], ['Modal, drawer, offcanvas', '.k-modalw, .k-drawerw', '90'], ['Confirm dialog', 'confirm()', '100'], ['Snackbar, update banner', '.k-snackw', '110'], ['Popover, context menu', '.k-pop', '120 to 125'], ['Tooltip', '.k-tip', '130']],
            sample: '<p class="k-fs-lg k-fw-semibold k-text-accent k-mb-2">Quarterly revenue</p>\n<p class="k-text-muted k-clamp-2 k-maxw-prose">Closed-won deals, all regions.</p>'};
    },
    template: `<div ref="el" class="k-demo k-core-demo">
        <Holder title="Breakpoint indicator" sub="Resize the window. Responsive classes follow the viewport width.">
            <p aria-live="polite"><span class="k-fs-2xl k-fw-black k-tabular">{{ width }} px</span> <Badge kind="b">{{ bp }}</Badge></p>
            <div class="k-bpi"><span v-for="[k, min] in bps" :key="k" :class="{on: k === bp, past: width >= min}"><b>{{ k }}</b><small>{{ min }}+</small></span></div>
            <p class="k-fs-sm">Pure CSS check: <span class="k-cls k-d-sm-none">below sm</span><span class="k-cls k-d-none k-d-sm-inline-block k-d-md-none">sm</span><span class="k-cls k-d-none k-d-md-inline-block k-d-lg-none">md</span><span class="k-cls k-d-none k-d-lg-inline-block k-d-xl-none">lg</span><span class="k-cls k-d-none k-d-xl-inline-block k-d-xxl-none">xl</span><span class="k-cls k-d-none k-d-xxl-inline-block">xxl</span></p></Holder>
        <Holder title="Typography" sub="Headings, size scale, weights and text helpers">
            <p class="k-display">Display heading</p><div v-for="i in 6" :key="i" :class="'k-h' + i">Heading {{ i }} <span class="k-cls">.k-h{{ i }}</span></div><Divider label="Size scale"/>
            <div v-for="s in sizes" :key="s" class="k-d-flex k-items-baseline k-gap-3"><span class="k-cls">.k-fs-{{ s }}</span><span class="k-truncate" :class="'k-fs-' + s">Invoice INV-2041 was paid</span></div><Divider label="Weights"/>
            <div class="k-d-flex k-flex-wrap k-gap-4"><span v-for="w in weights" :key="w" :class="'k-fw-' + w">.k-fw-{{ w }}</span></div>
            <div class="k-d-flex k-flex-wrap k-gap-4"><span class="k-uppercase k-tracking-wide">uppercase</span><span class="k-capitalize">capitalize words</span><span class="k-italic">italic</span><span class="k-underline">underline</span><span class="k-line-through">line through</span><span class="k-mono">mono 0123</span></div>
            <div class="k-grid k-cols-md-2"><div><span class="k-cls">.k-truncate</span><p class="k-truncate">Nordwind GmbH, framework agreement for warehouse equipment, renewal 2027, all branches</p></div><div><span class="k-cls">.k-clamp-2</span><p class="k-clamp-2">Delivery is split into three parts. The first part ships this week, the second after the site survey and the third once the customer confirms the loading dock dimensions in writing.</p></div></div>
            <CodeBlock :code="sample" title="Example" wrap/></Holder>
        <Holder title="Colour tokens and contrast" sub="Measured against the solid surface tint. 4.5:1 is needed for normal text, 3:1 for large text.">
            <div class="k-grid k-cols-md-2 k-cols-xl-3"><div v-for="t in tokens" :key="t.name" class="k-tok"><span class="k-tok__sw" :style="{background: t.on || 'rgb(var(--tint))', color: t.css}">Aa</span><div><b>{{ t.name }}</b><span class="k-cls">{{ t.v }}</span><small>{{ t.cls }}</small>
                <Badge v-if="t.ratio" :kind="grade(t.ratio)[1]">{{ t.ratio.toFixed(2) }}:1 {{ grade(t.ratio)[0] }}</Badge></div></div></div>
            <div class="k-d-flex k-flex-wrap k-gap-2"><span v-for="c in ['accent', 'ok', 'warn', 'bad', 'muted']" :key="c" class="k-px-3 k-py-2 k-rounded-s k-border" :class="['k-bg-' + c, c !== 'muted' && 'k-border-' + c]">.k-bg-{{ c }}</span><span class="k-px-3 k-py-2 k-rounded-s k-fill-accent">.k-fill-accent</span></div></Holder>
        <Holder title="Spacing scale" sub="Margin, padding and gap, steps 0 to 8: .k-m-3 .k-px-md-4 .k-mt-auto .k-gap-2">
            <div v-for="(v, i) in space" :key="i" class="k-d-flex k-items-center k-gap-3"><span class="k-cls k-flex-none">{{ i }}</span><small class="k-flex-none k-tabular" style="width:44px">{{ v }} px</small><i class="k-spbar" :style="{width: v + 'px'}"></i></div></Holder>
        <Holder title="Radii and borders" sub="Radii follow the Softness slider of the look controls"><div class="k-grid k-cols-3 k-cols-md-6"><div v-for="r in radii" :key="r" class="k-bg-accent k-border k-border-accent k-d-grid k-p-2 k-aspect-square" :class="'k-rounded-' + r" style="place-items:center"><small class="k-mono">{{ r }}</small></div></div></Holder>
        <Holder title="Shadows" sub="Elevation follows the Depth slider"><div class="k-grid k-cols-2 k-cols-md-5 k-gap-5 k-p-3"><div v-for="s in shadows" :key="s" class="k-bg-surface k-rounded k-p-4 k-text-center" :class="s"><span class="k-cls">.{{ s }}</span></div></div></Holder>
        <Holder title="Layers (z-index)" sub="Where each floating layer sits"><ul class="k-list-none"><li v-for="l in layers" :key="l[0]" class="k-d-flex k-flex-wrap k-justify-between k-items-center k-gap-2 k-py-2 k-border-b"><b>{{ l[0] }}</b><span class="k-cls">{{ l[1] }}</span><span class="k-tabular k-text-muted">{{ l[2] }}</span></li></ul></Holder></div>`,
};

// a resizable example: drag the lower right corner, or use the slider (touch screens)
const DemoFrame = {
    props: {title: String, classes: String},
    setup() {
        const w = ref(100), box = ref(null), px = useWidth(box, 0);
        return {w, box, px};
    },
    template: `<Card class="k-d-grid k-gap-2 k-minw-0"><div class="k-d-flex k-flex-wrap k-justify-between k-items-center k-gap-2"><b>{{ title }}</b><span class="k-cls">{{ classes }}</span></div>
        <Slider v-model="w" :min="30" :max="100" :label="px ? 'Frame width, ' + px + ' px' : 'Frame width'" unit="%"/><div ref="box" class="k-resize" :style="{width: w + '%'}"><slot/></div></Card>`,
};
export const DemoLayout = {
    name: 'DemoLayout',
    components: {...KIT_CORE, DemoFrame},
    setup() {
        const g = ref('3'), fit = ref(180), justify = ref('between'), items = ref('center');
        const rows = [['k-col', 'k-col', 'k-col'], ['k-col-12'], ['k-col-6', 'k-col-6'], ['k-col-4', 'k-col-8'], ['k-col-3', 'k-col-6', 'k-col-3'], ['k-col-auto', 'k-col', 'k-col-auto'], range(12).map(() => 'k-col-1')];
        return {g, fit, justify, items, rows, range,
            containers: ['k-container', 'k-container-sm', 'k-container-md', 'k-container-lg', 'k-container-xl', 'k-container-xxl', 'k-container-fluid'],
            gutters: ['0', '1', '2', '3', '4', '5'].map(v => ({v, l: 'g-' + v})), justifies: ['start', 'center', 'between', 'around', 'evenly', 'end'], aligns: ['start', 'center', 'end', 'stretch'],
            sample: '<div class="k-container">\n  <div class="k-row k-g-3">\n    <div class="k-col-12 k-col-md-8">Orders</div>\n    <div class="k-col-12 k-col-md-4">Summary</div>\n  </div>\n</div>'};
    },
    template: `<div class="k-demo k-core-demo">
        <Holder title="Containers" sub="Full width up to their breakpoint, then a fixed maximum, centred. The limits follow the viewport.">
            <div v-for="c in containers" :key="c" :class="c" style="padding-inline:0"><div class="k-blk">.{{ c }}</div></div><CodeBlock :code="sample" title="Container, row, columns"/></Holder>
        <Holder title="12 column grid" sub="Equal, fixed and automatic columns">
            <DemoFrame title="Column widths" classes=".k-row .k-col .k-col-1..12 .k-col-auto"><div class="k-d-grid k-gap-2"><div v-for="(r, i) in rows" :key="i" class="k-row k-g-2"><div v-for="(c, j) in r" :key="j" :class="c"><div class="k-blk">{{ r.length === 12 ? '1' : c.replace('k-', '') }}</div></div></div></div></DemoFrame>
            <DemoFrame title="Responsive columns" classes="k-col-12 k-col-sm-6 k-col-lg-3"><div class="k-row k-g-2"><div v-for="i in 4" :key="i" class="k-col-12 k-col-sm-6 k-col-lg-3"><div class="k-blk">12, sm-6, lg-3</div></div></div></DemoFrame>
            <DemoFrame title="Row columns" classes=".k-row .k-row-cols-2 .k-row-cols-md-3 .k-row-cols-xl-5"><div class="k-row k-row-cols-2 k-row-cols-md-3 k-row-cols-xl-5 k-g-2"><div v-for="i in 10" :key="i" class="k-col"><div class="k-blk">{{ i }}</div></div></div></DemoFrame>
            <DemoFrame title="Offsets" classes=".k-offset-3 .k-offset-md-4"><div class="k-row k-g-2"><div class="k-col-4"><div class="k-blk">col-4</div></div><div class="k-col-4 k-offset-4"><div class="k-blk">col-4 offset-4</div></div><div class="k-col-6 k-offset-3"><div class="k-blk">col-6 offset-3</div></div><div class="k-col-12 k-col-md-4 k-offset-md-4"><div class="k-blk">md-4 offset-md-4</div></div></div></DemoFrame>
            <DemoFrame title="Ordering" classes=".k-order-first .k-order-last .k-order-md-0"><div class="k-row k-g-2"><div class="k-col k-order-last"><div class="k-blk">1st in HTML, order-last</div></div><div class="k-col"><div class="k-blk">2nd</div></div><div class="k-col k-order-first"><div class="k-blk">3rd in HTML, order-first</div></div></div>
                <div class="k-row k-g-2 k-mt-1"><div class="k-col-12 k-col-md k-order-2 k-order-md-1"><div class="k-blk k-blk--alt">first from md, second below</div></div><div class="k-col-12 k-col-md k-order-1 k-order-md-2"><div class="k-blk k-blk--alt">second from md, first below</div></div></div></DemoFrame>
            <DemoFrame title="Nesting" classes=".k-row inside .k-col-8"><div class="k-row k-g-2"><div class="k-col-4"><div class="k-blk">col-4</div></div><div class="k-col-8"><div class="k-row k-g-2"><div class="k-col-12"><div class="k-blk k-blk--alt">col-8, nested col-12</div></div><div class="k-col-6"><div class="k-blk k-blk--alt">nested 6</div></div><div class="k-col-6"><div class="k-blk k-blk--alt">nested 6</div></div></div></div></div></DemoFrame>
            <div class="k-d-flex k-flex-wrap k-items-center k-gap-3"><b>Gutters</b><div class="k-overflow-x-auto k-mw-100"><Segmented v-model="g" :options="gutters"/></div></div>
            <DemoFrame title="Gutters" :classes="'.k-row .k-g-' + g + ' (also .k-gx-*, .k-gy-*, .k-g-md-*)'"><div class="k-row" :class="'k-g-' + g"><div v-for="i in 6" :key="i" class="k-col-4"><div class="k-blk">{{ i }}</div></div></div></DemoFrame></Holder>
        <Holder title="CSS grid" sub="Fixed tracks, responsive tracks, spans and auto-fit">
            <DemoFrame title="Tracks and spans" classes=".k-grid .k-cols-2 .k-cols-md-4 .k-span-2 .k-span-full"><div class="k-grid k-cols-2 k-cols-md-4 k-gap-2"><div class="k-blk k-span-2">span-2</div><div class="k-blk">1</div><div class="k-blk">2</div><div class="k-blk">3</div><div class="k-blk k-span-md-3">span-md-3</div><div class="k-blk k-span-full">span-full</div></div></DemoFrame>
            <Slider v-model="fit" :min="100" :max="320" label="Minimum track width (--k-min)" unit=" px"/>
            <DemoFrame title="Auto-fit" classes=".k-grid .k-grid-fit with --k-min"><div class="k-grid k-grid-fit k-gap-2" :style="{'--k-min': fit + 'px'}"><div v-for="i in 5" :key="i" class="k-blk">tile {{ i }}</div></div></DemoFrame>
            <DemoFrame title="Auto-fill" classes=".k-grid .k-grid-fill keeps empty tracks"><div class="k-grid k-grid-fill k-gap-2" :style="{'--k-min': fit + 'px'}"><div v-for="i in 3" :key="i" class="k-blk">tile {{ i }}</div></div></DemoFrame></Holder>
        <Holder title="Flex utilities" sub="Direction, wrap, justify, align, grow and gap">
            <div class="k-overflow-x-auto"><Segmented v-model="justify" :options="justifies"/></div><div class="k-overflow-x-auto"><Segmented v-model="items" :options="aligns"/></div>
            <div><span class="k-cls">.k-d-flex .k-flex-wrap .k-gap-2 .k-justify-{{ justify }} .k-items-{{ items }}</span></div>
            <div class="k-flexdemo k-d-flex k-flex-wrap k-gap-2" :class="['k-justify-' + justify, 'k-items-' + items]"><div class="k-blk k-h-auto">A</div><div class="k-blk k-h-auto k-py-5">B</div><div class="k-blk k-h-auto">C</div></div>
            <div class="k-d-flex k-flex-column k-flex-sm-row k-gap-2"><div class="k-blk k-flex-none">.k-flex-none</div><div class="k-blk k-grow-1">.k-grow-1</div><div class="k-blk k-ml-sm-auto k-flex-none">column below sm</div></div></Holder>
        <Holder title="Admin layouts" sub="These follow the width of their own box, so they reflow while you resize the frame">
            <DemoFrame title="Sidebar and content" classes=".k-layout-sidebar (--k-side, --k-content)"><div class="k-layout-sidebar"><aside class="k-blk">sidebar</aside><main class="k-d-grid k-gap-2"><div class="k-blk">page header</div><div class="k-blk k-blk--alt" style="min-height:120px">content</div></main></div></DemoFrame>
            <DemoFrame title="Holy grail" classes=".k-layout-holy > header + .k-layout-holy__body > nav, main, aside + footer"><div class="k-layout-holy" style="--k-minh:280px"><header class="k-blk k-h-auto">header</header><div class="k-layout-holy__body"><nav class="k-blk">nav</nav><main class="k-blk k-blk--alt">main</main><aside class="k-blk">aside</aside></div><footer class="k-blk k-h-auto">footer</footer></div></DemoFrame>
            <DemoFrame title="Dashboard tiles" classes=".k-layout-tiles .k-tile-wide .k-tile-tall"><div class="k-layout-tiles"><div class="k-blk k-tile-wide" style="min-height:90px">revenue, wide</div><div class="k-blk">orders</div><div class="k-blk">margin</div><div class="k-blk k-tile-tall">activity, tall</div><div class="k-blk k-tile-wide">pipeline, wide</div><div class="k-blk">stock</div><div class="k-blk">returns</div></div></DemoFrame>
            <DemoFrame title="Split view" classes=".k-layout-split (--k-min)"><div class="k-layout-split"><div class="k-d-grid k-gap-2"><div v-for="i in 3" :key="i" class="k-blk">order {{ 1040 + i }}</div></div><div class="k-blk k-blk--alt" style="min-height:140px">order detail</div></div></DemoFrame>
            <DemoFrame title="Sticky footer" classes=".k-layout-sticky > header, main, footer (--k-minh)"><div class="k-layout-sticky" style="--k-minh:260px"><header class="k-blk k-h-auto">header</header><main class="k-blk k-blk--alt k-h-auto">short content</main><footer class="k-blk k-h-auto">footer stays at the bottom</footer></div></DemoFrame></Holder></div>`,
};

const art = (c1, c2) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice"><rect width="400" height="225" fill="${c1}"/><circle cx="310" cy="62" r="46" fill="${c2}" opacity=".85"/><path d="M0 190 90 115l60 45 80-85 90 95 80-50v105H0z" fill="${c2}" opacity=".55"/></svg>`);
const SLIDES = [
    {id: 1, title: 'Spring catalogue', text: '214 new products, prices valid until June', bg: 'linear-gradient(135deg, #5b45c9, #1d2250)'},
    {id: 2, title: 'Warehouse opening', text: 'Second location, 4,200 square metres', bg: 'linear-gradient(135deg, #0f766e, #082f49)'},
    {id: 3, title: 'Service contracts', text: 'Response times and spare parts in one plan', bg: 'linear-gradient(135deg, #b4532a, #3b1220)'},
    {id: 4, title: 'Quarterly report', text: 'Revenue up 18 percent year on year', bg: 'linear-gradient(135deg, #1d4ed8, #0f172a)'},
    {id: 5, title: 'Partner day', text: 'Workshops for resellers and installers', bg: 'linear-gradient(135deg, #9d174d, #1e1b4b)'},
    {id: 6, title: 'Fleet renewal', text: 'Twelve electric vans arrive this autumn', bg: 'linear-gradient(135deg, #3f6212, #052e16)'},
];
const PHOTOS = [['#31407a', '#ff9a6a', 'Coastal depot'], ['#14524c', '#a7f3d0', 'Northern yard'], ['#5a2a55', '#fbcfe8', 'City showroom'], ['#27456b', '#fde68a', 'Hillside plant']].map(([a, b, t], i) => ({id: i, title: t, image: art(a, b), alt: 'Illustration: ' + t}));

export const DemoComponents = {
    name: 'DemoComponents',
    components: KIT_CORE,
    setup() {
        const acc = ref('ship'), slide = ref(0);
        const modal = reactive({sm: false, md: false, lg: false, full: false}), canvas = reactive({left: false, right: false, top: false, bottom: false});
        const pg = reactive({a: 1, size: 10, b: 4, c: 1, d: 2});
        const view = ref('week'), marks = ref(['bold']), side = ref('list'), bg = ref(null);
        const order = ref(1042), page = ref('orders'), page2 = ref('home'), tab = ref('open'), pill = ref('all'), seg = ref('Month'), prog = ref(62), loading = ref(false), dismissed = ref(false);
        const orders = [
            {id: 1042, title: 'Order 1042', text: 'Northwind, 3 items', icon: 'bag', meta: '4,820 EUR', badge: 'Paid', badgeKind: 'g', actions: [{id: 'mail', icon: 'mail', label: 'Email customer'}, {id: 'del', icon: 'trash', label: 'Delete'}]},
            {id: 1043, title: 'Order 1043', text: 'Fabrikam, 12 items', icon: 'bag', meta: '1,260 EUR', badge: 'Due', badgeKind: 'y', actions: [{id: 'mail', icon: 'mail', label: 'Email customer'}]},
            {id: 1044, title: 'Order 1044', text: 'Contoso, 1 item', icon: 'bag', meta: '310 EUR', badge: 'Overdue', badgeKind: 'r'},
            {id: 1045, title: 'Order 1045', text: 'Initech, cancelled', icon: 'bag', meta: '0 EUR', disabled: true},
        ];
        const links = [{id: 'home', label: 'Overview', icon: 'home'}, {id: 'orders', label: 'Orders', icon: 'bag', badge: 3}, {id: 'people', label: 'Customers', icon: 'users'}, {id: 'old', label: 'Archive', disabled: true}];
        const load = () => { loading.value = true; setTimeout(() => { loading.value = false; }, 1600); };
        const say = t => toast(t);
        return {acc, slide, modal, canvas, pg, view, marks, side, bg, order, page, page2, tab, pill, seg, prog, loading, dismissed, orders, links, load, say,
            slides: SLIDES, photos: PHOTOS, cover: art('#23306b', '#8b9cff'), cover2: art('#134e4a', '#fcd34d'),
            views: [{id: 'day', label: 'Day'}, {id: 'week', label: 'Week'}, {id: 'month', label: 'Month'}],
            styles: [{id: 'bold', label: 'Bold', icon: 'check'}, {id: 'italic', label: 'Italic'}, {id: 'under', label: 'Underline'}],
            tools: [{id: 'new', label: 'New', icon: 'plus'}, {id: 'export', label: 'Export', icon: 'download'}, {id: 'filter', label: 'Filter', icon: 'filter', disabled: true}],
            sideItems: [{id: 'list', label: 'List', icon: 'menu'}, {id: 'dates', label: 'Calendar', icon: 'cal'}, {id: 'images', label: 'Images', icon: 'img'}],
            crumbs: [{label: 'Home', href: '#', icon: 'home'}, {label: 'Customers', href: '#'}, {label: 'Northwind', href: '#'}, {label: 'Orders', href: '#'}, {label: 'Order 1042'}],
            tabs: [{id: 'open', label: 'Open', badge: 7}, {id: 'paid', label: 'Paid'}, {id: 'draft', label: 'Drafts'}, {id: 'void', label: 'Void', disabled: true}],
            vtabs: [{id: 'general', label: 'General', icon: 'gear'}, {id: 'billing', label: 'Billing', icon: 'wallet'}, {id: 'team', label: 'Team', icon: 'users'}],
            menu: [{label: 'Edit', icon: 'edit'}, {label: 'Duplicate', icon: 'copy'}, {sep: true}, {label: 'Delete', icon: 'trash', danger: true}],
            code: "import { registerKitCore } from 'glass/kit-core.js';\n\nregisterKitCore(app);   // <Carousel>, <Navbar>, <KCard>, ..."};
    },
    template: `<div class="k-demo k-core-demo">
        <Holder title="Accordions" sub="Accordion and Collapse (js/glass/ui.js); the boxed and filled looks are .k-accv--boxed and .k-accv--filled">
            <div class="k-grid k-cols-lg-2 k-gap-4">
                <div><span class="k-cls">Accordion, flush</span><Accordion title="Shipping" start><p>Free delivery above 500 EUR.</p></Accordion><Accordion title="Returns"><p>Returns are accepted within 30 days.</p></Accordion></div>
                <div class="k-accv--boxed"><span class="k-cls">.k-accv--boxed with icons and subtitles</span><Accordion title="Billing" sub="Invoices and payment methods" icon="wallet"><p>Invoices are sent on the first day of the month.</p></Accordion><Accordion title="Team" sub="Seats and roles" icon="users"><p>5 of 10 seats are in use.</p></Accordion></div>
                <div class="k-accv--filled"><span class="k-cls">one open at a time: Collapse</span><div v-for="a in [['ship', 'Delivery', 'Ships from the central warehouse.'], ['pay', 'Payment', 'Bank transfer or card.'], ['help', 'Support', 'Weekdays, 08:00 to 16:00.']]" :key="a[0]" class="acc" :class="{open: acc === a[0]}">
                    <button type="button" class="acc__h" :aria-expanded="acc === a[0]" @click="acc = acc === a[0] ? '' : a[0]"><span><b>{{ a[1] }}</b></span><Ico n="down" :s="18" class="acc__c"/></button><Collapse :open="acc === a[0]"><div class="acc__b" :inert="acc !== a[0]">{{ a[2] }}</div></Collapse></div></div>
                <div class="k-accv--boxed"><span class="k-cls">nested</span><Accordion title="Product range" start><Accordion title="Racking"><p>Pallet and shelf systems.</p></Accordion><Accordion title="Handling"><p>Lift trucks and conveyors.</p></Accordion></Accordion></div></div></Holder>
        <Holder title="Carousel" sub="Swipe, use the arrow keys, or the buttons. Autoplay pauses on hover and focus and stays off with reduced motion.">
            <span class="k-cls">items, arrows, dots, v-model: slide {{ slide + 1 }}</span><Carousel v-model="slide" :items="slides.slice(0, 4)" label="Announcements"/>
            <span class="k-cls">transition="fade" :autoplay="4000"</span><Carousel :items="slides.slice(0, 4)" transition="fade" :autoplay="4000" label="Automatic announcements"/>
            <span class="k-cls">:per-view="{0: 1, 480: 2, 840: 3}" (width of the carousel)</span><Carousel :items="slides" :per-view="{0: 1, 480: 2, 840: 3}" :dots="true" label="Campaigns" style="--k-slide-h:150px"/>
            <span class="k-cls">thumbnails, images</span><Carousel :items="photos" thumbnails label="Locations"/>
            <span class="k-cls">:loop="false", own slides in the #slides slot</span><Carousel :loop="false" :per-view="{0: 1, 640: 2}" label="Quotes"><template #slides><KCard v-for="q in ['Delivery was a day early.', 'Setup took one morning.', 'Support answered in plain words.']" :key="q" title="Customer note" subtitle="Reseller survey"><p>{{ q }}</p><template #footer><button type="button" class="btn" @click="say('Saved the note')">Save</button></template></KCard></template></Carousel>
            <span class="k-cls">items with the #slide scoped slot</span><Carousel :items="slides" :per-view="{0: 1, 560: 3}" :arrows="false" label="Numbers"><template #slide="{item, index}"><Card class="k-text-center"><div class="k-fs-3xl k-fw-black k-text-accent">{{ index + 1 }}</div><b>{{ item.title }}</b></Card></template></Carousel></Holder>
        <Holder title="Modals and offcanvas" sub="Modal (js/glass/kit-overlay.js) in four sizes; Offcanvas wraps the Drawer from the same file on all four sides">
            <div class="k-d-flex k-flex-wrap k-gap-2"><button v-for="s in ['sm', 'md', 'lg', 'full']" :key="s" type="button" class="btn" @click="modal[s] = true">Modal {{ s }}</button></div>
            <div class="k-d-flex k-flex-wrap k-gap-2"><button v-for="s in ['left', 'right', 'top', 'bottom']" :key="s" type="button" class="btn" @click="canvas[s] = true">Offcanvas {{ s }}</button></div>
            <Modal v-for="s in ['sm', 'md', 'lg', 'full']" :key="s" v-model="modal[s]" :size="s" :title="'Modal size ' + s"><p>Northwind, order 1042. Focus stays inside until the dialog closes.</p><template #footer="{close}"><button type="button" class="btn" @click="close">Cancel</button><button type="button" class="btn primary" @click="close(); say('Saved')">Save</button></template></Modal>
            <Offcanvas v-for="s in ['left', 'right', 'top', 'bottom']" :key="s" v-model="canvas[s]" :placement="s" :title="'Offcanvas ' + s" :height="320"><p class="k-mb-3">Filters for the order list.</p><ListGroup :items="orders.slice(0, 2)" actionable @select="canvas[s] = false"/><template #footer="{close}"><button type="button" class="btn primary" @click="close">Done</button></template></Offcanvas></Holder>
        <Holder title="Pagination" sub="Pagination (js/glass/kit-data.js); .k-pg-pills, .k-pg-center and .k-pg-bare change the look">
            <span class="k-cls">full, with page size</span><Pagination v-model:page="pg.a" v-model:size="pg.size" :total="248"/>
            <span class="k-cls">:siblings="2" .k-pg-pills, no page size</span><Pagination v-model:page="pg.b" class="k-pg-pills" :total="180" :siblings="2" :sizes="[]"/>
            <span class="k-cls">.k-pg-center .k-pg-bare :siblings="0"</span><Pagination v-model:page="pg.c" class="k-pg-center k-pg-bare" :total="90" :siblings="0" :sizes="[]"/>
            <span class="k-cls">.k-pg-bare .k-pg-pills</span><Pagination v-model:page="pg.d" class="k-pg-bare k-pg-pills" :total="40" :sizes="[]"/></Holder>
        <Holder title="Button groups and toolbar" sub="ButtonGroup and Toolbar (kit-core)">
            <div class="k-d-flex k-flex-wrap k-items-center k-gap-3"><ButtonGroup v-model="view" :items="views" label="Calendar range"/><ButtonGroup v-model="marks" multiple :items="styles" size="sm" label="Text style"/><ButtonGroup :items="tools" size="lg" label="Order actions" @pick="say($event.label)"/></div>
            <div class="k-d-flex k-flex-wrap k-items-start k-gap-3"><ButtonGroup v-model="side" :items="sideItems" vertical label="Layout"/>
                <Toolbar label="Document tools"><ButtonGroup v-model="side" :items="sideItems.map(i => ({...i, iconOnly: true}))" label="View"/><Divider vertical/><button type="button" class="btn" @click="say('Printed')">Print</button><button type="button" class="btn primary" @click="say('Sent')">Send</button></Toolbar></div></Holder>
        <Holder title="Cards" sub="KCard and PricingCard (kit-core), Stat (js/glass/ui.js)">
            <div class="k-grid k-grid-fit" style="--k-min:240px">
                <KCard title="Coastal depot" subtitle="Media card" :image="cover" image-alt="Illustration of hills and a sun"><p>1,840 pallet places, 12 loading bays.</p><template #footer><Badge kind="g">Open</Badge><button type="button" class="btn" @click="say('Opened the depot')">Details</button></template></KCard>
                <KCard ruled title="Order 1042" subtitle="Header and footer"><p>Three items, delivery on Friday.</p><template #footer><small>Updated 2 h ago</small><button type="button" class="btn primary" @click="say('Order confirmed')">Confirm</button></template></KCard>
                <KCard href="#" title="Linked card" subtitle="The whole card is one link" media="linear-gradient(135deg, #5b45c9, #0f766e)" @click.prevent="say('Card link')"><p>Use it for tiles that open a page.</p></KCard></div>
            <KCard horizontal title="Northern yard" subtitle="Horizontal card, stacks when narrow" :image="cover2" image-alt="Illustration of a yard"><p>Outdoor storage for long goods with a weighbridge at the gate.</p><template #footer><small>Capacity 76%</small></template></KCard>
            <div class="k-grid k-cols-2 k-cols-lg-4"><Stat label="Revenue" icon="wallet" value="€229k" delta="+12%" :data="[3,5,4,7,6,9,8,11]"/><Stat label="Orders" icon="bag" value="1,204" delta="+4%" :data="[5,6,6,8,7,9,10,10]"/><Stat label="Customers" icon="users" value="318" delta="+9" :data="[2,3,3,5,4,6,7,9]"/><Stat label="Returns" icon="trend" value="1.8%" delta="-0.4%" down :data="[9,8,8,6,7,5,4,3]"/></div>
            <div class="k-grid k-grid-fit" style="--k-min:220px"><PricingCard name="Starter" currency="€" price="19" period="per month" text="For one shop." :features="['2 users', '500 invoices', {text: 'API access', off: true}]" @select="say($event + ' selected')"/>
                <PricingCard featured badge="Popular" name="Business" currency="€" price="49" period="per month" text="For growing teams." :features="['10 users', 'Unlimited invoices', 'API access']" @select="say($event + ' selected')"/>
                <PricingCard name="Enterprise" price="Custom" text="Several companies in one account." :features="['Unlimited users', 'Single sign-on', 'Data export']" cta="Contact sales" @select="say('Sales contact requested')"/></div></Holder>
        <Holder title="List groups" sub="ListGroup (kit-core): actions, badges, active item, flush, numbered">
            <div class="k-grid k-cols-lg-2 k-gap-4"><div class="k-d-grid k-gap-2 k-minw-0"><span class="k-cls">actionable, v-model, actions</span><ListGroup v-model="order" :items="orders" actionable label="Orders" @action="say($event.action.label + ': ' + $event.item.title)"/></div>
                <div class="k-d-grid k-gap-2 k-minw-0 k-items-start"><span class="k-cls">flush</span><ListGroup :items="orders.slice(0, 3).map(o => ({id: o.id, title: o.title, meta: o.meta}))" flush label="Totals"/><span class="k-cls">numbered</span><ListGroup numbered :items="[{id: 1, title: 'Check stock'}, {id: 2, title: 'Pick and pack'}, {id: 3, title: 'Book the carrier'}]" label="Steps"/></div></div></Holder>
        <Holder title="Navbar" sub="Navbar (kit-core) collapses by its own width; the second one is limited to 360 px">
            <Navbar v-model="page" brand="Rapttor Demo" :links="links" label="Demo navigation" :collapse-at="720"><template #actions><button type="button" class="icon-btn" aria-label="Notifications" @click="say('No new notifications')"><Ico n="bell" :s="18"/></button></template></Navbar>
            <div style="max-width:360px"><Navbar v-model="page2" brand="Depot" :links="links" label="Narrow navigation"><button type="button" class="btn primary k-w-100 k-mt-2" @click="say('Signed in')">Sign in</button></Navbar></div></Holder>
        <Holder title="Breadcrumbs, tabs and pills" sub="Breadcrumbs and Tabs (js/glass/kit-nav.js), Segmented (js/glass/ui.js); pills are .k-tabs-pills">
            <Breadcrumbs :items="crumbs" @navigate="say($event.label)"/>
            <Tabs v-model="tab" :tabs="tabs" label="Invoice states"><template #open><p>7 open invoices.</p></template><template #paid><p>112 paid invoices.</p></template><template #draft><p>2 drafts.</p></template></Tabs>
            <Tabs v-model="pill" class="k-tabs-pills" :tabs="[{id: 'all', label: 'All', badge: 21}, {id: 'mine', label: 'Mine'}, {id: 'team', label: 'Team'}]" label="Owner filter"><template #all><p>Everything.</p></template><template #mine><p>Assigned to you.</p></template><template #team><p>Assigned to your team.</p></template></Tabs>
            <Tabs vertical :tabs="vtabs" label="Settings sections"><template #general><p>Company name and language.</p></template><template #billing><p>Plan and invoices.</p></template><template #team><p>Roles and seats.</p></template></Tabs>
            <div><Segmented v-model="seg" :options="['Week', 'Month', 'Year']"/></div></Holder>
        <Holder title="Placeholders" sub="Placeholder (kit-core); Skeleton (js/glass/ui.js) for simple lines">
            <div><button type="button" class="btn" @click="load">Reload the cards</button></div>
            <div class="k-grid k-grid-fit" style="--k-min:200px"><template v-if="loading"><Placeholder variant="card"/><Placeholder variant="media"/><Placeholder animation="pulse" :lines="4"/><Skeleton :n="4"/></template>
                <template v-else><Placeholder variant="card"/><Placeholder variant="media" animation="pulse"/><Placeholder animation="none" :lines="4"/><div class="k-d-grid k-gap-2"><i class="k-ph" style="width:70%"></i><i class="k-ph k-ph--pulse" style="width:45%"></i></div></template></div></Holder>
        <Holder title="Progress and spinners" sub="Progress (js/glass/ui.js) with .k-prog modifiers; Spinner, LoadingButton and RingProgress (js/glass/kit-overlay.js)">
            <Slider v-model="prog" label="Value" unit="%"/><Progress :value="prog" class="k-prog--sm"/><Progress :value="prog" kind="g"/><Progress :value="prog" kind="y" class="k-prog--striped"/><Progress :value="prog" class="k-prog--lg k-prog--striped k-prog--moving k-prog--bad" role="progressbar" :aria-valuenow="prog" aria-valuemin="0" aria-valuemax="100" aria-label="Import"/>
            <div class="prog k-prog--lg k-prog--stack" role="img" aria-label="Paid 55 percent, due 25 percent, overdue 10 percent"><i style="width:55%;background:var(--ok)"></i><i style="width:25%;background:var(--warn)"></i><i style="width:10%;background:var(--bad)"></i></div>
            <div class="k-d-flex k-flex-wrap k-items-center k-gap-4"><Spinner :size="16"/><Spinner/><Spinner :size="36" :thickness="2.5"/><LoadingButton variant="primary" :loading="loading" @click="load">Save invoice</LoadingButton><RingProgress :value="prog" label="Storage"/><RingProgress indeterminate :size="48" :stroke="5" label="Working"/></div></Holder>
        <Holder title="Dropdowns, tooltips and close buttons" sub="MenuButton and Tooltip (js/glass/kit-overlay.js), CloseButton (kit-core)">
            <div class="k-d-flex k-flex-wrap k-items-center k-gap-3"><MenuButton label="Actions" :items="menu" @select="say($event.label)"/><MenuButton label="Primary menu" variant="primary" :items="menu" placement="bottom-end" @select="say($event.label)"/><MenuButton icon-only label="More" icon="dots" :items="menu" @select="say($event.label)"><Ico n="dots" :s="18"/></MenuButton>
                <Tooltip v-for="side in ['top', 'right', 'bottom', 'left']" :key="side" :text="'Tooltip on the ' + side" :placement="side"><button type="button" class="btn">{{ side }}</button></Tooltip></div>
            <div class="k-d-flex k-flex-wrap k-items-center k-gap-3"><CloseButton @click="say('Closed')"/><CloseButton solid label="Dismiss" @click="say('Dismissed')"/><CloseButton disabled/>
                <div v-if="!dismissed" class="k-d-flex k-items-center k-gap-2 k-pl-3 k-bg-accent k-rounded-pill">Filter: overdue<CloseButton label="Remove the filter" :size="15" @click="dismissed = true"/></div><button v-else type="button" class="btn" @click="dismissed = false">Restore the filter</button></div></Holder>
        <Holder title="Ratio, divider, keys and code" sub="Ratio, Divider, Kbd and CodeBlock (kit-core)">
            <div class="k-grid k-cols-2 k-cols-md-3 k-items-start"><Ratio ratio="16:9"><div class="k-blk">16:9</div></Ratio><Ratio ratio="4 / 3"><img :src="cover" alt="Illustration of hills"></Ratio><Ratio :ratio="1"><div class="k-blk">1:1</div></Ratio></div>
            <Divider/><Divider label="Centred label"/><Divider align="start" label="Start"/><Divider align="end" dashed label="End, dashed"/>
            <div class="k-d-flex k-items-center k-gap-3"><span>Left</span><Divider vertical/><span>Middle</span><Divider vertical dashed/><span>Right</span></div>
            <p class="k-d-flex k-flex-wrap k-items-center k-gap-3">Search <Kbd keys="Ctrl+K"/> Save <Kbd :keys="['Ctrl', 'S']"/> Close <Kbd>Esc</Kbd></p>
            <CodeBlock :code="code" lang="js" title="Register the kit"/></Holder></div>`,
};

export function registerKitCore(app) {
    Object.entries({...KIT_CORE, DemoFoundations, DemoLayout, DemoComponents}).forEach(([k, v]) => app.component(k, v));
}
