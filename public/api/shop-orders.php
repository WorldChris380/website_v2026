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

    $db = getShopMysqli();
    $orders = fetchOrdersForUser($db, $userId);

    respond(200, [
        'success' => true,
        'data' => [
            'orders' => $orders,
        ],
    ]);
} catch (Throwable $e) {
    respond(500, [
        'success' => false,
        'error' => 'Could not load order history.',
        'details' => $e->getMessage(),
    ]);
}

function fetchOrdersForUser(mysqli $db, int $userId): array
{
    $stmt = $db->prepare(
        'SELECT id, owner_name, paypal_order_id, paypal_capture_id, order_status, total_amount, currency, purchased_at, invoice_number, invoice_pdf_url '
        . 'FROM shop_orders WHERE user_id = ? ORDER BY purchased_at DESC, id DESC'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare orders query: ' . $db->error);
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $orders = [];

    while ($row = $result ? $result->fetch_assoc() : null) {
        $orderId = (int) ($row['id'] ?? 0);
        if ($orderId <= 0) {
            continue;
        }

        $orders[] = [
            'id' => $orderId,
            'ownerName' => (string) ($row['owner_name'] ?? ''),
            'paypalOrderId' => (string) ($row['paypal_order_id'] ?? ''),
            'paypalCaptureId' => (string) ($row['paypal_capture_id'] ?? ''),
            'status' => (string) ($row['order_status'] ?? 'completed'),
            'totalAmount' => (float) ($row['total_amount'] ?? 0),
            'currency' => (string) ($row['currency'] ?? 'EUR'),
            'purchasedAt' => (string) ($row['purchased_at'] ?? ''),
            'invoiceNumber' => (string) ($row['invoice_number'] ?? ''),
            'invoicePdfUrl' => (string) ($row['invoice_pdf_url'] ?? ''),
            'items' => fetchOrderItems($db, $orderId),
        ];
    }

    $stmt->close();

    return $orders;
}

function fetchOrderItems(mysqli $db, int $orderId): array
{
    $stmt = $db->prepare(
        'SELECT product_id, product_type, title, image_url, original_image_url, unit_price, quantity, currency '
        . 'FROM shop_order_items WHERE shop_order_id = ? ORDER BY id ASC'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare order items query: ' . $db->error);
    }

    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $result = $stmt->get_result();
    $items = [];
    while ($row = $result ? $result->fetch_assoc() : null) {
        $items[] = [
            'productId' => (string) ($row['product_id'] ?? ''),
            'productType' => (string) ($row['product_type'] ?? 'photo'),
            'title' => (string) ($row['title'] ?? ''),
            'imageUrl' => (string) ($row['image_url'] ?? ''),
            'originalImageUrl' => (string) ($row['original_image_url'] ?? ''),
            'unitPrice' => (float) ($row['unit_price'] ?? 0),
            'quantity' => (int) ($row['quantity'] ?? 1),
            'currency' => (string) ($row['currency'] ?? 'EUR'),
        ];
    }
    $stmt->close();

    return $items;
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
