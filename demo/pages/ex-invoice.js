// Example page "Invoice": list with status totals, document in three layouts (paper, modern, glass), create/edit form with live preview, A4 print.
// Vue 3 browser build, no build step. Styled by demo/scss/_ex-invoice.scss (class prefix x-inv). Register with `registerExInvoice(app)`.
// Needs the global Ico, Holder, Segmented, GlassTabs and the kit DataTable, FormField and DatePicker. All data is invented and lives in memory only.
//
// MONEY: amounts are integer cents, quantities integer thousandths, tax and discount rates integer basis points (100 = 1 %).
// THE ROUNDING RULE: round to the nearest cent, halves up (no value is ever negative). It is applied to (1) each line net = quantity x unit price,
// (2) the discount of each tax-rate group, (3) the tax of each tax-rate group (on the discounted base). Every total is a plain sum of those
// rounded values, so the printed rows always add up. (Typed input with more decimals than allowed is rounded the same way.)
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { PATHS, toast } from 'glass/ui.js';

Object.assign(PATHS, {
    invPrint: 'M7 9V4h10v5M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3M7 14h10v6H7z', invSend: 'M4 11l16-7-6 16-3-6.5zM11 13.5L20 4', invCard: 'M4 6h16v12H4zM4 10h16M7 15h4',
    invEdit: 'M5 19h4L19 9l-4-4L5 15zM13 7l4 4', invCopy: 'M9 9h11v11H9zM5 15H4V4h11v1',
});

// ---------- money ----------
const MAX_QTY = 100000 * 1000, MAX_PRICE = 1000000 * 100, MAX_LINES = 100;   // keeps every sum far inside the safe integer range

// a * b / d as integers, nearest whole number, halves up
export const roundDiv = (a, b, d) => Number((BigInt(a) * BigInt(b) * 2n + BigInt(d)) / (BigInt(d) * 2n));

// "12,5" or "12.5" -> integer scaled by 10^places without floating point. null when the text is not a plain non-negative number or is above max.
export function toScaled(text, places, max = Number.MAX_SAFE_INTEGER) {
    const m = /^\s*(\d*)(?:[.,](\d*))?\s*$/.exec(String(text ?? ''));
    if (!m || !(m[1] || m[2])) return null;
    const frac = (m[2] || '').padEnd(places + 1, '0');
    const n = Number(m[1] || 0) * 10 ** places + Number(frac.slice(0, places) || 0) + (frac[places] >= '5' ? 1 : 0);
    return n <= max ? n : null;
}

const parseLine = l => ({qty: toScaled(l.qty, 3, MAX_QTY), price: toScaled(l.price, 2, MAX_PRICE)});
const parseDiscount = t => String(t ?? '').trim() === '' ? 0 : toScaled(t, 2, 10000);

export function computeInvoice(inv) {
    const discBp = parseDiscount(inv.discount) ?? 0;
    const lines = inv.lines.map(l => { const {qty, price} = parseLine(l); return {...l, qtyMilli: qty ?? 0, priceCents: price ?? 0, net: roundDiv(qty ?? 0, price ?? 0, 1000)}; });
    const byRate = new Map();
    lines.forEach(l => byRate.set(l.taxBp, (byRate.get(l.taxBp) || 0) + l.net));
    const taxes = [...byRate].sort((a, b) => b[0] - a[0]).map(([taxBp, net]) => {
        const discount = roundDiv(net, discBp, 10000), base = net - discount, tax = roundDiv(base, taxBp, 10000);
        return {taxBp, net, discount, base, tax, gross: base + tax};
    });
    const sum = k => taxes.reduce((a, t) => a + t[k], 0);
    return {lines, taxes, discBp, subtotal: sum('net'), discount: sum('discount'), base: sum('base'), tax: sum('tax'), total: sum('gross')};
}

const group = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const decimal = c => Math.floor(c / 100) + '.' + String(c % 100).padStart(2, '0');                       // 123450 -> "1234.50" (CSV, sorting)
export const money = c => (c < 0 ? '−' : '') + '€' + group(Math.floor(Math.abs(c) / 100)) + '.' + String(Math.abs(c) % 100).padStart(2, '0');
const quantity = q => { const f = String(q % 1000).padStart(3, '0').replace(/0+$/, ''); return group(Math.floor(q / 1000)) + (f ? '.' + f : ''); };
const percent = bp => bp / 100 + '%';

// ---------- dates (local ISO strings) ----------
const pad = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dateOf = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return isoOf(d) === s ? d : null; };
const today = () => isoOf(new Date());
const plusDays = (s, n) => { const d = dateOf(s) || new Date(); return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const showDate = s => { const d = dateOf(s); return d ? d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : '–'; };

// ---------- sample data: every company, address, address book entry and number below is invented ----------
const TAX_RATES = [{v: 2000, l: '20%'}, {v: 1000, l: '10%'}, {v: 550, l: '5.5%'}, {v: 0, l: '0%'}];
const SELLER = {name: 'Lumen Grove Studio', address: '12 Sample Street\n00000 Exampleton\nNowhereland', email: 'billing@lumen-grove.test', taxId: 'DEMO-VAT-000000001'};
const PAYMENT = [['Bank', 'Example Bank (invented)'], ['IBAN', 'XX00 DEMO 0000 0000 0000 00'], ['BIC', 'DEMOXX00XXX']];
const NOTE = 'Thank you for your business. Questions about this invoice: billing@lumen-grove.test.';
const client = (name, street, town, domain, n) => ({name, address: street + '\n' + town + '\nNowhereland', email: 'accounts@' + domain + '.test', taxId: 'DEMO-VAT-00000000' + n});
const CLIENTS = [
    client('Pebblecrest Foods', '4 Placeholder Road', '00001 Mockford', 'pebblecrest', 2), client('Orbit & Finch Logistics', '88 Dummy Wharf', '00002 Testhaven', 'orbit-finch', 3),
    client('Marlow Quill Press', '3 Lorem Lane', '00003 Fictonia', 'marlow-quill', 4), client('Tidewater Robotics', '51 Demo Avenue', '00004 Sampleby', 'tidewater', 5),
    client('Saffron Peak Hotels', '7 Specimen Square', '00005 Mockford', 'saffron-peak', 6), client('Nimbus Orchard Co-op', '19 Stand-in Yard', '00006 Testhaven', 'nimbus-orchard', 7),
];
const STATUS = {draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue'};
const statusOf = inv => inv.status === 'sent' && inv.due < today() ? 'overdue' : inv.status;

let seq = 0;
const line = (desc = '', qty = '1', unit = 'pcs', price = '', taxBp = 2000) => ({id: ++seq, desc, qty, unit, price, taxBp});
const copy = o => JSON.parse(JSON.stringify(o));

// client, stored status, issued days ago, payment term in days, discount %, lines. Oldest first.
const SAMPLES = [
    [2, 'paid', 96, 30, '', [['Editorial site redesign', '1', 'fixed', '6400.00'], ['Content migration', '18', 'h', '72.50'], ['Printed style guide', '40', 'pcs', '8.90', 550]]],
    [0, 'paid', 74, 14, '5', [['Brand photography', '2', 'days', '780.00'], ['Image licences', '25', 'pcs', '14.00', 1000]]],
    [3, 'sent', 52, 30, '', [['Dashboard prototype', '36.5', 'h', '95.00'], ['User interviews', '6', 'pcs', '180.00']]],
    [4, 'paid', 41, 14, '', [['Booking page design', '1', 'fixed', '2350.00'], ['Menu translation', '12', 'pages', '38.00', 1000]]],
    [1, 'sent', 33, 14, '10', [['Fleet portal, sprint 4', '64', 'h', '88.00'], ['Hosting, one quarter', '3', 'months', '129.00'], ['On-site workshop', '1', 'days', '950.00']]],
    [5, 'sent', 12, 30, '', [['Packaging illustrations', '9', 'pcs', '210.00'], ['Print proofs', '3', 'pcs', '24.75', 550]]],
    [0, 'sent', 6, 21, '2.5', [['Campaign landing page', '1', 'fixed', '1890.00'], ['Copywriting', '7.25', 'h', '66.00'], ['Export of source files', '1', 'fixed', '0.00', 0]]],
    [3, 'draft', 2, 14, '', [['Support retainer', '10', 'h', '84.00'], ['Training session', '2', 'pcs', '320.00', 1000]]],
    [4, 'draft', 0, 14, '', [['Signage concept', '1', 'fixed', '1275.50']]],
];
const invoices = reactive(SAMPLES.map(([c, status, ago, term, discount, rows], i) => {
    const issued = plusDays(today(), -ago);
    return {id: i + 1, number: 'INV-' + issued.slice(0, 4) + '-' + String(41 + i).padStart(4, '0'), status, issued, due: plusDays(issued, term), discount,
        seller: copy(SELLER), buyer: copy(CLIENTS[c]), lines: rows.map(r => line(...r)), notes: NOTE};
}).reverse());

// ---------- shared view state (kept while you move between pages) ----------
const currentId = ref(invoices[0].id), layout = ref('paper'), filter = ref('all');
const LAYOUTS = [{v: 'paper', l: 'Paper'}, {v: 'modern', l: 'Modern'}, {v: 'glass', l: 'Glass'}];

const nextNumber = () => 'INV-' + today().slice(0, 4) + '-' + String(1 + Math.max(0, ...invoices.map(i => +(/(\d+)$/.exec(i.number)?.[1] || 0)))).padStart(4, '0');
const blank = () => ({id: null, number: nextNumber(), status: 'draft', issued: today(), due: plusDays(today(), 14), discount: '', seller: copy(SELLER),
    buyer: {name: '', address: '', email: '', taxId: ''}, lines: [line()], notes: NOTE});
const draft = reactive(blank()), tried = ref(false);
let baseline = JSON.stringify(draft);
const isDirty = () => JSON.stringify(draft) !== baseline;
function loadDraft(data, unsaved = false) { Object.assign(draft, data); tried.value = false; baseline = unsaved ? '' : JSON.stringify(draft); }

// ---------- components ----------
export const InvStatus = {
    props: {status: String},
    setup: () => ({STATUS}),
    template: `<span class="x-inv-st" :data-st="status">{{ STATUS[status] }}</span>`,
};

export const InvDocument = {   // the invoice itself; `layout` is paper, modern or glass
    components: {InvStatus},
    props: {invoice: {type: Object, required: true}, layout: {type: String, default: 'paper'}},
    setup(p) {
        const sums = computed(() => computeInvoice(p.invoice));
        const initials = computed(() => (p.invoice.seller.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
        return {sums, initials, status: computed(() => statusOf(p.invoice)), PAYMENT, money, quantity, percent, showDate};
    },
    template: `<article class="x-inv-doc" :class="'x-inv-doc--' + layout" :aria-label="'Invoice ' + invoice.number">
        <div class="x-inv-doc__head">
            <div class="x-inv-doc__brand"><span class="x-inv-doc__logo" aria-hidden="true">{{ initials }}</span><b>{{ invoice.seller.name || 'Your company' }}</b></div>
            <div class="x-inv-doc__title"><h2>Invoice</h2><span class="x-inv-doc__no">{{ invoice.number || 'No number' }}</span><InvStatus :status="status"/></div></div>
        <div class="x-inv-doc__parties">
            <div><h3>From</h3><b>{{ invoice.seller.name || 'Your company' }}</b><p>{{ invoice.seller.address }}</p><p>{{ invoice.seller.email }}</p><p v-if="invoice.seller.taxId">Tax ID: {{ invoice.seller.taxId }}</p></div>
            <div><h3>Bill to</h3><b>{{ invoice.buyer.name || 'Client name' }}</b><p>{{ invoice.buyer.address }}</p><p>{{ invoice.buyer.email }}</p><p v-if="invoice.buyer.taxId">Tax ID: {{ invoice.buyer.taxId }}</p></div>
            <dl class="x-inv-doc__meta"><div><dt>Issue date</dt><dd>{{ showDate(invoice.issued) }}</dd></div><div><dt>Due date</dt><dd>{{ showDate(invoice.due) }}</dd></div><div><dt>Currency</dt><dd>EUR</dd></div></dl></div>
        <table class="x-inv-tbl x-inv-tbl--lines" role="table" aria-label="Line items">
            <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Description</th><th role="columnheader" scope="col" class="num">Quantity</th><th role="columnheader" scope="col" class="num">Unit price</th><th role="columnheader" scope="col" class="num">Tax</th><th role="columnheader" scope="col" class="num">Net amount</th></tr></thead>
            <tbody role="rowgroup"><tr v-for="l in sums.lines" :key="l.id" role="row">
                <td role="cell" class="x-inv-tbl__main">{{ l.desc || 'Line description' }}</td>
                <td role="cell" class="num" data-label="Quantity">{{ quantity(l.qtyMilli) }} {{ l.unit }}</td>
                <td role="cell" class="num" data-label="Unit price">{{ money(l.priceCents) }}</td>
                <td role="cell" class="num" data-label="Tax">{{ percent(l.taxBp) }}</td>
                <td role="cell" class="num" data-label="Net amount">{{ money(l.net) }}</td></tr></tbody></table>
        <div class="x-inv-doc__sums">
            <div class="x-inv-doc__taxes"><h3>Tax summary</h3>
                <table class="x-inv-tbl" role="table" aria-label="Tax summary">
                    <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Rate</th><th role="columnheader" scope="col" class="num">Taxable</th><th role="columnheader" scope="col" class="num">Tax</th><th role="columnheader" scope="col" class="num">Gross</th></tr></thead>
                    <tbody role="rowgroup"><tr v-for="t in sums.taxes" :key="t.taxBp" role="row"><td role="cell" class="x-inv-tbl__main">{{ percent(t.taxBp) }}</td><td role="cell" class="num" data-label="Taxable">{{ money(t.base) }}</td><td role="cell" class="num" data-label="Tax">{{ money(t.tax) }}</td><td role="cell" class="num" data-label="Gross">{{ money(t.gross) }}</td></tr></tbody></table></div>
            <dl class="x-inv-doc__totals">
                <div><dt>Subtotal</dt><dd>{{ money(sums.subtotal) }}</dd></div>
                <template v-if="sums.discount"><div><dt>Discount ({{ percent(sums.discBp) }})</dt><dd>−{{ money(sums.discount) }}</dd></div>
                    <div><dt>Net after discount</dt><dd>{{ money(sums.base) }}</dd></div></template>
                <div><dt>Tax</dt><dd>{{ money(sums.tax) }}</dd></div>
                <div class="x-inv-doc__total"><dt>{{ status === 'paid' ? 'Total (paid)' : 'Total due' }}</dt><dd>{{ money(sums.total) }}</dd></div></dl></div>
        <div class="x-inv-doc__foot">
            <div><h3>Payment details</h3><dl class="x-inv-doc__pay"><div v-for="r in PAYMENT" :key="r[0]"><dt>{{ r[0] }}</dt><dd>{{ r[1] }}</dd></div><div><dt>Reference</dt><dd>{{ invoice.number }}</dd></div></dl><p class="x-inv-doc__fine">Placeholder only. Do not pay to these details.</p></div>
            <div v-if="invoice.notes"><h3>Notes</h3><p>{{ invoice.notes }}</p></div></div>
        <p class="x-inv-doc__fine x-inv-doc__demo">Sample document with invented companies and numbers. Not a real invoice.</p></article>`,
};

export const InvList = {
    components: {InvStatus},
    emits: ['open', 'create'],
    setup() {
        const rows = computed(() => invoices.map(i => ({id: i.id, number: i.number, client: i.buyer.name, issued: i.issued, due: i.due, st: statusOf(i), cents: computeInvoice(i).total}))
            .map(r => ({...r, total: decimal(r.cents), status: STATUS[r.st]})));
        const stats = computed(() => ['all', ...Object.keys(STATUS)].map(id => {
            const set = rows.value.filter(r => id === 'all' || r.st === id);
            return {id, label: id === 'all' ? 'All invoices' : STATUS[id], count: set.length, sum: money(set.reduce((a, r) => a + r.cents, 0))};
        }));
        const shown = computed(() => rows.value.filter(r => filter.value === 'all' || r.st === filter.value));
        const open = computed(() => money(rows.value.filter(r => r.st === 'sent' || r.st === 'overdue').reduce((a, r) => a + r.cents, 0)));
        const columns = [{key: 'number', label: 'Number', sortable: true, slot: 'number'}, {key: 'client', label: 'Client', sortable: true}, {key: 'issued', label: 'Issued', sortable: true, format: 'date'},
            {key: 'due', label: 'Due', sortable: true, format: 'date'}, {key: 'status', label: 'Status', sortable: true, slot: 'status'}, {key: 'total', label: 'Total', sortable: true, align: 'right', format: (v, r) => money(r.cents)}];
        return {filter, stats, shown, open, columns};
    },
    template: `<div class="x-inv-list">
        <div class="x-inv-stats" role="group" aria-label="Filter by status"><button v-for="s in stats" :key="s.id" type="button" class="x-inv-stat" :data-st="s.id" :class="{on: filter === s.id}" :aria-pressed="filter === s.id" @click="filter = s.id">
            <span class="x-inv-stat__l"><i aria-hidden="true"></i>{{ s.label }}<em>{{ s.count }}</em></span><b>{{ s.sum }}</b></button></div>
        <Holder title="Invoices" :sub="'Waiting for payment (sent and overdue): ' + open"><template #actions><button type="button" class="btn primary" @click="$emit('create')"><Ico n="plus" :s="16"/>New invoice</button></template>
            <DataTable :columns="columns" :rows="shown" row-key="id" :page-size="10" export-name="invoices" empty-text="No invoices match.">
                <template #number="{row}"><button type="button" class="x-inv-open" @click="$emit('open', row.id)">{{ row.number }}</button></template>
                <template #status="{row}"><InvStatus :status="row.st"/></template>
                <template #actions="{row}"><button type="button" class="k-ib" :aria-label="'Open ' + row.number" title="Open" @click="$emit('open', row.id)"><Ico n="chev" :s="18"/></button></template></DataTable></Holder></div>`,
};

export const InvViewer = {   // document view: pick an invoice and a layout, print, and the demo actions
    components: {InvDocument},
    emits: ['edit', 'duplicate'],
    setup() {
        const inv = computed(() => invoices.find(i => i.id === currentId.value) || invoices[0]);
        const status = computed(() => statusOf(inv.value));
        const send = () => toast('Demo: nothing is sent. A real app would send ' + inv.value.number + ' from its server.');
        const pay = () => toast('Demo: no payment is taken. A real app would open a payment page.');
        return {invoices, currentId, layout, LAYOUTS, inv, status, send, pay, print: () => window.print(), pick: e => currentId.value = +e.target.value};
    },
    template: `<div class="x-inv-view">
        <Holder flat><div class="x-inv-bar">
            <label class="field x-inv-bar__pick"><span>Invoice</span><div class="field__box"><select :value="inv.id" @change="pick"><option v-for="i in invoices" :key="i.id" :value="i.id">{{ i.number }} · {{ i.buyer.name }}</option></select></div></label>
            <div class="field"><span>Layout</span><Segmented v-model="layout" :options="LAYOUTS"/></div>
            <div class="x-inv-bar__act">
                <button v-if="status === 'draft'" type="button" class="btn" @click="$emit('edit', inv)"><Ico n="invEdit" :s="16"/>Edit</button>
                <button type="button" class="btn" @click="$emit('duplicate', inv)"><Ico n="invCopy" :s="16"/>Duplicate</button>
                <button type="button" class="btn" @click="send"><Ico n="invSend" :s="16"/>Send</button>
                <button type="button" class="btn" :disabled="status === 'paid'" @click="pay"><Ico n="invCard" :s="16"/>Pay</button>
                <button type="button" class="btn primary" @click="print"><Ico n="invPrint" :s="16"/>Print</button></div></div></Holder>
        <div class="x-inv-sheet x-inv-print"><InvDocument :invoice="inv" :layout="layout"/></div></div>`,
};

export const InvLines = {   // line editor: add, remove, move up and down; keeps focus where the user is working
    props: {lines: {type: Array, required: true}, errors: {type: Object, default: () => ({})}},
    setup(p) {
        const root = ref(null), said = ref('');
        const focus = sel => nextTick(() => root.value?.querySelector(sel)?.focus());
        function add() { if (p.lines.length >= MAX_LINES) return; const l = line(); p.lines.push(l); said.value = 'Line ' + p.lines.length + ' added'; focus('[data-desc="' + l.id + '"]'); }
        function remove(i) {
            if (p.lines.length < 2) return; p.lines.splice(i, 1); said.value = 'Line ' + (i + 1) + ' removed';
            focus('[data-desc="' + p.lines[Math.min(i, p.lines.length - 1)].id + '"]');
        }
        function move(i, d) {
            const j = i + d; if (j < 0 || j >= p.lines.length) return;
            const [l] = p.lines.splice(i, 1); p.lines.splice(j, 0, l); said.value = 'Line moved to position ' + (j + 1) + ' of ' + p.lines.length;
            const end = j === 0 || j === p.lines.length - 1, dir = end ? (j === 0 ? 'down' : 'up') : (d < 0 ? 'up' : 'down');   // an end button is disabled, so focus its partner
            focus('[data-mv="' + l.id + ':' + dir + '"]');
        }
        const net = l => money(computeInvoice({lines: [l]}).subtotal);
        return {root, said, add, remove, move, net, TAX_RATES, MAX_LINES};
    },
    template: `<div class="x-inv-lines" ref="root"><TransitionGroup name="row" tag="ol">
        <li v-for="(l, i) in lines" :key="l.id" class="x-inv-line" :aria-label="'Line ' + (i + 1)">
            <label class="field x-inv-line__desc"><span>Line {{ i + 1 }}: description</span><div class="field__box"><input v-model="l.desc" :data-desc="l.id" maxlength="200" placeholder="What was delivered?" :aria-invalid="!!errors[l.id]?.desc"></div></label>
            <label class="field"><span>Quantity</span><div class="field__box"><input v-model="l.qty" inputmode="decimal" :aria-invalid="!!errors[l.id]?.qty"></div></label>
            <label class="field"><span>Unit</span><div class="field__box"><input v-model="l.unit" maxlength="12"></div></label>
            <label class="field"><span>Unit price (€)</span><div class="field__box"><input v-model="l.price" inputmode="decimal" placeholder="0.00" :aria-invalid="!!errors[l.id]?.price"></div></label>
            <label class="field"><span>Tax</span><div class="field__box"><select v-model.number="l.taxBp"><option v-for="t in TAX_RATES" :key="t.v" :value="t.v">{{ t.l }}</option></select></div></label>
            <p v-if="errors[l.id]" class="x-inv-err" role="alert">{{ Object.values(errors[l.id]).join(' ') }}</p>
            <div class="x-inv-line__foot"><span>Net <b>{{ net(l) }}</b></span>
                <button type="button" class="x-inv-ib" :data-mv="l.id + ':up'" :disabled="i === 0" :aria-label="'Move line ' + (i + 1) + ' up'" title="Move up" @click="move(i, -1)"><Ico n="up" :s="18"/></button>
                <button type="button" class="x-inv-ib" :data-mv="l.id + ':down'" :disabled="i === lines.length - 1" :aria-label="'Move line ' + (i + 1) + ' down'" title="Move down" @click="move(i, 1)"><Ico n="down" :s="18"/></button>
                <button type="button" class="x-inv-ib" :disabled="lines.length < 2" :aria-label="'Remove line ' + (i + 1)" title="Remove" @click="remove(i)"><Ico n="trash" :s="18"/></button></div></li></TransitionGroup>
        <button type="button" class="btn x-inv-lines__add" :disabled="lines.length >= MAX_LINES" @click="add"><Ico n="plus" :s="16"/>Add line</button>
        <span class="k-sr" aria-live="polite">{{ said }}</span></div>`,
};

export const InvEditor = {
    components: {InvDocument, InvLines},
    emits: ['saved'],
    setup(p, {emit}) {
        // every problem of the draft; wrong numbers show at once, missing values after the first try to save
        const problems = computed(() => {
            const e = {lines: {}}, number = draft.number.trim();
            if (!number) e.number = 'Give the invoice a number.';
            else if (invoices.some(i => i.id !== draft.id && i.number === number)) e.number = 'This number is already used.';
            if (!dateOf(draft.issued)) e.issued = 'Choose the issue date.';
            if (!dateOf(draft.due)) e.due = 'Choose the due date.'; else if (draft.due < draft.issued) e.due = 'The due date is before the issue date.';
            if (parseDiscount(draft.discount) === null) e.discount = 'Use a number from 0 to 100.';
            if (!draft.buyer.name.trim()) e.buyer = 'Add the client name.';
            if (draft.buyer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.buyer.email.trim())) e.email = 'Check the email address.';
            draft.lines.forEach(l => {
                const x = {}, {qty, price} = parseLine(l);
                if (!l.desc.trim()) x.desc = 'Add a description.';
                if (!qty) x.qty = 'Quantity: more than 0, up to 100,000.';
                if (price === null) x.price = 'Price: 0 to 1,000,000.';
                if (Object.keys(x).length) e.lines[l.id] = x;
            });
            return e;
        });
        const errors = computed(() => {
            if (tried.value) return problems.value;
            const all = problems.value, lines = {};
            draft.lines.forEach(l => {
                const x = {...all.lines[l.id]}; delete x.desc;
                if (!String(l.qty).trim()) delete x.qty; if (!String(l.price).trim()) delete x.price;
                if (Object.keys(x).length) lines[l.id] = x;
            });
            return {lines, discount: all.discount, due: dateOf(draft.due) ? all.due : undefined};
        });
        function save() {
            tried.value = true;
            const e = problems.value;
            if (Object.keys(e).length > 1 || Object.keys(e.lines).length) return toast('Check the marked fields', 'err');
            const inv = copy(draft); inv.number = inv.number.trim(); inv.status = 'draft';
            const at = invoices.findIndex(i => i.id === inv.id);
            if (at > -1) invoices.splice(at, 1, inv); else { inv.id = 1 + Math.max(0, ...invoices.map(i => i.id)); invoices.unshift(inv); }
            currentId.value = inv.id; loadDraft(blank()); toast('Saved in this demo only. It is gone after a reload.'); emit('saved');
        }
        const clear = () => { loadDraft(blank()); toast('Form cleared'); };
        const useClient = e => { const c = CLIENTS[e.target.value]; if (c) Object.assign(draft.buyer, c); e.target.value = ''; };
        return {draft, errors, layout, LAYOUTS, CLIENTS, save, clear, useClient, print: () => window.print()};
    },
    template: `<div class="x-inv-editw"><div class="x-inv-edit">
        <div class="x-inv-edit__form">
            <Holder :title="draft.id ? 'Edit draft' : 'New invoice'" sub="The preview follows what you type">
                <div class="x-inv-grid">
                    <label class="field"><span>Invoice number</span><div class="field__box"><input v-model="draft.number" maxlength="30" :aria-invalid="!!errors.number"></div><span v-if="errors.number" class="x-inv-err" role="alert">{{ errors.number }}</span></label>
                    <label class="field"><span>Discount (%)</span><div class="field__box"><input v-model="draft.discount" inputmode="decimal" placeholder="0" :aria-invalid="!!errors.discount"></div><span v-if="errors.discount" class="x-inv-err" role="alert">{{ errors.discount }}</span></label>
                    <FormField label="Issue date" required :error="errors.issued"><DatePicker v-model="draft.issued" :clearable="false"/></FormField>
                    <FormField label="Due date" required :error="errors.due"><DatePicker v-model="draft.due" :clearable="false" :min="draft.issued"/></FormField></div></Holder>
            <Holder title="Client">
                <label class="field"><span>Fill from a sample client</span><div class="field__box"><select value="" @change="useClient"><option value="">Choose…</option><option v-for="(c, i) in CLIENTS" :key="c.name" :value="i">{{ c.name }}</option></select></div></label>
                <div class="x-inv-grid">
                    <label class="field"><span>Name</span><div class="field__box"><input v-model="draft.buyer.name" maxlength="120" :aria-invalid="!!errors.buyer"></div><span v-if="errors.buyer" class="x-inv-err" role="alert">{{ errors.buyer }}</span></label>
                    <label class="field"><span>Email</span><div class="field__box"><input v-model="draft.buyer.email" type="email" maxlength="120" placeholder="accounts@company.test" :aria-invalid="!!errors.email"></div><span v-if="errors.email" class="x-inv-err" role="alert">{{ errors.email }}</span></label>
                    <label class="field"><span>Address</span><div class="field__box"><textarea v-model="draft.buyer.address" rows="3" maxlength="300"></textarea></div></label>
                    <label class="field"><span>Tax ID</span><div class="field__box"><input v-model="draft.buyer.taxId" maxlength="40"></div></label></div>
                <details class="x-inv-more"><summary>Seller details</summary><div class="x-inv-grid">
                    <label class="field"><span>Name</span><div class="field__box"><input v-model="draft.seller.name" maxlength="120"></div></label>
                    <label class="field"><span>Email</span><div class="field__box"><input v-model="draft.seller.email" type="email" maxlength="120"></div></label>
                    <label class="field"><span>Address</span><div class="field__box"><textarea v-model="draft.seller.address" rows="3" maxlength="300"></textarea></div></label>
                    <label class="field"><span>Tax ID</span><div class="field__box"><input v-model="draft.seller.taxId" maxlength="40"></div></label></div></details></Holder>
            <Holder title="Line items" sub="Prices without tax"><InvLines :lines="draft.lines" :errors="errors.lines"/></Holder>
            <Holder><label class="field"><span>Notes</span><div class="field__box"><textarea v-model="draft.notes" rows="3" maxlength="600"></textarea></div></label>
                <div class="actions"><button type="button" class="btn" @click="clear">Clear</button><button type="button" class="btn primary" @click="save"><Ico n="check" :s="16"/>Save draft</button></div></Holder></div>
        <div class="x-inv-edit__prev">
            <Holder flat><div class="x-inv-bar"><div class="field"><span>Preview layout</span><Segmented v-model="layout" :options="LAYOUTS"/></div><div class="x-inv-bar__act"><button type="button" class="btn" @click="print"><Ico n="invPrint" :s="16"/>Print preview</button></div></div></Holder>
            <div class="x-inv-sheet x-inv-print"><InvDocument :invoice="draft" :layout="layout"/></div></div></div></div>`,
};

// ---------- page ----------
const VIEWS = ['list', 'document', 'new'];
export const DemoInvoice = {
    components: {InvList, InvViewer, InvEditor},
    props: {sub: String},
    emits: ['sub'],
    setup(p, {emit}) {
        const norm = s => VIEWS.includes(s) ? s : 'list';
        const view = ref(norm(p.sub)); watch(() => p.sub, s => view.value = norm(s));
        const go = v => { if (v === view.value) return; view.value = v; emit('sub', v); };
        const items = computed(() => [{id: 'list', label: 'Invoices'}, {id: 'document', label: 'Document'}, {id: 'new', label: draft.id ? 'Edit' : 'New'}]);
        const open = id => { currentId.value = id; go('document'); };
        // starting something else never throws away typed work without saying so
        function create() { if (isDirty()) toast('Your unsaved draft is still here. Use Clear to start over.'); else loadDraft(blank()); go('new'); }
        function replace(data, unsaved) { if (isDirty()) toast('The earlier unsaved draft was replaced'); loadDraft(data, unsaved); go('new'); }
        const edit = inv => { if (draft.id === inv.id && isDirty()) return go('new'); replace(copy(inv), false); };
        const duplicate = inv => replace({...copy(inv), id: null, number: nextNumber(), status: 'draft', issued: today(), due: plusDays(today(), 14), lines: inv.lines.map(l => ({...l, id: ++seq}))}, true);
        return {view, items, go, open, create, edit, duplicate};
    },
    template: `<div class="page x-inv-page">
        <Holder flat><div class="lab"><GlassTabs :items="items" :model-value="view" @update:model-value="go"/></div></Holder>
        <Transition name="fade" mode="out-in"><div :key="view" class="x-inv-pane">
            <InvList v-if="view === 'list'" @open="open" @create="create"/>
            <InvViewer v-else-if="view === 'document'" @edit="edit" @duplicate="duplicate"/>
            <InvEditor v-else @saved="go('document')"/></div></Transition></div>`,
};

export function registerExInvoice(app) {
    Object.entries({InvStatus, InvDocument, InvList, InvViewer, InvLines, InvEditor, DemoInvoice}).forEach(([k, c]) => app.component(k, c));
}
