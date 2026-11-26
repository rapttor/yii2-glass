// Glass kit, forms: field wrapper, validation helper and form controls. Register with `registerKitForms(app)`; `DemoForms` shows them all.
// Styles: scss/kit/_forms.scss (class prefix k-). Needs the global Ico, Badge, Card, Holder and Progress of the v4 kit.
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick, provide, inject } from '../vendor/vue.esm-browser.prod.js';
import { PATHS, toast } from './ui.js';

Object.assign(PATHS, {
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeoff: 'M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.5 7.6A16.5 16.5 0 0 0 2 12s4 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', upload: 'M12 16V5M7 9l5-5 5 5M5 20h14', file: 'M7 3h7l5 5v13H7zM14 3v5h5',
    minus: 'M6 12h12', refresh: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4', lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3', palette: 'M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z',
});

// ---------- helpers ----------
const pad = n => String(n).padStart(2, '0');
const U = {
    id: (() => { let n = 0; return (p = 'k') => p + '-' + (++n); })(),
    iso: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    parse: s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 ? d : null; },
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    norm: o => (o !== null && typeof o === 'object') ? {...o, v: o.v ?? o.value, l: o.l ?? o.label ?? String(o.v ?? o.value)} : {v: o, l: String(o)},
    empty: v => v == null || v === '' || (Array.isArray(v) && !v.length),
};
const useFC = () => inject('kfield', {});   // context of the surrounding FormField: id, labelId, invalid, describedby, required

// ---------- validation ----------
export const defaultMessages = {
    required: 'This field is required', min: 'Must be at least {n}', max: 'Must be at most {n}', minLength: 'Use at least {n} characters', maxLength: 'Use at most {n} characters',
    email: 'Enter a valid email address', pattern: 'Invalid format', match: 'Does not match {f}', invalid: 'Invalid value',
};
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o?.[k] ?? '');
// A validator returns '' when the value is fine, else the message. Non-required validators skip empty values. Messages: argument > useForm option `messages` > defaultMessages.
const mk = (key, test, params, msg, skipEmpty = true) => (val, all, msgs) => (skipEmpty && U.empty(val)) || test(val, all) ? '' : fmt(msg || msgs?.[key] || defaultMessages[key], params);
const len = v => (Array.isArray(v) ? v.length : String(v).length);
export const rules = {
    required: msg => mk('required', v => !U.empty(v) && v !== false && !(typeof v === 'string' && !v.trim()), {}, msg, false),
    min: (n, msg) => mk('min', v => +v >= n, {n}, msg), max: (n, msg) => mk('max', v => +v <= n, {n}, msg),
    minLength: (n, msg) => mk('minLength', v => len(v) >= n, {n}, msg), maxLength: (n, msg) => mk('maxLength', v => len(v) <= n, {n}, msg),
    email: msg => mk('email', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), {}, msg), pattern: (re, msg) => mk('pattern', v => re.test(v), {}, msg),
    match: (field, msg) => mk('match', (v, all) => v === all[field], {f: field}, msg, false),
    custom: (fn, msg) => (val, all) => { const r = fn(val, all); return r === true || r == null || r === '' ? '' : (typeof r === 'string' ? r : msg || defaultMessages.invalid); },   // fn returns true, or false / a message
};

// useForm(initial, schema, {messages}): schema maps a field to a validator or an array of them (plain functions (value, values) => true | false | message work too).
export function useForm(initial, schema = {}, opts = {}) {
    const values = reactive(JSON.parse(JSON.stringify(initial))), errors = reactive({}), touched = reactive({});
    const check = k => { for (const fn of [].concat(schema[k] || [])) { const r = fn(values[k], values, opts.messages || {}); if (r === true || r === '' || r == null) continue; return r === false ? defaultMessages.invalid : r; } return ''; };
    const validateField = k => (errors[k] = check(k));
    const touch = k => { touched[k] = true; validateField(k); };
    const validate = () => { let ok = true; Object.keys(schema).forEach(k => { touched[k] = true; if (validateField(k)) ok = false; }); return ok; };
    const isValid = computed(() => Object.keys(schema).every(k => !check(k)));
    const reset = () => { Object.assign(values, JSON.parse(JSON.stringify(initial))); Object.keys(errors).forEach(k => delete errors[k]); Object.keys(touched).forEach(k => delete touched[k]); };
    watch(values, () => Object.keys(schema).forEach(k => { if (touched[k]) errors[k] = check(k); }), {deep: true});
    const field = k => ({error: errors[k], onBlur: () => touch(k)});   // v-bind="form.field('email')" on a FormField
    return {values, errors, touched, validate, validateField, touch, reset, isValid, field};
}

// ---------- field wrapper ----------
export const FormField = {
    props: {label: String, hint: String, error: String, required: Boolean},
    emits: ['blur'],
    setup(p, {emit}) {
        const id = U.id('kf');
        provide('kfield', reactive({id, labelId: id + '-l', invalid: computed(() => !!p.error), required: computed(() => p.required),
            describedby: computed(() => [p.hint && id + '-h', p.error && id + '-e'].filter(Boolean).join(' ') || undefined)}));
        const out = e => { if (!e.currentTarget.contains(e.relatedTarget)) emit('blur'); };
        return {id, out};
    },
    template: `<div class="k-ff" :class="{bad: !!error}" @focusout="out"><div v-if="label" class="k-ff__l"><label :id="id + '-l'" :for="id">{{ label }}<i v-if="required" class="k-req" aria-hidden="true">*</i></label><slot name="aside"/></div>
        <slot/><small v-if="hint" :id="id + '-h'" class="k-ff__h">{{ hint }}</small><small v-if="error" :id="id + '-e'" class="k-ff__e" role="alert"><Ico n="x" :s="13"/>{{ error }}</small></div>`,
};

export const TextInput = {
    props: {modelValue: [String, Number], type: {type: String, default: 'text'}, placeholder: String, icon: String, autocomplete: String, disabled: Boolean, prefix: String, suffix: String},
    emits: ['update:modelValue'],
    setup: () => ({fc: useFC()}),
    template: `<div class="k-box" :class="{dis: disabled}"><Ico v-if="icon" :n="icon" :s="16"/><span v-if="prefix" class="k-aff">{{ prefix }}</span>
        <input :id="fc.id" :type="type" :value="modelValue" :placeholder="placeholder" :autocomplete="autocomplete" :disabled="disabled" :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby" :aria-required="fc.required || null" @input="$emit('update:modelValue', $event.target.value)"><span v-if="suffix" class="k-aff">{{ suffix }}</span></div>`,
};

// ---------- popover: anchored, flips above, outside click and Escape, teleported to .v4 ----------
export const KPop = {
    inheritAttrs: false,
    props: {open: Boolean, anchor: Object, match: Boolean, gap: {type: Number, default: 6}},
    emits: ['close'],
    setup(p, {emit}) {
        const el = ref(null), st = ref({}), up = ref(false); let ro;
        const place = () => {
            const a = p.anchor, e = el.value; if (!a || !e) return;
            const r = a.getBoundingClientRect(); if (p.match) e.style.minWidth = r.width + 'px';
            const w = e.offsetWidth, hh = e.offsetHeight; let top = r.bottom + p.gap; up.value = false;
            if (top + hh > innerHeight - 8 && r.top - p.gap - hh > 8) { top = r.top - p.gap - hh; up.value = true; }
            st.value = {top: U.clamp(top, 8, Math.max(8, innerHeight - hh - 8)) + 'px', left: U.clamp(r.left, 8, Math.max(8, innerWidth - w - 8)) + 'px'};
        };
        const down = e => { if (el.value && !el.value.contains(e.target) && !(p.anchor && p.anchor.contains(e.target))) emit('close', 'outside'); };
        const key = e => { if (e.key === 'Escape') emit('close', 'esc'); };
        const on = () => { document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key); addEventListener('resize', place); addEventListener('scroll', place, true); };
        const off = () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); removeEventListener('resize', place); removeEventListener('scroll', place, true); };
        watch(() => p.open, o => { if (o) { st.value = {top: '0px', left: '0px', opacity: 0}; on(); nextTick(place); } else off(); }, {immediate: true});
        watch(el, e => { ro?.disconnect(); if (e && window.ResizeObserver) { ro = new ResizeObserver(place); ro.observe(e); } });
        onBeforeUnmount(() => { off(); ro?.disconnect(); });
        return {el, st, up};
    },
    template: `<Teleport to=".v4"><Transition name="k-fpop"><div v-if="open" ref="el" class="k-fpop" :class="{up}" :style="st" v-bind="$attrs"><slot/></div></Transition></Teleport>`,
};

// ---------- checkbox, check group, radio group ----------
export const CheckBox = {
    props: {modelValue: Boolean, indeterminate: Boolean, label: String, hint: String, disabled: Boolean},
    emits: ['update:modelValue'],
    setup: () => ({fc: useFC()}),
    template: `<label class="k-check" :class="{dis: disabled}"><input type="checkbox" :id="fc.id" :checked="modelValue" :indeterminate="indeterminate" :disabled="disabled" :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby" @change="$emit('update:modelValue', $event.target.checked)">
        <i class="k-check__b"><Ico n="check" :s="14"/><Ico n="minus" :s="14"/></i><span class="k-check__t"><slot>{{ label }}</slot><small v-if="hint">{{ hint }}</small></span></label>`,
};
export const CheckGroup = {
    props: {modelValue: {type: Array, default: () => []}, options: {type: Array, default: () => []}, inline: Boolean, all: String},   // all: label of an optional "select all" box
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const fc = useFC(), opts = computed(() => p.options.map(U.norm)), has = o => p.modelValue.includes(o.v);
        const tog = (o, on) => emit('update:modelValue', on ? [...p.modelValue, o.v] : p.modelValue.filter(x => x !== o.v));
        const every = computed(() => opts.value.every(has)), some = computed(() => opts.value.some(has));
        return {fc, opts, has, tog, every, some, setAll: on => emit('update:modelValue', on ? opts.value.filter(o => !o.disabled).map(o => o.v) : [])};
    },
    template: `<div class="k-group" :class="{inline}" role="group" :aria-labelledby="fc.labelId" :aria-describedby="fc.describedby"><CheckBox v-if="all" :model-value="every" :indeterminate="some && !every" :label="all" class="k-all" @update:model-value="setAll"/>
        <CheckBox v-for="o in opts" :key="o.v" :model-value="has(o)" :label="o.l" :hint="o.hint" :disabled="o.disabled" @update:model-value="tog(o, $event)"/></div>`,
};
export const RadioGroup = {   // native radios: arrow keys and roving tab stop come for free
    props: {modelValue: {}, options: {type: Array, default: () => []}, variant: {type: String, default: 'list'}, name: String, inline: Boolean},
    emits: ['update:modelValue'],
    setup(p) { const fc = useFC(); return {fc, opts: computed(() => p.options.map(U.norm)), nm: p.name || U.id('kr')}; },
    template: `<div class="k-group" :class="[variant === 'cards' ? 'cards' : 'list', {inline}]" role="radiogroup" :aria-labelledby="fc.labelId" :aria-describedby="fc.describedby" :aria-invalid="fc.invalid || null">
        <label v-for="o in opts" :key="o.v" class="k-radio" :class="{on: modelValue === o.v, dis: o.disabled}"><input type="radio" :name="nm" :checked="modelValue === o.v" :disabled="o.disabled" @change="$emit('update:modelValue', o.v)">
        <i class="k-radio__b"></i><span class="k-radio__t"><b>{{ o.l }}</b><small v-if="o.hint">{{ o.hint }}</small></span><em v-if="o.badge">{{ o.badge }}</em></label></div>`,
};

// ---------- date picker (single and range), ISO strings ----------
export const DatePicker = {
    components: {KPop},
    props: {modelValue: {}, range: Boolean, min: String, max: String, placeholder: String, clearable: {type: Boolean, default: true}, disabled: Boolean},   // range: v-model is [from, to]
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const fc = useFC(), box = ref(null), grid = ref(null), inp = ref(null), open = ref(false), todayIso = U.iso(new Date());
        const val = computed(() => p.range ? [p.modelValue?.[0] || '', p.modelValue?.[1] || ''] : [p.modelValue || '', '']);
        const som = d => new Date(d.getFullYear(), d.getMonth(), 1);
        const view = ref(som(U.parse(val.value[0]) || new Date())), cursor = ref(val.value[0] || todayIso), pending = ref(''), hov = ref('');
        const text = computed(() => p.range ? (val.value[0] ? val.value[0] + ' – ' + (val.value[1] || '…') : '') : val.value[0]);
        const ok = s => !((p.min && s < p.min) || (p.max && s > p.max));
        const days = computed(() => { const y = view.value.getFullYear(), m = view.value.getMonth(), off = (new Date(y, m, 1).getDay() + 6) % 7;
            return Array.from({length: 42}, (_, i) => { const d = new Date(y, m, 1 - off + i), s = U.iso(d); return {s, n: d.getDate(), out: d.getMonth() !== m, dis: !ok(s)}; }); });
        const span = computed(() => { const a = pending.value || val.value[0]; if (!a) return []; const b = pending.value ? (hov.value || a) : (val.value[1] || a); return a <= b ? [a, b] : [b, a]; });
        const cls = c => ({today: c.s === todayIso, out: c.out, dis: c.dis, sel: c.s === span.value[0] || c.s === span.value[1], mid: p.range && span.value[0] && c.s > span.value[0] && c.s < span.value[1]});
        const title = computed(() => view.value.toLocaleDateString('en', {month: 'long', year: 'numeric'}));
        const focusCursor = () => nextTick(() => grid.value?.querySelector('[data-d="' + cursor.value + '"]')?.focus());
        function go(n, unit) {
            const d = U.parse(cursor.value) || new Date();
            if (unit === 'm') { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); } else d.setDate(d.getDate() + n);
            cursor.value = U.iso(d); view.value = som(d);
        }
        function key(e) {
            const k = e.key, m = {ArrowLeft: [-1], ArrowRight: [1], ArrowUp: [-7], ArrowDown: [7], PageUp: [-1, 'm'], PageDown: [1, 'm']};
            if (!e.target.classList.contains('k-day')) return;   // buttons of the header and footer keep their own keys
            if (m[k]) { e.preventDefault(); go(m[k][0] * (e.shiftKey && m[k][1] ? 12 : 1), m[k][1]); focusCursor(); }
            else if (k === 'Home' || k === 'End') { e.preventDefault(); const wd = (U.parse(cursor.value).getDay() + 6) % 7; go(k === 'Home' ? -wd : 6 - wd); focusCursor(); }
            else if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(cursor.value); }
        }
        function show() { if (p.disabled || open.value) return; open.value = true; pending.value = ''; hov.value = ''; const b = val.value[0] || todayIso; cursor.value = b; view.value = som(U.parse(b)); focusCursor(); }
        function close(refocus) { open.value = false; pending.value = ''; if (refocus) inp.value?.focus(); }
        function pick(s) {
            if (!ok(s)) return; cursor.value = s;
            if (!p.range) { emit('update:modelValue', s); close(true); return; }
            if (!pending.value) { pending.value = s; emit('update:modelValue', [s, '']); return; }
            const a = pending.value; emit('update:modelValue', a <= s ? [a, s] : [s, a]); close(true);
        }
        const clear = () => emit('update:modelValue', p.range ? ['', ''] : '');
        function typed(e) { const s = e.target.value.trim(), d = U.parse(s); if (!s) return clear(); if (d && ok(s)) emit('update:modelValue', s); else e.target.value = text.value; }
        const today = () => { if (ok(todayIso)) pick(todayIso); else { cursor.value = todayIso; view.value = som(new Date()); } };
        return {fc, box, grid, inp, open, text, days, cls, title, show, close, pick, key, clear, typed, today, hov, todayIso, cursor, step: n => { go(n, 'm'); }, wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            sel: c => { const s = cls(c); return !!s.sel; }};
    },
    template: `<div class="k-comp"><div class="k-box" ref="box" :class="{dis: disabled}"><Ico n="cal" :s="16"/>
        <input ref="inp" :id="fc.id" type="text" role="combobox" aria-haspopup="dialog" :aria-expanded="open" autocomplete="off" :value="text" :readonly="range" :disabled="disabled" :placeholder="placeholder || (range ? 'Start – end' : 'YYYY-MM-DD')"
            :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby" :aria-required="fc.required || null" @click="show" @change="typed" @keydown.down.prevent="show" @keydown.esc="close(true)" @keydown.enter="range && (open ? close(true) : show())">
        <button v-if="clearable && text && !disabled" type="button" class="k-x" aria-label="Clear date" @click="clear"><Ico n="x" :s="14"/></button></div>
        <KPop :open="open" :anchor="box" role="dialog" aria-label="Choose date" @close="close($event === 'esc')"><div class="k-fcal" ref="grid" @keydown="key" @pointerleave="hov = ''">
        <div class="k-fcal__h"><button type="button" class="k-fib" aria-label="Previous month" @click="step(-1)"><Ico n="chev" :s="16" style="transform: rotate(180deg)"/></button><b aria-live="polite">{{ title }}</b><button type="button" class="k-fib" aria-label="Next month" @click="step(1)"><Ico n="chev" :s="16"/></button></div>
        <div class="k-fcal__w" aria-hidden="true"><span v-for="d in wd" :key="d">{{ d }}</span></div>
        <div class="k-fcal__g" role="group" :aria-label="title"><button v-for="c in days" :key="c.s" type="button" class="k-day" :class="cls(c)" :data-d="c.s" :tabindex="c.s === cursor ? 0 : -1" :disabled="c.dis" :aria-label="c.s" :aria-pressed="sel(c)" :aria-current="c.s === todayIso ? 'date' : null"
            @click="pick(c.s)" @pointerenter="hov = c.s" @focus="hov = c.s">{{ c.n }}</button></div>
        <div class="k-fcal__f"><button type="button" class="k-link" @click="today">Today</button><button v-if="clearable" type="button" class="k-link" @click="clear">Clear</button></div></div></KPop></div>`,
};

// ---------- time picker: typed or hour / minute columns, 24h or 12h; v-model is always "HH:MM" ----------
const parseT = s => { const m = /^\s*(\d{1,2})(?::?(\d{2}))?\s*([ap]m?)?\s*$/i.exec(s || ''); if (!m) return null; let h = +m[1]; const mi = +(m[2] || 0), ap = m[3] && m[3][0].toLowerCase();
    if (mi > 59) return null; if (ap) { if (h < 1 || h > 12) return null; h = h % 12 + (ap === 'p' ? 12 : 0); } else if (h > 23) return null; return [h, mi]; };
export const TimePicker = {
    components: {KPop},
    props: {modelValue: String, hour12: Boolean, step: {type: Number, default: 5}, placeholder: String, clearable: {type: Boolean, default: true}, disabled: Boolean},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const fc = useFC(), box = ref(null), pop = ref(null), inp = ref(null), open = ref(false);
        const cur = computed(() => parseT(p.modelValue)), now = () => { const d = new Date(); return [d.getHours(), 0]; };
        const disp = computed(() => { const t = cur.value; if (!t) return ''; return p.hour12 ? ((t[0] + 11) % 12 + 1) + ':' + pad(t[1]) + ' ' + (t[0] < 12 ? 'AM' : 'PM') : pad(t[0]) + ':' + pad(t[1]); });
        const hours = computed(() => p.hour12 ? Array.from({length: 12}, (_, i) => i + 1) : Array.from({length: 24}, (_, i) => i));
        const mins = computed(() => Array.from({length: Math.ceil(60 / p.step)}, (_, i) => i * p.step));
        const selH = computed(() => cur.value ? (p.hour12 ? (cur.value[0] + 11) % 12 + 1 : cur.value[0]) : -1), selM = computed(() => cur.value ? cur.value[1] : -1), pm = computed(() => !!cur.value && cur.value[0] >= 12);
        const set = (h, m) => emit('update:modelValue', pad(h) + ':' + pad(m));
        const setH = n => { const t = cur.value || now(); set(p.hour12 ? n % 12 + (pm.value ? 12 : 0) : n, t[1]); };
        const setM = n => { const t = cur.value || now(); set(t[0], n); };
        const setAp = isPm => { const t = cur.value || now(); set(t[0] % 12 + (isPm ? 12 : 0), t[1]); };
        const center = () => nextTick(() => requestAnimationFrame(() => pop.value?.querySelectorAll('.k-time__c').forEach(c => { const s = c.querySelector('.on'); if (s) c.scrollTop = s.offsetTop - c.clientHeight / 2 + s.offsetHeight / 2; })));
        watch(() => p.modelValue, () => open.value && center());
        const show = () => { if (p.disabled || open.value) return; open.value = true; center(); };
        const close = refocus => { open.value = false; if (refocus) inp.value?.focus(); };
        const typed = e => { const t = parseT(e.target.value); if (!e.target.value.trim()) emit('update:modelValue', ''); else if (t) set(t[0], t[1]); else e.target.value = disp.value; };
        function colKey(e) {
            const k = e.key;
            if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); const l = [...e.currentTarget.querySelectorAll('button')], n = l[U.clamp(l.indexOf(document.activeElement) + (k === 'ArrowDown' ? 1 : -1), 0, l.length - 1)]; n?.focus(); n?.click(); }
            else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); const c = [...pop.value.querySelectorAll('[role=listbox]')], n = c[c.indexOf(e.currentTarget) + (k === 'ArrowRight' ? 1 : -1)]; (n?.querySelector('[aria-selected=true]') || n?.querySelector('button'))?.focus(); }
            else if (k === 'Enter') { e.preventDefault(); close(true); }
        }
        const ti = (on, i, any) => on || (!any && i === 0) ? 0 : -1;
        return {fc, box, pop, inp, open, disp, hours, mins, selH, selM, pm, setH, setM, setAp, show, close, typed, colKey, ti, pad, clear: () => emit('update:modelValue', ''), setNow: () => { const d = new Date(); set(d.getHours(), Math.round(d.getMinutes() / p.step) * p.step % 60); center(); }};
    },
    template: `<div class="k-comp"><div class="k-box" ref="box" :class="{dis: disabled}"><Ico n="clock" :s="16"/>
        <input ref="inp" :id="fc.id" type="text" role="combobox" aria-haspopup="dialog" :aria-expanded="open" autocomplete="off" :value="disp" :disabled="disabled" :placeholder="placeholder || (hour12 ? 'h:mm AM' : 'HH:MM')"
            :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby" :aria-required="fc.required || null" @click="show" @change="typed" @keydown.down.prevent="show" @keydown.esc="close(true)">
        <button v-if="clearable && disp && !disabled" type="button" class="k-x" aria-label="Clear time" @click="clear"><Ico n="x" :s="14"/></button></div>
        <KPop :open="open" :anchor="box" role="dialog" aria-label="Choose time" @close="close($event === 'esc')"><div class="k-time" ref="pop"><div class="k-time__cols">
        <div class="k-time__c" role="listbox" aria-label="Hours" @keydown="colKey"><button v-for="(n, i) in hours" :key="n" type="button" role="option" :class="{on: n === selH}" :aria-selected="n === selH" :tabindex="ti(n === selH, i, selH > -1)" @click="setH(n)">{{ hour12 ? n : pad(n) }}</button></div>
        <div class="k-time__c" role="listbox" aria-label="Minutes" @keydown="colKey"><button v-for="(n, i) in mins" :key="n" type="button" role="option" :class="{on: n === selM}" :aria-selected="n === selM" :tabindex="ti(n === selM, i, selM > -1)" @click="setM(n)">{{ pad(n) }}</button></div>
        <div v-if="hour12" class="k-time__c ap" role="listbox" aria-label="AM or PM" @keydown="colKey"><button v-for="(l, i) in ['AM', 'PM']" :key="l" type="button" role="option" :class="{on: pm === (i === 1) && selH > -1}" :aria-selected="pm === (i === 1) && selH > -1" :tabindex="ti(pm === (i === 1), i, selH > -1)" @click="setAp(i === 1)">{{ l }}</button></div></div>
        <div class="k-fcal__f"><button type="button" class="k-link" @click="setNow">Now</button><button type="button" class="k-link" @click="close(true)">Done</button></div></div></KPop></div>`,
};

// ---------- combobox: single or multi select, filter as you type, async search, allow create ----------
export const Combobox = {
    components: {KPop},
    props: {modelValue: {}, options: {type: Array, default: () => []}, multiple: Boolean, search: Function, create: Boolean, placeholder: String, debounce: {type: Number, default: 250}, disabled: Boolean, clearable: Boolean,
        empty: {type: String, default: 'No matches'}, createLabel: {type: String, default: 'Create'}},   // search(query) returns a Promise of options
    emits: ['update:modelValue', 'create'],
    setup(p, {emit}) {
        const fc = useFC(), uid = U.id('kc'), box = ref(null), inp = ref(null), open = ref(false), q = ref(''), typing = ref(false), active = ref(0), loading = ref(false), remote = ref([]);
        const known = {}, remember = l => l.forEach(o => { known[o.v] = o; });
        const base = computed(() => { const l = p.options.map(U.norm); remember(l); return l; });
        const vals = computed(() => p.multiple ? (p.modelValue || []) : (U.empty(p.modelValue) ? [] : [p.modelValue]));
        const lab = v => (known[v] || base.value.find(o => o.v === v))?.l ?? String(v);
        const items = computed(() => {
            const t = q.value.trim(), lt = t.toLowerCase();
            let l = p.search ? remote.value : base.value.filter(o => !lt || o.l.toLowerCase().includes(lt));
            if (p.create && t && !l.some(o => o.l.toLowerCase() === lt) && !vals.value.includes(t)) l = [...l, {v: t, l: p.createLabel + ' "' + t + '"', create: true}];
            return l;
        });
        let seq = 0, tm;
        const run = () => { if (!p.search) return; const my = ++seq; loading.value = true;
            Promise.resolve(p.search(q.value.trim())).then(r => { if (my === seq) { remote.value = (r || []).map(U.norm); remember(remote.value); } }).catch(() => { if (my === seq) remote.value = []; }).finally(() => { if (my === seq) loading.value = false; }); };
        watch(q, () => { if (p.search) { clearTimeout(tm); loading.value = true; tm = setTimeout(run, p.debounce); } });
        watch(items, l => { if (active.value >= l.length) active.value = Math.max(0, l.length - 1); });
        watch(active, a => nextTick(() => document.getElementById(uid + '-' + a)?.scrollIntoView({block: 'nearest'})));
        const text = computed(() => typing.value ? q.value : (p.multiple || !vals.value.length ? '' : lab(vals.value[0])));
        function show() { if (p.disabled || open.value) return; open.value = true; if (p.search && !remote.value.length) run(); active.value = Math.max(0, items.value.findIndex(o => vals.value.includes(o.v))); }
        function hide() { open.value = false; typing.value = false; q.value = ''; clearTimeout(tm); }
        const remove = v => emit('update:modelValue', vals.value.filter(x => x !== v));
        function pick(o) {
            if (!o) return; known[o.v] = {...o, l: o.create ? String(o.v) : o.l}; if (o.create) emit('create', o.v);
            if (p.multiple) { emit('update:modelValue', vals.value.includes(o.v) ? vals.value.filter(x => x !== o.v) : [...vals.value, o.v]); q.value = ''; typing.value = false; inp.value?.focus(); }
            else { emit('update:modelValue', o.v); hide(); }
        }
        function input(e) { q.value = e.target.value; typing.value = true; if (!open.value) show(); active.value = 0; }
        function key(e) {
            const n = Math.max(1, items.value.length), k = e.key;
            if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); if (!open.value) show(); else active.value = (active.value + (k === 'ArrowDown' ? 1 : -1) + n) % n; }
            else if (k === 'Enter') { if (open.value) { e.preventDefault(); pick(items.value[active.value]); } }
            else if (k === 'Escape') { if (open.value) { e.preventDefault(); hide(); } }
            else if (k === 'Backspace' && p.multiple && !q.value && vals.value.length) remove(vals.value[vals.value.length - 1]);
            else if (k === 'Tab') hide();
        }
        return {fc, uid, box, inp, open, text, items, active, loading, vals, lab, show, hide, pick, input, key, remove, focus: () => { inp.value?.focus(); show(); }, clear: () => { emit('update:modelValue', p.multiple ? [] : ''); hide(); }};
    },
    template: `<div class="k-comp"><div class="k-box k-combo" ref="box" :class="{dis: disabled, multi: multiple}" @click="focus">
        <span v-for="v in (multiple ? vals : [])" :key="v" class="k-tag">{{ lab(v) }}<button type="button" class="k-tag__x" :aria-label="'Remove ' + lab(v)" tabindex="-1" @click.stop="remove(v)"><Ico n="x" :s="12"/></button></span>
        <input ref="inp" :id="fc.id" type="text" role="combobox" aria-autocomplete="list" autocomplete="off" :aria-expanded="open" :aria-controls="uid" :aria-activedescendant="open && items[active] ? uid + '-' + active : null"
            :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby" :aria-required="fc.required || null" :value="text" :disabled="disabled" :placeholder="!multiple || !vals.length ? placeholder : ''" @input="input" @keydown="key" @blur="hide">
        <i v-if="loading" class="k-fspin" aria-hidden="true"></i><button v-else-if="clearable && vals.length && !disabled" type="button" class="k-x" aria-label="Clear" tabindex="-1" @click.stop="clear"><Ico n="x" :s="14"/></button><Ico n="down" :s="16" class="k-box__c"/></div>
        <KPop :open="open" :anchor="box" match @close="hide"><ul :id="uid" class="k-list" role="listbox" :aria-multiselectable="multiple || null" @mousedown.prevent>
        <li v-for="(o, i) in items" :id="uid + '-' + i" :key="i" role="option" class="k-opt" :class="{on: i === active, sel: vals.includes(o.v), mk: o.create}" :aria-selected="vals.includes(o.v)" @pointerenter="active = i" @click="pick(o)"><span>{{ o.l }}<small v-if="o.hint">{{ o.hint }}</small></span><Ico v-if="vals.includes(o.v)" n="check" :s="16"/></li>
        <li v-if="!items.length" class="k-opt none" role="presentation">{{ loading ? 'Searching…' : empty }}</li></ul></KPop></div>`,
};

// ---------- tags input: free tags (Enter, comma, paste), Backspace removes the last ----------
export const TagsInput = {
    props: {modelValue: {type: Array, default: () => []}, placeholder: String, max: Number, validate: Function, disabled: Boolean},   // validate(tag) === false rejects (event reject)
    emits: ['update:modelValue', 'reject'],
    setup(p, {emit}) {
        const fc = useFC(), txt = ref(''), inp = ref(null);
        function add(raw) {
            const next = [...p.modelValue];
            String(raw).split(/[,;\n\t]+/).map(s => s.trim()).filter(Boolean).forEach(t => {
                if (next.some(x => x.toLowerCase() === t.toLowerCase()) || (p.max && next.length >= p.max)) return;
                if (p.validate && p.validate(t) === false) return emit('reject', t); next.push(t);
            });
            emit('update:modelValue', next); txt.value = '';
        }
        const input = e => { txt.value = e.target.value; if (/[,;]/.test(txt.value)) add(txt.value); };
        function key(e) {
            if (e.key === 'Enter' && txt.value.trim()) { e.preventDefault(); add(txt.value); }
            else if (e.key === 'Backspace' && !txt.value && p.modelValue.length) emit('update:modelValue', p.modelValue.slice(0, -1));
        }
        const paste = e => { const t = e.clipboardData?.getData('text') || ''; if (/[,;\n\t]/.test(t)) { e.preventDefault(); add(t); } };
        return {fc, txt, inp, add, input, key, paste, remove: t => emit('update:modelValue', p.modelValue.filter(x => x !== t))};
    },
    template: `<div class="k-box k-combo multi" :class="{dis: disabled}" @click="inp.focus()"><span v-for="t in modelValue" :key="t" class="k-tag">{{ t }}<button type="button" class="k-tag__x" :aria-label="'Remove ' + t" @click.stop="remove(t)"><Ico n="x" :s="12"/></button></span>
        <input ref="inp" :id="fc.id" type="text" :value="txt" :disabled="disabled || (max && modelValue.length >= max)" :placeholder="modelValue.length ? '' : (placeholder || 'Type and press Enter')" :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby" aria-label="Add a tag"
            @input="input" @keydown="key" @paste="paste" @blur="txt.trim() && add(txt)"><small v-if="max" class="k-aff">{{ modelValue.length }}/{{ max }}</small></div>`,
};

// ---------- file drop: drag and drop or click, previews, simulated upload with cancel and retry ----------
export const FileDrop = {
    props: {multiple: Boolean, accept: String, maxSize: {type: Number, default: 5 * 1024 * 1024}, maxFiles: {type: Number, default: 10}, label: String, simulate: {type: Boolean, default: true}},
    emits: ['files', 'done', 'remove'],   // files: accepted File[] of one drop; done: File finished uploading; remove: File removed. A file named "fail" fails once, to show retry.
    setup(p, {emit}) {
        const fc = useFC(), items = ref([]), over = ref(false), inp = ref(null);
        const size = n => n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
        const okType = f => !p.accept || p.accept.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).some(t => t.startsWith('.') ? f.name.toLowerCase().endsWith(t) : t.endsWith('/*') ? f.type.startsWith(t.slice(0, -1)) : f.type === t);
        function run(it) {
            it.status = 'uploading'; it.error = ''; clearInterval(it.timer);
            it.timer = setInterval(() => {
                it.progress = Math.min(100, it.progress + 3 + Math.random() * 10);
                if (it.fail && it.progress >= 55) { clearInterval(it.timer); it.status = 'error'; it.error = 'Upload failed'; }
                else if (it.progress >= 100) { clearInterval(it.timer); it.status = 'done'; emit('done', it.file); }
            }, 180);
        }
        function drop(it, silent) { clearInterval(it.timer); if (it.preview) URL.revokeObjectURL(it.preview); const i = items.value.indexOf(it); if (i > -1) items.value.splice(i, 1); if (!silent) emit('remove', it.file); }
        function add(list) {
            let files = [...list]; if (!p.multiple) { [...items.value].forEach(i => drop(i, true)); files = files.slice(0, 1); }
            const good = [];
            files.forEach(f => {
                const it = reactive({id: U.id('f'), file: f, name: f.name, size: f.size, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : '', progress: 0, status: 'queued', error: '', fatal: false, fail: /fail/i.test(f.name), timer: 0});
                const bad = items.value.length >= p.maxFiles ? 'Too many files (max ' + p.maxFiles + ')' : !okType(f) ? 'File type not allowed' : f.size > p.maxSize ? 'Too large (max ' + size(p.maxSize) + ')' : '';
                if (bad) { it.status = 'error'; it.error = bad; it.fatal = true; }
                items.value.push(it); if (bad) return; good.push(f);
                if (p.simulate) run(it); else { it.progress = 100; it.status = 'done'; }
            });
            if (good.length) emit('files', good);
        }
        const dropped = e => { over.value = false; add(e.dataTransfer?.files || []); };
        onBeforeUnmount(() => [...items.value].forEach(i => drop(i, true)));
        return {fc, items, over, inp, size, add, dropped, remove: drop, run, hintText: computed(() => [p.accept && 'Accepts ' + p.accept, 'max ' + size(p.maxSize)].filter(Boolean).join(', ')),
            cancel: it => { clearInterval(it.timer); it.status = 'error'; it.error = 'Canceled'; }, retry: it => { it.fail = false; it.progress = 0; run(it); }, pick: e => { add(e.target.files); e.target.value = ''; }};
    },
    template: `<div class="k-comp"><div class="k-drop" :class="{over, bad: fc.invalid}" :id="fc.id" role="button" tabindex="0" :aria-describedby="fc.describedby" @click="inp.click()" @keydown.enter.prevent="inp.click()" @keydown.space.prevent="inp.click()"
        @dragenter.prevent="over = true" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="dropped"><Ico n="upload" :s="26"/><b>{{ label || 'Drop files here or click to browse' }}</b><small>{{ hintText }}</small>
        <input ref="inp" type="file" hidden tabindex="-1" :multiple="multiple" :accept="accept" @change="pick" @click.stop></div>
        <ul v-if="items.length" class="k-files" aria-live="polite"><li v-for="it in items" :key="it.id" :class="it.status"><span class="k-files__t"><img v-if="it.preview" :src="it.preview" alt=""><Ico v-else n="file" :s="20"/></span>
        <div class="k-files__m"><b>{{ it.name }}</b><small>{{ size(it.size) }}<template v-if="it.status === 'uploading'"> · {{ Math.round(it.progress) }}%</template></small><Progress v-if="it.status === 'uploading'" :value="Math.round(it.progress)"/></div>
        <Badge v-if="it.status === 'done'" kind="g">Uploaded</Badge><Badge v-else-if="it.status === 'error'" kind="r">{{ it.error }}</Badge>
        <button v-if="it.status === 'uploading'" type="button" class="k-fib" :aria-label="'Cancel ' + it.name" @click="cancel(it)"><Ico n="x" :s="16"/></button>
        <template v-else><button v-if="it.status === 'error' && !it.fatal" type="button" class="k-fib" :aria-label="'Retry ' + it.name" @click="retry(it)"><Ico n="refresh" :s="16"/></button><button type="button" class="k-fib" :aria-label="'Remove ' + it.name" @click="remove(it)"><Ico n="trash" :s="16"/></button></template></li></ul></div>`,
};

// ---------- password field with strength meter and live rules ----------
export const PASSWORD_RULES = [
    {t: 'At least 8 characters', f: s => s.length >= 8}, {t: 'Upper and lower case letters', f: s => /[a-z]/.test(s) && /[A-Z]/.test(s)},
    {t: 'A number', f: s => /\d/.test(s)}, {t: 'A symbol', f: s => /[^A-Za-z0-9]/.test(s)},
];
export const PasswordField = {
    props: {modelValue: {type: String, default: ''}, placeholder: String, checklist: {type: Boolean, default: true}, meter: {type: Boolean, default: true}, rules: {type: Array, default: () => PASSWORD_RULES}, autocomplete: {type: String, default: 'new-password'}},
    emits: ['update:modelValue', 'strength'],
    setup(p, {emit}) {
        const fc = useFC(), show = ref(false), labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const rows = computed(() => p.rules.map(r => ({t: r.t, ok: r.f(p.modelValue)})));
        const score = computed(() => { const s = p.modelValue; if (!s) return 0; let n = rows.value.filter(r => r.ok).length + (s.length >= 12 ? 1 : 0); if (s.length < 8) n = Math.min(n, 1); return U.clamp(n, 1, 4); });
        watch(score, s => emit('strength', s), {immediate: true});
        return {fc, show, rows, score, label: computed(() => labels[score.value])};
    },
    template: `<div class="k-pw"><div class="k-box"><Ico n="lock" :s="16"/><input :id="fc.id" :type="show ? 'text' : 'password'" :value="modelValue" :placeholder="placeholder" :autocomplete="autocomplete" :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby" :aria-required="fc.required || null" @input="$emit('update:modelValue', $event.target.value)">
        <button type="button" class="k-x" :aria-pressed="show" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show"><Ico :n="show ? 'eyeoff' : 'eye'" :s="16"/></button></div>
        <div v-if="meter && modelValue" class="k-meter" :data-s="score" role="meter" aria-label="Password strength" aria-valuemin="0" aria-valuemax="4" :aria-valuenow="score" :aria-valuetext="label"><i v-for="i in 4" :key="i" :class="{on: i <= score}"></i><small>{{ label }}</small></div>
        <ul v-if="checklist" class="k-rules"><li v-for="r in rows" :key="r.t" :class="{ok: r.ok}"><Ico :n="r.ok ? 'check' : 'minus'" :s="13"/>{{ r.t }}</li></ul></div>`,
};

// ---------- one-time code input ----------
export const OtpInput = {
    props: {modelValue: {type: String, default: ''}, length: {type: Number, default: 6}, numeric: {type: Boolean, default: true}, mask: Boolean, disabled: Boolean},
    emits: ['update:modelValue', 'complete'],
    setup(p, {emit}) {
        const fc = useFC(), refs = [], d = ref(Array.from({length: p.length}, (_, i) => p.modelValue[i] || ''));
        const okc = c => p.numeric ? /\d/.test(c) : /[A-Za-z0-9]/.test(c), focus = i => refs[U.clamp(i, 0, p.length - 1)]?.focus();
        watch(() => p.modelValue, v => { if (v !== d.value.join('')) d.value = Array.from({length: p.length}, (_, i) => v[i] || ''); });
        function out() { const s = d.value.join(''); emit('update:modelValue', s); if (d.value.every(Boolean)) emit('complete', s); }
        function input(i, e) { const c = [...e.target.value].filter(okc).pop() || ''; d.value[i] = c; e.target.value = c; out(); if (c) focus(i + 1); }
        function key(i, e) {
            if (e.key === 'Backspace' && !d.value[i] && i > 0) { e.preventDefault(); d.value[i - 1] = ''; out(); focus(i - 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1); }
        }
        function paste(i, e) { e.preventDefault(); const cs = [...(e.clipboardData?.getData('text') || '')].filter(okc).slice(0, p.length - i); cs.forEach((c, k) => { d.value[i + k] = c; }); out(); focus(i + cs.length); }
        return {fc, refs, d, input, key, paste, focus};
    },
    template: `<div class="k-otp" role="group" :aria-labelledby="fc.labelId" :aria-describedby="fc.describedby"><input v-for="(c, i) in d" :key="i" :ref="el => (refs[i] = el)" :id="i === 0 ? fc.id : null" class="k-otp__i" :class="{bad: fc.invalid}" :type="mask ? 'password' : 'text'" :inputmode="numeric ? 'numeric' : 'text'"
        maxlength="1" :autocomplete="i === 0 ? 'one-time-code' : 'off'" :value="c" :disabled="disabled" :aria-label="'Digit ' + (i + 1) + ' of ' + d.length" @input="input(i, $event)" @keydown="key(i, $event)" @paste="paste(i, $event)" @focus="$event.target.select()"></div>`,
};

// ---------- rating (stars, optional half steps) ----------
export const RatingInput = {
    props: {modelValue: {type: Number, default: 0}, max: {type: Number, default: 5}, half: Boolean, readonly: Boolean, size: {type: Number, default: 26}},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const fc = useFC(), hv = ref(0), shown = computed(() => hv.value || p.modelValue);
        const at = (e, i) => { const r = e.currentTarget.getBoundingClientRect(); return p.half && e.clientX - r.left < r.width / 2 ? i - .5 : i; };
        const set = v => { if (!p.readonly) emit('update:modelValue', U.clamp(v, 0, p.max)); };
        function key(e) { const s = p.half ? .5 : 1, m = {ArrowRight: p.modelValue + s, ArrowUp: p.modelValue + s, ArrowLeft: p.modelValue - s, ArrowDown: p.modelValue - s, Home: 0, End: p.max}; if (e.key in m) { e.preventDefault(); set(m[e.key]); } }
        return {fc, hv, star: PATHS.star, fill: i => U.clamp(shown.value - (i - 1), 0, 1) * 100, key, click: (e, i) => { const v = at(e, i); set(v === p.modelValue ? 0 : v); }, move: (e, i) => { if (!p.readonly && e.pointerType !== 'touch') hv.value = at(e, i); }};
    },
    template: `<div class="k-rate" :class="{ro: readonly}" role="slider" :id="fc.id" :tabindex="readonly ? -1 : 0" aria-label="Rating" aria-valuemin="0" :aria-valuemax="max" :aria-valuenow="modelValue" :aria-valuetext="modelValue + ' of ' + max" :aria-readonly="readonly || null" :aria-describedby="fc.describedby" @keydown="key" @pointerleave="hv = 0">
        <span v-for="i in max" :key="i" class="k-star" :style="{width: size + 'px', height: size + 'px'}" @click="click($event, i)" @pointermove="move($event, i)"><svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true"><path :d="star"/></svg>
        <span class="k-star__f" :style="{width: fill(i) + '%'}"><svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true"><path :d="star"/></svg></span></span></div>`,
};

// ---------- dual thumb range slider ----------
export const RangeSlider = {
    props: {modelValue: {type: Array, default: () => [0, 100]}, min: {type: Number, default: 0}, max: {type: Number, default: 100}, step: {type: Number, default: 1}, unit: {type: String, default: ''}, minGap: {type: Number, default: 0}, format: Function},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const fc = useFC(), el = ref(null), drag = ref(-1);
        const pct = v => (v - p.min) / (p.max - p.min) * 100, snap = v => +U.clamp(Math.round((v - p.min) / p.step) * p.step + p.min, p.min, p.max).toFixed(6);
        function set(i, v) { const [a, b] = p.modelValue; v = snap(v); v = i === 0 ? Math.min(v, b - p.minGap) : Math.max(v, a + p.minGap); emit('update:modelValue', i === 0 ? [v, b] : [a, v]); }
        const at = e => { const r = el.value.getBoundingClientRect(); return p.min + U.clamp((e.clientX - r.left) / r.width, 0, 1) * (p.max - p.min); };
        function down(e) {
            const v = at(e), [a, b] = p.modelValue;
            drag.value = e.target.dataset.i !== undefined ? +e.target.dataset.i : a === b ? (v < a ? 0 : 1) : (Math.abs(v - a) <= Math.abs(v - b) ? 0 : 1);
            el.value.setPointerCapture(e.pointerId); set(drag.value, v); el.value.querySelectorAll('[role=slider]')[drag.value]?.focus({preventScroll: true});
        }
        function key(i, e) {
            const [a, b] = p.modelValue, cur = i ? b : a, s = p.step, m = {ArrowRight: cur + s, ArrowUp: cur + s, ArrowLeft: cur - s, ArrowDown: cur - s, PageUp: cur + s * 10, PageDown: cur - s * 10, Home: p.min, End: p.max};
            if (e.key in m) { e.preventDefault(); set(i, m[e.key]); }
        }
        return {fc, el, pct, down, key, move: e => { if (drag.value > -1) set(drag.value, at(e)); }, up: () => { drag.value = -1; }, drag, txt: v => p.format ? p.format(v) : v + p.unit};
    },
    template: `<div class="k-rs" role="group" :aria-labelledby="fc.labelId" :aria-describedby="fc.describedby"><div class="k-rs__v"><b>{{ txt(modelValue[0]) }}</b><span>to</span><b>{{ txt(modelValue[1]) }}</b></div>
        <div class="k-rs__in" ref="el" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"><div class="k-rs__t"><i :style="{left: pct(modelValue[0]) + '%', width: pct(modelValue[1]) - pct(modelValue[0]) + '%'}"></i></div>
        <button v-for="i in 2" :key="i" type="button" role="slider" class="k-rs__h" :class="{on: drag === i - 1}" :data-i="i - 1" :id="i === 1 ? fc.id : null" :style="{left: pct(modelValue[i - 1]) + '%'}" :aria-label="i === 1 ? 'Minimum' : 'Maximum'"
            :aria-valuemin="i === 1 ? min : modelValue[0]" :aria-valuemax="i === 1 ? modelValue[1] : max" :aria-valuenow="modelValue[i - 1]" :aria-valuetext="txt(modelValue[i - 1])" @keydown="key(i - 1, $event)"></button></div>
        <div class="k-rs__m"><small>{{ txt(min) }}</small><small>{{ txt(max) }}</small></div></div>`,
};

// ---------- colour picker: swatches, saturation / value square, hue strip, hex ----------
const hsv2rgb = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)].map(x => Math.round(x * 255)); };
const rgb2hsv = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); let h = 0;
    if (d) { h = (mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; };
const hex2rgb = s => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((s || '').trim()); if (!m) return null; const x = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]; return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16)); };
const rgb2hex = c => '#' + c.map(n => n.toString(16).padStart(2, '0')).join('');
export const ColorPicker = {
    components: {KPop},
    props: {modelValue: {type: String, default: '#7c6cff'}, swatches: {type: Array, default: () => ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6', '#7c6cff', '#ec4899', '#64748b', '#111827']}, disabled: Boolean},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const fc = useFC(), box = ref(null), open = ref(false), c0 = hex2rgb(p.modelValue) || [124, 108, 255], [h0, s0, v0] = rgb2hsv(...c0), hue = ref(h0), sat = ref(s0), val = ref(v0);
        const hex = computed(() => rgb2hex(hsv2rgb(hue.value, sat.value, val.value)));
        watch(() => p.modelValue, m => { const c = hex2rgb(m); if (c && rgb2hex(c) !== hex.value) [hue.value, sat.value, val.value] = rgb2hsv(...c); });
        const apply = () => emit('update:modelValue', hex.value);
        let kind = ''; const rect = e => e.currentTarget.getBoundingClientRect();
        function drag(e) {
            const r = rect(e), x = U.clamp((e.clientX - r.left) / r.width, 0, 1);
            if (kind === 'hue') hue.value = x * 360; else { sat.value = x; val.value = 1 - U.clamp((e.clientY - r.top) / r.height, 0, 1); }
            apply();
        }
        const down = (k, e) => { kind = k; e.currentTarget.setPointerCapture(e.pointerId); drag(e); };
        const move = e => { if (kind) drag(e); };
        function svKey(e) { const d = e.shiftKey ? .1 : .01, m = {ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d]}[e.key]; if (m) { e.preventDefault(); sat.value = U.clamp(sat.value + m[0], 0, 1); val.value = U.clamp(val.value + m[1], 0, 1); apply(); } }
        function hueKey(e) { const d = e.shiftKey ? 10 : 1, m = {ArrowLeft: -d, ArrowDown: -d, ArrowRight: d, ArrowUp: d}[e.key]; if (m) { e.preventDefault(); hue.value = U.clamp(hue.value + m, 0, 360); apply(); } }
        function setHex(s) { const c = hex2rgb(s); if (c) { [hue.value, sat.value, val.value] = rgb2hsv(...c); apply(); } }
        const hexIn = e => { const c = hex2rgb(e.target.value); if (c) setHex(e.target.value); e.target.value = hex.value.slice(1); };
        const close = refocus => { open.value = false; if (refocus) box.value?.focus(); };
        return {fc, box, open, hex, hue, sat, val, down, move, stop: () => { kind = ''; }, svKey, hueKey, setHex, hexIn, close};
    },
    template: `<div class="k-comp"><button type="button" class="k-box k-colorbtn" ref="box" :id="fc.id" :disabled="disabled" aria-haspopup="dialog" :aria-expanded="open" :aria-describedby="fc.describedby" @click="open = !open" @keydown.down.prevent="open = true"><i class="k-sw" :style="{background: hex}"></i><span>{{ hex }}</span><Ico n="down" :s="16" class="k-box__c"/></button>
        <KPop :open="open" :anchor="box" role="dialog" aria-label="Choose colour" @close="close($event === 'esc')"><div class="k-color">
        <div class="k-color__sw"><button v-for="c in swatches" :key="c" type="button" class="k-sw" :class="{on: c.toLowerCase() === hex}" :style="{background: c}" :aria-label="'Use ' + c" @click="setHex(c)"></button></div>
        <div class="k-color__sv" role="slider" tabindex="0" aria-label="Saturation and brightness" :aria-valuetext="'Saturation ' + Math.round(sat * 100) + '%, brightness ' + Math.round(val * 100) + '%'" :style="{'--hue': hue}" @pointerdown="down('sv', $event)" @pointermove="move" @pointerup="stop" @pointercancel="stop" @keydown="svKey"><i :style="{left: sat * 100 + '%', top: (1 - val) * 100 + '%', background: hex}"></i></div>
        <div class="k-color__hue" role="slider" tabindex="0" aria-label="Hue" aria-valuemin="0" aria-valuemax="360" :aria-valuenow="Math.round(hue)" @pointerdown="down('hue', $event)" @pointermove="move" @pointerup="stop" @pointercancel="stop" @keydown="hueKey"><i :style="{left: hue / 360 * 100 + '%'}"></i></div>
        <div class="k-box k-color__hex"><span class="k-aff">#</span><input :value="hex.slice(1)" maxlength="7" autocomplete="off" aria-label="Hex colour" @change="hexIn" @keydown.enter="hexIn"></div></div></KPop></div>`,
};

// ---------- number field: unit, step buttons with long-press repeat, clamp ----------
export const NumberField = {
    props: {modelValue: Number, min: Number, max: Number, step: {type: Number, default: 1}, unit: String, placeholder: String, precision: Number, disabled: Boolean},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const fc = useFC(), txt = ref(''), foc = ref(false), prec = computed(() => p.precision ?? (String(p.step).split('.')[1] || '').length);
        const lo = () => p.min ?? -Infinity, hi = () => p.max ?? Infinity, clamp = v => Math.min(hi(), Math.max(lo(), v));
        const f = v => v == null || isNaN(v) ? '' : v.toFixed(prec.value), parse = s => { const n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? null : n; };
        watch(() => p.modelValue, v => { if (!foc.value) txt.value = f(v); }, {immediate: true});
        function input(e) { txt.value = e.target.value; const n = parse(txt.value); if (n !== null && n >= lo() && n <= hi()) emit('update:modelValue', n); }
        function commit() { foc.value = false; const n = parse(txt.value); if (n === null) { txt.value = f(p.modelValue); return; } const v = +clamp(n).toFixed(prec.value); emit('update:modelValue', v); txt.value = f(v); }
        function bump(dir, mult = 1) { const v = +clamp((parse(txt.value) ?? p.modelValue ?? 0) + dir * p.step * mult).toFixed(prec.value); emit('update:modelValue', v); txt.value = f(v); }
        let t1, t2, n = 0;
        const release = () => { clearTimeout(t1); clearInterval(t2); };
        function hold(dir) { if (p.disabled) return; release(); bump(dir); n = 0; t1 = setTimeout(() => { t2 = setInterval(() => bump(dir, ++n > 15 ? 10 : 1), 70); }, 420); }
        onMounted(() => addEventListener('pointerup', release)); onBeforeUnmount(() => { release(); removeEventListener('pointerup', release); });
        function key(e) { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); bump(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 10 : 1); } else if (e.key === 'Enter') commit(); }
        return {fc, txt, foc, input, commit, hold, release, key, atMin: computed(() => p.modelValue != null && p.min != null && p.modelValue <= p.min), atMax: computed(() => p.modelValue != null && p.max != null && p.modelValue >= p.max)};
    },
    template: `<div class="k-box k-num" :class="{dis: disabled}"><button type="button" class="k-fib" tabindex="-1" aria-label="Decrease" :disabled="disabled || atMin" @pointerdown.prevent="hold(-1)" @pointerleave="release"><Ico n="minus" :s="16"/></button>
        <input :id="fc.id" type="text" role="spinbutton" inputmode="decimal" autocomplete="off" :value="txt" :placeholder="placeholder" :disabled="disabled" :aria-valuenow="modelValue" :aria-valuemin="min" :aria-valuemax="max" :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby"
            @input="input" @focus="foc = true" @blur="commit" @keydown="key"><span v-if="unit" class="k-aff">{{ unit }}</span>
        <button type="button" class="k-fib" tabindex="-1" aria-label="Increase" :disabled="disabled || atMax" @pointerdown.prevent="hold(1)" @pointerleave="release"><Ico n="plus" :s="16"/></button></div>`,
};

// ---------- search field: clear button, debounced search event, optional shortcut hint ("/" or "mod+k") ----------
export const SearchField = {
    props: {modelValue: {type: String, default: ''}, placeholder: {type: String, default: 'Search…'}, debounce: {type: Number, default: 300}, shortcut: String},
    emits: ['update:modelValue', 'search', 'clear'],
    setup(p, {emit}) {
        const fc = useFC(), inp = ref(null), foc = ref(false), mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent); let tm;
        const hint = computed(() => (p.shortcut || '').split('+').map(s => s.toLowerCase() === 'mod' ? (mac ? '⌘' : 'Ctrl') : s.toUpperCase()).join(' '));
        function gk(e) {
            if (!p.shortcut) return; const parts = p.shortcut.toLowerCase().split('+'), mod = parts.includes('mod'), a = document.activeElement;
            if (e.key.toLowerCase() !== parts[parts.length - 1] || mod !== (e.metaKey || e.ctrlKey)) return;
            if (!mod && (/^(INPUT|TEXTAREA|SELECT)$/.test(a?.tagName) || a?.isContentEditable)) return; e.preventDefault(); inp.value?.focus();
        }
        onMounted(() => addEventListener('keydown', gk)); onBeforeUnmount(() => { removeEventListener('keydown', gk); clearTimeout(tm); });
        function input(e) { const v = e.target.value; emit('update:modelValue', v); clearTimeout(tm); tm = setTimeout(() => emit('search', v), p.debounce); }
        function clear() { clearTimeout(tm); emit('update:modelValue', ''); emit('search', ''); emit('clear'); inp.value?.focus(); }
        function key(e) { if (e.key === 'Enter') { clearTimeout(tm); emit('search', p.modelValue); } else if (e.key === 'Escape' && p.modelValue) { e.preventDefault(); clear(); } }
        return {fc, inp, foc, hint, input, clear, key};
    },
    template: `<div class="k-box k-search" role="search"><Ico n="search" :s="16"/><input ref="inp" :id="fc.id" type="search" autocomplete="off" :value="modelValue" :placeholder="placeholder" :aria-describedby="fc.describedby" @input="input" @keydown="key" @focus="foc = true" @blur="foc = false">
        <button v-if="modelValue" type="button" class="k-x" aria-label="Clear search" @click="clear"><Ico n="x" :s="14"/></button><kbd v-else-if="shortcut && !foc" class="k-kbd" aria-hidden="true">{{ hint }}</kbd></div>`,
};

// ---------- textarea that grows, with a character counter ----------
export const AutoTextarea = {
    props: {modelValue: {type: String, default: ''}, rows: {type: Number, default: 3}, maxRows: {type: Number, default: 10}, maxLength: Number, placeholder: String, counter: {type: Boolean, default: true}, disabled: Boolean},
    emits: ['update:modelValue'],
    setup(p) {
        const fc = useFC(), ta = ref(null);
        const fit = () => { const e = ta.value; if (!e) return; e.style.height = 'auto'; e.style.height = e.scrollHeight + 'px'; };
        watch(() => p.modelValue, () => nextTick(fit)); onMounted(() => { fit(); addEventListener('resize', fit); }); onBeforeUnmount(() => removeEventListener('resize', fit));
        return {fc, ta, fit, n: computed(() => p.modelValue.length)};
    },
    template: `<div class="k-box k-area" :class="{dis: disabled}" :style="{'--rows': rows, '--max-rows': maxRows}"><textarea ref="ta" :id="fc.id" :rows="rows" :value="modelValue" :maxlength="maxLength" :placeholder="placeholder" :disabled="disabled" :aria-invalid="fc.invalid || null" :aria-describedby="fc.describedby" @input="$emit('update:modelValue', $event.target.value); fit()"></textarea>
        <small v-if="counter && maxLength" class="k-count" :class="{warn: n >= maxLength * .9, bad: n >= maxLength}" aria-live="polite">{{ n }} / {{ maxLength }}</small></div>`,
};

export const KIT_FORMS = {FormField, TextInput, CheckBox, CheckGroup, RadioGroup, DatePicker, TimePicker, Combobox, TagsInput, FileDrop, PasswordField, OtpInput, RatingInput, RangeSlider, ColorPicker, NumberField, SearchField, AutoTextarea, KPop};

// ---------- showcase ----------
const COUNTRIES = ['Austria', 'Bosnia and Herzegovina', 'Croatia', 'Germany', 'Italy', 'Montenegro', 'North Macedonia', 'Serbia', 'Slovenia', 'Switzerland'];
const PEOPLE = [{v: 'ana', l: 'Ana Kovač', hint: 'Sales, Zagreb'}, {v: 'marko', l: 'Marko Petrović', hint: 'Sales, Belgrade'}, {v: 'lea', l: 'Lea Novak', hint: 'Key accounts, Ljubljana'}, {v: 'emir', l: 'Emir Hadžić', hint: 'Support, Sarajevo'}, {v: 'mia', l: 'Mia Berger', hint: 'Partners, Vienna'}, {v: 'luka', l: 'Luka Marić', hint: 'Sales, Split'}];
const findPeople = q => new Promise(res => setTimeout(() => res(PEOPLE.filter(x => x.l.toLowerCase().includes(q.toLowerCase()))), 650));   // fake server search

export const DemoForms = {
    components: KIT_FORMS,
    setup() {
        const f = useForm({name: '', email: '', phone: '', type: 'company', country: '', manager: '', period: ['', ''], call: '', limit: 5000, tags: [], password: '', confirm: '', notes: '', logo: [], ok: false}, {
            name: [rules.required(), rules.minLength(2)], email: [rules.required(), rules.email()], phone: [rules.pattern(/^\+?[0-9 ()-]{7,}$/, 'Use digits, spaces and a leading + only')], country: [rules.required()],
            period: [rules.custom(p => (p[0] && p[1]) || 'Pick a start and an end date')], limit: [rules.required(), rules.min(0), rules.max(50000)], password: [rules.required(), rules.minLength(8), rules.pattern(/\d/, 'Add a number')],
            confirm: [rules.match('password', 'The passwords do not match')], notes: [rules.maxLength(280)], ok: [rules.custom(v => v || 'Please confirm before saving')],
        });
        const errCount = computed(() => Object.values(f.errors).filter(Boolean).length);
        function submit() { if (f.validate()) toast('Customer created: ' + f.values.name); else toast(errCount.value + ' field(s) need attention', 'err'); }
        const g = reactive({check: true, mixed: ['email'], plan: 'pro', plan2: 'mail', date: '', range: ['', ''], time: '14:30', time12: '09:15', one: 'Croatia', multi: ['Serbia', 'Slovenia'], async: [], tags: ['vip', 'wholesale'], pw: '', otp: '', rate: 3.5, price: [200, 800], color: '#7c6cff', num: 12, q: '', searched: '', text: ''});
        const today = U.iso(new Date()), pay = ['email', 'sms', 'post', 'push'];
        return {f, submit, errCount, g, today, pay, COUNTRIES, PEOPLE, findPeople, json: v => JSON.stringify(v), toast};
    },
    template: `<div class="page k-demo">
        <Holder title="New customer" sub="useForm: rules, touched, validate(), reset(), isValid. Blur a field or press Create to see messages.">
          <template #actions><Badge :kind="f.isValid ? 'g' : 'y'">{{ f.isValid ? 'Valid' : 'Incomplete' }}</Badge></template>
          <form class="k-form" novalidate @submit.prevent="submit">
            <div class="k-grid2">
              <FormField label="Company name" required hint="Legal name as printed on invoices" v-bind="f.field('name')"><TextInput v-model="f.values.name" icon="users" placeholder="Acme d.o.o." autocomplete="organization"/></FormField>
              <FormField label="Contact email" required v-bind="f.field('email')"><TextInput v-model="f.values.email" type="email" icon="mail" placeholder="billing@acme.example" autocomplete="email"/></FormField>
              <FormField label="Phone" v-bind="f.field('phone')"><TextInput v-model="f.values.phone" type="tel" icon="phone" placeholder="+385 1 234 5678" autocomplete="tel"/></FormField>
              <FormField label="Country" required v-bind="f.field('country')"><Combobox v-model="f.values.country" :options="COUNTRIES" placeholder="Pick a country" clearable/></FormField>
            </div>
            <FormField label="Customer type" v-bind="f.field('type')"><RadioGroup v-model="f.values.type" variant="cards" :options="[{v: 'company', l: 'Company', hint: 'VAT invoices'}, {v: 'person', l: 'Individual', hint: 'Retail prices'}, {v: 'public', l: 'Public body', hint: 'Tenders, 60 day terms'}]"/></FormField>
            <div class="k-grid2">
              <FormField label="Account manager" hint="Async search, type to filter" v-bind="f.field('manager')"><Combobox v-model="f.values.manager" :search="findPeople" placeholder="Search colleagues" clearable/></FormField>
              <FormField label="Contract period" required v-bind="f.field('period')"><DatePicker v-model="f.values.period" range :min="today"/></FormField>
              <FormField label="Best time to call" v-bind="f.field('call')"><TimePicker v-model="f.values.call"/></FormField>
              <FormField label="Credit limit" required v-bind="f.field('limit')"><NumberField v-model="f.values.limit" unit="EUR" :step="500" :min="0" :max="50000"/></FormField>
            </div>
            <FormField label="Tags" hint="Enter or comma adds, paste a list, Backspace removes" v-bind="f.field('tags')"><TagsInput v-model="f.values.tags" placeholder="vip, wholesale, …"/></FormField>
            <div class="k-grid2">
              <FormField label="Portal password" required v-bind="f.field('password')"><PasswordField v-model="f.values.password"/></FormField>
              <FormField label="Repeat password" v-bind="f.field('confirm')"><PasswordField v-model="f.values.confirm" :checklist="false" :meter="false" autocomplete="new-password"/></FormField>
            </div>
            <FormField label="Notes" v-bind="f.field('notes')"><AutoTextarea v-model="f.values.notes" :max-length="280" placeholder="Anything the team should know"/></FormField>
            <FormField label="Logo"><FileDrop accept="image/*" label="Drop a logo here or click" :max-size="2097152" @files="f.values.logo = $event.map(x => x.name)"/></FormField>
            <FormField v-bind="f.field('ok')"><CheckBox v-model="f.values.ok" label="I confirm the details are correct" hint="You can change them later in the customer card"/></FormField>
            <div class="actions"><span v-if="errCount" class="k-sum"><Ico n="x" :s="14"/>{{ errCount }} to fix</span><button type="button" class="btn" @click="f.reset()">Reset</button><button type="submit" class="btn primary">Create customer</button></div>
          </form>
          <code class="k-live">{{ json(f.values) }}</code>
        </Holder>
        <Holder title="Control gallery" sub="Every control with its live value">
          <div class="k-gal">
            <Card><h4>Checkbox</h4><div class="k-stack"><CheckBox v-model="g.check" label="Send invoices by email"/><CheckBox :model-value="false" indeterminate label="Indeterminate"/><CheckBox :model-value="true" disabled label="Disabled"/></div><code class="k-live">{{ g.check }}</code></Card>
            <Card><h4>Check group</h4><CheckGroup v-model="g.mixed" :options="pay" all="All channels"/><code class="k-live">{{ json(g.mixed) }}</code></Card>
            <Card><h4>Radio group (list)</h4><RadioGroup v-model="g.plan" :options="[{v: 'free', l: 'Free'}, {v: 'pro', l: 'Pro', hint: '9 EUR per seat'}, {v: 'biz', l: 'Business', hint: '29 EUR per seat'}]"/><code class="k-live">{{ g.plan }}</code></Card>
            <Card><h4>Radio group (cards)</h4><RadioGroup v-model="g.plan2" variant="cards" :options="[{v: 'mail', l: 'Mail'}, {v: 'sms', l: 'SMS'}, {v: 'call', l: 'Call'}]"/><code class="k-live">{{ g.plan2 }}</code></Card>
            <Card><h4>Date picker</h4><DatePicker v-model="g.date" :min="today"/><code class="k-live">{{ g.date || '(empty)' }}</code></Card>
            <Card><h4>Date range</h4><DatePicker v-model="g.range" range/><code class="k-live">{{ json(g.range) }}</code></Card>
            <Card><h4>Time, 24h</h4><TimePicker v-model="g.time" :step="15"/><code class="k-live">{{ g.time }}</code></Card>
            <Card><h4>Time, 12h</h4><TimePicker v-model="g.time12" hour12/><code class="k-live">{{ g.time12 }}</code></Card>
            <Card><h4>Combobox</h4><Combobox v-model="g.one" :options="COUNTRIES" clearable/><code class="k-live">{{ g.one }}</code></Card>
            <Card><h4>Multi, allow create</h4><Combobox v-model="g.multi" :options="COUNTRIES" multiple create placeholder="Add markets" @create="toast('Created ' + $event)"/><code class="k-live">{{ json(g.multi) }}</code></Card>
            <Card><h4>Async multi</h4><Combobox v-model="g.async" :search="findPeople" multiple placeholder="Search people"/><code class="k-live">{{ json(g.async) }}</code></Card>
            <Card><h4>Tags input</h4><TagsInput v-model="g.tags" :max="6"/><code class="k-live">{{ json(g.tags) }}</code></Card>
            <Card class="k-wide"><h4>File drop</h4><FileDrop multiple accept="image/*,.pdf" label="Drop files, name one with “fail” to see retry"/></Card>
            <Card><h4>Password</h4><PasswordField v-model="g.pw"/></Card>
            <Card><h4>One-time code</h4><OtpInput v-model="g.otp" @complete="toast('Code ' + $event + ' entered')"/><code class="k-live">{{ g.otp || '(empty)' }}</code></Card>
            <Card><h4>Rating, half steps</h4><RatingInput v-model="g.rate" half/><code class="k-live">{{ g.rate }}</code></Card>
            <Card><h4>Range slider</h4><RangeSlider v-model="g.price" :min="0" :max="1000" :step="10" unit=" EUR" :min-gap="50"/><code class="k-live">{{ json(g.price) }}</code></Card>
            <Card><h4>Colour</h4><ColorPicker v-model="g.color"/><code class="k-live">{{ g.color }}</code></Card>
            <Card><h4>Number</h4><NumberField v-model="g.num" unit="kg" :min="0" :max="100" :step="0.5"/><code class="k-live">{{ g.num }}</code></Card>
            <Card><h4>Search</h4><SearchField v-model="g.q" shortcut="mod+k" placeholder="Search customers" @search="g.searched = $event"/><code class="k-live">typed: {{ g.q }} | search event: {{ g.searched }}</code></Card>
            <Card class="k-wide"><h4>Auto textarea</h4><AutoTextarea v-model="g.text" :max-length="200" :rows="2" placeholder="Grows with the text"/></Card>
          </div></Holder></div>`,
};

export function registerKitForms(app) {
    Object.entries({...KIT_FORMS, DemoForms}).forEach(([k, c]) => app.component(k, c));
}
