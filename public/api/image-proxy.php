<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

$url = trim((string) ($_GET['url'] ?? ''));
if ($url === '') {
    http_response_code(400);
    echo 'Missing url';
    exit;
}

if (!preg_match('/^https?:\/\//i', $url)) {
    http_response_code(400);
    echo 'Only http/https URLs are allowed';
    exit;
}

if (!isSafeRemoteUrl($url)) {
    http_response_code(400);
    echo 'Blocked URL';
    exit;
}

try {
    [$status, $contentType, $body] = fetchRemoteBinary($url);
    if ($status < 200 || $status >= 300) {
        http_response_code(404);
        echo 'Image not found';
        exit;
    }

    $type = normalizeImageContentType($contentType, $body);
    if ($type === null) {
        http_response_code(415);
        echo 'Unsupported image type';
        exit;
    }

    header('Content-Type: ' . $type);
    header('Cache-Control: public, max-age=3600');
    echo $body;
} catch (Throwable $e) {
    http_response_code(502);
    echo 'Image proxy failed';
}

function fetchRemoteBinary(string $url): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_USERAGENT => 'CB-ImageProxy/1.0',
            CURLOPT_HTTPHEADER => ['Accept: image/*'],
        ]);

        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            throw new RuntimeException($error !== '' ? $error : 'cURL download failed');
        }

        return [$status, $contentType, $body];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 20,
            'header' => "Accept: image/*\r\nUser-Agent: CB-ImageProxy/1.0\r\n",
            'ignore_errors' => true,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    if ($body === false) {
        throw new RuntimeException('Download failed');
    }

    $status = 200;
    $contentType = '';
    $headers = $http_response_header ?? [];
    foreach ($headers as $headerLine) {
        if (preg_match('/^HTTP\/[0-9.]+\s+(\d{3})/i', $headerLine, $m) === 1) {
            $status = (int) $m[1];
        }
        if (stripos($headerLine, 'Content-Type:') === 0) {
            $contentType = trim(substr($headerLine, 13));
        }
    }

    return [$status, $contentType, $body];
}

function normalizeImageContentType(string $contentType, string $body): ?string
{
    $type = strtolower(trim(explode(';', $contentType)[0] ?? ''));
    if (in_array($type, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
        return $type;
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detected = strtolower((string) $finfo->buffer($body));
    if (in_array($detected, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
        return $detected;
    }

    return null;
}

function isSafeRemoteUrl(string $url): bool
{
    $parts = parse_url($url);
    if (!is_array($parts)) {
        return false;
    }

    $host = strtolower((string) ($parts['host'] ?? ''));
    if ($host === '' || $host === 'localhost') {
        return false;
    }

    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return !isPrivateIp($host);
    }

    $resolved = gethostbyname($host);
    if ($resolved === $host) {
        return true;
    }

    return !isPrivateIp($resolved);
}

function isPrivateIp(string $ip): bool
{
    if ($ip === '127.0.0.1' || $ip === '::1') {
        return true;
    }

    $long = ip2long($ip);
    if ($long === false) {
        return true;
    }

    $ranges = [
        ['10.0.0.0', '10.255.255.255'],
        ['172.16.0.0', '172.31.255.255'],
        ['192.168.0.0', '192.168.255.255'],
        ['127.0.0.0', '127.255.255.255'],
        ['169.254.0.0', '169.254.255.255'],
    ];

    foreach ($ranges as [$start, $end]) {
        $s = ip2long($start);
        $e = ip2long($end);
        if ($s !== false && $e !== false && $long >= $s && $long <= $e) {
            return true;
        }
    }

    return false;
}
