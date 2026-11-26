// Glass kit, data components: DataTable, Pagination, Calendar, Timeline, TreeView, charts (Bar, Line, Gauge, Funnel, Heatmap) and Kanban.
// Vue 3 browser build, no build step. Styled by scss/kit/_data.scss (class prefix k-). Register with `registerKitData(app)`; `DemoData` shows everything live.
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick, h } from '../vendor/vue.esm-browser.prod.js';
import { PATHS, toast } from './ui.js';

Object.entries({
    chevl: 'M15 6l-6 6 6 6', columns: 'M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4z', rowsd: 'M4 5h16M4 10h16M4 15h16M4 20h16', rowsc: 'M4 7h16M4 12h16M4 17h16',
    alert: 'M12 4l9 16H3zM12 10v4M12 17h.01', dot: 'M12 12h.01', folder: 'M4 6h5l2 2h9v11H4z', leaf: 'M6 4h8l4 4v12H6z',
}).forEach(([k, v]) => { if (!PATHS[k]) PATHS[k] = v; });

// ---------- helpers ----------
let _uid = 0;
const uid = p => p + (++_uid);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = n => String(n).padStart(2, '0');
const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseDay = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const weekStart = d => addDays(d, -((d.getDay() + 6) % 7));   // weeks start on Monday
const nf = new Intl.NumberFormat('en-US');
const moneyF = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});
const short = v => { const a = Math.abs(v); return a >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? +(v / 1e3).toFixed(1) + 'k' : String(+v.toFixed(1)); };
const FMT = {money: v => moneyF.format(v), number: v => nf.format(v), percent: v => v + '%', date: v => v ? parseDay(v).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : ''};
const PAL = ['var(--accent-c)', '#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'];

// ---------- KCheck: checkbox with indeterminate state ----------
export const KCheck = {
    props: {modelValue: Boolean, indeterminate: Boolean, label: String, disabled: Boolean, tab: {type: Number, default: 0}},
    emits: ['update:modelValue'],
    template: `<label class="k-dcheck" @click.stop><input type="checkbox" :checked="modelValue" :indeterminate="indeterminate" :disabled="disabled" :tabindex="tab" :aria-label="label" @change="$emit('update:modelValue', $event.target.checked)"><i></i></label>`,
};

// ---------- Pagination ----------
export const Pagination = {
    props: {page: {type: Number, default: 1}, total: {type: Number, default: 0}, size: {type: Number, default: 10}, sizes: {type: Array, default: () => [10, 25, 50]}, siblings: {type: Number, default: 1}},
    emits: ['update:page', 'update:size', 'page'],
    setup(p, {emit}) {
        const pages = computed(() => Math.max(1, Math.ceil(p.total / p.size)));
        const items = computed(() => {
            const n = pages.value, c = clamp(p.page, 1, n), set = new Set([1, n]);
            for (let i = c - p.siblings; i <= c + p.siblings; i++) if (i > 1 && i < n) set.add(i);
            const a = [...set].sort((x, y) => x - y), r = [];
            a.forEach((v, i) => { if (i && v - a[i - 1] > 1) r.push(v - a[i - 1] === 2 ? a[i - 1] + 1 : '…'); r.push(v); });
            return r;
        });
        const go = n => { n = clamp(n, 1, pages.value); if (n === p.page) return; emit('update:page', n); emit('page', {page: n, size: p.size}); };
        const setSize = v => { v = +v; emit('update:size', v); emit('update:page', 1); emit('page', {page: 1, size: v}); };
        const from = computed(() => p.total ? (p.page - 1) * p.size + 1 : 0), to = computed(() => Math.min(p.total, p.page * p.size));
        return {pages, items, go, setSize, from, to};
    },
    template: `<nav class="k-pg" aria-label="Pagination">
        <span class="k-pg__info" aria-live="polite">{{ from }}–{{ to }} of {{ total }}</span>
        <div class="k-pg__nav"><button type="button" class="k-pg__b" :disabled="page <= 1" aria-label="Previous page" @click="go(page - 1)"><Ico n="chevl" :s="16"/></button>
            <span class="k-pg__nums"><template v-for="(it, i) in items" :key="i"><span v-if="it === '…'" class="k-pg__gap" aria-hidden="true">…</span><button v-else type="button" class="k-pg__b k-pg__n" :class="{on: it === page}" :aria-current="it === page ? 'page' : null" :aria-label="'Page ' + it" @click="go(it)">{{ it }}</button></template></span>
            <span class="k-pg__cur">Page {{ page }} of {{ pages }}</span>
            <button type="button" class="k-pg__b" :disabled="page >= pages" aria-label="Next page" @click="go(page + 1)"><Ico n="chev" :s="16"/></button></div>
        <label v-if="sizes && sizes.length" class="k-pg__size"><span>Per page</span><select :value="size" @change="setSize($event.target.value)"><option v-for="s in sizes" :key="s" :value="s">{{ s }}</option></select></label></nav>`,
};

// ---------- DataTable ----------
// columns: [{key, label, sortable, width, align, hidden, format ('money'|'number'|'percent'|'date'|fn(value, row)), slot (name of a #slot), editable, type ('number'), options (select)}]
const Cell = {props: ['fn', 'row', 'col'], render() { return this.fn(this.row, this.col); }};
export const DataTable = {
    components: {Cell},
    props: {
        columns: {type: Array, required: true}, rows: {type: Array, default: () => []}, rowKey: {type: String, default: 'id'}, selectable: Boolean, searchable: {type: Boolean, default: true},
        loading: Boolean, pageSize: {type: Number, default: 10}, pageSizes: {type: Array, default: () => [5, 10, 25, 50]}, density: {type: String, default: 'comfortable'},
        cardBreak: {type: Number, default: 640}, height: {type: String, default: '440px'}, exportName: {type: String, default: 'export'}, emptyText: {type: String, default: 'No rows match.'}, defaultSort: {type: Array, default: () => []},
    },
    emits: ['select', 'sort', 'edit', 'page', 'update:density'],
    setup(p, {emit, slots, expose}) {
        const root = ref(null), colwrap = ref(null), narrow = ref(false), q = ref(''), page = ref(1), size = ref(p.pageSize), dens = ref(p.density), menu = ref(false), ver = ref(0);
        const hidden = reactive(new Set(p.columns.filter(c => c.hidden).map(c => c.key)));
        const sorts = ref(p.defaultSort.map(s => ({...s}))), sel = ref([]), editing = ref(null);
        const cols = computed(() => p.columns.filter(c => !hidden.has(c.key)));
        const keyOf = r => r[p.rowKey];
        const text = (r, c) => { const v = r[c.key], f = c.format; if (typeof f === 'function') return String(f(v, r)); if (f && FMT[f]) return FMT[f](v); return v == null ? '' : String(v); };

        const filtered = computed(() => { ver.value; const s = q.value.trim().toLowerCase(); if (!s) return p.rows;
            return p.rows.filter(r => cols.value.some(c => (text(r, c) + ' ' + (r[c.key] ?? '')).toLowerCase().includes(s))); });
        const cmp = (a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''), undefined, {numeric: true, sensitivity: 'base'});
        const sorted = computed(() => { if (!sorts.value.length) return filtered.value;
            return [...filtered.value].sort((a, b) => { for (const s of sorts.value) { const c = cmp(a[s.key], b[s.key]); if (c) return s.dir === 'desc' ? -c : c; } return 0; }); });
        const pageRows = computed(() => sorted.value.slice((page.value - 1) * size.value, page.value * size.value));
        watch(q, () => page.value = 1);
        watch(() => sorted.value.length, n => { const max = Math.max(1, Math.ceil(n / size.value)); if (page.value > max) page.value = max; });

        const dirOf = c => (sorts.value.find(s => s.key === c.key) || {}).dir || '';
        const sortIdx = c => sorts.value.findIndex(s => s.key === c.key) + 1;
        const ariaSort = c => ({asc: 'ascending', desc: 'descending'})[dirOf(c)] || 'none';
        function toggleSort(c, e) {
            const i = sorts.value.findIndex(s => s.key === c.key), cur = i > -1 ? sorts.value[i].dir : null, next = cur == null ? 'asc' : cur === 'asc' ? 'desc' : null;
            if (e && e.shiftKey) { if (i > -1) { if (next) sorts.value[i].dir = next; else sorts.value.splice(i, 1); } else sorts.value.push({key: c.key, dir: 'asc'}); }
            else sorts.value = next ? [{key: c.key, dir: next}] : [];
            emit('sort', sorts.value.map(s => ({...s})));
        }
        const sortable = computed(() => cols.value.filter(c => c.sortable));
        const narrowSort = k => { sorts.value = k ? [{key: k, dir: dirOf({key: k}) || 'asc'}] : []; emit('sort', sorts.value.map(s => ({...s}))); };
        const flipSort = () => { if (sorts.value[0]) { sorts.value = [{key: sorts.value[0].key, dir: sorts.value[0].dir === 'asc' ? 'desc' : 'asc'}]; emit('sort', sorts.value.map(s => ({...s}))); } };

        const pageKeys = computed(() => pageRows.value.map(keyOf));
        const allOn = computed(() => pageKeys.value.length > 0 && pageKeys.value.every(k => sel.value.includes(k)));
        const some = computed(() => !allOn.value && pageKeys.value.some(k => sel.value.includes(k)));
        const selRows = computed(() => p.rows.filter(r => sel.value.includes(keyOf(r))));
        const setSel = a => { sel.value = a; emit('select', a.slice()); };
        const isSel = r => sel.value.includes(keyOf(r));
        const toggleRow = (r, on) => { const k = keyOf(r); setSel(on ? [...new Set([...sel.value, k])] : sel.value.filter(x => x !== k)); };
        const togglePage = on => { const ks = pageKeys.value; setSel(on ? [...new Set([...sel.value, ...ks])] : sel.value.filter(k => !ks.includes(k))); };
        const selectAll = () => setSel(sorted.value.map(keyOf));
        const clear = () => setSel([]);

        function startEdit(r, c) { editing.value = {k: keyOf(r), key: c.key, v: r[c.key]}; nextTick(() => root.value && root.value.querySelector('.k-dt__input') && root.value.querySelector('.k-dt__input').focus()); }
        function commit(r, c) {
            const e = editing.value; if (!e) return; editing.value = null;
            const v = c.type === 'number' ? Number(e.v) : e.v;
            if (v !== r[c.key]) { const old = r[c.key]; r[c.key] = v; ver.value++; emit('edit', {row: r, key: c.key, value: v, old}); }
        }
        const cellFn = (r, c) => {
            const val = r[c.key], e = editing.value;
            if (e && e.k === keyOf(r) && e.key === c.key) {
                const common = {class: 'k-dt__input', 'aria-label': 'Edit ' + c.label, onBlur: () => commit(r, c),
                    onKeydown: ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(r, c); } else if (ev.key === 'Escape') { ev.preventDefault(); editing.value = null; } }};
                if (c.options) return h('select', {...common, value: e.v, onChange: ev => { e.v = ev.target.value; commit(r, c); }}, c.options.map(o => h('option', {value: o.v ?? o, selected: (o.v ?? o) === e.v}, o.l ?? o)));
                return h('input', {...common, type: c.type === 'number' ? 'number' : 'text', value: e.v, onInput: ev => { e.v = ev.target.value; }});
            }
            const inner = c.slot && slots[c.slot] ? slots[c.slot]({row: r, value: val, col: c}) : text(r, c);
            if (!c.editable) return inner;
            return h('button', {type: 'button', class: 'k-dt__ed', title: 'Edit ' + c.label, onClick: ev => { ev.stopPropagation(); startEdit(r, c); }}, [h('span', null, inner)]);
        };

        function exportCsv(all = true) {
            const list = all ? sorted.value : pageRows.value, cs = cols.value;
            const esc = v => { let s = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+@]/.test(s)) s = "'" + s; return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
            const body = [cs.map(c => esc(c.label)).join(','), ...list.map(r => cs.map(c => esc(r[c.key])).join(','))].join('\r\n');
            const url = URL.createObjectURL(new Blob(['﻿' + body], {type: 'text/csv;charset=utf-8'})), a = document.createElement('a');
            a.href = url; a.download = p.exportName + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            return body;
        }
        const setCol = (c, on) => { if (on) hidden.delete(c.key); else if (cols.value.length > 1) hidden.add(c.key); };
        const setDens = v => { dens.value = v; emit('update:density', v); };
        const openMenu = () => { menu.value = !menu.value; if (menu.value) nextTick(() => colwrap.value && colwrap.value.querySelector('input') && colwrap.value.querySelector('input').focus()); };
        const outside = e => { if (menu.value && colwrap.value && !colwrap.value.contains(e.target)) menu.value = false; };
        const colKey = e => { if (e.key === 'Escape') { menu.value = false; const b = colwrap.value && colwrap.value.querySelector('button'); b && b.focus(); } };
        const focusOut = e => { if (menu.value && colwrap.value && e.relatedTarget && !colwrap.value.contains(e.relatedTarget)) menu.value = false; };
        let ro;
        onMounted(() => { addEventListener('pointerdown', outside); ro = new ResizeObserver(() => { narrow.value = root.value.clientWidth < p.cardBreak; }); ro.observe(root.value); narrow.value = root.value.clientWidth < p.cardBreak; });
        onBeforeUnmount(() => { removeEventListener('pointerdown', outside); ro && ro.disconnect(); });
        expose({exportCsv, clearSelection: clear});
        const onPage = e => emit('page', e);
        return {root, colwrap, narrow, q, page, size, dens, menu, hidden, sorts, sel, cols, keyOf, sorted, pageRows, dirOf, sortIdx, ariaSort, toggleSort, sortable, narrowSort, flipSort, allOn, some, selRows, isSel, toggleRow, togglePage, selectAll, clear, cellFn, exportCsv, setCol, setDens, openMenu, colKey, focusOut, onPage};
    },
    template: `<div class="k-dt" ref="root" :class="['d-' + dens, {narrow, loading}]">
        <div class="k-dt__bar"><div v-if="searchable" class="field__box k-dt__q"><Ico n="search" :s="16"/><input type="search" v-model="q" placeholder="Search" aria-label="Search rows"></div>
            <div v-if="narrow && sortable.length" class="k-dt__ns"><select :value="sorts[0] ? sorts[0].key : ''" aria-label="Sort by" @change="narrowSort($event.target.value)"><option value="">Sort by</option><option v-for="c in sortable" :key="c.key" :value="c.key">{{ c.label }}</option></select>
                <button type="button" class="k-ib" aria-label="Reverse order" :disabled="!sorts.length" @click="flipSort"><Ico :n="sorts[0] && sorts[0].dir === 'desc' ? 'down' : 'up'" :s="16"/></button></div>
            <div class="k-dt__tools"><slot name="toolbar"/>
                <span ref="colwrap" class="k-dt__colwrap" @keydown="colKey" @focusout="focusOut"><button type="button" class="k-ib" aria-haspopup="true" :aria-expanded="menu" aria-label="Choose columns" title="Columns" @click="openMenu"><Ico n="columns" :s="18"/></button>
                    <div v-if="menu" class="k-dpop" role="group" aria-label="Columns"><label v-for="c in columns" :key="c.key" class="k-dt__opt"><KCheck :model-value="!hidden.has(c.key)" :label="c.label" @update:model-value="setCol(c, $event)"/>{{ c.label }}</label></div></span>
                <button type="button" class="k-ib" :aria-pressed="dens === 'compact'" :aria-label="dens === 'compact' ? 'Comfortable rows' : 'Compact rows'" :title="dens === 'compact' ? 'Comfortable rows' : 'Compact rows'" @click="setDens(dens === 'compact' ? 'comfortable' : 'compact')"><Ico :n="dens === 'compact' ? 'rowsd' : 'rowsc'" :s="18"/></button>
                <button type="button" class="btn k-dt__exp" @click="exportCsv(true)"><Ico n="download" :s="16"/><span>CSV</span></button></div></div>
        <Transition name="fade"><div v-if="sel.length" class="k-dt__bulk" role="region" aria-label="Bulk actions"><b>{{ sel.length }} selected</b><button v-if="sel.length < sorted.length" type="button" class="link" @click="selectAll">Select all {{ sorted.length }}</button><span class="k-dt__sp"></span><slot name="bulk" :keys="sel" :rows="selRows" :clear="clear"/><button type="button" class="link" @click="clear">Clear</button></div></Transition>
        <div v-if="!narrow" class="k-dt__scroll" :style="{maxHeight: height}" tabindex="0" role="region" aria-label="Table, scrollable"><table class="k-dt__t">
            <thead><tr><th v-if="selectable" class="k-dt__sel"><KCheck :model-value="allOn" :indeterminate="some" label="Select all rows on this page" @update:model-value="togglePage"/></th>
                <th v-for="c in cols" :key="c.key" scope="col" :aria-sort="c.sortable ? ariaSort(c) : null" :style="{width: c.width, textAlign: c.align}">
                    <button v-if="c.sortable" type="button" class="k-dt__sort" :class="{on: dirOf(c)}" :title="'Sort by ' + c.label + ' (Shift: add a second sort)'" @click="toggleSort(c, $event)"><span>{{ c.label }}</span><i class="k-dt__arr" :class="dirOf(c)"></i><sup v-if="sorts.length > 1 && dirOf(c)">{{ sortIdx(c) }}</sup></button><span v-else>{{ c.label }}</span></th>
                <th v-if="$slots.actions" class="k-dt__act"><span class="k-sr">Actions</span></th></tr></thead>
            <tbody v-if="loading"><tr v-for="i in Math.min(size, 6)" :key="'s' + i" class="k-dt__skr"><td v-if="selectable"><i class="k-sk" style="width:20px"></i></td><td v-for="c in cols" :key="c.key"><i class="k-sk" :style="{width: 38 + (i * 17 + c.key.length * 11) % 50 + '%'}"></i></td><td v-if="$slots.actions"></td></tr></tbody>
            <tbody v-else-if="pageRows.length"><tr v-for="r in pageRows" :key="keyOf(r)" :class="{sel: isSel(r)}">
                <td v-if="selectable" class="k-dt__sel"><KCheck :model-value="isSel(r)" :label="'Select row ' + keyOf(r)" @update:model-value="toggleRow(r, $event)"/></td>
                <td v-for="c in cols" :key="c.key" :class="{num: c.align === 'right'}" :style="{textAlign: c.align}"><Cell :fn="cellFn" :row="r" :col="c"/></td>
                <td v-if="$slots.actions" class="k-dt__act"><slot name="actions" :row="r"/></td></tr></tbody>
            <tbody v-else><tr><td :colspan="cols.length + (selectable ? 1 : 0) + ($slots.actions ? 1 : 0)"><slot name="empty"><Empty :text="emptyText"/></slot></td></tr></tbody></table></div>
        <div v-else class="k-dt__cards"><template v-if="loading"><div v-for="i in 3" :key="i" class="k-dt__card"><Skeleton :n="3"/></div></template>
            <template v-else><article v-for="r in pageRows" :key="keyOf(r)" class="k-dt__card" :class="{sel: isSel(r)}">
                <header><KCheck v-if="selectable" :model-value="isSel(r)" :label="'Select row ' + keyOf(r)" @update:model-value="toggleRow(r, $event)"/><div class="k-dt__ct"><Cell :fn="cellFn" :row="r" :col="cols[0]"/></div><div v-if="$slots.actions" class="k-dt__act"><slot name="actions" :row="r"/></div></header>
                <dl><div v-for="c in cols.slice(1)" :key="c.key"><dt>{{ c.label }}</dt><dd><Cell :fn="cellFn" :row="r" :col="c"/></dd></div></dl></article>
                <slot v-if="!pageRows.length" name="empty"><Empty :text="emptyText"/></slot></template></div>
        <Pagination :page="page" :total="sorted.length" :size="size" :sizes="pageSizes" @update:page="page = $event" @update:size="size = $event" @page="onPage"/></div>`,
};

// ---------- Calendar ----------
// events: [{id, date: 'YYYY-MM-DD', end?: 'YYYY-MM-DD', time?: '09:30', title, color?}]. Month and week view, week starts Monday, mini variant for sidebars.
export const Calendar = {
    props: {events: {type: Array, default: () => []}, view: {type: String, default: 'month'}, date: {type: [String, Date], default: null}, mini: Boolean, locale: {type: String, default: 'en-GB'}, maxPerDay: {type: Number, default: 3}, selected: String},
    emits: ['update:view', 'update:date', 'day-click', 'event-click', 'nav'],
    setup(p, {emit}) {
        const root = ref(null), today = isoDay(new Date());
        const toIso = v => v ? (v instanceof Date ? isoDay(v) : String(v).slice(0, 10)) : today;
        const cur = ref(toIso(p.date)), v = ref(p.view);
        watch(() => p.date, d => { if (d) cur.value = toIso(d); }); watch(() => p.view, x => v.value = x);
        const L = p.locale, fDay = new Intl.DateTimeFormat(L, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
        const wd = Array.from({length: 7}, (_, i) => { const d = new Date(2024, 0, 1 + i); return {s: d.toLocaleDateString(L, {weekday: 'short'}), l: d.toLocaleDateString(L, {weekday: 'long'}), c: d.toLocaleDateString(L, {weekday: 'narrow'})}; });
        const evsOn = iso => p.events.filter(e => { const s = toIso(e.date || e.start); return s <= iso && iso <= (e.end ? toIso(e.end) : s); }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const mk = (d, month) => { const iso = isoDay(d); return {iso, n: d.getDate(), out: month != null && d.getMonth() !== month, today: iso === today, evs: evsOn(iso), label: fDay.format(d), wd: (d.getDay() + 6) % 7}; };
        const weeks = computed(() => {
            const c = parseDay(cur.value), out = [];
            if (v.value === 'week') { const s = weekStart(c); out.push(Array.from({length: 7}, (_, i) => mk(addDays(s, i)))); return out; }
            const first = new Date(c.getFullYear(), c.getMonth(), 1), s = weekStart(first), n = Math.ceil(((first.getDay() + 6) % 7 + new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate()) / 7);
            for (let w = 0; w < n; w++) out.push(Array.from({length: 7}, (_, i) => mk(addDays(s, w * 7 + i), c.getMonth())));
            return out;
        });
        const title = computed(() => { const c = parseDay(cur.value);
            if (v.value === 'week') { const s = weekStart(c), e = addDays(s, 6), o = {day: 'numeric', month: 'short'}; return s.toLocaleDateString(L, o) + ' – ' + e.toLocaleDateString(L, {...o, year: 'numeric'}); }
            return c.toLocaleDateString(L, {month: 'long', year: 'numeric'}); });
        function setCur(iso, focus) { cur.value = iso; emit('update:date', iso); if (focus) nextTick(() => { const el = root.value && root.value.querySelector('[data-d="' + iso + '"]'); el && el.focus(); }); }
        function shift(n) { const c = parseDay(cur.value);
            if (v.value === 'week') return addDays(c, 7 * n);
            const t = new Date(c.getFullYear(), c.getMonth() + n, 1); t.setDate(Math.min(c.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return t; }
        const go = n => { const iso = isoDay(shift(n)); setCur(iso); emit('nav', {date: iso, view: v.value}); };
        const goToday = () => { setCur(today); emit('nav', {date: today, view: v.value}); };
        const setView = x => { v.value = x; emit('update:view', x); };
        const clickDay = iso => { setCur(iso); emit('day-click', iso); };
        function key(e) {
            const d = parseDay(cur.value); let n;
            switch (e.key) {
                case 'ArrowLeft': n = addDays(d, -1); break; case 'ArrowRight': n = addDays(d, 1); break; case 'ArrowUp': n = addDays(d, -7); break; case 'ArrowDown': n = addDays(d, 7); break;
                case 'Home': n = weekStart(d); break; case 'End': n = addDays(weekStart(d), 6); break;
                case 'PageUp': n = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()); break; case 'PageDown': n = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()); break;
                case 'Enter': case ' ': if (e.target.dataset && e.target.dataset.d) { e.preventDefault(); clickDay(cur.value); } return;
                default: return;
            }
            e.preventDefault(); setCur(isoDay(n), true);
        }
        return {root, cur, v, weeks, title, wd, go, goToday, setView, clickDay, key, views: [{v: 'month', l: 'Month'}, {v: 'week', l: 'Week'}]};
    },
    template: `<div class="k-cal" ref="root" :class="[{mini}, 'is-' + v]">
        <header class="k-cal__h"><b class="k-cal__t" aria-live="polite">{{ title }}</b>
            <div class="k-cal__nav"><button type="button" class="k-ib" aria-label="Previous" @click="go(-1)"><Ico n="chevl" :s="16"/></button>
                <button v-if="!mini" type="button" class="btn k-cal__today" @click="goToday">Today</button><button type="button" class="k-ib" aria-label="Next" @click="go(1)"><Ico n="chev" :s="16"/></button></div>
            <Segmented v-if="!mini" class="k-cal__seg" :model-value="v" :options="views" @update:model-value="setView"/></header>
        <div class="k-cal__grid" role="grid" :aria-label="title" @keydown="key">
            <div v-if="v === 'month'" class="k-cal__wd" role="row"><span v-for="(d, i) in wd" :key="i" role="columnheader" :aria-label="d.l">{{ mini ? d.c : d.s }}</span></div>
            <div v-for="(wk, wi) in weeks" :key="wi" class="k-cal__row" role="row">
                <div v-for="d in wk" :key="d.iso" role="gridcell" class="k-cal__d" :data-d="d.iso" :tabindex="d.iso === cur ? 0 : -1" :aria-selected="selected ? d.iso === selected : null" :aria-current="d.today ? 'date' : null"
                    :aria-label="d.label + (d.evs.length ? ', ' + d.evs.length + (d.evs.length > 1 ? ' events' : ' event') : '')" :class="{out: d.out, today: d.today, cur: d.iso === cur, sel: d.iso === selected, has: d.evs.length}" @click="clickDay(d.iso)">
                    <span class="k-cal__n"><small v-if="v === 'week'">{{ wd[d.wd].s }}</small><b>{{ d.n }}</b></span>
                    <span v-if="mini" class="k-cal__dots"><i v-for="e in d.evs.slice(0, 3)" :key="e.id" :style="{background: e.color || 'var(--accent-c)'}"></i></span>
                    <span v-else class="k-cal__evs"><button v-for="e in d.evs.slice(0, v === 'week' ? 99 : maxPerDay)" :key="e.id" type="button" class="k-cal__ev" :style="{'--c': e.color || 'var(--accent-c)'}" :title="(e.time ? e.time + ' ' : '') + e.title" @click.stop="$emit('event-click', e)"><i></i><span v-if="e.time" class="k-cal__tm">{{ e.time }}</span><span class="k-cal__tt">{{ e.title }}</span></button>
                        <span v-if="v === 'month' && d.evs.length > maxPerDay" class="k-cal__more">+{{ d.evs.length - maxPerDay }} more</span></span></div></div></div></div>`,
};

// ---------- Timeline ----------
// items: [{id, icon, time?, at? (ISO datetime, used for grouping and the time), title, body, status: 'ok'|'warn'|'bad'|'info'|'muted', color?}]
export const Timeline = {
    props: {items: {type: Array, default: () => []}, groupByDay: Boolean, locale: {type: String, default: 'en-GB'}},
    setup(p) {
        const dayLabel = k => { const t = isoDay(new Date()); return k === t ? 'Today' : k === isoDay(addDays(new Date(), -1)) ? 'Yesterday' : parseDay(k).toLocaleDateString(p.locale, {weekday: 'long', day: 'numeric', month: 'long'}); };
        const groups = computed(() => {
            if (!p.groupByDay) return [{key: '', label: '', items: p.items}];
            const m = new Map(); [...p.items].sort((a, b) => new Date(b.at) - new Date(a.at)).forEach(i => { const k = isoDay(new Date(i.at)); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
            return [...m].map(([key, items]) => ({key, label: dayLabel(key), items}));
        });
        const timeOf = i => i.time || (i.at ? pad(new Date(i.at).getHours()) + ':' + pad(new Date(i.at).getMinutes()) : '');
        return {groups, timeOf};
    },
    template: `<div class="k-tl"><section v-for="g in groups" :key="g.key" class="k-tl__g"><h4 v-if="g.label" class="k-tl__day">{{ g.label }}</h4>
        <ol class="k-tl__list"><li v-for="i in g.items" :key="i.id" class="k-tl__i" :class="'s-' + (i.status || 'muted')" :style="i.color ? {'--c': i.color} : null">
            <span class="k-tl__dot"><Ico :n="i.icon || 'dot'" :s="14"/></span>
            <div class="k-tl__b"><slot name="item" :item="i"><header><b>{{ i.title }}</b><time>{{ timeOf(i) }}</time></header><p v-if="i.body">{{ i.body }}</p></slot></div></li></ol></section></div>`,
};

// ---------- TreeView ----------
// nodes: [{id, label, icon?, children?, lazy?, disabled?}]. v-model = selected id (single) or array of ids (multiple). checkboxes + v-model:checked give a tri-state check tree.
// `load(node)` is an async function returning the children of a node that has lazy: true.
export const TreeView = {
    props: {nodes: {type: Array, default: () => []}, modelValue: {type: [String, Number, Array], default: null}, multiple: Boolean, checkboxes: Boolean, checked: {type: Array, default: () => []}, expanded: {type: Array, default: () => []}, load: Function, label: String},
    emits: ['update:modelValue', 'update:checked', 'update:expanded', 'select', 'expand', 'load'],
    setup(p, {emit}) {
        const root = ref(null), focus = ref(null), open = reactive(new Set(p.expanded)), loaded = reactive(new Map()), busy = reactive(new Set()), ticked = reactive(new Set(p.checked));
        const kids = n => loaded.get(n.id) || n.children || null;
        const isBranch = n => !!(kids(n) && kids(n).length) || (!!n.lazy && !loaded.has(n.id));
        const flat = computed(() => { const out = [], walk = (list, level, parent) => list.forEach((n, i) => { out.push({n, level, parent, i, size: list.length}); if (open.has(n.id) && kids(n)) walk(kids(n), level + 1, n); }); walk(p.nodes, 1, null); return out; });
        const isSel = n => Array.isArray(p.modelValue) ? p.modelValue.includes(n.id) : p.modelValue === n.id;
        function select(n) {
            if (n.disabled) return;
            const v = p.multiple ? (isSel(n) ? (p.modelValue || []).filter(x => x !== n.id) : [...(Array.isArray(p.modelValue) ? p.modelValue : []), n.id]) : n.id;
            emit('update:modelValue', v); emit('select', n);
        }
        async function loadKids(n) {
            busy.add(n.id);
            try { const res = (await p.load(n)) || []; loaded.set(n.id, res); if (ticked.has(n.id)) res.forEach(c => ticked.add(c.id)); emit('load', n, res); }
            catch (e) { open.delete(n.id); toast('Could not load ' + n.label, 'err'); }
            finally { busy.delete(n.id); }
        }
        function toggle(n, force) {
            if (!isBranch(n)) return; const on = force != null ? force : !open.has(n.id);
            if (on) { open.add(n.id); if (n.lazy && !loaded.has(n.id) && p.load) loadKids(n); } else open.delete(n.id);
            emit('update:expanded', [...open]); emit('expand', n, on);
        }
        const st = n => { const k = kids(n); if (!k || !k.length) return ticked.has(n.id) ? 1 : 0; let a = 0, b = 0; k.forEach(c => { const s = st(c); if (s === 1) a++; else if (s === 2) b++; }); return a === k.length ? 1 : (a || b) ? 2 : 0; };
        const setAll = (n, on) => { if (on) ticked.add(n.id); else ticked.delete(n.id); (kids(n) || []).forEach(c => setAll(c, on)); };
        function tick(n) {
            if (n.disabled) return; setAll(n, st(n) !== 1);
            const ids = [], walk = l => l.forEach(x => { if (st(x) === 1) ids.push(x.id); if (kids(x)) walk(kids(x)); }); walk(p.nodes); emit('update:checked', ids);
        }
        const focusId = id => { focus.value = id; nextTick(() => { const el = root.value && [...root.value.querySelectorAll('[data-id]')].find(e => e.dataset.id === String(id)); el && el.focus(); }); };
        function key(e) {
            // the focused row decides, not a remembered id: after Tab the tree has no remembered id yet, which left the keyboard dead until a click
            const tid = e.target.closest && e.target.closest('li[data-id]')?.dataset.id; if (tid != null) { const hit = flat.value.find(x => String(x.n.id) === tid); if (hit) focus.value = hit.n.id; }
            const L = flat.value, i = L.findIndex(x => x.n.id === focus.value); if (i < 0) return; const cur = L[i];
            switch (e.key) {
                case 'ArrowDown': if (L[i + 1]) focusId(L[i + 1].n.id); break; case 'ArrowUp': if (L[i - 1]) focusId(L[i - 1].n.id); break;
                case 'Home': focusId(L[0].n.id); break; case 'End': focusId(L[L.length - 1].n.id); break;
                case 'ArrowRight': if (isBranch(cur.n) && !open.has(cur.n.id)) toggle(cur.n, true); else if (L[i + 1] && L[i + 1].parent === cur.n) focusId(L[i + 1].n.id); break;
                case 'ArrowLeft': if (open.has(cur.n.id) && isBranch(cur.n)) toggle(cur.n, false); else if (cur.parent) focusId(cur.parent.id); break;
                case 'Enter': select(cur.n); break;
                case ' ': if (p.checkboxes) tick(cur.n); else select(cur.n); break;
                default: return;
            }
            e.preventDefault();
        }
        const tab = n => n.id === (focus.value ?? (flat.value[0] && flat.value[0].n.id)) ? 0 : -1;
        return {root, focus, open, busy, flat, isBranch, isSel, select, toggle, st, tick, key, tab};
    },
    template: `<ul class="k-tree" ref="root" role="tree" :aria-label="label" :aria-multiselectable="multiple || null" @keydown="key">
        <li v-for="e in flat" :key="e.n.id" role="treeitem" :data-id="e.n.id" :aria-level="e.level" :aria-setsize="e.size" :aria-posinset="e.i + 1" :aria-expanded="isBranch(e.n) ? open.has(e.n.id) : null" :aria-selected="isSel(e.n)" :aria-disabled="e.n.disabled || null" :aria-busy="busy.has(e.n.id) || null"
            :tabindex="tab(e.n)" :class="{sel: isSel(e.n), dis: e.n.disabled}" :style="{'--lv': e.level - 1}" @focus="focus = e.n.id" @click.stop="select(e.n)">
            <span class="k-tree__row"><button v-if="isBranch(e.n)" type="button" tabindex="-1" class="k-tree__tw" :class="{open: open.has(e.n.id)}" aria-hidden="true" @click.stop="toggle(e.n)"><Ico n="chev" :s="14"/></button><span v-else class="k-tree__tw"></span>
                <KCheck v-if="checkboxes" :model-value="st(e.n) === 1" :indeterminate="st(e.n) === 2" :label="e.n.label" :tab="-1" :disabled="e.n.disabled" @update:model-value="tick(e.n)"/>
                <Ico :n="e.n.icon || (isBranch(e.n) ? 'folder' : 'leaf')" :s="16" class="k-tree__ic"/><span class="k-tree__l">{{ e.n.label }}</span><i v-if="busy.has(e.n.id)" class="k-dspin" role="status" aria-label="Loading"></i></span></li></ul>`,
};

// ---------- charts (SVG, no libraries) ----------
// useChart: width tracking, eased 0..1 animation progress `t` (restarts on data change and legend toggle), tooltip state, legend toggling.
function useChart(source) {
    const root = ref(null), w = ref(0), t = ref(reduced() ? 1 : 0), tip = ref(null), hid = reactive(new Set());
    let ro, raf, tm;
    const run = () => {
        cancelAnimationFrame(raf); if (reduced()) { t.value = 1; return; }
        t.value = 0; const t0 = performance.now();
        const step = now => { const k = Math.min(1, (now - t0) / 800); t.value = 1 - Math.pow(1 - k, 3); if (k < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step);
    };
    onMounted(() => { w.value = root.value.clientWidth || 360; ro = new ResizeObserver(() => { w.value = root.value.clientWidth || w.value; }); ro.observe(root.value); run(); });
    onBeforeUnmount(() => { ro && ro.disconnect(); cancelAnimationFrame(raf); clearTimeout(tm); });
    if (source) watch(source, run, {deep: true});
    watch(() => [...hid].join(), run);
    const showTip = (e, data) => { const r = root.value.getBoundingClientRect(); clearTimeout(tm); tip.value = {x: e.clientX - r.left, y: e.clientY - r.top, ...data}; if (e.pointerType === 'touch') tm = setTimeout(() => tip.value = null, 2800); };
    const hideTip = e => { if (!e || e.pointerType !== 'touch') tip.value = null; };
    const toggle = (i, n) => { if (hid.has(i)) hid.delete(i); else if (hid.size < n - 1) hid.add(i); };
    const tipStyle = computed(() => tip.value ? {left: clamp(tip.value.x, 74, Math.max(74, w.value - 74)) + 'px', top: tip.value.y + 'px'} : null);
    return {root, w, t, tip, hid, showTip, hideTip, toggle, tipStyle, run};
}
const col = (s, i) => s.color || PAL[i % PAL.length];
function nice(max, n = 4) { if (!(max > 0)) return {max: 1, step: .25}; const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag; return {max: Math.ceil(max / step - 1e-9) * step, step}; }
const TIP = `<div v-if="tip" class="k-ctip" :style="tipStyle" role="status"><b v-if="tip.title">{{ tip.title }}</b><div v-for="r in tip.rows" :key="r.name"><i v-if="r.c" :style="{background: r.c}"></i><span>{{ r.name }}</span><strong>{{ r.v }}</strong></div></div>`;
const LEGEND = `<div v-if="legend && series.length > 1" class="k-legend" role="group" aria-label="Series"><button v-for="(s, i) in series" :key="s.name" type="button" :aria-pressed="!hid.has(i)" :class="{off: hid.has(i)}" @click="toggle(i, series.length)"><i :style="{background: col(s, i)}"></i>{{ s.name }}</button></div>`;

// BarChart: series [{name, data, color?}], labels. Grouped by default, stacked, horizontal, value labels.
export const BarChart = {
    props: {labels: {type: Array, default: () => []}, series: {type: Array, default: () => []}, stacked: Boolean, horizontal: Boolean, height: {type: Number, default: 260}, valueLabels: Boolean, format: Function, legend: {type: Boolean, default: true}, title: String},
    setup(p) {
        const c = useChart(() => [p.series, p.labels]), {w, t, hid} = c, active = ref(-1);
        const f = v => p.format ? p.format(v) : nf.format(v);
        const vis = computed(() => p.series.map((_, i) => i).filter(i => !hid.has(i)));
        const scale = computed(() => { let mx = 0; p.labels.forEach((_, j) => { const vs = vis.value.map(i => p.series[i].data[j] || 0); mx = Math.max(mx, p.stacked ? vs.reduce((a, b) => a + b, 0) : Math.max(0, ...vs)); }); return nice(mx * (p.valueLabels && !p.horizontal ? 1.1 : 1)); });
        const ticks = computed(() => Array.from({length: Math.round(scale.value.max / scale.value.step) + 1}, (_, i) => i * scale.value.step));
        const H = computed(() => p.horizontal ? Math.max(p.height, p.labels.length * (p.stacked ? 30 : vis.value.length * 15 + 14) + 34) : p.height);
        const m = computed(() => { const tl = Math.max(...ticks.value.map(v => short(v).length));
            return p.horizontal ? {l: 12 + Math.min(110, Math.max(...p.labels.map(l => String(l).length)) * 6.6), r: 36, t: 6, b: 24} : {l: 12 + tl * 6.6, r: 8, t: 16, b: 26}; });
        const pw = computed(() => Math.max(10, w.value - m.value.l - m.value.r)), ph = computed(() => H.value - m.value.t - m.value.b);
        const gx = v => m.value.l + v / scale.value.max * pw.value, gy = v => m.value.t + ph.value - v / scale.value.max * ph.value;
        const band = computed(() => (p.horizontal ? ph.value : pw.value) / Math.max(1, p.labels.length));
        const gw = computed(() => Math.min(band.value * .72, p.stacked ? 56 : 28 * Math.max(1, vis.value.length))), bw = computed(() => p.stacked ? gw.value : gw.value / Math.max(1, vis.value.length));
        const bars = computed(() => {
            const out = [], L = m.value, hz = p.horizontal, mx = scale.value.max, span = hz ? pw.value : ph.value;
            p.labels.forEach((_, j) => { let cum = 0; const start = (hz ? L.t : L.l) + j * band.value + (band.value - gw.value) / 2;
                vis.value.forEach((si, k) => { const v = p.series[si].data[j] || 0, len = v / mx * span * t.value, off = (p.stacked ? cum : 0) / mx * span * t.value, pos = start + (p.stacked ? 0 : k * bw.value), th = bw.value - (p.stacked ? 0 : 2);
                    out.push(hz ? {j, si, v, x: L.l + off, y: pos, w: len, h: th} : {j, si, v, x: pos, y: L.t + ph.value - off - len, w: th, h: len}); cum += v; }); });
            return out;
        });
        const texts = computed(() => { if (!p.valueLabels || t.value < .98) return []; const hz = p.horizontal, out = [];
            if (p.stacked) p.labels.forEach((_, j) => { const bs = bars.value.filter(b => b.j === j); if (!bs.length) return; const tot = bs.reduce((a, b) => a + b.v, 0), last = bs[bs.length - 1];
                out.push(hz ? {k: j, x: last.x + last.w + 5, y: last.y + last.h / 2 + 4, a: 'start', s: f(tot)} : {k: j, x: last.x + last.w / 2, y: Math.min(...bs.map(b => b.y)) - 5, a: 'middle', s: f(tot)}); });
            else if (hz || bw.value >= 20) bars.value.forEach((b, k) => out.push(hz ? {k, x: b.x + b.w + 5, y: b.y + b.h / 2 + 4, a: 'start', s: f(b.v)} : {k, x: b.x + b.w / 2, y: b.y - 5, a: 'middle', s: f(b.v)}));
            return out; });
        const bands = computed(() => p.labels.map((l, j) => p.horizontal ? {j, x: m.value.l, y: m.value.t + j * band.value, w: pw.value, h: band.value} : {j, x: m.value.l + j * band.value, y: m.value.t, w: band.value, h: ph.value}));
        const every = computed(() => p.horizontal ? 1 : Math.ceil(p.labels.length * 44 / pw.value));
        const hover = (e, j) => { active.value = j; c.showTip(e, {title: p.labels[j], rows: vis.value.map(i => ({c: col(p.series[i], i), name: p.series[i].name, v: f(p.series[i].data[j] || 0)}))}); };
        const leave = e => { c.hideTip(e); if (!e || e.pointerType !== 'touch') active.value = -1; };
        return {...c, active, f, vis, scale, ticks, H, m, pw, ph, gx, gy, band, bars, texts, bands, every, hover, leave, col, short};
    },
    template: `<div class="k-chart" ref="root" @pointerleave="leave">
        <svg v-if="w" :width="w" :height="H" :viewBox="'0 0 ' + w + ' ' + H" role="img" :aria-label="title || 'Bar chart'">
            <g class="k-ax"><template v-for="v in ticks" :key="v"><line v-if="horizontal" :x1="gx(v)" :x2="gx(v)" :y1="m.t" :y2="H - m.b"/><line v-else :x1="m.l" :x2="w - m.r" :y1="gy(v)" :y2="gy(v)"/>
                <text v-if="horizontal" :x="gx(v)" :y="H - 6" text-anchor="middle">{{ short(v) }}</text><text v-else :x="m.l - 8" :y="gy(v) + 4" text-anchor="end">{{ short(v) }}</text></template>
                <template v-for="(l, j) in labels" :key="'l' + j"><text v-if="horizontal" :x="m.l - 8" :y="m.t + (j + .5) * band + 4" text-anchor="end">{{ l }}</text><text v-else-if="j % every === 0" :x="m.l + (j + .5) * band" :y="H - 8" text-anchor="middle">{{ l }}</text></template></g>
            <rect v-for="b in bands" :key="'h' + b.j" class="k-hl" :class="{on: active === b.j}" :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="6"/>
            <rect v-for="b in bars" :key="b.j + '-' + b.si" class="k-bar" :x="b.x" :y="b.y" :width="Math.max(0, b.w)" :height="Math.max(0, b.h)" rx="3" :style="{fill: col(series[b.si], b.si)}"/>
            <g class="k-vl"><text v-for="x in texts" :key="x.k" :x="x.x" :y="x.y" :text-anchor="x.a">{{ x.s }}</text></g>
            <rect v-for="b in bands" :key="'p' + b.j" class="k-hit" :x="b.x" :y="b.y" :width="b.w" :height="b.h" @pointermove="hover($event, b.j)" @pointerdown="hover($event, b.j)"/></svg>
        ${TIP}${LEGEND}</div>`,
};

// LineChart: multi-series, optional area fill and smooth curve, crosshair tooltip.
export const LineChart = {
    props: {labels: {type: Array, default: () => []}, series: {type: Array, default: () => []}, area: Boolean, smooth: Boolean, height: {type: Number, default: 260}, format: Function, legend: {type: Boolean, default: true}, title: String},
    setup(p) {
        const c = useChart(() => [p.series, p.labels]), {w, t, hid} = c, id = uid('kl'), ai = ref(-1);
        const f = v => p.format ? p.format(v) : nf.format(v);
        const vis = computed(() => p.series.map((_, i) => i).filter(i => !hid.has(i)));
        const scale = computed(() => nice(Math.max(0, ...vis.value.map(i => Math.max(0, ...p.series[i].data))) * 1.05));
        const ticks = computed(() => Array.from({length: Math.round(scale.value.max / scale.value.step) + 1}, (_, i) => i * scale.value.step));
        const m = computed(() => ({l: 12 + Math.max(...ticks.value.map(v => short(v).length)) * 6.6, r: 14, t: 12, b: 26}));
        const pw = computed(() => Math.max(10, w.value - m.value.l - m.value.r)), ph = computed(() => p.height - m.value.t - m.value.b);
        const n = computed(() => p.labels.length);
        const px = i => m.value.l + (n.value > 1 ? i / (n.value - 1) : .5) * pw.value, py = v => m.value.t + ph.value - v / scale.value.max * ph.value;
        const paths = computed(() => vis.value.map(si => { const pts = p.series[si].data.map((v, i) => [px(i), py(v)]);
            const d = pts.map(([x, y], i, a) => { if (!i) return 'M' + x + ',' + y; if (!p.smooth) return 'L' + x + ',' + y; const cx = (a[i - 1][0] + x) / 2; return 'C' + cx + ',' + a[i - 1][1] + ' ' + cx + ',' + y + ' ' + x + ',' + y; }).join('');
            const base = m.value.t + ph.value; return {si, d, area: pts.length ? d + 'L' + pts[pts.length - 1][0] + ',' + base + 'L' + pts[0][0] + ',' + base + 'Z' : ''}; }));
        const every = computed(() => Math.ceil(n.value * 46 / pw.value));
        function at(e, i) { ai.value = i; c.showTip(e, {title: p.labels[i], rows: vis.value.map(si => ({c: col(p.series[si], si), name: p.series[si].name, v: f(p.series[si].data[i])}))}); }
        function onMove(e) { const r = e.currentTarget.getBoundingClientRect(); at(e, clamp(Math.round((e.clientX - r.left) / pw.value * (n.value - 1)), 0, n.value - 1)); }
        const leave = e => { c.hideTip(e); if (!e || e.pointerType !== 'touch') ai.value = -1; };
        return {...c, id, ai, f, vis, ticks, m, pw, ph, px, py, paths, every, onMove, leave, col, short, clipW: computed(() => (w.value + 4) * t.value)};
    },
    template: `<div class="k-chart" ref="root" @pointerleave="leave">
        <svg v-if="w" :width="w" :height="height" :viewBox="'0 0 ' + w + ' ' + height" role="img" :aria-label="title || 'Line chart'">
            <defs><clipPath :id="id + 'c'"><rect x="0" y="0" :width="clipW" :height="height"/></clipPath><linearGradient v-for="q in paths" :key="q.si" :id="id + 'g' + q.si" x1="0" y1="0" x2="0" y2="1"><stop offset="0" :stop-color="col(series[q.si], q.si)" stop-opacity=".4"/><stop offset="1" :stop-color="col(series[q.si], q.si)" stop-opacity="0"/></linearGradient></defs>
            <g class="k-ax"><template v-for="v in ticks" :key="v"><line :x1="m.l" :x2="w - m.r" :y1="py(v)" :y2="py(v)"/><text :x="m.l - 8" :y="py(v) + 4" text-anchor="end">{{ short(v) }}</text></template>
                <template v-for="(l, i) in labels" :key="'x' + i"><text v-if="i % every === 0" :x="px(i)" :y="height - 8" text-anchor="middle">{{ l }}</text></template></g>
            <g :clip-path="'url(#' + id + 'c)'"><template v-for="q in paths" :key="q.si"><path v-if="area" :d="q.area" :fill="'url(#' + id + 'g' + q.si + ')'"/><path class="k-line" :d="q.d" :style="{stroke: col(series[q.si], q.si)}"/></template></g>
            <g v-if="ai > -1" class="k-cross"><line :x1="px(ai)" :x2="px(ai)" :y1="m.t" :y2="m.t + ph"/><circle v-for="q in paths" :key="q.si" :cx="px(ai)" :cy="py(series[q.si].data[ai])" r="5" :style="{stroke: col(series[q.si], q.si)}"/></g>
            <rect class="k-hit k-hit--x" :x="m.l" :y="m.t" :width="pw" :height="ph" @pointermove="onMove" @pointerdown="onMove"/></svg>
        ${TIP}${LEGEND}</div>`,
};

// Gauge: semi-circle, value inside [min, max], thresholds [{to: percent of range, color}], label under the value.
export const Gauge = {
    props: {value: {type: Number, default: 0}, min: {type: Number, default: 0}, max: {type: Number, default: 100}, label: String, unit: {type: String, default: '%'}, format: Function,
        thresholds: {type: Array, default: () => [{to: 50, color: 'var(--bad)'}, {to: 80, color: 'var(--warn)'}, {to: 100, color: 'var(--ok)'}]}},
    setup(p) {
        const c = useChart(() => p.value), {t} = c;
        const pct = computed(() => clamp((p.value - p.min) / ((p.max - p.min) || 1), 0, 1) * 100);
        const color = computed(() => (p.thresholds.find(x => pct.value <= x.to) || p.thresholds[p.thresholds.length - 1] || {color: 'var(--accent-c)'}).color);
        const bands = computed(() => p.thresholds.map((x, i) => { const from = i ? p.thresholds[i - 1].to : 0; return {from, len: x.to - from, color: x.color}; }));
        const shown = computed(() => { const v = p.min + (p.value - p.min) * t.value; return p.format ? p.format(v) : Math.round(v) + p.unit; });
        return {...c, pct, color, bands, shown};
    },
    template: `<div class="k-gauge" ref="root"><svg viewBox="0 0 200 122" role="meter" :aria-valuenow="value" :aria-valuemin="min" :aria-valuemax="max" :aria-label="label || 'Gauge'">
        <path class="k-gauge__t" d="M20 100A80 80 0 0 1 180 100" pathLength="100"/>
        <path v-for="(b, i) in bands" :key="i" class="k-gauge__b" d="M20 100A80 80 0 0 1 180 100" pathLength="100" :stroke-dasharray="Math.max(0, b.len - .6) + ' 200'" :stroke-dashoffset="-b.from" :style="{stroke: b.color}"/>
        <path class="k-gauge__v" d="M20 100A80 80 0 0 1 180 100" pathLength="100" :stroke-dasharray="pct * t + ' 200'" :style="{stroke: color}"/>
        <text class="k-gauge__n" x="100" y="88" text-anchor="middle">{{ shown }}</text><text v-if="label" class="k-gauge__l" x="100" y="108" text-anchor="middle">{{ label }}</text>
        <text class="k-gauge__e" x="20" y="118" text-anchor="middle">{{ min }}</text><text class="k-gauge__e" x="180" y="118" text-anchor="middle">{{ max }}</text></svg></div>`,
};

// FunnelChart: stages [{label, value, color?}] with the conversion from the previous stage.
export const FunnelChart = {
    props: {stages: {type: Array, default: () => []}, format: Function, title: String},
    setup(p) {
        const c = useChart(() => p.stages), {w, t} = c, RH = 48;
        const f = v => p.format ? p.format(v) : nf.format(v);
        const lab = computed(() => clamp(w.value * .36, 84, 132)), fw = computed(() => Math.max(40, w.value - lab.value - 6));
        const rows = computed(() => { const st = p.stages, top = st[0] ? st[0].value || 1 : 1, n = st.length;
            return st.map((s, i) => { const wi = s.value / top * fw.value * t.value, wn = (i < n - 1 ? st[i + 1].value : s.value * .8) / top * fw.value * t.value, cx = lab.value + 6 + fw.value / 2, y = i * RH;
                return {i, s, y, pts: [cx - wi / 2, y, cx + wi / 2, y, cx + wn / 2, y + RH - 4, cx - wn / 2, y + RH - 4].join(' '), conv: i ? Math.round(s.value / st[i - 1].value * 100) : null, fill: s.color || 'color-mix(in srgb, var(--accent-c) ' + Math.round(100 - i * (55 / Math.max(1, n - 1))) + '%, transparent)'}; }); });
        const trunc = s => { const k = Math.floor(lab.value / 6.6); return s.length > k ? s.slice(0, k - 1) + '…' : s; };
        const hover = (e, r) => c.showTip(e, {title: r.s.label, rows: [{name: 'Count', v: f(r.s.value)}, ...(r.conv != null ? [{name: 'Of previous', v: r.conv + '%'}, {name: 'Drop-off', v: f(p.stages[r.i - 1].value - r.s.value)}] : []), {name: 'Of first', v: Math.round(r.s.value / (p.stages[0].value || 1) * 100) + '%'}]});
        return {...c, f, RH, rows, lab, trunc, hover};
    },
    template: `<div class="k-chart" ref="root" @pointerleave="hideTip"><svg v-if="w" :width="w" :height="stages.length * RH" :viewBox="'0 0 ' + w + ' ' + stages.length * RH" role="img" :aria-label="title || 'Funnel'">
        <g v-for="r in rows" :key="r.i"><polygon class="k-fn" :points="r.pts" :style="{fill: r.fill}" @pointermove="hover($event, r)" @pointerdown="hover($event, r)"/>
            <text class="k-fn__l" x="0" :y="r.y + 19">{{ trunc(r.s.label) }}</text><text class="k-fn__v" x="0" :y="r.y + 35">{{ f(r.s.value) }}<tspan v-if="r.conv != null"> · {{ r.conv }}%</tspan></text></g></svg>${TIP}</div>`,
};

// Heatmap: data[row][col] numbers (default: 7 days by 24 hours), colour scale from the accent, legend with min and max.
export const Heatmap = {
    props: {data: {type: Array, default: () => []}, rowLabels: {type: Array, default: () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}, colLabels: {type: Array, default: () => Array.from({length: 24}, (_, i) => pad(i))}, format: Function, unit: {type: String, default: ''}, title: String},
    setup(p) {
        const c = useChart(() => p.data), {w, t} = c, LW = 36;
        const f = v => p.format ? p.format(v) : nf.format(v);
        const ext = computed(() => { const a = p.data.flat(); return {mn: Math.min(...a, 0), mx: Math.max(...a, 1)}; });
        const nc = computed(() => p.colLabels.length), cw = computed(() => Math.max(8, (w.value - LW - 2) / nc.value)), ch = computed(() => clamp(cw.value * .9, 18, 28));
        const cells = computed(() => p.data.flatMap((row, r) => row.map((v, k) => ({r, k, v, x: LW + k * cw.value, y: r * ch.value + 18, pc: Math.round(8 + 92 * ((v - ext.value.mn) / ((ext.value.mx - ext.value.mn) || 1)) * t.value)}))));
        const every = computed(() => cw.value >= 26 ? 2 : cw.value >= 14 ? 3 : 6);
        const hover = (e, x) => c.showTip(e, {title: p.rowLabels[x.r] + ' ' + p.colLabels[x.k], rows: [{name: p.unit || 'Value', v: f(x.v)}]});
        return {...c, f, LW, ext, cw, ch, cells, every, hover};
    },
    template: `<div class="k-chart k-hm" ref="root" @pointerleave="hideTip"><svg v-if="w" :width="w" :height="rowLabels.length * ch + 22" :viewBox="'0 0 ' + w + ' ' + (rowLabels.length * ch + 22)" role="img" :aria-label="title || 'Heatmap'">
        <g class="k-ax"><text v-for="(l, r) in rowLabels" :key="'r' + r" :x="LW - 8" :y="r * ch + 18 + ch / 2 + 4" text-anchor="end">{{ l }}</text><template v-for="(l, k) in colLabels" :key="'c' + k"><text v-if="k % every === 0" :x="LW + (k + .5) * cw" y="11" text-anchor="middle">{{ l }}</text></template></g>
        <rect v-for="x in cells" :key="x.r + '-' + x.k" class="k-cell" :x="x.x + 1" :y="x.y + 1" :width="Math.max(1, cw - 2)" :height="ch - 2" rx="4" :style="{fill: 'color-mix(in srgb, var(--accent-c) ' + x.pc + '%, transparent)'}" @pointermove="hover($event, x)" @pointerdown="hover($event, x)"/></svg>
        ${TIP}<div class="k-hm__scale" aria-hidden="true"><small>{{ f(ext.mn) }}</small><i></i><small>{{ f(ext.mx) }}</small></div></div>`,
};

// ---------- Kanban ----------
// columns: [{id, title, limit?}], cards: {columnId: [{id, title, ...}]}. Drag with pointer (long-press on touch) or keyboard (Space, arrows, Space). Emits move({id, from, to, index}).
// The board keeps its own copy of the lists, so it works uncontrolled; update your data in the `move` handler to keep the source in sync.
export const Kanban = {
    props: {columns: {type: Array, required: true}, cards: {type: Object, required: true}, cardKey: {type: String, default: 'id'}, label: {type: String, default: 'title'}, height: {type: String, default: '66vh'}},
    emits: ['move', 'card-click'],
    setup(p, {emit}) {
        const lists = reactive({}), drag = ref(null), say = ref(''), root = ref(null), board = ref(null), helpId = uid('kbh');
        const sync = () => p.columns.forEach(c => { lists[c.id] = (p.cards[c.id] || []).slice(); });
        sync(); watch(() => [p.cards, p.columns], sync, {deep: true});
        const id = c => c[p.cardKey], titleOf = c => String(c[p.label] ?? id(c));
        const colOf = cid => p.columns.find(c => String(c.id) === String(cid));
        const count = c => (lists[c.id] || []).length;
        const isOver = c => !!c.limit && count(c) > c.limit, atLimit = c => !!c.limit && count(c) === c.limit;
        const view = cid => {
            const d = drag.value, base = lists[cid] || []; if (!d) return base.map(c => ({c}));
            const out = base.filter(c => id(c) !== d.id).map(c => ({c}));
            if (d.to === cid) out.splice(Math.min(d.index, out.length), 0, d.mode === 'kb' ? {c: d.card, lifted: true} : {ph: true, h: d.h});
            if (d.mode === 'ptr' && d.from === cid) out.push({c: d.card, hide: true});
            return out;
        };
        const say_ = m => { say.value = m; };
        const lenWithout = (cid, did) => (lists[cid] || []).filter(c => id(c) !== did).length;
        const where = d => 'position ' + (d.index + 1) + ' of ' + (lenWithout(d.to, d.id) + 1) + ' in ' + colOf(d.to).title;

        function commit(d) {
            const fi = lists[d.from].findIndex(c => id(c) === d.id), [card] = lists[d.from].splice(fi, 1);
            lists[d.to].splice(d.index, 0, card);
            const changed = d.from !== d.to || fi !== d.index;
            if (changed) emit('move', {id: d.id, from: d.from, to: d.to, index: d.index});
            say_(changed ? 'Dropped ' + titleOf(card) + ' at ' + where(d) + '.' : 'Dropped ' + titleOf(card) + ', position unchanged.');
            const wip = colOf(d.to); if (changed && wip && isOver(wip)) say.value += ' Work in progress limit of ' + wip.title + ' exceeded.';
            drag.value = null;
        }

        // pointer drag
        let st = null, justDragged = false;
        const stop = e => { if (e.cancelable) e.preventDefault(); };
        function down(e, c, cid) {
            if ((e.pointerType === 'mouse' && e.button > 0) || drag.value || st) return;
            if (e.target.closest && e.target.closest('button, a, input, select, textarea, [data-nodrag]')) return;
            st = {id: id(c), from: cid, card: c, el: e.currentTarget, x0: e.clientX, y0: e.clientY, px: e.clientX, py: e.clientY, pid: e.pointerId, touch: e.pointerType !== 'mouse', started: false};
            addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', abort);
            if (st.touch) st.timer = setTimeout(begin, 380);
        }
        function move(e) {
            if (!st || e.pointerId !== st.pid) return; st.px = e.clientX; st.py = e.clientY;
            if (!st.started) { const d = Math.hypot(e.clientX - st.x0, e.clientY - st.y0); if (st.touch) { if (d > 9) cleanup(); } else if (d > 5) begin(); return; }
            if (e.cancelable) e.preventDefault(); place();
        }
        function begin() {
            if (!st || st.started) return; st.started = true; clearTimeout(st.timer);
            const r = st.el.getBoundingClientRect(), g = st.el.cloneNode(true);
            st.offX = st.x0 - r.left; st.offY = st.y0 - r.top;
            g.classList.add('k-kb__ghost'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px'; g.setAttribute('aria-hidden', 'true'); g.removeAttribute('tabindex'); g.removeAttribute('data-card');
            (root.value.closest('.v4') || document.body).appendChild(g); st.ghost = g;
            try { st.el.releasePointerCapture(st.pid); } catch (err) { /* no capture */ }
            drag.value = {id: st.id, card: st.card, from: st.from, to: st.from, index: lists[st.from].findIndex(c => id(c) === st.id), mode: 'ptr', h: r.height};
            document.addEventListener('touchmove', stop, {passive: false}); addEventListener('keydown', esc); document.documentElement.classList.add('k-dragging');
            if (st.touch && navigator.vibrate) navigator.vibrate(12);
            say_('Picked up ' + titleOf(st.card) + '.'); place(); loop();
        }
        function place() {
            const {px, py} = st; st.ghost.style.transform = 'translate(' + (px - st.offX) + 'px,' + (py - st.offY) + 'px) rotate(1.5deg)';
            let ce = null; for (const el of document.elementsFromPoint(px, py)) { const x = el.closest && el.closest('[data-col]'); if (x && root.value.contains(x)) { ce = x; break; } }
            if (!ce) return; const col = colOf(ce.dataset.col); if (!col) return;
            let index = 0; [...ce.querySelectorAll('[data-card]')].filter(el => el.dataset.card !== String(st.id)).forEach(el => { const r = el.getBoundingClientRect(); if (py > r.top + r.height / 2) index++; });
            const d = drag.value; if (d.to !== col.id || d.index !== index) { d.to = col.id; d.index = index; }
        }
        function loop() {   // auto-scroll near the edges of the board, of the column list under the pointer and of the page
            if (!st || !st.started) return; const {px, py} = st, E = 56, sp = (v, a, b) => v < a + E ? -Math.ceil((a + E - v) / 4) : v > b - E ? Math.ceil((v - (b - E)) / 4) : 0;
            const b = board.value, br = b.getBoundingClientRect(); let moved = false;
            const dx = clamp(sp(px, br.left, br.right), -22, 22); if (dx) { b.scrollLeft += dx; moved = true; }
            const list = document.elementsFromPoint(px, py).map(el => el.closest && el.closest('.k-kb__list')).find(Boolean);
            if (list) { const lr = list.getBoundingClientRect(), dy = clamp(sp(py, lr.top, lr.bottom), -22, 22); if (dy && list.scrollHeight > list.clientHeight) { list.scrollTop += dy; moved = true; } }
            const wy = clamp(sp(py, 0, innerHeight), -22, 22); if (wy) { scrollBy(0, wy); moved = true; }
            if (moved) place(); st.raf = requestAnimationFrame(loop);
        }
        function up(e) { if (!st || e.pointerId !== st.pid) return; const d = st.started ? drag.value : null; cleanup(); if (d) commit(d); }
        function abort() { if (!st) return; const was = st.started; cleanup(); if (was) { drag.value = null; say_('Move cancelled.'); } }
        const esc = e => { if (e.key === 'Escape') abort(); };
        function cleanup() {
            if (!st) return; clearTimeout(st.timer); cancelAnimationFrame(st.raf); if (st.ghost) st.ghost.remove();
            removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', abort); removeEventListener('keydown', esc); document.removeEventListener('touchmove', stop);
            document.documentElement.classList.remove('k-dragging'); if (st.started) { justDragged = true; setTimeout(() => { justDragged = false; }, 60); } st = null;
        }
        const ctx = e => { if (st) e.preventDefault(); };
        const clk = c => { if (!justDragged) emit('card-click', c); };

        // keyboard drag
        const refocus = did => nextTick(() => { const el = root.value && [...root.value.querySelectorAll('[data-card]')].find(x => x.dataset.card === String(did)); el && el.focus(); });
        function kdown(e, c, cid) {
            if (e.target !== e.currentTarget) return; const d = drag.value;
            if (!d) {
                if (e.key === ' ') { e.preventDefault(); drag.value = {id: id(c), card: c, from: cid, to: cid, index: lists[cid].findIndex(x => id(x) === id(c)), mode: 'kb', h: 0};
                    say_('Picked up ' + titleOf(c) + ', ' + where(drag.value) + '. Arrow keys move it, Space drops it, Escape cancels.'); refocus(id(c)); }
                else if (e.key === 'Enter') emit('card-click', c);
                return;
            }
            if (d.mode !== 'kb' || d.id !== id(c)) return;
            switch (e.key) {
                case 'ArrowUp': d.index = Math.max(0, d.index - 1); break;
                case 'ArrowDown': d.index = Math.min(lenWithout(d.to, d.id), d.index + 1); break;
                case 'ArrowLeft': case 'ArrowRight': { const n = p.columns[p.columns.findIndex(x => x.id === d.to) + (e.key === 'ArrowLeft' ? -1 : 1)]; if (!n) { e.preventDefault(); return; } d.to = n.id; d.index = Math.min(d.index, lenWithout(n.id, d.id)); break; }
                case ' ': case 'Enter': e.preventDefault(); commit(d); refocus(c[p.cardKey]); return;
                case 'Escape': e.preventDefault(); drag.value = null; say_('Move cancelled.'); refocus(id(c)); return;
                default: return;
            }
            e.preventDefault(); say_('Moved to ' + where(d) + '.'); refocus(d.id);
        }
        const blur = () => setTimeout(() => { if (drag.value && drag.value.mode === 'kb' && root.value && !root.value.contains(document.activeElement)) { drag.value = null; say_('Move cancelled.'); } }, 200);
        onBeforeUnmount(() => { if (st) cleanup(); });
        return {root, board, drag, say, helpId, lists, id, count, isOver, atLimit, view, down, kdown, ctx, clk, blur, titleOf};
    },
    template: `<div class="k-kb" ref="root">
        <div class="k-kb__board" ref="board" role="group" aria-label="Board">
            <section v-for="col in columns" :key="col.id" class="k-kb__col" :class="{over: drag && drag.to === col.id, warn: isOver(col), full: atLimit(col)}" :data-col="col.id" :aria-label="col.title + ', ' + count(col) + ' cards'">
                <header class="k-kb__h"><slot name="header" :column="col" :count="count(col)" :over="isOver(col)"><b>{{ col.title }}</b><span class="k-kb__n">{{ count(col) }}<template v-if="col.limit"> / {{ col.limit }}</template></span></slot></header>
                <p v-if="isOver(col)" class="k-kb__wip" role="status"><Ico n="alert" :s="14"/>Limit of {{ col.limit }} exceeded</p>
                <ul class="k-kb__list" :style="{maxHeight: height}">
                    <template v-for="it in view(col.id)" :key="it.ph ? 'ph' : id(it.c)">
                        <li v-if="it.ph" class="k-kb__ph" :style="{height: it.h + 'px'}" aria-hidden="true"></li>
                        <li v-else class="k-kb__card" :class="{lifted: it.lifted, hide: it.hide}" tabindex="0" role="button" :data-card="id(it.c)" aria-roledescription="draggable card" :aria-describedby="helpId" :aria-pressed="it.lifted ? 'true' : null" :aria-label="titleOf(it.c) + ', ' + col.title"
                            @pointerdown="down($event, it.c, col.id)" @keydown="kdown($event, it.c, col.id)" @click="clk(it.c)" @contextmenu="ctx" @blur="blur"><slot name="card" :card="it.c" :column="col">{{ titleOf(it.c) }}</slot></li>
                    </template>
                    <li v-if="!view(col.id).length" class="k-kb__empty">Drop cards here</li></ul>
                <slot name="footer" :column="col"/></section></div>
        <p :id="helpId" class="k-sr">Space picks a card up, arrow keys move it between and within columns, Space drops it, Escape cancels. On touch, press and hold, then drag.</p>
        <p class="k-sr" role="status" aria-live="assertive">{{ say }}</p></div>`,
};

// ---------- registration ----------
const ALL = {KCheck, Pagination, DataTable, Calendar, Timeline, TreeView, BarChart, LineChart, Gauge, FunnelChart, Heatmap, Kanban};
export function registerKitData(app) {
    Object.entries({...ALL, DemoData}).forEach(([k, v]) => app.component(k, v));
}

// ---------- showcase ----------
function demoOrders() {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
    const customers = ['Northwind Traders', 'Acme Logistics', 'Globex Retail', 'Initech', 'Umbrella Foods', 'Stark Supplies', 'Wayne Freight', 'Hooli Cloud', 'Soylent Market', 'Vandelay Imports', 'Wonka Sweets', 'Tyrell Labs'];
    return Array.from({length: 46}, (_, i) => ({id: 'SO-' + (4100 + i), customer: pick(customers), status: pick(['Paid', 'Paid', 'Pending', 'Shipped', 'Refunded']), amount: Math.round(300 + rnd() * 9200), date: isoDay(addDays(new Date(), -Math.floor(rnd() * 70))), owner: pick(['Mia Novak', 'Luka Petrov', 'Ana Horvat', 'Sam Brooks'])}));
}
export const DemoData = {
    setup() {
        const orders = reactive(demoOrders()), loading = ref(true), dens = ref('comfortable'), picked = ref([]), last = ref('');
        setTimeout(() => { loading.value = false; }, 900);
        const kind = {Paid: 'g', Pending: 'y', Shipped: 'b', Refunded: 'r'};
        const cols = [
            {key: 'id', label: 'Order', sortable: true, width: '100px'}, {key: 'customer', label: 'Customer', sortable: true, slot: 'customer'},
            {key: 'status', label: 'Status', sortable: true, slot: 'status', editable: true, options: ['Paid', 'Pending', 'Shipped', 'Refunded']},
            {key: 'amount', label: 'Amount', sortable: true, align: 'right', format: 'money', editable: true, type: 'number'}, {key: 'date', label: 'Date', sortable: true, format: 'date'}, {key: 'owner', label: 'Owner', sortable: true, hidden: true},
        ];
        const refund = rows => { rows.forEach(r => { r.status = 'Refunded'; }); toast(rows.length + ' orders marked as refunded'); };
        const pg = ref(4);
        // calendar
        const T = new Date(), ev = (n, time, title, color) => ({id: title + n, date: isoDay(addDays(T, n)), time, title, color});
        const events = [ev(0, '09:30', 'Standup', '#60a5fa'), ev(0, '14:00', 'Pricing review', '#fbbf24'), ev(0, '16:30', 'Call: Globex renewal', '#34d399'), ev(0, '17:30', 'Invoice run', '#fb7185'), ev(1, '11:00', 'Demo for Initech', '#34d399'), ev(2, '10:00', 'Board prep', '#a78bfa'), ev(3, '15:00', 'Contract signing', '#34d399'),
            ev(-2, '13:00', 'Supplier sync', '#60a5fa'), ev(-5, '09:00', 'Quarter planning', '#a78bfa'), ev(6, '12:00', 'Team lunch', '#fbbf24'), ev(9, '10:30', 'Onboarding: Wonka', '#34d399'), ev(-9, '16:00', 'Audit call', '#fb7185'), {id: 'trip', date: isoDay(addDays(T, 4)), end: isoDay(addDays(T, 6)), title: 'Trade fair Zagreb', color: '#a78bfa'}];
        const cal = reactive({view: 'month', date: isoDay(T), selected: isoDay(T), text: ''});
        const dayClick = d => { cal.selected = d; cal.text = 'Day: ' + d; }, evClick = e => { cal.text = 'Event: ' + e.title; };
        // timeline
        const at = (d, h, m) => { const x = addDays(T, d); x.setHours(h, m, 0, 0); return x.toISOString(); };
        const feed = [{id: 1, icon: 'check', at: at(0, 10, 12), title: 'Order SO-4121 paid', body: 'Northwind Traders, $4,820 by card.', status: 'ok'}, {id: 2, icon: 'mail', at: at(0, 9, 40), title: 'Quote sent to Initech', body: 'Version 3 with the volume discount.', status: 'info'},
            {id: 3, icon: 'alert', at: at(0, 8, 5), title: 'Payment failed', body: 'Umbrella Foods, card declined. Retry scheduled.', status: 'bad'}, {id: 4, icon: 'users', at: at(-1, 16, 20), title: 'New customer: Wonka Sweets', status: 'ok'}, {id: 5, icon: 'clock', at: at(-1, 11, 0), title: 'Invoice 2026-0412 overdue', body: '7 days past due.', status: 'warn'}, {id: 6, icon: 'gear', at: at(-3, 14, 30), title: 'Tax rates updated', status: 'muted'}];
        // tree
        const nodes = [{id: 'emea', label: 'EMEA', children: [{id: 'hr', label: 'Croatia', lazy: true}, {id: 'de', label: 'Germany', lazy: true}, {id: 'uk', label: 'United Kingdom', lazy: true}, {id: 'ae', label: 'UAE', disabled: true}]},
            {id: 'amer', label: 'Americas', children: [{id: 'us', label: 'United States', lazy: true}, {id: 'br', label: 'Brazil', lazy: true}]}, {id: 'apac', label: 'Asia Pacific', children: [{id: 'jp', label: 'Japan'}, {id: 'au', label: 'Australia'}]}];
        const cities = {hr: ['Zagreb', 'Split', 'Rijeka'], de: ['Berlin', 'Munich'], uk: ['London', 'Leeds', 'Bristol'], us: ['New York', 'Austin', 'Seattle'], br: ['Sao Paulo', 'Recife']};
        const load = n => new Promise(r => setTimeout(() => r((cities[n.id] || []).map(c => ({id: n.id + '-' + c, label: c}))), 650));
        const one = ref('hr'), many = ref([]), checked = ref(['jp']), exp = ref(['emea']);
        // charts
        const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
        const rev = [{name: 'Online', data: [42000, 47500, 51200, 49800, 58400, 64100]}, {name: 'Retail', data: [31000, 29400, 33800, 36200, 35100, 41300]}, {name: 'Partners', data: [12400, 15800, 14900, 18200, 21700, 24500]}];
        const weeks = Array.from({length: 12}, (_, i) => 'W' + (i + 1));
        const trend = [{name: 'Revenue', data: [18, 21, 19, 24, 27, 26, 31, 34, 33, 38, 41, 46]}, {name: 'Costs', data: [14, 15, 15, 17, 18, 19, 20, 22, 22, 24, 25, 27]}, {name: 'Refunds', data: [1.2, 1.5, 1.1, 1.8, 2.2, 1.6, 2.4, 2.1, 2.6, 2.2, 2.9, 3.1]}];
        const funnel = [{label: 'Visitors', value: 48200}, {label: 'Sign-ups', value: 9640}, {label: 'Trials', value: 4120}, {label: 'Paid', value: 1480}, {label: 'Retained', value: 1190}];
        let sd = 11; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        const heat = Array.from({length: 7}, (_, d) => Array.from({length: 24}, (_, hh) => Math.round((d < 5 ? 1 : .55) * (Math.exp(-Math.pow((hh - 11) / 3, 2)) * 60 + Math.exp(-Math.pow((hh - 20) / 2.5, 2)) * 48) + rr() * 8)));
        const money = v => '$' + short(v), stacked = ref(false), horiz = ref(false);
        // kanban
        const kcols = [{id: 'lead', title: 'Lead'}, {id: 'qual', title: 'Qualified', limit: 3}, {id: 'prop', title: 'Proposal'}, {id: 'won', title: 'Won'}];
        const deals = reactive({lead: [{id: 'd1', title: 'Retail chain rollout', co: 'Globex', v: 48000, p: 20}, {id: 'd2', title: 'Cold storage contract', co: 'Soylent', v: 22500, p: 15}], qual: [{id: 'd3', title: 'Annual license', co: 'Initech', v: 31000, p: 45}, {id: 'd4', title: 'Warehouse sensors', co: 'Wayne Freight', v: 64000, p: 50}, {id: 'd5', title: 'Pilot extension', co: 'Hooli', v: 12000, p: 40}, {id: 'd6', title: 'Support plan', co: 'Stark', v: 9800, p: 35}],
            prop: [{id: 'd7', title: 'Fleet tracking', co: 'Acme Logistics', v: 87000, p: 70}], won: [{id: 'd8', title: 'Spring promotion', co: 'Wonka', v: 15400, p: 100}]});
        const sum = id => deals[id].reduce((a, d) => a + d.v, 0);
        const moved = m => { const i = deals[m.from].findIndex(d => d.id === m.id); if (i < 0) return; const [d] = deals[m.from].splice(i, 1); deals[m.to].splice(m.index, 0, d); last.value = m.id + ': ' + m.from + ' to ' + m.to + ' at ' + m.index; };
        return {orders, loading, dens, picked, cols, kind, refund, pg, events, cal, dayClick, evClick, feed, nodes, load, one, many, checked, exp, months, rev, weeks, trend, funnel, heat, money, stacked, horiz, kcols, deals, sum, moved, last, short, toast, FMT};
    },
    template: `<div class="page k-demo">
        <Holder title="DataTable" sub="Sort (Shift for a second key), select, search, choose columns, edit Status and Amount, export CSV. Under 640 px every row becomes a card."><template #actions><Badge>{{ orders.length }} orders</Badge></template>
            <DataTable :columns="cols" :rows="orders" selectable :loading="loading" v-model:density="dens" export-name="orders" :default-sort="[{key: 'date', dir: 'desc'}]" @select="picked = $event">
                <template #customer="{row}"><span class="k-demo__who"><Avatar :name="row.customer" :size="26"/>{{ row.customer }}</span></template>
                <template #status="{value}"><Badge :kind="kind[value]">{{ value }}</Badge></template>
                <template #bulk="{rows, clear}"><button type="button" class="btn" @click="refund(rows); clear()">Mark refunded</button></template>
                <template #actions="{row}"><button type="button" class="k-ib" :aria-label="'Open ' + row.id" @click="toast('Opened ' + row.id)"><Ico n="chev" :s="16"/></button></template></DataTable></Holder>
        <div class="grid two">
            <Holder title="Pagination" sub="Standalone, compact on phones."><Pagination v-model:page="pg" :total="486" :size="20" :sizes="[10, 20, 50]"/><p class="lead">Current page: {{ pg }}</p></Holder>
            <Holder title="Timeline" sub="Grouped by day."><Timeline :items="feed" group-by-day/></Holder></div>
        <div class="grid two k-demo__cal">
            <Holder title="Calendar" :sub="cal.text || 'Arrow keys move between days, PageUp and PageDown change month.'"><Calendar v-model:view="cal.view" v-model:date="cal.date" :events="events" :selected="cal.selected" @day-click="dayClick" @event-click="evClick"/></Holder>
            <div class="k-demo__side"><Holder title="Mini calendar" sub="For sidebars."><Calendar mini :events="events" v-model:date="cal.date" :selected="cal.selected" @day-click="dayClick"/></Holder>
                <Holder title="Regions" sub="Single select, lazy cities."><TreeView :nodes="nodes" v-model="one" v-model:expanded="exp" :load="load" label="Regions"/></Holder></div></div>
        <div class="grid two">
            <Holder title="Tree, multi select"><TreeView :nodes="nodes" multiple v-model="many" :load="load" label="Regions, multiple"/><small>Selected: {{ many.length ? many.join(', ') : 'none' }}</small></Holder>
            <Holder title="Tree, checkboxes" sub="Indeterminate parents."><TreeView :nodes="nodes" checkboxes v-model:checked="checked" :load="load" label="Regions, checkboxes"/><small>Checked: {{ checked.length ? checked.join(', ') : 'none' }}</small></Holder></div>
        <Holder title="Revenue by channel" sub="Click the legend to hide a series."><template #actions><button type="button" class="chip" :class="{on: stacked}" @click="stacked = !stacked">Stacked</button><button type="button" class="chip" :class="{on: horiz}" @click="horiz = !horiz">Horizontal</button></template>
            <BarChart :labels="months" :series="rev" :stacked="stacked" :horizontal="horiz" :format="money" value-labels title="Revenue by channel"/></Holder>
        <div class="grid two">
            <Holder title="Weekly trend" sub="Smooth lines with area fill, in thousands."><LineChart :labels="weeks" :series="trend" area smooth :format="v => '$' + v + 'k'" title="Weekly trend"/></Holder>
            <Holder title="Revenue target" sub="Q4 goal"><Gauge :value="78" label="of $250k target"/><Gauge :value="31" label="Refund rate" :thresholds="[{to: 25, color: 'var(--ok)'}, {to: 60, color: 'var(--warn)'}, {to: 100, color: 'var(--bad)'}]"/></Holder></div>
        <div class="grid two">
            <Holder title="Conversion funnel"><FunnelChart :stages="funnel" title="Conversion funnel"/></Holder>
            <Holder title="Orders by day and hour"><Heatmap :data="heat" unit="Orders" title="Orders by day and hour"/></Holder></div>
        <Holder title="Pipeline board" sub="Drag a card, or focus it and press Space, then arrows, then Space. Qualified has a limit of 3."><template #actions><small v-if="last">Last move: {{ last }}</small></template>
            <Kanban :columns="kcols" :cards="deals" @move="moved">
                <template #header="{column, count, over}"><b>{{ column.title }}</b><Badge :kind="over ? 'r' : 'n'">{{ count }}<template v-if="column.limit"> / {{ column.limit }}</template></Badge><small class="k-kb__sum">{{ FMT.money(sum(column.id)) }}</small></template>
                <template #card="{card}"><div class="k-demo__deal"><b>{{ card.title }}</b><small>{{ card.co }}</small><span><b>{{ FMT.money(card.v) }}</b></span><Progress :value="card.p"/></div></template></Kanban></Holder></div>`,
};
