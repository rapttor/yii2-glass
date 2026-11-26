// Glass kit v6, navigation, mobile and content components (see docs/GLASS-KIT.md). Register with `registerKitNav(app)`, try them in `DemoNav`.
// Styled by scss/kit/_nav.scss. No dependencies besides Vue and the global Ico / Badge / Avatar / Segmented / Holder / Card / Field.
// Note: the number stepper of v4 is already called `Stepper`, so the step indicator of this kit is registered as `Steps` (exported as `Steps` and `Stepper`).
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick, provide, inject, markRaw, Teleport, Transition, TransitionGroup } from '../vendor/vue.esm-browser.prod.js';
import { DemoNavBars } from './kit-navbars.js';
import { PATHS, toast } from './ui.js';

const ICONS = {
    back: 'M15 6l-6 6 6 6', bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z', italic: 'M10 5h7M7 19h7M14 5l-4 14', heading: 'M6 5v14M18 5v14M6 12h12',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', code: 'M9 8l-4 4 4 4M15 8l4 4-4 4',
    list: 'M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01', quote: 'M6 8h4v4c0 2-1 3-3 3M14 8h4v4c0 2-1 3-3 3', send: 'M4 12l16-8-6 16-3-7z',
    clip: 'M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7', reply: 'M10 9V5l-7 7 7 7v-4c6 0 9 2 11 6 0-6-3-12-11-12',
    edit: 'M4 20h4L19 9l-4-4L4 16z', minus: 'M5 12h14', refresh: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5', file: 'M6 3h8l5 5v13H6zM14 3v5h5', warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
};
for (const k in ICONS) if (!(k in PATHS)) PATHS[k] = ICONS[k];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = (() => { let n = 0; return p => (p || 'k') + '-' + (++n); })();
const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
const timeOf = ts => new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
function dayLabel(ts) {
    const d = new Date(ts), t = new Date(), y = new Date(Date.now() - 864e5), same = (a, b) => a.toDateString() === b.toDateString();
    return same(d, t) ? 'Today' : same(d, y) ? 'Yesterday' : d.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'});
}
export function ago(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 604800) return Math.round(s / 86400) + ' d ago';
    return new Date(ts).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'});
}

// haptic feedback: navigator.vibrate where available (Android), silent everywhere else
export function haptic(kind = 'light') {
    try {
        if (!navigator.vibrate) return false;
        return navigator.vibrate({light: 10, medium: 22, success: [12, 40, 18], error: [30, 50, 30, 50, 30]}[kind] || 10);
    } catch (e) { return false; }
}

// closes a layer on a press outside (close(false)) or on Escape (close(true) so the caller can return focus)
function useDismiss(root, open, close) {
    const down = e => { if (open.value && root.value && !root.value.contains(e.target)) close(false); };
    const key = e => { if (e.key === 'Escape' && open.value) close(true); };
    onMounted(() => { document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key); });
    onBeforeUnmount(() => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); });
}
function scrollParent(el) {
    while (el && el !== document.body) {
        if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement;
    }
    return window;
}

// ---------------------------------------------------------------------------------------------------------------- menu (used by several components)
// items: [{id, label, icon?, kind?: 'danger', disabled?}], emits pick(item)
export const KNavMenu = {
    props: {items: Array, label: {type: String, default: 'More actions'}, icon: {type: String, default: 'dots'}, up: Boolean},
    emits: ['pick'],
    setup(p, {emit}) {
        const open = ref(false), root = ref(null), list = ref(null), btn = ref(null), id = uid('k-nmenu');
        const els = () => [...(list.value ? list.value.querySelectorAll('[role=menuitem]:not(:disabled)') : [])];
        const close = back => { open.value = false; if (back && btn.value) btn.value.focus(); };
        useDismiss(root, open, close);
        async function toggle() { open.value = !open.value; if (open.value) { await nextTick(); const e = els(); if (e[0]) e[0].focus(); } }
        function key(e) {
            const a = els(), i = a.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); a[(i + 1) % a.length].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); a[(i - 1 + a.length) % a.length].focus(); }
            else if (e.key === 'Home') { e.preventDefault(); a[0].focus(); }
            else if (e.key === 'End') { e.preventDefault(); a[a.length - 1].focus(); }
            else if (e.key === 'Tab') close(false);
        }
        const pick = it => { close(true); emit('pick', it); };
        return {open, root, list, btn, id, toggle, key, pick};
    },
    template: `<span class="k-nmenu" ref="root"><button ref="btn" type="button" class="k-nmenu__b" :aria-label="label" aria-haspopup="menu" :aria-expanded="open" :aria-controls="id" @click.stop="toggle" @keydown.down.prevent="!open && toggle()"><Ico :n="icon" :s="18"/></button>
        <Transition name="k-npop"><ul v-if="open" :id="id" ref="list" class="k-npop k-nmenu__l" :class="{up}" role="menu" @keydown="key"><li v-for="it in items" :key="it.id" role="none"><button type="button" role="menuitem" class="k-nmenu__i" :class="it.kind" :disabled="it.disabled" @click="pick(it)"><Ico v-if="it.icon" :n="it.icon" :s="16"/>{{ it.label }}</button></li></ul></Transition></span>`,
};

// ---------------------------------------------------------------------------------------------------------------- breadcrumbs
// items: [{label, href?, icon?}], the last one is the current page. Narrow: first item, "..." menu with the middle ones, last item.
export const Breadcrumbs = {
    components: {KNavMenu},
    props: {items: Array, collapseAt: {type: Number, default: 480}, minItems: {type: Number, default: 4}},
    emits: ['navigate'],
    setup(p, {emit}) {
        const el = ref(null), w = ref(9999); let ro;
        const measure = () => { if (el.value) w.value = el.value.offsetWidth; };
        onMounted(() => { measure(); if (window.ResizeObserver) { ro = new ResizeObserver(measure); ro.observe(el.value); } });
        onBeforeUnmount(() => ro && ro.disconnect());
        const collapsed = computed(() => w.value < p.collapseAt && p.items.length >= p.minItems);
        const shown = computed(() => {
            const n = p.items.length, mk = (it, i) => ({it, i, cur: i === n - 1});
            if (!collapsed.value) return p.items.map(mk);
            return [mk(p.items[0], 0), {more: p.items.slice(1, -1).map((it, j) => ({id: j + 1, label: it.label, icon: it.icon}))}, mk(p.items[n - 1], n - 1)];
        });
        const go = (it, e) => { if (!it.href || it.href === '#') e.preventDefault(); emit('navigate', it); };
        const pickMore = m => emit('navigate', p.items[m.id]);
        return {el, shown, go, pickMore};
    },
    template: `<nav class="k-bc" ref="el" aria-label="Breadcrumb"><ol>
        <li v-for="(s, k) in shown" :key="k" :class="{cur: s.cur, more: s.more}"><Ico v-if="k" n="chev" :s="14" class="k-bc__sep"/>
            <KNavMenu v-if="s.more" :items="s.more" label="Show hidden levels" icon="dots" @pick="pickMore"/>
            <span v-else-if="s.cur" class="k-bc__i" aria-current="page"><Ico v-if="s.it.icon" :n="s.it.icon" :s="15"/><span>{{ s.it.label }}</span></span>
            <a v-else-if="s.it.href" class="k-bc__i" :href="s.it.href" @click="go(s.it, $event)"><Ico v-if="s.it.icon" :n="s.it.icon" :s="15"/><span>{{ s.it.label }}</span></a>
            <button v-else type="button" class="k-bc__i" @click="go(s.it, $event)"><Ico v-if="s.it.icon" :n="s.it.icon" :s="15"/><span>{{ s.it.label }}</span></button></li></ol></nav>`,
};

// ---------------------------------------------------------------------------------------------------------------- steps and wizard
// steps: [{label, sub?, error?, disabled?}], v-model = index of the current step. States: done, current, error, disabled, todo.
export const Steps = {
    props: {steps: Array, modelValue: {type: Number, default: 0}, vertical: Boolean, clickable: {type: Boolean, default: true}},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const state = (s, i) => s.error ? 'error' : s.disabled ? 'disabled' : i < p.modelValue ? 'done' : i === p.modelValue ? 'current' : 'todo';
        const go = (s, i) => { if (p.clickable && !s.disabled) emit('update:modelValue', i); };
        return {state, go};
    },
    template: `<ol class="k-steps" :class="{vertical}"><li v-for="(s, i) in steps" :key="i" class="k-step" :class="state(s, i)">
        <button type="button" class="k-step__b" :disabled="!clickable || s.disabled" :aria-current="i === modelValue ? 'step' : null" @click="go(s, i)">
            <span class="k-step__dot"><Ico v-if="state(s, i) === 'done'" n="check" :s="14"/><Ico v-else-if="state(s, i) === 'error'" n="warn" :s="14"/><template v-else>{{ i + 1 }}</template></span>
            <span class="k-step__t"><b>{{ s.label }}</b><small v-if="s.sub">{{ s.sub }}</small></span></button>
        <i v-if="i < steps.length - 1" class="k-step__bar" aria-hidden="true"></i></li></ol>`,
};
export const Stepper = Steps;

// steps: [{key, label, sub?, validate?: async (index) => true | false | 'message'}]; content comes in slots named by the step key
export const Wizard = {
    components: {Steps},
    props: {steps: Array, modelValue: {type: Number, default: 0}, finishText: {type: String, default: 'Finish'}, linear: {type: Boolean, default: true}},
    emits: ['update:modelValue', 'change', 'finish'],
    setup(p, {emit}) {
        const idx = ref(p.modelValue), dir = ref('fwd'), busy = ref(false), err = ref(''), errors = reactive({});
        const list = computed(() => p.steps.map((s, i) => ({...s, error: !!errors[i], disabled: p.linear && i > idx.value})));
        const set = i => { dir.value = i >= idx.value ? 'fwd' : 'back'; idx.value = i; err.value = ''; emit('update:modelValue', i); emit('change', i); };
        watch(() => p.modelValue, v => { if (v !== idx.value) set(v); });
        async function validate(i) {
            const f = p.steps[i].validate; if (!f) return true;
            const r = await f(i);
            if (r === undefined || r === true) { delete errors[i]; return true; }
            errors[i] = err.value = typeof r === 'string' ? r : 'Please check this step.'; return false;
        }
        async function next() {
            if (busy.value) return; busy.value = true;
            try {
                if (!(await validate(idx.value))) { haptic('error'); return; }
                if (idx.value < p.steps.length - 1) set(idx.value + 1); else { haptic('success'); emit('finish'); }
            } finally { busy.value = false; }
        }
        const goto = i => { if (i < idx.value) set(i); };
        return {idx, dir, busy, err, list, set, next, goto};
    },
    template: `<div class="k-wiz"><Steps :steps="list" :model-value="idx" @update:modelValue="goto"/>
        <div class="k-wiz__body"><Transition :name="'k-slide-' + dir" mode="out-in"><section :key="idx" class="k-wiz__pane" role="group" :aria-label="steps[idx].label"><slot :name="steps[idx].key || ('step' + idx)" :index="idx"/></section></Transition></div>
        <p v-if="err" class="k-wiz__err" role="alert"><Ico n="warn" :s="15"/>{{ err }}</p>
        <footer class="k-wiz__f"><button type="button" class="btn" :disabled="idx === 0" @click="set(idx - 1)">Back</button><button type="button" class="btn primary" :disabled="busy" @click="next">{{ idx === steps.length - 1 ? finishText : 'Next' }}</button></footer></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- tabs
// tabs: [{id, label, icon?, badge?, disabled?}], v-model = active id, panel content in slots named by id (lazy: rendered on first visit)
export const Tabs = {
    props: {tabs: Array, modelValue: String, vertical: Boolean, lazy: {type: Boolean, default: true}, label: String},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const uidv = uid('k-tabs'), cur = ref(p.modelValue ?? (p.tabs[0] && p.tabs[0].id)), seen = reactive({}), list = ref(null), fl = ref(false), fr = ref(false); let ro;
        const enabled = () => p.tabs.filter(t => !t.disabled);
        function measure() {
            const L = list.value; if (!L) return;
            const [pos, size, total] = p.vertical ? [L.scrollTop, L.clientHeight, L.scrollHeight] : [L.scrollLeft, L.clientWidth, L.scrollWidth];
            fl.value = pos > 2; fr.value = pos + size < total - 2;
        }
        function reveal() {
            const L = list.value, b = L && L.querySelector('[aria-selected=true]'); if (!b) return;
            const [o, s, pos, size] = p.vertical ? [b.offsetTop, b.offsetHeight, L.scrollTop, L.clientHeight] : [b.offsetLeft, b.offsetWidth, L.scrollLeft, L.clientWidth];
            let to = null;
            if (o < pos + 28) to = o - 28; else if (o + s > pos + size - 28) to = o + s - size + 28;
            if (to !== null) L.scrollTo(p.vertical ? {top: to, behavior: 'smooth'} : {left: to, behavior: 'smooth'});
        }
        watch(() => p.modelValue, v => { if (v != null) cur.value = v; });
        watch(cur, v => { seen[v] = true; nextTick(reveal); }, {immediate: true});
        onMounted(() => { measure(); if (window.ResizeObserver) { ro = new ResizeObserver(measure); ro.observe(list.value); } });
        onBeforeUnmount(() => ro && ro.disconnect());
        const pick = t => { if (t.disabled) return; cur.value = t.id; emit('update:modelValue', t.id); };
        function key(e) {
            const prev = p.vertical ? 'ArrowUp' : 'ArrowLeft', next = p.vertical ? 'ArrowDown' : 'ArrowRight', en = enabled(); if (!en.length) return;
            let i = en.findIndex(t => t.id === cur.value);
            if (e.key === next) i = (i + 1) % en.length; else if (e.key === prev) i = (i - 1 + en.length) % en.length;
            else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = en.length - 1; else return;
            e.preventDefault(); pick(en[i]);
            nextTick(() => { const b = list.value.querySelector('[aria-selected=true]'); if (b) b.focus(); });
        }
        return {uid: uidv, cur, seen, list, fl, fr, measure, pick, key};
    },
    template: `<div class="k-tabs" :class="{vertical}"><div class="k-tabs__wrap" :class="{fl, fr}">
        <div ref="list" class="k-tabs__list" role="tablist" :aria-orientation="vertical ? 'vertical' : 'horizontal'" :aria-label="label" @keydown="key" @scroll.passive="measure">
            <button v-for="t in tabs" :key="t.id" :id="uid + '-t-' + t.id" type="button" role="tab" class="k-tab" :class="{on: t.id === cur}" :aria-selected="t.id === cur" :aria-controls="uid + '-p-' + t.id" :tabindex="t.id === cur ? 0 : -1" :disabled="t.disabled" @click="pick(t)">
                <Ico v-if="t.icon" :n="t.icon" :s="16"/><span>{{ t.label }}</span><em v-if="t.badge != null && t.badge !== ''" class="k-tab__badge">{{ t.badge }}</em></button></div></div>
        <div class="k-tabs__panels"><div v-for="t in tabs" :key="t.id" v-show="t.id === cur" :id="uid + '-p-' + t.id" class="k-tabs__panel" role="tabpanel" tabindex="0" :aria-labelledby="uid + '-t-' + t.id"><slot v-if="!lazy || seen[t.id]" :name="t.id"/></div></div></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- fab and bottom action bar
// actions: [{id, label, icon}] makes a speed dial. hides while scrolling down (scroller: css selector or element, default the nearest scrolling parent or the window). absolute: positions inside its parent.
export const Fab = {
    props: {icon: {type: String, default: 'plus'}, label: String, actions: Array, absolute: Boolean, hideOnScroll: {type: Boolean, default: true}, scroller: null, ariaLabel: {type: String, default: 'Actions'}},
    emits: ['click', 'action'],
    setup(p, {emit}) {
        const open = ref(false), hidden = ref(false), root = ref(null), main = ref(null); let sc = null, last = 0;
        const y = () => sc === window ? window.scrollY : sc.scrollTop;
        function onScroll() {
            if (!p.hideOnScroll) return;
            const c = y();
            if (c > last + 6 && c > 48) { hidden.value = true; open.value = false; } else if (c < last - 6 || c < 48) hidden.value = false;
            last = c;
        }
        onMounted(() => {
            sc = p.scroller ? (typeof p.scroller === 'string' ? document.querySelector(p.scroller) : p.scroller) : scrollParent(root.value.parentElement);
            sc = sc || window; last = y(); sc.addEventListener('scroll', onScroll, {passive: true});
        });
        onBeforeUnmount(() => sc && sc.removeEventListener('scroll', onScroll));
        useDismiss(root, open, back => { open.value = false; if (back && main.value) main.value.focus(); });
        const press = () => { haptic('light'); if (p.actions && p.actions.length) open.value = !open.value; else emit('click'); };
        const run = a => { open.value = false; haptic('medium'); emit('action', a); if (main.value) main.value.focus(); };
        return {open, hidden, root, main, press, run};
    },
    template: `<div ref="root" class="k-fab" :class="{abs: absolute, hidden, open}" :inert="hidden ? '' : null">
        <Transition name="k-nfade"><div v-if="open" class="k-fab__bd" @click="open = false"></div></Transition>
        <TransitionGroup tag="ul" name="k-dial" class="k-fab__dial" role="menu" v-if="actions"><li v-for="(a, i) in (open ? actions : [])" :key="a.id" role="none" :style="{'--i': i}"><button type="button" role="menuitem" class="k-fab__a" @click="run(a)"><span class="k-fab__l">{{ a.label }}</span><span class="k-fab__c"><Ico :n="a.icon || 'plus'" :s="18"/></span></button></li></TransitionGroup>
        <button ref="main" type="button" class="k-fab__m" :class="{ext: label}" :aria-label="label || ariaLabel" :aria-haspopup="actions ? 'menu' : null" :aria-expanded="actions ? open : null" @click="press"><Ico :n="icon" :s="22" class="k-fab__i"/><span v-if="label" class="k-fab__t">{{ label }}</span></button></div>`,
};

// sticky action bar for forms, sits above the safe area of the phone
export const BottomActionBar = {
    props: {label: {type: String, default: 'Form actions'}},
    template: `<div class="k-bab" role="toolbar" :aria-label="label"><div class="k-bab__in"><slot/></div></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- stack navigation
// root: {component, props?, title}. Pages inside call useStack() to push({component, props, title}) / pop() / reset().
const STK = Symbol('k-stack');
export function useStack() { return inject(STK, {push() {}, pop() {}, reset() {}, depth: ref(0)}); }
export const StackNav = {
    props: {root: Object},
    emits: ['change'],
    setup(p, {emit}) {
        const pages = reactive([]), el = ref(null), drag = reactive({on: false, dx: 0, w: 1}), instant = ref(false); let n = 0;
        const mk = pg => reactive({id: ++n, title: '', props: {}, collapsed: false, ...pg, component: pg.component && markRaw(pg.component)});
        const reset = pg => { pages.splice(0, pages.length, mk(pg || p.root)); emit('change', pages.length); };
        const push = pg => { pages.push(mk(pg)); haptic('light'); emit('change', pages.length); };
        const pop = () => { if (pages.length > 1) { pages.pop(); emit('change', pages.length); } };
        provide(STK, {push, pop, reset, depth: computed(() => pages.length)});
        reset(p.root);
        let sx = 0, t0 = 0, lastX = 0, lastT = 0, v = 0;
        function down(e) { if (e.pointerType !== 'touch' || pages.length < 2) return; e.currentTarget.setPointerCapture(e.pointerId); drag.on = true; drag.dx = 0; drag.w = el.value.offsetWidth || 1; sx = lastX = e.clientX; lastT = performance.now(); v = 0; }
        function move(e) {
            if (!drag.on) return; const now = performance.now();
            v = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now; drag.dx = clamp(e.clientX - sx, 0, drag.w);
        }
        function up() {
            if (!drag.on) return; drag.on = false;
            if (drag.dx > drag.w * .35 || v > .5) {
                drag.dx = drag.w;
                setTimeout(() => { instant.value = true; pop(); drag.dx = 0; setTimeout(() => instant.value = false, 60); }, 300);
            } else drag.dx = 0;
        }
        const style = i => {
            if (!drag.dx) return null; const top = pages.length - 1;
            if (i === top) return {transform: 'translateX(' + drag.dx + 'px)'};
            if (i === top - 1) return {transform: 'translateX(' + (-28 * (1 - drag.dx / drag.w)) + '%)', opacity: .5 + .5 * drag.dx / drag.w};
            return null;
        };
        const prevTitle = i => (pages[i - 1] && pages[i - 1].title) || 'Back';
        return {pages, el, drag, instant, push, pop, reset, down, move, up, style, prevTitle};
    },
    template: `<div ref="el" class="k-stk" :class="{instant}" @keydown.esc="pop">
        <TransitionGroup name="k-stk" tag="div" class="k-stk__stage">
            <div v-for="(pg, i) in pages" :key="pg.id" class="k-stk__pg" :class="{under: i === pages.length - 2, deep: i < pages.length - 2, drag: drag.on}" :style="style(i)" :inert="i < pages.length - 1 ? '' : null" @scroll.passive="pg.collapsed = $event.target.scrollTop > 24">
                <header class="k-stk__bar" :class="{col: pg.collapsed}"><button v-if="i > 0" type="button" class="k-stk__back" @click="pop"><Ico n="back" :s="20"/><span>{{ prevTitle(i) }}</span></button><span class="k-stk__st">{{ pg.title }}</span></header>
                <h2 class="k-stk__lt">{{ pg.title }}</h2>
                <div class="k-stk__body"><component :is="pg.component" v-bind="pg.props"/></div></div></TransitionGroup>
        <div v-if="pages.length > 1" class="k-stk__edge" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"></div></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- snap sheet
// v-model = 'peek' | 'half' | 'full' (| 'closed' when dismissible). snaps: values <= 1 are a share of the container height, larger ones are pixels.
export const SnapSheet = {
    props: {modelValue: {type: String, default: 'peek'}, snaps: {type: Object, default: () => ({peek: 96, half: .5, full: .94})}, title: String, absolute: Boolean, dismissible: Boolean},
    emits: ['update:modelValue', 'close'],
    setup(p, {emit}) {
        const root = ref(null), body = ref(null), ch = ref(640), dragY = ref(null), dragging = ref(false); let y0 = 0, v0 = 0, samples = [], moved = 0, lastWheel = 0;
        const px = v => v <= 1 ? Math.round(ch.value * v) : v;
        const pts = computed(() => { const o = {}; for (const k in p.snaps) o[k] = px(p.snaps[k]); if (p.dismissible) o.closed = 0; return o; });
        const full = computed(() => Math.max(...Object.values(pts.value)));
        const order = computed(() => Object.keys(pts.value).sort((a, b) => pts.value[a] - pts.value[b]));
        const visible = computed(() => dragY.value ?? (pts.value[p.modelValue] ?? pts.value.peek));
        const measure = () => { ch.value = (p.absolute && root.value ? root.value.parentElement.clientHeight : innerHeight) || 640; };
        onMounted(() => { measure(); addEventListener('resize', measure); }); onBeforeUnmount(() => removeEventListener('resize', measure));
        const setSnap = k => { emit('update:modelValue', k); if (k === 'closed') emit('close'); };
        function start(y) { dragging.value = true; y0 = y; v0 = visible.value; moved = 0; samples = [[performance.now(), y]]; }
        function move(y) {
            if (!dragging.value) return; moved = Math.max(moved, Math.abs(y - y0));
            dragY.value = clamp(v0 - (y - y0), p.dismissible ? 0 : Math.min(...Object.values(pts.value)), full.value);
            samples.push([performance.now(), y]); if (samples.length > 8) samples.shift();
        }
        function end() {
            if (!dragging.value) return; dragging.value = false;
            const now = performance.now(), a = samples.find(s => now - s[0] < 120) || samples[0], b = samples[samples.length - 1];
            const vy = (b[1] - a[1]) / Math.max(1, b[0] - a[0]);   // px per ms, positive = moving down
            const proj = dragY.value - vy * 240; let best = order.value[0];
            for (const k of order.value) if (Math.abs(pts.value[k] - proj) < Math.abs(pts.value[best] - proj)) best = k;
            dragY.value = null; if (best !== p.modelValue) haptic('light'); setSnap(best);
        }
        const hd = e => { e.currentTarget.setPointerCapture(e.pointerId); start(e.clientY); }, hm = e => move(e.clientY);
        function cycle(d) { const i = order.value.indexOf(p.modelValue), k = order.value[clamp(i + d, 0, order.value.length - 1)]; if (k !== p.modelValue) setSnap(k); }
        const hclick = () => { if (moved < 5) cycle(p.modelValue === 'full' ? -1 : 1); };
        // content scroll hand-off: below full the content does not scroll, a drag moves the sheet; at full a downward drag from the top of the content moves the sheet
        let ty = 0, mode = 0;
        const ts = e => { ty = e.touches[0].clientY; mode = 0; };
        function tm(e) {
            if (mode === 2) return; const y = e.touches[0].clientY, dy = y - ty;
            if (mode === 1) { if (e.cancelable) e.preventDefault(); move(y); return; }
            if (Math.abs(dy) < 4) return;
            if (p.modelValue !== 'full' || (body.value.scrollTop <= 0 && dy > 0)) { mode = 1; start(y); if (e.cancelable) e.preventDefault(); } else mode = 2;
        }
        const te = () => { if (mode === 1) end(); mode = 0; };
        function wheel(e) {
            if (Date.now() - lastWheel < 450) return;
            if (e.deltaY > 8 && p.modelValue !== 'full') { lastWheel = Date.now(); cycle(1); }
            else if (e.deltaY < -8 && p.modelValue === 'full' && body.value.scrollTop <= 0) { lastWheel = Date.now(); cycle(-1); }
        }
        function key(e) {
            if (e.key === 'ArrowUp') { e.preventDefault(); cycle(1); } else if (e.key === 'ArrowDown') { e.preventDefault(); cycle(-1); }
            else if (e.key === 'Escape' && p.modelValue !== order.value[0]) { e.stopPropagation(); cycle(-1); }
        }
        return {root, body, full, visible, dragging, hd, hm, hup: end, hclick, ts, tm, te, wheel, key};
    },
    template: `<div ref="root" class="k-snap" :class="{abs: absolute, drag: dragging, full: modelValue === 'full', closed: modelValue === 'closed'}" @keydown="key">
        <Transition name="k-nfade"><div v-if="modelValue === 'full'" class="k-snap__bd" @click="$emit('update:modelValue', 'half')"></div></Transition>
        <section class="k-snap__s" role="dialog" aria-modal="false" :aria-label="title || 'Sheet'" :style="{height: full + 'px', transform: 'translateY(' + (full - visible) + 'px)'}">
            <div class="k-snap__g" @pointerdown="hd" @pointermove="hm" @pointerup="hup" @pointercancel="hup"><button type="button" class="k-snap__h" aria-label="Resize sheet" :aria-expanded="modelValue !== 'peek' && modelValue !== 'closed'" @click="hclick"><i></i></button>
                <h3 v-if="title" class="k-snap__t">{{ title }}</h3></div>
            <div ref="body" class="k-snap__b" @touchstart.passive="ts" @touchmove="tm" @touchend="te" @touchcancel="te" @wheel.passive="wheel"><slot/></div></section></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- swipe row and pull to refresh
// left / right: [{id, label, icon?, kind?: 'ok' | 'danger'}]. The first action of a side is the full-swipe action. emits action({id, side, action}).
export const SwipeRow = {
    components: {KNavMenu},
    props: {left: {type: Array, default: () => []}, right: {type: Array, default: () => []}, fullSwipe: {type: Boolean, default: true}, actionWidth: {type: Number, default: 78}},
    emits: ['action'],
    setup(p, {emit}) {
        const x = ref(0), drag = ref(false), root = ref(null), armed = ref(0); let sx = 0, sy = 0, x0 = 0, mode = 0, wasDrag = false;
        const wl = computed(() => p.left.length * p.actionWidth), wr = computed(() => p.right.length * p.actionWidth);
        const full = () => (root.value ? root.value.offsetWidth : 320);
        const all = computed(() => [...p.left.map(a => ({...a, side: 'left'})), ...p.right.map(a => ({...a, side: 'right'}))]);
        const close = () => { x.value = 0; armed.value = 0; };
        useDismiss(root, computed(() => x.value !== 0), () => close());
        function down(e) { if (e.button) return; sx = e.clientX; sy = e.clientY; x0 = x.value; mode = 0; wasDrag = false; }
        function move(e) {
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (mode === 0) {
                if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) { mode = 1; drag.value = true; e.currentTarget.setPointerCapture(e.pointerId); } else if (Math.abs(dy) > 8) mode = 2;
            }
            if (mode !== 1) return; wasDrag = true;
            x.value = clamp(x0 + dx, p.right.length ? -full() : 0, p.left.length ? full() : 0);
            const a = x.value > 0 ? (x.value > full() * .62 ? 1 : 0) : (-x.value > full() * .62 ? -1 : 0);
            if (a !== armed.value) { armed.value = a; if (a && p.fullSwipe) haptic('medium'); }
        }
        function up() {
            if (mode !== 1) return; drag.value = false; mode = 0;
            const v = x.value;
            if (armed.value && p.fullSwipe) { const side = v > 0 ? 'left' : 'right'; x.value = v > 0 ? full() : -full(); setTimeout(() => { run(p[side][0], side); close(); }, 160); return; }
            armed.value = 0;
            if (v > wl.value / 2 && wl.value) x.value = wl.value; else if (-v > wr.value / 2 && wr.value) x.value = -wr.value; else x.value = 0;
        }
        const run = (a, side) => { haptic('light'); emit('action', {id: a.id, side, action: a}); close(); };
        const swallow = e => { if (wasDrag) { e.preventDefault(); e.stopPropagation(); wasDrag = false; } };
        return {x, drag, root, armed, wl, wr, all, down, move, up, run, swallow};
    },
    template: `<div ref="root" class="k-swipe" :class="{open: x !== 0, drag}">
        <div v-if="left.length" class="k-swipe__act left" :style="{width: Math.max(x, wl) + 'px'}" :inert="x > 0 ? null : ''"><button v-for="a in left" :key="a.id" type="button" class="k-swipe__a" :class="[a.kind, {first: a === left[0]}]" :style="{minWidth: actionWidth + 'px'}" @click="run(a, 'left')"><Ico :n="a.icon || 'check'" :s="20"/><span>{{ a.label }}</span></button></div>
        <div v-if="right.length" class="k-swipe__act right" :style="{width: Math.max(-x, wr) + 'px'}" :inert="x < 0 ? null : ''"><button v-for="a in right" :key="a.id" type="button" class="k-swipe__a" :class="[a.kind, {first: a === right[0]}]" :style="{minWidth: actionWidth + 'px'}" @click="run(a, 'right')"><Ico :n="a.icon || 'check'" :s="20"/><span>{{ a.label }}</span></button></div>
        <div class="k-swipe__c" :style="{transform: 'translateX(' + x + 'px)'}" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @click.capture="swallow"><div class="k-swipe__in"><slot/></div>
            <KNavMenu v-if="all.length" :items="all" label="Row actions" @pick="a => run(a, a.side)"/></div></div>`,
};

// wrapper with its own scroller. emits refresh(wait): call wait(promise) to keep the spinner until it settles (or pass a `handler` prop that returns a promise).
export const PullRefresh = {
    props: {handler: Function, threshold: {type: Number, default: 64}, height: {type: String, default: '320px'}},
    emits: ['refresh'],
    setup(p, {emit}) {
        const y = ref(0), state = ref('idle'), pulling = ref(false), root = ref(null); let y0 = 0, active = false;
        const resist = d => 110 * (1 - Math.exp(-d / 190));
        const ts = e => { if (state.value === 'idle' && root.value.scrollTop <= 0) { active = true; y0 = e.touches[0].clientY; } };
        function tm(e) {
            if (!active) return; const dy = e.touches[0].clientY - y0;
            if (dy <= 0 || root.value.scrollTop > 0) { if (pulling.value) { y.value = 0; pulling.value = false; } return; }
            if (e.cancelable) e.preventDefault(); pulling.value = true; y.value = resist(dy); state.value = y.value >= p.threshold * .8 ? 'ready' : 'pull';
        }
        function te() { active = false; pulling.value = false; if (state.value === 'ready') refresh(); else { y.value = 0; state.value = 'idle'; } }
        async function refresh() {
            if (state.value === 'loading') return; state.value = 'loading'; y.value = 52; let pr; haptic('light');
            emit('refresh', pr2 => { pr = pr2; }); if (p.handler) pr = p.handler();
            await Promise.all([Promise.resolve(pr).catch(() => {}), new Promise(r => setTimeout(r, 550))]);
            state.value = 'done'; haptic('success'); await new Promise(r => setTimeout(r, 450)); y.value = 0; state.value = 'idle';
        }
        return {y, state, pulling, root, ts, tm, te, refresh};
    },
    template: `<div ref="root" class="k-pr" :style="{height}" @touchstart.passive="ts" @touchmove="tm" @touchend="te" @touchcancel="te">
        <button type="button" class="k-pr__kb" @click="refresh">Refresh</button>
        <div class="k-pr__ind" :class="{pulling}" :style="{height: y + 'px'}" role="status" aria-live="polite"><span class="k-pr__sp" :class="state" :style="state === 'loading' ? null : {transform: 'rotate(' + y * 3 + 'deg)', opacity: Math.min(1, y / 40)}"><Ico :n="state === 'done' ? 'check' : 'refresh'" :s="20"/></span><span class="k-sr">{{ state === 'loading' ? 'Refreshing' : state === 'done' ? 'Updated' : '' }}</span></div>
        <slot/></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- avatar group, gallery, lightbox
// people: [{name}]; shows `max` avatars, then +n. Every avatar has the name as tooltip, the +n chip lists the hidden names.
export const AvatarGroup = {
    props: {people: Array, max: {type: Number, default: 4}, size: {type: Number, default: 32}},
    setup(p) {
        const shown = computed(() => p.people.slice(0, p.max)), rest = computed(() => p.people.slice(p.max));
        return {shown, rest, names: computed(() => rest.value.map(x => x.name).join(', '))};
    },
    template: `<span class="k-avg" role="group" :aria-label="people.map(x => x.name).join(', ')">
        <span v-for="(x, i) in shown" :key="x.name + i" class="k-avg__i" :title="x.name" :style="{zIndex: shown.length - i}"><Avatar :name="x.name" :size="size"/></span>
        <span v-if="rest.length" class="k-avg__more" :title="names" :style="{width: size + 'px', height: size + 'px', fontSize: size * .34 + 'px'}">+{{ rest.length }}</span></span>`,
};

// images: [{src, thumb?, alt?, caption?}], v-model = index (-1 closed). Arrows, swipe, pinch or double-tap zoom, Escape closes, focus stays inside.
export const Lightbox = {
    props: {images: Array, modelValue: {type: Number, default: -1}},
    emits: ['update:modelValue', 'close'],
    setup(p, {emit}) {
        const z = reactive({s: 1, x: 0, y: 0, sx: 0}), box = ref(null), stage = ref(null), pts = new Map();
        let d0 = 0, s0 = 1, lastTap = 0, tapMoved = 0, prevFocus = null, x0 = 0;
        const open = computed(() => p.modelValue >= 0), cur = computed(() => p.images[p.modelValue]);
        const reset = () => { z.s = 1; z.x = z.y = z.sx = 0; };
        const go = d => { const n = p.images.length; if (n < 2) return; emit('update:modelValue', (p.modelValue + d + n) % n); reset(); };
        const close = () => { emit('update:modelValue', -1); emit('close'); };
        const zoom = s => { z.s = clamp(s, 1, 5); if (z.s === 1) z.x = z.y = 0; };
        watch(open, async o => {
            document.documentElement.classList.toggle('v4-lock', o);
            if (o) { prevFocus = document.activeElement; reset(); await nextTick(); if (box.value) box.value.focus(); } else if (prevFocus && prevFocus.focus) prevFocus.focus();
        });
        onBeforeUnmount(() => document.documentElement.classList.remove('v4-lock'));
        function key(e) {
            if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === '+' || e.key === '=') zoom(z.s + .5); else if (e.key === '-') zoom(z.s - .5);
            else if (e.key === 'Tab') {
                const f = [...box.value.querySelectorAll('button')].filter(b => !b.disabled); if (!f.length) return;
                const i = f.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
            }
        }
        const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
        function down(e) {
            stage.value.setPointerCapture(e.pointerId); pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
            if (pts.size === 2) { d0 = dist(); s0 = z.s; } else { x0 = e.clientX; tapMoved = 0; }
        }
        function move(e) {
            const o = pts.get(e.pointerId); if (!o) return; const dx = e.clientX - o.x, dy = e.clientY - o.y; o.x = e.clientX; o.y = e.clientY;
            if (pts.size === 2) { z.s = clamp(s0 * dist() / d0, 1, 5); tapMoved = 99; return; }
            tapMoved += Math.abs(dx) + Math.abs(dy);
            if (z.s > 1) { z.x += dx; z.y += dy; } else z.sx = e.clientX - x0;
        }
        function up(e) {
            if (!pts.delete(e.pointerId)) return;
            if (pts.size) { x0 = [...pts.values()][0].x; return; }
            if (z.s === 1 && Math.abs(z.sx) > 60) { const d = z.sx < 0 ? 1 : -1; z.sx = 0; go(d); return; }
            z.sx = 0;
            if (tapMoved < 8) {
                const t = Date.now();
                if (t - lastTap < 300) { zoom(z.s > 1 ? 1 : 2.5); lastTap = 0; } else lastTap = t;
            }
            if (z.s < 1.05) reset();
        }
        const wheel = e => zoom(z.s - e.deltaY * .004);
        const style = computed(() => ({transform: 'translate(' + (z.x + z.sx) + 'px,' + z.y + 'px) scale(' + z.s + ')'}));
        return {open, cur, box, stage, z, style, go, close, zoom, key, down, move, up, wheel};
    },
    template: `<Teleport to=".v4"><Transition name="k-nfade"><div v-if="open" ref="box" class="k-lb" role="dialog" aria-modal="true" aria-label="Image viewer" tabindex="-1" @keydown="key">
        <header class="k-lb__h"><span>{{ modelValue + 1 }} / {{ images.length }}</span><span><button type="button" class="k-lb__b" aria-label="Zoom in" @click="zoom(z.s + .75)"><Ico n="plus" :s="18"/></button><button type="button" class="k-lb__b" aria-label="Zoom out" @click="zoom(z.s - .75)"><Ico n="minus" :s="18"/></button><button type="button" class="k-lb__b" aria-label="Close" @click="close"><Ico n="x" :s="18"/></button></span></header>
        <div ref="stage" class="k-lb__st" :class="{zoomed: z.s > 1}" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel.prevent="wheel"><img :src="cur.src" :alt="cur.alt || cur.caption || ''" draggable="false" :style="style"></div>
        <button v-if="images.length > 1" type="button" class="k-lb__n prev" aria-label="Previous image" @click="go(-1)"><Ico n="back" :s="22"/></button><button v-if="images.length > 1" type="button" class="k-lb__n next" aria-label="Next image" @click="go(1)"><Ico n="chev" :s="22"/></button>
        <p v-if="cur.caption" class="k-lb__c">{{ cur.caption }}</p></div></Transition></Teleport>`,
};

export const ImageGallery = {
    components: {Lightbox},
    props: {images: Array, cols: {type: Number, default: 3}},
    emits: ['open'],
    setup(p, {emit}) { const idx = ref(-1); return {idx, show: i => { idx.value = i; emit('open', i); }}; },
    template: `<div class="k-gal"><ul class="k-gal__g" :style="{'--cols': cols}"><li v-for="(im, i) in images" :key="i"><button type="button" class="k-gal__t" :aria-label="'Open image ' + (i + 1) + (im.caption ? ': ' + im.caption : '')" @click="show(i)"><img :src="im.thumb || im.src" :alt="im.alt || im.caption || ''" loading="lazy" draggable="false"><span v-if="im.caption">{{ im.caption }}</span></button></li></ul>
        <Lightbox v-model="idx" :images="images"/></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- chat
// messages: [{id, own?, author, text, at (ms), attachments?: [{name, size}]}], typing = name of who types. emits send({text, attachments}).
export const ChatThread = {
    props: {messages: Array, typing: String, placeholder: {type: String, default: 'Write a message'}, height: {type: String, default: '420px'}},
    emits: ['send', 'attach'],
    setup(p, {emit}) {
        const sc = ref(null), ta = ref(null), fileIn = ref(null), draft = ref(''), pending = reactive([]), unseen = ref(0), stick = ref(true);
        const items = computed(() => {
            let day = ''; const out = [];
            p.messages.forEach((m, i) => {
                const d = dayLabel(m.at), prev = p.messages[i - 1];
                if (d !== day) { day = d; out.push({sep: true, id: 'd' + m.at, label: d}); }
                out.push({...m, first: !prev || !!prev.own !== !!m.own || prev.author !== m.author || dayLabel(prev.at) !== d});
            });
            return out;
        });
        const toBottom = (smooth = true) => { const e = sc.value; if (e) e.scrollTo({top: e.scrollHeight, behavior: smooth ? 'smooth' : 'auto'}); unseen.value = 0; };
        const onScroll = () => { const e = sc.value; stick.value = e.scrollHeight - e.scrollTop - e.clientHeight < 80; if (stick.value) unseen.value = 0; };
        watch(() => p.messages.length, async (n, o) => {
            const last = p.messages[n - 1]; await nextTick();
            if (stick.value || (last && last.own)) toBottom(); else if (n > o) unseen.value += n - o;
        });
        watch(() => p.typing, async () => { await nextTick(); if (stick.value) toBottom(); });
        onMounted(() => toBottom(false));
        const fit = () => { const e = ta.value; e.style.height = 'auto'; e.style.height = Math.min(e.scrollHeight, 140) + 'px'; };
        function send() {
            const text = draft.value.trim(); if (!text && !pending.length) return;
            emit('send', {text, attachments: pending.map(a => ({...a}))}); draft.value = ''; pending.splice(0); stick.value = true; haptic('light');
            nextTick(() => { fit(); toBottom(); });
        }
        const key = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } };
        function files(e) { const f = [...e.target.files]; f.forEach(x => pending.push({name: x.name, size: x.size})); emit('attach', f); e.target.value = ''; }
        return {sc, ta, fileIn, draft, pending, unseen, items, toBottom, onScroll, fit, send, key, files, timeOf, fmtSize};
    },
    template: `<div class="k-chat" :style="{height}"><div class="k-chat__s" ref="sc" role="log" aria-live="polite" aria-label="Conversation" tabindex="0" @scroll.passive="onScroll">
        <template v-for="m in items" :key="m.id"><div v-if="m.sep" class="k-chat__d"><span>{{ m.label }}</span></div>
            <div v-else class="k-msg" :class="{own: m.own, first: m.first}"><Avatar v-if="!m.own && m.first" :name="m.author" :size="30"/><span v-else-if="!m.own" class="k-msg__sp"></span>
                <div class="k-msg__b"><small v-if="!m.own && m.first" class="k-msg__a">{{ m.author }}</small><p v-if="m.text">{{ m.text }}</p>
                    <ul v-if="m.attachments && m.attachments.length" class="k-chat__att"><li v-for="a in m.attachments" :key="a.name" class="k-fchip"><Ico n="file" :s="14"/>{{ a.name }}<small>{{ fmtSize(a.size) }}</small></li></ul><time :datetime="new Date(m.at).toISOString()">{{ timeOf(m.at) }}</time></div></div></template>
        <div v-if="typing" class="k-msg typing"><span class="k-msg__sp"></span><div class="k-msg__b" role="status"><span class="k-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="k-sr">{{ typing }} is typing</span></div></div></div>
        <Transition name="k-nfade"><button v-if="unseen" type="button" class="k-chat__pill" @click="toBottom()">{{ unseen }} new message{{ unseen > 1 ? 's' : '' }}<Ico n="down" :s="14"/></button></Transition>
        <form class="k-chat__f" @submit.prevent="send"><ul v-if="pending.length" class="k-chat__att"><li v-for="(a, i) in pending" :key="a.name + i" class="k-fchip"><Ico n="file" :s="14"/>{{ a.name }}<button type="button" :aria-label="'Remove ' + a.name" @click="pending.splice(i, 1)"><Ico n="x" :s="12"/></button></li></ul>
            <div class="k-chat__row"><input ref="fileIn" type="file" multiple hidden @change="files"><button type="button" class="k-nib" aria-label="Attach a file" @click="fileIn.click()"><Ico n="clip" :s="19"/></button>
                <textarea ref="ta" v-model="draft" rows="1" :placeholder="placeholder" :aria-label="placeholder" @input="fit" @keydown="key"></textarea>
                <button type="submit" class="k-nib send" aria-label="Send" :disabled="!draft.trim() && !pending.length"><Ico n="send" :s="19"/></button></div></form></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- comments
// comments: [{id, author, text, at, edited?, reactions?: [{e, n, mine}], replies?: [...]}]; the parent changes the data on the events
// emits: react({id, emoji}), reply({parentId, text}), edit({id, text}), remove({id})
const CMT = Symbol('k-cmt');
const EMOJI = ['\u{1F44D}', '❤️', '\u{1F389}', '\u{1F440}'];
export const KCommentItem = {
    name: 'KCommentItem',
    components: {KNavMenu},
    props: {c: Object, depth: {type: Number, default: 0}},
    setup(p) {
        const ctx = inject(CMT), editing = ref(false), replying = ref(false), draft = ref(''), rdraft = ref('');
        const menu = [{id: 'edit', label: 'Edit', icon: 'edit'}, {id: 'del', label: 'Delete', icon: 'trash', kind: 'danger'}];
        const act = it => { if (it.id === 'edit') { draft.value = p.c.text; editing.value = true; } else ctx.emit('remove', {id: p.c.id}); };
        const save = () => { const t = draft.value.trim(); if (!t) return; ctx.emit('edit', {id: p.c.id, text: t}); editing.value = false; };
        const sendReply = () => { const t = rdraft.value.trim(); if (!t) return; ctx.emit('reply', {parentId: p.c.id, text: t}); rdraft.value = ''; replying.value = false; };
        const emojis = EMOJI.map(e => ({id: e, label: e}));
        return {ctx, editing, replying, draft, rdraft, menu, act, save, sendReply, emojis, ago, haptic};
    },
    template: `<li class="k-cmt" :class="{reply: depth > 0}"><Avatar :name="c.author" :size="depth ? 26 : 34"/>
        <div class="k-cmt__m"><header><b>{{ c.author }}</b><time :datetime="new Date(c.at).toISOString()" :title="new Date(c.at).toLocaleString()">{{ ago(c.at) }}</time><small v-if="c.edited">edited</small><KNavMenu v-if="c.author === ctx.me" :items="menu" label="Comment actions" @pick="act"/></header>
            <p v-if="!editing" class="k-cmt__t">{{ c.text }}</p>
            <div v-else class="k-cmt__edit"><textarea v-model="draft" rows="2" aria-label="Edit comment" @keydown.esc.stop="editing = false" @keydown.ctrl.enter="save" @keydown.meta.enter="save"></textarea><span><button type="button" class="btn primary sm" @click="save">Save</button><button type="button" class="btn sm" @click="editing = false">Cancel</button></span></div>
            <footer><button v-for="r in c.reactions || []" :key="r.e" type="button" class="k-react" :class="{on: r.mine}" :aria-pressed="r.mine" @click="ctx.emit('react', {id: c.id, emoji: r.e}); haptic('light')">{{ r.e }} <b>{{ r.n }}</b></button>
                <KNavMenu :items="emojis" icon="plus" label="Add reaction" @pick="e => ctx.emit('react', {id: c.id, emoji: e.id})"/><button type="button" class="k-cmt__rb" :aria-expanded="replying" @click="replying = !replying"><Ico n="reply" :s="14"/>Reply</button></footer>
            <form v-if="replying" class="k-cmt__edit" @submit.prevent="sendReply"><textarea v-model="rdraft" rows="2" :aria-label="'Reply to ' + c.author" placeholder="Write a reply" @keydown.esc.stop="replying = false"></textarea><span><button type="submit" class="btn primary sm" :disabled="!rdraft.trim()">Reply</button><button type="button" class="btn sm" @click="replying = false">Cancel</button></span></form>
            <ul v-if="c.replies && c.replies.length" class="k-cmt__r"><KCommentItem v-for="r in c.replies" :key="r.id" :c="r" :depth="depth + 1"/></ul></div></li>`,
};
export const CommentThread = {
    components: {KCommentItem},
    props: {comments: Array, me: String},
    emits: ['react', 'reply', 'edit', 'remove'],
    setup(p, {emit}) { provide(CMT, {get me() { return p.me; }, emit}); },
    template: `<ul class="k-cmts" aria-label="Comments"><KCommentItem v-for="c in comments" :key="c.id" :c="c"/></ul>`,
};

// ---------------------------------------------------------------------------------------------------------------- markdown
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const emph = s => s
    .replace(/\*\*([^\s*](?:.*?[^\s*])?)\*\*/g, '<strong>$1</strong>').replace(/__([^\s_](?:.*?[^\s_])?)__/g, '<strong>$1</strong>')
    .replace(/~~([^\s~](?:.*?[^\s~])?)~~/g, '<del>$1</del>')
    .replace(/(^|[^*\w])\*([^\s*](?:.*?[^\s*])?)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^\s_](?:.*?[^\s_])?)_(?![_\w])/g, '$1<em>$2</em>');
function inline(src) {
    const stash = [], put = h => '\u0001' + (stash.push(h) - 1) + '\u0001';
    let s = String(src).replace(/[\u0000-\u0008]/g, '');
    s = s.replace(/`([^`\n]+)`/g, (_, c) => put('<code>' + esc(c) + '</code>'));
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => /^(https?:\/\/|mailto:|\/|#)/i.test(u) ? put('<a href="' + u + '" target="_blank" rel="noopener noreferrer nofollow">' + emph(t) + '</a>') : t);
    s = emph(s);
    for (let i = 0; i < 3; i++) s = s.replace(/\u0001(\d+)\u0001/g, (_, n) => stash[n]);
    return s;
}
function parseList(L, i) {
    const re = /^(\s*)([-*+]|\d+\.)\s+(.*)$/, m0 = L[i].match(re), base = m0[1].length, tag = /\d/.test(m0[2]) ? 'ol' : 'ul'; let out = '';
    while (i < L.length) {
        const m = L[i].match(re); if (!m || m[1].length < base) break;
        if (m[1].length > base) { const [h, ni] = parseList(L, i); out = out.replace(/<\/li>$/, h + '</li>'); i = ni; continue; }
        out += '<li>' + inline(m[3]) + '</li>'; i++;
    }
    return ['<' + tag + '>' + out + '</' + tag + '>', i];
}
// Small safe renderer: everything is escaped first, only the tags built here are emitted (no raw HTML passthrough, links only http(s), mailto, relative and #).
export function renderMarkdown(src = '') {
    const L = String(src).replace(/\r\n?/g, '\n').split('\n'), para = []; let out = '', i = 0, m;
    const flush = () => { if (para.length) { out += '<p>' + inline(para.join(' ')) + '</p>'; para.length = 0; } };
    const cells = s => s.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    while (i < L.length) {
        const ln = L[i];
        if ((m = ln.match(/^\s*(```+|~~~+)\s*([\w-]*)/))) {
            flush(); const buf = []; i++;
            while (i < L.length && !L[i].trim().startsWith(m[1])) buf.push(L[i++]);
            i++; out += '<pre><code' + (m[2] ? ' class="lang-' + esc(m[2]) + '"' : '') + '>' + esc(buf.join('\n')) + '</code></pre>'; continue;
        }
        if (!ln.trim()) { flush(); i++; continue; }
        if ((m = ln.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) { flush(); out += '<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'; i++; continue; }
        if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(ln)) { flush(); out += '<hr>'; i++; continue; }
        if (/^\s*>/.test(ln)) { flush(); const buf = []; while (i < L.length && /^\s*>/.test(L[i])) buf.push(L[i++].replace(/^\s*>\s?/, '')); out += '<blockquote>' + renderMarkdown(buf.join('\n')) + '</blockquote>'; continue; }
        if (/^\s*([-*+]|\d+\.)\s+/.test(ln)) { flush(); const [h, ni] = parseList(L, i); out += h; i = ni; continue; }
        if (ln.includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(L[i + 1] || '')) {
            flush(); const head = cells(ln), al = cells(L[i + 1]).map(c => /^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : /^:-+/.test(c) ? 'left' : ''), rows = []; i += 2;
            while (i < L.length && L[i].trim() && L[i].includes('|')) rows.push(cells(L[i++]));
            const td = (t, c, j) => '<' + t + (al[j] ? ' style="text-align:' + al[j] + '"' : '') + '>' + inline(c || '') + '</' + t + '>';
            out += '<div class="k-md__tw"><table><thead><tr>' + head.map((c, j) => td('th', c, j)).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + head.map((_, j) => td('td', r[j], j)).join('') + '</tr>').join('') + '</tbody></table></div>'; continue;
        }
        para.push(ln.trim()); i++;
    }
    flush(); return out;
}
export const MarkdownView = {
    props: {source: String},
    setup: p => ({html: computed(() => renderMarkdown(p.source || ''))}),
    template: `<div class="k-md" v-html="html"></div>`,
};

// v-model = markdown text. Toolbar, shortcuts Ctrl/Cmd + B, I, K. Split preview on wide screens, Write / Preview tabs on phones.
export const MarkdownEditor = {
    components: {MarkdownView},
    props: {modelValue: {type: String, default: ''}, rows: {type: Number, default: 10}, placeholder: {type: String, default: 'Write in Markdown'}},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const ta = ref(null), narrow = ref(false), tab = ref('write'); let mq;
        const sync = () => { narrow.value = mq.matches; };
        onMounted(() => { mq = matchMedia('(max-width: 640px)'); sync(); mq.addEventListener('change', sync); });
        onBeforeUnmount(() => mq && mq.removeEventListener('change', sync));
        function edit(fn) {
            const el = ta.value, r = fn(el.value, el.selectionStart, el.selectionEnd); emit('update:modelValue', r.value);
            nextTick(() => { el.focus(); el.setSelectionRange(r.s, r.e); });
        }
        const wrap = (a, b, ph) => (v, s, e) => { const sel = v.slice(s, e) || ph; return {value: v.slice(0, s) + a + sel + b + v.slice(e), s: s + a.length, e: s + a.length + sel.length}; };
        const line = prefix => (v, s, e) => {
            const st = v.lastIndexOf('\n', s - 1) + 1, nl = v.indexOf('\n', e), en = nl < 0 ? v.length : nl, ls = v.slice(st, en).split('\n');
            const on = ls.every(l => l.startsWith(prefix)), res = ls.map(l => on ? l.slice(prefix.length) : prefix + l).join('\n');
            return {value: v.slice(0, st) + res + v.slice(en), s: st, e: st + res.length};
        };
        const link = (v, s, e) => { const t = v.slice(s, e) || 'link text', ins = '[' + t + '](https://)'; return {value: v.slice(0, s) + ins + v.slice(e), s: s + t.length + 3, e: s + ins.length - 1}; };
        const code = (v, s, e) => v.slice(s, e).includes('\n') ? wrap('```\n', '\n```', '')(v, s, e) : wrap('`', '`', 'code')(v, s, e);
        const tools = [
            {id: 'bold', icon: 'bold', label: 'Bold (Ctrl+B)', fn: wrap('**', '**', 'bold text')}, {id: 'italic', icon: 'italic', label: 'Italic (Ctrl+I)', fn: wrap('*', '*', 'italic text')},
            {id: 'heading', icon: 'heading', label: 'Heading', fn: line('## ')}, {id: 'quote', icon: 'quote', label: 'Quote', fn: line('> ')}, {id: 'list', icon: 'list', label: 'List', fn: line('- ')},
            {id: 'code', icon: 'code', label: 'Code', fn: code}, {id: 'link', icon: 'link', label: 'Link (Ctrl+K)', fn: link},
        ];
        function key(e) {
            if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
            const t = {b: 'bold', i: 'italic', k: 'link'}[e.key.toLowerCase()]; if (!t) return;
            e.preventDefault(); edit(tools.find(x => x.id === t).fn);
        }
        const tbkey = e => {
            const b = [...e.currentTarget.querySelectorAll('button')], i = b.indexOf(document.activeElement);
            if (e.key === 'ArrowRight') { e.preventDefault(); b[(i + 1) % b.length].focus(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); b[(i - 1 + b.length) % b.length].focus(); }
        };
        return {ta, narrow, tab, tools, edit, key, tbkey};
    },
    template: `<div class="k-mde" :class="{narrow}"><div class="k-mde__bar"><div class="k-mde__tb" role="toolbar" aria-label="Formatting" @keydown="tbkey"><button v-for="t in tools" :key="t.id" type="button" class="k-nib" :title="t.label" :aria-label="t.label" :disabled="narrow && tab === 'preview'" @mousedown.prevent @click="edit(t.fn)"><Ico :n="t.icon" :s="17"/></button></div>
        <Segmented v-if="narrow" v-model="tab" :options="[{v: 'write', l: 'Write'}, {v: 'preview', l: 'Preview'}]"/></div>
        <div class="k-mde__cols"><textarea v-show="!narrow || tab === 'write'" ref="ta" class="k-mde__ta" :rows="rows" :value="modelValue" :placeholder="placeholder" aria-label="Markdown text" @input="$emit('update:modelValue', $event.target.value)" @keydown="key"></textarea>
            <div v-show="!narrow || tab === 'preview'" class="k-mde__pv" aria-label="Preview"><MarkdownView :source="modelValue"/><p v-if="!modelValue.trim()" class="k-mde__ph">Nothing to preview yet.</p></div></div></div>`,
};

// ---------------------------------------------------------------------------------------------------------------- demo
const photo = (h, label) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + h + ' 70% 55%)"/><stop offset="1" stop-color="hsl(' + (h + 50) + ' 65% 28%)"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="900" cy="240" r="110" fill="#fff" fill-opacity=".25"/><path d="M0 800V570l240-170 220 150 260-220 480 260v210z" fill="#000" fill-opacity=".25"/><text x="60" y="110" font-family="sans-serif" font-size="54" font-weight="700" fill="#fff">' + label + '</text></svg>');
const FENCE = '`'.repeat(3);

const DemoOrders = {
    setup() {
        const st = useStack();
        const orders = [{n: 10482, c: 'Northwind Trading', t: '4,280.00 EUR', s: 'Paid'}, {n: 10481, c: 'Blue Harbor Logistics', t: '1,915.50 EUR', s: 'Open'}, {n: 10479, c: 'Kuhn & Sons', t: '312.90 EUR', s: 'Overdue'}];
        const open = o => st.push({title: 'Order #' + o.n, component: DemoOrder, props: {o}});
        return {orders, open};
    },
    template: `<ul class="k-ndemo-list"><li v-for="o in orders" :key="o.n"><button type="button" @click="open(o)"><span><b>#{{ o.n }} {{ o.c }}</b><small>{{ o.t }}</small></span><Badge :kind="o.s === 'Paid' ? 'g' : o.s === 'Open' ? 'b' : 'r'">{{ o.s }}</Badge><Ico n="chev" :s="16"/></button></li></ul>`,
};
const DemoOrder = {
    props: {o: Object},
    setup() { const st = useStack(); return {st, lines: () => st.push({title: 'Line items', component: DemoLines})}; },
    template: `<div class="k-ndemo-pad"><p><b>{{ o.c }}</b></p><p><small>Total {{ o.t }}, status {{ o.s }}. Delivery to Zagreb, invoice sent by email.</small></p><button type="button" class="btn" @click="lines">Show line items</button>
        <p v-for="i in 14" :key="i"><small>Internal note {{ i }}: confirmed with the customer by phone, payment terms 14 days.</small></p></div>`,
};
const DemoLines = {
    template: `<div class="k-ndemo-pad"><p v-for="(l, i) in ['Conference table, oak', 'Ergonomic chair x6', 'Installation and delivery', 'Extended warranty 3 years']" :key="i"><b>{{ i + 1 }}.</b> {{ l }}</p><p><small>Swipe from the left edge or press Back to return.</small></p></div>`,
};

export const DemoNav = {
    components: {DemoNavBars, DemoOrders},
    setup() {
        const now = Date.now(), min = 60000;
        const crumbs = [{label: 'Home', icon: 'home', href: '#'}, {label: 'Sales', href: '#'}, {label: 'Orders', href: '#'}, {label: 'Northwind Trading', href: '#'}, {label: 'Order #10482'}];
        const crumbLast = ref('');
        const flow = [{label: 'Cart', sub: '3 items'}, {label: 'Shipping', sub: 'Zagreb'}, {label: 'Payment', error: true, sub: 'Card declined'}, {label: 'Review'}, {label: 'Done', disabled: true}];
        const flowIdx = ref(1);
        const form = reactive({company: '', vat: 'HR12345678901', email: '', plan: 'Business'}), finished = ref(false);
        const wsteps = [
            {key: 'company', label: 'Company', sub: 'Who is the customer', validate: async () => form.company.trim().length > 1 || 'Enter the company name.'},
            {key: 'billing', label: 'Billing', sub: 'VAT and invoices', validate: async () => /@/.test(form.email) || 'Enter a valid invoice email.'},
            {key: 'review', label: 'Review'},
        ];
        const tabs = [{id: 'overview', label: 'Overview', icon: 'home'}, {id: 'orders', label: 'Orders', badge: 12}, {id: 'invoices', label: 'Invoices', badge: 3}, {id: 'tickets', label: 'Support tickets', badge: 'new'},
            {id: 'contacts', label: 'Contacts', icon: 'users'}, {id: 'files', label: 'Files'}, {id: 'notes', label: 'Notes'}, {id: 'audit', label: 'Audit log', disabled: true}, {id: 'billing', label: 'Billing plan'}];
        const tab = ref('overview'), vtab = ref('general');
        const vtabs = [{id: 'general', label: 'General'}, {id: 'team', label: 'Team', badge: 4}, {id: 'security', label: 'Security'}];
        const dial = [{id: 'order', label: 'New order', icon: 'bag'}, {id: 'customer', label: 'New customer', icon: 'users'}, {id: 'invoice', label: 'New invoice', icon: 'doc'}];
        const last = ref('');
        const snap = ref('peek');
        const swipes = ref([{id: 1, t: 'Invoice 2026-0412 paid', s: 'Northwind Trading, 4,280.00 EUR'}, {id: 2, t: 'Quote 118 waiting for approval', s: 'Blue Harbor Logistics'}, {id: 3, t: 'Reminder: contract renewal', s: 'Kuhn & Sons, ends 31 Dec'}]);
        const swiped = ref('');
        const onSwipe = (row, e) => { swiped.value = e.action.label + ' on "' + row.t + '"'; if (e.id === 'del') swipes.value = swipes.value.filter(r => r !== row); };
        const feed = ref(['Order #10482 shipped', 'Payment received from Northwind', 'New customer: Alpine Foods']);
        const refreshed = ref(0);
        const reload = wait => wait(new Promise(r => setTimeout(() => { feed.value = ['Ticket #771 resolved', ...feed.value]; refreshed.value++; r(); }, 900)));
        const people = ['Ana Horvat', 'Marko Petrovic', 'Lena Schmidt', 'Ivo Kovac', 'Sara Novak', 'Tomas Berg', 'Mia Jovanovic'].map(name => ({name}));
        const images = [photo(210, 'Warehouse A'), photo(15, 'Loading dock'), photo(140, 'Showroom'), photo(280, 'Office floor'), photo(60, 'Packaging'), photo(330, 'Delivery van')]
            .map((src, i) => ({src, caption: ['Warehouse A, shelf row 4', 'Loading dock before the audit', 'New showroom layout', 'Open office, second floor', 'Packaging line', 'Delivery van 07'][i]}));
        const msgs = ref([
            {id: 1, author: 'Ana Horvat', text: 'Hi, did the pallet for order 10482 leave today?', at: now - 26 * 3600e3},
            {id: 2, own: true, author: 'Me', text: 'Yes, the carrier picked it up at 14:10. Tracking is in the order.', at: now - 25 * 3600e3},
            {id: 3, author: 'Ana Horvat', text: 'Great. Can you send the delivery note as well?', at: now - 30 * min},
            {id: 4, own: true, author: 'Me', text: 'Sending it now.', at: now - 28 * min, attachments: [{name: 'delivery-note-10482.pdf', size: 184320}]},
        ]);
        const typing = ref(''); let nid = 10;
        const send = m => {
            msgs.value.push({id: ++nid, own: true, author: 'Me', text: m.text, at: Date.now(), attachments: m.attachments}); typing.value = 'Ana';
            setTimeout(() => { typing.value = ''; msgs.value.push({id: ++nid, author: 'Ana Horvat', text: 'Thanks, received.', at: Date.now()}); }, 1800);
        };
        const fake = () => { msgs.value.push({id: ++nid, author: 'Ana Horvat', text: 'One more thing about the invoice address.', at: Date.now()}); };
        const comments = ref([
            {id: 1, author: 'Ana Horvat', text: 'The new price list looks good. Can we apply it from January?', at: now - 5 * 3600e3, reactions: [{e: EMOJI[0], n: 3, mine: false}, {e: EMOJI[2], n: 1, mine: true}],
                replies: [{id: 2, author: 'Me', text: 'Yes, I will schedule the change for 1 January.', at: now - 4 * 3600e3, reactions: [], replies: [{id: 3, author: 'Ana Horvat', text: 'Perfect, thank you.', at: now - 3 * 3600e3, reactions: []}]}]},
            {id: 4, author: 'Marko Petrovic', text: 'Please double check the VAT for the export orders.', at: now - 2 * 86400e3, edited: true, reactions: []},
        ]);
        const find = (list, id) => { for (const c of list) { if (c.id === id) return c; const r = c.replies && find(c.replies, id); if (r) return r; } };
        const drop = (list, id) => { const i = list.findIndex(c => c.id === id); if (i > -1) list.splice(i, 1); else list.forEach(c => c.replies && drop(c.replies, id)); };
        const cm = {
            react: ({id, emoji}) => { const c = find(comments.value, id); c.reactions = c.reactions || []; let r = c.reactions.find(x => x.e === emoji); if (!r) c.reactions.push(r = {e: emoji, n: 0, mine: false}); r.mine = !r.mine; r.n += r.mine ? 1 : -1; if (r.n < 1) c.reactions.splice(c.reactions.indexOf(r), 1); },
            reply: ({parentId, text}) => { const c = find(comments.value, parentId); (c.replies = c.replies || []).push({id: ++nid, author: 'Me', text, at: Date.now(), reactions: []}); },
            edit: ({id, text}) => { const c = find(comments.value, id); c.text = text; c.edited = true; },
            remove: ({id}) => drop(comments.value, id),
        };
        const md = ref('## Release notes\n\nThe **March update** adds *bulk invoicing* and a faster export. See the [help page](https://example.com/help).\n\n- Bulk invoices for up to 200 customers\n- Export to CSV and `XLSX`\n  - Column order is kept\n\n> Tip: press Ctrl+K to insert a link.\n\n' + FENCE + 'js\nawait invoices.send({batch: 200});\n' + FENCE + '\n\n| Plan | Seats | Price |\n|:--|:-:|--:|\n| Starter | 3 | 9 EUR |\n| Business | 25 | 49 EUR |\n');
        const rootPage = {title: 'Orders', component: DemoOrders};
        return {crumbs, crumbLast, flow, flowIdx, form, finished, wsteps, tabs, tab, vtab, vtabs, dial, last, snap, swipes, swiped, onSwipe, feed, refreshed, reload, people, images, msgs, typing, send, fake, comments, cm, md, rootPage, haptic, toast,
            swl: [{id: 'paid', label: 'Mark paid', icon: 'check', kind: 'ok'}], swr: [{id: 'del', label: 'Delete', icon: 'trash', kind: 'danger'}, {id: 'later', label: 'Snooze', icon: 'clock'}],
            fin: () => { finished.value = true; toast('Customer created'); }, dialed: a => { last.value = a.label; toast(a.label); }};
    },
    template: `<div class="k-ndemo"><DemoNavBars/>
        <Holder title="Breadcrumbs" sub="Resize the window under 480 px: the middle collapses into the menu."><Breadcrumbs :items="crumbs" @navigate="crumbLast = $event.label"/><small>Last click: {{ crumbLast || 'none' }}</small></Holder>
        <Holder title="Steps" sub="Horizontal and vertical. Done, current, error, disabled."><Steps :steps="flow" v-model="flowIdx"/><Steps :steps="flow" v-model="flowIdx" vertical/></Holder>
        <Holder title="Wizard" sub="Validation per step, slide transition, finish event."><Wizard :steps="wsteps" @finish="fin">
            <template #company><div class="k-ndemo-form"><Field v-model="form.company" label="Company name" placeholder="Northwind Trading" icon="users"/><Field v-model="form.vat" label="VAT number"/></div></template>
            <template #billing><div class="k-ndemo-form"><Field v-model="form.email" label="Invoice email" type="email" placeholder="accounting@northwind.example" icon="mail"/><Field v-model="form.plan" label="Plan" :options="['Starter', 'Business', 'Enterprise']"/></div></template>
            <template #review><p><b>{{ form.company }}</b></p><p><small>{{ form.vat }} / {{ form.email }} / {{ form.plan }}</small></p><Badge v-if="finished" kind="g">Created</Badge></template></Wizard></Holder>
        <Holder title="Tabs" sub="Arrow keys, Home and End. Scrolls with edge fades, panels render when first opened."><Tabs v-model="tab" :tabs="tabs" label="Customer">
            <template #overview><p>Northwind Trading, customer since 2021. Credit limit 20,000 EUR.</p></template><template #orders><p>12 orders this year, 4 still open.</p></template><template #invoices><p>3 invoices waiting for payment.</p></template>
            <template #tickets><p>One new ticket about a damaged pallet.</p></template><template #contacts><AvatarGroup :people="people.slice(0, 3)"/></template><template #files><p>Contracts and delivery notes.</p></template><template #notes><p>Prefers deliveries before noon.</p></template><template #billing><p>Business plan, renews 1 March.</p></template></Tabs>
            <Tabs v-model="vtab" :tabs="vtabs" vertical label="Settings"><template #general><p>Company profile, language and time zone.</p></template><template #team><p>4 members with access.</p></template><template #security><p>Two-factor sign-in is required for admins.</p></template></Tabs></Holder>
        <Holder title="Fab and bottom action bar" sub="Scroll the left frame: the button hides on the way down. Tap it for the speed dial."><div class="k-ndemo-two">
            <div class="k-frame"><div class="k-frame__s k-fabscroll"><p v-for="i in 14" :key="i"><small>Customer note {{ i }}: delivery window agreed, invoice address confirmed.</small></p></div><Fab absolute :actions="dial" scroller=".k-fabscroll" aria-label="Create" @action="dialed"/><small class="k-frame__c">{{ last || 'Pick an action' }}</small></div>
            <div class="k-frame"><div class="k-frame__s"><div class="k-ndemo-form"><Field label="Company" model-value="Northwind Trading"/><Field label="Email" model-value="accounting@northwind.example"/><Field label="Notes" :rows="4" model-value=""/><Field label="Reference" model-value="PO-2291"/></div>
                <BottomActionBar><button type="button" class="btn">Cancel</button><button type="button" class="btn primary" @click="toast('Saved')">Save customer</button></BottomActionBar></div></div></div></Holder>
        <Holder title="Stack navigation" sub="Push and pop pages, collapsing title, swipe back from the left edge on touch."><div class="k-frame tall"><StackNav :root="rootPage"/></div></Holder>
        <Holder title="Snap sheet" sub="Peek, half and full. Drag the handle or the content, fling it, or use the arrow keys on the handle."><div class="k-frame tall"><div class="k-frame__s"><p><small>The map or list behind the sheet. Current snap: {{ snap }}.</small></p></div>
            <SnapSheet v-model="snap" absolute title="Nearby warehouses"><ul class="k-ndemo-list"><li v-for="i in 12" :key="i"><button type="button"><span><b>Warehouse {{ String.fromCharCode(64 + i) }}</b><small>{{ i * 3 }} km, {{ 40 + i * 7 }} pallets free</small></span></button></li></ul></SnapSheet></div></Holder>
        <Holder title="Swipe row and pull to refresh" sub="Swipe a row (full swipe commits) or use its menu button. Pull the list down."><div class="k-ndemo-two"><div class="k-ndemo-stack">
            <SwipeRow v-for="r in swipes" :key="r.id" :left="swl" :right="swr" @action="onSwipe(r, $event)"><span><b>{{ r.t }}</b><small>{{ r.s }}</small></span></SwipeRow><small>{{ swiped || 'No action yet' }}</small></div>
            <PullRefresh height="220px" @refresh="reload"><ul class="k-ndemo-list"><li v-for="f in feed" :key="f"><button type="button"><span><b>{{ f }}</b></span></button></li></ul></PullRefresh></div><small>Refreshed {{ refreshed }} times. Haptics: <button type="button" class="link" @click="haptic('success')">success</button> <button type="button" class="link" @click="haptic('error')">error</button></small></Holder>
        <Holder title="Avatar group and gallery"><AvatarGroup :people="people" :max="4"/><ImageGallery :images="images" :cols="3"/></Holder>
        <Holder title="Chat" sub="Enter sends, Shift+Enter adds a line. Scroll up, then press the button to get a message while away."><ChatThread :messages="msgs" :typing="typing" height="380px" @send="send"/><button type="button" class="btn" @click="fake">Simulate incoming message</button></Holder>
        <Holder title="Comments"><CommentThread :comments="comments" me="Me" @react="cm.react" @reply="cm.reply" @edit="cm.edit" @remove="cm.remove"/></Holder>
        <Holder title="Markdown editor and view" sub="Ctrl or Cmd with B, I, K. No raw HTML is ever passed through."><MarkdownEditor v-model="md"/></Holder></div>`,
};

export function registerKitNav(app) {
    Object.entries({KNavMenu, Breadcrumbs, Steps, Wizard, Tabs, Fab, BottomActionBar, StackNav, SnapSheet, SwipeRow, PullRefresh, AvatarGroup, Lightbox, ImageGallery, ChatThread, CommentThread, KCommentItem, MarkdownView, MarkdownEditor, DemoNav})
        .forEach(([k, v]) => app.component(k, v));
}
