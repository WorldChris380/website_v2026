<?php
header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'https://www.christian-boehme.com',
    'https://christian-boehme.com',
    'http://localhost:4200',
    'http://127.0.0.1:4200',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'error' => 'Method not allowed']);
}

try {
    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        throw new RuntimeException('Invalid JSON payload.');
    }

    $action = trim((string) ($payload['action'] ?? 'list'));
    $db = getShopMysqli();
    ensureReviewsTable($db);

    if ($action === 'list') {
        $productId = normalizeProductId($payload['productId'] ?? '');
        if ($productId === '') {
            respond(400, ['success' => false, 'error' => 'productId is required.']);
        }

        respond(200, [
            'success' => true,
            'data' => [
                'reviews' => listReviews($db, $productId),
            ],
        ]);
    }

    if ($action === 'create') {
        $token = trim((string) ($payload['token'] ?? ''));
        if ($token === '') {
            respond(401, ['success' => false, 'error' => 'Token is required.']);
        }

        $authConfig = getShopAuthConfig();
        $claims = verifyUserToken($authConfig['token_secret'], $token);
        if ($claims === null) {
            respond(401, ['success' => false, 'error' => 'Invalid or expired token.']);
        }

        $userId = (int) ($claims['sub'] ?? 0);
        if ($userId <= 0) {
            respond(401, ['success' => false, 'error' => 'Invalid token subject.']);
        }

        $productId = normalizeProductId($payload['productId'] ?? '');
        if ($productId === '') {
            respond(400, ['success' => false, 'error' => 'productId is required.']);
        }

        $rating = (int) ($payload['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) {
            respond(400, ['success' => false, 'error' => 'Rating must be between 1 and 5.']);
        }

        $reviewText = trim((string) ($payload['reviewText'] ?? ''));
        if (mb_strlen($reviewText) < 10) {
            respond(400, ['success' => false, 'error' => 'Review must be at least 10 characters long.']);
        }
        if (mb_strlen($reviewText) > 1200) {
            respond(400, ['success' => false, 'error' => 'Review is too long.']);
        }

        if (!hasVerifiedPurchase($db, $userId, $productId)) {
            respond(403, ['success' => false, 'error' => 'Only verified buyers can leave a review for this image.']);
        }

        $displayName = resolveDisplayName($db, $userId, (string) ($claims['displayName'] ?? ''));

        $stmt = $db->prepare(
            'INSERT INTO shop_verified_reviews (user_id, product_id, rating, review_text, display_name, verified_purchase) '
            . 'VALUES (?, ?, ?, ?, ?, 1) '
            . 'ON DUPLICATE KEY UPDATE rating = VALUES(rating), review_text = VALUES(review_text), display_name = VALUES(display_name), updated_at = CURRENT_TIMESTAMP, verified_purchase = 1'
        );
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare review insert: ' . $db->error);
        }

        $stmt->bind_param('isiss', $userId, $productId, $rating, $reviewText, $displayName);
        $stmt->execute();
        $stmt->close();

        respond(200, [
            'success' => true,
            'data' => [
                'message' => 'Review saved.',
            ],
        ]);
    }

    respond(400, ['success' => false, 'error' => 'Unsupported action.']);
} catch (Throwable $e) {
    respond(500, [
        'success' => false,
        'error' => 'Could not process reviews.',
        'details' => $e->getMessage(),
    ]);
}

function listReviews(mysqli $db, string $productId): array
{
    $stmt = $db->prepare(
        'SELECT rating, review_text, display_name, created_at '
        . 'FROM shop_verified_reviews '
        . 'WHERE product_id = ? AND verified_purchase = 1 '
        . 'ORDER BY created_at DESC '
        . 'LIMIT 50'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare reviews query: ' . $db->error);
    }

    $stmt->bind_param('s', $productId);
    $stmt->execute();
    $result = $stmt->get_result();

    $reviews = [];
    while ($row = $result ? $result->fetch_assoc() : null) {
        $reviews[] = [
            'rating' => (int) ($row['rating'] ?? 0),
            'reviewText' => (string) ($row['review_text'] ?? ''),
            'displayName' => (string) ($row['display_name'] ?? 'Verified buyer'),
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'verifiedPurchase' => true,
        ];
    }

    $stmt->close();
    return $reviews;
}

function hasVerifiedPurchase(mysqli $db, int $userId, string $productId): bool
{
    $stmt = $db->prepare(
        'SELECT 1 '
        . 'FROM shop_orders o '
        . 'INNER JOIN shop_order_items i ON i.shop_order_id = o.id '
        . 'WHERE o.user_id = ? AND i.product_id = ? '
        . 'LIMIT 1'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare purchase verification query: ' . $db->error);
    }

    $stmt->bind_param('is', $userId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $match = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    return $match !== null;
}

function resolveDisplayName(mysqli $db, int $userId, string $fallback): string
{
    $stmt = $db->prepare('SELECT display_name, first_name, last_name, email FROM users WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return $fallback !== '' ? $fallback : 'Verified buyer';
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return $fallback !== '' ? $fallback : 'Verified buyer';
    }

    $displayName = trim((string) ($row['display_name'] ?? ''));
    if ($displayName !== '') {
        return $displayName;
    }

    $firstName = trim((string) ($row['first_name'] ?? ''));
    $lastName = trim((string) ($row['last_name'] ?? ''));
    $full = trim($firstName . ' ' . $lastName);
    if ($full !== '') {
        return $full;
    }

    $email = trim((string) ($row['email'] ?? ''));
    if ($email !== '') {
        $parts = explode('@', $email);
        return trim((string) ($parts[0] ?? '')) ?: 'Verified buyer';
    }

    return $fallback !== '' ? $fallback : 'Verified buyer';
}

function normalizeProductId($value): string
{
    $id = trim((string) $value);
    if ($id === '') {
        return '';
    }

    if (mb_strlen($id) > 64) {
        return '';
    }

    return preg_match('/^[A-Za-z0-9_-]+$/', $id) ? $id : '';
}

function ensureReviewsTable(mysqli $db): void
{
    // If the table already exists, avoid CREATE TABLE to work with restricted DB users.
    try {
        $probe = $db->query('SELECT 1 FROM shop_verified_reviews LIMIT 1');
        if ($probe !== false) {
            if ($probe instanceof mysqli_result) {
                $probe->free();
            }
            return;
        }
    } catch (Throwable $ignored) {
        // Table may not exist yet; continue to CREATE TABLE.
    }

    $sql = <<<'SQL'
CREATE TABLE IF NOT EXISTS shop_verified_reviews (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    review_text TEXT NOT NULL,
    display_name VARCHAR(190) NOT NULL DEFAULT '',
    verified_purchase TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_user_product (user_id, product_id),
    KEY idx_product_created (product_id, created_at),
    KEY idx_verified_product (product_id, verified_purchase, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL;

    try {
        $db->query($sql);
    } catch (Throwable $e) {
        throw new RuntimeException('Reviews table is missing and could not be created. Please create table shop_verified_reviews or grant CREATE permission.');
    }
}

function getShopAuthConfig(): array
{
    $config = [];
    $candidateSecretPaths = [
        __DIR__ . '/../../secrets/shop-auth.local.php',
        __DIR__ . '/../../../secrets/shop-auth.local.php',
        __DIR__ . '/../../../../secrets/shop-auth.local.php',
        __DIR__ . '/../secrets/shop-auth.local.php',
        __DIR__ . '/shop-auth.local.php',
    ];

    $documentRoot = isset($_SERVER['DOCUMENT_ROOT']) ? rtrim((string) $_SERVER['DOCUMENT_ROOT'], DIRECTORY_SEPARATOR) : '';
    if ($documentRoot !== '') {
        $candidateSecretPaths[] = $documentRoot . '/secrets/shop-auth.local.php';
        $candidateSecretPaths[] = dirname($documentRoot) . '/secrets/shop-auth.local.php';
    }

    foreach ($candidateSecretPaths as $secretPath) {
        if (file_exists($secretPath)) {
            $loaded = require $secretPath;
            if (is_array($loaded)) {
                $config = $loaded;
                break;
            }
        }
    }

    $tokenSecret = firstNonEmpty(
        $config['token_secret'] ?? null,
        $config['secret'] ?? null,
        $config['jwt_secret'] ?? null,
        $config['auth_secret'] ?? null,
        getenv('SHOP_AUTH_TOKEN_SECRET') ?: null,
        getenv('SHOP_AUTH_SECRET') ?: null,
        getenv('APP_AUTH_TOKEN_SECRET') ?: null,
        ''
    );
    if ($tokenSecret === '') {
        throw new RuntimeException('Shop auth token secret is not configured.');
    }

    return ['token_secret' => $tokenSecret];
}

function verifyUserToken(string $secret, string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$header, $payload, $signature] = $parts;
    $expectedSignature = base64UrlEncode(hash_hmac('sha256', $header . '.' . $payload, $secret, true));
    if (!hash_equals($expectedSignature, $signature)) {
        return null;
    }

    $payloadJson = base64UrlDecode($payload);
    if ($payloadJson === false) {
        return null;
    }

    $decoded = json_decode($payloadJson, true);
    if (!is_array($decoded)) {
        return null;
    }

    if ((int) ($decoded['exp'] ?? 0) < time()) {
        return null;
    }

    return $decoded;
}

function getShopMysqli(): mysqli
{
    if (!extension_loaded('mysqli')) {
        throw new RuntimeException('PHP extension "mysqli" is not loaded.');
    }

    $config = [];
    $candidateSecretPaths = [
        __DIR__ . '/../../secrets/gallery-db.local.php',
        __DIR__ . '/../secrets/gallery-db.local.php',
        __DIR__ . '/gallery-db.local.php',
    ];

    $documentRoot = isset($_SERVER['DOCUMENT_ROOT']) ? rtrim((string) $_SERVER['DOCUMENT_ROOT'], DIRECTORY_SEPARATOR) : '';
    if ($documentRoot !== '') {
        $candidateSecretPaths[] = $documentRoot . '/secrets/gallery-db.local.php';
    }

    foreach ($candidateSecretPaths as $secretPath) {
        if (file_exists($secretPath)) {
            $loaded = require $secretPath;
            if (is_array($loaded)) {
                $config = $loaded;
                break;
            }
        }
    }

    $host = firstNonEmpty($config['host'] ?? null, getenv('GALLERY_DB_HOST') ?: null, 'db5020224670.hosting-data.io');
    $port = (int) firstNonEmpty(isset($config['port']) ? (string) $config['port'] : null, getenv('GALLERY_DB_PORT') ?: null, '3306');
    $database = firstNonEmpty($config['database'] ?? null, getenv('GALLERY_DB_NAME') ?: null, 'dbs15552605');
    $user = firstNonEmpty($config['username'] ?? null, getenv('GALLERY_DB_USER') ?: null, 'dbu595115');
    $password = firstNonEmpty($config['password'] ?? null, getenv('GALLERY_DB_PASS') ?: null, getenv('GALLERY_DB_PASSWORD') ?: null, getenv('DB_PASSWORD') ?: null, '');
    $charset = firstNonEmpty($config['charset'] ?? null, getenv('GALLERY_DB_CHARSET') ?: null, 'utf8mb4');

    if ($database === '' || $user === '' || $password === '') {
        throw new RuntimeException('Database config missing.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli($host, $user, $password, $database, $port);
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

function base64UrlEncode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64UrlDecode(string $value)
{
    $remainder = strlen($value) % 4;
    if ($remainder > 0) {
        $value .= str_repeat('=', 4 - $remainder);
    }

    return base64_decode(strtr($value, '-_', '+/'), true);
}

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}
