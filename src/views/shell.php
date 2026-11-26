<?php

declare(strict_types=1);

use yii\helpers\Html;
use yii\helpers\Json;

/**
 * @var yii\web\View $this
 * @var string $attributes theme attributes for <html>
 * @var array<string, string> $imports
 * @var string $entry
 */

/** @var rapttor\glass\Shell $shell */
$shell = $this->context;
$this->beginPage();
?>
<!DOCTYPE html>
<html lang="<?= Html::encode(Yii::$app->language) ?>"<?= $attributes === '' ? '' : ' ' . $attributes ?>>
<head>
    <meta charset="<?= Html::encode(Yii::$app->charset) ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <?= Html::csrfMetaTags() ?>
    <title><?= Html::encode($shell->title !== '' ? $shell->title : Yii::$app->name) ?></title>
<?php if ($shell->manifest !== null): ?>
    <link rel="manifest" href="<?= Html::encode((string) Yii::getAlias($shell->manifest)) ?>">
<?php endif ?>
<?php if ($shell->touchIcon !== null): ?>
    <link rel="apple-touch-icon" href="<?= Html::encode((string) Yii::getAlias($shell->touchIcon)) ?>">
<?php endif ?>
    <?= Html::script(Json::htmlEncode(['imports' => $imports]), array_filter(['type' => 'importmap', 'nonce' => $shell->nonce])) ?>

    <?php $this->head() ?>
</head>
<body class="v4 v5">
<?php $this->beginBody() ?>
<div class="v4__bg" aria-hidden="true"></div>
<div class="v4__veil" aria-hidden="true"></div>
<div id="app"></div>
<noscript><p style="padding:2rem">This app needs JavaScript.</p></noscript>
<script type="application/json" id="glass-config"><?= Json::htmlEncode((object) $shell->config) ?></script>
<?= Html::script('', ['type' => 'module', 'src' => $entry]) ?>

<?php $this->endBody() ?>
</body>
</html>
<?php $this->endPage();
