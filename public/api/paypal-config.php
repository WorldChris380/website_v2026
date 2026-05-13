<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_paypal.php';

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

header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'error' => 'Method not allowed',
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $config = getPayPalConfig();
    $baseUrl = (string) ($config['base_url'] ?? '');
    $mode = strpos($baseUrl, 'sandbox') !== false ? 'sandbox' : 'live';

    echo json_encode([
        'ok' => true,
        'clientId' => (string) ($config['client_id'] ?? ''),
        'mode' => $mode,
    ], JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'PayPal config failed',
        'details' => $e->getMessage(),
    ], JSON_UNESCAPED_SLASHES);
}
