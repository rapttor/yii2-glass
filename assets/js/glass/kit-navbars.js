// "Navigation bars" section of the kit: the app's own navigation components in one place. GlassTabs, IconPill, NotchBar (ui5.js) and Dock (v4/ui.js)
// are registered globally by app.js; the zoom dock is plain buttons plus the shared magnification engine (dock-magnify.js).
import { ref, onMounted, onBeforeUnmount } from '../vendor/vue.esm-browser.prod.js';
import { dockMagnify } from './dock-magnify.js';

export const DemoNavBars = {
    setup() {
        const tab = ref('cart'), pill = ref('home'), notch = ref('home'), dock = ref('overview'), zoom = ref('home'), zoomEl = ref(null);
        let dm = null;
        onMounted(() => { dm = dockMagnify(zoomEl.value, 'button', {axis: 'x', max: 1.6, sigma: 48, active: '.on', activeScale: 1.08}); });
        onBeforeUnmount(() => dm?.destroy());
        const item = (id, icon, label, on) => ({id, icon, label, on});
        return {tab, pill, notch, dock, zoom, zoomEl,
            tabs: ['home', 'cart', 'about', 'services'].map(i => ({id: i, label: i[0].toUpperCase() + i.slice(1)})),
            pills: [item('home', 'home', 'Home'), item('search', 'search', 'Search'), item('heart', 'heart', 'Saved', 'Saved'), item('bell', 'bell', 'Alerts')],
            bar: [item('home', 'home', 'Home'), item('heart', 'heart', 'Saved'), item('add', 'plus', 'Create'), item('me', 'user', 'Me'), item('bell', 'bell', 'Alerts')],
            docks: [item('overview', 'home', 'Overview'), item('orders', 'bag', 'Orders'), item('people', 'users', 'People'), item('tasks', 'check', 'Tasks'), item('settings', 'gear', 'Settings')],
            zooms: [item('home', 'home', 'Home'), item('search', 'search', 'Search'), item('mail', 'mail', 'Mail'), item('cal', 'cal', 'Calendar'), item('star', 'star', 'Starred'), item('bell', 'bell', 'Alerts'), item('gear', 'gear', 'Settings')]};
    },
    template: `<div class="k-navbars">
        <Holder title="Glass tabs" sub="<GlassTabs>: the selected tab detaches as its own pill, the others rejoin as capsules"><div class="lab"><GlassTabs :items="tabs" v-model="tab"/></div></Holder>
        <Holder title="Icon pill" sub="<IconPill>: the active icon expands into a labelled pill that slides; the slot holds a detached round button"><div class="lab"><IconPill :items="pills" v-model="pill"><span class="round cart"><Ico n="cart" :s="19"/><em>3</em></span></IconPill></div></Holder>
        <Holder title="Notch bar" sub="<NotchBar>: a bubble lifts out of the bar and the glass dips around it (the app's phone navigation)"><div class="lab"><NotchBar :items="bar" v-model="notch" style="position:relative;margin:26px auto 0;width:min(380px,100%)"/></div></Holder>
        <Holder title="Dock" sub="<Dock>: a bottom bar whose active item expands to show its label; on wide screens the app uses it as a side bar"><div class="k-dockdemo"><Dock :items="docks" v-model="dock" :badges="{orders: 3}"/></div></Holder>
        <Holder title="Zoom dock" sub="dockMagnify(): buttons near the pointer grow and push the others apart, as in the OS X dock (the collapsed sidebar uses it too)"><div class="k-zoomwrap"><div ref="zoomEl" class="k-zoomdock" role="toolbar" aria-label="Zoom dock">
            <button v-for="z in zooms" :key="z.id" type="button" :class="{on: zoom === z.id}" :aria-label="z.label" :aria-pressed="zoom === z.id" :title="z.label" @click="zoom = z.id"><Ico :n="z.icon" :s="20"/></button></div></div></Holder></div>`,
};
