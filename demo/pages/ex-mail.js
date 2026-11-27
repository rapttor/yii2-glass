// Glass kit v6, example "Mail templates": six email-safe messages with a live preview. Register with `registerExMail(app)`, the page is `DemoMail`.
// Styled by demo/scss/_ex-mail.scss. The template functions (everything above the "components" divider) are pure: no DOM, no network, no clock.
// Every template function takes (data, opts) and returns {key, kind, subject, preheader, html, text}.
//   data: any part of MAIL_SAMPLE (missing parts keep the sample value, so a real sender must pass all of them).
//   opts: {style: 'clean' | 'bold' | 'glass', accent: '#rrggbb', theme: 'auto' | 'light' | 'dark'}. 'auto' is what you send; the others force a scheme for previews.
import { ref, reactive, computed, onMounted } from 'vue';
import { PATHS, toast } from 'glass/ui.js';

export const MAIL_ACCENT = '#ff5a36';
export const MAIL_STYLES = [{v: 'clean', l: 'Clean'}, {v: 'bold', l: 'Bold'}, {v: 'glass', l: 'Soft glass'}];
export const MAIL_SAMPLE = {
    brand: 'Northwind Demo',
    name: 'Leah Moreno',
    url: 'https://app.northwind.test/',
    sender: '[Legal company name], [Street and number], [Postcode and city], [Country]',
    welcome: {steps: ['Complete your profile', 'Invite the people you work with', 'Add your first deal']},
    signin: {url: 'https://app.northwind.test/auth/link?token=SAMPLE-ONLY', code: '482913', minutes: 15},
    receipt: {number: 'R-2026-0412', date: '26 November 2026', currency: 'EUR', taxRate: 20, method: 'Card ending 4242', url: 'https://app.northwind.test/receipts/R-2026-0412',
        items: [{label: 'Team plan, December 2026', qty: 1, price: 49}, {label: 'Additional seat', qty: 3, price: 9}, {label: 'Storage, 100 GB', qty: 1, price: 6.5}]},
    reminder: {number: 'INV-2026-0117', currency: 'EUR', amount: 1240, issued: '19 November 2026', due: '3 December 2026', url: 'https://app.northwind.test/invoices/INV-2026-0117'},
    newsletter: {title: 'What is new in November', intro: 'Three changes from this month, each a two minute read.', url: 'https://northwind.test/news/',
        unsubscribe: 'https://northwind.test/mail/unsubscribe?list=news', settings: 'https://northwind.test/mail/preferences',
        articles: [
            {title: 'A faster pipeline board', text: 'Move deals by dragging, by touch or with the keyboard. Totals update as you go.', url: 'https://northwind.test/news/pipeline'},
            {title: 'Export what you see', text: 'Tables now export the current search and sort order to CSV.', url: 'https://northwind.test/news/export'},
            {title: 'Calmer notifications', text: 'Pick which updates reach you and turn the rest off in one place.', url: 'https://northwind.test/news/notifications'},
        ]},
    digest: {period: '16 to 22 November 2026', url: 'https://app.northwind.test/overview', settings: 'https://app.northwind.test/settings/notifications',
        stats: [{value: '14', label: 'New leads'}, {value: '6', label: 'Deals moved'}, {value: '229k', label: 'EUR won'}],
        items: [{title: 'Contract signed: Annual platform licence', text: 'Soylent, Friday'}, {title: 'Quote opened: Retail analytics', text: 'Wayne Corp, Thursday'}, {title: '3 follow-ups are due', text: 'Assigned to you'}]},
};

// ---------------------------------------------------------------- values
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]+/g;
const clean = v => String(v).replace(CONTROL, ' ').trim().slice(0, 2000);   // one line: nothing can add a mail header or a fake text line
export const mailEscape = v => String(v ?? '').replace(/[&<>"'`]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;'})[c]);
const e = mailEscape;
/** Only absolute http(s) and mailto addresses without spaces, quotes or angle brackets pass; anything else becomes '#'. */
export const mailSafeUrl = v => { const u = String(v ?? '').trim(); return /^(https?:\/\/|mailto:)[^\s"'<>`\\\u0000-\u001f\u007f]+$/i.test(u) ? u : '#'; };

const blank = shape => Array.isArray(shape) ? [] : shape && typeof shape === 'object' ? Object.fromEntries(Object.keys(shape).map(k => [k, blank(shape[k])])) : typeof shape === 'number' ? 0 : '';
// Copies `value` into the form of `shape`: unknown keys are dropped, strings are cleaned, wrong types fall back to the shape.
function fill(shape, value) {
    if (Array.isArray(shape)) return (Array.isArray(value) ? value.slice(0, 50) : shape).map(v => fill(blank(shape[0]), v));
    if (shape && typeof shape === 'object') return Object.fromEntries(Object.keys(shape).map(k => [k, fill(shape[k], value?.[k])]));
    if (typeof shape === 'number') return value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : shape;
    return typeof value === 'string' || typeof value === 'number' ? clean(value) : shape;
}
export function mailSample(data = {}) { const d = fill(MAIL_SAMPLE, data); d.brand ||= MAIL_SAMPLE.brand; return d; }

const cents = v => Math.round(v * 100);
const money = (c, currency) => (c < 0 ? '-' : '') + String(Math.floor(Math.abs(c) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(Math.abs(c) % 100).padStart(2, '0') + ' ' + currency;
const hello = name => name ? 'Hi ' + name.split(/\s+/)[0] + ',' : 'Hello,';

// ---------------------------------------------------------------- colours (solid only: many mail clients ignore rgba and gradients)
export function mailHex(v, fallback = MAIL_ACCENT) {
    const s = String(v ?? '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map(c => c + c).join('');
    const m = s.match(/^rgb\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)$/);
    return m ? '#' + m.slice(1).map(n => Math.min(255, +n).toString(16).padStart(2, '0')).join('') : fallback;
}
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const y = rgb(b); return '#' + rgb(a).map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const lum = h => rgb(h).map(v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };
const inkOn = bg => ['#ffffff', '#17121c'].find(c => ratio(c, bg) >= 4.5) || '#000000';
// `fg` moved towards black (or white on dark surfaces) until it reads on every one of the backgrounds
const readable = (fg, bgs) => { const to = lum(bgs[0]) > .4 ? '#000000' : '#ffffff'; for (let t = 0; t < 1; t += .05) { const c = mix(fg, to, t); if (bgs.every(bg => ratio(c, bg) >= 4.5)) return c; } return to; };
const gradient = (a, b) => 'linear-gradient(160deg,' + a + ' 0%,' + b + ' 100%)';

function palette(style, accent) {
    const W = '#ffffff', on = inkOn(accent);
    const light = {page: '#f3f2f5', card: W, head: W, ink: '#1c1720', muted: '#585160', line: '#e4e0e9', panel: '#f7f6f9', pageEnd: '', headEnd: ''};
    const dark = {page: '#121015', card: '#1e1b22', head: '#1e1b22', ink: '#f3f0f6', muted: '#bdb6c6', line: '#3a3542', panel: '#29252f', pageEnd: '', headEnd: ''};
    const look = {radius: 12, button: 8, mark: 8};
    if (style === 'bold') {
        const end = mix(accent, on === W ? '#000000' : W, .18);   // the second stop moves away from the text colour, so contrast only grows
        Object.assign(light, {page: mix(accent, W, .9), head: accent, headEnd: end, panel: mix(accent, W, .93), line: mix(accent, W, .78)});
        Object.assign(dark, {page: '#100c12', head: accent, headEnd: end, panel: mix(accent, '#1e1b22', .86), line: mix(accent, '#1e1b22', .7)});
        Object.assign(look, {radius: 6, button: 4, mark: 4});
    } else if (style === 'glass') {
        Object.assign(light, {page: mix(accent, W, .87), pageEnd: '#e8ebfb', head: mix(accent, W, .91), headEnd: W, panel: mix(accent, W, .94), line: mix(accent, W, .8)});
        Object.assign(dark, {page: '#15111f', pageEnd: mix(accent, '#15111f', .82), card: '#211d2e', head: mix(accent, '#211d2e', .8), headEnd: '#211d2e', panel: '#2c2739', line: '#453d57'});
        Object.assign(look, {radius: 24, button: 24, mark: 12});
    }
    for (const c of [light, dark]) c.link = readable(accent, [c.card, c.panel, c.page, c.pageEnd].filter(Boolean));   // links also sit in the footer, on the page
    light.cardLine = style === 'glass' ? W : light.line; dark.cardLine = dark.line;
    return {light, dark, accent, on, ...look};
}

// ---------------------------------------------------------------- HTML
const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;";
const MONO = "font-family:Consolas,Menlo,'Courier New',monospace;";
const TABLE = 'role="presentation" border="0" cellpadding="0" cellspacing="0"';
const type = (size, line, color, extra = '') => FONT + 'font-size:' + size + 'px;line-height:' + line + 'px;color:' + color + ';' + extra;
const bgImage = (a, b) => b ? 'background-image:' + gradient(a, b) + ';' : '';
const row = (inner, bottom = 16, extra = '') => `<tr><td class="m-pad" style="padding:0 40px ${bottom}px 40px;${extra}">${inner}</td></tr>`;
const para = (text, p, cls = 'm-ink', size = 16) => `<p class="${cls}" style="margin:0;${type(size, size + 9, cls === 'm-ink' ? p.light.ink : p.light.muted)}">${e(text)}</p>`;
const link = (label, url, p, extra = '') => `<a class="m-link" href="${e(mailSafeUrl(url))}" style="color:${p.light.link};text-decoration:underline;${extra}">${e(label)}</a>`;
const panel = (inner, p) => `<table ${TABLE} width="100%" style="width:100%;border-collapse:separate;"><tr><td class="m-panel" bgcolor="${p.light.panel}" style="background-color:${p.light.panel};border:1px solid ${p.light.line};border-radius:${Math.min(p.radius, 14)}px;padding:16px 20px;">${inner}</td></tr></table>`;

// Button that survives Outlook (VML shape) and clients that drop padding on links (coloured table cell).
function button(label, url, p) {
    const href = e(mailSafeUrl(url)), width = Math.min(480, Math.max(220, [...label].length * 10 + 56)), radius = Math.min(p.button, 24);
    return `<!--[if mso]><v:roundrect href="${href}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="${Math.round(radius / 48 * 100)}%" stroke="f" fillcolor="${p.accent}"><w:anchorlock/><center style="font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:${p.on};">${e(label)}</center></v:roundrect><![endif]-->`
        + `<!--[if !mso]><!--><table ${TABLE} class="m-btn" style="border-collapse:separate;"><tr><td align="center" bgcolor="${p.accent}" style="background-color:${p.accent};border-radius:${radius}px;">`
        + `<a href="${href}" style="display:inline-block;padding:14px 28px;border-radius:${radius}px;${type(16, 20, p.on, 'font-weight:700;text-decoration:none;')}">${e(label)}</a></td></tr></table><!--<![endif]-->`;
}

const BLOCKS = {
    p: (b, p) => row(para(b.text, p)),
    note: (b, p) => row(para(b.text, p, 'm-muted', 13)),
    button: (b, p) => row(button(b.label, b.url, p), 24, 'padding-top:8px;'),
    address: (b, p) => row(`${para(b.label, p, 'm-muted', 13)}<p style="margin:4px 0 0 0;word-break:break-all;${type(13, 20, p.light.link)}">${link(mailSafeUrl(b.url), b.url, p, 'word-break:break-all;')}</p>`),
    code: (b, p) => row(panel(`${para(b.label, p, 'm-muted', 13)}<p class="m-ink" style="margin:6px 0 0 0;${MONO}font-size:28px;line-height:36px;letter-spacing:6px;font-weight:700;color:${p.light.ink};">${e(b.code)}</p>`, p), 20),
    list: (b, p) => row(`<table ${TABLE} width="100%" style="width:100%;">${b.items.map((t, i) => `<tr><td width="36" valign="top" style="width:36px;padding:0 0 12px 0;"><table ${TABLE} style="border-collapse:separate;"><tr><td align="center" width="24" height="24" bgcolor="${p.accent}" style="width:24px;height:24px;background-color:${p.accent};border-radius:12px;${type(12, 24, p.on, 'font-weight:700;')}">${i + 1}</td></tr></table></td><td valign="top" class="m-ink" style="padding:0 0 12px 0;${type(16, 24, p.light.ink)}">${e(t)}</td></tr>`).join('')}</table>`, 12),
    facts: (b, p) => row(panel(`<table ${TABLE} width="100%" style="width:100%;">${b.rows.map(([k, v]) => `<tr><td class="m-muted" valign="top" style="padding:4px 12px 4px 0;${type(14, 22, p.light.muted)}">${e(k)}</td><td class="m-ink" valign="top" align="right" style="padding:4px 0;text-align:right;${type(14, 22, p.light.ink, 'font-weight:700;')}">${e(v)}</td></tr>`).join('')}</table>`, p), 20),
    table: (b, p) => {   // a real data table: it keeps its semantics for screen readers
        const cell = (text, i, tag, cls, extra) => `<${tag} class="${cls} m-line" align="${i ? 'right' : 'left'}" valign="top" style="padding:10px 0 10px ${i ? 12 : 0}px;text-align:${i ? 'right' : 'left'};border-bottom:1px solid ${p.light.line};${extra}">${e(text)}</${tag}>`;
        return row(`<table border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;"><thead><tr>${b.head.map((h, i) => cell(h, i, 'th', 'm-muted', type(12, 18, p.light.muted, 'font-weight:700;'))).join('')}</tr></thead>`
            + `<tbody>${b.rows.map(r => `<tr>${r.map((v, i) => cell(v, i, 'td', 'm-ink', type(14, 21, p.light.ink, i ? 'white-space:nowrap;' : ''))).join('')}</tr>`).join('')}</tbody></table>`
            + `<table ${TABLE} width="100%" style="width:100%;margin-top:8px;">${b.totals.map(([k, v], i) => { const last = i === b.totals.length - 1, cls = last ? 'm-ink' : 'm-muted', css = type(last ? 18 : 14, last ? 28 : 22, last ? p.light.ink : p.light.muted, last ? 'font-weight:800;' : ''); return `<tr><td class="${cls}" style="padding:2px 0;${css}">${e(k)}</td><td class="${cls}" align="right" style="padding:2px 0 2px 12px;text-align:right;white-space:nowrap;${css}">${e(v)}</td></tr>`; }).join('')}</table>`, 20);
    },
    article: (b, p) => row(panel(`<h2 class="m-ink" style="margin:0 0 6px 0;${type(18, 25, p.light.ink, 'font-weight:700;')}">${e(b.title)}</h2>${para(b.text, p, 'm-muted', 15)}<p style="margin:10px 0 0 0;${type(14, 22, p.light.link, 'font-weight:700;')}">${link('Read: ' + b.title, b.url, p)}</p>`, p)),
    stats: (b, p) => row(`<table ${TABLE} width="100%" style="width:100%;table-layout:fixed;"><tr>${b.items.map(s => `<td class="m-col" valign="top" style="padding:0 4px 8px 4px;">${panel(`<p class="m-ink" style="margin:0;text-align:center;${type(26, 32, p.light.ink, 'font-weight:800;')}">${e(s.value)}</p><p class="m-muted" style="margin:0;text-align:center;${type(13, 19, p.light.muted)}">${e(s.label)}</p>`, p)}</td>`).join('')}</tr></table>`, 12, 'padding-left:36px;padding-right:36px;'),
    feed: (b, p) => row(`<table ${TABLE} width="100%" style="width:100%;">${b.items.map(i => `<tr><td class="m-line" style="padding:12px 0;border-bottom:1px solid ${p.light.line};"><p class="m-ink" style="margin:0;${type(15, 22, p.light.ink, 'font-weight:700;')}">${e(i.title)}</p>${para(i.text, p, 'm-muted', 13)}</td></tr>`).join('')}</table>`, 20),
};

function darkCss(style, p) {
    const d = p.dark, surface = (color, end) => `background-color:${color}!important;background-image:${end ? gradient(color, end) : 'none'}!important;`;
    const rules = [['m-page', surface(d.page, d.pageEnd)], ['m-card', `background-color:${d.card}!important;border-color:${d.cardLine}!important;`], ['m-panel', `background-color:${d.panel}!important;border-color:${d.line}!important;`],
        ['m-ink', `color:${d.ink}!important;`], ['m-muted', `color:${d.muted}!important;`], ['m-line', `border-color:${d.line}!important;`], ['m-link', `color:${d.link}!important;`]];
    if (style !== 'bold') rules.push(['m-head', surface(d.head, d.headEnd)]);   // the bold header keeps the accent in both schemes
    return rules;
}

function toHtml(m, d, style, p, theme) {
    const L = p.light, bold = style === 'bold', glass = style === 'glass';
    const rules = darkCss(style, p), css = (prefix = '') => rules.map(([c, body]) => `${prefix}.${c}{${body}}`).join('\n');
    const scheme = theme === 'auto' ? 'light dark' : theme;
    const dark = theme === 'light' ? '' : theme === 'dark' ? css() : `@media (prefers-color-scheme: dark){\n${css()}\n}\n${css('[data-ogsc] ')}`;
    const headInk = bold ? p.on : L.ink, headCls = bold ? '' : 'm-ink';
    const brand = `<table ${TABLE}><tr><td align="center" width="40" height="40" bgcolor="${bold ? p.on : p.accent}" style="width:40px;height:40px;background-color:${bold ? p.on : p.accent};border-radius:${p.mark}px;${type(19, 40, bold ? p.accent : p.on, 'font-weight:800;')}">${e([...d.brand][0].toUpperCase())}</td><td class="${headCls}" style="padding-left:12px;${type(17, 24, headInk, 'font-weight:800;')}">${e(d.brand)}</td></tr></table>`;
    const title = `<h1 class="m-h1 ${headCls}" style="margin:0;${type(bold ? 30 : 26, bold ? 38 : 34, headInk, 'font-weight:800;letter-spacing:-0.3px;')}">${e(m.title)}</h1>`;
    const headBg = `bgcolor="${L.head}" style="background-color:${L.head};${bgImage(L.head, L.headEnd)}`;
    const head = `<tr><td class="m-head m-pad" ${headBg}padding:${bold ? '28px 40px 32px 40px' : '28px 40px 20px 40px'};border-radius:${p.radius}px ${p.radius}px 0 0;">${brand}<div style="height:${bold ? 28 : 24}px;line-height:${bold ? 28 : 24}px;font-size:1px;">&nbsp;</div>${title}</td></tr>`;
    const bar = style === 'clean' ? `<tr><td height="4" bgcolor="${p.accent}" style="height:4px;line-height:4px;font-size:1px;background-color:${p.accent};border-radius:${p.radius}px ${p.radius}px 0 0;">&nbsp;</td></tr>` : '';
    const foot = t => `<p class="m-muted" style="margin:0 0 8px 0;text-align:center;${type(12, 19, L.muted)}">${t}</p>`;
    const footer = foot(e(m.reason)) + (m.links.length ? foot(m.links.map(([label, url]) => link(label, url, p)).join(' &nbsp;|&nbsp; ')) : '') + foot(e(d.brand) + '<br>' + e(d.sender));
    return `<!doctype html>
<html lang="en" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="${scheme}">
<meta name="supported-color-schemes" content="${scheme}">
<title>${e(m.subject)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
:root{color-scheme:${scheme};supported-color-schemes:${scheme};}
body{margin:0;padding:0;width:100%!important;}
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0;mso-table-rspace:0;}
h1,h2,p,th,td{overflow-wrap:break-word;word-wrap:break-word;}
@media only screen and (max-width:620px){
.m-wrap{padding:12px 8px!important;}
.m-pad{padding-left:20px!important;padding-right:20px!important;}
.m-h1{font-size:23px!important;line-height:30px!important;}
.m-col{display:block!important;width:100%!important;box-sizing:border-box!important;}
.m-btn{width:100%!important;}
.m-btn a{display:block!important;}
}
${dark}
</style>
</head>
<body class="m-page" bgcolor="${L.page}" style="margin:0;padding:0;background-color:${L.page};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${L.page};">${e(m.preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>
<table ${TABLE} width="100%" class="m-page" bgcolor="${L.page}" style="width:100%;background-color:${L.page};${bgImage(L.page, L.pageEnd)}">
<tr><td align="center" class="m-wrap" style="padding:${glass ? 40 : 32}px 12px;">
<!--[if mso]><table ${TABLE} width="600" align="center"><tr><td><![endif]-->
<table ${TABLE} width="100%" style="width:100%;max-width:600px;margin:0 auto;">
<tr><td>
<table ${TABLE} width="100%" class="m-card" bgcolor="${L.card}" style="width:100%;border-collapse:separate;background-color:${L.card};border:1px solid ${L.cardLine};border-radius:${p.radius}px;">
${bar}${head}
<tr><td style="height:${bold ? 28 : 8}px;line-height:${bold ? 28 : 8}px;font-size:1px;">&nbsp;</td></tr>
${m.blocks.map(b => BLOCKS[b.t](b, p)).join('\n')}
<tr><td style="height:12px;line-height:12px;font-size:1px;">&nbsp;</td></tr>
</table>
</td></tr>
<tr><td class="m-pad" align="center" style="padding:20px 40px 0 40px;">${footer}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

// ---------------------------------------------------------------- plain text
function wrap(text, width = 72) {
    const out = [''];
    for (const word of String(text).split(/\s+/)) {
        const last = out[out.length - 1];
        if (!last) out[out.length - 1] = word; else if (last.length + word.length + 1 > width) out.push(word); else out[out.length - 1] += ' ' + word;
    }
    return out.join('\n');
}
const TEXT = {
    p: b => wrap(b.text), note: b => wrap(b.text),
    button: b => b.label + ':\n' + mailSafeUrl(b.url),
    address: () => '',   // the button already prints the address
    code: b => b.label + '\n\n    ' + b.code,
    list: b => b.items.map((t, i) => (i + 1) + '. ' + t).join('\n'),
    facts: b => b.rows.map(([k, v]) => k + ': ' + v).join('\n'),
    table: b => b.rows.map(([label, qty, price, sum]) => '- ' + label + '\n  ' + qty + ' x ' + price + ' = ' + sum).join('\n') + '\n\n' + b.totals.map(([k, v]) => k + ': ' + v).join('\n'),
    article: b => wrap(b.title) + '\n' + wrap(b.text) + '\n' + mailSafeUrl(b.url),
    stats: b => b.items.map(s => s.label + ': ' + s.value).join('\n'),
    feed: b => b.items.map(i => '- ' + i.title + (i.text ? ' (' + i.text + ')' : '')).join('\n'),
};
const toText = (m, d) => [wrap(m.title), ...m.blocks.map(b => TEXT[b.t](b)), '--', wrap(m.reason), ...m.links.map(([label, url]) => label + ':\n' + mailSafeUrl(url)), d.brand + '\n' + wrap(d.sender)].filter(Boolean).join('\n\n') + '\n';

// ---------------------------------------------------------------- templates
// A message is plain content (title, blocks, footer); HTML and text are both drawn from it, so they cannot drift apart.
const CONTENT = {
    welcome: d => ({
        subject: 'Welcome to ' + d.brand, preheader: 'Your account is ready. Here is where to start.', title: 'Welcome to ' + d.brand,
        blocks: [{t: 'p', text: hello(d.name)}, {t: 'p', text: 'Your account is ready. These steps help you set it up:'}, {t: 'list', items: d.welcome.steps},
            {t: 'button', label: 'Open your account', url: d.url}, {t: 'note', text: 'If you did not create this account, you can ignore this message.'}],
        reason: 'You receive this message because an account was created with this email address.', links: [],
    }),
    signin: d => ({
        subject: 'Your sign-in link for ' + d.brand, preheader: 'Valid for ' + d.signin.minutes + ' minutes and works once.', title: 'Sign in to ' + d.brand,
        blocks: [{t: 'p', text: hello(d.name)}, {t: 'p', text: 'Open the sign-in page, then press the button on that page. You are signed in only after you press it.'},
            {t: 'button', label: 'Open the sign-in page', url: d.signin.url},
            ...(d.signin.code ? [{t: 'code', label: 'On another device? Enter this code instead:', code: d.signin.code}] : []),
            {t: 'note', text: 'The link and the code are valid for ' + d.signin.minutes + ' minutes and work once. Do not forward this message. If you did not ask to sign in, you can ignore it.'},
            {t: 'address', label: 'Button not working? Copy this address into your browser:', url: d.signin.url}],
        reason: 'You receive this message because someone asked to sign in with this email address.', links: [],
    }),
    receipt: d => {
        const r = d.receipt, lines = r.items.map(i => ({...i, sum: Math.round(cents(i.price) * i.qty)})), total = lines.reduce((a, l) => a + l.sum, 0);
        const tax = total - Math.round(total / (1 + Math.max(0, r.taxRate) / 100)), m = c => money(c, r.currency);   // prices include tax
        return {
            subject: 'Receipt ' + r.number + ' from ' + d.brand, preheader: 'Payment of ' + m(total) + ' received on ' + r.date + '.', title: 'Your receipt',
            blocks: [{t: 'p', text: hello(d.name)}, {t: 'p', text: 'We received your payment. Here are the details.'},
                {t: 'facts', rows: [['Receipt number', r.number], ['Date', r.date], ['Paid with', r.method]]},
                {t: 'table', head: ['Item', 'Qty', 'Price', 'Amount'], rows: lines.map(l => [l.label, String(l.qty), money(cents(l.price), ''), money(l.sum, '')].map(v => v.trim())),
                    totals: [['Net amount', m(total - tax)], ['Tax ' + r.taxRate + '%', m(tax)], ['Total paid', m(total)]]},
                {t: 'button', label: 'View the receipt', url: r.url}, {t: 'note', text: 'Amounts are in ' + r.currency + '. Keep this receipt for your records.'}],
            reason: 'You receive this message because a payment was made on your account.', links: [],
        };
    },
    reminder: d => {
        const r = d.reminder, amount = money(cents(r.amount), r.currency);
        return {
            subject: 'Invoice ' + r.number + ' is due on ' + r.due, preheader: amount + ' due on ' + r.due + '.', title: 'Invoice due on ' + r.due,
            blocks: [{t: 'p', text: hello(d.name)}, {t: 'p', text: 'This is a reminder that the invoice below is due soon.'},
                {t: 'facts', rows: [['Invoice number', r.number], ['Issued', r.issued], ['Due date', r.due], ['Amount due', amount]]},
                {t: 'button', label: 'View the invoice', url: r.url}, {t: 'note', text: 'If you have already paid, no action is needed.'}],
            reason: 'You receive this message because this invoice is addressed to your account.', links: [],
        };
    },
    newsletter: d => {
        const n = d.newsletter;
        return {
            subject: d.brand + ': ' + n.title, preheader: n.intro, title: n.title,
            blocks: [{t: 'p', text: hello(d.name)}, {t: 'p', text: n.intro}, ...n.articles.map(a => ({t: 'article', ...a})), {t: 'button', label: 'See all news', url: n.url}],
            reason: 'You receive this newsletter because you subscribed to it. You can unsubscribe at any time.', links: [['Unsubscribe', n.unsubscribe], ['Email preferences', n.settings]],
        };
    },
    digest: d => {
        const g = d.digest;
        return {
            subject: 'Your ' + d.brand + ' summary, ' + g.period, preheader: g.stats.map(s => s.label + ': ' + s.value).join(', '), title: 'Your weekly summary',
            blocks: [{t: 'p', text: hello(d.name)}, {t: 'p', text: 'Here is what happened from ' + g.period + '.'},
                ...(g.stats.length ? [{t: 'stats', items: g.stats.slice(0, 4)}] : []),
                g.items.length ? {t: 'feed', items: g.items} : {t: 'p', text: 'There was no new activity in this period.'},
                {t: 'button', label: 'Open the overview', url: g.url}],
            reason: 'You receive this message because the weekly summary is switched on in your notification settings.', links: [['Change or switch off this summary', g.settings]],
        };
    },
};

export const MAIL_TEMPLATES = [
    {id: 'welcome', label: 'Welcome', kind: 'transactional'}, {id: 'signin', label: 'Sign-in link', kind: 'transactional'}, {id: 'receipt', label: 'Receipt', kind: 'transactional'},
    {id: 'reminder', label: 'Invoice due', kind: 'transactional'}, {id: 'newsletter', label: 'Newsletter', kind: 'marketing'}, {id: 'digest', label: 'Digest', kind: 'notification'},
];

/** Renders one template. An unknown key renders the welcome message. */
export function renderMail(key, data = {}, opts = {}) {
    const info = MAIL_TEMPLATES.find(t => t.id === key) || MAIL_TEMPLATES[0], d = mailSample(data);
    const style = MAIL_STYLES.some(s => s.v === opts.style) ? opts.style : 'clean', theme = ['light', 'dark'].includes(opts.theme) ? opts.theme : 'auto';
    const m = CONTENT[info.id](d);
    return {key: info.id, kind: info.kind, subject: clean(m.subject), preheader: clean(m.preheader), html: toHtml(m, d, style, palette(style, mailHex(opts.accent)), theme), text: toText(m, d)};
}
export const mailWelcome = (data, opts) => renderMail('welcome', data, opts);
export const mailSignin = (data, opts) => renderMail('signin', data, opts);
export const mailReceipt = (data, opts) => renderMail('receipt', data, opts);
export const mailReminder = (data, opts) => renderMail('reminder', data, opts);
export const mailNewsletter = (data, opts) => renderMail('newsletter', data, opts);
export const mailDigest = (data, opts) => renderMail('digest', data, opts);

// ---------------------------------------------------------------- components
if (!PATHS.copy) PATHS.copy = 'M9 9h11v11H9zM5 15H4V4h11v1';

const SWATCHES = [['#3b6cf0', 'Blue'], ['#2f9e8a', 'Teal'], ['#a855f7', 'Violet'], ['#f59e0b', 'Amber']];

export const MailAccent = {   // radio group of accent colours; '' means "the accent of the app"
    props: {modelValue: String, app: {type: String, default: MAIL_ACCENT}},
    emits: ['update:modelValue'],
    setup(p, {emit}) {
        const options = computed(() => [{v: '', l: 'App accent', c: p.app}, ...SWATCHES.map(([c, l]) => ({v: c, l, c}))]);
        const key = (ev, i) => {
            const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[ev.key]; if (!step) return;
            ev.preventDefault(); const n = (i + step + options.value.length) % options.value.length;
            emit('update:modelValue', options.value[n].v); ev.currentTarget.parentElement.children[n].focus();
        };
        return {options, key};
    },
    template: `<div class="x-mail__sw" role="radiogroup" aria-label="Accent colour"><button v-for="(o, i) in options" :key="o.v" type="button" role="radio" :aria-checked="o.v === modelValue" :tabindex="o.v === modelValue ? 0 : -1" :aria-label="o.l" :title="o.l" :class="{on: o.v === modelValue}" @click="$emit('update:modelValue', o.v)" @keydown="key($event, i)"><i :style="{background: o.c}"></i></button></div>`,
};

export const MailPreview = {   // the HTML runs in a frame with an empty sandbox: no scripts, no forms, no pop-ups, no access to this page
    props: {mail: Object, view: String, device: String},
    setup: p => ({doc: computed(() => p.mail.html.replace('<head>', '<head><base target="_blank">'))}),   // with the empty sandbox this makes links do nothing
    template: `<div class="x-mail__stage" :class="[device, view]">
        <iframe v-if="view === 'html'" class="x-mail__frame" sandbox="" referrerpolicy="no-referrer" :title="'Preview of: ' + mail.subject" :srcdoc="doc"></iframe>
        <pre v-else class="x-mail__text" tabindex="0" aria-label="Plain text version">{{ mail.text }}</pre></div>`,
};

async function copyText(text, what) {
    try { await navigator.clipboard.writeText(text); toast(what + ' copied'); return; } catch { /* no clipboard API outside secure contexts: use the old way */ }
    const area = Object.assign(document.createElement('textarea'), {value: text, readOnly: true, className: 'x-mail__clip'}), before = document.activeElement;
    document.body.appendChild(area); area.select();
    const done = document.execCommand('copy'); area.remove(); before?.focus();
    done ? toast(what + ' copied') : toast('Copying is blocked by the browser', 'err');
}

const KINDS = {
    transactional: {badge: 'b', label: 'Transactional', note: 'Sent because of something the person or their account did. No marketing content.'},
    notification: {badge: 'y', label: 'Notification', note: 'Sent only while switched on. Links to the setting that turns it off. No marketing content.'},
    marketing: {badge: 'r', label: 'Marketing', note: 'Send only with consent. Has an unsubscribe link and needs the real sender address.'},
};

export const DemoMail = {
    components: {MailAccent, MailPreview},
    props: {sub: String},
    emits: ['sub'],
    setup(p, {emit}) {
        const cur = computed(() => MAIL_TEMPLATES.some(t => t.id === p.sub) ? p.sub : MAIL_TEMPLATES[0].id);
        const sample = reactive({brand: MAIL_SAMPLE.brand, name: MAIL_SAMPLE.name});
        const style = ref('clean'), accent = ref(''), appAccent = ref(MAIL_ACCENT), view = ref('html'), theme = ref('light');
        const device = ref(matchMedia('(max-width: 639px)').matches ? 'phone' : 'desktop');
        onMounted(() => { const root = document.querySelector('.v4'); if (root) appAccent.value = mailHex(getComputedStyle(root).getPropertyValue('--accent-c')); });
        const opts = computed(() => ({style: style.value, accent: accent.value || appAccent.value}));
        const mail = computed(() => renderMail(cur.value, sample, {...opts.value, theme: theme.value}));
        return {cur, sample, style, accent, appAccent, view, theme, device, mail, kind: computed(() => KINDS[mail.value.kind]),
            items: MAIL_TEMPLATES.map(t => ({id: t.id, label: t.label})), styles: MAIL_STYLES,
            views: [{v: 'html', l: 'HTML'}, {v: 'text', l: 'Text'}], devices: [{v: 'desktop', l: 'Desktop'}, {v: 'phone', l: 'Phone'}], themes: [{v: 'light', l: 'Light'}, {v: 'dark', l: 'Dark'}],
            go: k => emit('sub', k),
            copyHtml: () => copyText(renderMail(cur.value, sample, opts.value).html, 'HTML'), copyPlain: () => copyText(mail.value.text, 'Text')};
    },
    template: `<div class="page x-mail"><Holder flat><div class="lab"><GlassTabs :items="items" :model-value="cur" @update:model-value="go"/></div></Holder>
        <div class="x-mail__grid">
            <Holder title="Mail templates" sub="Sample data only" class="x-mail__side"><div class="x-mail__form">
                <Field v-model="sample.brand" label="Brand name"/><Field v-model="sample.name" label="Recipient name"/>
                <div class="x-mail__row"><span>Style</span><Segmented v-model="style" :options="styles"/></div>
                <div class="x-mail__row"><span>Accent</span><MailAccent v-model="accent" :app="appAccent"/></div>
                <div class="x-mail__kind"><Badge :kind="kind.badge">{{ kind.label }}</Badge><p>{{ kind.note }}</p></div></div></Holder>
            <Holder class="x-mail__main">
                <div class="x-mail__bar"><Segmented v-model="view" :options="views"/><template v-if="view === 'html'"><Segmented v-model="device" :options="devices"/><Segmented v-model="theme" :options="themes"/></template></div>
                <dl class="x-mail__meta"><div><dt>Subject</dt><dd>{{ mail.subject }}</dd></div><div><dt>Preheader</dt><dd>{{ mail.preheader }}</dd></div></dl>
                <MailPreview :mail="mail" :view="view" :device="device"/>
                <div class="x-mail__actions"><button type="button" class="btn primary" @click="copyHtml"><Ico n="copy" :s="16"/>Copy HTML</button><button type="button" class="btn" @click="copyPlain"><Ico n="copy" :s="16"/>Copy text</button></div></Holder></div></div>`,
};

export function registerExMail(app) {
    Object.entries({MailAccent, MailPreview, DemoMail}).forEach(([k, v]) => app.component(k, v));
}
