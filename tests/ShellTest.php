<?php

declare(strict_types=1);

namespace rapttor\glass\tests;

use PHPUnit\Framework\TestCase;
use rapttor\glass\Shell;
use Yii;
use yii\base\InvalidConfigException;
use yii\helpers\FileHelper;

final class ShellTest extends TestCase
{
    private string $webroot;

    protected function setUp(): void
    {
        $this->webroot = sys_get_temp_dir() . '/glass-' . bin2hex(random_bytes(4));
        FileHelper::createDirectory($this->webroot . '/assets');
        FileHelper::createDirectory($this->webroot . '/js');
        file_put_contents($this->webroot . '/js/app.js', '// test');
        new \yii\web\Application([
            'id' => 'glass-test',
            'name' => 'Glass <Test>',
            'basePath' => $this->webroot,
            'components' => [
                'request' => ['cookieValidationKey' => 'test', 'scriptFile' => $this->webroot . '/index.php', 'scriptUrl' => '/index.php', 'baseUrl' => ''],
                'assetManager' => ['basePath' => $this->webroot . '/assets', 'baseUrl' => '/assets'],
            ],
        ]);
        Yii::setAlias('@webroot', $this->webroot);
        Yii::setAlias('@web', '');
    }

    protected function tearDown(): void
    {
        Yii::$app = null;
        FileHelper::removeDirectory($this->webroot);
    }

    public function testRendersOnePageWithStylesImportMapAndEntry(): void
    {
        $html = Shell::widget(['entry' => '@web/js/app.js']);

        self::assertSame(1, substr_count($html, '<body'));
        self::assertStringContainsString('<body class="v4 v5">', $html);
        self::assertStringContainsString('<div id="app"></div>', $html);
        self::assertMatchesRegularExpression('~<link href="/assets/[a-f0-9]+/css/glass\.css"~', $html);
        self::assertMatchesRegularExpression('~<script type="module" src="/js/app\.js\?v=\d+"></script>~', $html);
        self::assertStringContainsString('csrf-token', $html);

        preg_match('~<script type="importmap">(.*?)</script>~s', $html, $m);
        $imports = json_decode($m[1], true)['imports'];
        self::assertFileExists($this->webroot . $imports['vue']);
        self::assertFileExists($this->webroot . $imports['glass/'] . 'app.js');
        self::assertLessThan(strpos($html, 'type="module"'), strpos($html, 'type="importmap"'), 'the import map must come first');
    }

    public function testServerValuesCannotBreakOutOfThePage(): void
    {
        $html = Shell::widget(['entry' => '@web/js/app.js', 'title' => '</title><script>x</script>', 'config' => ['note' => '</script><img src=x>']]);

        self::assertStringNotContainsString('<script>x', $html);
        self::assertStringNotContainsString('</script><img', $html);
        self::assertStringContainsString('id="glass-config"', $html);
    }

    public function testAppNameIsTheDefaultTitleAndNonceReachesTheImportMap(): void
    {
        $html = Shell::widget(['entry' => '@web/js/app.js', 'nonce' => 'abc123', 'manifest' => '@web/app.webmanifest']);

        self::assertStringContainsString('<title>Glass &lt;Test&gt;</title>', $html);
        self::assertStringContainsString('nonce="abc123"', $html);
        self::assertStringContainsString('<link rel="manifest" href="/app.webmanifest">', $html);
    }

    public function testRemoteEntryIsNotVersioned(): void
    {
        self::assertStringContainsString('src="https://cdn.test/app.js"', Shell::widget(['entry' => 'https://cdn.test/app.js']));
    }

    public function testThemesComponentAddsItsAttributesToThePage(): void
    {
        Yii::$app->set('themes', new class {
            public function prepare(object $view, ?object $identity = null): string
            {
                return 'data-theme="test"';
            }
        });

        self::assertStringContainsString('<html lang="en-US" data-theme="test">', Shell::widget(['entry' => '@web/js/app.js']));
    }

    public function testEntryIsRequired(): void
    {
        $this->expectException(InvalidConfigException::class);
        Shell::widget([]);
    }
}
