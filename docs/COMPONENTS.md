# How to write a glass component

Rules for every component of the kit (`assets/js/glass/kit-*.js`, `scss/kit/_*.scss`). Read `AGENTS.md` too.

## Stack
- Vue 3.5 browser build with the runtime template compiler: `import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick, h, Teleport, Transition, TransitionGroup } from '../vendor/vue.esm-browser.prod.js'`.
  Components are plain objects with a `template: `...`` string. No SFC, no build step, no npm packages, no CDN.
- Already registered globally (do not rebuild them): `Ico` (`<Ico n="plus" :s="18"/>`), `Holder`, `Card`, `Badge`, `Avatar`, `Segmented`, `Chips`, `Toggle`, `Field` (text, select, textarea), `Slider`, `Stepper`, `Progress`,
  `Collapse`, `Accordion`, `Spark`, `Stat`, `AreaChart`, `Donut`, `Skeleton`, `Empty`, `Sheet`, `Toasts`, `GlassTabs`, `IconPill`, `NotchBar`. Their code: `assets/js/glass/ui.js`, `nav.js`. `toast(text, 'ok'|'err')` is exported by `ui.js`.
- Icons: `import { PATHS } from './ui.js'` and `Object.assign(PATHS, { name: 'svg path d' })` to add 24x24 stroke icons (stroke-based, no fills).
- Every file exports its components by name, a `registerKitX(app)` function that registers them globally, and one showcase component `DemoX` that shows every component of the file live with realistic business sample data.

## Styling
- One SCSS partial per file, plain CSS-variable driven. Do not import other SCSS. Define `$ease: cubic-bezier(.22, 1, .36, 1)` locally.
- Tokens on `.v4` (use them, never hard-code colours except the semantic ones): `--accent-c`, `--accent-ink`, `--tint` (rgb triplet), `--text-rgb` (use `rgb(var(--text-rgb) / .6)`), `--muted`, `--line`, `--ok --warn --bad`,
  `--blur`, `--glass-a`, `--sat`, `--r-s --r-m --r-l` (radii), `--sh` (holder shadow), `--sh-c` (card shadow), `--edge`, `--edge-a`.
- Floating layers (popover, menu, tooltip, dialog, drawer) hold text, so use a strong fill:
  `background: rgb(var(--tint) / .86); -webkit-backdrop-filter: blur(var(--blur)) saturate(var(--sat)); backdrop-filter: blur(var(--blur)) saturate(var(--sat)); border: 1px solid rgb(var(--edge) / var(--edge-a)); border-radius: var(--r-m); box-shadow: var(--sh);`
  (the `.v4.solid` class, set under reduced transparency, already turns the common surfaces solid: add your floating classes to a rule `.v4.solid .k-pop { background: rgb(var(--tint) / .96) !important; backdrop-filter: none !important }`).
- Class prefix `k-` for everything of the kit (`.k-check`, `.k-pop`, ...). Inputs inside a field never draw their own focus outline: the wrapper draws one ring (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-c) 40%, transparent)` on `:focus-within`).
- Icon-only buttons: `display: grid; place-items: center`. A hidden label never leaves a flex gap (put the margin on the label itself). Buttons are reset with `:where(button)`, so set `padding` yourself.
- Motion: `cubic-bezier(.22, 1, .36, 1)`, 150 to 450 ms; no motion under `prefers-reduced-motion` (the global rule covers `.v4 *`).
- Mobile first: works at 320 px, touch targets at least 40 px, pointer events (not mouse only), `touch-action` set where you drag.

## Accessibility
- Roles and aria for every control, visible focus, Escape closes layers, arrow keys in menus, tabs, listboxes, radio groups and trees, Enter and Space activate, focus is trapped in modal layers and returned on close.
- Text contrast 4.5:1 against the surface the component paints for itself.

## Do not
- Do not import from outside `assets/js/`, and do not depend on another kit file unless it is `ui.js`.

## Check
`node --input-type=module --check < file.js`, `composer css`, `composer test`, then the demo page at 375 px and desktop, light and dark.

## Third-party libraries (external kit files)
Some kit files wrap libraries from npm (editors, charts, sliders, icon sets). Rules:
- Fetch only with `npm pack <name>@<exact version> --silent` inside a fresh empty temp directory (no `npm install`, so no install scripts run), extract only the files you need, and copy them to
  `assets/js/vendor/ext/<name>/`. Never run the downloaded code outside the browser. Keep the library's licence file next to it.
- Only MIT, ISC, BSD, Apache-2.0 or similar licences. No GPL/AGPL/commercial editors, no CDN links at runtime, no analytics or telemetry.
- Load them on demand with `import { loadScript, loadStyle, tokens, onThemeChange } from './ext-loader.js'` (UMD builds as plain scripts). Redraw when `onThemeChange` fires so colours follow the scheme, accent and look.
- Theme the library's own CSS with the kit tokens in your SCSS partial (glass surfaces, `--accent-c`, `--text-rgb`, radii). Scope everything under a wrapper class so nothing leaks.
- Report for each library: package, exact version, licence (from its package.json), the files copied and their sizes in KB, and the source URL.
