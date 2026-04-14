<?php

function getPayPalConfig(bool $requireWebhookId = false): array
{
    $config = [];

    $candidateSecretPaths = [
        __DIR__ . '/../../secrets/paypal.local.php',
        __DIR__ . '/../secrets/paypal.local.php',
        __DIR__ . '/paypal.local.php',
    ];

    $documentRoot = trim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($documentRoot !== '') {
        $candidateSecretPaths[] = rtrim($documentRoot, '/\\') . DIRECTORY_SEPARATOR . 'secrets' . DIRECTORY_SEPARATOR . 'paypal.local.php';
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

    $mode = firstNonEmpty(
        isset($config['mode']) ? (string) $config['mode'] : null,
        getenv('PAYPAL_MODE') ?: null,
        'live'
    );
    $clientId = firstNonEmpty(
        $config['client_id'] ?? null,
        getenv('PAYPAL_CLIENT_ID') ?: null,
        ''
    );
    $clientSecret = firstNonEmpty(
        $config['client_secret'] ?? null,
        getenv('PAYPAL_CLIENT_SECRET') ?: null,
        ''
    );
    $webhookId = firstNonEmpty(
        $config['webhook_id'] ?? null,
        getenv('PAYPAL_WEBHOOK_ID') ?: null,
        ''
    );

    if ($clientId === '' || $clientSecret === '') {
        throw new RuntimeException('PayPal credentials are not configured on the server.');
    }

    if ($requireWebhookId && $webhookId === '') {
        throw new RuntimeException('PayPal webhook ID is not configured on the server.');
    }

    $baseUrl = strtolower($mode) === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';

    return [
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'base_url' => $baseUrl,
        'webhook_id' => $webhookId,
    ];
}

function fetchAccessToken(array $config): string
{
    $url = $config['base_url'] . '/v1/oauth2/token';
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Could not initialize cURL for PayPal auth.');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_USERPWD => $config['client_id'] . ':' . $config['client_secret'],
        CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Accept-Language: en_US'],
    ]);

    $raw = curl_exec($ch);
    if ($raw === false) {
        $message = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('PayPal auth request failed: ' . $message);
    }

    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($raw, true);
    if ($status < 200 || $status >= 300 || !is_array($decoded) || empty($decoded['access_token'])) {
        throw new RuntimeException('PayPal auth failed.');
    }

    return (string) $decoded['access_token'];
}

function paypalRequest(array $config, string $path, string $method, $body, string $accessToken): array
{
    $url = $config['base_url'] . $path;
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Could not initialize cURL for PayPal request.');
    }

    $payload = json_encode($body, JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        throw new RuntimeException('Could not encode PayPal request payload.');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'Accept: application/json',
            'PayPal-Request-Id: cb-' . bin2hex(random_bytes(12)),
        ],
    ]);

    $raw = curl_exec($ch);
    if ($raw === false) {
        $message = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('PayPal request failed: ' . $message);
    }

    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($raw, true);
    if ($status < 200 || $status >= 300 || !is_array($decoded)) {
        throw new RuntimeException('PayPal API request failed.');
    }

    return $decoded;
}

function verifyPayPalWebhookSignature(array $config, array $headers, array $event): bool
{
    $token = fetchAccessToken($config);

    $response = paypalRequest(
        $config,
        '/v1/notifications/verify-webhook-signature',
        'POST',
        [
            'transmission_id' => $headers['transmission_id'],
            'transmission_time' => $headers['transmission_time'],
            'cert_url' => $headers['cert_url'],
            'auth_algo' => $headers['auth_algo'],
            'transmission_sig' => $headers['transmission_sig'],
            'webhook_id' => $config['webhook_id'],
            'webhook_event' => $event,
        ],
        $token
    );

    return (($response['verification_status'] ?? '') === 'SUCCESS');
}

function readPayPalWebhookHeaders(): array
{
    return [
        'transmission_id' => trim((string) ($_SERVER['HTTP_PAYPAL_TRANSMISSION_ID'] ?? '')),
        'transmission_time' => trim((string) ($_SERVER['HTTP_PAYPAL_TRANSMISSION_TIME'] ?? '')),
        'transmission_sig' => trim((string) ($_SERVER['HTTP_PAYPAL_TRANSMISSION_SIG'] ?? '')),
        'cert_url' => trim((string) ($_SERVER['HTTP_PAYPAL_CERT_URL'] ?? '')),
        'auth_algo' => trim((string) ($_SERVER['HTTP_PAYPAL_AUTH_ALGO'] ?? '')),
    ];
}

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
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
