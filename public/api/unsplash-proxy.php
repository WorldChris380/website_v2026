<?php
header('Content-Type: application/json; charset=utf-8');

$secretPath = __DIR__ . '/../../secrets/unsplash.local.php';
if (!file_exists($secretPath)) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Missing local Unsplash secret file.'
    ]);
    exit;
}

$config = require $secretPath;
$accessKey = $config['access_key'] ?? '';
$apiUrl = rtrim($config['api_url'] ?? 'https://api.unsplash.com', '/');

if ($accessKey === '' || $accessKey === 'UNSPLASH_ACCESS_KEY_PLACEHOLDER') {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Unsplash access key is not configured.'
    ]);
    exit;
}

$query = isset($_GET['query']) ? trim((string) $_GET['query']) : '';
$page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
$perPage = isset($_GET['per_page']) ? max(1, min(30, (int) $_GET['per_page'])) : 6;

if ($query === '') {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => 'Missing query parameter.'
    ]);
    exit;
}

$endpoint = sprintf(
    '%s/search/photos?query=%s&page=%d&per_page=%d&orientation=landscape',
    $apiUrl,
    rawurlencode($query),
    $page,
    $perPage
);

$headers = [
    'Accept: application/json',
    'Authorization: Client-ID ' . $accessKey,
    'User-Agent: website-2026-unsplash-proxy'
];

$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode >= 400) {
    http_response_code($httpCode > 0 ? $httpCode : 502);
    echo json_encode([
        'ok' => false,
        'error' => $curlError !== '' ? $curlError : 'Unsplash request failed.'
    ]);
    exit;
}

echo $response;
