# Instructions for AI coding agents: rapttor/yii2-glass

## Using it in an app

1. Look in `llms.txt` for a component before writing one. Read its `Demo*` showcase for the call.
2. Yii2: `Shell::widget()` from a controller action that requires sign-in. Static or PWA: copy `examples/static/index.html`.
3. `createGlassApp({nav, pages, brand, storage})`. A page is a component with one root `<div class="page">`, prop `sub`, emits `sub`; the address is `#page/sub`.
4. Never edit files of this package inside an app. Add a component to the app, or change the package.

## The look every screen keeps

1. Layers: picture, veil, holders (frosted sections), cards or panels. No page or container background colour.
2. Colours from tokens only: `--accent-c`, `--accent-ink`, `--tint`, `--text-rgb` (as `rgb(var(--text-rgb) / .6)`), `--muted`, `--line`, `--ok`, `--warn`, `--bad`; radii `--r-s --r-m --r-l`; shadows `--sh --sh-c`; `--blur`, `--glass-a`, `--sat`.
3. The look settings (veil, opacity, frost, depth, softness, shine, refraction and the five presets) keep working: no fixed blur or radius where a token exists.
4. Light and dark. Every new floating surface gets a `.v4.solid` rule (reduced transparency).
5. Floating layers hold text, so a strong fill: `rgb(var(--tint) / .86)`. Refraction only on bars, sheets and toasts. At most 2 or 3 blur layers on a phone screen.
6. Mobile first: 320 px, touch targets 40 px or more, pointer events. Breakpoints 576, 768, 992, 1200, 1400.
7. Motion `cubic-bezier(.22, 1, .36, 1)`, 150 to 450 ms, none under reduced motion.
8. Icons are 24x24 stroke paths added to `PATHS`. Icon-only buttons are centred with grid and have an `aria-label`.
9. One focus ring: the field wrapper draws it.

## Data and security

The kit is only the screen. The server checks every request against the owner. CSRF token on every state change. No secrets in
JavaScript or in `Shell::$config`. No CDN, remote fonts, trackers or session replay. Sanitise editor HTML on the server too.

## Changing the package

- `assets/` stays free of PHP and of absolute paths: static apps serve it as it is.
- Class names: `k-` for kit components. `v4`, `v5`, `shell6`, `side6` are internal names from the prototype.
- CSS traps: yii2-themes pads buttons (reset with `:where(button)`); the `rim` mixin sets `position: relative`; `.page` has auto margins; in SCSS never write `&__x` twice in one selector.
- `composer css` after SCSS changes, `composer test`, a line in `CHANGELOG.md`. Depend on Yii2 only.
- A new or updated library goes into `docs/VENDOR.md` with version and licence; the licence file stays next to it.
