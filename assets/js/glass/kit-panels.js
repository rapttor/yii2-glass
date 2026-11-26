// Glass kit, panels and docks: resizable splits, panel frames, side tabs for collapsed panels, and a ready workspace.
// Register with `registerKitPanels(app)`; `DemoPanels` shows them all. Styles: scss/kit/_panels.scss (class prefix k-).
//   usePanels(id, groups, defaults, opts)  layout state, saved in localStorage: sizes, collapsed, "one at a time", title-click cycle
//   KSplit      panes in a row or column with draggable, keyboard-operable splitters
//   KPanel      header (collapse chevron, title, count, actions) and body
//   KDockTabs   collapsed panels as side tabs with their names written vertically
//   KWorkspace  split + panels + dock in one tag; one panel at a time when narrow
import { ref, reactive, computed, watch, provide, inject, onMounted, onBeforeUnmount } from '../vendor/vue.esm-browser.prod.js';
import { PATHS, toast } from './ui.js';

Object.assign(PATHS, {
    kdown: 'M6 9l6 6 6-6', kright: 'M9 6l6 6-6 6', ksolo: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', kreset: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4',
});

// ---------- state ----------
const readStore = k => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const writeStore = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable: the layout lasts until reload */ } };
const clone = v => JSON.parse(JSON.stringify(v));

/**
 * @param {string} id        storage name, unique per page
 * @param {object} groups    split groups: {main: ['list', 'detail'], bottom: ['log']}
 * @param {object} defaults  weight per panel (relative, not necessarily 100): {list: 30, detail: 70}
 * @param {object} opts      {dock: true} collapsed panels leave the split (show them in KDockTabs); false: they stay as a slim bar
 *                           {prefix: 'glass.panels.'} localStorage key prefix
 */
export function usePanels(id, groups, defaults = {}, opts = {}) {
    const KEY = (opts.prefix ?? 'glass.panels.') + id, all = Object.values(groups).flat(), dock = !!opts.dock;
    const fresh = () => ({sizes: {}, collapsed: {}, cycle: {}, solo: false});
    const saved = readStore(KEY) || {};
    const state = reactive({...fresh(), ...saved, sizes: {...saved.sizes}, collapsed: {...saved.collapsed}, cycle: {...saved.cycle}});
    watch(state, () => writeStore(KEY, state), {deep: true});

    const weight = k => state.sizes[k] > 0 ? state.sizes[k] : defaults[k] > 0 ? defaults[k] : 25;
    const collapsed = k => !!state.collapsed[k];
    const groupOf = k => Object.keys(groups).find(g => groups[g].includes(k));
    const panes = g => groups[g].filter(k => !(dock && collapsed(k))).map(k => ({key: k, size: weight(k), collapsed: collapsed(k)}));
    const forget = g => { delete state.cycle[g]; };

    // pixels of the open panes after a drag. Sizes are weights: the dragged panes keep their combined weight, so a panel that is
    // collapsed meanwhile comes back at the size it had. A collapsed bar that was dragged open is reopened.
    function resized(g, px) {
        const keys = Object.keys(px); if (!keys.length) return;
        const before = keys.reduce((n, k) => n + weight(k), 0), total = keys.reduce((n, k) => n + px[k], 0);
        const reopened = keys.filter(collapsed);
        keys.forEach(k => { state.sizes[k] = total ? Math.round(px[k] / total * before * 100) / 100 : weight(k); });
        if (reopened.length) { reopened.forEach(k => { state.collapsed[k] = false; }); if (state.cycle[g]) { groups[g].forEach(k => { state.collapsed[k] = false; }); forget(g); } }
    }
    // double click on a splitter: default sizes, all panels of the group open
    function reset(g) { groups[g].forEach(k => { delete state.sizes[k]; state.collapsed[k] = false; }); forget(g); }
    function resetAll() { Object.assign(state, fresh()); }
    function toggle(k) { state.collapsed[k] = !collapsed(k); forget(groupOf(k)); }
    // "one at a time": restoring a panel collapses the others, so each is seen at full size
    function restore(k) { state.collapsed[k] = false; if (state.solo) all.forEach(o => { if (o !== k) state.collapsed[o] = true; }); forget(groupOf(k)); }
    function toggleSolo() { state.solo = !state.solo; }
    // title click cycles: maximize -> collapse -> back to the split from before the first click
    function titleClick(k) {
        const g = groupOf(k); if (!g || groups[g].length < 2) return toggle(k);
        const keys = groups[g], c = state.cycle[g];
        if (c?.panel === k && c.state === 'min') {
            keys.forEach(x => { if (c.saved.sizes[x] > 0) state.sizes[x] = c.saved.sizes[x]; else delete state.sizes[x]; state.collapsed[x] = !!c.saved.collapsed[x]; });
            forget(g);
        } else if (c?.panel === k) {
            keys.forEach(x => { state.collapsed[x] = x === k; }); c.state = 'min';
        } else {   // first click, or another title in the middle of a cycle: keep the original split
            const keep = c?.saved ? clone(c.saved) : {sizes: Object.fromEntries(keys.map(x => [x, state.sizes[x] || 0])), collapsed: Object.fromEntries(keys.map(x => [x, collapsed(x)]))};
            keys.forEach(x => { state.collapsed[x] = x !== k; }); state.cycle[g] = {panel: k, state: 'max', saved: keep};
        }
    }
    function titleHint(k) {   // names what the next click does
        const g = groupOf(k); if (!g || groups[g].length < 2) return collapsed(k) ? 'Click to expand' : 'Click to collapse';
        const c = state.cycle[g];
        return c?.panel === k ? (c.state === 'max' ? 'Click to collapse' : 'Click to restore the split') : 'Click to maximize';
    }
    return {id, groups, state, dock, panes, collapsed, toggle, restore, resized, reset, resetAll, titleClick, titleHint, toggleSolo,
        solo: computed(() => state.solo), docked: computed(() => all.filter(collapsed))};
}

// ---------- split ----------
export const KSplit = {
    props: {direction: {type: String, default: 'row'}, panes: {type: Array, required: true}, min: Number, bar: {type: Number, default: 48}, label: {type: String, default: 'Resize panels'}},
    emits: ['resized', 'reset'],
    setup(p, {emit}) {
        const root = ref(null), live = ref(null), dragging = ref(-1), now = ref({});
        const row = computed(() => p.direction !== 'column');
        const minPx = computed(() => p.min ?? (row.value ? 160 : 96));
        provide('ksplit', {direction: computed(() => row.value ? 'row' : 'column')});
        const allClosed = computed(() => p.panes.every(x => x.collapsed));
        const style = (x, i) => {
            const l = live.value?.[x.key];
            if (l != null) return {flex: Math.max(l, 1) + ' 1 0px'};
            if (x.collapsed) return {flex: (allClosed.value && i === p.panes.length - 1 ? '1 1 ' : '0 0 ') + p.bar + 'px'};
            return {flex: Math.max(x.size, 1) + ' 1 0px'};
        };
        const cell = key => [...root.value.children].find(el => el.dataset.key === key);
        const sizeOf = key => { const r = cell(key).getBoundingClientRect(); return row.value ? r.width : r.height; };
        // the two panes around splitter i, with their pixel sizes at this moment
        const grab = i => {
            const px = Object.fromEntries(p.panes.map(x => [x.key, sizeOf(x.key)])), a = p.panes[i], b = p.panes[i + 1];
            const floor = x => x.collapsed ? Math.min(p.bar, px[x.key]) : Math.min(minPx.value, px[x.key]);
            return {i, a, b, px, total: px[a.key] + px[b.key], minA: floor(a), minB: floor(b)};
        };
        // move splitter by d pixels from the grabbed state; returns the sizes of every pane that is (now) open
        const moved = (g, d) => {
            const sa = Math.min(g.total - g.minB, Math.max(g.minA, g.px[g.a.key] + d)), px = {...g.px, [g.a.key]: sa, [g.b.key]: g.total - sa};
            // a collapsed bar opens only when dragged clearly larger; until then nothing moves
            const stays = [g.a, g.b].some(x => x.collapsed && px[x.key] <= p.bar + 24), use = stays ? g.px : px;
            const open = p.panes.filter(x => !x.collapsed || (!stays && (x === g.a || x === g.b)));
            return {px: use, out: Object.fromEntries(open.map(x => [x.key, use[x.key]]))};
        };
        const show = (g, m) => { live.value = m.out; now.value = {...now.value, [g.i]: Math.round(m.px[g.a.key] / g.total * 100)}; };
        const commit = m => emit('resized', {...m.out});
        let drag = null;
        function down(e, i) {
            if (e.button > 0) return;
            e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); e.currentTarget.focus({preventScroll: true});
            drag = {g: grab(i), at: row.value ? e.clientX : e.clientY, m: null}; dragging.value = i;
        }
        function move(e) {
            if (!drag) return;
            const d = (row.value ? e.clientX : e.clientY) - drag.at; if (!drag.m && Math.abs(d) < 2) return;
            drag.m = moved(drag.g, d); show(drag.g, drag.m);
        }
        function up() { if (!drag) return; const m = drag.m; drag = null; dragging.value = -1; if (m) commit(m); live.value = null; }
        function key(e, i) {
            const back = row.value ? 'ArrowLeft' : 'ArrowUp', fwd = row.value ? 'ArrowRight' : 'ArrowDown';
            if (e.key === 'Enter') { e.preventDefault(); return emit('reset'); }
            if (![back, fwd, 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const g = grab(i), step = g.a.collapsed || g.b.collapsed ? 120 : e.shiftKey ? 96 : 24;
            const d = e.key === back ? -step : e.key === fwd ? step : e.key === 'Home' ? -g.total : g.total;
            const m = moved(g, d); commit(m); now.value = {...now.value, [i]: Math.round(m.px[g.a.key] / g.total * 100)};
        }
        const percent = i => { if (now.value[i] != null) return now.value[i]; const a = p.panes[i], b = p.panes[i + 1]; return a && b ? Math.round(a.size / (a.size + b.size) * 100) : 50; };
        watch(() => p.panes.map(x => x.key + x.collapsed).join(), () => { now.value = {}; });
        return {root, row, style, down, move, up, key, percent, dragging};
    },
    template: `<div class="k-split" :class="[row ? 'row' : 'column', {drag: dragging > -1}]" ref="root">
        <template v-for="(x, i) in panes" :key="x.key">
            <div class="k-split__pane" :data-key="x.key" :style="style(x, i)"><slot :name="x.key" :pane="x"/></div>
            <div v-if="i < panes.length - 1" class="k-split__bar" :class="{on: dragging === i}" role="separator" tabindex="0" :aria-orientation="row ? 'vertical' : 'horizontal'" :aria-label="label"
                aria-valuemin="0" aria-valuemax="100" :aria-valuenow="percent(i)" title="Drag to resize, double click to reset"
                @pointerdown="down($event, i)" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" @keydown="key($event, i)" @dblclick="$emit('reset')"><i></i></div>
        </template></div>`,
};

// ---------- panel ----------
let panelSeq = 0;
export const KPanel = {
    props: {id: String, title: {type: String, required: true}, icon: String, count: Number, fixed: Boolean, bare: Boolean, open: {type: Boolean, default: true}},
    emits: ['update:open'],
    setup(p, {emit}) {
        const ctl = inject('kpanels', null), split = inject('ksplit', null), own = ref(p.open), bodyId = 'kpanel-' + (++panelSeq);
        watch(() => p.open, v => { own.value = v; });
        const managed = computed(() => !!(ctl && p.id));
        const collapsed = computed(() => !p.fixed && (managed.value ? ctl.collapsed(p.id) : !own.value));
        const vertical = computed(() => collapsed.value && split?.direction.value === 'row');
        const set = v => { own.value = v; emit('update:open', v); };
        const chevron = () => managed.value ? ctl.toggle(p.id) : set(!own.value);
        const title = () => managed.value ? ctl.titleClick(p.id) : set(!own.value);
        const hint = computed(() => p.fixed ? null : managed.value ? ctl.titleHint(p.id) : own.value ? 'Click to collapse' : 'Click to expand');
        return {collapsed, vertical, chevron, title, hint, bodyId};
    },
    template: `<section class="k-panel" :class="{collapsed, vertical}" :aria-label="title">
        <header class="k-panel__h">
            <button v-if="!fixed" type="button" class="k-panel__c" :aria-label="(collapsed ? 'Expand ' : 'Collapse ') + $props.title" :aria-expanded="!collapsed" :aria-controls="bodyId" @click="chevron"><Ico :n="collapsed ? 'kright' : 'kdown'" :s="15"/></button>
            <slot name="title"><component :is="fixed ? 'span' : 'button'" class="k-panel__t" :type="fixed ? null : 'button'" :title="hint" :aria-label="hint ? $props.title + '. ' + hint : null" @click="!fixed && title()"><Ico v-if="icon" :n="icon" :s="15"/><h3>{{ $props.title }}</h3></component></slot>
            <span v-if="count != null" class="k-panel__n">{{ count }}</span>
            <div v-if="!collapsed && $slots.actions" class="k-panel__a"><slot name="actions"/></div></header>
        <div v-show="!collapsed" :id="bodyId" class="k-panel__b" :class="{bare}"><slot/></div></section>`,
};

// ---------- dock tabs ----------
export const KDockTabs = {
    props: {items: {type: Array, required: true}, side: {type: String, default: 'right'}, soloable: Boolean, solo: Boolean},
    emits: ['restore', 'toggle-solo'],
    template: `<aside v-if="items.length || soloable" class="k-dtabs" :class="side" aria-label="Collapsed panels">
        <button v-if="soloable" type="button" class="k-dtabs__solo" :class="{on: solo}" :aria-pressed="solo" aria-label="One at a time" :title="solo ? 'One at a time is on: restoring a panel collapses the others. Click to allow several.' : 'One at a time is off. Click to show each restored panel at full size.'" @click="$emit('toggle-solo')"><Ico n="ksolo" :s="15"/></button>
        <TransitionGroup name="k-dtab"><button v-for="i in items" :key="i.id" type="button" class="k-dtabs__tab" :title="'Restore ' + i.title" :aria-label="'Restore ' + i.title" @click="$emit('restore', i.id)"><Ico v-if="i.icon" :n="i.icon" :s="15"/><span>{{ i.title }}</span><em v-if="i.count != null">{{ i.count }}</em></button></TransitionGroup></aside>`,
};

// ---------- workspace ----------
export const KWorkspace = {
    props: {panels: {type: Object, required: true}, group: {type: String, default: 'main'}, items: {type: Array, required: true},
        direction: {type: String, default: 'row'}, side: {type: String, default: 'right'}, height: {type: String, default: 'min(68vh, 560px)'}, breakpoint: {type: Number, default: 640}, min: Number},
    setup(p) {
        const root = ref(null), narrow = ref(false), current = ref(p.items[0]?.id);
        let ro = null;
        onMounted(() => { const measure = () => { narrow.value = root.value.clientWidth < p.breakpoint; }; measure(); if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(root.value); } });
        onBeforeUnmount(() => ro?.disconnect());
        // narrow screens show one panel and no collapse controls
        provide('kpanels', p.panels);
        const meta = id => p.items.find(i => i.id === id) || {id, title: id};
        const panes = computed(() => p.panels.panes(p.group));
        const docked = computed(() => p.panels.docked.value.filter(k => p.panels.groups[p.group].includes(k)).map(meta));
        return {root, narrow, current, meta, panes, docked, tabs: computed(() => p.items.map(i => ({id: i.id, label: i.title})))};
    },
    template: `<div class="k-work" ref="root" :class="{narrow, ['dock-' + side]: panels.dock}" :style="{height: narrow ? null : height}">
        <template v-if="narrow">
            <div class="k-work__tabs"><GlassTabs :items="tabs" v-model="current"/></div>
            <KPanel :key="current" :title="meta(current).title" :icon="meta(current).icon" :count="meta(current).count" fixed><template #actions><slot :name="'actions-' + current"/></template><slot :name="current"/></KPanel></template>
        <template v-else>
            <KDockTabs v-if="panels.dock && side === 'left'" side="left" :items="docked" soloable :solo="panels.solo.value" @restore="panels.restore($event)" @toggle-solo="panels.toggleSolo()"/>
            <KSplit v-if="panes.length" :direction="direction" :panes="panes" :min="min" @resized="panels.resized(group, $event)" @reset="panels.reset(group)">
                <template v-for="x in panes" :key="x.key" #[x.key]><KPanel :id="x.key" :title="meta(x.key).title" :icon="meta(x.key).icon" :count="meta(x.key).count"><template #actions><slot :name="'actions-' + x.key"/></template><slot :name="x.key"/></KPanel></template></KSplit>
            <div v-else class="k-work__empty"><p>All panels are docked. Pick one from the tabs.</p></div>
            <KDockTabs v-if="panels.dock && side !== 'left'" :side="side" :items="docked" soloable :solo="panels.solo.value" @restore="panels.restore($event)" @toggle-solo="panels.toggleSolo()"/></template></div>`,
};

// ---------- showcase ----------
const BACKLOG = [['Barcode scanning at goods-in', 'Warehouse', 'y'], ['Supplier portal sign-in', 'Portal', 'b'], ['Export stock report to CSV', 'Reports', 'n'], ['Reorder alerts by email', 'Stock', 'r'], ['Dark mode for the picker app', 'Mobile', 'n'], ['Audit log for price changes', 'Admin', 'b']];
const DECISIONS = [['Prices are stored in cents', 'Accepted'], ['One warehouse per scanner', 'Proposed'], ['Offline queue keeps 7 days', 'Accepted'], ['No per-seat licence in year one', 'Rejected']];
const TASKS = [['Draw the goods-in screen', true], ['Scan a pallet label', true], ['Handle a damaged item', false], ['Print a shelf label', false], ['Sync when back online', false]];
const FILES = ['invoice-run.log', 'stock-sync.log', 'mail-queue.log'];
const LOG = ['09:41 sync started', '09:41 318 rows read', '09:42 2 rows skipped (missing SKU)', '09:42 sync finished in 41 s', '09:58 reorder alert queued', '10:02 reorder alert sent'];

export const DemoPanels = {
    setup() {
        const plan = usePanels('demo-plan', {main: ['backlog', 'decisions', 'tasks']}, {backlog: 36, decisions: 30, tasks: 34}, {dock: true});
        const ide = usePanels('demo-ide', {cols: ['nav', 'work', 'info'], side: ['files', 'outline'], main: ['editor', 'console']}, {nav: 24, work: 54, info: 22, files: 55, outline: 45, editor: 68, console: 32});
        const done = reactive(TASKS.map(([t, d]) => ({t, d}))), file = ref(FILES[1]), notes = ref(true), vert = ref(true);
        const cols = computed(() => ide.panes('cols'));
        const items = computed(() => [{id: 'backlog', title: 'Backlog', icon: 'table', count: BACKLOG.length}, {id: 'decisions', title: 'Decisions', icon: 'check', count: DECISIONS.length}, {id: 'tasks', title: 'Tasks', icon: 'pipe', count: done.filter(x => !x.d).length}]);
        provide('kpanels', ide);
        return {plan, ide, items, cols, done, file, notes, vert, BACKLOG, DECISIONS, FILES, LOG, toast, badge: s => ({Accepted: 'g', Proposed: 'y', Rejected: 'r'})[s]};
    },
    template: `<div class="page k-panels-demo">
        <Holder title="Workspace with dock tabs" sub="Drag a splitter, double click it to reset. Click a title to maximize, again to collapse, again to restore. Collapsed panels wait as side tabs.">
            <template #actions><button class="btn" @click="plan.resetAll()"><Ico n="kreset" :s="15"/>Reset layout</button></template>
            <KWorkspace :panels="plan" :items="items" height="440px">
                <template #actions-backlog><button type="button" class="k-panel__ib" aria-label="Add item" @click="toast('Adding items is not part of the demo')"><Ico n="plus" :s="15"/></button></template>
                <template #backlog><ul class="k-plist"><li v-for="b in BACKLOG" :key="b[0]"><span>{{ b[0] }}</span><Badge :kind="b[2]">{{ b[1] }}</Badge></li></ul></template>
                <template #decisions><ul class="k-plist"><li v-for="d in DECISIONS" :key="d[0]"><span>{{ d[0] }}</span><Badge :kind="badge(d[1])">{{ d[1] }}</Badge></li></ul></template>
                <template #tasks><ul class="k-plist"><li v-for="t in done" :key="t.t"><Toggle v-model="t.d" :label="t.t"/></li></ul></template></KWorkspace></Holder>
        <Holder title="Nested splits" sub="Columns inside rows. Here a collapsed panel stays as a slim bar (sideways in a row), and dragging the bar opens it again.">
            <template #actions><button class="btn" @click="ide.resetAll()"><Ico n="kreset" :s="15"/>Reset layout</button></template>
            <div class="k-ide"><KSplit :panes="cols" :min="180" label="Resize the columns" @resized="ide.resized('cols', $event)" @reset="ide.reset('cols')">
                <template #nav><KSplit direction="column" :panes="ide.panes('side')" label="Resize files and outline" @resized="ide.resized('side', $event)" @reset="ide.reset('side')">
                    <template #files><KPanel id="files" title="Files" icon="fileText" :count="FILES.length"><ul class="k-plist pick"><li v-for="f in FILES" :key="f"><button type="button" :class="{on: file === f}" @click="file = f">{{ f }}</button></li></ul></KPanel></template>
                    <template #outline><KPanel id="outline" title="Outline" icon="layers"><ul class="k-plist"><li>Start</li><li>Read rows</li><li>Skipped rows</li><li>Alerts</li></ul></KPanel></template></KSplit></template>
                <template #work><KSplit direction="column" :panes="ide.panes('main')" label="Resize editor and console" @resized="ide.resized('main', $event)" @reset="ide.reset('main')">
                    <template #editor><KPanel id="editor" :title="file" icon="fileText"><pre class="k-pre" tabindex="0">{{ LOG.join('\\n') }}</pre></KPanel></template>
                    <template #console><KPanel id="console" title="Console" icon="msg" :count="2"><pre class="k-pre" tabindex="0">&gt; 2 warnings
09:42 SKU missing in row 88
09:42 SKU missing in row 131</pre></KPanel></template></KSplit></template>
                <template #info><KPanel id="info" title="Details" icon="info"><ul class="k-plist"><li><span>Job</span><b>Stock sync</b></li><li><span>Rows</span><b>318</b></li><li><span>Skipped</span><b>2</b></li><li><span>Time</span><b>41 s</b></li></ul></KPanel></template></KSplit></div></Holder>
        <Holder title="Single panels" sub="Without a workspace a panel keeps its own state (v-model:open).">
            <div class="k-psingle"><KPanel v-model:open="notes" title="Delivery notes" icon="msg"><p class="k-ptext">Gate 3 after 14:00. Ask for the shift lead; pallets stay in bay B.</p></KPanel>
                <KPanel v-model:open="vert" title="Summary" icon="info" :count="3"><template #actions><button type="button" class="k-panel__ib" aria-label="Copy summary" @click="toast('Copied')"><Ico n="check" :s="15"/></button></template><p class="k-ptext">Three deliveries are expected today, one is late.</p></KPanel></div></Holder></div>`,
};

export function registerKitPanels(app) {
    Object.entries({KSplit, KPanel, KDockTabs, KWorkspace, DemoPanels}).forEach(([k, c]) => app.component(k, c));
}
