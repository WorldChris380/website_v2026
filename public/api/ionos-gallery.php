<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$secretPath = __DIR__ . '/../../secrets/ionos.local.php';
$config = [];
if (file_exists($secretPath)) {
    $config = require $secretPath;
}

$accessKey = firstNonEmpty(
    isset($config['access_key']) ? (string) $config['access_key'] : null,
    getenv('IONOS_ACCESS_KEY') !== false ? (string) getenv('IONOS_ACCESS_KEY') : null,
    ''
);
$secretKey = firstNonEmpty(
    isset($config['secret_key']) ? (string) $config['secret_key'] : null,
    getenv('IONOS_SECRET_KEY') !== false ? (string) getenv('IONOS_SECRET_KEY') : null,
    ''
);
$bucket = firstNonEmpty(
    isset($config['bucket']) ? (string) $config['bucket'] : null,
    getenv('IONOS_BUCKET') !== false ? (string) getenv('IONOS_BUCKET') : null,
    'christian-boehme-gallery'
);
$region = firstNonEmpty(
    isset($config['region']) ? (string) $config['region'] : null,
    getenv('IONOS_REGION') !== false ? (string) getenv('IONOS_REGION') : null,
    'eu-central-3'
);
$service = 's3';
$host = trim((string) ($config['host'] ?? ($bucket . '.s3.' . $region . '.ionoscloud.com')));
$maxKeys = (int) ($config['max_keys'] ?? 1000);
$maxKeys = max(1, min(1000, $maxKeys));
$useSignedAuth = ($accessKey !== '' && $secretKey !== '');

if ($bucket === '') {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'IONOS bucket is not configured.'
    ]);
    exit;
}

$imagePattern = '/\.(jpg|jpeg|png|webp|avif)$/i';
$allKeys = [];
$continuationToken = null;

while (true) {
    $queryParams = [
        'list-type' => '2',
        'max-keys' => (string) $maxKeys
    ];

    if ($continuationToken !== null && $continuationToken !== '') {
        $queryParams['continuation-token'] = $continuationToken;
    }

    $url = 'https://' . $host . '/?' . buildHttpQuery($queryParams);
    $headers = [
        'Host: ' . $host,
        'Accept: application/xml',
        'User-Agent: website-2026-ionos-gallery'
    ];

    if ($useSignedAuth) {
        $timestamp = gmdate('Ymd\THis\Z');
        $dateStamp = gmdate('Ymd');
        $canonicalQuery = buildCanonicalQuery($queryParams);
        $canonicalUri = '/';
        $payloadHash = 'UNSIGNED-PAYLOAD';

        $canonicalHeaders =
            'host:' . $host . "\n" .
            'x-amz-content-sha256:' . $payloadHash . "\n" .
            'x-amz-date:' . $timestamp . "\n";
        $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

        $canonicalRequest =
            "GET\n" .
            $canonicalUri . "\n" .
            $canonicalQuery . "\n" .
            $canonicalHeaders . "\n" .
            $signedHeaders . "\n" .
            $payloadHash;

        $credentialScope = $dateStamp . '/' . $region . '/' . $service . '/aws4_request';
        $stringToSign =
            'AWS4-HMAC-SHA256' . "\n" .
            $timestamp . "\n" .
            $credentialScope . "\n" .
            hash('sha256', $canonicalRequest);

        $signingKey = getSigningKey($secretKey, $dateStamp, $region, $service);
        $signature = hash_hmac('sha256', $stringToSign, $signingKey);

        $authorization =
            'AWS4-HMAC-SHA256 ' .
            'Credential=' . $accessKey . '/' . $credentialScope . ', ' .
            'SignedHeaders=' . $signedHeaders . ', ' .
            'Signature=' . $signature;

        $headers[] = 'x-amz-content-sha256: ' . $payloadHash;
        $headers[] = 'x-amz-date: ' . $timestamp;
        $headers[] = 'Authorization: ' . $authorization;
    }

    [$response, $httpCode, $curlError] = doHttpGet($url, $headers);

    if ($response === false || $httpCode >= 400) {
        http_response_code($httpCode > 0 ? $httpCode : 502);
        echo json_encode([
            'ok' => false,
            'error' => $curlError !== '' ? $curlError : 'IONOS S3 ListObjects request failed.',
            'httpCode' => $httpCode
        ]);
        exit;
    }

    $xml = @simplexml_load_string($response);
    if ($xml === false) {
        http_response_code(502);
        echo json_encode([
            'ok' => false,
            'error' => 'Invalid XML response from IONOS S3.'
        ]);
        exit;
    }

    $keyNodes = $xml->xpath('//*[local-name()="Contents"]/*[local-name()="Key"]');
    if (is_array($keyNodes)) {
        foreach ($keyNodes as $keyNode) {
            $key = trim((string) $keyNode);
            if ($key !== '' && !endsWithSlash($key) && preg_match($imagePattern, $key)) {
                $allKeys[] = $key;
            }
        }
    }

    $isTruncatedNodes = $xml->xpath('//*[local-name()="IsTruncated"]');
    $isTruncated = is_array($isTruncatedNodes) && count($isTruncatedNodes) > 0
        ? strtolower(trim((string) $isTruncatedNodes[0])) === 'true'
        : false;

    $nextTokenNodes = $xml->xpath('//*[local-name()="NextContinuationToken"]');
    $continuationToken = is_array($nextTokenNodes) && count($nextTokenNodes) > 0
        ? trim((string) $nextTokenNodes[0])
        : null;

    if (!$isTruncated || $continuationToken === null || $continuationToken === '') {
        break;
    }
}

$bucketUrl = 'https://' . $host;

http_response_code(200);
echo json_encode([
    'ok' => true,
    'bucketUrl' => $bucketUrl,
    'count' => count($allKeys),
    'keys' => $allKeys
]);

function getSigningKey(string $secretKey, string $dateStamp, string $region, string $service): string
{
    $kDate = hash_hmac('sha256', $dateStamp, 'AWS4' . $secretKey, true);
    $kRegion = hash_hmac('sha256', $region, $kDate, true);
    $kService = hash_hmac('sha256', $service, $kRegion, true);
    return hash_hmac('sha256', 'aws4_request', $kService, true);
}

function encodeRfc3986(string $value): string
{
    return str_replace('%7E', '~', rawurlencode($value));
}

function buildCanonicalQuery(array $params): string
{
    ksort($params);
    $pairs = [];
    foreach ($params as $key => $value) {
        $pairs[] = encodeRfc3986((string) $key) . '=' . encodeRfc3986((string) $value);
    }
    return implode('&', $pairs);
}

function buildHttpQuery(array $params): string
{
    ksort($params);
    $pairs = [];
    foreach ($params as $key => $value) {
        $pairs[] = rawurlencode((string) $key) . '=' . rawurlencode((string) $value);
    }
    return implode('&', $pairs);
}

function endsWithSlash(string $value): bool
{
    return substr($value, -1) === '/';
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

function doHttpGet(string $url, array $headers): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        return [$response, $httpCode, $curlError];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 30,
            'header' => implode("\r\n", $headers)
        ]
    ]);

    $response = @file_get_contents($url, false, $context);
    $httpCode = 0;
    $errorMessage = '';

    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $matches)) {
                $httpCode = (int) $matches[1];
                break;
            }
        }
    }

    if ($response === false) {
        $errorMessage = 'HTTP request failed.';
    }

    return [$response, $httpCode, $errorMessage];
}
