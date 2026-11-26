// createGlassApp(): the whole glass app from a description. The app supplies its menu, pages and brand; the kit supplies the shell
// (sidebar, helper, mega menu, top bar, phone bar, search, settings), the hash router (#page/sub) and the components.
// Framework free: plain ES modules, no build step. Needs css/glass.css on the page.
//
//   createGlassApp({
//     brand: {name: 'Acme', logo: 'A', tag: 'Pro'},
//     nav: [{id: 'work', label: 'Work', items: [{id: 'orders', label: 'Orders', icon: 'table', help: '...', sub: [{k: 'open', title: 'Open', desc: '...'}]}]}],
//     pages: {orders: Orders},          // a component per item id; lazy(() => import('app/reports.js').then(m => m.Reports)) for heavy ones
//   });
import { createApp, ref, reactive, computed, watch, onMounted, onBeforeUnmount, provide, inject, markRaw, defineAsyncComponent } from '../vendor/vue.esm-browser.prod.js';
import { registerUi, toast } from './ui.js';
import { GlassTabs, IconPill, NotchBar } from './nav.js';
import { GlassSidebar, GlassHelper, GlassMega, MODES, flatten } from './shell.js';
import { registerKitForms } from './kit-forms.js';
import { registerKitOverlay } from './kit-overlay.js';
import { registerKitData } from './kit-data.js';
import { registerKitNav } from './kit-nav.js';
import { registerKitPanels } from './kit-panels.js';
import { registerKitKnobs } from './kit-knobs.js';
import { LOOK_DEFAULTS, applyLook, LookControls } from './look.js';

export { toast, MODES };
export const lazy = loader => defineAsyncComponent(loader);

const room = new URL('../../img/room.svg', import.meta.url).href;
export const BACKGROUNDS = {
    room: {l: 'Room', css: 'url("' + room + '") center / cover'},
    dusk: {l: 'Dusk', css: 'radial-gradient(60% 50% at 80% 10%, #ff9a6a88, transparent 70%), radial-gradient(70% 60% at 10% 90%, #6d5bd0aa, transparent 70%), linear-gradient(160deg, #2b2147, #0f1226)'},
    aurora: {l: 'Aurora', css: 'radial-gradient(60% 50% at 15% 10%, #2dd4bf88, transparent 70%), radial-gradient(55% 55% at 85% 20%, #8b5cf6aa, transparent 70%), radial-gradient(70% 60% at 60% 100%, #ec4899aa, transparent 70%), #0b1226'},
    paper: {l: 'Paper', css: 'radial-gradient(50% 50% at 10% 10%, #fde68a, transparent 65%), radial-gradient(60% 55% at 90% 30%, #a5b4fc, transparent 70%), radial-gradient(60% 60% at 40% 100%, #fbcfe8, transparent 70%), #f5f3ff'},
    theme: {l: 'Theme', css: 'none'},   // lets the page background of rapttor/yii2-themes (or the page's own) show
};
export const DEFAULTS = {scheme: 'dark', bg: 'room', custom: '', accent: '#ff5a36', ...LOOK_DEFAULTS, preset: 'reflective', veil: 28, glass: 26, blur: 20, depth: 55, soft: 55, shine: 100, refract: 60, hi: .35, inset: 0, sat: 185};

const readJson = key => { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const readText = key => { try { return localStorage.getItem(key); } catch { return null; } };
const keep = (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage unavailable: the choice lasts until reload */ } };

const SETTINGS_ITEM = {id: 'settings', label: 'Settings', icon: 'gear', help: 'How the app looks: picture, glass, accent and sidebar.', sub: [
    {k: 'appearance', title: 'Appearance', desc: 'Picture, glass presets, sliders and accent.', icon: 'sliders'}, {k: 'sidebar', title: 'Sidebar', desc: 'Pinned, collapsed, hover or minimised.', icon: 'layout'}]};

const GlassSettings = {
    props: {sub: String},
    setup(p) {
        const g = inject('glassSettings');
        const swatches = ['#ff5a36', '#3b6cf0', '#2f9e8a', '#a855f7', '#f59e0b', ''], schemes = [{v: 'dark', l: 'Dark'}, {v: 'light', l: 'Light'}, {v: 'auto', l: 'Auto'}];
        // the picture stays in this browser (localStorage); it is not uploaded anywhere
        const pick = e => { const f = e.target.files[0]; if (!f) return; if (f.size > 2.5e6) return toast('Image is over 2.5 MB', 'err'); const r = new FileReader(); r.onload = () => { g.prefs.custom = r.result; g.prefs.bg = 'custom'; }; r.readAsDataURL(f); };
        return {...g, swatches, schemes, pick, toast, open: k => !p.sub ? k === 'appearance' : p.sub === k, reset: () => { Object.assign(g.prefs, g.defaults); toast('Appearance reset'); }};
    },
    template: `<div class="page stag"><Holder title="Settings" sub="Open a section"><div class="acc-list">
        <Accordion :key="'a' + sub" title="Appearance" sub="Picture, glass presets, sliders, accent" icon="sliders" :start="open('appearance')"><div class="form">
            <label class="field"><span>Mode</span><Segmented v-model="prefs.scheme" :options="schemes"/></label>
            <div class="field"><span>Picture</span><div class="bgs"><button v-for="(b, k) in backgrounds" :key="k" :class="{on: prefs.bg === k}" :style="{background: b.css}" @click="prefs.bg = k"><b>{{ b.l }}</b></button><button v-if="prefs.custom" :class="{on: prefs.bg === 'custom'}" :style="{background: 'url(&quot;' + prefs.custom + '&quot;) center / cover'}" @click="prefs.bg = 'custom'"><b>Yours</b></button></div></div>
            <div class="row2"><label class="btn" for="glass-bg-file"><Ico n="img" :s="16"/>Use your picture</label><input id="glass-bg-file" type="file" accept="image/*" hidden @change="pick"></div>
            <LookControls :prefs="prefs" :scheme="scheme"/>
            <div class="field"><span>Accent</span><div class="sw"><button v-for="c in swatches" :key="c" :class="{on: prefs.accent === c}" :style="{background: c || 'var(--brand, #7c6cff)'}" @click="prefs.accent = c" :aria-label="c || 'Theme accent'"></button></div></div>
            <div class="actions"><a v-if="themesUrl" class="btn" :href="themesUrl">Colour sets and backgrounds</a><button class="btn" @click="reset">Reset</button></div></div></Accordion>
        <Accordion :key="'b' + sub" title="Sidebar" sub="Pinned, collapsed, hover or minimised" icon="layout" :start="open('sidebar')"><div class="form">
            <div class="modes"><button v-for="m in MODES" :key="m.v" :class="{on: side === m.v}" @click="side = m.v"><Ico :n="m.icon" :s="22"/><b>{{ m.label }}</b><small>{{ m.desc }}</small></button></div>
            <Toggle v-if="hasCard" v-model="pinCard" label="Keep the card pinned at the bottom of the sidebar"/></div></Accordion></div></Holder></div>`,
};

const check = options => {
    if (!Array.isArray(options.nav) || !options.nav.length) throw new Error('createGlassApp: nav is empty');
    for (const s of options.nav) for (const i of s.items || []) {
        if (!i.id || !i.label) throw new Error('createGlassApp: every menu item needs an id and a label');
        if (!/^[a-z][a-z0-9-]*$/i.test(i.id)) throw new Error('createGlassApp: the id "' + i.id + '" may hold letters, digits and dashes only');
        if (!options.pages?.[i.id] && !(i.id === 'settings' && options.settings !== false)) throw new Error('createGlassApp: no page for "' + i.id + '"');
    }
};

// the markup the styles expect; a server layout (the Yii2 Shell widget) may have printed it already
function frame(selector) {
    document.body.classList.add('v4', 'v5');
    for (const cls of ['v4__bg', 'v4__veil']) if (!document.querySelector('.' + cls)) { const d = document.createElement('div'); d.className = cls; d.setAttribute('aria-hidden', 'true'); document.body.prepend(d); }
    let el = document.querySelector(selector);
    if (!el) { el = document.createElement('div'); el.id = selector.replace(/^#/, ''); document.body.appendChild(el); }
    return el;
}

/**
 * @param {object} options
 *   nav, pages          required, see the top of this file
 *   brand               {name, logo, tag}
 *   user                {name, role} shown at the foot of the sidebar
 *   card                {title, value, percent, note} small card in the sidebar (reactive objects update)
 *   home                id of the start page (default: the first item)
 *   mobile              up to five ids for the phone bar (default: the first four and Settings)
 *   badges              reactive {id: number}
 *   actions             component placed at the right of the top bar
 *   settings            false removes the built-in Settings page
 *   themesUrl           link shown in Settings (yii2-themes picker)
 *   look                starting appearance, e.g. {scheme: 'light', bg: 'paper', accent: '#3b6cf0'}
 *   backgrounds         extra pictures {key: {l: 'Label', css: 'url(...) center / cover'}}
 *   storage             localStorage prefix, unique per app (default 'glass')
 *   el                  mount selector (default '#app')
 *   install(app)        register extra components or kits (registerKitCharts(app) ...)
 * @returns {{app: object, go: function, prefs: object}}
 */
export function createGlassApp(options) {
    check(options);
    const o = {el: '#app', storage: 'glass', settings: true, ...options};
    const brand = {name: 'App', ...o.brand}; brand.logo ||= [...brand.name][0];
    const nav = o.nav.map(s => ({...s, items: [...s.items]}));
    if (o.settings && !nav.some(s => s.items.some(i => i.id === 'settings'))) nav.push({id: 'glass-system', label: 'App', items: [SETTINGS_ITEM]});
    const flat = flatten(nav), home = flat.some(n => n.id === o.home) ? o.home : flat[0].id;
    const views = Object.fromEntries(Object.entries({...(o.settings ? {settings: GlassSettings} : {}), ...o.pages}).map(([k, c]) => [k, markRaw(c)]));
    const backgrounds = {...BACKGROUNDS, ...o.backgrounds};
    const defaults = {...DEFAULTS, ...o.look};
    const KEY = o.storage + '.prefs', prefs = reactive({...defaults, ...readJson(KEY)});
    const mq = matchMedia('(prefers-color-scheme: dark)'), sysDark = ref(mq.matches); mq.addEventListener('change', e => sysDark.value = e.matches);
    const scheme = computed(() => prefs.scheme === 'auto' ? (sysDark.value ? 'dark' : 'light') : prefs.scheme);
    function applyPrefs() {
        const root = document.querySelector('.v4'), bg = document.querySelector('.v4__bg'); if (!root || !bg) return;
        root.dataset.scheme = scheme.value;
        applyLook(root, prefs);
        prefs.accent ? root.style.setProperty('--accent-c', prefs.accent) : root.style.removeProperty('--accent-c');
        bg.style.background = prefs.bg === 'custom' && prefs.custom ? 'url("' + prefs.custom + '") center / cover' : (backgrounds[prefs.bg] || backgrounds.room).css;
        bg.classList.toggle('is-none', prefs.bg === 'theme');
        keep(KEY, JSON.stringify(prefs));
    }
    const modeIds = MODES.map(m => m.v);
    const side = ref(modeIds.includes(readText(o.storage + '.side')) ? readText(o.storage + '.side') : 'pinned'); watch(side, v => keep(o.storage + '.side', v));
    const pinCard = ref(readText(o.storage + '.pincard') === '1'); watch(pinCard, v => keep(o.storage + '.pincard', v ? '1' : '0'));

    let goTo = () => {};
    const App = {
        setup() {
            const parse = () => { const [t, sub] = location.hash.slice(1).split('/'); return {tab: flat.some(n => n.id === t) ? t : home, sub: sub || ''}; };
            const route = reactive(parse());
            const go = (tab, sub = '') => { if (!flat.some(n => n.id === tab)) return; route.tab = tab; route.sub = sub; helper.item = null; mega.value = false; search.value = false; };
            goTo = go;
            watch(() => [route.tab, route.sub], ([t, s]) => { history.replaceState(null, '', '#' + t + (s ? '/' + s : '')); scrollTo({top: 0}); });
            const wq = matchMedia('(min-width: 900px)'), wide = ref(wq.matches), onWide = e => wide.value = e.matches; wq.addEventListener('change', onWide);
            const scrolled = ref(false), onScroll = () => scrolled.value = scrollY > 20;
            const mini = computed(() => side.value === 'mini' || !wide.value);
            const helper = reactive({item: null, left: 260}); let ht = 0;
            const hoverItem = (it, right) => { clearTimeout(ht); ht = setTimeout(() => { helper.left = Math.round(right + 12); helper.item = flat.find(x => x.id === it.id); }, helper.item ? 40 : 140); };
            const stay = () => clearTimeout(ht), leave = () => { clearTimeout(ht); ht = setTimeout(() => helper.item = null, 220); };
            const sideHover = ref(false);
            const dim = computed(() => wide.value && side.value !== 'mini' && (!!helper.item || (side.value === 'hover' && sideHover.value)));
            const mega = ref(false), search = ref(false);
            const key = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.value = !search.value; } if (e.key === 'Escape') helper.item = null; };
            const onHash = () => Object.assign(route, parse());
            provide('glass', {nav, brand, user: o.user, card: o.card, go, route, prefs, toast});
            const mobile = (o.mobile || [...flat.filter(n => n.id !== 'settings').slice(0, 4).map(n => n.id), ...(o.settings ? ['settings'] : [])]).map(id => flat.find(n => n.id === id)).filter(Boolean).slice(0, 5);
            const current = computed(() => flat.find(n => n.id === route.tab));
            onMounted(() => { applyPrefs(); watch([prefs, scheme], applyPrefs, {deep: true}); addEventListener('scroll', onScroll, {passive: true}); addEventListener('keydown', key); addEventListener('hashchange', onHash); document.querySelector('.v4').classList.add('ready'); });
            onBeforeUnmount(() => { removeEventListener('scroll', onScroll); removeEventListener('keydown', key); removeEventListener('hashchange', onHash); wq.removeEventListener('change', onWide); });
            return {route, go, wide, scrolled, side, pinCard, mini, sideHover, helper, hoverItem, stay, leave, dim, mega, search, mobile, flat, views, brand, badges: o.badges || {}, actions: o.actions ? markRaw(o.actions) : null, scheme,
                title: computed(() => (!wide.value && current.value?.short) || current.value?.label),
                flip: () => { const to = scheme.value === 'dark' ? 'light' : 'dark'; prefs.scheme = to; if (prefs.bg === 'dusk' && to === 'light') prefs.bg = 'paper'; else if (prefs.bg === 'paper' && to === 'dark') prefs.bg = 'dusk'; },
                setSub: s => { route.sub = s; }};
        },
        template: `<div class="shell6" :class="{wide, mini, scrolled}">
            <GlassSidebar v-if="wide && side !== 'mini'" :mode="side" :current="route.tab" :badges="badges" :pin-card="pinCard" @go="go" @mode="side = $event" @pin="pinCard = $event" @item="hoverItem" @leave="leave" @hover="sideHover = $event"/>
            <div class="dim6" :class="{on: dim}" aria-hidden="true"></div>
            <GlassHelper v-if="wide" :item="helper.item" :left="helper.left" @go="go" @keep="stay" @leave="leave"/>
            <div class="col5"><header class="top5"><div class="top5__l"><button v-if="mini" class="brand6" @click="mega = true" aria-label="Open the menu"><span class="logo5">{{ brand.logo }}</span><span class="brand6__t">Menu</span></button><h1>{{ title }}</h1></div><div class="top5__a"><button class="field5" @click="search = true" aria-label="Search or jump to"><Ico n="search" :s="16"/><span>Search or jump to…</span><kbd v-if="wide">⌘K</kbd></button>
                <button class="icon-btn" @click="flip" :aria-label="scheme === 'dark' ? 'Light mode' : 'Dark mode'"><Ico :n="scheme === 'dark' ? 'sun' : 'moon'"/></button><component v-if="actions" :is="actions"/></div></header>
                <main class="main5"><Transition name="reveal" mode="out-in"><div :key="route.tab" class="glass-page"><component :is="views[route.tab]" :sub="route.sub" @sub="setSub"/></div></Transition></main></div>
            <NotchBar v-if="!wide" class="notchfix" :items="mobile" :model-value="route.tab" :badges="badges" @update:model-value="go($event)"/>
            <GlassMega :open="mega" :current="route.tab" @close="mega = false" @go="go"/>
            <Sheet :open="search" @close="search = false"><div class="pal"><ul><li v-for="n in flat" :key="n.id"><button @click="go(n.id)"><Ico :n="n.icon" :s="16"/>Go to {{ n.label }}</button></li></ul></div></Sheet>
            <ConfirmHost/><SnackHost/><Toasts/></div>`,
    };

    const el = frame(o.el);
    const app = createApp(App);
    // what the built-in Settings page works on
    app.provide('glassSettings', {prefs, scheme, side, pinCard, backgrounds, defaults, MODES, themesUrl: o.themesUrl || '', hasCard: !!o.card});
    registerUi(app);
    Object.entries({GlassTabs, IconPill, NotchBar, LookControls, GlassSidebar, GlassHelper, GlassMega}).forEach(([k, v]) => app.component(k, v));
    [registerKitForms, registerKitOverlay, registerKitData, registerKitNav, registerKitPanels, registerKitKnobs].forEach(register => register(app));
    o.install?.(app);
    app.mount(el);
    return {app, go: (tab, sub) => goTo(tab, sub), prefs};
}
