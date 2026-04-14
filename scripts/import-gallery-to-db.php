<?php

declare(strict_types=1);

$bucketBaseUrl = 'https://christian-boehme-gallery.s3.eu-central-3.ionoscloud.com';
$variantFolder = 'grid';
$imagePattern = '/\.(jpg|jpeg|png|webp|avif)$/i';
$deltaMode = in_array('--delta', $argv ?? [], true);

ensureHttpsSupport();

$nameMap = loadNameMapFromBucket($bucketBaseUrl . '/name-map.json');
$relativePaths = fetchVariantRelativePaths($bucketBaseUrl, $variantFolder, $imagePattern);
$db = getMysqli();

if ($deltaMode) {
    $existingPathGridSet = fetchExistingPathGridSet($db);
    $relativePaths = array_values(array_filter(
        $relativePaths,
        static fn(string $relativePath): bool => !isset($existingPathGridSet['grid/' . $relativePath])
    ));
}

$upsertSql = <<<'SQL'
INSERT INTO images (
    category,
    continent,
    country,
    title,
    title_de,
    description,
    description_de,
    path_original,
    path_grid,
    path_thumbnail,
    is_active
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
ON DUPLICATE KEY UPDATE
    category = VALUES(category),
    continent = VALUES(continent),
    country = VALUES(country),
    title = COALESCE(NULLIF(images.title, ''), VALUES(title)),
    title_de = COALESCE(NULLIF(images.title_de, ''), VALUES(title_de)),
    description = COALESCE(NULLIF(images.description, ''), VALUES(description)),
    description_de = COALESCE(NULLIF(images.description_de, ''), VALUES(description_de)),
    path_original = VALUES(path_original),
    path_thumbnail = VALUES(path_thumbnail),
    is_active = 1,
    updated_at = CURRENT_TIMESTAMP
SQL;

$stmt = $db->prepare($upsertSql);
if (!$stmt) {
    throw new RuntimeException('Failed to prepare upsert statement: ' . $db->error);
}

$insertedOrUpdated = 0;
$skipped = 0;

foreach ($relativePaths as $relativePath) {

    $parts = explode('/', $relativePath);
    if (count($parts) < 4) {
        // Expected: category/continent/country/file
        $skipped++;
        continue;
    }

    $category = humanize($parts[0]);
    $continent = humanize($parts[1]);
    $country = humanize($parts[2]);

    $fileBase = pathinfo($parts[count($parts) - 1], PATHINFO_FILENAME);
    $title = humanize($fileBase);
    if (isset($nameMap[$relativePath]['originalTitle']) && trim((string) $nameMap[$relativePath]['originalTitle']) !== '') {
        $title = (string) $nameMap[$relativePath]['originalTitle'];
    }

    $pathOriginal = 'original/' . $relativePath;
    $pathGrid = 'grid/' . $relativePath;
    $pathThumbnail = 'thumbnail/' . $relativePath;

    $titleDe = null;
    $description = null;
    $descriptionDe = null;

    $stmt->bind_param(
        'ssssssssss',
        $category,
        $continent,
        $country,
        $title,
        $titleDe,
        $description,
        $descriptionDe,
        $pathOriginal,
        $pathGrid,
        $pathThumbnail
    );

    if (!$stmt->execute()) {
        throw new RuntimeException('Failed upsert for ' . $relativePath . ': ' . $stmt->error);
    }

    $insertedOrUpdated++;
}

$stmt->close();

echo "Import mode: " . ($deltaMode ? 'delta (new files only)' : 'full') . "\n";
echo "Import finished. Upserted: {$insertedOrUpdated}, skipped: {$skipped}\n";
echo "Image base URL: {$bucketBaseUrl}\n";
echo "Variant folder: {$variantFolder}\n";

function getMysqli(): mysqli
{
    if (!extension_loaded('mysqli')) {
        throw new RuntimeException(
            'PHP extension "mysqli" is not loaded. Install/enable mysqli (or run importer on your hosting environment where mysqli is available).'
        );
    }

    $secretPath = __DIR__ . '/../secrets/gallery-db.local.php';
    $config = [];

    if (file_exists($secretPath)) {
        $config = require $secretPath;
    }

    $host = firstNonEmpty($config['host'] ?? null, getenv('GALLERY_DB_HOST') ?: null, 'db5020224670.hosting-data.io');
    $port = (int) firstNonEmpty(isset($config['port']) ? (string) $config['port'] : null, getenv('GALLERY_DB_PORT') ?: null, '3306');
    $database = firstNonEmpty($config['database'] ?? null, getenv('GALLERY_DB_NAME') ?: null, 'dbs15552605');
    $username = firstNonEmpty($config['username'] ?? null, getenv('GALLERY_DB_USER') ?: null, 'dbu595115');
    $password = firstNonEmpty($config['password'] ?? null, getenv('GALLERY_DB_PASS') ?: null, '');
    $charset = firstNonEmpty($config['charset'] ?? null, getenv('GALLERY_DB_CHARSET') ?: null, 'utf8mb4');

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli($host, $username, $password, $database, $port);

    if ($db->connect_error) {
        throw new RuntimeException('Verbindung zum MySQL Server fehlgeschlagen: ' . $db->connect_error);
    }

    $db->set_charset($charset);
    return $db;
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
