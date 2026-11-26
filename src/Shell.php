<?php

declare(strict_types=1);

namespace rapttor\glass;

use Yii;
use yii\base\InvalidConfigException;
use yii\base\Widget;

/**
 * The whole HTML page of a glass app. Return it from a controller action that only signed-in users reach:
 *
 * ```php
 * public function actionIndex(): string
 * {
 *     return \rapttor\glass\Shell::widget(['title' => 'Orders', 'entry' => '@web/js/app.js', 'config' => ['user' => $name]]);
 * }
 * ```
 *
 * The entry is your ES module. It imports the kit by name (`import { createGlassApp } from 'glass/app.js'`) and may read the
 * server values with `JSON.parse(document.getElementById('glass-config').textContent)`.
 * When a `themes` component (rapttor/yii2-themes) is registered, the page gets the visitor's colour set.
 */
final class Shell extends Widget
{
    public string $title = '';
    /** @var string URL or alias of your module, for example `@web/js/app.js` */
    public string $entry = '';
    /** @var array<string, mixed> printed as JSON for the browser: never put secrets or other people's data here */
    public array $config = [];
    /** @var array<string, string> extra import map entries (name => URL) */
    public array $imports = [];
    /** @var string|null web app manifest URL */
    public ?string $manifest = null;
    /** @var string|null home screen icon URL */
    public ?string $touchIcon = null;
    /** @var string|null Content Security Policy nonce for the inline import map */
    public ?string $nonce = null;
    public string $themesComponent = 'themes';

    public function init(): void
    {
        parent::init();
        if ($this->entry === '') {
            throw new InvalidConfigException('Shell::$entry is required: the URL of your app module.');
        }
    }

    public function run(): string
    {
        $view = $this->getView();
        $base = GlassAsset::register($view)->baseUrl;
        $themes = Yii::$app->has($this->themesComponent) ? Yii::$app->get($this->themesComponent) : null;

        return $this->render('shell', [
            'attributes' => $themes !== null && method_exists($themes, 'prepare') ? $themes->prepare($view, $this->identity()) : '',
            'imports' => $this->imports + ['glass/' => "$base/js/glass/", 'vue' => "$base/js/vendor/vue.esm-browser.prod.js"],
            'entry' => $this->entryUrl(),
        ]);
    }

    /** The signed-in user, for the stored theme. An app without sign-in (no `user` component set up) has none. */
    private function identity(): ?object
    {
        try {
            return Yii::$app->has('user') ? Yii::$app->get('user')->identity : null;
        } catch (InvalidConfigException) {
            return null;
        }
    }

    /** The entry with `?v=<mtime>` when it is a file of this site, so a deploy is not served stale. */
    private function entryUrl(): string
    {
        $url = (string) Yii::getAlias($this->entry);
        $web = (string) Yii::getAlias('@web', false);
        $root = Yii::getAlias('@webroot', false);
        if ($root !== false && !str_contains($url, '?') && !preg_match('~^(https?:)?//~', $url)) {
            $path = $root . '/' . ltrim($web !== '' && str_starts_with($url, $web . '/') ? substr($url, strlen($web)) : $url, '/');
            if (is_file($path)) {
                return $url . '?v=' . filemtime($path);
            }
        }

        return $url;
    }
}
