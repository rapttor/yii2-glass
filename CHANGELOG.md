# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com), [SemVer](https://semver.org).

## [Unreleased]

## [0.1.0] - 2026-11-27

### Added
- First version, taken from the demo's "glass v6": app shell, `createGlassApp()`, forms, overlays, data, navigation, panels and docks, knobs, layout, icons, editors and charts.
- Yii2: `Shell` widget and `GlassAsset`.
- Static use without PHP: `examples/static`.

### Known limits
- Vue compiles templates in the browser: a strict CSP needs `'unsafe-eval'`.
- No service worker; interface text in English only.
- Open advisories for the bundled Trix and Quill editors (`docs/VENDOR.md`).
- Touch gestures not yet checked on real phones.

