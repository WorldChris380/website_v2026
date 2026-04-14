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

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    respond(200, [
        'success' => true,
        'service' => 'shop-auth',
        'status' => 'ok',
        'allowedActions' => ['register', 'login', 'forgot-password', 'reset-password', 'google-login', 'validate'],
        'note' => 'Use POST with JSON body containing action.',
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'error' => 'Method not allowed']);
}

try {
    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        throw new RuntimeException('Invalid JSON payload.');
    }

    $action = trim((string) ($payload['action'] ?? 'register'));
    $db = getMysqli();

    if ($action === 'register') {
        $email = trim((string) ($payload['email'] ?? ''));
        $emailNormalized = mb_strtolower($email);
        $password = (string) ($payload['password'] ?? '');
        $firstName = normalizeNullableText($payload['firstName'] ?? null, 120);
        $lastName = normalizeNullableText($payload['lastName'] ?? null, 120);
        $displayName = buildDisplayName($firstName, $lastName);

        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            respond(400, ['success' => false, 'error' => 'Please enter a valid email address.']);
        }

        if (mb_strlen($password) < 8) {
            respond(400, ['success' => false, 'error' => 'Password must be at least 8 characters long.']);
        }

        $existsStmt = $db->prepare('SELECT id FROM users WHERE email_normalized = ? LIMIT 1');
        if (!$existsStmt) {
            throw new RuntimeException('Failed to prepare user lookup: ' . $db->error);
        }

        $existsStmt->bind_param('s', $emailNormalized);
        $existsStmt->execute();
        $existingResult = $existsStmt->get_result();
        $existingUser = $existingResult ? $existingResult->fetch_assoc() : null;
        $existsStmt->close();

        if ($existingUser) {
            respond(409, ['success' => false, 'error' => 'An account with this email address already exists.']);
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if ($passwordHash === false) {
            throw new RuntimeException('Failed to hash password.');
        }

        $role = 'customer';
        $status = 'active';

        $insertSql = <<<'SQL'
INSERT INTO users (
    email,
    email_normalized,
    password_hash,
    first_name,
    last_name,
    display_name,
    role,
    status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
SQL;

        $insertStmt = $db->prepare($insertSql);
        if (!$insertStmt) {
            throw new RuntimeException('Failed to prepare user insert: ' . $db->error);
        }

        $insertStmt->bind_param(
            'ssssssss',
            $email,
            $emailNormalized,
            $passwordHash,
            $firstName,
            $lastName,
            $displayName,
            $role,
            $status
        );
        $insertStmt->execute();
        $userId = (int) $insertStmt->insert_id;
        $insertStmt->close();

        respond(201, [
            'success' => true,
            'data' => [
                'userId' => $userId,
                'email' => $email,
                'displayName' => $displayName,
                'status' => $status,
            ],
        ]);
    }

    if ($action === 'login') {
        $authConfig = getShopAuthConfig();
        $email = trim((string) ($payload['email'] ?? ''));
        $emailNormalized = mb_strtolower($email);
        $password = (string) ($payload['password'] ?? '');

        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            respond(400, ['success' => false, 'error' => 'Please enter a valid email address.']);
        }

        if ($password === '') {
            respond(400, ['success' => false, 'error' => 'Password is required.']);
        }

        $user = findUserByEmail($db, $emailNormalized);
        if (!$user || !password_verify($password, (string) ($user['password_hash'] ?? ''))) {
            respond(401, ['success' => false, 'error' => 'Invalid email address or password.']);
        }

        $status = (string) ($user['status'] ?? 'pending');
        if ($status !== 'active') {
            respond(403, ['success' => false, 'error' => 'This account is not active.']);
        }

        $token = generateUserToken($authConfig['token_secret'], [
            'sub' => (int) ($user['id'] ?? 0),
            'email' => (string) ($user['email'] ?? ''),
            'displayName' => (string) ($user['display_name'] ?? ''),
            'role' => (string) ($user['role'] ?? 'customer'),
            'status' => $status,
        ]);

        $updateStmt = $db->prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?');
        if ($updateStmt) {
            $userId = (int) ($user['id'] ?? 0);
            $updateStmt->bind_param('i', $userId);
            $updateStmt->execute();
            $updateStmt->close();
        }

        respond(200, [
            'success' => true,
            'data' => [
                'token' => $token,
                'expiresIn' => 60 * 60 * 24 * 7,
                'user' => sanitizeUserRow($user),
            ],
        ]);
    }

    if ($action === 'google-login') {
        if (!isGoogleLoginEnabled()) {
            respond(403, [
                'success' => false,
                'error' => 'Google Sign-In is temporarily disabled by admin.',
            ]);
        }

        $authConfig = getShopAuthConfig();
        $googleClientId = trim((string) ($authConfig['google_client_id'] ?? ''));
        if ($googleClientId === '') {
            respond(503, [
                'success' => false,
                'error' => 'Google Sign-In is not configured.',
                'details' => 'Set google_client_id in shop-auth secret or SHOP_GOOGLE_CLIENT_ID environment variable.'
            ]);
        }

        $idToken = trim((string) ($payload['idToken'] ?? ''));
        if ($idToken === '') {
            respond(400, ['success' => false, 'error' => 'Google ID token is required.']);
        }

        try {
            $googleIdentity = verifyGoogleIdToken($idToken, $googleClientId);
        } catch (RuntimeException $verificationError) {
            respond(401, [
                'success' => false,
                'error' => 'Google token verification failed.',
                'details' => $verificationError->getMessage(),
            ]);
        }

        $user = upsertGoogleUser($db, $googleIdentity);

        $status = (string) ($user['status'] ?? 'pending');
        if ($status !== 'active') {
            respond(403, ['success' => false, 'error' => 'This account is not active.']);
        }

        $token = generateUserToken($authConfig['token_secret'], [
            'sub' => (int) ($user['id'] ?? 0),
            'email' => (string) ($user['email'] ?? ''),
            'displayName' => (string) ($user['display_name'] ?? ''),
            'role' => (string) ($user['role'] ?? 'customer'),
            'status' => $status,
        ]);

        $updateStmt = $db->prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?');
        if ($updateStmt) {
            $userId = (int) ($user['id'] ?? 0);
            $updateStmt->bind_param('i', $userId);
            $updateStmt->execute();
            $updateStmt->close();
        }

        respond(200, [
            'success' => true,
            'data' => [
                'token' => $token,
                'expiresIn' => 60 * 60 * 24 * 7,
                'user' => sanitizeUserRow($user),
            ],
        ]);
    }

    if ($action === 'forgot-password') {
        $email = trim((string) ($payload['email'] ?? ''));
        $emailNormalized = mb_strtolower($email);

        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            respond(400, ['success' => false, 'error' => 'Please enter a valid email address.']);
        }

        $user = findUserByEmail($db, $emailNormalized);
        if (!$user || (string) ($user['status'] ?? '') !== 'active') {
            respond(200, [
                'success' => true,
                'data' => [
                    'message' => 'If this email exists, reset instructions have been generated.',
                ],
            ]);
        }

        $resetToken = base64UrlEncode(random_bytes(24));
        $resetTokenHash = password_hash($resetToken, PASSWORD_DEFAULT);
        if ($resetTokenHash === false) {
            throw new RuntimeException('Failed to generate reset token hash.');
        }

        $updateStmt = $db->prepare(
            'UPDATE users SET password_reset_token_hash = ?, password_reset_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE) WHERE id = ? LIMIT 1'
        );
        if (!$updateStmt) {
            throw new RuntimeException('Failed to prepare password reset update: ' . $db->error);
        }

        $userId = (int) ($user['id'] ?? 0);
        $updateStmt->bind_param('si', $resetTokenHash, $userId);
        $updateStmt->execute();
        $updateStmt->close();

        $resetLink = buildPasswordResetLink($email, $resetToken);
        sendPasswordResetEmail($email, $resetLink);

        respond(200, [
            'success' => true,
            'data' => [
                'message' => 'If this email exists, reset instructions have been generated.',
            ],
        ]);
    }

    if ($action === 'reset-password') {
        $email = trim((string) ($payload['email'] ?? ''));
        $emailNormalized = mb_strtolower($email);
        $resetToken = trim((string) ($payload['resetToken'] ?? ''));
        $newPassword = (string) ($payload['newPassword'] ?? '');

        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            respond(400, ['success' => false, 'error' => 'Please enter a valid email address.']);
        }

        if ($resetToken === '') {
            respond(400, ['success' => false, 'error' => 'Reset token is required.']);
        }

        if (mb_strlen($newPassword) < 8) {
            respond(400, ['success' => false, 'error' => 'Password must be at least 8 characters long.']);
        }

        $user = findUserResetDataByEmail($db, $emailNormalized);
        if (!$user) {
            respond(400, ['success' => false, 'error' => 'Invalid reset request.']);
        }

        $storedHash = (string) ($user['password_reset_token_hash'] ?? '');
        $expiresAt = (string) ($user['password_reset_expires_at'] ?? '');
        if ($storedHash === '' || $expiresAt === '') {
            respond(400, ['success' => false, 'error' => 'No active password reset request found.']);
        }

        $expiryTs = strtotime($expiresAt . ' UTC');
        if ($expiryTs === false || $expiryTs < time()) {
            respond(400, ['success' => false, 'error' => 'Reset token expired. Please request a new one.']);
        }

        if (!password_verify($resetToken, $storedHash)) {
            respond(400, ['success' => false, 'error' => 'Invalid reset token.']);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        if ($passwordHash === false) {
            throw new RuntimeException('Failed to hash new password.');
        }

        $updateStmt = $db->prepare(
            'UPDATE users SET password_hash = ?, password_reset_token_hash = NULL, password_reset_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? LIMIT 1'
        );
        if (!$updateStmt) {
            throw new RuntimeException('Failed to prepare password update: ' . $db->error);
        }

        $userId = (int) ($user['id'] ?? 0);
        $updateStmt->bind_param('si', $passwordHash, $userId);
        $updateStmt->execute();
        $updateStmt->close();

        respond(200, [
            'success' => true,
            'data' => [
                'message' => 'Password has been reset successfully.',
            ],
        ]);
    }

    if ($action === 'validate') {
        $authConfig = getShopAuthConfig();
        $token = trim((string) ($payload['token'] ?? ''));
        if ($token === '') {
            respond(400, ['success' => false, 'error' => 'Token is required.']);
        }

        $claims = verifyUserToken($authConfig['token_secret'], $token);
        if ($claims === null) {
            respond(401, ['success' => false, 'error' => 'Invalid or expired token.']);
        }

        $userId = (int) ($claims['sub'] ?? 0);
        if ($userId <= 0) {
            respond(401, ['success' => false, 'error' => 'Invalid token subject.']);
        }

        $user = findUserById($db, $userId);
        if (!$user || (string) ($user['status'] ?? '') !== 'active') {
            respond(401, ['success' => false, 'error' => 'User account is no longer available.']);
        }

        respond(200, [
            'success' => true,
            'data' => [
                'valid' => true,
                'user' => sanitizeUserRow($user),
            ],
        ]);
    }

    throw new RuntimeException('Unsupported action.');
} catch (Throwable $e) {
    respond(500, [
        'success' => false,
        'error' => 'Shop authentication failed.',
        'details' => $e->getMessage(),
    ]);
}

function getShopAuthConfig(): array
{
    $config = loadShopAuthLocalConfig();

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
        throw new RuntimeException('Shop auth token secret is not configured. Set secrets/shop-auth.local.php or env var SHOP_AUTH_TOKEN_SECRET.');
    }

    $googleClientId = firstNonEmpty(
        $config['google_client_id'] ?? null,
        $config['googleClientId'] ?? null,
        getenv('SHOP_GOOGLE_CLIENT_ID') ?: null,
        getenv('GOOGLE_CLIENT_ID') ?: null,
        ''
    );

    return [
        'token_secret' => $tokenSecret,
        'google_client_id' => $googleClientId,
    ];
}

function verifyGoogleIdToken(string $idToken, string $expectedClientId): array
{
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
    $response = fetchJsonFromUrl($url);

    if (!is_array($response)) {
        throw new RuntimeException('Could not verify Google token.');
    }

    $issuer = trim((string) ($response['iss'] ?? ''));
    if ($issuer !== 'accounts.google.com' && $issuer !== 'https://accounts.google.com') {
        throw new RuntimeException('Invalid Google token issuer.');
    }

    $audience = trim((string) ($response['aud'] ?? ''));
    if ($audience === '' || $audience !== $expectedClientId) {
        throw new RuntimeException('Google token audience mismatch.');
    }

    $email = trim((string) ($response['email'] ?? ''));
    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        throw new RuntimeException('Google account email is missing or invalid.');
    }

    $emailVerified = strtolower(trim((string) ($response['email_verified'] ?? '')));
    if (!in_array($emailVerified, ['true', '1'], true)) {
        throw new RuntimeException('Google account email is not verified.');
    }

    return [
        'google_sub' => trim((string) ($response['sub'] ?? '')),
        'email' => $email,
        'first_name' => normalizeNullableText($response['given_name'] ?? null, 120),
        'last_name' => normalizeNullableText($response['family_name'] ?? null, 120),
        'display_name' => normalizeNullableText($response['name'] ?? null, 255),
    ];
}

function upsertGoogleUser(mysqli $db, array $googleIdentity): array
{
    $email = trim((string) ($googleIdentity['email'] ?? ''));
    $emailNormalized = mb_strtolower($email);
    $firstName = normalizeNullableText($googleIdentity['first_name'] ?? null, 120);
    $lastName = normalizeNullableText($googleIdentity['last_name'] ?? null, 120);
    $displayName = normalizeNullableText($googleIdentity['display_name'] ?? null, 255);
    $resolvedDisplayName = $displayName ?: buildDisplayName($firstName, $lastName);

    $user = findUserByEmail($db, $emailNormalized);
    if ($user) {
        $shouldUpdateFirst = ((string) ($user['first_name'] ?? '')) === '' && $firstName !== null;
        $shouldUpdateLast = ((string) ($user['last_name'] ?? '')) === '' && $lastName !== null;
        $shouldUpdateDisplay = ((string) ($user['display_name'] ?? '')) === '' && $resolvedDisplayName !== null;

        if ($shouldUpdateFirst || $shouldUpdateLast || $shouldUpdateDisplay) {
            $updateStmt = $db->prepare(
                'UPDATE users
                 SET first_name = CASE WHEN first_name IS NULL OR first_name = "" THEN ? ELSE first_name END,
                     last_name = CASE WHEN last_name IS NULL OR last_name = "" THEN ? ELSE last_name END,
                     display_name = CASE WHEN display_name IS NULL OR display_name = "" THEN ? ELSE display_name END
                 WHERE id = ? LIMIT 1'
            );
            if ($updateStmt) {
                $userId = (int) ($user['id'] ?? 0);
                $updateStmt->bind_param('sssi', $firstName, $lastName, $resolvedDisplayName, $userId);
                $updateStmt->execute();
                $updateStmt->close();
            }

            $user = findUserByEmail($db, $emailNormalized) ?? $user;
        }

        return $user;
    }

    $passwordHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
    if ($passwordHash === false) {
        throw new RuntimeException('Failed to create account password hash.');
    }

    $role = 'customer';
    $status = 'active';
    $insertStmt = $db->prepare(
        'INSERT INTO users (email, email_normalized, password_hash, first_name, last_name, display_name, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    if (!$insertStmt) {
        throw new RuntimeException('Failed to prepare Google user insert: ' . $db->error);
    }

    $insertStmt->bind_param(
        'ssssssss',
        $email,
        $emailNormalized,
        $passwordHash,
        $firstName,
        $lastName,
        $resolvedDisplayName,
        $role,
        $status
    );
    $insertStmt->execute();
    $insertStmt->close();

    $created = findUserByEmail($db, $emailNormalized);
    if (!$created) {
        throw new RuntimeException('Failed to load created Google user.');
    }

    return $created;
}

function fetchJsonFromUrl(string $url): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
        $body = curl_exec($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($body === false || $statusCode < 200 || $statusCode >= 300) {
            $details = $curlError !== '' ? $curlError : 'HTTP ' . $statusCode;
            throw new RuntimeException('Google token verification failed: ' . $details);
        }

        $decoded = json_decode((string) $body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Google token verification returned invalid JSON.');
        }

        return $decoded;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 15,
            'header' => "Accept: application/json\r\n",
            'ignore_errors' => true,
        ]
    ]);

    $body = @file_get_contents($url, false, $context);
    if ($body === false) {
        throw new RuntimeException('Google token verification request failed.');
    }

    $statusCode = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $headerLine) {
            if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $headerLine, $matches)) {
                $statusCode = (int) $matches[1];
                break;
            }
        }
    }

    if ($statusCode < 200 || $statusCode >= 300) {
        throw new RuntimeException('Google token verification failed: HTTP ' . $statusCode);
    }

    $decoded = json_decode((string) $body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Google token verification returned invalid JSON.');
    }

    return $decoded;
}

function generateUserToken(string $secret, array $claims): string
{
    $header = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = $claims;
    $payload['iat'] = time();
    $payload['exp'] = time() + (60 * 60 * 24 * 7);
    $payloadJson = json_encode($payload);
    if ($payloadJson === false) {
        throw new RuntimeException('Failed to encode auth payload.');
    }

    $body = base64UrlEncode($payloadJson);
    $signature = base64UrlEncode(hash_hmac('sha256', $header . '.' . $body, $secret, true));

    return $header . '.' . $body . '.' . $signature;
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

function sanitizeUserRow(array $user): array
{
    return [
        'id' => (int) ($user['id'] ?? 0),
        'email' => (string) ($user['email'] ?? ''),
        'displayName' => (string) ($user['display_name'] ?? ''),
        'firstName' => (string) ($user['first_name'] ?? ''),
        'lastName' => (string) ($user['last_name'] ?? ''),
        'role' => (string) ($user['role'] ?? 'customer'),
        'status' => (string) ($user['status'] ?? 'pending'),
    ];
}

function findUserByEmail(mysqli $db, string $emailNormalized): ?array
{
    $stmt = $db->prepare('SELECT id, email, password_hash, first_name, last_name, display_name, role, status FROM users WHERE email_normalized = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare user lookup: ' . $db->error);
    }

    $stmt->bind_param('s', $emailNormalized);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    return $user ?: null;
}

function findUserResetDataByEmail(mysqli $db, string $emailNormalized): ?array
{
    $stmt = $db->prepare('SELECT id, status, password_reset_token_hash, password_reset_expires_at FROM users WHERE email_normalized = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare reset user lookup: ' . $db->error);
    }

    $stmt->bind_param('s', $emailNormalized);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    return $user ?: null;
}

function findUserById(mysqli $db, int $userId): ?array
{
    $stmt = $db->prepare('SELECT id, email, first_name, last_name, display_name, role, status FROM users WHERE id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare user fetch by id: ' . $db->error);
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    return $user ?: null;
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

function normalizeNullableText($value, int $maxLength): ?string
{
    if ($value === null) {
        return null;
    }

    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }

    return mb_substr($text, 0, $maxLength);
}

function buildDisplayName(?string $firstName, ?string $lastName): ?string
{
    $parts = array_values(array_filter([$firstName, $lastName], static fn($value): bool => $value !== null && $value !== ''));
    if (count($parts) === 0) {
        return null;
    }

    return implode(' ', $parts);
}

function getMysqli(): mysqli
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
    $password = firstNonEmpty(
        $config['password'] ?? null,
        getenv('GALLERY_DB_PASS') ?: null,
        getenv('GALLERY_DB_PASSWORD') ?: null,
        getenv('DB_PASSWORD') ?: null,
        ''
    );
    $charset = firstNonEmpty($config['charset'] ?? null, getenv('GALLERY_DB_CHARSET') ?: null, 'utf8mb4');

    if ($database === '' || $user === '') {
        throw new RuntimeException('Database config missing.');
    }

    if ($password === '') {
        throw new RuntimeException('Database password missing.');
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

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function isGoogleLoginEnabled(): bool
{
    $stateFile = __DIR__ . '/google_login_state.json';
    if (!file_exists($stateFile)) {
        return true;
    }

    $decoded = json_decode((string) file_get_contents($stateFile), true);
    if (!is_array($decoded)) {
        return true;
    }

    return (bool) ($decoded['enabled'] ?? true);
}

function buildPasswordResetLink(string $email, string $token): string
{
    $mailConfig = getShopMailConfig();
    $baseUrl = firstNonEmpty(
        $mailConfig['public_base_url'],
        'https://www.christian-boehme.com'
    );
    $baseUrl = rtrim($baseUrl, '/');

    return $baseUrl
        . '/shop/account?resetEmail=' . rawurlencode($email)
        . '&resetToken=' . rawurlencode($token);
}

function sendPasswordResetEmail(string $toEmail, string $resetLink): void
{
    $mailConfig = getShopMailConfig();
    $fromEmail = $mailConfig['from_email'];
    $fromName = $mailConfig['from_name'];

    $subject = 'Password reset link / Link zum Zuruecksetzen des Passworts';
    $body = "Hello,\n\n"
        . "you requested a password reset for your christian-boehme.com shop account.\n"
        . "Click this link to set a new password:\n"
        . $resetLink . "\n\n"
        . "This link is valid for 30 minutes.\n\n"
        . "---\n\n"
        . "Hallo,\n\n"
        . "du hast ein Zuruecksetzen des Passworts fuer dein christian-boehme.com Shop-Konto angefordert.\n"
        . "Klicke auf diesen Link, um ein neues Passwort zu setzen:\n"
        . $resetLink . "\n\n"
        . "Der Link ist 30 Minuten gueltig.\n";

    try {
        if ($mailConfig['transport'] === 'smtp') {
            smtpSendMail($mailConfig, $toEmail, $subject, $body);
            return;
        }

        $headers = [
            'From: ' . formatMailbox($fromEmail, $fromName),
            'Reply-To: ' . $fromEmail,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
        ];

        $subjectHeader = function_exists('mb_encode_mimeheader')
            ? mb_encode_mimeheader($subject, 'UTF-8')
            : $subject;

        $sent = @mail($toEmail, $subjectHeader, $body, implode("\r\n", $headers));
        if (!$sent) {
            throw new RuntimeException('PHP mail() returned false.');
        }
    } catch (Throwable $e) {
        logShopAuthMailError('Password reset email failed for ' . $toEmail . ': ' . $e->getMessage());
        throw new RuntimeException('Failed to send password reset email.');
    }
}

function loadShopAuthLocalConfig(): array
{
    static $cachedConfig = null;

    if (is_array($cachedConfig)) {
        return $cachedConfig;
    }

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

    $cachedConfig = $config;

    return $cachedConfig;
}

function getShopMailConfig(): array
{
    $config = loadShopAuthLocalConfig();

    return [
        'public_base_url' => firstNonEmpty(
            $config['public_base_url'] ?? null,
            getenv('SHOP_PUBLIC_BASE_URL') ?: null,
            getenv('APP_BASE_URL') ?: null,
            'https://www.christian-boehme.com'
        ),
        'transport' => strtolower(firstNonEmpty(
            $config['mail_transport'] ?? null,
            getenv('SHOP_AUTH_MAIL_TRANSPORT') ?: null,
            'mail'
        )),
        'from_email' => firstNonEmpty(
            $config['mail_from'] ?? null,
            getenv('SHOP_AUTH_MAIL_FROM') ?: null,
            getenv('MAIL_FROM') ?: null,
            'info@christian-boehme.com'
        ),
        'from_name' => firstNonEmpty(
            $config['mail_from_name'] ?? null,
            getenv('SHOP_AUTH_MAIL_FROM_NAME') ?: null,
            'Christian Boehme Shop'
        ),
        'smtp_host' => firstNonEmpty(
            $config['mail_host'] ?? null,
            getenv('SHOP_AUTH_SMTP_HOST') ?: null,
            getenv('SMTP_HOST') ?: null,
            ''
        ),
        'smtp_port' => (int) firstNonEmpty(
            isset($config['mail_port']) ? (string) $config['mail_port'] : null,
            getenv('SHOP_AUTH_SMTP_PORT') ?: null,
            getenv('SMTP_PORT') ?: null,
            '587'
        ),
        'smtp_encryption' => strtolower(firstNonEmpty(
            $config['mail_encryption'] ?? null,
            getenv('SHOP_AUTH_SMTP_ENCRYPTION') ?: null,
            getenv('SMTP_ENCRYPTION') ?: null,
            'tls'
        )),
        'smtp_username' => firstNonEmpty(
            $config['mail_username'] ?? null,
            getenv('SHOP_AUTH_SMTP_USERNAME') ?: null,
            getenv('SMTP_USERNAME') ?: null,
            ''
        ),
        'smtp_password' => firstNonEmpty(
            $config['mail_password'] ?? null,
            getenv('SHOP_AUTH_SMTP_PASSWORD') ?: null,
            getenv('SMTP_PASSWORD') ?: null,
            ''
        ),
    ];
}

function smtpSendMail(array $mailConfig, string $toEmail, string $subject, string $body): void
{
    $host = $mailConfig['smtp_host'];
    if ($host === '') {
        throw new RuntimeException('SMTP host is missing.');
    }

    $port = max(1, (int) $mailConfig['smtp_port']);
    $encryption = $mailConfig['smtp_encryption'];
    $remote = ($encryption === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;

    $socket = @stream_socket_client($remote, $errno, $errstr, 20, STREAM_CLIENT_CONNECT);
    if (!is_resource($socket)) {
        throw new RuntimeException('SMTP connection failed: ' . $errstr . ' (' . $errno . ')');
    }

    stream_set_timeout($socket, 20);

    try {
        smtpExpect($socket, [220]);
        smtpCommand($socket, 'EHLO christian-boehme.com', [250]);

        if ($encryption === 'tls') {
            smtpCommand($socket, 'STARTTLS', [220]);
            $cryptoEnabled = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($cryptoEnabled !== true) {
                throw new RuntimeException('SMTP STARTTLS negotiation failed.');
            }
            smtpCommand($socket, 'EHLO christian-boehme.com', [250]);
        }

        if ($mailConfig['smtp_username'] !== '' || $mailConfig['smtp_password'] !== '') {
            smtpCommand($socket, 'AUTH LOGIN', [334]);
            smtpCommand($socket, base64_encode($mailConfig['smtp_username']), [334]);
            smtpCommand($socket, base64_encode($mailConfig['smtp_password']), [235]);
        }

        smtpCommand($socket, 'MAIL FROM:<' . $mailConfig['from_email'] . '>', [250]);
        smtpCommand($socket, 'RCPT TO:<' . $toEmail . '>', [250, 251]);
        smtpCommand($socket, 'DATA', [354]);

        $subjectHeader = function_exists('mb_encode_mimeheader')
            ? mb_encode_mimeheader($subject, 'UTF-8')
            : $subject;
        $headers = [
            'Date: ' . gmdate('D, d M Y H:i:s O'),
            'From: ' . formatMailbox($mailConfig['from_email'], $mailConfig['from_name']),
            'To: ' . $toEmail,
            'Subject: ' . $subjectHeader,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];

        $message = implode("\r\n", $headers) . "\r\n\r\n" . normalizeSmtpMessageBody($body) . "\r\n.";
        fwrite($socket, $message . "\r\n");
        smtpExpect($socket, [250]);
        smtpCommand($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

function smtpCommand($socket, string $command, array $expectedCodes): string
{
    fwrite($socket, $command . "\r\n");
    return smtpExpect($socket, $expectedCodes);
}

function smtpExpect($socket, array $expectedCodes): string
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') {
            break;
        }
    }

    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('Unexpected SMTP response: ' . trim($response));
    }

    return $response;
}

function normalizeSmtpMessageBody(string $body): string
{
    $normalized = preg_replace("/\r\n|\r|\n/", "\r\n", $body) ?? $body;
    return preg_replace('/^\./m', '..', $normalized) ?? $normalized;
}

function formatMailbox(string $email, string $name): string
{
    if ($name === '') {
        return $email;
    }

    $encodedName = function_exists('mb_encode_mimeheader')
        ? mb_encode_mimeheader($name, 'UTF-8')
        : $name;

    return sprintf('%s <%s>', $encodedName, $email);
}

function logShopAuthMailError(string $message): void
{
    $logLine = '[' . gmdate('c') . '] ' . $message . PHP_EOL;
    $logPath = __DIR__ . '/../../secrets/shop-auth-mail.log';

    @file_put_contents($logPath, $logLine, FILE_APPEND);
    error_log($message);
}
