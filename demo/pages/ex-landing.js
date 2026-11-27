// Glass kit v6 example: landing pages. Four invented brands, four layouts: product (SaaS), app (mobile app), studio (agency), waitlist (coming soon).
// DemoLanding shows them in a preview with a variant switcher, a width toggle and a full screen mode. Styled by demo/scss/_ex-landing.scss (CSS container
// queries on the preview, so narrow previews really reflow). Forms are checked in the browser only: nothing is sent or stored. Needs registerUi (Ico,
// Holder, Accordion, Toasts). Register with registerExLanding(app).
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { PATHS, toast } from 'glass/ui.js';

const ADD = {
    'land-desktop': 'M4 5h16v11H4zM9 20h6M12 16v4', 'land-tablet': 'M6 3h12v18H6zM11 18h2', 'land-phone': 'M8 3h8v18H8zM11 18h2',
    'land-full': 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5', 'land-arrow': 'M5 12h14M13 6l6 6-6 6', 'land-radar': 'M12 21a9 9 0 1 1 9-9M12 16a4 4 0 1 1 4-4M12 12l7 7',
    'land-box': 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8', 'land-leaf': 'M5 19C5 10 11 5 20 5c0 9-5 14-14 14zM5 19c3-5 6-7 10-9',
    'land-drop': 'M12 4c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10z', 'land-sun': 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 3v2M12 19v2M3 12h2M19 12h2',
};
Object.keys(ADD).forEach(k => { PATHS[k] ??= ADD[k]; });

const VARIANTS = [
    {v: 'product', l: 'Product', about: 'SaaS product: hero, customer strip, feature grid, pricing, questions and a sign-up.'},
    {v: 'app', l: 'Mobile app', about: 'Phone app: rounded type, phone mock-ups drawn in CSS and a story told screen by screen.'},
    {v: 'studio', l: 'Studio', about: 'Agency portfolio: editorial grid, serif headlines, filterable work and a project enquiry.'},
    {v: 'waitlist', l: 'Waitlist', about: 'Coming soon: one screen with a countdown and a single email field.'},
];
const WIDTHS = [{v: 'desktop', l: 'Desktop', icon: 'land-desktop'}, {v: 'tablet', l: 'Tablet', icon: 'land-tablet'}, {v: 'phone', l: 'Phone', icon: 'land-phone'}];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const demo = what => toast((what || 'This link') + ' is not part of the demo');
let uid = 0;

// ---------- shared pieces ----------
export const LandSwitch = {   // a tab list or radio group of pills; arrows, Home and End move the choice
    props: {modelValue: String, options: Array, label: String, kind: {type: String, default: 'radio'}, panel: String},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const key = e => {
            const n = p.options.length, i = p.options.findIndex(o => o.v === p.modelValue);
            const to = {ArrowRight: (i + 1) % n, ArrowDown: (i + 1) % n, ArrowLeft: (i + n - 1) % n, ArrowUp: (i + n - 1) % n, Home: 0, End: n - 1}[e.key];
            if (to === undefined) return;
            e.preventDefault(); e.currentTarget.querySelectorAll('button')[to].focus(); emit('update:modelValue', p.options[to].v);
        };
        return {key};
    },
    template: `<div class="x-land-sw" :role="kind === 'tab' ? 'tablist' : 'radiogroup'" :aria-label="label" @keydown="key">
        <button v-for="o in options" :key="o.v" type="button" :role="kind === 'tab' ? 'tab' : 'radio'" :class="{on: o.v === modelValue}" :tabindex="o.v === modelValue ? 0 : -1"
            :aria-selected="kind === 'tab' ? o.v === modelValue : null" :aria-checked="kind === 'tab' ? null : o.v === modelValue" :aria-controls="panel" :aria-label="o.icon ? o.l : null" :title="o.icon ? o.l : null"
            @click="$emit('update:modelValue', o.v)"><Ico v-if="o.icon" :n="o.icon" :s="18"/><span>{{ o.l }}</span></button></div>`,
};

export const LandNav = {   // sticky header; the links fold into a menu button when the preview is narrow
    props: {links: Array, cta: Array, label: {type: String, default: 'Page sections'}},
    setup() {
        const open = ref(false), burger = ref(null), id = 'x-land-menu-' + ++uid;
        const esc = e => { if (!open.value) return; e.preventDefault(); open.value = false; burger.value.focus(); };
        return {open, burger, id, esc};
    },
    template: `<header class="x-land-nav" data-land-nav @keydown.esc="esc">
        <a class="x-land-nav__brand" href="#top" @click="open = false"><slot name="brand"/></a>
        <nav :id="id" class="x-land-nav__links" :class="{open}" :aria-label="label"><a v-for="l in links" :key="l[0]" :href="'#' + l[0]" @click="open = false">{{ l[1] }}</a></nav>
        <a v-if="cta" class="x-land-btn x-land-nav__cta" :href="'#' + cta[0]" @click="open = false">{{ cta[1] }}</a>
        <button ref="burger" type="button" class="x-land-nav__burger" :aria-expanded="open" :aria-controls="id" aria-label="Menu" @click="open = !open"><Ico :n="open ? 'x' : 'menu'" :s="20"/></button></header>`,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const LandForm = {   // fields: [{k, label, type: text|email|select|textarea, required, options, placeholder, auto, half}], consents: [{k, label, hint, required}]
    props: {fields: Array, consents: Array, button: String, after: String, label: String},
    setup(p) {
        const id = 'x-land-form-' + ++uid, form = ref(null), doneBox = ref(null), done = ref(false);
        const values = reactive({}), ticks = reactive({}), errors = reactive({});
        const reset = () => { p.fields.forEach(f => values[f.k] = ''); p.consents.forEach(c => ticks[c.k] = false); Object.keys(errors).forEach(k => delete errors[k]); };
        reset();
        const check = f => {
            const v = String(values[f.k]).trim();
            if (!v) return f.required ? (f.type === 'select' ? 'Choose an option' : 'Fill in this field') : '';
            if (f.type === 'email' && !EMAIL.test(v)) return 'Enter an email address like name@example.test';
            return f.min && v.length < f.min ? 'Write at least ' + f.min + ' characters' : '';
        };
        const set = (k, msg) => { msg ? errors[k] = msg : delete errors[k]; };
        const recheck = f => { if (errors[f.k]) set(f.k, check(f)); };   // while typing, only clear or update an error that is already shown
        const tick = c => { if (ticks[c.k]) delete errors[c.k]; };
        const submit = async () => {
            p.fields.forEach(f => set(f.k, check(f)));
            p.consents.forEach(c => set(c.k, c.required && !ticks[c.k] ? 'Tick this box to continue' : ''));
            const bad = [...p.fields, ...p.consents].find(x => errors[x.k]);
            if (bad) { await nextTick(); form.value.querySelector('[data-k="' + bad.k + '"]')?.focus(); return toast('Check the marked fields', 'err'); }
            reset(); done.value = true; toast('Demo only: nothing was sent');
            await nextTick(); doneBox.value?.focus({preventScroll: true});
        };
        const again = async () => { done.value = false; await nextTick(); form.value.querySelector('[data-k]')?.focus(); };
        return {id, form, doneBox, done, values, ticks, errors, submit, again, recheck, tick, demo};
    },
    template: `<div class="x-land-formw">
        <div v-if="done" ref="doneBox" class="x-land-form__done" role="status" tabindex="-1"><span><Ico n="check" :s="22"/></span><p><b>Demo only: nothing was sent.</b> {{ after }}</p><button type="button" class="x-land-link" @click="again">Fill in again</button></div>
        <form v-else ref="form" class="x-land-form" novalidate :aria-label="label" @submit.prevent="submit">
            <div class="x-land-form__fields"><div v-for="f in fields" :key="f.k" class="x-land-field" :class="{half: f.half, bad: errors[f.k]}">
                <label :for="id + f.k">{{ f.label }}<em v-if="!f.required"> (optional)</em></label>
                <div class="x-land-field__box">
                    <select v-if="f.type === 'select'" :id="id + f.k" v-model="values[f.k]" :data-k="f.k" :required="f.required" :aria-invalid="!!errors[f.k]" :aria-describedby="errors[f.k] ? id + f.k + 'e' : null" @change="recheck(f)"><option value="">Choose…</option><option v-for="o in f.options" :key="o">{{ o }}</option></select>
                    <textarea v-else-if="f.type === 'textarea'" :id="id + f.k" v-model="values[f.k]" :data-k="f.k" rows="4" maxlength="2000" :required="f.required" :placeholder="f.placeholder" :aria-invalid="!!errors[f.k]" :aria-describedby="errors[f.k] ? id + f.k + 'e' : null" @input="recheck(f)"></textarea>
                    <input v-else :id="id + f.k" v-model="values[f.k]" :data-k="f.k" :type="f.type || 'text'" maxlength="200" :required="f.required" :placeholder="f.placeholder" :autocomplete="f.auto" :aria-invalid="!!errors[f.k]" :aria-describedby="errors[f.k] ? id + f.k + 'e' : null" @input="recheck(f)"></div>
                <p v-if="errors[f.k]" :id="id + f.k + 'e'" class="x-land-error">{{ errors[f.k] }}</p></div></div>
            <div class="x-land-form__consents"><div v-for="c in consents" :key="c.k" class="x-land-check" :class="{bad: errors[c.k]}">
                <label><input v-model="ticks[c.k]" type="checkbox" :data-k="c.k" :required="c.required" :aria-invalid="!!errors[c.k]" :aria-describedby="id + c.k + 'h' + (errors[c.k] ? ' ' + id + c.k + 'e' : '')" @change="tick(c)"><span>{{ c.label }}</span></label>
                <p :id="id + c.k + 'h'" class="x-land-check__hint">{{ c.required ? 'Required.' : 'Optional.' }} {{ c.hint }} <button v-if="c.doc" type="button" class="x-land-link" @click="demo('The ' + c.doc)">Read the {{ c.doc }}</button></p>
                <p v-if="errors[c.k]" :id="id + c.k + 'e'" class="x-land-error">{{ errors[c.k] }}</p></div></div>
            <button type="submit" class="x-land-btn solid x-land-form__send">{{ button }}</button></form></div>`,
};

export const LandFooter = {
    props: {brand: String, line: String},
    setup: () => ({demo}),
    template: `<footer class="x-land-foot"><div><b>{{ brand }}</b><p>{{ line }} {{ brand }} is an invented brand for this demo.</p></div>
        <ul><li v-for="l in ['Terms', 'Privacy', 'Legal requests']" :key="l"><button type="button" class="x-land-link" @click="demo('The ' + l + ' page')">{{ l }}</button></li><li><a class="x-land-link" href="#top">Back to top</a></li></ul></footer>`,
};

// ---------- variant: product (SaaS) ----------
const LOGOS = [['Brackenfold', 'M4 18L12 4l8 14zM9 18l3-5 3 5'], ['Oru Labs', 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'], ['Kestrel & Pine', 'M12 3l6 8h-3l4 6H5l4-6H6zM12 17v4'],
    ['Vantaloop', 'M4 12c0-5 6-5 8 0s8 5 8 0-6-5-8 0-8 5-8 0z'], ['Mirel Foods', 'M5 19V6l7 7 7-7v13'], ['Northquay', 'M4 20V8l8-4 8 4v12M4 14h16']];
const FEATURES = [
    {i: 'land-radar', t: 'Reorder radar', d: 'Every item gets a date by which it has to be ordered, worked out from sales pace and supplier lead time.', wide: true, bars: [28, 44, 38, 62, 55, 78, 70, 92]},
    {i: 'cal', t: 'Supplier calendar', d: 'Cut-off days, holidays and delivery slots on one timeline.'},
    {i: 'land-box', t: 'Shelf counts', d: 'Count with any phone. Differences show up before they become surprises.'},
    {i: 'bell', t: 'Quiet alerts', d: 'One summary each morning, and a nudge only when a date is about to slip.'},
    {i: 'users', t: 'Shared plan', d: 'Buyers, pickers and the owner look at the same numbers, each with their own rights.'},
    {i: 'download', t: 'Your data, any time', d: 'Export orders, counts and history as CSV whenever you like.', wide: true},
];
const PLANS = [
    {n: 'Solo', m: 0, y: 0, d: 'For one person and one shelf wall.', f: ['1 user', '150 items', 'Reorder radar', 'CSV export']},
    {n: 'Crew', m: 29, y: 24, d: 'For a team that shares the buying.', f: ['8 users', '5,000 items', 'Supplier calendar', 'Morning summary', 'Roles and rights'], best: true},
    {n: 'Depot', m: 89, y: 74, d: 'For several sites and busy seasons.', f: ['Unlimited users', '50,000 items', 'Several warehouses', 'Transfer planning', 'Audit history']},
];
const FAQ = [
    ['Do we need a barcode scanner?', 'No. A phone camera reads the codes. If you already own a scanner that types like a keyboard, it works too.'],
    ['Can we bring our spreadsheet?', 'Yes. Import items, suppliers and counts from CSV, check the preview, then confirm.'],
    ['What happens when we cancel?', 'The plan runs to the end of the paid period. You can export everything before and delete the account yourself.'],
    ['Does it replace our accounting?', 'No. Tidewell plans stock. It hands order totals to your bookkeeping tool as a file.'],
];
export const LandProduct = {
    setup() {
        const bill = ref('month');
        return {bill, LOGOS, FEATURES, PLANS, FAQ, demo, billing: [{v: 'month', l: 'Monthly'}, {v: 'year', l: 'Yearly'}],
            fields: [{k: 'mail', label: 'Work email', type: 'email', required: true, placeholder: 'name@example.test', auto: 'email', half: true}, {k: 'co', label: 'Company', placeholder: 'Brackenfold', auto: 'organization', half: true}],
            consents: [{k: 'terms', label: 'I accept the Terms of Service', hint: 'The rules for using Tidewell.', doc: 'Terms of Service', required: true},
                {k: 'privacy', label: 'I accept the Privacy Policy', hint: 'How your details are used and how to delete them.', doc: 'Privacy Policy', required: true},
                {k: 'age', label: 'I am at least 16 years old', hint: 'And of legal age under the rules of my country to use this.', required: true},
                {k: 'news', label: 'Send me product news', hint: 'Occasional email about new features. You can stop it at any time.'}]};
    },
    template: `<div class="x-landp">
        <LandNav :links="[['features', 'Features'], ['pricing', 'Pricing'], ['faq', 'Questions']]" :cta="['start', 'Start free']"><template #brand><svg class="x-land-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9"/><path d="M6 13c3.5-4 6.5-4 10 0s6.5 4 10 0M6 21c3.5-4 6.5-4 10 0s6.5 4 10 0"/></svg>Tidewell</template></LandNav>
        <section class="x-landp__hero">
            <p class="x-landp__pill"><span></span>New: transfer planning between sites</p>
            <h1>Stock planning that sees <em>next week</em> coming</h1>
            <p class="x-landp__sub">Tidewell gathers orders, supplier lead times and shelf counts in one plan, so a small warehouse team knows what to reorder, and by when.</p>
            <div class="x-land-row"><a class="x-land-btn solid" href="#start">Start free<Ico n="land-arrow" :s="16"/></a><a class="x-land-btn" href="#pricing">See pricing</a></div>
            <div class="x-landp__board" role="img" aria-label="Illustration of the planning board: totals, a demand chart and items to reorder">
                <div class="x-landp__rail"><i class="on"></i><i></i><i></i><i></i></div>
                <div class="x-landp__main"><div class="x-landp__kpis"><div><small>To order today</small><b>14</b></div><div><small>Arriving</small><b>6</b></div><div><small>Stock cover</small><b>23 days</b></div></div>
                    <svg viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true"><path class="fill" d="M0 84C40 80 60 52 100 58s60 30 104 12 54-52 98-44 62 6 98-18v102H0z"/><path class="line" d="M0 84C40 80 60 52 100 58s60 30 104 12 54-52 98-44 62 6 98-18"/><path class="plan" d="M0 96C80 90 150 82 220 68s120-26 180-36"/></svg>
                    <ul><li><i></i><span>Oat flour 25 kg</span><b>Order by Mon</b></li><li><i></i><span>Kraft boxes M</span><b>Order by Wed</b></li><li><i></i><span>Label rolls</span><b>Order by Fri</b></li></ul></div></div></section>
        <section class="x-landp__logos" aria-label="Customers in this demo"><p>Planning shelves at (invented) companies</p><ul><li v-for="l in LOGOS" :key="l[0]"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="l[1]"/></svg>{{ l[0] }}</li></ul></section>
        <section class="x-landp__sec" data-sec="features" tabindex="-1"><header><h2>Less guessing, fewer empty shelves</h2><p>Six tools that share one set of numbers.</p></header>
            <ul class="x-landp__grid"><li v-for="f in FEATURES" :key="f.t" :class="{wide: f.wide}"><span><Ico :n="f.i" :s="22"/></span><h3>{{ f.t }}</h3><p>{{ f.d }}</p><div v-if="f.bars" class="x-landp__bars" aria-hidden="true"><i v-for="(b, i) in f.bars" :key="i" :style="{height: b + '%'}"></i></div></li></ul></section>
        <section class="x-landp__sec" data-sec="pricing" tabindex="-1"><header><h2>Pricing by the size of your shelves</h2><p>Example prices in US dollars. Change plan whenever you like.</p><LandSwitch v-model="bill" :options="billing" label="Billing period"/></header>
            <ul class="x-landp__plans"><li v-for="x in PLANS" :key="x.n" :class="{best: x.best}"><p v-if="x.best" class="x-landp__tag">For most teams</p><h3>{{ x.n }}</h3><p>{{ x.d }}</p>
                <p class="x-landp__price"><b>\${{ bill === 'year' ? x.y : x.m }}</b><span>{{ x.m === 0 ? 'free' : bill === 'year' ? 'a month, billed yearly' : 'a month' }}</span></p>
                <ul><li v-for="f in x.f" :key="f"><Ico n="check" :s="16"/>{{ f }}</li></ul><a class="x-land-btn" :class="{solid: x.best}" href="#start">Choose {{ x.n }}</a></li></ul></section>
        <section class="x-landp__sec x-landp__faq" data-sec="faq" tabindex="-1"><header><h2>Questions</h2><p>The short answers.</p></header><div><Accordion v-for="q in FAQ" :key="q[0]" :title="q[0]"><p>{{ q[1] }}</p></Accordion></div></section>
        <section class="x-landp__cta" data-sec="start" tabindex="-1"><div><h2>Plan next week this afternoon</h2><p>Start on Solo, import your list and see the first reorder dates.</p></div>
            <LandForm :fields="fields" :consents="consents" button="Create free account" after="In a real product, a sign-in link would be emailed to you now." label="Create a free account"/></section>
        <LandFooter brand="Tidewell" line="Stock planning for small warehouses."/></div>`,
};

// ---------- variant: app ----------
export const LandPhone = {   // a phone drawn in CSS; screen: today | plant | light
    props: {screen: {type: String, default: 'today'}},
    setup: () => ({
        tasks: [['Monty', 'Water, 250 ml', 'land-drop'], ['Basil', 'Turn to the window', 'land-sun'], ['Fig', 'Wipe the leaves', 'land-leaf']],
        names: {today: 'Phone screen: the list of plant jobs for today', plant: 'Phone screen: the card of one plant', light: 'Phone screen: the light meter'},
    }),
    template: `<div class="x-land-phone" :class="'is-' + screen" role="img" :aria-label="names[screen]"><div class="x-land-phone__screen" aria-hidden="true"><i class="x-land-phone__island"></i>
        <template v-if="screen === 'today'"><small>Thursday</small><strong>3 plants need you</strong><div v-for="(t, i) in tasks" :key="t[0]" class="x-land-phone__task" :class="{done: i === 0}"><span><Ico :n="t[2]" :s="16"/></span><div><b>{{ t[0] }}</b><small>{{ t[1] }}</small></div><i><Ico v-if="i === 0" n="check" :s="12"/></i></div><div class="x-land-phone__note"><b>Nine-day streak</b><small>Every plant looked after.</small></div></template>
        <template v-else-if="screen === 'plant'"><div class="x-land-phone__art"><svg viewBox="0 0 120 120"><path class="a" d="M60 96C20 90 14 48 22 24c30 2 48 24 38 72z"/><path class="b" d="M60 96c38-4 48-34 42-60-26 0-48 20-42 60z"/><path class="s" d="M60 112V70M60 96C50 70 40 52 28 34M60 96c8-24 20-38 34-52"/></svg></div><strong>Monty</strong><small>Monstera, living room</small>
            <div class="x-land-phone__meter"><span>Water</span><i><b style="width:72%"></b></i></div><div class="x-land-phone__meter"><span>Light</span><i><b style="width:54%"></b></i></div><div class="x-land-phone__meter"><span>Feed</span><i><b style="width:30%"></b></i></div><div class="x-land-phone__btn">Water now</div></template>
        <template v-else><small>Light meter</small><strong>By the window</strong><div class="x-land-phone__gauge"><span><b>72</b><small>of 100</small></span></div><div class="x-land-phone__note"><b>Bright, indirect</b><small>Good for Monty and Fig. Too much for a fern.</small></div><div class="x-land-phone__btn">Save this spot</div></template>
        <div class="x-land-phone__tabs"><i class="on"></i><i></i><i></i></div></div></div>`,
};
export const LandApp = {
    setup() {
        return {demo,
            stories: [{s: 'today', k: 'Today', t: 'One short list, not forty reminders', d: 'Each morning the app collects what really needs doing. Tick it off and the next date moves by itself.', li: ['Dates follow the season', 'Skip a job without guilt']},
                {s: 'plant', k: 'Your plants', t: 'A card for every pot', d: 'Where it stands, what it drinks, when it was fed. Add a note when a new leaf appears.', li: ['Rooms and shelves', 'Care history']},
                {s: 'light', k: 'Light meter', t: 'Find the spot it will like', d: 'Hold the phone where the pot would stand and see if that corner is bright enough.', li: ['Uses the camera on your phone', 'Pictures stay on the phone']}],
            steps: [['Add a plant', 'Pick the species or take your own name for it.'], ['Place it', 'Choose a room and check the light there.'], ['Follow the list', 'Do today’s jobs and carry on with your day.']],
            fields: [{k: 'mail', label: 'Email', type: 'email', required: true, placeholder: 'name@example.test', auto: 'email'}],
            consents: [{k: 'invite', label: 'Email me a test invite', hint: 'Your address is used only to invite you to the early version.', required: true},
                {k: 'privacy', label: 'I accept the Privacy Policy', hint: 'How your address is kept and how to remove it.', doc: 'Privacy Policy', required: true}]};
    },
    template: `<div class="x-landa">
        <LandNav :links="[['screens', 'The app'], ['how', 'How it works'], ['join', 'Early access']]" :cta="['get', 'Get it']"><template #brand><svg class="x-land-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16"/><path d="M16 26V15M16 19c-7 0-9-5-9-9 6 0 9 3 9 9zM16 16c0-6 3-8 9-8 0 5-3 8-9 8z"/></svg>Pocket Fern</template></LandNav>
        <section class="x-landa__hero"><div class="x-landa__copy"><p class="x-landa__kicker"><Ico n="land-leaf" :s="16"/>Plant care in your pocket</p><h1>Your plants, quietly looked after</h1><p>Pocket Fern remembers who is thirsty, so you can enjoy the green part.</p>
                <div class="x-land-row"><a class="x-land-btn solid" href="#get">Get the app</a><a class="x-land-btn" href="#screens">Look inside</a></div>
                <ul class="x-landa__facts"><li><b>400</b><span>species cards</span></li><li><b>Offline</b><span>works on the balcony</span></li><li><b>0</b><span>ads inside</span></li></ul></div>
            <div class="x-landa__phones"><LandPhone screen="plant"/><LandPhone screen="today"/></div></section>
        <div class="x-landa__stories" data-sec="screens" tabindex="-1"><section v-for="s in stories" :key="s.s" class="x-landa__story"><div class="x-landa__stage"><LandPhone :screen="s.s"/></div>
            <div><p class="x-landa__kicker">{{ s.k }}</p><h2>{{ s.t }}</h2><p>{{ s.d }}</p><ul><li v-for="l in s.li" :key="l"><span><Ico n="check" :s="14"/></span>{{ l }}</li></ul></div></section></div>
        <section class="x-landa__how" data-sec="how" tabindex="-1"><h2>Three taps to a happier windowsill</h2><ol><li v-for="(s, i) in steps" :key="s[0]"><b>{{ i + 1 }}</b><h3>{{ s[0] }}</h3><p>{{ s[1] }}</p></li></ol></section>
        <section class="x-landa__get" data-sec="get" tabindex="-1"><h2>Take it to your plants</h2><p>Free for up to ten pots.</p><div class="x-land-row"><button type="button" class="x-landa__store" @click="demo('The app store')"><Ico n="land-phone" :s="24"/><span><small>Download for</small><b>iPhone</b></span></button><button type="button" class="x-landa__store" @click="demo('The app store')"><Ico n="land-phone" :s="24"/><span><small>Download for</small><b>Android</b></span></button></div></section>
        <section class="x-landa__join" data-sec="join" tabindex="-1"><div><h2>Try the next version early</h2><p>We are testing a repotting guide with a small group.</p></div><LandForm :fields="fields" :consents="consents" button="Ask for an invite" after="In a real app, your invite request would be saved." label="Ask for a test invite"/></section>
        <LandFooter brand="Pocket Fern" line="A small app for people with pots."/></div>`,
};

// ---------- variant: studio ----------
const WORK = [
    {id: 'a', t: 'Saltmarsh Bakery', k: 'Identity', y: 2026, d: 'A mark baked into every loaf.'}, {id: 'b', t: 'Orrery Museum', k: 'Web', y: 2026, d: 'Opening hours, tickets and the planets.'},
    {id: 'c', t: 'Fieldnote Press', k: 'Print', y: 2025, d: 'A series of twelve pocket books.'}, {id: 'd', t: 'Juniper Ferries', k: 'Identity', y: 2025, d: 'Signs that read well from a wet deck.'},
    {id: 'e', t: 'Cinder Kilns', k: 'Web', y: 2024, d: 'A shop for pots with long firing times.'}, {id: 'f', t: 'Low Tide Records', k: 'Print', y: 2024, d: 'Sleeves printed in two inks.'},
];
export const LandStudio = {
    setup() {
        const kind = ref('All'), shown = computed(() => WORK.filter(w => kind.value === 'All' || w.k === kind.value));
        return {kind, shown, demo, kinds: ['All', 'Identity', 'Web', 'Print'].map(v => ({v, l: v})),
            services: [['Identity', 'Names, marks, type and the rules that hold them together.', 'Naming, logo, type system, guidelines'], ['Digital', 'Sites and small tools that are quick to read and easy to keep.', 'Structure, interface, front-end build'], ['Print', 'Books, wayfinding and packaging, proofed on real paper.', 'Editorial design, signage, production']],
            fields: [{k: 'name', label: 'Your name', required: true, auto: 'name', half: true}, {k: 'mail', label: 'Email', type: 'email', required: true, auto: 'email', half: true},
                {k: 'budget', label: 'Budget', type: 'select', required: true, options: ['Under $5,000', '$5,000 to $20,000', 'Over $20,000', 'Not sure yet']},
                {k: 'brief', label: 'What are you making?', type: 'textarea', required: true, min: 20, placeholder: 'A few lines are enough.'}],
            consents: [{k: 'contact', label: 'Use my details to answer this', hint: 'The studio reads your note and writes back to the address above.', doc: 'Privacy Policy', required: true},
                {k: 'letter', label: 'Send me the studio letter', hint: 'An occasional email about finished work. Stop it at any time.'}]};
    },
    template: `<div class="x-lands">
        <header class="x-lands__mast"><div class="x-lands__meta"><span>Design studio</span><span>Issue 14, autumn</span><span>Invented for this demo</span></div>
            <a class="x-lands__word" href="#top">Hollow <i>&amp;</i> Vane</a>
            <nav aria-label="Page sections"><a href="#work">Work</a><a href="#services">Services</a><a href="#studio">Studio</a><a href="#contact">Start a project</a></nav></header>
        <section class="x-lands__open"><h1>We design things <i>people keep</i> on the shelf, the wall and the home screen.</h1><aside><p>A studio of five. We take on a handful of projects each year and stay for the unglamorous parts: proofs, handover, the second print run.</p><a class="x-lands__more" href="#work">See selected work<Ico n="land-arrow" :s="18"/></a></aside></section>
        <section class="x-lands__sec" data-sec="work" tabindex="-1"><header><h2>Selected work</h2><LandSwitch v-model="kind" :options="kinds" label="Filter the work"/></header>
            <ul class="x-lands__work"><li v-for="w in shown" :key="w.id" :class="'w-' + w.id"><button type="button" @click="demo('The ' + w.t + ' case study')">
                <span class="x-lands__art" aria-hidden="true"><svg viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice">
                    <template v-if="w.id === 'a'"><circle cx="100" cy="70" r="44"/><path class="l" d="M72 70c10-22 46-22 56 0M82 84c8-12 28-12 36 0"/></template>
                    <template v-else-if="w.id === 'b'"><circle class="l" cx="100" cy="70" r="24"/><circle class="l" cx="100" cy="70" r="46"/><circle class="l" cx="100" cy="70" r="68"/><circle cx="100" cy="70" r="9"/><circle cx="140" cy="48" r="6"/><circle cx="46" cy="112" r="4"/></template>
                    <template v-else-if="w.id === 'c'"><rect x="46" y="26" width="30" height="94"/><rect x="82" y="38" width="30" height="82" opacity=".6"/><rect x="118" y="18" width="30" height="102" opacity=".8"/></template>
                    <template v-else-if="w.id === 'd'"><path d="M30 96h140l-22 24H52z"/><path d="M96 24l46 62H96z" opacity=".75"/><path class="l" d="M10 128c20-10 30 10 50 0s30 10 50 0 30 10 50 0 20 0 30 0"/></template>
                    <template v-else-if="w.id === 'e'"><path d="M70 40h60l-8 14c26 20 26 56-4 70H82c-30-14-30-50-4-70z"/><path class="l" d="M58 82h84M60 98h80"/></template>
                    <template v-else><circle cx="86" cy="70" r="52"/><circle class="l" cx="86" cy="70" r="32"/><circle class="hole" cx="86" cy="70" r="10"/><rect x="112" y="20" width="66" height="100" opacity=".45"/></template></svg></span>
                <span class="x-lands__cap"><b>{{ w.t }}</b><em>{{ w.k }}, {{ w.y }}</em><span>{{ w.d }}</span></span></button></li></ul>
            <p class="x-lands__count" aria-live="polite">{{ shown.length }} projects shown</p></section>
        <section class="x-lands__sec" data-sec="services" tabindex="-1"><header><h2>What we do</h2></header><ol class="x-lands__services"><li v-for="(s, i) in services" :key="s[0]"><span>0{{ i + 1 }}</span><h3>{{ s[0] }}</h3><p>{{ s[1] }}</p><small>{{ s[2] }}</small></li></ol></section>
        <section class="x-lands__quote" data-sec="studio" tabindex="-1"><blockquote><p>“They asked about our ovens before they asked about our logo.”</p><footer>An invented client, Saltmarsh Bakery</footer></blockquote></section>
        <section class="x-lands__sec x-lands__contact" data-sec="contact" tabindex="-1"><div><h2>Start a <i>project</i></h2><p>Tell us what you are making, who it is for and when it should exist.</p><dl><dt>Where</dt><dd>12 Cooper’s Yard, an invented harbour town</dd><dt>Write</dt><dd>hello@hollowvane.example</dd></dl></div>
            <LandForm :fields="fields" :consents="consents" button="Send the brief" after="In a real site, your brief would go to the studio." label="Project enquiry"/></section>
        <LandFooter brand="Hollow & Vane" line="Set in the serif your device already has."/></div>`,
};

// ---------- variant: waitlist ----------
export const LandWaitlist = {
    setup() {
        const d = new Date(), target = new Date(d.getFullYear(), d.getMonth() + 2, 1, 9);   // always a date ahead, so the demo never shows zeros
        const now = ref(Date.now()); let timer = 0;
        onMounted(() => timer = setInterval(() => now.value = Date.now(), 1000));
        onBeforeUnmount(() => clearInterval(timer));
        const parts = computed(() => { const s = Math.max(0, Math.floor((target - now.value) / 1000)); return [['Days', Math.floor(s / 86400)], ['Hours', Math.floor(s / 3600) % 24], ['Minutes', Math.floor(s / 60) % 60], ['Seconds', s % 60]]; });
        return {parts, demo, date: target.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}),
            fields: [{k: 'mail', label: 'Email', type: 'email', required: true, placeholder: 'name@example.test', auto: 'email'}],
            consents: [{k: 'open', label: 'Email me when it opens', hint: 'Your address is used for the opening announcement only.', required: true},
                {k: 'privacy', label: 'I accept the Privacy Policy', hint: 'How your address is kept and how to remove it.', doc: 'Privacy Policy', required: true},
                {k: 'news', label: 'Send me progress notes', hint: 'Occasional email while we build. Stop it at any time.'}]};
    },
    template: `<div class="x-landw">
        <svg class="x-landw__orbit" viewBox="0 0 600 600" aria-hidden="true"><g><circle cx="300" cy="300" r="140"/><circle cx="440" cy="300" r="7"/></g><g><circle cx="300" cy="300" r="215"/><circle cx="300" cy="85" r="5"/></g><g><circle cx="300" cy="300" r="290"/><path d="M95 505l16-30 16 30-16-8z"/></g></svg>
        <header><span class="x-landw__logo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 8-7 8-7-8zM12 2v16M5 10h14M12 18c0 3 3 2 3 4"/></svg>Lumenkite</span><span class="x-landw__badge">Coming soon</span></header>
        <div class="x-landw__mid"><h1>A calendar that leaves room to think</h1><p>Lumenkite guards the quiet hours first, then fits the meetings around them.</p>
            <div class="x-landw__count" role="timer" :aria-label="parts[0][1] + ' days and ' + parts[1][1] + ' hours until opening'"><div v-for="x in parts" :key="x[0]" aria-hidden="true"><b>{{ String(x[1]).padStart(2, '0') }}</b><span>{{ x[0] }}</span></div></div>
            <p class="x-landw__date">Planned opening: {{ date }}</p>
            <LandForm :fields="fields" :consents="consents" button="Join the list" after="In a real site, you would now be on the list." label="Join the waiting list"/></div>
        <footer><span>Lumenkite is an invented product for this demo.</span><button type="button" class="x-land-link" @click="demo('The Legal requests page')">Legal requests</button></footer></div>`,
};

// ---------- the page ----------
const PAGES = {product: 'LandProduct', app: 'LandApp', studio: 'LandStudio', waitlist: 'LandWaitlist'};
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const DemoLanding = {
    props: {sub: String},
    emits: ['sub'],
    setup(p, {emit}) {
        const valid = s => PAGES[s] ? s : 'product';
        const cur = ref(valid(p.sub)), width = ref('desktop'), full = ref(false), px = ref(0), hold = ref(0);
        const slot = ref(null), stage = ref(null), scroller = ref(null), toggle = ref(null), panel = 'x-land-panel-' + ++uid;
        watch(() => p.sub, s => { cur.value = valid(s); });
        watch(cur, () => nextTick(() => { if (scroller.value) scroller.value.scrollTop = 0; }));
        const pick = v => { if (v === cur.value) return; cur.value = v; emit('sub', v); };

        // links such as href="#pricing" scroll the preview; they never reach the address bar, which the app's hash router owns
        const anchor = e => {
            const a = e.target.closest?.('a[href^="#"]'); if (!a) return;
            e.preventDefault(); if (e.type !== 'click') return;
            const box = scroller.value, name = a.getAttribute('href').slice(1), to = box.querySelector('[data-sec="' + CSS.escape(name) + '"]');
            const nav = box.querySelector('[data-land-nav]');
            const top = to ? to.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - (nav ? nav.offsetHeight : 0) : 0;
            box.scrollTo({top, behavior: reduced() ? 'auto' : 'smooth'});
            (to || box).focus({preventScroll: true});
        };

        // full screen: the same elements move into .v4 (so form input survives), as a modal layer
        const onEsc = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); setFull(false); } };
        const onShortcut = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); } };   // the app search would open underneath
        const onFocusIn = e => { if (stage.value && !stage.value.contains(e.target)) toggle.value?.focus({preventScroll: true}); };
        const layer = on => {
            const f = on ? 'addEventListener' : 'removeEventListener';
            document[f]('keydown', onEsc); document[f]('keydown', onShortcut, true); document[f]('focusin', onFocusIn);
            document.documentElement.classList.toggle('v4-lock', on);
        };
        async function setFull(on) {
            if (on === full.value) return;
            const top = scroller.value.scrollTop;
            if (on) hold.value = slot.value.offsetHeight;
            full.value = on; layer(on);
            await nextTick();
            scroller.value.scrollTop = top; toggle.value.focus({preventScroll: true});
        }
        const trap = e => {
            if (!full.value || e.key !== 'Tab') return;
            const list = [...stage.value.querySelectorAll(FOCUSABLE)].filter(n => n.tabIndex > -1 && n.getClientRects().length), at = document.activeElement;
            if (!list.length) return;
            if (e.shiftKey && (at === list[0] || at === stage.value)) { e.preventDefault(); list[list.length - 1].focus(); }
            else if (!e.shiftKey && at === list[list.length - 1]) { e.preventDefault(); list[0].focus(); }
        };

        let watcher = null;
        onMounted(() => { watcher = new ResizeObserver(() => { if (scroller.value) px.value = Math.round(scroller.value.clientWidth); }); watcher.observe(scroller.value); });
        onBeforeUnmount(() => { watcher?.disconnect(); if (full.value) layer(false); });

        return {cur, width, full, px, hold, slot, stage, scroller, toggle, panel, pick, anchor, setFull, trap, VARIANTS, WIDTHS,
            page: computed(() => PAGES[cur.value]), info: computed(() => VARIANTS.find(v => v.v === cur.value))};
    },
    template: `<div class="page x-land"><div ref="slot" class="x-land__slot" :style="{minHeight: full ? hold + 'px' : null}"><Teleport to=".v4" :disabled="!full">
        <div ref="stage" class="x-land__stage" :class="{full}" :role="full ? 'dialog' : null" :aria-modal="full ? 'true' : null" :aria-label="full ? 'Full screen preview: ' + info.l : null" tabindex="-1" @keydown="trap">
            <div class="x-land__bar"><LandSwitch class="x-land__variants" kind="tab" :model-value="cur" :options="VARIANTS" :panel="panel" label="Landing page variant" @update:model-value="pick"/>
                <div class="x-land__tools"><LandSwitch v-model="width" class="x-land__widths" :options="WIDTHS" label="Preview width"/><small class="x-land__px" aria-hidden="true">{{ px }} px</small>
                    <button ref="toggle" type="button" class="x-land__full" :aria-label="full ? 'Close full screen preview' : 'Open full screen preview'" @click="setFull(!full)"><Ico :n="full ? 'x' : 'land-full'" :s="18"/><span>{{ full ? 'Close' : 'Full screen' }}</span></button></div></div>
            <p v-if="!full" class="x-land__about">{{ info.about }} Forms check input and send nothing.</p>
            <div class="x-land__frame" :class="'is-' + width"><div :id="panel" ref="scroller" class="x-land__scroll" :class="'v-' + cur" role="tabpanel" :aria-label="info.l + ' landing page'" tabindex="0" @click="anchor" @auxclick="anchor">
                <component :is="page" :key="cur"/></div></div></div></Teleport></div></div>`,
};

export function registerExLanding(app) {
    Object.entries({LandSwitch, LandNav, LandForm, LandFooter, LandPhone, LandProduct, LandApp, LandStudio, LandWaitlist, DemoLanding}).forEach(([k, v]) => app.component(k, v));
}
