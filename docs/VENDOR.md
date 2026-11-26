# Third-party libraries

Copied from npm with `npm pack` at the exact versions below (no install scripts run), dist files plus licence only, into `assets/js/vendor/ext/<name>/`.
They load on demand (`assets/js/glass/ext-loader.js`) from our own origin, never from a CDN. Source of each: `https://registry.npmjs.org/<name>/-/<name>-<version>.tgz`.
Vue (3.5.46, MIT, licence in `vue.LICENSE`) is in `assets/js/vendor/`.

| Package | Version | Licence | On disk | Used by |
|---|---|---|---|---|
| quill | 2.0.3 | BSD-3-Clause | 272 KB | `kit-editors.js` (ExtQuill) |
| trix | 2.1.19 | MIT | 228 KB | `kit-editors.js` (ExtTrix) |
| swiper | 14.4.0 | MIT | 172 KB | `kit-editors.js` (ExtSwiper) |
| nouislider | 15.8.1 | MIT | 40 KB | `kit-editors.js` (ExtRange) |
| chart.js | 4.6.2 | MIT | 212 KB | `kit-charts.js` (ExtChartJs) |
| apexcharts | **4.7.0 (pinned)** | MIT | 568 KB | `kit-charts.js` (ExtApex) |
| uplot | 1.6.32 | MIT | 60 KB | `kit-charts.js` (ExtUPlot) |
| bootstrap-icons | 1.13.2 | MIT | 456 KB | `kit-icons.js` |
| lucide-static | 1.80.0 | ISC (with MIT terms for Feather-derived icons) | 612 KB | `kit-icons.js` |

## Warnings (read before using in a product)
- **ApexCharts must stay on 4.7.0** unless the licence is re-checked: 5.x and later are no longer free for every use (a revenue limit and paid tiers).
- **Quill 2.0.3** (the latest) has a low-severity advisory, GHSA-v3m3-f69x-jf25 (XSS through its HTML export). The kit does not call that export, never enables video or formula, and sanitises what it renders.
- **Trix 2.1.19** bundles DOMPurify 3.4.2, which has published advisories for that version range. Whether they apply to how Trix uses it has **not** been checked. Check before shipping Trix.
- Editor HTML is cleaned in the browser by an allow-list sanitiser. **The server must still sanitise** everything it stores or shows.
- Images in Quill are off by default. Turning them on is an upload: it needs the upload consent and the feature flag described in the app's `AGENTS.md`.
