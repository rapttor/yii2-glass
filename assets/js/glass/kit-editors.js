// Glass kit, third-party editors and sliders: Quill, Trix, Swiper, noUiSlider. Register with `registerKitEditors(app)`; `DemoEditors` and `DemoSliders` show them.
// Styles: scss/kit/_editors.scss (class prefix k-). Libraries: js/vendor/ext/{quill,trix,swiper,nouislider}/, loaded on demand by ext-loader.js. Needs the global Ico, Holder, Card, Badge, Segmented, Toggle and Field of the v4 kit.
// SECURITY: every HTML value the editors emit or load, and every preview, goes through sanitizeHtml() (allow-list). It protects the browser only: the server must sanitise again before it stores or shows HTML.
import { ref, reactive, computed, watch, inject, onMounted, onBeforeUnmount, onUpdated, nextTick } from '../vendor/vue.esm-browser.prod.js';
import { PATHS, toast } from './ui.js';
import { loadScript, loadStyle, onThemeChange } from './ext-loader.js';

Object.assign(PATHS, {keplay: 'M8 5l11 7-11 7z', kepause: 'M8 5v14M16 5v14'});

// ---------- HTML sanitiser: allow-list, rebuilds a clean copy, never edits the input ----------
const TAGS = new Set('p br div span h1 h2 h3 h4 h5 h6 strong b em i u s strike del ins sub sup blockquote pre code ul ol li a img figure figcaption hr'.split(' '));
const DROP = new Set('script style template iframe frame frameset object embed applet svg math noscript noembed noframes textarea title select option input button link meta base video audio source track canvas xmp plaintext portal'.split(' '));   // removed with their content; every other unknown tag is unwrapped
const CLASS_OK = /^ql-(align-(center|right|justify)|indent-[1-8]|size-(small|large|huge)|font-(serif|monospace)|direction-rtl)$/;
const COLOR_OK = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9\s.,%/]+\)|[a-z]{3,20})$/i;
const LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

// '' unless the link is http, https, mailto, tel or relative (so no javascript:, data:, vbscript:; the URL parser ignores the same tabs and newlines the browser does)
export function safeUrl(url) {
    const s = String(url ?? '').trim(); if (!s) return '';
    try { return LINK_PROTOCOLS.includes(new URL(s, 'https://relative.invalid/').protocol) ? s : ''; } catch { return ''; }
}
// only inline raster images (no remote URL, which would leak the visitor's IP, and no SVG)
export const safeImageSrc = src => { const s = String(src ?? '').replace(/\s+/g, ''); return /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/]+={0,2}$/i.test(s) ? s : ''; };
export function safeStyle(style) {
    return String(style ?? '').split(';').map(rule => {
        const at = rule.indexOf(':'); if (at < 0) return '';
        const k = rule.slice(0, at).trim().toLowerCase(), v = rule.slice(at + 1).trim();
        const ok = (k === 'color' || k === 'background-color') ? COLOR_OK.test(v) : k === 'text-align' && /^(left|right|center|justify)$/i.test(v);
        return ok ? k + ': ' + v : '';
    }).filter(Boolean).join('; ');
}

function copyClean(from, to, doc, images, depth) {
    for (const node of from.childNodes) {
        if (node.nodeType === 3) { to.appendChild(doc.createTextNode(node.data)); continue; }
        if (node.nodeType !== 1) continue;   // comments and the rest are dropped
        const tag = node.localName;
        if (node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || DROP.has(tag)) continue;
        if (depth > 60) { to.appendChild(doc.createTextNode(node.textContent)); continue; }
        const href = tag === 'a' ? safeUrl(node.getAttribute('href')) : '';
        if (!TAGS.has(tag) || (tag === 'a' && !href)) { copyClean(node, to, doc, images, depth + 1); continue; }
        const src = tag === 'img' && images ? safeImageSrc(node.getAttribute('src')) : '';
        if (tag === 'img' && !src) continue;
        const el = doc.createElement(tag);
        if (href) { el.setAttribute('href', href); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer nofollow'); }
        if (src) { el.setAttribute('src', src); el.setAttribute('alt', node.getAttribute('alt') || ''); for (const a of ['width', 'height']) if (/^\d{1,4}$/.test(node.getAttribute(a) || '')) el.setAttribute(a, node.getAttribute(a)); }
        if (tag === 'ol' && /^\d{1,6}$/.test(node.getAttribute('start') || '')) el.setAttribute('start', node.getAttribute('start'));
        const cls = (node.getAttribute('class') || '').split(/\s+/).filter(c => CLASS_OK.test(c)); if (cls.length) el.setAttribute('class', cls.join(' '));
        const css = safeStyle(node.getAttribute('style')); if (css) el.setAttribute('style', css);
        copyClean(node, el, doc, images, depth + 1);
        to.appendChild(el);
    }
}
// DOMParser documents are inert: nothing runs and nothing is fetched while we read the input. Options: images (default true) keeps data: images.
export function sanitizeHtml(html, {images = true} = {}) {
    if (!html) return '';
    const source = new DOMParser().parseFromString(String(html), 'text/html'), doc = document.implementation.createHTMLDocument(''), out = doc.createElement('div');
    copyClean(source.body, out, doc, images, 0);
    return out.innerHTML;
}

// ---------- shared life cycle: load the library, build, destroy on unmount; a stale load is ignored ----------
function useExt(load, build, destroy) {
    const state = ref('loading'); let dead = false, run = 0;
    async function mount() {
        const my = ++run;
        try { const lib = await load(); if (dead || my !== run) return; build(lib); state.value = 'ready'; }
        catch (e) { console.error(e); if (!dead && my === run) state.value = 'error'; }
    }
    onMounted(mount);
    onBeforeUnmount(() => { dead = true; destroy(); });
    return {state, mount, remount: () => { destroy(); return mount(); }};
}
// wiring to a surrounding FormField (kit-forms): ids, aria state, and a click on the label focuses the control
function useField(focus) {
    const fc = inject('kfield', {}); let label;
    onMounted(() => { label = fc.labelId && document.getElementById(fc.labelId); label?.addEventListener('click', focus); });
    onBeforeUnmount(() => label?.removeEventListener('click', focus));
    return fc;
}
const setAttrs = (el, attrs) => Object.entries(attrs).forEach(([k, v]) => v == null || v === false || v === '' ? el.removeAttribute(k) : el.setAttribute(k, v === true ? 'true' : v));

// ---------- Quill ----------
const LISTS = [{list: 'ordered'}, {list: 'bullet'}];
export const QUILL_TOOLBARS = {
    minimal: [['bold', 'italic', 'underline'], ['link'], ['clean']],
    standard: [[{header: [2, 3, false]}], ['bold', 'italic', 'underline', 'strike'], LISTS, ['blockquote', 'link'], ['clean']],
    full: [[{header: [1, 2, 3, false]}, {size: ['small', false, 'large', 'huge']}], ['bold', 'italic', 'underline', 'strike'], [{color: []}, {background: []}], [{script: 'sub'}, {script: 'super'}],
        [...LISTS, {indent: '-1'}, {indent: '+1'}, {align: []}], ['blockquote', 'code-block', 'link'], ['clean']],
};
const MINIMAL_FORMATS = ['bold', 'italic', 'underline', 'link'], STANDARD_FORMATS = [...MINIMAL_FORMATS, 'header', 'strike', 'list', 'blockquote'];
const FULL_FORMATS = [...STANDARD_FORMATS, 'size', 'color', 'background', 'script', 'indent', 'align', 'code-block'];
const QUILL_FORMATS = {minimal: MINIMAL_FORMATS, standard: STANDARD_FORMATS, full: FULL_FORMATS};   // video and formula are never enabled (see the Quill 2.0.3 HTML export advisory)
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const kb = n => n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const dataSize = url => Math.floor((url.length - url.indexOf(',') - 1) * 3 / 4);

// Quill's own markup (every list is an <ol>, code blocks are divs) turned into plain semantic HTML, then sanitised
function quillHtml(raw) {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    doc.querySelectorAll('.ql-ui').forEach(n => n.remove());
    doc.querySelectorAll('.ql-code-block-container').forEach(box => { const pre = doc.createElement('pre'); pre.textContent = [...box.children].map(l => l.textContent).join('\n'); box.replaceWith(pre); });
    doc.querySelectorAll('ol').forEach(ol => {
        const lists = []; let list, kind;
        [...ol.children].forEach(li => { const k = li.getAttribute('data-list') === 'bullet' ? 'ul' : 'ol'; if (k !== kind) { kind = k; list = doc.createElement(k); lists.push(list); } list.appendChild(li); });
        ol.replaceWith(...lists);
    });
    const texts = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (texts.nextNode()) { const t = texts.currentNode; if (!t.parentElement.closest('pre')) t.data = t.data.replace(/ {2}/g, ' \u00a0'); }
    return sanitizeHtml(doc.body.innerHTML);
}
// read the file in the browser; re-encoding through a canvas drops EXIF and location data (GIFs stay as they are, to keep the animation)
async function imageDataUrl(file) {
    if (file.type !== 'image/gif') {
        const bmp = await createImageBitmap(file), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); bmp.close?.();
        return c.toDataURL(file.type, .9);
    }
    return new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(file); });
}

export const ExtQuill = {
    props: {modelValue: {type: String, default: ''}, theme: {type: String, default: 'snow'}, toolbar: {type: [String, Array], default: 'standard'}, placeholder: String, readOnly: Boolean, disabled: Boolean,
        images: Boolean, maxImageSize: {type: Number, default: 512 * 1024}, label: String, minHeight: {type: Number, default: 140}},   // toolbar: minimal | standard | full | a Quill toolbar array
    emits: ['update:modelValue', 'length', 'reject', 'ready'],
    setup(p, {emit, expose}) {
        const host = ref(null); let q = null, Delta, last = null;
        const focus = () => q?.focus();
        const fc = useField(focus);
        const length = () => q.getText().replace(/\n$/, '').length;
        const output = () => !q.getText().trim() && !q.root.querySelector('img') ? '' : quillHtml(q.root.innerHTML);
        function load(html) {
            last = html;
            q.setContents(q.clipboard.convert({html: sanitizeHtml(html, {images: p.images}), text: ''}), 'silent');
            q.history.clear(); emit('length', length());
        }
        function state() {
            if (!q) return;
            q.enable(!(p.disabled || p.readOnly));
            setAttrs(q.root, {id: fc.id, role: 'textbox', 'aria-multiline': true, 'aria-labelledby': fc.labelId, 'aria-label': fc.labelId ? null : (p.label || p.placeholder || 'Rich text'), 'aria-describedby': fc.describedby,
                'aria-invalid': fc.invalid || null, 'aria-required': fc.required || null, 'aria-readonly': p.readOnly || null, 'aria-disabled': p.disabled || null, tabindex: p.disabled ? '-1' : '0', 'data-placeholder': p.placeholder});
            const bar = q.getModule('toolbar')?.container; if (bar) bar.inert = p.disabled || p.readOnly;
        }
        async function addImages(range, files) {
            let index = range.index;
            for (const file of files) {
                if (!p.images || p.disabled || p.readOnly) { emit('reject', 'Images are switched off in this editor'); return; }
                if (!IMAGE_TYPES.includes(file.type)) { emit('reject', file.name + ': use PNG, JPEG, GIF or WebP'); continue; }
                if (file.size > p.maxImageSize) { emit('reject', file.name + ' is larger than ' + kb(p.maxImageSize)); continue; }
                try {
                    const url = await imageDataUrl(file); if (!q) return;
                    if (dataSize(url) > p.maxImageSize) { emit('reject', file.name + ' is larger than ' + kb(p.maxImageSize) + ' once processed'); continue; }
                    q.insertEmbed(index, 'image', url, 'user'); q.setSelection(++index, 0, 'silent');
                } catch { emit('reject', file.name + ' could not be read'); }
            }
        }
        function toolbarFor() {
            const custom = Array.isArray(p.toolbar), groups = JSON.parse(JSON.stringify(custom ? p.toolbar : QUILL_TOOLBARS[p.toolbar] || QUILL_TOOLBARS.standard));
            const banned = ['video', 'formula', ...(p.images ? [] : ['image'])];
            const clean = groups.map(g => Array.isArray(g) ? g.filter(x => !banned.includes(x)) : g).filter(g => !Array.isArray(g) || g.length);
            if (p.images && !custom) clean.splice(clean.length - 1, 0, ['image']);
            return clean;
        }
        function build(Quill) {
            const node = document.createElement('div'); host.value.appendChild(node);
            Delta = Quill.import('delta');
            const base = Array.isArray(p.toolbar) ? FULL_FORMATS : QUILL_FORMATS[p.toolbar] || STANDARD_FORMATS;
            q = new Quill(node, {theme: p.theme === 'bubble' ? 'bubble' : 'snow', bounds: host.value, placeholder: p.placeholder || '', formats: p.images ? [...base, 'image'] : [...base],
                modules: {toolbar: toolbarFor(), uploader: {mimetypes: IMAGE_TYPES.slice(), handler: addImages},
                    keyboard: {bindings: {tab: {key: 'Tab', handler: () => true}}}}});   // Tab leaves the editor (it still indents inside lists and code)
            q.clipboard.addMatcher('IMG', (el, delta) => { const src = safeImageSrc(el.getAttribute('src')); return p.images && src && dataSize(src) <= p.maxImageSize ? delta : new Delta(); });
            load(p.modelValue || ''); state();
            q.on('text-change', () => { const html = output(); emit('length', length()); if (html !== last) { last = html; emit('update:modelValue', html); } });
            emit('ready', q);
        }
        function destroy() { if (q) { q.off('text-change'); q = null; } if (host.value) host.value.textContent = ''; }
        const ext = useExt(async () => {
            const css = loadStyle(p.theme === 'bubble' ? 'quill/quill.bubble.css' : 'quill/quill.snow.css');
            const [Quill] = await Promise.all([loadScript('quill/quill.js', {global: 'Quill'}), css]); return Quill;
        }, build, destroy);
        watch(() => p.modelValue, v => { if (q && (v || '') !== last) load(v || ''); });
        watch(() => [p.theme, JSON.stringify(p.toolbar), p.images].join('|'), () => { last = null; ext.remount(); });
        watch(() => [p.readOnly, p.disabled, p.placeholder, p.label, fc.invalid, fc.describedby, fc.required], state);
        expose({focus, editor: () => q});
        return {host, state: ext.state};
    },
    template: `<div class="k-rte k-quill" :class="['k-quill--' + (theme === 'bubble' ? 'bubble' : 'snow'), {ro: readOnly, dis: disabled}]" :style="{'--k-min': minHeight + 'px'}"><div ref="host" class="k-rte__host"></div>
        <p v-if="state !== 'ready'" class="k-ext-state" :class="state" role="status">{{ state === 'error' ? 'The editor could not be loaded.' : 'Loading editor…' }}</p></div>`,
};

// ---------- Trix (text only: file attachments are rejected) ----------
// Trix acts on mousedown and takes its buttons out of the tab order: add one tab stop, arrow keys, Enter and Space
function trixToolbarKeys(bar) {
    const buttons = () => [...bar.querySelectorAll('.trix-button-row .trix-button')];
    setAttrs(bar, {role: 'toolbar', 'aria-label': 'Formatting'});
    buttons().forEach((b, i) => { b.tabIndex = i ? -1 : 0; b.setAttribute('aria-label', b.title || b.textContent.trim()); });
    bar.addEventListener('keydown', e => {
        const list = buttons().filter(b => !b.disabled), at = list.indexOf(e.target); if (at < 0) return;
        const to = {ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: list.length - 1}[e.key];
        if (to !== undefined) { e.preventDefault(); const next = list[(to + list.length) % list.length]; buttons().forEach(b => { b.tabIndex = b === next ? 0 : -1; }); next.focus(); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true})); }
    });
}
export const ExtTrix = {
    props: {modelValue: {type: String, default: ''}, placeholder: String, disabled: Boolean, label: String, minHeight: {type: Number, default: 140}},
    emits: ['update:modelValue', 'length', 'reject', 'ready'],
    setup(p, {emit, expose}) {
        const host = ref(null); let el = null, last = null, shown = null, loading = false, ready = false;
        const focus = () => el?.focus();
        const fc = useField(focus);
        const clean = html => sanitizeHtml(html, {images: false});
        const length = () => el.editor.getDocument().toString().replace(/\n$/, '').length;
        function load(html) { last = html; loading = true; el.editor.loadHTML(clean(html)); shown = clean(el.value); loading = false; emit('length', length()); }
        function state() {
            if (!el) return;
            setAttrs(el, {id: fc.id, placeholder: p.placeholder, 'aria-labelledby': fc.labelId, 'aria-label': fc.labelId ? null : (p.label || p.placeholder || 'Rich text'), 'aria-describedby': fc.describedby,
                'aria-invalid': fc.invalid || null, 'aria-required': fc.required || null, 'aria-multiline': true, 'aria-disabled': p.disabled || null});
            el.setAttribute('contenteditable', p.disabled ? 'false' : 'true'); el.tabIndex = p.disabled ? -1 : 0;
            if (ready && el.toolbarElement) el.toolbarElement.inert = p.disabled;
        }
        const on = {
            'trix-initialize': () => {
                if (!el || ready) return; ready = true;
                const bar = el.toolbarElement; if (bar) { bar.querySelector('[data-trix-button-group="file-tools"]')?.remove(); trixToolbarKeys(bar); }
                load(p.modelValue || ''); state(); emit('ready', el.editor);
            },
            'trix-change': () => { if (!ready || loading) return; const html = clean(el.value); emit('length', length()); if (html !== shown) { shown = last = html; emit('update:modelValue', html); } },   // Trix rewrites the HTML on load: that alone is not a change
            'trix-file-accept': e => { e.preventDefault(); emit('reject', 'Attachments are switched off in this editor'); },
            'trix-attachment-add': e => { const a = e.attachment; queueMicrotask(() => a.remove()); },   // pasted images (they could point to other servers)
        };
        function build() {
            el = document.createElement('trix-editor'); el.className = 'k-prose';
            Object.entries(on).forEach(([name, fn]) => el.addEventListener(name, fn));
            el.setAttribute('placeholder', p.placeholder || ''); host.value.appendChild(el);   // Trix adds its toolbar and a hidden input next to the element
            state();
        }
        function destroy() { if (el) Object.entries(on).forEach(([name, fn]) => el.removeEventListener(name, fn)); el = null; ready = false; if (host.value) host.value.textContent = ''; }
        const ext = useExt(async () => {
            await Promise.all([loadScript('trix/trix.umd.min.js', {global: 'Trix'}), loadStyle('trix/trix.css')]);
            await customElements.whenDefined('trix-editor');
        }, build, destroy);
        watch(() => p.modelValue, v => { if (ready && (v || '') !== last) load(v || ''); });
        watch(() => [p.disabled, p.placeholder, p.label, fc.invalid, fc.describedby, fc.required], state);
        expose({focus, editor: () => el?.editor});
        return {host, state: ext.state};
    },
    template: `<div class="k-rte k-trix" :class="{dis: disabled}" :style="{'--k-min': minHeight + 'px'}"><div ref="host" class="k-rte__host"></div>
        <p v-if="state !== 'ready'" class="k-ext-state" :class="state" role="status">{{ state === 'error' ? 'The editor could not be loaded.' : 'Loading editor…' }}</p></div>`,
};

// sanitised read-only rendering of stored HTML
export const ExtHtml = {
    props: {html: String, empty: {type: String, default: 'Nothing to preview'}, images: {type: Boolean, default: true}},
    setup: p => ({clean: computed(() => sanitizeHtml(p.html, {images: p.images}))}),
    template: `<div v-if="clean" class="k-prose" v-html="clean"></div><div v-else class="k-prose k-prose--none">{{ empty }}</div>`,
};

// ---------- Swiper ----------
const gradient = i => { const h = [222, 262, 168, 330, 14, 196, 290, 140][i % 8]; return `radial-gradient(70% 80% at 85% 10%, hsl(${h + 40} 70% 45% / .75), transparent 70%), linear-gradient(140deg, hsl(${h} 62% 32%), hsl(${h + 30} 60% 17%))`; };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// one slide for the default slot of ExtSwiper
export const ExtSlide = {template: `<div class="swiper-slide k-swiper__slide"><slot/></div>`};

export const ExtSwiper = {
    props: {slides: Array, modelValue: Number, effect: {type: String, default: 'slide'}, pagination: {type: [Boolean, String], default: true}, navigation: {type: Boolean, default: true}, autoplay: [Boolean, Number], loop: Boolean,
        slidesPerView: {type: [Number, String], default: 1}, spaceBetween: {type: Number, default: 12}, breakpoints: Object, breakpointsBase: {type: String, default: 'container'}, centered: Boolean, thumbs: Boolean,
        height: {type: [Number, String], default: 200}, label: String, options: Object},
    // slides: [{key?, title, text, value, badge, bg}] or the default slot with <ExtSlide>. effect: slide | fade | cards | coverflow. pagination: true | 'fraction' | 'progressbar' | false. autoplay: true or delay in ms. options: extra Swiper parameters
    emits: ['update:modelValue', 'change', 'slide-click', 'ready'],
    setup(p, {emit, expose}) {
        const root = ref(null), gen = ref(0), active = ref(p.modelValue || 0), playing = ref(false);
        let sw = null, strip = null, built = 0, stopTheme;
        const wrapper = () => root.value?.querySelector(':scope > .k-swiper__stage > .swiper > .swiper-wrapper');
        const count = () => wrapper() ? [...wrapper().children].filter(c => c.classList.contains('swiper-slide') && !c.classList.contains('swiper-slide-blank')).length : 0;
        const go = i => { if (sw) sw.params.loop ? sw.slideToLoop(i) : sw.slideTo(i); };
        function build(Swiper) {
            destroy();
            const q = s => root.value.querySelector(':scope > ' + s), single = p.effect === 'fade' || p.effect === 'cards', flow = p.effect === 'coverflow', calm = reducedMotion();
            built = count();
            const per = single ? 1 : flow && p.slidesPerView === 1 ? 'auto' : p.slidesPerView;
            const widest = Math.max(1, ...[per, ...Object.values(single ? {} : p.breakpoints || {}).map(b => b.slidesPerView)].map(Number).filter(Boolean));
            const loop = p.loop && built >= (p.effect === 'cards' ? 7 : flow ? 5 : widest * 2);   // Swiper cannot loop too few slides: rewind instead
            const opts = {effect: p.effect, slidesPerView: per, spaceBetween: p.spaceBetween, centeredSlides: p.centered || flow, loop, rewind: !loop && !!(p.loop || p.autoplay), speed: calm ? 0 : 450, grabCursor: true, watchOverflow: true,
                breakpointsBase: p.breakpointsBase, initialSlide: Math.min(active.value, Math.max(0, built - 1)), a11y: {enabled: true},
                on: {slideChange: s => { if (active.value === s.realIndex) return; active.value = s.realIndex; strip?.slideTo(s.realIndex); emit('update:modelValue', s.realIndex); emit('change', s.realIndex); },
                    autoplayStart: () => { playing.value = true; }, autoplayStop: () => { playing.value = false; }}};
            if (p.breakpoints && !single) opts.breakpoints = JSON.parse(JSON.stringify(p.breakpoints));
            if (p.effect === 'fade') opts.fadeEffect = {crossFade: true};
            if (p.effect === 'cards') opts.cardsEffect = {slideShadows: true};
            if (flow) opts.coverflowEffect = {rotate: 28, stretch: 0, depth: 120, modifier: 1, slideShadows: false};
            if (p.navigation) opts.navigation = {prevEl: q('.k-swiper__bar > .swiper-button-prev'), nextEl: q('.k-swiper__bar > .swiper-button-next')};
            if (p.pagination) opts.pagination = {el: q('.k-swiper__bar > .swiper-pagination'), type: typeof p.pagination === 'string' && p.pagination ? p.pagination : 'bullets', clickable: true};
            if (p.autoplay) { opts.autoplay = {delay: typeof p.autoplay === 'number' ? p.autoplay : 4000, disableOnInteraction: false, pauseOnMouseEnter: true}; playing.value = true; }
            if (p.thumbs && q('.k-swiper__thumbs')) {
                strip = new Swiper(q('.k-swiper__thumbs'), {slidesPerView: 4, spaceBetween: 8, watchSlidesProgress: true, breakpointsBase: 'container', breakpoints: {420: {slidesPerView: 5}, 640: {slidesPerView: 6}}});
                opts.thumbs = {swiper: strip};
            }
            sw = new Swiper(q('.k-swiper__stage > .swiper'), {...opts, ...p.options});
            if (p.autoplay && calm) sw.autoplay.stop();   // no automatic motion when the user asked for less of it
            emit('ready', sw);
        }
        function destroy() { sw?.destroy(true, true); strip?.destroy(true, true); sw = strip = null; playing.value = false; }
        const load = async () => (await Promise.all([loadScript('swiper/swiper-bundle.min.js', {global: 'Swiper'}), loadStyle('swiper/swiper-bundle.min.css')]))[0];
        const ext = useExt(load, build, destroy);
        async function rebuild() { destroy(); gen.value++; await nextTick(); ext.mount(); }   // fresh DOM: loop mode reorders the slide elements
        watch(() => JSON.stringify([p.effect, p.pagination, p.navigation, p.autoplay, p.loop, p.slidesPerView, p.spaceBetween, p.breakpoints, p.breakpointsBase, p.centered, p.thumbs, p.options, p.slides?.map((s, i) => s.key ?? i)]), rebuild);
        watch(() => p.modelValue, i => { if (i != null && sw && i !== sw.realIndex) go(i); });
        onUpdated(() => { if (!p.slides && sw && count() !== built) rebuild(); });
        onMounted(() => { stopTheme = onThemeChange(() => sw?.update()); });
        onBeforeUnmount(() => stopTheme?.());
        function key(e) {
            if (!sw || e.target.closest('input, textarea, select, [contenteditable], [role=slider]') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
            e.preventDefault(); e.stopPropagation(); e.key === 'ArrowLeft' ? sw.slidePrev() : sw.slideNext();
        }
        const toggle = () => { if (sw?.autoplay) sw.autoplay.running ? sw.autoplay.stop() : sw.autoplay.start(); };
        expose({go, swiper: () => sw});
        return {root, gen, active, playing, state: ext.state, go, key, toggle, gradient, size: computed(() => typeof p.height === 'number' ? p.height + 'px' : p.height)};
    },
    template: `<div class="k-swiper" :class="'k-swiper--' + effect" :style="{'--k-sh': size}" role="region" aria-roledescription="carousel" :aria-label="label || 'Slides'" @keydown="key">
        <div ref="root" :key="gen" class="k-swiper__in">
          <div class="k-swiper__stage"><div class="swiper" tabindex="0"><div class="swiper-wrapper">
            <template v-if="slides"><div v-for="(s, i) in slides" :key="s.key ?? i" class="swiper-slide k-swiper__slide" @click="$emit('slide-click', s, i)"><slot name="slide" :slide="s" :index="i" :active="i === active">
              <div class="k-slide" :style="{background: s.bg || gradient(i)}"><span v-if="s.badge" class="k-slide__badge">{{ s.badge }}</span><strong v-if="s.value">{{ s.value }}</strong><b v-if="s.title">{{ s.title }}</b><span v-if="s.text">{{ s.text }}</span></div></slot></div></template>
            <slot v-else/></div></div></div>
          <div v-if="pagination || autoplay || navigation" class="k-swiper__bar"><button v-if="autoplay" type="button" class="k-swiper__play" :aria-label="playing ? 'Pause slideshow' : 'Play slideshow'" @click="toggle"><Ico :n="playing ? 'kepause' : 'keplay'" :s="16"/></button>
            <button v-if="navigation" type="button" class="swiper-button-prev" aria-label="Previous slide"></button><div v-if="pagination" class="swiper-pagination"></div><button v-if="navigation" type="button" class="swiper-button-next" aria-label="Next slide"></button></div>
          <div v-if="thumbs && slides" class="swiper k-swiper__thumbs"><div class="swiper-wrapper"><div v-for="(s, i) in slides" :key="s.key ?? i" class="swiper-slide" role="button" tabindex="0" :aria-label="'Show ' + (s.title || 'slide ' + (i + 1))" :aria-current="i === active || null" @keydown.enter.prevent="go(i)" @keydown.space.prevent="go(i)">
            <slot name="thumb" :slide="s" :index="i"><span class="k-swiper__th" :style="{background: s.bg || gradient(i)}"><span>{{ s.title || i + 1 }}</span></span></slot></div></div></div>
        </div>
        <p v-if="state === 'error'" class="k-ext-state error" role="status">The slider could not be loaded.</p></div>`,
};

// ---------- noUiSlider ----------
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const decimalsOf = n => (String(n).split('.')[1] || '').length;

export const ExtRange = {
    props: {modelValue: {type: [Number, Array], default: 0}, min: {type: Number, default: 0}, max: {type: Number, default: 100}, step: {type: Number, default: 1}, steps: Array, range: Object, connect: {type: [Boolean, String, Array], default: undefined},
        tooltips: Boolean, pips: [Boolean, Number, Object], vertical: Boolean, height: {type: [Number, String], default: 200}, margin: Number, limit: Number, disabled: Boolean, format: Function, unit: {type: String, default: ''}, decimals: Number, label: String, labels: Array},
    // v-model: a number (one handle) or an array (two = range, more = multi). steps: the only allowed values. range: noUiSlider range map for non-linear scales. pips: true | count | noUiSlider pips object
    emits: ['update:modelValue', 'change'],
    setup(p, {emit, expose}) {
        const host = ref(null); let slider = null, target = null, api = null;
        const handles = () => target ? [...target.querySelectorAll('.noUi-handle')] : [];
        const focus = () => handles()[0]?.focus();
        const fc = useField(focus);
        const values = () => [].concat(p.modelValue).map(v => Number.isFinite(+v) ? +v : p.min);
        const precision = () => p.decimals ?? Math.max(0, ...[p.step, p.min, p.max, ...(p.steps || [])].map(decimalsOf));
        const round = v => +(+v).toFixed(precision());
        const text = v => p.format ? String(p.format(round(v))) : round(v) + p.unit;
        const out = raw => Array.isArray(p.modelValue) ? raw.map(round) : round(raw[0]);
        function rangeMap() {
            const s = p.steps; if (!s || s.length < 2) return p.range ? JSON.parse(JSON.stringify(p.range)) : {min: p.min, max: p.max};
            return Object.fromEntries(s.map((v, i) => [i === 0 ? 'min' : i === s.length - 1 ? 'max' : (i / (s.length - 1) * 100) + '%', v]));
        }
        function pipsFor() {
            if (!p.pips) return null;
            const format = {to: v => escapeHtml(p.format ? text(v) : round(v)), from: Number};   // noUiSlider writes labels as HTML
            if (typeof p.pips === 'object') return {format, ...p.pips};
            if (typeof p.pips === 'number') return {mode: 'count', values: p.pips, density: 4, format};
            return p.steps ? {mode: 'values', values: p.steps, density: 100, format} : {mode: 'positions', values: [0, 25, 50, 75, 100], density: 5, format};
        }
        function state() {
            if (!target) return;
            target.toggleAttribute('disabled', p.disabled);
            const n = handles().length, names = n === 1 ? [''] : n === 2 ? ['minimum', 'maximum'] : Array.from({length: n}, (_, i) => 'handle ' + (i + 1) + ' of ' + n);
            handles().forEach((h, i) => setAttrs(h, {'aria-label': p.labels?.[i] || (fc.labelId && n === 1 ? null : [p.label || 'Value', names[i]].filter(Boolean).join(', ')), 'aria-labelledby': !p.labels && fc.labelId && n === 1 ? fc.labelId : null,
                'aria-describedby': fc.describedby, 'aria-invalid': fc.invalid || null, 'aria-disabled': p.disabled || null, tabindex: p.disabled ? '-1' : '0', id: i === 0 ? fc.id : null}));
        }
        function build(noUiSlider) {
            api = noUiSlider;
            const start = values(), n = start.length;
            target = document.createElement('div'); if (p.vertical) target.style.height = typeof p.height === 'number' ? p.height + 'px' : p.height;
            host.value.appendChild(target);
            const options = {start, range: rangeMap(), orientation: p.vertical ? 'vertical' : 'horizontal', direction: p.vertical ? 'rtl' : 'ltr', behaviour: 'tap', ariaFormat: {to: text},
                connect: p.connect ?? (n === 1 ? 'lower' : n === 2 ? true : [...Array(n).fill(true), false]), tooltips: p.tooltips ? Array.from({length: n}, () => ({to: v => escapeHtml(text(v))})) : false};
            if (p.steps?.length > 1) options.snap = true; else if (!p.range && p.step > 0) options.step = p.step;
            if (n > 1 && p.margin != null) options.margin = p.margin;
            if (n > 1 && p.limit != null) options.limit = p.limit;
            const pips = pipsFor(); if (pips) options.pips = pips;
            slider = api.create(target, options);
            slider.on('slide', (_, __, raw) => emit('update:modelValue', out(raw)));
            slider.on('change', (_, __, raw) => emit('change', out(raw)));
            state();
        }
        function destroy() { slider?.destroy(); slider = target = null; if (host.value) host.value.textContent = ''; }
        const ext = useExt(async () => (await Promise.all([loadScript('nouislider/nouislider.min.js', {global: 'noUiSlider'}), loadStyle('nouislider/nouislider.min.css')]))[0], build, destroy);
        watch(() => JSON.stringify([p.min, p.max, p.step, p.steps, p.range, p.connect, p.tooltips, p.pips, p.vertical, p.height, p.margin, p.limit, p.unit, p.decimals, [].concat(p.modelValue).length]), () => { if (api) ext.remount(); });
        watch(() => JSON.stringify(p.modelValue), () => {
            if (!slider) return; const now = [].concat(slider.get(true)), next = values();
            if (now.length === next.length && next.some((v, i) => round(v) !== round(now[i]))) slider.set(next, false);
        });
        watch(() => [p.disabled, p.label, fc.invalid, fc.describedby], state);
        expose({focus, slider: () => slider});
        return {fc, host, state: ext.state, count: computed(() => [].concat(p.modelValue).length)};
    },
    template: `<div class="k-range" :class="{vertical, dis: disabled, tips: tooltips, pips: !!pips, multi: count > 2}" role="group" :aria-labelledby="fc.labelId" :aria-label="fc.labelId ? null : (label || 'Slider')"><div ref="host" class="k-range__host"></div>
        <p v-if="state === 'error'" class="k-ext-state error" role="status">The slider could not be loaded.</p></div>`,
};

export const KIT_EDITORS = {ExtQuill, ExtTrix, ExtHtml, ExtSwiper, ExtSlide, ExtRange};

// ---------- showcase: editors ----------
const OFFER = '<h2>Offer for Northwind</h2><p>Thank you for the call. We propose a <strong>12 month</strong> licence for <em>38 stores</em>.</p><ul><li>Onboarding in two weeks</li><li>Support on working days</li></ul><blockquote>Prices are valid for 30 days.</blockquote>';
const NOTE = '<p>Call summary: the buyer wants <strong>volume pricing</strong>. Send the revised quote before Friday.</p><ol><li>Check stock</li><li>Confirm delivery dates</li></ol>';
const ATTACK = '<p onclick="alert(1)">Hello <a href="javascript:alert(2)">bad link</a> and <a href="https://example.com">good link</a></p>\n<img src="x" onerror="alert(3)"><script>alert(4)</' + 'script>\n<iframe src="https://example.com"></iframe><svg onload="alert(5)"></svg>\n<p style="color: red; background: url(https://example.com/pixel)">Styled</p>';

export const DemoEditors = {
    components: KIT_EDITORS,
    setup() {
        const v = reactive({snow: OFFER, full: '<h3>Release notes</h3><p>Select text to try <span style="color: #f59e0b">colour</span>, alignment and code.</p><pre>php yii invoice/send 1042</pre>', bubble: NOTE, trix: NOTE, attack: ATTACK});
        const len = reactive({snow: 0, full: 0, bubble: 0, trix: 0, play: 0});
        const play = reactive({theme: 'snow', toolbar: 'standard', readOnly: false, disabled: false, images: true, value: OFFER});
        const cards = [
            {k: 'snow', t: 'Quill, snow', s: 'Standard toolbar, no images'}, {k: 'full', t: 'Quill, full', s: 'Every format, images up to 200 KB kept in the value'},
            {k: 'bubble', t: 'Quill, bubble', s: 'Select text to see the toolbar'}, {k: 'trix', t: 'Trix', s: 'Clean block model, attachments off'},
        ];
        return {v, len, play, cards, reject: m => toast(m, 'err'), clean: computed(() => sanitizeHtml(v.attack))};
    },
    template: `<div class="page k-edemo">
        <Holder title="Rich text editors" sub="Same sales texts in four editors, with the sanitised preview and the raw v-model value">
          <div class="k-edemo__grid">
            <Card v-for="c in cards" :key="c.k"><div class="k-edemo__h"><div><h4>{{ c.t }}</h4><small>{{ c.s }}</small></div><Badge>{{ len[c.k] }} characters</Badge></div>
              <ExtTrix v-if="c.k === 'trix'" v-model="v.trix" label="Trix editor" placeholder="Write the call summary" @length="len.trix = $event" @reject="reject"/>
              <ExtQuill v-else v-model="v[c.k]" :label="c.t" :theme="c.k === 'bubble' ? 'bubble' : 'snow'" :toolbar="c.k === 'full' ? 'full' : c.k === 'bubble' ? 'minimal' : 'standard'" :images="c.k === 'full'" :max-image-size="204800" placeholder="Write the offer" @length="len[c.k] = $event" @reject="reject"/>
              <small class="k-edemo__l">Sanitised preview</small><ExtHtml :html="v[c.k]"/>
              <small class="k-edemo__l">Raw value</small><pre class="k-edemo__raw" tabindex="0">{{ v[c.k] || '(empty)' }}</pre></Card>
          </div></Holder>
        <Holder title="Playground" sub="Theme, toolbar preset, read-only, disabled and local images">
          <div class="k-edemo__ctl"><Segmented v-model="play.theme" :options="['snow', 'bubble']"/><Segmented v-model="play.toolbar" :options="['minimal', 'standard', 'full']"/>
            <Toggle v-model="play.readOnly" label="Read-only"/><Toggle v-model="play.disabled" label="Disabled"/><Toggle v-model="play.images" label="Images"/></div>
          <ExtQuill v-model="play.value" :theme="play.theme" :toolbar="play.toolbar" :read-only="play.readOnly" :disabled="play.disabled" :images="play.images" placeholder="Start typing" label="Playground editor" @length="len.play = $event" @reject="reject"/>
          <Badge>{{ len.play }} characters</Badge></Holder>
        <Holder title="Sanitiser" sub="Allow-list: scripts, event handlers, javascript: links, iframes, SVG and remote images are removed. The server must sanitise again.">
          <div class="k-edemo__grid"><Card><Field v-model="v.attack" label="Untrusted HTML" :rows="9"/></Card>
            <Card><small class="k-edemo__l">After sanitizeHtml()</small><pre class="k-edemo__raw" tabindex="0">{{ clean || '(empty)' }}</pre><small class="k-edemo__l">Rendered</small><ExtHtml :html="v.attack"/></Card></div></Holder></div>`,
};

// ---------- showcase: sliders ----------
const DEALS = [
    {key: 'n', badge: 'Proposal', value: '€114,000', title: 'Northwind', text: 'Cloud network licence, closes 12 Dec'}, {key: 'f', badge: 'Qualified', value: '€37,000', title: 'Fabrikam', text: 'Supplier portal, demo booked'},
    {key: 'c', badge: 'Lead', value: '€31,000', title: 'Contoso', text: 'Warehouse scanners'}, {key: 'g', badge: 'Negotiation', value: '€61,000', title: 'Globex', text: 'Lead data sync, legal review'},
    {key: 'i', badge: 'Lead', value: '€15,200', title: 'Initech', text: 'Design system audit'}, {key: 'u', badge: 'Qualified', value: '€20,000', title: 'Umbrella', text: 'Loyalty programme'},
    {key: 'h', badge: 'Proposal', value: '€42,000', title: 'Hooli', text: 'Retail analytics'}, {key: 's', badge: 'Won', value: '€48,000', title: 'Soylent', text: 'Annual platform licence'},
];
const QUARTERS = [{badge: 'Q1', value: '+18%', title: 'Recurring revenue', text: 'Growth over last year'}, {badge: 'Q2', value: '42', title: 'New customers', text: 'Most from partner referrals'}, {badge: 'Q3', value: '96%', title: 'Renewal rate', text: 'Best quarter so far'}];
const QUOTES = ['“Quotes that took a day now take ten minutes.” Sales lead, retail', '“We finally see the whole pipeline.” Director, logistics', '“Onboarding was done in a week.” Operations, wholesale', '“Support answers with facts.” IT manager, services',
    '“Our stores order without calling us.” Owner, distribution', '“Reports match the invoices.” Controller, manufacturing', '“The team actually uses it.” Manager, hospitality'].map((q, i) => ({key: i, title: q.split('” ')[1], text: q.split('” ')[0] + '”', badge: 'Review'}));
const PLANS = [['Starter', '€9', 'Up to 3 seats'], ['Team', '€19', 'Pipeline and quotes'], ['Business', '€29', 'Approvals and roles'], ['Scale', '€49', 'API and exports'], ['Enterprise', 'Custom', 'Dedicated setup']].map(([title, value, text]) => ({title, value, text, badge: 'Per seat'}));
const ROOMS = ['Showroom', 'Warehouse', 'Meeting room', 'Loading dock', 'Front desk', 'Workshop', 'Archive'].map((title, i) => ({title, text: 'Site photo ' + (i + 1) + ' of 7', badge: 'Zagreb branch'}));
const TEAM = [['Ana Kovač', 'Sales, 12 open deals'], ['Marko Petrović', 'Sales, 9 open deals'], ['Lea Novak', 'Key accounts'], ['Emir Hadžić', 'Support'], ['Mia Berger', 'Partners']];

export const DemoSliders = {
    components: KIT_EDITORS,
    setup() {
        const r = reactive({discount: 15, price: [2000, 7500], stages: [20, 45, 70, 90], seats: 25, budget: 25000, rating: 3.5, term: [6, 24], vol: [70, 45, 85], locked: [30, 60]});
        const state = reactive({at: 0});
        return {r, state, DEALS, QUARTERS, QUOTES, PLANS, ROOMS, TEAM,
            eur: v => '€' + v.toLocaleString('en'), budgetRange: {min: [0, 500], '30%': [5000, 1000], '70%': [25000, 5000], max: 100000}, json: v => JSON.stringify(v)};
    },
    template: `<div class="page k-edemo">
        <Holder title="Sliders" sub="Swiper: swipe, arrow keys, buttons and pagination">
          <div class="k-edemo__grid">
            <Card class="k-edemo__wide"><h4>Slide, loop, slides per view by width</h4><ExtSwiper v-model="state.at" :slides="DEALS" loop :slides-per-view="1.15" :breakpoints="{420: {slidesPerView: 2}, 720: {slidesPerView: 3}}" :height="170" label="Open deals"/><code class="k-edemo__live">active: {{ state.at }}</code></Card>
            <Card><h4>Fade, autoplay, progress bar</h4><ExtSwiper :slides="QUARTERS" effect="fade" :autoplay="3500" loop pagination="progressbar" label="Quarter highlights"/></Card>
            <Card><h4>Cards</h4><ExtSwiper :slides="QUOTES" effect="cards" :navigation="false" pagination="fraction" :height="260" label="Customer reviews"/></Card>
            <Card class="k-edemo__wide"><h4>Coverflow</h4><ExtSwiper :slides="PLANS" effect="coverflow" :model-value="2" :height="180" label="Plans"/></Card>
            <Card class="k-edemo__wide"><h4>Gallery with thumbnails</h4><ExtSwiper :slides="ROOMS" thumbs loop :pagination="false" :height="240" label="Branch gallery"/></Card>
            <Card class="k-edemo__wide"><h4>Slot content</h4><ExtSwiper :slides-per-view="1.3" :breakpoints="{480: {slidesPerView: 2.3}, 800: {slidesPerView: 3.3}}" :pagination="false" :height="96" label="Team">
              <ExtSlide v-for="m in TEAM" :key="m[0]"><div class="k-edemo__who"><Avatar :name="m[0]" :size="42"/><div><b>{{ m[0] }}</b><small>{{ m[1] }}</small></div></div></ExtSlide></ExtSwiper></Card>
          </div></Holder>
        <Holder title="Range sliders" sub="noUiSlider: drag, tap the track or use the arrow keys">
          <div class="k-edemo__grid">
            <Card><h4>Single, tooltip</h4><ExtRange v-model="r.discount" :max="40" unit="%" tooltips label="Discount"/><code class="k-edemo__live">{{ r.discount }}</code></Card>
            <Card><h4>Range with gap</h4><ExtRange v-model="r.price" :max="10000" :step="100" :margin="500" tooltips :format="eur" label="Deal size"/><code class="k-edemo__live">{{ json(r.price) }}</code></Card>
            <Card><h4>Multi handle, pips</h4><ExtRange v-model="r.stages" pips unit="%" :margin="5" label="Stage probability" :labels="['Qualified from', 'Proposal from', 'Negotiation from', 'Commit from']"/><code class="k-edemo__live">{{ json(r.stages) }}</code></Card>
            <Card><h4>Fixed steps</h4><ExtRange v-model="r.seats" :steps="[1, 5, 10, 25, 50, 100]" pips tooltips label="Seats"/><code class="k-edemo__live">{{ r.seats }} seats</code></Card>
            <Card><h4>Non-linear scale</h4><ExtRange v-model="r.budget" :range="budgetRange" :format="eur" label="Yearly budget"/><code class="k-edemo__live">{{ eur(r.budget) }}</code></Card>
            <Card><h4>Half steps, count pips</h4><ExtRange v-model="r.rating" :max="5" :step="0.5" :pips="6" label="Supplier rating"/><code class="k-edemo__live">{{ r.rating }}</code></Card>
            <Card><h4>Contract term</h4><ExtRange v-model="r.term" :min="1" :max="36" :pips="{mode: 'values', values: [1, 12, 24, 36], density: 8}" tooltips unit=" mo" label="Months"/><code class="k-edemo__live">{{ json(r.term) }}</code></Card>
            <Card><h4>Vertical</h4><div class="k-edemo__vert"><div v-for="(n, i) in ['Web', 'Partners', 'Events']" :key="n"><ExtRange v-model="r.vol[i]" vertical tooltips unit="%" :height="180" :label="n + ' budget share'"/><small>{{ n }}</small></div></div><code class="k-edemo__live">{{ json(r.vol) }}</code></Card>
            <Card><h4>Disabled</h4><ExtRange v-model="r.locked" disabled tooltips label="Locked range"/><code class="k-edemo__live">{{ json(r.locked) }}</code></Card>
          </div></Holder></div>`,
};

export function registerKitEditors(app) {
    Object.entries({...KIT_EDITORS, DemoEditors, DemoSliders}).forEach(([k, c]) => app.component(k, c));
}
