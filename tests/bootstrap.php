<?php

declare(strict_types=1);

// VENDOR_DIR lets the tests borrow an app's installed vendor folder when the package has none of its own.
$vendor = getenv('VENDOR_DIR') ?: dirname(__DIR__) . '/vendor';
defined('YII_DEBUG') or define('YII_DEBUG', true);
defined('YII_ENV') or define('YII_ENV', 'test');
defined('YII_ENABLE_ERROR_HANDLER') or define('YII_ENABLE_ERROR_HANDLER', false);
require_once $vendor . '/autoload.php';
require_once $vendor . '/yiisoft/yii2/Yii.php';
spl_autoload_register(static function (string $class): void {
    foreach (['rapttor\\glass\\tests\\' => __DIR__, 'rapttor\\glass\\' => dirname(__DIR__) . '/src'] as $prefix => $dir) {
        if (str_starts_with($class, $prefix)) {
            $file = $dir . '/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
            if (is_file($file)) {
                require $file;
            }

            return;
        }
    }
});
