<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_paypal.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

try {
    $rawBody = (string) file_get_contents('php://input');
    $event = json_decode($rawBody, true);
    if (!is_array($event)) {
        throw new RuntimeException('Invalid JSON payload.');
    }

    $headers = readPayPalWebhookHeaders();
    foreach ($headers as $key => $value) {
        if ($value === '') {
            throw new RuntimeException('Missing PayPal webhook header: ' . $key);
        }
    }

    $config = getPayPalConfig(true);
    $isValid = verifyPayPalWebhookSignature($config, $headers, $event);
    if (!$isValid) {
        respond(400, [
            'ok' => false,
            'error' => 'Invalid PayPal webhook signature',
        ]);
    }

    $eventType = trim((string) ($event['event_type'] ?? ''));
    $resourceId = trim((string) ($event['resource']['id'] ?? ''));

    respond(200, [
        'ok' => true,
        'verified' => true,
        'eventType' => $eventType,
        'resourceId' => $resourceId,
    ]);
} catch (Throwable $e) {
    respond(500, [
        'ok' => false,
        'error' => 'PayPal webhook processing failed',
        'details' => $e->getMessage(),
    ]);
}
