// The first page of the demo: what the kit is, where to look, how to start.
import { inject } from 'vue';

const HTML = `<link rel="stylesheet" href="glass/assets/css/glass.css">
<script type="importmap">{"imports": {
  "glass/": "glass/assets/js/glass/",
  "vue": "glass/assets/js/vendor/vue.esm-browser.prod.js"}}<\/script>
<script type="module" src="app.js"><\/script>`;

const APP = `import { createGlassApp } from 'glass/app.js';

const Orders = { template: '<div class="page"><Holder title="Orders">...</Holder></div>' };

createGlassApp({
  brand: {name: 'My app'},
  nav: [{id: 'work', label: 'Work', items: [{id: 'orders', label: 'Orders', icon: 'table'}]}],
  pages: {orders: Orders},
});`;

export const Start = {
    setup() {
        const glass = inject('glass');
        const doors = [
            {to: 'kit', sub: 'panels', icon: 'layout', title: 'Panels and docks', text: 'Drag the splitters, collapse panels into side tabs.'},
            {to: 'kit', sub: 'forms', icon: 'puzzle', title: 'Components', text: 'Forms, knobs, menus, dialogs, data and navigation.'},
            {to: 'foundations', sub: '', icon: 'layers', title: 'Foundations', text: 'Grid, breakpoints, core components and icons.'},
            {to: 'external', sub: 'charts', icon: 'bolt', title: 'Editors and charts', text: 'Third-party libraries wrapped to match.'},
            {to: 'overview', sub: '', icon: 'home', title: 'Sales app', text: 'Overview, pipeline, leads and contacts.'},
            {to: 'invoice', sub: '', icon: 'fileText', title: 'Pages', text: 'Invoice, landing pages and mail templates.'},
            {to: 'settings', sub: 'appearance', icon: 'sliders', title: 'Change the look', text: 'Picture, light and dark, five glass presets.'},
        ];
        return {doors, go: d => glass.go(d.to, d.sub), HTML, APP};
    },
    template: `<div class="page stag">
        <Holder title="Glass UI" sub="An app shell and components over refractive glass. Light and dark, mobile first, no JavaScript build step.">
            <p>This is a live demo with invented sample data. Nothing is sent anywhere: forms only check their input, and your settings stay in this browser.</p>
            <ul class="x-doors"><li v-for="d in doors" :key="d.title"><button type="button" @click="go(d)"><span><Ico :n="d.icon" :s="20"/></span><b>{{ d.title }}</b><small>{{ d.text }}</small></button></li></ul></Holder>
        <Holder title="Use it" sub="A stylesheet, an import map and one module. Yii2 apps use the Shell widget instead of the HTML.">
            <div class="x-code"><pre tabindex="0">{{ HTML }}</pre><pre tabindex="0">{{ APP }}</pre></div>
            <div class="actions"><a class="btn primary" href="https://github.com/rapttor/yii2-glass" rel="noopener">Source and instructions on GitHub</a></div></Holder></div>`,
};
