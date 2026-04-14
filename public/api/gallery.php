<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $db = getMysqli();

    $category = getQueryString('category', 'All');
    $continent = getQueryString('continent', 'All');
    $country = getQueryString('country', 'All');
    $search = getQueryString('search', '');

    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 30)));
    $offset = ($page - 1) * $perPage;

    $where = ['is_active = 1'];
    $params = [];
    $types = '';

    if ($category !== '' && strcasecmp($category, 'All') !== 0) {
        $where[] = 'category = ?';
        $params[] = $category;
        $types .= 's';
    }

    if ($continent !== '' && strcasecmp($continent, 'All') !== 0) {
        $where[] = 'continent = ?';
        $params[] = $continent;
        $types .= 's';
    }

    if ($country !== '' && strcasecmp($country, 'All') !== 0) {
        $where[] = 'country = ?';
        $params[] = $country;
        $types .= 's';
    }

    if ($search !== '') {
        $where[] = '(title LIKE ? OR title_de LIKE ? OR country LIKE ? OR continent LIKE ? OR category LIKE ? OR description LIKE ? OR description_de LIKE ?)';
        $searchLike = '%' . $search . '%';
        $params[] = $searchLike;
        $params[] = $searchLike;
        $params[] = $searchLike;
        $params[] = $searchLike;
        $params[] = $searchLike;
        $params[] = $searchLike;
        $params[] = $searchLike;
        $types .= 'sssssss';
    }

    $whereSql = implode(' AND ', $where);

    $countSql = 'SELECT COUNT(*) FROM images WHERE ' . $whereSql;
    $countStmt = $db->prepare($countSql);
    if (!$countStmt) {
        throw new RuntimeException('Failed to prepare count query: ' . $db->error);
    }
    bindParams($countStmt, $types, $params);
    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $countRow = $countResult ? $countResult->fetch_row() : null;
    $total = (int) ($countRow[0] ?? 0);
    $countStmt->close();

    $itemsSql = 'SELECT id, category, continent, country, price_eur, title, title_de, description, description_de, path_original, path_grid, path_thumbnail FROM images WHERE '
        . $whereSql
        . ' ORDER BY category, continent, country, title LIMIT ? OFFSET ?';

    $itemsStmt = $db->prepare($itemsSql);
    if (!$itemsStmt) {
        throw new RuntimeException('Failed to prepare items query: ' . $db->error);
    }

    $itemsParams = $params;
    $itemsParams[] = $perPage;
    $itemsParams[] = $offset;
    $itemsTypes = $types . 'ii';

    bindParams($itemsStmt, $itemsTypes, $itemsParams);
    $itemsStmt->execute();
    $itemsResult = $itemsStmt->get_result();
    $items = $itemsResult ? $itemsResult->fetch_all(MYSQLI_ASSOC) : [];
    $itemsStmt->close();

    $categories = fetchDistinct($db, 'category');
    $continents = fetchDistinct($db, 'continent');
    $countries = fetchDistinct($db, 'country');

    echo json_encode([
        'ok' => true,
        'paging' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int) ceil($total / max(1, $perPage))
        ],
        'filters' => [
            'categories' => $categories,
            'continents' => $continents,
            'countries' => $countries
        ],
        'items' => $items
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Gallery API failed',
        'details' => $e->getMessage()
    ]);
}

function getQueryString(string $key, string $default): string
{
    if (!isset($_GET[$key])) {
        return $default;
    }

    $value = trim((string) $_GET[$key]);
    return $value === '' ? $default : $value;
}

function fetchDistinct(mysqli $db, string $column): array
{
    $allowed = ['category', 'continent', 'country'];
    if (!in_array($column, $allowed, true)) {
        return [];
    }

    $sql = 'SELECT DISTINCT ' . $column . ' AS value FROM images WHERE is_active = 1 ORDER BY ' . $column;
    $result = $db->query($sql);
    if (!$result) {
        return [];
    }

    $values = [];
    while ($row = $result->fetch_assoc()) {
        $values[] = (string) ($row['value'] ?? '');
    }
    $result->free();

    return array_values(array_filter($values, static fn($value) => $value !== ''));
}

function getMysqli(): mysqli
{
    if (!extension_loaded('mysqli')) {
        throw new RuntimeException(
            'PHP extension "mysqli" is not loaded. Enable mysqli in your PHP runtime.'
        );
    }

    $config = [];

    $candidateSecretPaths = [
        __DIR__ . '/../../secrets/gallery-db.local.php',
        __DIR__ . '/../secrets/gallery-db.local.php',
        __DIR__ . '/gallery-db.local.php'
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

    $host_name = firstNonEmpty($config['host'] ?? null, getenv('GALLERY_DB_HOST') ?: null, 'db5020224670.hosting-data.io');
    $port = (int) firstNonEmpty(isset($config['port']) ? (string) $config['port'] : null, getenv('GALLERY_DB_PORT') ?: null, '3306');
    $database = firstNonEmpty($config['database'] ?? null, getenv('GALLERY_DB_NAME') ?: null, 'dbs15552605');
    $user_name = firstNonEmpty($config['username'] ?? null, getenv('GALLERY_DB_USER') ?: null, 'dbu595115');
    $password = firstNonEmpty(
        $config['password'] ?? null,
        getenv('GALLERY_DB_PASS') ?: null,
        getenv('GALLERY_DB_PASSWORD') ?: null,
        getenv('DB_PASSWORD') ?: null,
        ''
    );
    $charset = firstNonEmpty($config['charset'] ?? null, getenv('GALLERY_DB_CHARSET') ?: null, 'utf8mb4');

    if ($database === '' || $user_name === '') {
        throw new RuntimeException('Database config missing. Set secrets/gallery-db.local.php or environment variables.');
    }

    if ($password === '') {
        throw new RuntimeException('Database password missing. Set secrets/gallery-db.local.php (password) or env var GALLERY_DB_PASS.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli($host_name, $user_name, $password, $database, $port);

    if ($db->connect_error) {
        throw new RuntimeException('Verbindung zum MySQL Server fehlgeschlagen: ' . $db->connect_error);
    }

    $db->set_charset($charset);

    return $db;
}

function bindParams(mysqli_stmt $stmt, string $types, array $values): void
{
    if ($types === '' || count($values) === 0) {
        return;
    }

    $refs = [];
    $refs[] = $types;
    foreach ($values as $index => $value) {
        $refs[] = &$values[$index];
    }

    call_user_func_array([$stmt, 'bind_param'], $refs);
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
