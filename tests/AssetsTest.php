<?php

declare(strict_types=1);

namespace rapttor\glass\tests;

use PHPUnit\Framework\TestCase;

/** The published files must be complete on their own: they are also copied into apps that have no PHP. */
final class AssetsTest extends TestCase
{
    private const ASSETS = __DIR__ . '/../assets';

    public function testEveryLocalImportAndVendorFileExists(): void
    {
        $checked = 0;
        foreach (glob(self::ASSETS . '/js/glass/*.js') as $file) {
            $source = file_get_contents($file);
            preg_match_all('~(?:from\s+|import\(\s*)[\'"](\.{1,2}/[^\'"]+)[\'"]~', $source, $m);
            foreach ($m[1] as $spec) {
                self::assertFileExists(dirname($file) . '/' . $spec, basename($file));
                $checked++;
            }
            preg_match_all('~(?:loadScript|loadStyle|vendorUrl)\(\s*[\'"]([^\'"]+)[\'"]~', $source, $m);
            foreach ($m[1] as $spec) {
                self::assertFileExists(self::ASSETS . '/js/vendor/ext/' . $spec, basename($file));
                $checked++;
            }
        }
        self::assertGreaterThan(20, $checked);
        self::assertFileExists(self::ASSETS . '/img/room.svg');
    }

    public function testNothingPointsAtTheDemoOrAtOtherServers(): void
    {
        $css = file_get_contents(self::ASSETS . '/css/glass.css');
        self::assertStringContainsString('.k-split', $css);
        self::assertDoesNotMatchRegularExpression('~url\(\s*[\'"]?(https?:)?//~', $css);
        self::assertStringNotContainsString('@import', $css);
        foreach (glob(self::ASSETS . '/js/glass/*.js') as $file) {
            $source = file_get_contents($file);
            self::assertDoesNotMatchRegularExpression('~interfacetest|[\'"]/(images|site|docs|js)/~', $source, basename($file));
        }
    }

    public function testEveryVendorLibraryKeepsItsLicence(): void
    {
        self::assertFileExists(self::ASSETS . '/js/vendor/vue.LICENSE');
        foreach (glob(self::ASSETS . '/js/vendor/ext/*', GLOB_ONLYDIR) as $dir) {
            self::assertNotEmpty(preg_grep('~licen[sc]e~i', array_map('basename', glob("$dir/*"))), basename($dir));
        }
    }
}
