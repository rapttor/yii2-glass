// A small app on the kit: menu, three pages. The same file runs from the Yii2 page (index.php) and from examples/static.
import { createGlassApp, toast } from 'glass/app.js';
import { usePanels } from 'glass/kit-panels.js';
import { confirm } from 'glass/kit-overlay.js';
import { reactive } from 'vue';

const server = JSON.parse(document.getElementById('glass-config')?.textContent || '{}');

const orders = reactive([
    {id: 1041, customer: 'Northwind', total: 1280, status: 'Open'}, {id: 1042, customer: 'Fabrikam', total: 310, status: 'Paid'}, {id: 1043, customer: 'Contoso', total: 975, status: 'Open'},
]);

const Orders = {
    props: {sub: String},
    setup() {
        const columns = [{key: 'id', label: 'Order', sortable: true}, {key: 'customer', label: 'Customer', sortable: true}, {key: 'total', label: 'Total', sortable: true, align: 'right', format: 'money'}, {key: 'status', label: 'Status', sortable: true}];
        const clear = async () => { if (await confirm({title: 'Remove paid orders?', text: 'This only changes the demo data.', confirmText: 'Remove', danger: true})) { for (let i = orders.length - 1; i >= 0; i--) if (orders[i].status === 'Paid') orders.splice(i, 1); toast('Paid orders removed'); } };
        return {columns, orders, clear};
    },
    template: `<div class="page stag"><Holder title="Orders" sub="Sample data"><template #actions><button class="btn" @click="clear">Remove paid</button></template>
        <DataTable :columns="columns" :rows="orders" row-key="id" searchable export-name="orders"/></Holder></div>`,
};

const Board = {
    setup() {
        const panels = usePanels('board', {main: ['inbox', 'detail', 'log']}, {inbox: 30, detail: 45, log: 25}, {dock: true});
        const items = [{id: 'inbox', title: 'Inbox', icon: 'mail', count: 3}, {id: 'detail', title: 'Detail', icon: 'fileText'}, {id: 'log', title: 'Log', icon: 'clock'}];
        return {panels, items, orders};
    },
    template: `<div class="page stag"><Holder title="Board" sub="Resizable panels with dock tabs"><KWorkspace :panels="panels" :items="items" height="420px">
        <template #inbox><ul class="feed"><li v-for="o in orders" :key="o.id"><div><b>{{ o.customer }}</b><small>Order {{ o.id }}</small></div><Badge>{{ o.status }}</Badge></li></ul></template>
        <template #detail><p>Pick an order on the left.</p></template><template #log><p>No events yet.</p></template></KWorkspace></Holder></div>`,
};

const Controls = {
    setup: () => ({v: reactive({volume: 40, alerts: true})}),
    template: `<div class="page stag"><Holder title="Controls"><div class="form"><Knob v-model="v.volume" label="Volume" unit="%"/><Toggle v-model="v.alerts" label="Alerts"/></div></Holder></div>`,
};

createGlassApp({
    storage: 'glassdemo',
    brand: {name: 'Acme', logo: 'A'},
    user: {name: server.user || 'Demo user', role: 'Operator'},
    nav: [{id: 'work', label: 'Work', items: [
        {id: 'orders', label: 'Orders', icon: 'table', help: 'Every order and its state.', sub: [{k: 'open', title: 'Open', desc: 'Waiting for payment.', icon: 'clock'}]},
        {id: 'board', label: 'Board', icon: 'layout', help: 'Inbox, detail and log side by side.'},
        {id: 'controls', label: 'Controls', icon: 'sliders', help: 'Knobs and switches.'},
    ]}],
    pages: {orders: Orders, board: Board, controls: Controls},
});
