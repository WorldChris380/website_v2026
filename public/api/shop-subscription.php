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

    $action = trim((string) ($payload['action'] ?? 'status'));
    $token = trim((string) ($payload['token'] ?? ''));
    if ($token === '') {
        respond(401, ['success' => false, 'error' => 'Token is required.']);
    }

    $db = getShopMysqli();
    ensureSubscriptionTables($db);

    $claims = verifyUserToken(getShopAuthTokenSecret(), $token);
    if ($claims === null) {
        respond(401, ['success' => false, 'error' => 'Invalid or expired token.']);
    }

    $userId = (int) ($claims['sub'] ?? 0);
    if ($userId <= 0) {
        respond(401, ['success' => false, 'error' => 'Invalid token subject.']);
    }

    if ($action === 'status') {
        $subscription = getActiveSubscription($db, $userId, true);
        respond(200, [
            'success' => true,
            'data' => [
                'subscription' => $subscription,
            ],
        ]);
    }

    if ($action === 'history') {
        respond(200, [
            'success' => true,
            'data' => [
                'history' => getSubscriptionHistory($db, $userId),
            ],
        ]);
    }

    if ($action === 'cancel') {
        $subscription = getActiveSubscription($db, $userId, true, true);
        if (!$subscription || empty($subscription['active'])) {
            respond(404, ['success' => false, 'error' => 'No active subscription found.']);
        }

        // Cancelling stops the plan from being purchasable/renewed again,
        // but the already-paid term keeps running — access and monthly
        // downloads stay available until expires_at, same as before
        // cancelling. Only flips from 'active'; re-cancelling an already
        // 'cancelling' plan is a harmless no-op.
        $subscriptionId = (int) ($subscription['id'] ?? 0);
        $stmt = $db->prepare("UPDATE shop_user_subscriptions SET status = 'cancelling' WHERE id = ? AND status = 'active' LIMIT 1");
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare subscription cancellation: ' . $db->error);
        }
        $stmt->bind_param('i', $subscriptionId);
        $stmt->execute();
        $stmt->close();

        respond(200, [
            'success' => true,
            'data' => [
                'subscription' => getActiveSubscription($db, $userId, false),
            ],
        ]);
    }

    if ($action === 'consume-download') {
        $imageId = (int) ($payload['imageId'] ?? 0);
        if ($imageId <= 0) {
            respond(400, ['success' => false, 'error' => 'imageId is required.']);
        }

        $db->begin_transaction();
        try {
            $subscription = getActiveSubscription($db, $userId, true, true);
            if (!$subscription || empty($subscription['active'])) {
                respond(403, ['success' => false, 'error' => 'No active subscription available.']);
            }

            $remaining = (int) ($subscription['monthlyDownloadsRemaining'] ?? 0);
            if ($remaining <= 0) {
                respond(403, ['success' => false, 'error' => 'Monthly download limit reached.']);
            }

            $download = resolveDownloadForImage($db, $imageId);
            $subscriptionId = (int) ($subscription['id'] ?? 0);
            if ($subscriptionId <= 0) {
                throw new RuntimeException('Subscription record is invalid.');
            }

            $updateStmt = $db->prepare('UPDATE shop_user_subscriptions SET monthly_downloads_used = monthly_downloads_used + 1 WHERE id = ? LIMIT 1');
            if (!$updateStmt) {
                throw new RuntimeException('Failed to update subscription usage: ' . $db->error);
            }
            $updateStmt->bind_param('i', $subscriptionId);
            $updateStmt->execute();
            $updateStmt->close();

            $periodKey = date('Y-m');
            $insertStmt = $db->prepare('INSERT INTO shop_subscription_downloads (subscription_id, user_id, image_id, period_key) VALUES (?, ?, ?, ?)');
            if (!$insertStmt) {
                throw new RuntimeException('Failed to log subscription download: ' . $db->error);
            }
            $insertStmt->bind_param('iiis', $subscriptionId, $userId, $imageId, $periodKey);
            $insertStmt->execute();
            $insertStmt->close();

            $updatedSubscription = getActiveSubscription($db, $userId, false, true);
            $db->commit();

            respond(200, [
                'success' => true,
                'data' => [
                    'downloadUrl' => $download['downloadUrl'],
                    'remainingDownloads' => (int) ($updatedSubscription['monthlyDownloadsRemaining'] ?? 0),
                    'subscription' => $updatedSubscription,
                ],
            ]);
        } catch (Throwable $e) {
            $db->rollback();
            throw $e;
        }
    }

    respond(400, ['success' => false, 'error' => 'Unsupported action.']);
} catch (Throwable $e) {
    respond(500, [
        'success' => false,
        'error' => 'Could not process subscription request.',
        'details' => $e->getMessage(),
    ]);
}

function getActiveSubscription(mysqli $db, int $userId, bool $allowReset, bool $forUpdate = false): ?array
{
    $sql = 'SELECT id, status, plan_code, plan_name, started_at, expires_at, monthly_download_limit, monthly_downloads_used, downloads_reset_at '
        . 'FROM shop_user_subscriptions WHERE user_id = ? AND status IN (\'active\', \'cancelling\') AND expires_at >= NOW() ORDER BY expires_at DESC, id DESC LIMIT 1';
    if ($forUpdate) {
        $sql .= ' FOR UPDATE';
    }

    $stmt = $db->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare subscription lookup: ' . $db->error);
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return null;
    }

    if ($allowReset) {
        $row = maybeResetMonthlyQuota($db, $row);
    }

    $limit = (int) ($row['monthly_download_limit'] ?? 2);
    $used = (int) ($row['monthly_downloads_used'] ?? 0);

    return [
        'id' => (int) ($row['id'] ?? 0),
        'active' => true,
        'status' => (string) ($row['status'] ?? 'active'),
        'planCode' => (string) ($row['plan_code'] ?? ''),
        'planName' => (string) ($row['plan_name'] ?? ''),
        'startedAt' => (string) ($row['started_at'] ?? ''),
        'expiresAt' => (string) ($row['expires_at'] ?? ''),
        'monthlyDownloadLimit' => $limit,
        'monthlyDownloadsUsed' => $used,
        'monthlyDownloadsRemaining' => max(0, $limit - $used),
        'cancelAtPeriodEnd' => (string) ($row['status'] ?? '') === 'cancelling',
    ];
}

function getSubscriptionHistory(mysqli $db, int $userId): array
{
    $stmt = $db->prepare(
        'SELECT id, status, plan_code, plan_name, started_at, expires_at, updated_at, monthly_download_limit, monthly_downloads_used '
        . 'FROM shop_user_subscriptions WHERE user_id = ? ORDER BY started_at DESC, id DESC LIMIT 12'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare subscription history lookup: ' . $db->error);
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $history = [];
    if ($result instanceof mysqli_result) {
        while ($row = $result->fetch_assoc()) {
            $history[] = [
                'id' => (int) ($row['id'] ?? 0),
                'status' => (string) ($row['status'] ?? ''),
                'planCode' => (string) ($row['plan_code'] ?? ''),
                'planName' => (string) ($row['plan_name'] ?? ''),
                'startedAt' => (string) ($row['started_at'] ?? ''),
                'expiresAt' => (string) ($row['expires_at'] ?? ''),
                'updatedAt' => (string) ($row['updated_at'] ?? ''),
                'monthlyDownloadLimit' => (int) ($row['monthly_download_limit'] ?? 0),
                'monthlyDownloadsUsed' => (int) ($row['monthly_downloads_used'] ?? 0),
            ];
        }
        $result->free();
    }

    $stmt->close();
    return $history;
}

function maybeResetMonthlyQuota(mysqli $db, array $row): array
{
    $resetAt = trim((string) ($row['downloads_reset_at'] ?? ''));
    $currentPeriod = date('Y-m');
    $resetPeriod = '';
    if ($resetAt !== '') {
        $timestamp = strtotime($resetAt);
        if ($timestamp !== false) {
            $resetPeriod = date('Y-m', $timestamp);
        }
    }

    if ($resetPeriod === $currentPeriod) {
        return $row;
    }

    $subscriptionId = (int) ($row['id'] ?? 0);
    $stmt = $db->prepare('UPDATE shop_user_subscriptions SET monthly_downloads_used = 0, downloads_reset_at = CURRENT_TIMESTAMP WHERE id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to reset monthly quota: ' . $db->error);
    }
    $stmt->bind_param('i', $subscriptionId);
    $stmt->execute();
    $stmt->close();

    $row['monthly_downloads_used'] = 0;
    $row['downloads_reset_at'] = date('Y-m-d H:i:s');
    return $row;
}

function resolveDownloadForImage(mysqli $db, int $imageId): array
{
    $stmt = $db->prepare('SELECT id, path_original, path_grid, path_thumbnail FROM images WHERE is_active = 1 AND id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare image lookup: ' . $db->error);
    }
    $stmt->bind_param('i', $imageId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        throw new RuntimeException('Image not found.');
    }

    $path = trim((string) ($row['path_original'] ?? ''));
    if ($path === '') {
        $path = trim((string) ($row['path_grid'] ?? ''));
    }
    if ($path === '') {
        $path = trim((string) ($row['path_thumbnail'] ?? ''));
    }
    if ($path === '') {
        throw new RuntimeException('Image path is not available.');
    }

    return [
        'downloadUrl' => buildAbsoluteImageUrl($path),
    ];
}

function buildAbsoluteImageUrl(string $path): string
{
    if (preg_match('/^https?:\/\//i', $path) === 1) {
        return $path;
    }

    $bucketUrl = firstNonEmpty(
        getenv('GALLERY_BUCKET_URL') ?: null,
        'https://christian-boehme-gallery.s3.eu-central-3.ionoscloud.com'
    );

    return rtrim($bucketUrl, '/') . '/' . ltrim($path, '/');
}

function ensureSubscriptionTables(mysqli $db): void
{
    try {
        $probe = $db->query('SELECT 1 FROM shop_user_subscriptions LIMIT 1');
        if ($probe !== false) {
            if ($probe instanceof mysqli_result) {
                $probe->free();
            }
            return;
        }
    } catch (Throwable $ignored) {
        // Continue to CREATE TABLE.
    }

    $db->query(<<<'SQL'
CREATE TABLE IF NOT EXISTS shop_user_subscriptions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    shop_order_id INT UNSIGNED NOT NULL,
    plan_code VARCHAR(40) NOT NULL,
    plan_name VARCHAR(120) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    paypal_order_id VARCHAR(64) NOT NULL DEFAULT '',
    paypal_capture_id VARCHAR(64) NOT NULL DEFAULT '',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    monthly_download_limit SMALLINT UNSIGNED NOT NULL DEFAULT 2,
    monthly_downloads_used SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    downloads_reset_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_status (user_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);

    $db->query(<<<'SQL'
CREATE TABLE IF NOT EXISTS shop_subscription_downloads (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    subscription_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    image_id INT UNSIGNED NOT NULL,
    downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period_key CHAR(7) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_subscription_period (subscription_id, period_key),
    KEY idx_user_downloads (user_id, downloaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
}

function getShopAuthTokenSecret(): string
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

    $secret = firstNonEmpty(
        $config['token_secret'] ?? null,
        $config['secret'] ?? null,
        $config['jwt_secret'] ?? null,
        $config['auth_secret'] ?? null,
        getenv('SHOP_AUTH_TOKEN_SECRET') ?: null,
        getenv('SHOP_AUTH_SECRET') ?: null,
        getenv('APP_AUTH_TOKEN_SECRET') ?: null,
        ''
    );
    if ($secret === '') {
        throw new RuntimeException('Shop auth token secret is not configured.');
    }

    return $secret;
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
        $trimmed = trim((string) $value);
        if ($trimmed !== '') {
            return $trimmed;
        }
    }

    return '';
}

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data)
{
    $padding = strlen($data) % 4;
    if ($padding > 0) {
        $data .= str_repeat('=', 4 - $padding);
    }

    return base64_decode(strtr($data, '-_', '+/'), true);
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
