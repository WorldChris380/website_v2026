<?php

declare(strict_types=1);

$bucketBaseUrl = 'https://christian-boehme-gallery.s3.eu-central-3.ionoscloud.com';
$variantFolder = 'grid';
$imagePattern = '/\.(jpg|jpeg|png|webp|avif)$/i';
$deltaMode = in_array('--delta', $argv ?? [], true);

ensureHttpsSupport();

$secrets  = readSecrets();
$nameMap  = loadNameMapFromBucket($bucketBaseUrl . '/name-map.json');
$relativePaths = fetchVariantRelativePaths($bucketBaseUrl, $variantFolder, $imagePattern);

// Build row objects from S3 listing
$skipped = 0;
$rows = [];
foreach ($relativePaths as $relativePath) {
    $parts = explode('/', $relativePath);
    if (count($parts) < 4) {
        $skipped++;
        continue;
    }

    $category  = humanize($parts[0]);
    $continent = humanize($parts[1]);
    $country   = humanize($parts[2]);

    $fileBase = pathinfo($parts[count($parts) - 1], PATHINFO_FILENAME);
    $title = humanize($fileBase);
    if (isset($nameMap[$relativePath]['originalTitle']) && trim((string) $nameMap[$relativePath]['originalTitle']) !== '') {
        $title = (string) $nameMap[$relativePath]['originalTitle'];
    }

    $rows[] = [
        'category'       => $category,
        'continent'      => $continent,
        'country'        => $country,
        'title'          => $title,
        'title_de'       => null,
        'description'    => null,
        'description_de' => null,
        'path_original'  => 'original/' . $relativePath,
        'path_grid'      => 'grid/'     . $relativePath,
        'path_thumbnail' => 'thumbnail/'. $relativePath,
    ];
}

// Try direct MySQL first; fall back to HTTP if network-blocked
$insertedOrUpdated = 0;
$usedMethod = 'none';

if ($secrets['password'] !== '') {
    try {
        [$insertedOrUpdated, $usedMethod] = syncViaMySQL($secrets, $rows, $deltaMode);
    } catch (RuntimeException $e) {
        $msg = $e->getMessage();
        $isNetwork = str_contains($msg, 'getaddrinfo') || str_contains($msg, 'ENOTFOUND')
                  || str_contains($msg, 'Connection refused') || str_contains($msg, 'timed out');

        if ($isNetwork && $secrets['syncApiUrl'] !== '' && $secrets['syncApiKey'] !== '') {
            echo "MySQL unreachable ({$msg}), falling back to HTTP sync...\n";
        } else {
            throw $e;
        }
    }
}

if ($usedMethod === 'none' && $secrets['syncApiUrl'] !== '' && $secrets['syncApiKey'] !== '') {
    [$insertedOrUpdated, $usedMethod] = syncViaHttp($secrets, $rows);
}

if ($usedMethod === 'none') {
    echo "WARNING: No sync method available. Check secrets/gallery-db.local.json.\n";
}

echo "Import mode:   " . ($deltaMode ? 'delta (new files only)' : 'full') . "\n";
echo "Sync method:   {$usedMethod}\n";
echo "Upserted:      {$insertedOrUpdated}, skipped (bad path): {$skipped}\n";
echo "Image base URL:{$bucketBaseUrl}\n";

function readSecrets(): array
{
    // Prefer JSON file (same as copy-object-storage-images.js)
    $jsonPath = __DIR__ . '/../secrets/gallery-db.local.json';
    $cfg = [];
    if (file_exists($jsonPath)) {
        $decoded = json_decode((string) file_get_contents($jsonPath), true);
        if (is_array($decoded)) {
            $cfg = $decoded;
        }
    }

    // Also accept PHP-format file as fallback
    $phpPath = __DIR__ . '/../secrets/gallery-db.local.php';
    if ($cfg === [] && file_exists($phpPath)) {
        $loaded = require $phpPath;
        if (is_array($loaded)) {
            $cfg = $loaded;
        }
    }

    return [
        'host'       => firstNonEmpty($cfg['host']       ?? null, getenv('GALLERY_DB_HOST')      ?: null, 'db5020224670.hosting-data.io'),
        'port'       => (int) firstNonEmpty(isset($cfg['port']) ? (string) $cfg['port'] : null, getenv('GALLERY_DB_PORT') ?: null, '3306'),
        'database'   => firstNonEmpty($cfg['database']   ?? null, getenv('GALLERY_DB_NAME')      ?: null, 'dbs15552605'),
        'username'   => firstNonEmpty($cfg['username']   ?? null, getenv('GALLERY_DB_USER')      ?: null, 'dbu595115'),
        'password'   => firstNonEmpty($cfg['password']   ?? null, getenv('GALLERY_DB_PASS')      ?: null, ''),
        'charset'    => firstNonEmpty($cfg['charset']    ?? null, getenv('GALLERY_DB_CHARSET')   ?: null, 'utf8mb4'),
        'syncApiUrl' => firstNonEmpty($cfg['syncApiUrl'] ?? null, getenv('GALLERY_SYNC_API_URL') ?: null, ''),
        'syncApiKey' => firstNonEmpty($cfg['syncApiKey'] ?? null, getenv('GALLERY_SYNC_API_KEY') ?: null, ''),
    ];
}

function syncViaMySQL(array $secrets, array $rows, bool $deltaMode): array
{
    if (!extension_loaded('mysqli')) {
        throw new RuntimeException('PHP extension "mysqli" is not loaded.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli($secrets['host'], $secrets['username'], $secrets['password'], $secrets['database'], $secrets['port']);
    $db->set_charset($secrets['charset']);

    if ($deltaMode) {
        $existing = fetchExistingPathGridSet($db);
        $rows = array_values(array_filter($rows, static fn($r) => !isset($existing[$r['path_grid']])));
    }

    if (count($rows) === 0) {
        $db->close();
        return [0, 'MySQL (no new rows)'];
    }

    $upsertSql = <<<'SQL'
        INSERT INTO images (
            category, continent, country,
            title, title_de, description, description_de,
            path_original, path_grid, path_thumbnail, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            category       = VALUES(category),
            continent      = VALUES(continent),
            country        = VALUES(country),
            title          = COALESCE(NULLIF(images.title, ''),          VALUES(title)),
            title_de       = COALESCE(NULLIF(images.title_de, ''),       VALUES(title_de)),
            description    = COALESCE(NULLIF(images.description, ''),    VALUES(description)),
            description_de = COALESCE(NULLIF(images.description_de, ''), VALUES(description_de)),
            path_original  = VALUES(path_original),
            path_thumbnail = VALUES(path_thumbnail),
            is_active      = 1,
            updated_at     = CURRENT_TIMESTAMP
    SQL;

    $stmt = $db->prepare($upsertSql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare upsert: ' . $db->error);
    }

    $count = 0;
    foreach ($rows as $row) {
        $stmt->bind_param(
            'ssssssssss',
            $row['category'], $row['continent'], $row['country'],
            $row['title'], $row['title_de'], $row['description'], $row['description_de'],
            $row['path_original'], $row['path_grid'], $row['path_thumbnail']
        );
        $stmt->execute();
        $count++;
    }

    $stmt->close();
    $db->close();

    return [$count, 'MySQL'];
}

function syncViaHttp(array $secrets, array $rows): array
{
    $body = json_encode($rows, JSON_THROW_ON_ERROR);
    $url  = $secrets['syncApiUrl'];
    $key  = $secrets['syncApiKey'];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST            => true,
        CURLOPT_POSTFIELDS      => $body,
        CURLOPT_RETURNTRANSFER  => true,
        CURLOPT_HTTPHEADER      => [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($body),
            'X-Sync-Key: ' . $key,
        ],
        CURLOPT_TIMEOUT         => 60,
        CURLOPT_SSL_VERIFYPEER  => false, // local script — no system CA bundle needed
        CURLOPT_SSL_VERIFYHOST  => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError !== '') {
        throw new RuntimeException('HTTP sync curl error: ' . $curlError);
    }

    $json = json_decode((string) $response, true);
    if (!is_array($json) || !($json['ok'] ?? false)) {
        $preview = substr((string) $response, 0, 200);
        throw new RuntimeException('HTTP sync failed: ' . ($json['error'] ?? $preview));
    }

    return [(int) ($json['upserted'] ?? count($rows)), 'HTTP'];
}

function loadNameMapFromBucket(string $url): array
{
    try {
        $raw = fetchText($url);
    } catch (Throwable $e) {
        // name-map.json is optional; continue without title mapping when missing.
        return [];
    }

    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['entries']) || !is_array($data['entries'])) {
        return [];
    }

    return $data['entries'];
}

function fetchVariantRelativePaths(string $bucketBaseUrl, string $variantFolder, string $imagePattern): array
{
    $prefix = trim($variantFolder, '/') . '/';
    $token = null;
    $paths = [];

    do {
        $query = [
            'list-type' => '2',
            'max-keys' => '1000',
            'prefix' => $prefix,
        ];

        if ($token !== null && $token !== '') {
            $query['continuation-token'] = $token;
        }

        $url = $bucketBaseUrl . '/?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        $xmlRaw = fetchText($url);
        if ($xmlRaw === false || trim($xmlRaw) === '') {
            throw new RuntimeException('Failed to fetch bucket listing from: ' . $url);
        }

        $xml = @simplexml_load_string($xmlRaw);
        if ($xml === false) {
            throw new RuntimeException('Invalid XML while reading bucket listing.');
        }

        $keyNodes = $xml->xpath('//*[local-name()="Contents"]/*[local-name()="Key"]');
        if (is_array($keyNodes)) {
            foreach ($keyNodes as $keyNode) {
                $fullKey = trim((string) $keyNode);
                if ($fullKey === '' || !str_starts_with($fullKey, $prefix)) {
                    continue;
                }
                if (!preg_match($imagePattern, $fullKey)) {
                    continue;
                }

                $relativePath = substr($fullKey, strlen($prefix));
                if ($relativePath === '' || str_ends_with($relativePath, '/')) {
                    continue;
                }

                $paths[] = toPosixPath($relativePath);
            }
        }

        $isTruncatedNode = $xml->xpath('//*[local-name()="IsTruncated"]');
        $isTruncated = is_array($isTruncatedNode) && count($isTruncatedNode) > 0
            ? strtolower(trim((string) $isTruncatedNode[0])) === 'true'
            : false;

        $nextTokenNode = $xml->xpath('//*[local-name()="NextContinuationToken"]');
        $token = is_array($nextTokenNode) && count($nextTokenNode) > 0
            ? trim((string) $nextTokenNode[0])
            : null;

        if (!$isTruncated) {
            $token = null;
        }
    } while ($token !== null && $token !== '');

    $paths = array_values(array_unique($paths));
    sort($paths);

    return $paths;
}

function fetchExistingPathGridSet(mysqli $db): array
{
    $result = $db->query('SELECT path_grid FROM images');
    if (!$result) {
        throw new RuntimeException('Failed to fetch existing grid paths: ' . $db->error);
    }

    $set = [];
    while ($row = $result->fetch_assoc()) {
        $pathGrid = trim((string) ($row['path_grid'] ?? ''));
        if ($pathGrid !== '') {
            $set[$pathGrid] = true;
        }
    }
    $result->free();

    return $set;
}

function fetchText(string $url)
{
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 30,
            'header' => "Accept: application/json, application/xml\r\nUser-Agent: gallery-db-importer\r\n",
        ],
    ]);

    $result = @file_get_contents($url, false, $context);
    if ($result === false) {
        $lastError = error_get_last();
        $details = $lastError['message'] ?? 'unknown error';
        throw new RuntimeException('HTTP fetch failed for ' . $url . ' (' . $details . ')');
    }

    return $result;
}

function ensureHttpsSupport(): void
{
    if (!extension_loaded('openssl') && !extension_loaded('curl')) {
        throw new RuntimeException(
            'This PHP runtime cannot access HTTPS URLs (missing openssl/curl). Run importer on your hosting environment or enable openssl/curl locally.'
        );
    }
}

function humanize(string $value): string
{
    return trim(preg_replace('/\s+/', ' ', str_replace('_', ' ', $value)) ?? $value);
}

function toPosixPath(string $value): string
{
    return str_replace('\\', '/', $value);
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
