// The "look" of the glass UI: seven sliders and five presets.
// Everything is a CSS variable on the app root; css/glass.css turns them into radius, shadows, sheen and blur.
//   veil   0-90  darkens or lightens the picture behind the glass
//   glass  4-70  opacity of the glass tint
//   blur   0-44  frost (backdrop blur, px)
//   depth  0-100 3D pop-out: size and strength of the drop shadow
//   soft   0-100 softness: corner radius and how diffuse the shadows are
//   shine  0-100 reflective sheen and bright top edge
//   refract 0-100 lens distortion of what is behind the glass (SVG displacement in backdrop-filter, Chromium only) plus a red/blue dispersion edge
// Hidden knobs set by a preset: hi (light shadow on the opposite side, the neumorphic look), inset (inner shading, "deep"), sat (backdrop saturation, %).
// Presets follow the usual definitions: Glassmorphism = frost + translucency + light edge; Liquid = frost + lensing; Deep = inner shadows and gradients for 3D depth;
// Reflective = clear glass with little frost, strong refraction and sheen; Neuromorphic = soft extruded surface with a light and a dark shadow.
// Refraction is applied to the functional layer only (dock, tab bars, sheets, toasts, floating controls), never to cards that hold text or data: it distorts the pixels near the edge.
// Cost: every glass layer is a GPU layer; keep at most 2 to 3 on a phone. On narrow screens the blur is capped (see applyLook).
export const PRESETS = {
    neumorphic: {l: 'Neuromorphic', veil: 62, glass: 62, blur: 0, depth: 72, soft: 88, shine: 0, refract: 0, hi: 1, inset: 0, sat: 100},
    glass: {l: 'Glassmorphism', veil: 30, glass: 36, blur: 20, depth: 35, soft: 60, shine: 35, refract: 0, hi: 0, inset: 0, sat: 165},
    liquid: {l: 'Liquid', veil: 22, glass: 14, blur: 26, depth: 40, soft: 100, shine: 70, refract: 55, hi: .25, inset: 0, sat: 230},
    deep: {l: 'Deep', veil: 46, glass: 56, blur: 14, depth: 92, soft: 38, shine: 14, refract: 0, hi: 0, inset: 1, sat: 140},
    reflective: {l: 'Reflective', veil: 26, glass: 12, blur: 8, depth: 55, soft: 55, shine: 100, refract: 90, hi: .2, sat: 200, inset: 0},
};
export const LOOK_DEFAULTS = {preset: 'glass', rt: true, ...Object.fromEntries(Object.entries(PRESETS.glass).filter(([k]) => k !== 'l'))};
export const DEFS = [
    {k: 'veil', label: 'Veil', unit: '%', min: 0, max: 90}, {k: 'glass', label: 'Opacity', unit: '%', min: 4, max: 70}, {k: 'blur', label: 'Frost', unit: 'px', min: 0, max: 44},
    {k: 'depth', label: 'Depth', unit: '', min: 0, max: 100}, {k: 'soft', label: 'Softness', unit: '', min: 0, max: 100}, {k: 'shine', label: 'Shine', unit: '', min: 0, max: 100},
    {k: 'refract', label: 'Refraction', unit: '', min: 0, max: 100},
];

// The lens: an SVG filter used inside backdrop-filter. The displacement map is a profile: neutral grey in the middle (no bend, the picture stays clear) and
// a band of about 10 % at every edge that pulls the picture inward, like the rim of a lens. Chromium only; elsewhere --lens stays a no-op and the glass is just frosted.
let lensEl = null;
function lens() {
    if (lensEl) return lensEl;
    const map = "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs>"
        + "<linearGradient id='x' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='rgb(255,0,0)'/><stop offset='.1' stop-color='rgb(128,0,0)'/><stop offset='.9' stop-color='rgb(128,0,0)'/><stop offset='1' stop-color='rgb(0,0,0)'/></linearGradient>"
        + "<linearGradient id='y' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='rgb(0,255,0)'/><stop offset='.1' stop-color='rgb(0,128,0)'/><stop offset='.9' stop-color='rgb(0,128,0)'/><stop offset='1' stop-color='rgb(0,0,0)'/></linearGradient></defs>"
        + "<rect width='100' height='100' fill='url(#x)'/><rect width='100' height='100' fill='url(#y)' style='mix-blend-mode:screen'/></svg>";
    const d = document.createElement('div');
    d.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="glass-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
        + '<feImage href="data:image/svg+xml,' + encodeURIComponent(map) + '" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>'
        + '<feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
    document.body.appendChild(d.firstChild);
    return lensEl = document.querySelector('#glass-lens feDisplacementMap');
}
const lensOk = () => typeof CSS !== 'undefined' && CSS.supports('backdrop-filter', 'url(#glass-lens)');
let last = null;
export function applyLook(root, p) {
    last = [root, p];
    const s = (k, v) => root.style.setProperty(k, v);
    const blur = innerWidth < 640 ? Math.min(p.blur, 12) : p.blur;   // phones: cap the frost, it is the expensive part
    s('--veil-a', p.veil / 100); s('--glass-a', p.glass / 100); s('--blur', blur + 'px');
    s('--depth', p.depth); s('--soft', p.soft); s('--shine', p.shine); s('--hi', p.hi); s('--inset', p.inset); s('--sat', p.sat + '%'); s('--refract', p.refract ?? 0);
    const on = (p.refract ?? 0) > 0 && lensOk();
    if (on) lens().setAttribute('scale', String(Math.round(p.refract * .6)));
    s('--lens', on ? 'url(#glass-lens)' : 'blur(0px)');
    root.dataset.look = p.preset;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('look-ready')));   // enable the transitions only after the first paint
    root.classList.toggle('solid', systemSolid() && p.rt !== false);
}
const systemSolid = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-transparency: reduce)').matches;
export { systemSolid };
addEventListener('resize', () => last && applyLook(...last));

// Slider values glide to a preset (about 0.4 s, ease out) instead of jumping. The visuals ease on their own: the look tokens are registered CSS properties
// (@property in scss/_base.scss) with a transition on .v4, so radius, shadows, blur and sheen follow smoothly, also when you drag a slider or change mode.
let glideId = 0;
function glide(prefs, to, ms = 420) {
    const keys = ['veil', 'glass', 'blur', 'depth', 'soft', 'shine', 'refract'];
    cancelAnimationFrame(glideId);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { keys.forEach(k => prefs[k] = to[k]); return; }
    const from = Object.fromEntries(keys.map(k => [k, prefs[k]])), t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); keys.forEach(key => prefs[key] = Math.round(from[key] + (to[key] - from[key]) * e)); if (k < 1) glideId = requestAnimationFrame(step); };
    glideId = requestAnimationFrame(step);
}

export const LookControls = {
    props: {prefs: Object, scheme: String},
    setup(p) {
        const set = (k, v) => { p.prefs[k] = v; p.prefs.preset = 'custom'; };
        const use = id => { const t = Object.fromEntries(Object.entries(PRESETS[id]).filter(([k]) => k !== 'l')); Object.assign(p.prefs, {hi: t.hi, inset: t.inset, sat: t.sat, preset: id}); glide(p.prefs, t); };
        return {DEFS, PRESETS, set, use, sys: systemSolid()};
    },
    template: `<div class="look"><div class="sliders"><Slider v-for="d in DEFS" :key="d.k" :model-value="prefs[d.k]" :min="d.min" :max="d.max" :unit="d.unit" :label="d.k === 'veil' ? (scheme === 'light' ? 'White veil' : 'Dark veil') : d.label" @update:model-value="set(d.k, $event)"/></div>
        <div class="presets"><span class="presets__t">Presets</span><div class="chips"><button v-for="(v, id) in PRESETS" :key="id" class="chip" :class="{on: prefs.preset === id}" @click="use(id)"><i :class="'pv-' + id"></i>{{ v.l }}</button><span v-if="prefs.preset === 'custom'" class="chip ghost">Custom</span></div></div>
        <div class="rt"><Toggle :model-value="prefs.rt !== false" label="Follow the system setting “Reduce transparency”" @update:model-value="prefs.rt = $event"/><small v-if="sys">Your system asks for reduced transparency, so glass is shown as solid panels while this is on.</small></div></div>`,
};
