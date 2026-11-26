// Loader and theme bridge for third-party libraries (editors, charts, sliders, icon sets). The libraries live in js/vendor/ext/<name>/ (copied from npm, see docs/VENDOR.md)
// and are loaded on demand with a plain <script> or <link>, so a page that does not use them never downloads them.
const jobs = new Map();

export const vendorUrl = path => new URL('../vendor/ext/' + path, import.meta.url).href;

export function loadScript(path, {global} = {}) {
    if (global && window[global]) return Promise.resolve(window[global]);
    const src = /^(https?:)?\/\//.test(path) ? path : vendorUrl(path);
    if (!jobs.has(src)) jobs.set(src, new Promise((ok, fail) => {
        const s = document.createElement('script'); s.src = src; s.async = true;
        s.onload = () => ok(global ? window[global] : true); s.onerror = () => { jobs.delete(src); fail(new Error('Could not load ' + src)); };
        document.head.appendChild(s);
    }));
    return jobs.get(src);
}
export function loadStyle(path) {
    const href = /^(https?:)?\/\//.test(path) ? path : vendorUrl(path);
    if (!jobs.has(href)) jobs.set(href, new Promise((ok, fail) => {
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = () => ok(true); l.onerror = () => { jobs.delete(href); fail(new Error('Could not load ' + href)); };
        document.head.appendChild(l);
    }));
    return jobs.get(href);
}

// the current look as plain values for libraries that cannot read CSS variables (canvas charts)
export function tokens() {
    const root = document.querySelector('.v4') || document.body, cs = getComputedStyle(root), v = n => cs.getPropertyValue(n).trim();
    const rgb = n => { const p = v(n).split(/\s+/).map(Number); return p.length === 3 ? p : [255, 255, 255]; };
    const text = rgb('--text-rgb'), tint = rgb('--tint'), a = (c, x) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${x})`;
    return {accent: v('--accent-c') || '#ff5a36', accentInk: v('--accent-ink') || '#fff', text: a(text, 1), muted: a(text, .62), line: a(text, .14), grid: a(text, .1), tint: a(tint, 1), ok: v('--ok') || '#34d399', warn: v('--warn') || '#fbbf24', bad: v('--bad') || '#fb7185',
        dark: root.dataset.scheme !== 'light', font: cs.fontFamily, palette: [v('--accent-c') || '#ff5a36', '#3b6cf0', '#2f9e8a', '#a855f7', '#f59e0b', '#ec4899', '#22d3ee', '#84cc16']};
}
// call back when the scheme, accent or look changes (the libraries then redraw with the new colours); returns a stop function
export function onThemeChange(cb) {
    const root = document.querySelector('.v4'); if (!root) return () => {};
    let t = 0; const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(cb, 80); });
    mo.observe(root, {attributes: true, attributeFilter: ['data-scheme', 'data-look', 'style', 'class']});
    return () => { mo.disconnect(); clearTimeout(t); };
}
