<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    validateSyncKey();

    $body = file_get_contents('php://input');
    if ($body === false || trim($body) === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Empty request body']);
        exit;
    }

    $images = json_decode($body, true);
    if (!is_array($images) || count($images) === 0) {
        echo json_encode(['ok' => true, 'upserted' => 0, 'message' => 'No images in payload']);
        exit;
    }

    $db = getMysqli();

    $upsertSql = <<<'SQL'
        INSERT INTO images (
            category, continent, country,
            title, title_de, description, description_de,
            path_original, path_grid, path_thumbnail,
            is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            category       = VALUES(category),
            continent      = VALUES(continent),
            country        = VALUES(country),
            title          = COALESCE(NULLIF(images.title, ''),          VALUES(title)),
            title_de       = COALESCE(NULLIF(images.title_de, ''),       VALUES(title_de)),
            description    = COALESCE(NULLIF(images.description, ''),    VALUES(description)),
            description_de = COALESCE(NULLIF(images.description_de, ''), VALUES(description_de)),
            path_original  = VALUES(path_original),
            path_thumbnail = VALUES(path_thumbnail),
            is_active      = 1,
            updated_at     = CURRENT_TIMESTAMP
    SQL;

    $stmt = $db->prepare($upsertSql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare upsert: ' . $db->error);
    }

    $upserted = 0;
    foreach ($images as $img) {
        $category      = (string) ($img['category']      ?? '');
        $continent     = (string) ($img['continent']     ?? '');
        $country       = (string) ($img['country']       ?? '');
        $title         = (string) ($img['title']         ?? '');
        $titleDe       = isset($img['title_de'])       ? (string) $img['title_de']       : null;
        $description   = isset($img['description'])    ? (string) $img['description']    : null;
        $descriptionDe = isset($img['description_de']) ? (string) $img['description_de'] : null;
        $pathOriginal  = (string) ($img['path_original']  ?? '');
        $pathGrid      = (string) ($img['path_grid']      ?? '');
        $pathThumbnail = (string) ($img['path_thumbnail'] ?? '');

        if ($pathGrid === '') {
            continue;
        }

        $stmt->bind_param(
            'ssssssssss',
            $category, $continent, $country,
            $title, $titleDe, $description, $descriptionDe,
            $pathOriginal, $pathGrid, $pathThumbnail
        );
        $stmt->execute();
        $upserted++;
    }

    $stmt->close();
    $db->close();

    echo json_encode(['ok' => true, 'upserted' => $upserted]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

function validateSyncKey(): void
{
    $provided = trim((string) ($_SERVER['HTTP_X_SYNC_KEY'] ?? ''));
    if ($provided === '') {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Missing X-Sync-Key header']);
        exit;
    }

    $expected = loadSyncKey();
    if (!hash_equals($expected, $provided)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid sync key']);
        exit;
    }
}

function loadSyncKey(): string
{
    $candidates = [
        __DIR__ . '/../../secrets/gallery-sync-key.local.php',
        __DIR__ . '/../secrets/gallery-sync-key.local.php',
    ];

    foreach ($candidates as $path) {
        if (file_exists($path)) {
            $config = require $path;
            $key = trim((string) ($config['key'] ?? ''));
            if ($key !== '' && $key !== 'REPLACE_WITH_YOUR_GENERATED_KEY') {
                return $key;
            }
        }
    }

    throw new RuntimeException('Sync key not configured on server. Set secrets/gallery-sync-key.local.php.');
}

function getMysqli(): mysqli
{
    $config = [];

    $candidateSecretPaths = [
        __DIR__ . '/../../secrets/gallery-db.local.php',
        __DIR__ . '/../secrets/gallery-db.local.php',
        __DIR__ . '/gallery-db.local.php',
    ];

    foreach ($candidateSecretPaths as $secretPath) {
        if (file_exists($secretPath)) {
            $loaded = require $secretPath;
            if (is_array($loaded)) {
                $config = $loaded;
                break;
            }
        }
    }

    $host     = firstNonEmpty($config['host']     ?? null, getenv('GALLERY_DB_HOST')    ?: null, 'db5020224670.hosting-data.io');
    $port     = (int) firstNonEmpty(isset($config['port']) ? (string) $config['port'] : null, getenv('GALLERY_DB_PORT') ?: null, '3306');
    $database = firstNonEmpty($config['database'] ?? null, getenv('GALLERY_DB_NAME')    ?: null, 'dbs15552605');
    $username = firstNonEmpty($config['username'] ?? null, getenv('GALLERY_DB_USER')    ?: null, 'dbu595115');
    $password = firstNonEmpty($config['password'] ?? null, getenv('GALLERY_DB_PASS')    ?: null, '');
    $charset  = firstNonEmpty($config['charset']  ?? null, getenv('GALLERY_DB_CHARSET') ?: null, 'utf8mb4');

    if ($password === '') {
        throw new RuntimeException('Database password missing.');
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
