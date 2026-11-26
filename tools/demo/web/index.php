<?php

declare(strict_types=1);

// The smallest Yii2 app that shows the package: php -S 127.0.0.1:8099 -t <package root>, then open /tools/demo/web/index.php
$root = dirname(__DIR__, 3);
require "$root/tests/bootstrap.php";   // loads Composer, Yii and the package; VENDOR_DIR can point at another vendor folder

(new yii\web\Application([
    'id' => 'glass-demo',
    'name' => 'Glass demo',
    'basePath' => dirname(__DIR__),
    'runtimePath' => dirname(__DIR__) . '/runtime',
    'components' => [
        'request' => ['cookieValidationKey' => 'demo-only'],
    ],
]));
$base = Yii::$app->request->baseUrl;   // /tools/demo/web
Yii::setAlias('@webroot', __DIR__);
Yii::setAlias('@web', $base);
Yii::$app->assetManager->basePath = __DIR__ . '/assets';
Yii::$app->assetManager->baseUrl = "$base/assets";

echo rapttor\glass\Shell::widget(['title' => 'Glass demo', 'entry' => '@web/app.js', 'config' => ['user' => 'Leah Moreno']]);
