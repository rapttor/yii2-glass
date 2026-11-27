// The public demo (GitHub Pages): the whole kit and the example pages, built with createGlassApp(). Sample data only.
import { createGlassApp } from 'glass/app.js';
import { registerKitCore } from 'glass/kit-core.js';
import { registerKitIcons } from 'glass/kit-icons.js';
import { registerKitEditors } from 'glass/kit-editors.js';
import { registerKitCharts } from 'glass/kit-charts.js';
import { Start } from './pages/start.js';
import { Foundations, Components, External } from './pages/kit.js';
import { Overview, Pipeline, Leads, Contacts, TopActions } from './pages/sales.js';
import { DemoInvoice, registerExInvoice } from './pages/ex-invoice.js';
import { DemoLanding, registerExLanding } from './pages/ex-landing.js';
import { DemoMail, registerExMail } from './pages/ex-mail.js';

const s = (k, title, desc, icon) => ({k, title, desc, icon});

createGlassApp({
    storage: 'glassdemo-site',
    brand: {name: 'Refract', logo: 'R', tag: 'Demo'},
    user: {name: 'Leah Moreno', role: 'Sample user'},
    card: {title: 'Q4 quota', value: '92%', percent: 92, note: '8 days left'},
    badges: {pipeline: 2},
    actions: TopActions,
    mobile: ['start', 'kit', 'overview', 'invoice', 'settings'],
    nav: [
        {id: 'intro', label: 'Start', items: [{id: 'start', label: 'Start here', short: 'Start', icon: 'info', help: 'What the kit is and how to use it.'}]},
        {id: 'ui', label: 'UI kit', items: [
            {id: 'foundations', label: 'Foundations', icon: 'layers', help: 'Tokens, type, spacing, grid, breakpoints, core components and icon sets.', sub: [
                s('foundations', 'Foundations', 'Type, colours, spacing, radii, shadows.', 'sliders'), s('layout', 'Layout and grid', 'Containers and a 12 column grid.', 'layout'), s('components', 'Core components', 'Accordion, carousel, modal, pagination, cards.', 'grid9'), s('icons', 'Icons', 'Icon sets with search and copy.', 'star')]},
            {id: 'kit', label: 'Components', icon: 'puzzle', help: 'Every component, live.', sub: [
                s('forms', 'Forms', 'Fields, validation, date, combobox, uploads.', 'fileText'), s('knobs', 'Knobs and dials', 'Rotary controls.', 'target'), s('panels', 'Panels and docks', 'Resizable splits and side tabs.', 'layout'), s('overlay', 'Menus and dialogs', 'Popovers, modals, drawers, alerts.', 'layers'), s('data', 'Data', 'Table, calendar, tree, charts, kanban.', 'table'), s('nav', 'Navigation and content', 'Tabs, docks, wizard, chat, markdown.', 'msg')]},
            {id: 'external', label: 'External', icon: 'bolt', help: 'Third-party libraries wrapped to match the glass look.', sub: [
                s('editors', 'Editors', 'Rich text with a safe preview.', 'fileText'), s('sliders', 'Sliders', 'Carousels and range sliders.', 'sliders'), s('charts', 'Charts', 'Chart.js, ApexCharts and uPlot.', 'trend')]},
        ]},
        {id: 'examples', label: 'Examples', items: [
            {id: 'overview', label: 'Overview', icon: 'home', help: 'Revenue, quota, the call in progress and the agenda.'},
            {id: 'pipeline', label: 'Pipeline', icon: 'pipe', help: 'Deals by stage: drag a card to move it.', sub: [s('board', 'Board', 'Deals in four stages.', 'pipe'), s('new', 'New deal', 'Create a deal.', 'plus')]},
            {id: 'leads', label: 'Leads', icon: 'target', help: 'A data table with filters and export.', sub: [s('all', 'All leads', 'Every lead.', 'users'), s('Hot', 'Hot', 'Score 80 and above.', 'bolt')]},
            {id: 'contacts', label: 'Contacts', icon: 'users', help: 'People, last touch and owner.'},
            {id: 'invoice', label: 'Invoice', icon: 'fileText', help: 'List, printable document and editor.', sub: [s('list', 'All invoices', 'By state.', 'table'), s('document', 'Document', 'Ready to print.', 'fileText'), s('new', 'New invoice', 'Live preview.', 'plus')]},
            {id: 'landing', label: 'Landing pages', short: 'Landing', icon: 'globe', help: 'Four landing pages with width previews.', sub: [s('product', 'Product', 'Features and pricing.', 'layers'), s('app', 'Mobile app', 'Phone mock-ups.', 'phone'), s('studio', 'Studio', 'Editorial portfolio.', 'star'), s('waitlist', 'Waitlist', 'Countdown and sign-up.', 'clock')]},
            {id: 'mails', label: 'Mail templates', short: 'Mails', icon: 'mail', help: 'Email-safe templates in HTML and text.', sub: [s('welcome', 'Welcome', 'After sign-up.', 'star'), s('signin', 'Sign-in link', 'Magic link.', 'bolt'), s('receipt', 'Receipt', 'Payment received.', 'wallet'), s('newsletter', 'Newsletter', 'With unsubscribe.', 'mail')]},
        ]},
    ],
    pages: {start: Start, foundations: Foundations, kit: Components, external: External, overview: Overview, pipeline: Pipeline, leads: Leads, contacts: Contacts, invoice: DemoInvoice, landing: DemoLanding, mails: DemoMail},
    install(app) { [registerKitCore, registerKitIcons, registerKitEditors, registerKitCharts, registerExInvoice, registerExLanding, registerExMail].forEach(register => register(app)); },
});
