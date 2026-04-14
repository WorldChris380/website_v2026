<?php

declare(strict_types=1);

$limit = max(1, (int) (getenv('METADATA_SYNC_LIMIT') ?: 100));
$dbOnlyMode = strtolower((string) (getenv('METADATA_SYNC_MODE') ?: 'db-only')) !== 'image';

$db = getMysqli();

$selectSql = 'SELECT id, path_original, title, title_de, description, description_de, keywords, keywords_de FROM images WHERE metadata_dirty = 1 ORDER BY updated_at ASC LIMIT ?';
$selectStmt = $db->prepare($selectSql);
if (!$selectStmt) {
    throw new RuntimeException('Failed to prepare sync-select query: ' . $db->error);
}
$selectStmt->bind_param('i', $limit);
$selectStmt->execute();
$result = $selectStmt->get_result();
$rows = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
$selectStmt->close();

$success = 0;
$failed = 0;

$markSuccessStmt = $db->prepare('UPDATE images SET metadata_dirty = 0, metadata_synced_at = CURRENT_TIMESTAMP, metadata_sync_error = NULL WHERE id = ?');
$markFailStmt = $db->prepare('UPDATE images SET metadata_sync_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

if (!$markSuccessStmt || !$markFailStmt) {
    throw new RuntimeException('Failed to prepare status update statements.');
}

foreach ($rows as $row) {
    $id = (int) ($row['id'] ?? 0);
    if ($id <= 0) {
        continue;
    }

    try {
        if ($dbOnlyMode) {
            // DB-only mode: acknowledges change queue without writing back to image files.
            $markSuccessStmt->bind_param('i', $id);
            $markSuccessStmt->execute();
            $success++;
            continue;
        }

        // Image mode placeholder: implement ExifTool/XMP write-back in your environment.
        throw new RuntimeException('Image metadata write-back is not configured. Set METADATA_SYNC_MODE=db-only or implement writer.');
    } catch (Throwable $e) {
        $message = mb_substr($e->getMessage(), 0, 4000);
        $markFailStmt->bind_param('si', $message, $id);
        $markFailStmt->execute();
        $failed++;
    }
}

$markSuccessStmt->close();
$markFailStmt->close();

echo json_encode([
    'ok' => true,
    'mode' => $dbOnlyMode ? 'db-only' : 'image',
    'processed' => count($rows),
    'success' => $success,
    'failed' => $failed
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

function getMysqli(): mysqli
{
    if (!extension_loaded('mysqli')) {
        throw new RuntimeException('PHP extension "mysqli" is not loaded.');
    }

    $secretPath = __DIR__ . '/../secrets/gallery-db.local.php';
    $config = [];
    if (file_exists($secretPath)) {
        $config = require $secretPath;
    }

    $host = firstNonEmpty($config['host'] ?? null, getenv('GALLERY_DB_HOST') ?: null, 'localhost');
    $port = (int) firstNonEmpty(isset($config['port']) ? (string) $config['port'] : null, getenv('GALLERY_DB_PORT') ?: null, '3306');
    $database = firstNonEmpty($config['database'] ?? null, getenv('GALLERY_DB_NAME') ?: null, '');
    $username = firstNonEmpty($config['username'] ?? null, getenv('GALLERY_DB_USER') ?: null, '');
    $password = firstNonEmpty($config['password'] ?? null, getenv('GALLERY_DB_PASS') ?: null, '');
    $charset = firstNonEmpty($config['charset'] ?? null, getenv('GALLERY_DB_CHARSET') ?: null, 'utf8mb4');

    if ($database === '' || $username === '') {
        throw new RuntimeException('Database config missing.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli($host, $username, $password, $database, $port);
    $db->set_charset($charset);
    return $db;
}

function firstNonEmpty(?string ...$values): string
{
    foreach ($values as $value) {
        if ($value !== null && trim($value) !== '') {
            return trim($value);
        }
    }
    return '';
}
