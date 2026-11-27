// The catalogue: one menu page per group, one tab per kit file, each showing that file's own showcase.
import { computed } from 'vue';
import { DemoFoundations, DemoLayout, DemoComponents } from 'glass/kit-core.js';
import { DemoIcons } from 'glass/kit-icons.js';
import { DemoForms } from 'glass/kit-forms.js';
import { DemoKnobs } from 'glass/kit-knobs.js';
import { DemoPanels } from 'glass/kit-panels.js';
import { DemoOverlay } from 'glass/kit-overlay.js';
import { DemoData } from 'glass/kit-data.js';
import { DemoNav } from 'glass/kit-nav.js';
import { DemoEditors, DemoSliders } from 'glass/kit-editors.js';
import { DemoCharts } from 'glass/kit-charts.js';

const group = tabs => ({
    props: {sub: String},
    emits: ['sub'],
    setup(p) {
        const cur = computed(() => tabs.some(t => t[0] === p.sub) ? p.sub : tabs[0][0]);
        const view = computed(() => tabs.find(t => t[0] === cur.value)[2]);
        return {cur, view, items: tabs.map(t => ({id: t[0], label: t[1]}))};
    },
    template: `<div class="page"><Holder flat><div class="lab"><GlassTabs :items="items" :model-value="cur" @update:model-value="$emit('sub', $event)"/></div></Holder>
        <Transition name="fade" mode="out-in"><div :key="cur" class="kitpane"><component :is="view"/></div></Transition></div>`,
});

export const Foundations = group([['foundations', 'Foundations', DemoFoundations], ['layout', 'Layout and grid', DemoLayout], ['components', 'Core components', DemoComponents], ['icons', 'Icons', DemoIcons]]);
export const Components = group([['forms', 'Forms', DemoForms], ['knobs', 'Knobs and dials', DemoKnobs], ['panels', 'Panels and docks', DemoPanels], ['overlay', 'Menus and dialogs', DemoOverlay], ['data', 'Data', DemoData], ['nav', 'Navigation and content', DemoNav]]);
export const External = group([['editors', 'Editors', DemoEditors], ['sliders', 'Sliders and carousels', DemoSliders], ['charts', 'Charts', DemoCharts]]);
