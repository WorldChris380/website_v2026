<?php
header('Content-Type: application/json; charset=utf-8');

// CORS – restrict to own domain only
$_allowedOrigins = ['https://www.christian-boehme.com', 'https://christian-boehme.com'];
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($_origin, $_allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $_origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
header('Access-Control-Allow-Credentials: true');

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
    $adminToken = firstNonEmpty(getenv('GALLERY_ADMIN_TOKEN') ?: null, '');
    if ($adminToken === '') {
        throw new RuntimeException('GALLERY_ADMIN_TOKEN is not configured on server.');
    }

    $requestToken = trim((string) ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ''));
    if ($requestToken === '' || !hash_equals($adminToken, $requestToken)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
        exit;
    }

    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        throw new RuntimeException('Invalid JSON payload.');
    }

    $id = isset($payload['id']) ? (int) $payload['id'] : 0;
    if ($id <= 0) {
        throw new RuntimeException('Missing or invalid image id.');
    }

    $title = nullableTrim($payload['title'] ?? null);
    $titleDe = nullableTrim($payload['title_de'] ?? null);
    $description = nullableTrim($payload['description'] ?? null);
    $descriptionDe = nullableTrim($payload['description_de'] ?? null);
    $keywords = normalizeKeywords($payload['keywords'] ?? null);
    $keywordsDe = normalizeKeywords($payload['keywords_de'] ?? null);

    $db = getMysqli();

    $sql = <<<'SQL'
UPDATE images
SET
    title = COALESCE(?, title),
    title_de = ?,
    description = ?,
    description_de = ?,
    keywords = ?,
    keywords_de = ?,
    metadata_dirty = 1,
    metadata_sync_error = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
SQL;

    $stmt = $db->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare update query: ' . $db->error);
    }

    $stmt->bind_param(
        'ssssssi',
        $title,
        $titleDe,
        $description,
        $descriptionDe,
        $keywords,
        $keywordsDe,
        $id
    );

    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    echo json_encode([
        'ok' => true,
        'updated' => $affected >= 0,
        'image_id' => $id,
        'metadata_dirty' => 1
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Failed to update metadata',
        'details' => $e->getMessage()
    ]);
}

function normalizeKeywords($value): ?string
{
    if ($value === null) {
        return null;
    }

    if (is_array($value)) {
        $items = [];
        foreach ($value as $item) {
            $item = trim((string) $item);
            if ($item !== '') {
                $items[] = $item;
            }
        }
        return count($items) > 0 ? implode(',', array_unique($items)) : null;
    }

    $raw = trim((string) $value);
    if ($raw === '') {
        return null;
    }

    $parts = array_filter(array_map('trim', explode(',', $raw)), static fn($v) => $v !== '');
    return count($parts) > 0 ? implode(',', array_unique($parts)) : null;
}

function nullableTrim($value): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function getMysqli(): mysqli
{
    if (!extension_loaded('mysqli')) {
        throw new RuntimeException('PHP extension "mysqli" is not loaded.');
    }

    $secretPath = __DIR__ . '/../../secrets/gallery-db.local.php';
    $config = [];

    if (file_exists($secretPath)) {
        $config = require $secretPath;
    }

    $host = firstNonEmpty($config['host'] ?? null, getenv('GALLERY_DB_HOST') ?: null, 'localhost');
    $port = (int) firstNonEmpty(isset($config['port']) ? (string) $config['port'] : null, getenv('GALLERY_DB_PORT') ?: null, '3306');
    $database = firstNonEmpty($config['database'] ?? null, getenv('GALLERY_DB_NAME') ?: null, '');
    $user = firstNonEmpty($config['username'] ?? null, getenv('GALLERY_DB_USER') ?: null, '');
    $pass = firstNonEmpty($config['password'] ?? null, getenv('GALLERY_DB_PASS') ?: null, '');
    $charset = firstNonEmpty($config['charset'] ?? null, getenv('GALLERY_DB_CHARSET') ?: null, 'utf8mb4');

    if ($database === '' || $user === '') {
        throw new RuntimeException('Database config missing.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli($host, $user, $pass, $database, $port);
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
