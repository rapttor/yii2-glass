# rapttor/yii2-glass

The Rapttor look: refractive glass over a picture, light and dark, mobile first. An app shell (sidebar with four states, hover
helper, mega menu, phone bar, search, settings) and Vue 3 components, including panels, docks, forms, data, charts and knobs.
JavaScript needs no build step. Versions follow SemVer, see the CHANGELOG.

**Live demo: https://rapttor.github.io/yii2-glass/** (source in `demo/`, sample data only).

The `assets/` folder has no PHP in it: Yii2 apps use it through this package, static and PWA apps can serve it as it is.

## Yii2

```bash
composer require rapttor/yii2-glass
```

```php
// a controller only signed-in users reach
public function actionIndex(): string
{
    return \rapttor\glass\Shell::widget([
        'title' => 'Orders',
        'entry' => '@web/js/app.js',
        'config' => ['user' => Yii::$app->user->identity->email],   // printed into the page: no secrets
    ]);
}
```

```js
// web/js/app.js
import { createGlassApp } from 'glass/app.js';

const Orders = { template: `<div class="page"><Holder title="Orders">...</Holder></div>` };

createGlassApp({
    storage: 'myapp',
    brand: {name: 'My app', logo: 'M'},
    nav: [{id: 'work', label: 'Work', items: [{id: 'orders', label: 'Orders', icon: 'table', help: 'Every order.'}]}],
    pages: {orders: Orders},
});
```

With `rapttor/yii2-themes` registered as `themes`, the page carries the visitor's colour set.

## Panels and docks

```js
import { usePanels } from 'glass/kit-panels.js';
// in setup(): sizes, collapsed panels and "one at a time" are saved in this browser
const panels = usePanels('orders', {main: ['list', 'detail']}, {list: 35, detail: 65}, {dock: true});
```

```html
<KWorkspace :panels="panels" :items="[{id: 'list', title: 'List'}, {id: 'detail', title: 'Detail'}]">
    <template #list>...</template><template #detail>...</template>
</KWorkspace>
```

Drag a splitter (or use the arrow keys), double click it to reset; click a panel title to maximize, collapse and restore.
With `dock: false` a collapsed panel stays as a slim bar. `KSplit` and `KPanel` can be nested by hand.

## Without PHP

See `examples/static/index.html`: link `assets/css/glass.css`, map `glass/` and `vue` in an import map, load your module.

## Try it

```bash
php -S 127.0.0.1:8099 -t .
```

Then open `http://127.0.0.1:8099/tools/demo/web/index.php` (needs `composer install`) `http://127.0.0.1:8099/examples/static/` or the full demo at `http://127.0.0.1:8099/demo/`.

## Develop

`composer test` runs the tests. After changing `scss/`, run `composer css` and commit `assets/css/glass.css`.

## Limits

- The Vue browser build compiles templates at run time: a strict CSP needs `'unsafe-eval'` or precompiled templates.
- No service worker: the app supplies its own for offline use.
- Libraries and licences: `docs/VENDOR.md` (Trix and Quill advisories are open; ApexCharts stays on 4.7.0).
- Interface text is English only.
