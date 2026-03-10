<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================
// PASSWORT KONFIGURATION
// ============================================
define('ADMIN_PASSWORD', 'aev8gf38&763.;wg3534');
define('TOKEN_SECRET', 'your_secret_key_change_this_' . md5(ADMIN_PASSWORD));
define('TOKEN_EXPIRY', 24 * 60 * 60); // 24 Stunden

// ============================================
// API ENDPOINTS
// ============================================

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $_GET['action'] ?? '';

    if ($action === 'login') {
        handleLogin($input);
    } elseif ($action === 'validate') {
        handleValidate($input);
    } else {
        sendError('Invalid action', 400);
    }
} else {
    sendError('Method not allowed', 405);
}

// ============================================
// FUNKTIONEN
// ============================================

function handleLogin($input)
{
    $password = $input['password'] ?? '';

    if (empty($password)) {
        sendError('Password required', 400);
        return;
    }

    if ($password === ADMIN_PASSWORD) {
        $token = generateToken();
        sendSuccess([
            'token' => $token,
            'expiresIn' => TOKEN_EXPIRY
        ]);
    } else {
        sendError('Invalid password', 401);
    }
}

function handleValidate($input)
{
    $token = $input['token'] ?? '';

    if (empty($token)) {
        sendError('Token required', 400);
        return;
    }

    if (verifyToken($token)) {
        sendSuccess(['valid' => true]);
    } else {
        sendError('Invalid token', 401);
    }
}

function generateToken()
{
    $payload = [
        'iat' => time(),
        'exp' => time() + TOKEN_EXPIRY,
        'admin' => true
    ];

    $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode($payload));
    $signature = base64_encode(hash_hmac('sha256', "$header.$payload", TOKEN_SECRET, true));

    return "$header.$payload.$signature";
}

function verifyToken($token)
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }

    list($header, $payload, $signature) = $parts;

    // Verify signature
    $expectedSignature = base64_encode(hash_hmac('sha256', "$header.$payload", TOKEN_SECRET, true));
    if ($signature !== $expectedSignature) {
        return false;
    }

    // Decode payload
    $decodedPayload = json_decode(base64_decode($payload), true);

    // Check expiry
    if ($decodedPayload['exp'] < time()) {
        return false;
    }

    return true;
}

function sendSuccess($data)
{
    http_response_code(200);
    echo json_encode(['success' => true, 'data' => $data]);
    exit();
}

function sendError($message, $code = 400)
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit();
}
?>