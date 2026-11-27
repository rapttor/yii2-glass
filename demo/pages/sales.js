// The sales example (invented data): Overview, Pipeline, Leads, Contacts and the "New deal" sheet.
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, inject } from 'vue';
import { toast } from 'glass/ui.js';

const ui = reactive({deal: false});
const openDeal = () => { ui.deal = true; };

const money = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'k' : '$' + v;
const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation'];
const deals = reactive([
    {id: 1, t: 'Factory floor CRM', co: 'Northwind', v: 64000, s: 'Lead', p: 20}, {id: 2, t: 'Supplier portal', co: 'Fabrikam', v: 37000, s: 'Lead', p: 15}, {id: 3, t: 'Warehouse scanners', co: 'Contoso', v: 31000, s: 'Lead', p: 25}, {id: 4, t: 'Design system audit', co: 'Initech', v: 15200, s: 'Lead', p: 10},
    {id: 5, t: 'Lead data sync', co: 'Globex', v: 52000, s: 'Qualified', p: 40}, {id: 6, t: 'Loyalty programme', co: 'Umbrella', v: 20000, s: 'Qualified', p: 45}, {id: 7, t: 'Memory POS upgrade', co: 'Hooli', v: 8800, s: 'Qualified', p: 50},
    {id: 8, t: 'Cloud network licence', co: 'Stark Ind.', v: 114000, s: 'Proposal', p: 65}, {id: 9, t: 'Retail analytics', co: 'Wayne Corp', v: 42000, s: 'Proposal', p: 60}, {id: 10, t: 'Grid monitoring', co: 'Acme', v: 61000, s: 'Negotiation', p: 85}, {id: 11, t: 'Annual platform licence', co: 'Soylent', v: 48000, s: 'Negotiation', p: 90},
]);
const NAMES = ['Sofia Brandt', 'Marcus Lee', 'Priya Nair', 'Tomas Vega', 'Hana Sato', 'Elias Kron', 'Mara Quinn', 'Dario Costa', 'Yuki Mori', 'Lena Fox'];
const CO = ['Northwind', 'Fabrikam', 'Contoso', 'Initech', 'Globex', 'Umbrella', 'Hooli', 'Stark Ind.', 'Wayne Corp', 'Acme'];
const leads = NAMES.map((n, i) => ({id: i, name: n, co: CO[i], score: 92 - i * 7, stage: ['Hot', 'Warm', 'New', 'Warm', 'Hot'][i % 5], value: 8000 + i * 6300, owner: ['Leah', 'Omar', 'Ines'][i % 3], mail: n.toLowerCase().replace(' ', '.') + '@' + CO[i].toLowerCase().replace(/[^a-z]/g, '') + '.test', last: [2, 5, 1, 9, 3][i % 5] + 'd ago'}));
const REV = {'7d': [38, 44, 41, 56, 52, 63, 71], '30d': Array.from({length: 30}, (_, i) => Math.round(30 + i * 2.6 + Math.sin(i / 2.2) * 6)), '12m': [61, 70, 66, 82, 90, 88, 104, 112, 109, 126, 133, 148]};
const LAB = {'7d': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], '30d': Array.from({length: 30}, (_, i) => 'D' + (i + 1)), '12m': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']};

export const Overview = {
    setup() {
        const range = ref('12m'), call = ref(false), pos = ref(32);
        let timer; watch(call, on => { clearInterval(timer); if (on) timer = setInterval(() => pos.value = pos.value >= 100 ? 0 : pos.value + 2, 400); }); onBeforeUnmount(() => clearInterval(timer));
        const hot = computed(() => [...deals].sort((a, b) => b.p - a.p).slice(0, 3));
        return {openDeal, range, data: computed(() => REV[range.value]), labels: computed(() => LAB[range.value]), ranges: ['7d', '30d', '12m'], call, pos, hot, money,
            agenda: [['09:30', 'Pricing review, Northwind', 'g'], ['11:00', 'Demo for Fabrikam', 'y'], ['15:15', 'Contract call, Stark Ind.', 'r']], lead: leads[0]};
    },
    template: `<div class="page stag">
        <div class="grid kpis">
            <Stat label="Won this month" icon="wallet" value="$229k" delta="+12.4%" :data="[3,5,4,7,6,9,8,11]"/><Stat label="Open pipeline" icon="pipe" value="$846k" delta="+6.1%" :data="[5,6,6,8,7,9,10,10]"/>
            <Card class="stat"><div class="stat__t"><span class="stat__i"><Ico n="target" :s="16"/></span><small>Q4 quota</small></div><div class="ringbox"><span class="ring5" style="--p:36%"><b>36%</b></span><small>$229k of $640k</small></div></Card>
            <Stat label="New leads" icon="users" value="14" delta="+3" :data="[2,3,3,5,4,6,7,9]"/></div>
        <div class="grid main2">
            <Holder title="Revenue" sub="Closed-won, all regions"><template #actions><Segmented v-model="range" :options="ranges"/></template><div class="big">$3.62M <Badge kind="g">+18.2%</Badge></div><AreaChart :data="data" :labels="labels"/></Holder>
            <Holder class="callh" flat><div class="who5"><span class="av5"><Avatar :name="lead.name" :size="54"/></span><div><b>{{ lead.name }}</b><small>{{ lead.co }} · VP Operations</small></div></div>
                <p class="lead">Asking for volume pricing across 38 stores. Wants a revised quote before Friday.</p>
                <div class="player"><div class="prog"><i :style="{width: pos + '%'}"></i></div><div class="player__c"><button class="rb" aria-label="Previous"><Ico n="prev" :s="18"/></button><button class="rb big" @click="call = !call" :class="{on: call}" :aria-label="call ? 'Hang up' : 'Call'"><Ico :n="call ? 'x' : 'phoneFill'" :s="22"/></button><button class="rb" aria-label="Next"><Ico n="next" :s="18"/></button></div><small>{{ call ? 'On call · 00:' + String(Math.round(pos * .6)).padStart(2, '0') : 'Tap to call' }}</small></div></Holder></div>
        <div class="grid two">
            <Holder title="Hot deals"><template #actions><button class="link" @click="openDeal">New deal</button></template><ul class="feed"><li v-for="d in hot" :key="d.id"><span class="dot5"></span><div><b>{{ d.t }}</b><small>{{ d.co }}</small></div><b>{{ money(d.v) }}</b></li></ul></Holder>
            <Holder title="Today"><ul class="feed"><li v-for="a in agenda" :key="a[0]"><small class="time">{{ a[0] }}</small><div>{{ a[1] }}</div><Badge :kind="a[2]">{{ a[2] === 'r' ? 'Now' : 'Soon' }}</Badge></li></ul></Holder></div></div>`,
};

export const Pipeline = {   // uses the kit Kanban: pointer drag (touch long-press), keyboard pick-up, live announcements
    props: {sub: String},
    setup(p) {
        onMounted(() => { if (p.sub === 'new') openDeal(); });
        const sum = st => deals.filter(d => d.s === st).reduce((a, d) => a + d.v, 0);
        const columns = STAGES.map(st => ({id: st, title: st}));
        const cards = computed(() => Object.fromEntries(STAGES.map(st => [st, deals.filter(d => d.s === st)])));
        const move = ({id, to}) => { const d = deals.find(x => x.id === id); if (d && d.s !== to) { d.s = to; toast(d.t + ' moved to ' + to); } };
        return {STAGES, columns, cards, move, sum, money, total: computed(() => deals.reduce((a, d) => a + d.v, 0)), kanbanKey: computed(() => deals.length)};
    },
    template: `<div class="page stag"><div class="sumrow"><Card v-for="s in STAGES" :key="s" class="sumc"><small>{{ s }}</small><b>{{ money(sum(s)) }}</b></Card><Card class="sumc acc"><small>Total</small><b>{{ money(total) }}</b></Card></div>
        <Kanban :key="kanbanKey" :columns="columns" :cards="cards" card-key="id" label="Deals pipeline" @move="move">
            <template #card="{card}"><div class="deal6"><div class="deal5__t"><b>{{ card.t }}</b></div><small>{{ card.co }}</small><div class="deal5__f"><b>{{ money(card.v) }}</b><Badge>{{ card.p }}%</Badge></div><Progress :value="card.p"/></div></template></Kanban>
        <p class="hint">Drag a deal to another column. Keyboard: focus a card, Space to pick it up, arrows to move, Space to drop.</p></div>`,
};

export const Leads = {   // uses the kit DataTable: sort, select, search, columns, CSV, cards under 640 px
    props: {sub: String},
    setup(p) {
        const IDS = ['all', 'Hot', 'Warm', 'New'];
        const tab = ref(IDS.includes(p.sub) ? p.sub : 'all'); watch(() => p.sub, v => { if (IDS.includes(v)) tab.value = v; });
        const items = [{id: 'all', label: 'All'}, {id: 'Hot', label: 'Hot'}, {id: 'Warm', label: 'Warm'}, {id: 'New', label: 'New'}];
        const rows = computed(() => leads.filter(l => tab.value === 'all' || l.stage === tab.value).map(l => ({...l})));
        const columns = [{key: 'name', label: 'Lead', sortable: true, slot: 'name'}, {key: 'co', label: 'Company', sortable: true}, {key: 'score', label: 'Score', sortable: true, align: 'right', slot: 'score'},
            {key: 'stage', label: 'Stage', sortable: true, slot: 'stage', editable: true, type: 'select', options: ['Hot', 'Warm', 'New']}, {key: 'value', label: 'Value', sortable: true, align: 'right', format: 'money'}, {key: 'owner', label: 'Owner', sortable: true}];
        return {tab, items, rows, columns, kind: s => ({Hot: 'r', Warm: 'y', New: 'b'})[s]};
    },
    template: `<div class="page stag"><div class="statrow"><Card><small>Leads</small><b>13</b></Card><Card><small>Hot</small><b>6</b></Card><Card><small>Response</small><b>12 min</b></Card><Card><small>Conversion</small><b>16.7%</b></Card><Card><small>Value</small><b>$536k</b></Card></div>
        <Holder><div class="toolbar5"><GlassTabs :items="items" v-model="tab"/></div>
            <DataTable :key="tab" :columns="columns" :rows="rows" row-key="id" selectable searchable :page-size="8" export-name="leads">
                <template #name="{row}"><span class="who"><Avatar :name="row.name" :size="30"/><span><b>{{ row.name }}</b><small>{{ row.last }}</small></span></span></template>
                <template #score="{row}"><span class="score"><Progress :value="row.score"/><b>{{ row.score }}</b></span></template>
                <template #stage="{row}"><Badge :kind="kind(row.stage)">{{ row.stage }}</Badge></template>
                <template #bulk="{keys, clear}"><button class="btn" @click="clear"><Ico n="x" :s="15"/>Clear {{ keys.length }}</button></template></DataTable></Holder></div>`,
};

export const Contacts = {
    props: {sub: String},
    setup(p) {
        const IDS = ['all', 'star', 'mail', 'cal'];
        const view = ref(IDS.includes(p.sub) ? p.sub : 'all'), q = ref(''), sel = ref(null); watch(() => p.sub, v => { if (IDS.includes(v)) view.value = v; });
        const items = [{id: 'all', icon: 'users', label: 'Everyone', on: 'Everyone'}, {id: 'star', icon: 'star', label: 'Starred', on: 'Starred'}, {id: 'mail', icon: 'mail', label: 'Mail', on: 'Mailed'}, {id: 'cal', icon: 'cal', label: 'Recent', on: 'Recent'}];
        const rows = computed(() => leads.filter((l, i) => (view.value === 'all' || (view.value === 'star' && i % 3 === 0) || (view.value === 'mail' && i % 2 === 0) || (view.value === 'cal' && i < 4)) && (l.name + l.co).toLowerCase().includes(q.value.toLowerCase())));
        return {view, items, q, rows, sel, money, toast};
    },
    template: `<div class="page stag"><Holder><div class="toolbar5"><IconPill :items="items" v-model="view"><button class="round" aria-label="Add contact" @click="toast('Contact form is not part of the demo')"><Ico n="plus" :s="18"/></button></IconPill><Field v-model="q" icon="search" placeholder="Search contacts"/></div>
        <ul class="people"><TransitionGroup name="row"><li v-for="c in rows" :key="c.id" :class="{on: sel === c.id}"><button @click="sel = sel === c.id ? null : c.id"><Avatar :name="c.name" :size="42"/><span><b>{{ c.name }}</b><small>{{ c.co }} · {{ c.last }}</small></span><Badge>{{ c.owner }}</Badge></button>
            <Collapse :open="sel === c.id"><div class="cdet"><div><small>Email</small>{{ c.mail }}</div><div><small>Value</small>{{ money(c.value) }}</div><div class="actions"><button class="btn"><Ico n="mail" :s="16"/>Email</button><button class="btn primary"><Ico n="phone" :s="16"/>Call</button></div></div></Collapse></li></TransitionGroup></ul></Holder></div>`,
};

const PAGES = ['overview', 'pipeline', 'leads', 'contacts'];

// right side of the top bar: the repository link, and "New deal" on the sales pages
export const TopActions = {
    setup() {
        const glass = inject('glass'), form = reactive({t: '', co: CO[0], v: 25000, s: 'Lead', owner: 'Leah'});
        const create = () => { if (!form.t.trim()) return toast('Give the deal a title', 'err'); deals.unshift({id: Date.now(), t: form.t.trim(), co: form.co, v: +form.v || 0, s: form.s, p: 10}); ui.deal = false; toast('Deal created in ' + form.s); form.t = ''; glass.go('pipeline'); };
        return {ui, form, create, openDeal, sales: computed(() => PAGES.includes(glass.route.tab)), stages: STAGES, cos: CO, owners: ['Leah', 'Omar', 'Ines']};
    },
    template: `<a class="btn x-gh" href="https://github.com/rapttor/yii2-glass" rel="noopener">GitHub</a>
        <button v-if="sales" class="btn primary" @click="openDeal"><Ico n="plus" :s="16"/><span class="hide-xs">New deal</span></button>
        <Sheet :open="ui.deal" title="New deal" @close="ui.deal = false"><div class="form"><Field v-model="form.t" label="Deal title" placeholder="What are we selling?"/><div class="row2"><Field v-model="form.co" label="Company" :options="cos"/><Field v-model="form.v" label="Value ($)" type="number"/></div>
            <label class="field"><span>Stage</span><Segmented v-model="form.s" :options="stages"/></label><Field v-model="form.owner" label="Owner" :options="owners"/><div class="actions"><button class="btn" @click="ui.deal = false">Cancel</button><button class="btn primary" @click="create"><Ico n="plus" :s="16"/>Create deal</button></div></div></Sheet>`,
};
