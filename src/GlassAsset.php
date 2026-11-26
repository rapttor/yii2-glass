<?php

declare(strict_types=1);

namespace rapttor\glass;

use yii\web\AssetBundle;

/**
 * Publishes the whole `assets` folder (styles, ES modules, vendor libraries, picture) so the modules keep their relative paths,
 * and registers the stylesheet. The published folder name changes when the package is updated, so browsers load the new modules.
 */
final class GlassAsset extends AssetBundle
{
    public $sourcePath = __DIR__ . '/../assets';
    public $css = ['css/glass.css'];
}
