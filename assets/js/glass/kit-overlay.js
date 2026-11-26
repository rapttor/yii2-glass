// Glass kit v6: overlays, menus and feedback. Popover, MenuButton, ContextMenu, Tooltip (v-tip), confirm(), Modal (+ v-trap), Drawer, Alert, snack(), Spinner, LoadingButton, RingProgress, UpdateBanner.
// Self-contained: only Vue and the PATHS icon map. Styled by scss/kit/_overlay.scss. Layers are teleported into the `.v4` element.
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from '../vendor/vue.esm-browser.prod.js';
import { PATHS } from './ui.js';

const ADD = {
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01', warn: 'M12 4l9 16H3zM12 10v4M12 17h.01', bad: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6',
    ok: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.5l2.5 2.5 4.5-5', refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6', edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    copy: 'M8 8h11v12H8zM5 16V4h11', share: 'M12 4v11M8 8l4-4 4 4M5 14v6h14v-6', archive: 'M4 5h16v4H4zM6 9v10h12V9M10 13h4',
};
Object.keys(ADD).forEach(k => { PATHS[k] ??= ADD[k]; });

// ---------- helpers ----------
const root = () => document.querySelector('.v4') || document.body;
let _uid = 0;
const uid = p => p + (++_uid);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const focusables = el => [...el.querySelectorAll(FOCUSABLE)].filter(n => n.getClientRects().length);
const usePrimary = list => {   // only the first mounted host renders, so a second mount never shows a layer twice
    const me = uid('host'); list.push(me);
    onBeforeUnmount(() => { const i = list.indexOf(me); if (i > -1) list.splice(i, 1); });
    return computed(() => list[0] === me);
};
let locks = 0;
const lockScroll = on => { locks = Math.max(0, locks + (on ? 1 : -1)); document.documentElement.classList.toggle('v4-lock', locks > 0); };

// Places a layer next to an anchor rect: flips to the opposite side when it does not fit, clamps to the viewport, returns arrow offsets.
function computePos(a, el, placement, off) {
    const [side0, al = 'center'] = placement.split('-'), vw = innerWidth, vh = innerHeight, w = el.offsetWidth, h = el.offsetHeight, m = 8;
    const room = {top: a.top - m, bottom: vh - a.bottom - m, left: a.left - m, right: vw - a.right - m}, opp = {top: 'bottom', bottom: 'top', left: 'right', right: 'left'};
    const need = side0 === 'top' || side0 === 'bottom' ? h + off : w + off;
    const side = room[side0] < need && room[opp[side0]] > room[side0] ? opp[side0] : side0;
    let x, y;
    if (side === 'top' || side === 'bottom') {
        y = side === 'top' ? a.top - h - off : a.bottom + off;
        x = al === 'start' ? a.left : al === 'end' ? a.right - w : a.left + a.width / 2 - w / 2;
    } else {
        x = side === 'left' ? a.left - w - off : a.right + off;
        y = al === 'start' ? a.top : al === 'end' ? a.bottom - h : a.top + a.height / 2 - h / 2;
    }
    x = clamp(x, m, Math.max(m, vw - w - m)); y = clamp(y, m, Math.max(m, vh - h - m));
    return {x, y, side, ax: clamp(a.left + a.width / 2 - x, 14, Math.max(14, w - 14)), ay: clamp(a.top + a.height / 2 - y, 14, Math.max(14, h - 14))};
}

// ---------- v-trap: keeps Tab inside an element, focuses its first control, returns focus on unmount ----------
const traps = [];
function onFocusIn(e) {
    const t = traps[traps.length - 1];
    if (!t || t.el.contains(e.target) || (e.target.closest && e.target.closest('.k-pop,.k-snack,.k-tip'))) return;
    (focusables(t.el)[0] || t.el).focus({preventScroll: true});
}
function trapKey(e) {
    if (e.key !== 'Tab') return;
    const el = e.currentTarget, l = focusables(el), a = document.activeElement;
    if (!l.length) { e.preventDefault(); el.focus(); return; }
    if (e.shiftKey && (a === l[0] || a === el)) { e.preventDefault(); l[l.length - 1].focus(); }
    else if (!e.shiftKey && a === l[l.length - 1]) { e.preventDefault(); l[0].focus(); }
}
export const vTrap = {   // v-trap, v-trap="false", v-trap="{initial: '#field', restore: false}"
    mounted(el, {value}) {
        if (value === false) return;
        const o = value && typeof value === 'object' ? value : {}, t = {el, prev: document.activeElement, restore: o.restore !== false};
        el._ktrap = t; if (!traps.length) document.addEventListener('focusin', onFocusIn);
        traps.push(t); el.addEventListener('keydown', trapKey);
        if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
        const first = (o.initial && el.querySelector(o.initial)) || el.querySelector('[data-autofocus]') || focusables(el).find(n => !n.hasAttribute('data-k-close'));
        (first || el).focus({preventScroll: true});
    },
    beforeUnmount(el) {
        const t = el._ktrap; if (!t) return;
        traps.splice(traps.indexOf(t), 1); el.removeEventListener('keydown', trapKey); if (!traps.length) document.removeEventListener('focusin', onFocusIn);
        if (t.restore && t.prev && t.prev.isConnected) t.prev.focus({preventScroll: true});
        el._ktrap = null;
    },
};

// ---------- Popover ----------
export const Popover = {
    name: 'Popover',
    props: {modelValue: Boolean, placement: {type: String, default: 'bottom'}, offset: {type: Number, default: 8}, arrow: Boolean, trigger: {type: String, default: 'click'},
        anchor: {type: Object, default: null}, role: {type: String, default: 'dialog'}, label: String, matchWidth: Boolean, bare: Boolean, delay: {type: Number, default: 120}, disabled: Boolean, autofocus: {type: Boolean, default: true}},
    emits: ['update:modelValue', 'open', 'close'],
    setup(p, {emit, expose}) {
        const open = ref(p.modelValue), wrap = ref(null), layer = ref(null), id = uid('k-pop'), pos = reactive({x: 0, y: 0, side: 'bottom', ax: 0, ay: 0});
        let timer = 0, raf = 0, off = null;
        const has = k => p.trigger.split(/\s+/).includes(k), anchorEl = () => p.anchor || wrap.value;
        const set = v => { if (v && p.disabled) return; if (v === open.value) return; open.value = v; emit('update:modelValue', v); emit(v ? 'open' : 'close'); };
        const focusTrigger = () => { const w = anchorEl(); if (!w) return; (w.matches(FOCUSABLE) ? w : w.querySelector(FOCUSABLE) || w).focus?.({preventScroll: true}); };
        const close = refocus => { set(false); if (refocus) focusTrigger(); };
        const reposition = () => {
            const a = anchorEl(), l = layer.value; if (!a || !l) return;
            const r = a.getBoundingClientRect(); l.style.minWidth = p.matchWidth ? r.width + 'px' : '';
            Object.assign(pos, computePos(r, l, p.placement, p.offset + (p.arrow ? 4 : 0)));
        };
        const bind = () => {
            const down = e => { if (layer.value && layer.value.contains(e.target)) return; if (anchorEl() && anchorEl().contains(e.target)) return; set(false); };
            const key = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close(true); } };
            const move = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(reposition); };
            document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key); addEventListener('resize', move); addEventListener('scroll', move, true);
            off = () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); removeEventListener('resize', move); removeEventListener('scroll', move, true); cancelAnimationFrame(raf); };
        };
        const unbind = () => { off && off(); off = null; };
        watch(() => p.modelValue, v => { open.value = v; });
        watch(open, async v => {
            if (!v) { unbind(); return; }
            await nextTick(); reposition(); unbind(); bind();
            if (p.autofocus && has('click') && layer.value) layer.value.focus({preventScroll: true});
        }, {immediate: true});
        watch(() => [p.placement, p.offset, p.arrow], () => open.value && nextTick(reposition));
        onBeforeUnmount(() => { unbind(); clearTimeout(timer); });
        // aria on the trigger element
        watch([open, wrap], () => { const t = wrap.value && wrap.value.firstElementChild; if (!t) return; t.setAttribute('aria-expanded', open.value ? 'true' : 'false'); t.setAttribute('aria-haspopup', p.role === 'presentation' ? 'menu' : p.role); if (open.value) t.setAttribute('aria-controls', id); else t.removeAttribute('aria-controls'); }, {flush: 'post', immediate: true});
        const onClick = () => { if (has('click')) set(!open.value); };
        const hin = () => { if (!has('hover')) return; clearTimeout(timer); timer = setTimeout(() => set(true), p.delay); };
        const hout = () => { if (!has('hover')) return; clearTimeout(timer); timer = setTimeout(() => set(false), p.delay + 80); };
        const fin = () => { if (has('focus')) { clearTimeout(timer); set(true); } };
        const fout = e => { if (has('focus') && !(wrap.value && wrap.value.contains(e.relatedTarget)) && !(layer.value && layer.value.contains(e.relatedTarget))) set(false); };
        const tab = e => {   // Tab out of the layer returns to the trigger so the order stays natural
            const l = focusables(layer.value), a = document.activeElement;
            if (e.shiftKey && (a === layer.value || a === l[0])) { e.preventDefault(); close(true); }
            else if (!e.shiftKey && (!l.length || a === l[l.length - 1])) close(true);
        };
        expose({open: () => set(true), close, toggle: () => set(!open.value), reposition});
        return {open, wrap, layer, id, pos, onClick, hin, hout, fin, fout, tab, close, set, root: () => root()};
    },
    template: `<span ref="wrap" class="k-pop-anchor" @click="onClick" @mouseenter="hin" @mouseleave="hout" @focusin="fin" @focusout="fout"><slot :open="open" :toggle="() => set(!open)" :close="close"/>
        <Teleport :to="root()"><Transition name="k-pop"><div v-if="open" :id="id" ref="layer" class="k-pop" :class="{'k-pop--bare': bare}" :role="role" :aria-label="label" tabindex="-1" :data-side="pos.side"
            :style="{left: pos.x + 'px', top: pos.y + 'px', '--ax': pos.ax + 'px', '--ay': pos.ay + 'px'}" @mouseenter="hin" @mouseleave="hout" @keydown.tab="tab"><i v-if="arrow" class="k-pop__arrow"></i><div class="k-pop__in"><slot name="content" :close="close"/></div></div></Transition></Teleport></span>`,
};

// ---------- Menu list (shared by MenuButton and ContextMenu) ----------
// item: {id, label, icon, shortcut, danger, disabled, action, children: [...]}, {sep: true}, {group: 'Title'}
export const KMenu = {
    name: 'KMenu',
    props: {items: {type: Array, default: () => []}, sub: Boolean, label: String, focus: {type: Boolean, default: true}},
    emits: ['select', 'tab', 'back'],
    setup(p, {emit, expose}) {
        const el = ref(null), subOpen = ref(-1), subKb = ref(false), flip = ref(false), shift = ref(0); let buf = '', bt = 0, st = 0;
        const hasIcons = computed(() => p.items.some(i => i.icon));
        const entries = () => [...el.value.children].map(c => c.matches('[role=menuitem]') ? c : c.querySelector(':scope > [role=menuitem]')).filter(b => b && b.getAttribute('aria-disabled') !== 'true');
        const focusAt = i => { const l = entries(); if (l.length) l[(i + l.length) % l.length].focus({preventScroll: true}); };
        const focusFirst = () => focusAt(0);
        onMounted(() => { if (p.focus) focusFirst(); else if (!p.sub) el.value.focus?.(); });
        onBeforeUnmount(() => { clearTimeout(st); clearTimeout(bt); });
        const openSub = (i, kb) => {
            subKb.value = kb; flip.value = false; shift.value = 0; subOpen.value = i;
            nextTick(() => {
                const s = el.value && el.value.querySelector(':scope > div > .k-menu__sub'); if (!s) return;
                const r = s.getBoundingClientRect(); if (r.right > innerWidth - 8) flip.value = true; if (r.bottom > innerHeight - 8) shift.value = innerHeight - 8 - r.bottom;
            });
        };
        const click = (it, i) => { if (it.disabled) return; if (it.children) { openSub(i, true); return; } if (it.action) it.action(it); emit('select', it); };
        const hover = (it, i, e) => {
            if (it.disabled) return; e.currentTarget.focus({preventScroll: true}); clearTimeout(st);
            if (it.children) { if (subOpen.value !== i) st = setTimeout(() => openSub(i, false), 140); } else subOpen.value = -1;
        };
        const back = () => { const i = subOpen.value; subOpen.value = -1; nextTick(() => { const b = el.value && el.value.querySelector('[data-i="' + i + '"]'); b && b.focus({preventScroll: true}); }); };
        const key = e => {
            if (e.target.closest('.k-menu') !== el.value) return;   // keys from a nested submenu are handled there
            const l = entries(), cur = l.indexOf(document.activeElement), idx = cur > -1 ? +document.activeElement.dataset.i : -1;
            let used = true;
            if (e.key === 'ArrowDown') focusAt(cur < 0 ? 0 : cur + 1);
            else if (e.key === 'ArrowUp') focusAt(cur < 0 ? -1 : cur - 1);
            else if (e.key === 'Home') focusAt(0);
            else if (e.key === 'End') focusAt(-1);
            else if (e.key === 'ArrowRight' && idx > -1 && p.items[idx].children && !p.items[idx].disabled) openSub(idx, true);
            else if ((e.key === 'ArrowLeft' || e.key === 'Escape') && p.sub) { e.stopPropagation(); emit('back'); }
            else if (e.key === 'Tab') { emit('tab'); used = false; }
            else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {   // typeahead
                buf += e.key.toLowerCase(); clearTimeout(bt); bt = setTimeout(() => { buf = ''; }, 600);
                const n = l.length, from = cur + (buf.length === 1 ? 1 : 0);
                for (let k = 0; k < n; k++) { const b = l[(from + k + n) % n]; if (b.dataset.l.startsWith(buf)) { b.focus({preventScroll: true}); break; } }
            } else used = false;
            if (used) e.preventDefault();
        };
        expose({focusFirst});
        return {el, subOpen, subKb, flip, shift, hasIcons, click, hover, back, key};
    },
    template: `<div ref="el" class="k-menu" :class="{'k-menu--sub': sub}" role="menu" :aria-label="label" tabindex="-1" @keydown="key">
        <template v-for="(it, i) in items" :key="i"><div v-if="it.sep" class="k-menu__sep" role="separator"></div><div v-else-if="it.group" class="k-menu__grp" role="presentation">{{ it.group }}</div>
        <div v-else :class="it.children ? 'k-menu__has' : 'k-menu__r'">
            <button type="button" role="menuitem" tabindex="-1" class="k-menu__i" :class="{danger: it.danger, open: subOpen === i}" :data-i="i" :data-l="(it.label || '').toLowerCase()" :aria-haspopup="it.children ? 'menu' : null" :aria-expanded="it.children ? subOpen === i : null" :aria-disabled="it.disabled ? 'true' : null" @click="click(it, i)" @mouseenter="hover(it, i, $event)">
                <Ico v-if="it.icon" :n="it.icon" :s="16"/><i v-else-if="hasIcons" class="k-menu__ico0"></i><span class="k-menu__l">{{ it.label }}</span><kbd v-if="it.shortcut" class="k-menu__kbd">{{ it.shortcut }}</kbd><Ico v-if="it.children" n="chev" :s="14" class="k-menu__arr"/></button>
            <KMenu v-if="it.children && subOpen === i" sub :focus="subKb" :items="it.children" :label="it.label" class="k-menu__sub" :class="{flip}" :style="{marginTop: shift + 'px'}" @select="$emit('select', $event)" @tab="$emit('tab')" @back="back"/></div></template></div>`,
};

// ---------- MenuButton / Dropdown ----------
export const MenuButton = {
    name: 'MenuButton', components: {Popover, KMenu},
    props: {items: Array, label: String, icon: String, iconOnly: Boolean, ariaLabel: String, placement: {type: String, default: 'bottom-start'}, disabled: Boolean, variant: String},
    emits: ['select'],
    setup(p, {emit}) {
        const open = ref(false);
        const pick = (it, close) => { emit('select', it); close(true); };
        return {open, pick};
    },
    template: `<Popover v-model="open" :placement="placement" :offset="6" role="presentation" bare :autofocus="false" :disabled="disabled" class="k-mb">
        <button type="button" class="btn k-mb__b" :class="[variant, {'k-mb__icon': iconOnly}]" :disabled="disabled" :aria-label="ariaLabel || (iconOnly ? label : null)" @keydown.down.prevent="open = true">
            <slot :open="open"><Ico v-if="icon" :n="icon" :s="16"/><span v-if="label && !iconOnly" class="k-mb__t">{{ label }}</span><Ico v-if="!iconOnly" n="down" :s="14" class="k-mb__c"/></slot></button>
        <template #content="{close}"><KMenu :items="items" :label="label" @select="pick($event, close)" @tab="close(true)"/></template></Popover>`,
};
export const Dropdown = MenuButton;

// ---------- ContextMenu: right click, long press on touch, Shift+F10 / menu key ----------
export const ContextMenu = {
    name: 'ContextMenu', components: {KMenu},
    props: {items: Array, target: [Object, String], disabled: Boolean, longPress: {type: Number, default: 520}, tag: {type: String, default: 'div'}},
    emits: ['select', 'open', 'close'],
    setup(p, {emit}) {
        const wrap = ref(null), layer = ref(null), shown = ref(false), pos = reactive({x: 0, y: 0}); let prev = null, lp = 0, sx = 0, sy = 0, host = null, off = null;
        const place = () => {
            const l = layer.value; if (!l) return; const w = l.offsetWidth, h = l.offsetHeight, m = 8; let x = pos.x, y = pos.y;
            if (x + w > innerWidth - m) x = x - w; if (y + h > innerHeight - m) y = y - h;
            pos.x = clamp(x, m, Math.max(m, innerWidth - w - m)); pos.y = clamp(y, m, Math.max(m, innerHeight - h - m));
        };
        const openAt = async (x, y, t) => {
            if (p.disabled || !p.items || !p.items.length) return;
            prev = document.activeElement; pos.x = x; pos.y = y; shown.value = true; emit('open', {x, y, target: t});
            await nextTick(); place(); bind();
        };
        const close = refocus => { if (!shown.value) return; shown.value = false; off && off(); off = null; emit('close'); if (refocus && prev && prev.isConnected) prev.focus({preventScroll: true}); };
        const bind = () => {
            off && off();
            const down = e => { if (!layer.value || !layer.value.contains(e.target)) close(); }, key = e => { if (e.key === 'Escape') { e.preventDefault(); close(true); } }, any = () => close();
            document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key); addEventListener('resize', any); addEventListener('scroll', any, true); addEventListener('blur', any);
            off = () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); removeEventListener('resize', any); removeEventListener('scroll', any, true); removeEventListener('blur', any); };
        };
        const ctx = e => {
            e.preventDefault(); let x = e.clientX, y = e.clientY;
            if (!x && !y) { const r = e.target.getBoundingClientRect(); x = r.left + 12; y = r.bottom; }   // keyboard invoked
            openAt(x, y, e.target);
        };
        const stop = () => { clearTimeout(lp); lp = 0; };
        const pd = e => { if (e.pointerType === 'mouse') return; sx = e.clientX; sy = e.clientY; clearTimeout(lp); lp = setTimeout(() => { navigator.vibrate && navigator.vibrate(10); openAt(sx, sy, e.target); }, p.longPress); };
        const pm = e => { if (lp && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop(); };
        const pick = it => { emit('select', it); close(true); };
        onMounted(() => {
            host = typeof p.target === 'string' ? document.querySelector(p.target) : (p.target || wrap.value); if (!host) return;
            host.classList.add('k-ctx-t'); host.addEventListener('contextmenu', ctx); host.addEventListener('pointerdown', pd); host.addEventListener('pointermove', pm); host.addEventListener('pointerup', stop); host.addEventListener('pointercancel', stop);
        });
        onBeforeUnmount(() => { stop(); off && off(); if (host) { host.classList.remove('k-ctx-t'); host.removeEventListener('contextmenu', ctx); host.removeEventListener('pointerdown', pd); host.removeEventListener('pointermove', pm); host.removeEventListener('pointerup', stop); host.removeEventListener('pointercancel', stop); } });
        return {wrap, layer, shown, pos, pick, close, root: () => root()};
    },
    template: `<component :is="tag" ref="wrap" class="k-ctx" :class="{'k-ctx--none': target}"><slot/>
        <Teleport :to="root()"><Transition name="k-pop"><div v-if="shown" ref="layer" class="k-pop k-pop--bare k-ctxl" data-side="ctx" :style="{left: pos.x + 'px', top: pos.y + 'px'}" @contextmenu.prevent><KMenu :items="items" @select="pick" @tab="close(true)"/></div></Transition></Teleport></component>`,
};

// ---------- Tooltip: v-tip="'text'" or v-tip="{text, placement, delay}" and <Tooltip text="..."> ----------
let tipEl = null, tipFor = null, tipPending = null, tipTimer = 0, tipLast = 0, tipScroll = false;
const TIP_ID = 'k-tip-live';
function showTip(el) {
    const c = el._ktip; if (!c || !c.text || !el.isConnected) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'k-tip'; tipEl.id = TIP_ID; tipEl.setAttribute('role', 'tooltip'); }
    if (!tipEl.isConnected) root().appendChild(tipEl);
    if (tipFor && tipFor !== el) unmark(tipFor);
    tipEl.textContent = c.text; tipEl.classList.remove('on');
    const r = computePos(el.getBoundingClientRect(), tipEl, c.placement, 8);
    tipEl.style.left = r.x + 'px'; tipEl.style.top = r.y + 'px'; tipEl.dataset.side = r.side;
    if (!el._kdesc) el._kdesc = {prev: el.getAttribute('aria-describedby')};
    el.setAttribute('aria-describedby', [el._kdesc.prev, TIP_ID].filter(Boolean).join(' '));
    tipFor = el; requestAnimationFrame(() => tipFor === el && tipEl.classList.add('on'));
    if (!tipScroll) { tipScroll = true; addEventListener('scroll', () => tipFor && hideTip(tipFor), true); }
}
function unmark(el) { if (!el._kdesc) return; if (el._kdesc.prev) el.setAttribute('aria-describedby', el._kdesc.prev); else el.removeAttribute('aria-describedby'); el._kdesc = null; }
function hideTip(el) {
    if (tipPending === el) { clearTimeout(tipTimer); tipPending = null; }
    if (tipFor !== el) return;
    tipEl.classList.remove('on'); unmark(el); tipFor = null; tipLast = performance.now();
}
function scheduleTip(el, instant) {
    clearTimeout(tipTimer); tipPending = el;
    const d = instant || performance.now() - tipLast < 400 ? 0 : el._ktip.delay;
    tipTimer = setTimeout(() => { tipPending = null; showTip(el); }, d);
}
const tipCfg = v => ({text: '', placement: 'top', delay: 450, ...(typeof v === 'string' ? {text: v} : v || {})});
export const vTip = {
    mounted(el, b) {
        el._ktip = tipCfg(b.value);
        const enter = e => { if (e.pointerType !== 'touch') scheduleTip(el, false); }, leave = () => hideTip(el),
            fin = e => { if (e.target.matches && e.target.matches(':focus-visible')) scheduleTip(el, true); }, esc = e => { if (e.key === 'Escape') hideTip(el); };
        el.addEventListener('pointerenter', enter); el.addEventListener('pointerleave', leave); el.addEventListener('pointerdown', leave);
        el.addEventListener('focusin', fin); el.addEventListener('focusout', leave); el.addEventListener('keydown', esc);
        el._ktipOff = () => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); el.removeEventListener('pointerdown', leave); el.removeEventListener('focusin', fin); el.removeEventListener('focusout', leave); el.removeEventListener('keydown', esc); };
    },
    updated(el, b) { el._ktip = tipCfg(b.value); if (tipFor === el) { if (el._ktip.text) showTip(el); else hideTip(el); } },
    unmounted(el) { hideTip(el); el._ktipOff && el._ktipOff(); },
};
export const Tooltip = {
    name: 'Tooltip', directives: {tip: vTip},
    props: {text: String, placement: {type: String, default: 'top'}, delay: {type: Number, default: 450}, tag: {type: String, default: 'span'}},
    template: `<component :is="tag" class="k-tipw" v-tip="{text, placement, delay}"><slot/></component>`,
};

// ---------- Modal ----------
export const Modal = {
    name: 'Modal', inheritAttrs: false, directives: {trap: vTrap},
    props: {modelValue: Boolean, title: String, size: {type: String, default: 'md'}, closeOnBackdrop: {type: Boolean, default: true}, persistent: Boolean, hideClose: Boolean,
        role: {type: String, default: 'dialog'}, initial: String, z: {type: Number, default: 90}},
    emits: ['update:modelValue', 'close'],
    setup(p, {emit}) {
        const tid = uid('k-mt'), bid = uid('k-mb'); let bd = false, locked = false;
        const close = () => { emit('update:modelValue', false); emit('close'); };
        const esc = e => { if (p.persistent) return; e.stopPropagation(); close(); };
        const down = e => { e.preventDefault(); bd = true; };
        const click = () => { if (bd && p.closeOnBackdrop && !p.persistent) close(); bd = false; };
        watch(() => p.modelValue, v => { if (v !== locked) { locked = v; lockScroll(v); } }, {immediate: true});
        onBeforeUnmount(() => { if (locked) lockScroll(false); });
        return {tid, bid, close, esc, down, click, root: () => root()};
    },
    template: `<Teleport :to="root()"><Transition name="k-modal"><div v-if="modelValue" class="k-modalw" :class="{'k-modalw--fp': size !== 'sm'}" :style="{'--z': z}" @mousedown.self="down" @click.self="click">
        <div class="k-modal" :class="'k-modal--' + size" :role="role" aria-modal="true" :aria-labelledby="title || $slots.title ? tid : null" :aria-describedby="bid" v-trap="{initial: initial}" v-bind="$attrs" @keydown.esc="esc">
            <header v-if="title || $slots.title || !hideClose" class="k-modal__h"><h3 :id="tid"><slot name="title">{{ title }}</slot></h3><button v-if="!hideClose" type="button" class="icon-btn" data-k-close aria-label="Close" @click="close"><Ico n="x" :s="18"/></button></header>
            <div :id="bid" class="k-modal__b"><slot :close="close"/></div>
            <footer v-if="$slots.footer" class="k-modal__f"><slot name="footer" :close="close"/></footer></div></div></Transition></Teleport>`,
};

// ---------- ConfirmDialog service ----------
const confirmQ = reactive([]), confirmHosts = reactive([]);
export function confirm(o = {}) {   // confirm({title, text, confirmText, cancelText, danger}) -> Promise<boolean>
    return new Promise(res => confirmQ.push({id: uid('c'), title: 'Are you sure?', text: '', confirmText: 'Confirm', cancelText: 'Cancel', danger: false, ...(typeof o === 'string' ? {text: o} : o), res}));
}
export const ConfirmHost = {
    name: 'ConfirmHost', components: {Modal},
    setup() {
        const primary = usePrimary(confirmHosts), cur = computed(() => primary.value ? confirmQ[0] : null), last = ref({});
        watch(cur, c => { if (c) last.value = c; }, {immediate: true});
        const done = v => { const c = confirmQ.shift(); c && c.res(v); };
        const key = e => { if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); done(true); } };   // on a button, Enter keeps its own meaning
        return {cur, last, done, key};
    },
    template: `<Modal :model-value="!!cur" size="sm" role="alertdialog" :title="last.title" hide-close :close-on-backdrop="false" :z="100" class="k-confirm" @update:model-value="done(false)" @keydown="key">
        <p class="k-confirm__t" :class="{danger: last.danger}"><Ico :n="last.danger ? 'warn' : 'info'" :s="20"/><span>{{ last.text }}</span></p>
        <template #footer><button type="button" class="btn" :data-autofocus="last.danger ? '' : null" @click="done(false)">{{ last.cancelText }}</button>
            <button type="button" class="btn" :class="last.danger ? 'danger' : 'primary'" :data-autofocus="last.danger ? null : ''" @click="done(true)">{{ last.confirmText }}</button></template></Modal>`,
};

// ---------- Drawer ----------
export const Drawer = {
    name: 'Drawer', inheritAttrs: false, directives: {trap: vTrap},
    props: {modelValue: Boolean, title: String, side: {type: String, default: 'right'}, width: {type: [String, Number], default: 'md'}, closeOnBackdrop: {type: Boolean, default: true}, persistent: Boolean, hideClose: Boolean, z: {type: Number, default: 90}},
    emits: ['update:modelValue', 'close'],
    setup(p, {emit}) {
        const tid = uid('k-dt'), dx = ref(0), drag = ref(false); let st = null, bd = false, locked = false;
        const close = () => { emit('update:modelValue', false); emit('close'); };
        const dw = computed(() => ({sm: '320px', md: '420px', lg: '640px'}[p.width] || (typeof p.width === 'number' ? p.width + 'px' : p.width)));
        const esc = e => { if (p.persistent) return; e.stopPropagation(); close(); };
        const down = e => { if (e.pointerType === 'mouse' || p.persistent) return; st = {x: e.clientX, y: e.clientY}; };
        const move = e => {
            if (!st) return; const mx = e.clientX - st.x, my = e.clientY - st.y, out = p.side === 'right' ? mx > 0 : mx < 0;
            if (!drag.value) { if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.4 && out) { drag.value = true; e.currentTarget.setPointerCapture(e.pointerId); } else if (Math.abs(my) > 10) st = null; return; }
            dx.value = p.side === 'right' ? Math.max(0, mx) : Math.min(0, mx);
        };
        const up = () => { if (drag.value && Math.abs(dx.value) > 90) close(); drag.value = false; dx.value = 0; st = null; };
        const bdown = e => { e.preventDefault(); bd = true; }, bclick = () => { if (bd && p.closeOnBackdrop && !p.persistent) close(); bd = false; };
        watch(() => p.modelValue, v => { if (v !== locked) { locked = v; lockScroll(v); } }, {immediate: true});
        onBeforeUnmount(() => { if (locked) lockScroll(false); });
        return {tid, dx, drag, dw, close, esc, down, move, up, bdown, bclick, root: () => root()};
    },
    template: `<Teleport :to="root()"><Transition name="k-drawer"><div v-if="modelValue" class="k-drawerw" :class="'k-drawerw--' + side" :style="{'--z': z}" @mousedown.self="bdown" @click.self="bclick">
        <aside class="k-drawer" :class="['k-drawer--' + side, {drag}]" role="dialog" aria-modal="true" :aria-labelledby="title || $slots.header ? tid : null" :style="{'--dw': dw, transform: dx ? 'translateX(' + dx + 'px)' : ''}" v-trap v-bind="$attrs"
            @keydown.esc="esc" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
            <header class="k-drawer__h"><div :id="tid" class="k-drawer__t"><slot name="header"><h3>{{ title }}</h3></slot></div><button v-if="!hideClose" type="button" class="icon-btn" data-k-close aria-label="Close" @click="close"><Ico n="x" :s="18"/></button></header>
            <div class="k-drawer__b"><slot :close="close"/></div><footer v-if="$slots.footer" class="k-drawer__f"><slot name="footer" :close="close"/></footer></aside></div></Transition></Teleport>`,
};

// ---------- Alert ----------
export const Alert = {
    name: 'Alert',
    props: {kind: {type: String, default: 'info'}, title: String, dismissible: Boolean, compact: Boolean, icon: String, action: String},
    emits: ['dismiss', 'action'],
    setup(p, {emit}) {
        const shown = ref(true), ic = computed(() => p.icon || ({info: 'info', ok: 'ok', warn: 'warn', bad: 'bad'}[p.kind] || 'info'));
        return {shown, ic, dismiss: () => { shown.value = false; emit('dismiss'); }};
    },
    template: `<Transition name="k-fade"><div v-if="shown" class="k-alert" :class="['k-alert--' + kind, {'k-alert--compact': compact}]" :role="kind === 'bad' || kind === 'warn' ? 'alert' : 'status'">
        <span class="k-alert__i"><slot name="icon"><Ico :n="ic" :s="compact ? 16 : 20"/></slot></span>
        <div class="k-alert__b"><b v-if="title">{{ title }}</b><div class="k-alert__x"><slot/></div></div>
        <slot name="action"><button v-if="action" type="button" class="k-alert__a" @click="$emit('action')">{{ action }}</button></slot>
        <button v-if="dismissible" type="button" class="k-alert__d" aria-label="Dismiss" @click="dismiss"><Ico n="x" :s="16"/></button></div></Transition>`,
};

// ---------- Snackbar service ----------
const snacks = reactive([]), snackHosts = reactive([]);
export function snack(text, o = {}) {   // snack('Order deleted', {action: 'Undo', onAction, duration, kind: 'info'|'ok'|'warn'|'bad'}) -> {id, close}
    const s = {id: uid('s'), text, kind: o.kind || 'info', action: o.action, onAction: o.onAction, onClose: o.onClose, duration: o.duration ?? (o.action ? 7000 : 4000)};
    snacks.push(s);
    return {id: s.id, close: () => { const i = snacks.findIndex(x => x.id === s.id); if (i > -1) snacks.splice(i, 1); }};
}
export const SnackHost = {
    name: 'SnackHost',
    setup() {
        const primary = usePrimary(snackHosts), cur = computed(() => primary.value ? snacks[0] : null), paused = ref(false); let t = 0, started = 0, left = 0;
        const dismiss = s => { const i = snacks.indexOf(s); if (i > -1) { snacks.splice(i, 1); s.onClose && s.onClose(); } };
        const arm = ms => { clearTimeout(t); if (!cur.value || !cur.value.duration) return; const s = cur.value; left = ms; started = Date.now(); t = setTimeout(() => dismiss(s), ms); };
        watch(() => cur.value && cur.value.id, id => { paused.value = false; if (id) arm(cur.value.duration); else clearTimeout(t); }, {immediate: true});
        const pause = () => { if (paused.value || !cur.value || !cur.value.duration) return; paused.value = true; clearTimeout(t); left -= Date.now() - started; };
        const resume = () => { if (!paused.value) return; paused.value = false; arm(Math.max(600, left)); };
        const act = () => { const s = cur.value; s.onAction && s.onAction(); dismiss(s); };
        onBeforeUnmount(() => clearTimeout(t));
        return {snacks, cur, paused, dismiss, pause, resume, act, root: () => root()};
    },
    template: `<Teleport :to="root()"><div class="k-snackw"><Transition name="k-snack" mode="out-in"><div v-if="cur" :key="cur.id" class="k-snack" :class="'k-snack--' + cur.kind" :role="cur.kind === 'bad' ? 'alert' : 'status'" @pointerenter="pause" @pointerleave="resume" @focusin="pause" @focusout="resume">
        <Ico :n="{info: 'info', ok: 'ok', warn: 'warn', bad: 'bad'}[cur.kind]" :s="18" class="k-snack__i"/><span class="k-snack__t">{{ cur.text }}</span><small v-if="snacks.length > 1" class="k-snack__n">+{{ snacks.length - 1 }}</small>
        <button v-if="cur.action" type="button" class="k-snack__a" @click="act">{{ cur.action }}</button><button type="button" class="k-snack__x" aria-label="Dismiss" @click="dismiss(cur)"><Ico n="x" :s="16"/></button>
        <i v-if="cur.duration" class="k-snack__bar" :class="{paused}" :style="{animationDuration: cur.duration + 'ms'}"></i></div></Transition></div></Teleport>`,
};

// ---------- Spinner, LoadingButton, RingProgress ----------
export const Spinner = {
    name: 'Spinner',
    props: {size: {type: Number, default: 20}, thickness: {type: Number, default: 3}, label: {type: String, default: 'Loading'}},
    template: `<span class="k-spin" role="status" :aria-label="label" :style="{'--s': size + 'px', '--w': thickness}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle class="k-spin__t" cx="12" cy="12" r="9"/><circle class="k-spin__v" cx="12" cy="12" r="9"/></svg></span>`,
};
export const LoadingButton = {
    name: 'LoadingButton',
    components: {Spinner},
    props: {loading: Boolean, variant: {type: String, default: 'default'}, disabled: Boolean, type: {type: String, default: 'button'}, block: Boolean},
    // the label stays in the layout (hidden) while loading, so the button keeps its width
    template: `<button class="btn k-lbtn" :class="[variant === 'default' ? '' : variant, {loading, block}]" :type="type" :disabled="disabled || loading" :aria-busy="loading"><span class="k-lbtn__c"><slot/></span><span v-if="loading" class="k-lbtn__s"><Spinner :size="18" :thickness="3" label="Working"/></span></button>`,
};
export const RingProgress = {
    name: 'RingProgress',
    props: {value: {type: Number, default: 0}, size: {type: Number, default: 72}, stroke: {type: Number, default: 7}, indeterminate: Boolean, kind: String, label: String},
    setup(p) {
        const r = computed(() => (p.size - p.stroke) / 2), c = computed(() => 2 * Math.PI * r.value), pct = computed(() => clamp(p.value, 0, 100));
        return {r, c, pct};
    },
    template: `<div class="k-ring" :class="[kind && 'k-ring--' + kind, {ind: indeterminate}]" :style="{width: size + 'px', height: size + 'px', '--sz': size + 'px'}" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="indeterminate ? null : Math.round(pct)" :aria-label="label">
        <svg :viewBox="'0 0 ' + size + ' ' + size" aria-hidden="true"><circle class="k-ring__t" :cx="size / 2" :cy="size / 2" :r="r" :stroke-width="stroke"/>
            <circle class="k-ring__v" :cx="size / 2" :cy="size / 2" :r="r" :stroke-width="stroke" :stroke-dasharray="indeterminate ? c * .3 + ' ' + c : c" :stroke-dashoffset="indeterminate ? 0 : c * (1 - pct / 100)" :transform="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"/></svg>
        <span class="k-ring__l"><slot><template v-if="!indeterminate">{{ Math.round(pct) }}%</template></slot></span></div>`,
};

// ---------- UpdateBanner (new version available, service worker driven) ----------
export const updateState = reactive({available: false, reg: null});
export function triggerUpdateBanner(reg = null) { updateState.reg = reg; updateState.available = true; }   // the demo calls this; the service worker watcher does too
export function watchServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return;
        if (reg.waiting && navigator.serviceWorker.controller) triggerUpdateBanner(reg);
        reg.addEventListener('updatefound', () => {
            const w = reg.installing; if (!w) return;
            w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) triggerUpdateBanner(reg); });
        });
    }).catch(() => {});
}
export function applyUpdate() {   // asks the waiting worker to take over (it must handle {type: 'SKIP_WAITING'}), then reloads
    const w = updateState.reg && updateState.reg.waiting;
    if (w) { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {once: true}); w.postMessage({type: 'SKIP_WAITING'}); setTimeout(() => location.reload(), 2500); } else location.reload();
}
export const UpdateBanner = {
    name: 'UpdateBanner',
    props: {message: {type: String, default: 'A new version is available.'}, watch: {type: Boolean, default: true}},
    emits: ['reload', 'later'],
    setup(p, {emit}) {
        const inst = getCurrentInstance();
        onMounted(() => { if (p.watch) watchServiceWorker(); });
        const reload = () => { if (inst.vnode.props && inst.vnode.props.onReload) emit('reload'); else applyUpdate(); updateState.available = false; };
        const later = () => { updateState.available = false; emit('later'); };
        return {updateState, reload, later, root: () => root()};
    },
    template: `<Teleport :to="root()"><Transition name="k-fade"><div v-if="updateState.available" class="k-update" role="status"><Ico n="refresh" :s="18"/><span class="k-update__t">{{ message }}</span>
        <button type="button" class="btn primary k-update__b" @click="reload">Reload</button><button type="button" class="btn k-update__b" @click="later">Later</button></div></Transition></Teleport>`,
};

// ---------- Showcase ----------
export const DemoOverlay = {
    name: 'DemoOverlay', directives: {tip: vTip},
    setup() {
        const filterOpen = ref(false), m = reactive({sm: false, md: false, lg: false, full: false}), dr = reactive({left: false, right: false});
        const form = reactive({name: 'Acme Logistics d.o.o.', email: 'billing@acme.example', plan: 'Business', status: 'All', overdue: false});
        const busy = reactive({primary: false, default: false, danger: false}), ring = ref(68), ctxRow = ref('');
        const orderItems = [
            {label: 'Edit order', icon: 'edit', shortcut: 'E'}, {label: 'Duplicate', icon: 'copy', shortcut: 'Ctrl D'},
            {label: 'Share', icon: 'share', children: [{label: 'Email to customer', icon: 'mail'}, {label: 'Copy link', icon: 'copy'}, {label: 'Download PDF', icon: 'download', disabled: true}]},
            {sep: true}, {group: 'Danger zone'}, {label: 'Refund payment', disabled: true}, {label: 'Archive', icon: 'archive'}, {label: 'Delete order', icon: 'trash', danger: true, id: 'delete'},
        ];
        const rowItems = [{label: 'Open invoice', icon: 'edit'}, {label: 'Send reminder', icon: 'mail'}, {label: 'Mark as paid', icon: 'check'}, {sep: true}, {label: 'Delete', icon: 'trash', danger: true, id: 'delete'}];
        const invoices = [{id: 'INV-2041', who: 'Acme Logistics', amt: '4,820.00 EUR', st: 'Paid'}, {id: 'INV-2042', who: 'Nordwind GmbH', amt: '1,260.50 EUR', st: 'Overdue'}, {id: 'INV-2043', who: 'Brodogradnja Split', amt: '9,075.00 EUR', st: 'Draft'}];
        const askDelete = async (what = 'order #1042') => {
            const ok = await confirm({title: 'Delete ' + what + '?', text: 'The record and its attached documents will be removed. You can undo this for a few seconds.', confirmText: 'Delete', danger: true});
            if (ok) snack(what + ' deleted', {action: 'Undo', kind: 'ok', onAction: () => snack('Restored ' + what)}); else snack('Nothing was deleted');
        };
        const pick = it => { if (it.id === 'delete') askDelete(); else snack(it.label + ': order #1042'); };
        const pickRow = it => { const row = ctxRow.value || 'INV-2041'; if (it.id === 'delete') askDelete(row); else snack(it.label + ': ' + row); };
        const run = k => { busy[k] = true; setTimeout(() => { busy[k] = false; snack('Invoice saved', {kind: 'ok'}); }, 1600); };
        const queue = () => { snack('Report exported'); snack('3 invoices need review', {kind: 'warn', duration: 5000}); snack('Bank feed disconnected', {kind: 'bad', action: 'Reconnect', onAction: () => snack('Reconnecting...')}); };
        const noteReload = () => snack('Demo: a real banner would reload the page now', {kind: 'info'});
        return {filterOpen, m, dr, form, busy, ring, orderItems, rowItems, invoices, ctxRow, askDelete, pick, pickRow, run, queue, triggerUpdateBanner, noteReload, snack, onCtx: e => { ctxRow.value = e.target && e.target.closest('[data-id]') ? e.target.closest('[data-id]').dataset.id : ''; }};
    },
    template: `<div class="k-demo">
        <Holder title="Popover, menus and tooltips" sub="Click, hover, right click or long press">
            <div class="k-demo__row">
                <Popover v-model="filterOpen" placement="bottom-start" arrow label="Filter invoices">
                    <button type="button" class="btn"><Ico n="filter" :s="16"/>Filters</button>
                    <template #content="{close}"><div class="k-demo__panel"><Field v-model="form.status" label="Status" :options="['All', 'Paid', 'Overdue', 'Draft']"/><Toggle v-model="form.overdue" label="Only overdue"/>
                        <div class="actions"><button type="button" class="btn" @click="close(true)">Cancel</button><button type="button" class="btn primary" @click="close(true); snack('Filters applied: ' + form.status, {kind: 'ok'})">Apply</button></div></div></template></Popover>
                <Popover trigger="hover focus" placement="top" arrow :offset="6"><button type="button" class="btn">Net 30 <Ico n="info" :s="14"/></button>
                    <template #content><div class="k-demo__panel"><b>Payment terms</b><small>Due 30 days after the invoice date. A 2% discount applies when paid within 10 days.</small></div></template></Popover>
                <MenuButton label="Order actions" icon="gear" :items="orderItems" @select="pick"/>
                <MenuButton icon-only label="More actions" icon="dots" :items="orderItems" placement="bottom-end" @select="pick"><Ico n="dots" :s="18"/></MenuButton>
                <button type="button" class="icon-btn" v-tip="'Download statement'" aria-label="Download statement"><Ico n="download" :s="18"/></button>
                <button type="button" class="icon-btn" v-tip="{text: 'Send a reminder', placement: 'bottom'}" aria-label="Send a reminder"><Ico n="mail" :s="18"/></button>
                <Tooltip text="Opens the customer record" placement="right"><a class="link" href="#" @click.prevent>Acme Logistics</a></Tooltip>
            </div>
            <ContextMenu :items="rowItems" @open="onCtx" @select="pickRow"><ul class="k-demo__list" aria-label="Invoices (right click or long press a row)">
                <li v-for="i in invoices" :key="i.id" :data-id="i.id" tabindex="0"><b>{{ i.id }}</b><span>{{ i.who }}</span><span class="k-demo__amt">{{ i.amt }}</span><Badge :kind="i.st === 'Paid' ? 'g' : i.st === 'Overdue' ? 'r' : 'n'">{{ i.st }}</Badge></li></ul></ContextMenu>
        </Holder>
        <Holder title="Dialogs and panels" sub="Focus is trapped and returned, Escape closes">
            <div class="k-demo__row">
                <button type="button" class="btn danger" @click="askDelete()">Delete order...</button>
                <button type="button" class="btn" @click="m.sm = true">Modal sm</button><button type="button" class="btn" @click="m.md = true">Modal md</button>
                <button type="button" class="btn" @click="m.lg = true">Modal lg</button><button type="button" class="btn" @click="m.full = true">Modal full</button>
                <button type="button" class="btn" @click="dr.left = true">Drawer left</button><button type="button" class="btn" @click="dr.right = true">Drawer right</button></div>
        </Holder>
        <Holder title="Feedback" sub="Alerts, snackbars, progress and update banner">
            <div class="k-demo__stack">
                <Alert kind="info" title="Scheduled maintenance">Saturday 02:00 to 03:00 the invoicing module is read only.</Alert>
                <Alert kind="ok" title="Payment received" dismissible>Acme Logistics paid INV-2041 in full.</Alert>
                <Alert kind="warn" title="3 invoices are overdue" action="Review">Total outstanding: 10,335.50 EUR.</Alert>
                <Alert kind="bad" title="Bank feed disconnected" dismissible action="Reconnect" @action="snack('Reconnecting...')">Transactions are not syncing since 08:12.</Alert>
                <Alert kind="info" compact>Compact: changes are saved automatically.</Alert></div>
            <div class="k-demo__row">
                <button type="button" class="btn" @click="snack('Customer saved')">Snackbar</button>
                <button type="button" class="btn" @click="snack('Invoice archived', {action: 'Undo', onAction: () => snack('Restored', {kind: 'ok'})})">With Undo</button>
                <button type="button" class="btn" @click="snack('Upload failed: file too large', {kind: 'bad'})">Error</button><button type="button" class="btn" @click="queue">Queue of 3</button>
                <button type="button" class="btn" @click="triggerUpdateBanner()">Update banner</button></div>
            <div class="k-demo__row"><Spinner :size="16"/><Spinner/><Spinner :size="32" :thickness="2.5"/>
                <LoadingButton variant="primary" :loading="busy.primary" @click="run('primary')">Save invoice</LoadingButton><LoadingButton :loading="busy.default" @click="run('default')">Export CSV</LoadingButton>
                <LoadingButton variant="danger" :loading="busy.danger" @click="run('danger')">Void invoice</LoadingButton></div>
            <div class="k-demo__row"><RingProgress :value="ring" label="Storage used"/><RingProgress :value="ring" kind="ok" :size="56" :stroke="5"/><RingProgress indeterminate :size="56" :stroke="5" label="Importing"/>
                <RingProgress :value="ring" kind="warn" :size="96" :stroke="8"><span class="k-demo__ringl"><b>{{ Math.round(ring / 20) }}/5</b><small>files</small></span></RingProgress>
                <div class="k-demo__sl"><Slider v-model="ring" label="Import progress" unit="%"/></div></div>
        </Holder>
        <Modal v-model="m.sm" size="sm" title="Rename workspace"><Field v-model="form.name" label="Company name"/><template #footer><button type="button" class="btn" @click="m.sm = false">Cancel</button><button type="button" class="btn primary" @click="m.sm = false; snack('Workspace renamed', {kind: 'ok'})">Save</button></template></Modal>
        <Modal v-model="m.md" title="Edit customer"><div class="k-demo__form"><Field v-model="form.name" label="Company"/><Field v-model="form.email" label="Billing email" type="email" icon="mail"/><Field v-model="form.plan" label="Plan" :options="['Starter', 'Business', 'Enterprise']"/></div>
            <template #footer="{close}"><button type="button" class="btn" @click="close">Cancel</button><button type="button" class="btn primary" @click="close(); snack('Customer saved', {kind: 'ok'})">Save</button></template></Modal>
        <Modal v-model="m.lg" size="lg" title="Invoice INV-2043"><div class="k-demo__stack"><p>Brodogradnja Split, 9,075.00 EUR, due in 14 days.</p><Alert kind="warn" compact>This invoice is still a draft and has not been sent.</Alert><Field v-model="form.name" label="Note to customer" :rows="4"/></div>
            <template #footer="{close}"><button type="button" class="btn" @click="close">Close</button><button type="button" class="btn primary" @click="close(); snack('Invoice sent', {kind: 'ok'})">Send invoice</button></template></Modal>
        <Modal v-model="m.full" size="full" title="Import customers"><div class="k-demo__stack"><p>Full screen on every device. Use it for long forms and wizards.</p><div class="k-demo__row"><RingProgress :value="ring" :size="96" :stroke="8" label="Import"/><Slider v-model="ring" label="Rows processed" unit="%"/></div></div>
            <template #footer="{close}"><button type="button" class="btn primary" @click="close">Done</button></template></Modal>
        <Drawer v-model="dr.left" side="left" width="sm" title="Navigation"><ul class="k-demo__nav"><li>Dashboard</li><li>Invoices</li><li>Customers</li><li>Reports</li></ul></Drawer>
        <Drawer v-model="dr.right" title="Order #1042"><div class="k-demo__stack"><p><b>Acme Logistics d.o.o.</b><br><small>3 items, 4,820.00 EUR, paid</small></p><Alert kind="ok" compact>Delivered on 12 March.</Alert><small>Swipe right on a touch screen to close.</small></div>
            <template #footer="{close}"><button type="button" class="btn" @click="close">Close</button><button type="button" class="btn danger" @click="close(); askDelete()">Delete</button></template></Drawer>
        <ConfirmHost/><SnackHost/><UpdateBanner :watch="false" @reload="noteReload"/>
    </div>`,
};

export function registerKitOverlay(app) {
    Object.entries({Popover, MenuButton, Dropdown, ContextMenu, KMenu, Tooltip, ConfirmHost, Modal, Drawer, Alert, SnackHost, Spinner, LoadingButton, RingProgress, UpdateBanner, DemoOverlay})
        .forEach(([k, v]) => app.component(k, v));
    app.directive('tip', vTip); app.directive('trap', vTrap);
}
