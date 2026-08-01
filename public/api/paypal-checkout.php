<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_paypal.php';

// All subscription plan product IDs — personal-use and commercial-use
// tiers, monthly and annual. Kept as one list so every place that needs to
// recognize "this cart item is a subscription" (digital-goods flag,
// order persistence, activation) checks against the same set.
const SUBSCRIPTION_PLAN_IDS = [
    'subscription-monthly',
    'subscription-yearly',
    'subscription-commercial-monthly',
    'subscription-commercial-yearly',
];

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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

try {
    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        throw new RuntimeException('Invalid JSON payload.');
    }

    $action = trim((string) ($payload['action'] ?? ''));
    $currency = normalizeCurrency($payload['currency'] ?? 'EUR');
    $commercialLicenseUpgrade = normalizeCommercialLicenseUpgrade($payload['commercialLicenseUpgrade'] ?? false);
    $config = getPayPalConfig();

    if ($action === 'create-order') {
        $items = normalizeCartItems($payload['items'] ?? null, $currency);
        $items = withCommercialLicenseUpgrade($items, $commercialLicenseUpgrade, $currency);
        $purchaseUnits = buildPurchaseUnits($items, $currency);
        $order = createPayPalOrder($config, $purchaseUnits);

        respond(200, [
            'ok' => true,
            'orderId' => (string) ($order['id'] ?? ''),
            'status' => (string) ($order['status'] ?? ''),
        ]);
    }

    if ($action === 'capture-order') {
        $orderId = trim((string) ($payload['orderId'] ?? ''));
        if ($orderId === '') {
            throw new RuntimeException('Missing orderId.');
        }

        $items = normalizeCartItems($payload['items'] ?? null, $currency);
        $items = withCommercialLicenseUpgrade($items, $commercialLicenseUpgrade, $currency);
        $ownerName = trim((string) ($payload['ownerName'] ?? ''));
        $companyName = trim((string) ($payload['companyName'] ?? ''));
        $userToken = trim((string) ($payload['token'] ?? ''));
        $capture = capturePayPalOrder($config, $orderId);
        $captured = extractCapturedAmount($capture);
        if ($captured['currency'] !== $currency) {
            throw new RuntimeException('Captured currency does not match cart currency.');
        }

        $expectedTotal = calculateCartTotal($items);
        if (number_format($expectedTotal, 2, '.', '') !== $captured['amount']) {
            throw new RuntimeException('Captured amount does not match cart total.');
        }

        $invoice = persistSuccessfulOrder($orderId, $captured['captureId'], $captured['amount'], $currency, $items, $payload['items'] ?? null, $ownerName, $companyName, $userToken);

        respond(200, [
            'ok' => true,
            'status' => (string) ($capture['status'] ?? ''),
            'orderId' => $orderId,
            'orderNumber' => $invoice['orderNumber'],
            'captureId' => $captured['captureId'],
            'amount' => $captured['amount'],
            'currency' => $captured['currency'],
            'invoiceNumber' => $invoice['invoiceNumber'],
            'invoicePdfUrl' => $invoice['invoicePdfUrl'],
        ]);
    }

    throw new RuntimeException('Unsupported action.');
} catch (Throwable $e) {
    respond(500, [
        'ok' => false,
        'error' => 'PayPal checkout failed',
        'details' => $e->getMessage(),
    ]);
}

function normalizeCurrency($currency): string
{
    $normalized = strtoupper(trim((string) $currency));
    if ($normalized !== 'EUR') {
        throw new RuntimeException('Unsupported currency.');
    }
    return $normalized;
}

function normalizeCommercialLicenseUpgrade($value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return ((int) $value) === 1;
    }

    $text = strtolower(trim((string) $value));
    return in_array($text, ['1', 'true', 'yes', 'on'], true);
}

function normalizeCartItems($items, string $currency): array
{
    if (!is_array($items) || count($items) === 0) {
        throw new RuntimeException('Cart is empty.');
    }

    $imageProducts = fetchImageCatalogProducts($items);
    $normalized = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            throw new RuntimeException('Invalid cart item.');
        }

        $id = trim((string) ($item['id'] ?? ''));
        $quantity = max(1, min(25, (int) ($item['quantity'] ?? 1)));
        $catalogProduct = resolveServerProduct($id, $imageProducts);

        $normalized[] = [
            'id' => $id,
            'title' => $catalogProduct['title'],
            'quantity' => $quantity,
            'unit_price' => number_format($catalogProduct['price'], 2, '.', ''),
            'currency' => $currency,
            'commercial_license' => normalizeCommercialLicenseUpgrade($item['commercialLicense'] ?? false),
        ];
    }

    return $normalized;
}

function withCommercialLicenseUpgrade(array $items, bool $enabled, string $currency): array
{
    $imageQuantity = 0;
    foreach ($items as $item) {
        $id = trim((string) ($item['id'] ?? ''));
        $isImage = preg_match('/^\d+$/', $id) === 1;
        if (!$isImage) {
            continue;
        }

        $isCommercialForItem = $enabled || normalizeCommercialLicenseUpgrade($item['commercial_license'] ?? false);
        if ($isCommercialForItem) {
            $imageQuantity += max(1, (int) ($item['quantity'] ?? 1));
        }
    }

    if ($imageQuantity <= 0) {
        return $items;
    }

    $items[] = [
        'id' => 'commercial-license-upgrade',
        'title' => 'Commercial license upgrade',
        'quantity' => $imageQuantity,
        'unit_price' => number_format(10, 2, '.', ''),
        'currency' => $currency,
    ];

    return $items;
}

function resolveServerProduct(string $id, array $imageProducts): array
{
    if ($id === 'commercial-license-upgrade') {
        return [
            'title' => 'Commercial license upgrade',
            'price' => 10.00,
        ];
    }

    if ($id === 'subscription-monthly') {
        return [
            'title' => 'Photo Subscription Monthly',
            'price' => 9.99,
        ];
    }

    if ($id === 'subscription-yearly') {
        return [
            'title' => 'Photo Subscription Annual',
            'price' => 99.99,
        ];
    }

    if ($id === 'subscription-commercial-monthly') {
        return [
            'title' => 'Commercial Photo Subscription Monthly',
            'price' => 19.99,
        ];
    }

    if ($id === 'subscription-commercial-yearly') {
        return [
            'title' => 'Commercial Photo Subscription Annual',
            'price' => 199.99,
        ];
    }

    if ($id === 'image-license') {
        return [
            'title' => 'Commercial Image License',
            'price' => 79.00,
        ];
    }

    if (preg_match('/^\d+$/', $id) === 1 && isset($imageProducts[$id])) {
        return $imageProducts[$id];
    }

    throw new RuntimeException('Unsupported product in cart: ' . $id);
}

function fetchImageCatalogProducts(array $items): array
{
    $imageIds = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $id = trim((string) ($item['id'] ?? ''));
        if (preg_match('/^\d+$/', $id) === 1) {
            $imageIds[] = (int) $id;
        }
    }

    $imageIds = array_values(array_unique(array_filter($imageIds, static fn(int $id): bool => $id > 0)));
    if (count($imageIds) === 0) {
        return [];
    }

    $db = getGalleryMysqli();
    $placeholders = implode(', ', array_fill(0, count($imageIds), '?'));
    $sql = 'SELECT id, title, price_eur FROM images WHERE is_active = 1 AND id IN (' . $placeholders . ')';
    $stmt = $db->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare image price lookup: ' . $db->error);
    }

    $types = str_repeat('i', count($imageIds));
    bindDynamicParams($stmt, $types, $imageIds);
    $stmt->execute();
    $result = $stmt->get_result();
    $products = [];

    while ($row = $result ? $result->fetch_assoc() : null) {
        $id = (string) ($row['id'] ?? '');
        if ($id === '') {
            continue;
        }

        $title = trim((string) ($row['title'] ?? 'Photo Print'));
        $price = round((float) ($row['price_eur'] ?? 0), 2);
        if ($price <= 0) {
            throw new RuntimeException('Image price is missing or invalid for product ' . $id . '.');
        }

        $products[$id] = [
            'title' => $title !== '' ? $title : 'Photo Print',
            'price' => $price,
        ];
    }

    $stmt->close();

    foreach ($imageIds as $imageId) {
        if (!isset($products[(string) $imageId])) {
            throw new RuntimeException('Image product not found or inactive: ' . $imageId);
        }
    }

    return $products;
}

function buildPurchaseUnits(array $items, string $currency): array
{
    $total = 0.0;
    $paypalItems = [];

    foreach ($items as $item) {
        $unitPrice = (float) $item['unit_price'];
        $quantity = (int) $item['quantity'];
        $total += $unitPrice * $quantity;

        $paypalItems[] = [
            'name' => mb_substr($item['title'], 0, 127),
            'unit_amount' => [
                'currency_code' => $currency,
                'value' => number_format($unitPrice, 2, '.', ''),
            ],
            'quantity' => (string) $quantity,
            'category' => in_array($item['id'], array_merge(['commercial-license-upgrade'], SUBSCRIPTION_PLAN_IDS), true)
                ? 'DIGITAL_GOODS'
                : 'PHYSICAL_GOODS',
        ];
    }

    return [
        [
            'amount' => [
                'currency_code' => $currency,
                'value' => number_format($total, 2, '.', ''),
                'breakdown' => [
                    'item_total' => [
                        'currency_code' => $currency,
                        'value' => number_format($total, 2, '.', ''),
                    ],
                ],
            ],
            'items' => $paypalItems,
        ]
    ];
}

function calculateCartTotal(array $items): float
{
    $total = 0.0;
    foreach ($items as $item) {
        $total += (float) $item['unit_price'] * (int) $item['quantity'];
    }

    return round($total, 2);
}

function createPayPalOrder(array $config, array $purchaseUnits): array
{
    $token = fetchAccessToken($config);
    $response = paypalRequest(
        $config,
        '/v2/checkout/orders',
        'POST',
        [
            'intent' => 'CAPTURE',
            'purchase_units' => $purchaseUnits,
        ],
        $token
    );

    if (($response['status'] ?? '') !== 'CREATED' || empty($response['id'])) {
        throw new RuntimeException('PayPal order could not be created.');
    }

    return $response;
}

function capturePayPalOrder(array $config, string $orderId): array
{
    $token = fetchAccessToken($config);
    $response = paypalRequest(
        $config,
        '/v2/checkout/orders/' . rawurlencode($orderId) . '/capture',
        'POST',
        new stdClass(),
        $token
    );

    if (($response['status'] ?? '') !== 'COMPLETED') {
        throw new RuntimeException('PayPal capture did not complete.');
    }

    return $response;
}

function extractCapturedAmount(array $capture): array
{
    $purchaseUnits = $capture['purchase_units'] ?? [];
    if (!is_array($purchaseUnits) || count($purchaseUnits) === 0) {
        throw new RuntimeException('PayPal capture response is missing purchase units.');
    }

    $total = 0.0;
    $currency = '';
    $captureId = '';

    foreach ($purchaseUnits as $purchaseUnit) {
        $captures = $purchaseUnit['payments']['captures'] ?? [];
        if (!is_array($captures) || count($captures) === 0) {
            continue;
        }
        foreach ($captures as $entry) {
            $amount = (string) ($entry['amount']['value'] ?? '0');
            $entryCurrency = (string) ($entry['amount']['currency_code'] ?? '');
            if ($entryCurrency === '') {
                throw new RuntimeException('PayPal capture response is missing currency.');
            }
            if ($currency === '') {
                $currency = $entryCurrency;
            } elseif ($currency !== $entryCurrency) {
                throw new RuntimeException('Mixed currencies are not supported.');
            }
            if ($captureId === '') {
                $captureId = (string) ($entry['id'] ?? '');
            }
            $total += (float) $amount;
        }
    }

    if ($total <= 0 || $currency === '') {
        throw new RuntimeException('No successful capture found in PayPal response.');
    }

    return [
        'amount' => number_format($total, 2, '.', ''),
        'currency' => $currency,
        'captureId' => $captureId,
    ];
}

function getGalleryMysqli(): mysqli
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

    $host = firstNonEmpty(
        $config['host'] ?? null,
        getenv('GALLERY_DB_HOST') ?: null,
        'db5020224670.hosting-data.io'
    );
    $port = (int) firstNonEmpty(
        isset($config['port']) ? (string) $config['port'] : null,
        getenv('GALLERY_DB_PORT') ?: null,
        '3306'
    );
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
        throw new RuntimeException('Gallery database config missing. Set secrets/gallery-db.local.php or environment variables.');
    }

    if ($password === '') {
        throw new RuntimeException('Gallery database password missing. Set secrets/gallery-db.local.php or env var GALLERY_DB_PASS.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli($host, $user, $password, $database, $port);
    $db->set_charset($charset);

    return $db;
}

function persistSuccessfulOrder(
    string $paypalOrderId,
    string $paypalCaptureId,
    string $capturedAmount,
    string $currency,
    array $catalogItems,
    $rawItems,
    string $ownerName,
    string $companyName,
    string $token
): array {
    $db = getGalleryMysqli();
    $user = resolveAuthenticatedUser($db, $token);
    $persistedItems = buildPersistedOrderItems($catalogItems, $rawItems, $currency);
    $containsSubscription = orderContainsSubscription($persistedItems);
    $customerEmail = $user['email'] ?? null;
    $customerDisplayName = $user['display_name'] ?? null;
    $customerDisplayName = is_string($customerDisplayName) ? trim($customerDisplayName) : '';
    $customerEmail = is_string($customerEmail) ? trim($customerEmail) : '';
    $userId = isset($user['id']) ? (int) $user['id'] : null;
    $invoiceToken = buildInvoiceToken();
    $resolvedOwnerName = trim($ownerName);
    $resolvedCompanyName = trim($companyName);
    if ($containsSubscription && (!isset($user['id']) || (int) ($user['id'] ?? 0) <= 0)) {
        throw new RuntimeException('Subscriptions require a logged-in user account.');
    }
    if ($userId !== null && $userId > 0) {
        $resolvedOwnerName = $customerDisplayName !== '' ? $customerDisplayName : $customerEmail;
    }

    $db->begin_transaction();
    try {
        $shopOrderColumns = fetchTableColumns($db, 'shop_orders');
        ensureShopOrdersCompanyNameColumn($db, $shopOrderColumns);
        $shopOrderColumns = fetchTableColumns($db, 'shop_orders');
        $supportsCompanyName = isset($shopOrderColumns['company_name']);

        $insertColumns = [
            'user_id',
            'customer_email',
            'customer_display_name',
            'owner_name',
        ];
        $insertPlaceholders = ['?', '?', '?', '?'];
        $insertBindTypes = 'isss';
        $insertBindValues = [];

        $nullableUserId = $userId > 0 ? $userId : null;
        $insertBindValues[] = $nullableUserId;
        $insertBindValues[] = $customerEmail;
        $insertBindValues[] = $customerDisplayName;
        $nullableOwnerName = $resolvedOwnerName !== '' ? $resolvedOwnerName : null;
        $insertBindValues[] = $nullableOwnerName;

        if ($supportsCompanyName) {
            $insertColumns[] = 'company_name';
            $insertPlaceholders[] = '?';
            $insertBindTypes .= 's';
            $insertBindValues[] = $resolvedCompanyName;
        }

        $insertColumns = array_merge($insertColumns, [
            'paypal_order_id',
            'paypal_capture_id',
            'order_status',
            'total_amount',
            'currency',
            'purchased_at',
        ]);
        $insertPlaceholders = array_merge($insertPlaceholders, [
            '?',
            '?',
            "'completed'",
            '?',
            '?',
            'CURRENT_TIMESTAMP',
        ]);
        $insertBindTypes .= 'ssds';

        $totalAmount = (float) $capturedAmount;
        $insertBindValues[] = $paypalOrderId;
        $insertBindValues[] = $paypalCaptureId;
        $insertBindValues[] = $totalAmount;
        $insertBindValues[] = $currency;

        $insertOrderSql = 'INSERT INTO shop_orders (' . implode(', ', $insertColumns) . ') VALUES (' . implode(', ', $insertPlaceholders) . ')';

        $insertOrderStmt = $db->prepare($insertOrderSql);
        if (!$insertOrderStmt) {
            throw new RuntimeException('Failed to prepare order insert: ' . $db->error);
        }
        bindDynamicParams($insertOrderStmt, $insertBindTypes, $insertBindValues);
        $insertOrderStmt->execute();
        $shopOrderId = (int) $insertOrderStmt->insert_id;
        $insertOrderStmt->close();

        $supportsInvoiceToken = isset($shopOrderColumns['invoice_token']);
        $supportsInvoiceNumber = isset($shopOrderColumns['invoice_number']);
        $supportsInvoicePdfUrl = isset($shopOrderColumns['invoice_pdf_url']);
        $supportsInvoiceGeneratedAt = isset($shopOrderColumns['invoice_generated_at']);

        if (!$supportsInvoiceNumber || !$supportsInvoicePdfUrl) {
            throw new RuntimeException('Missing required invoice columns on shop_orders table.');
        }

        $invoiceData = buildInvoiceAccessData($shopOrderId, $invoiceToken, $supportsInvoiceToken);

        $setParts = [
            'invoice_number = ?',
            'invoice_pdf_url = ?',
        ];
        $bindTypes = 'ss';
        $bindValues = [
            $invoiceData['invoiceNumber'],
            $invoiceData['invoicePdfUrl'],
        ];

        if ($supportsInvoiceToken) {
            $setParts[] = 'invoice_token = ?';
            $bindTypes .= 's';
            $bindValues[] = $invoiceData['invoiceToken'];
        }

        if ($supportsInvoiceGeneratedAt) {
            $setParts[] = 'invoice_generated_at = CURRENT_TIMESTAMP';
        }

        $invoiceUpdateSql = 'UPDATE shop_orders SET ' . implode(', ', $setParts) . ' WHERE id = ? LIMIT 1';
        $bindTypes .= 'i';
        $bindValues[] = $shopOrderId;

        $updateInvoiceStmt = $db->prepare($invoiceUpdateSql);
        if (!$updateInvoiceStmt) {
            throw new RuntimeException('Failed to prepare invoice update: ' . $db->error);
        }

        bindDynamicParams($updateInvoiceStmt, $bindTypes, $bindValues);
        $updateInvoiceStmt->execute();
        $updateInvoiceStmt->close();

        $insertItemStmt = $db->prepare(
            'INSERT INTO shop_order_items (shop_order_id, product_id, product_type, title, image_url, original_image_url, unit_price, quantity, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        if (!$insertItemStmt) {
            throw new RuntimeException('Failed to prepare order item insert: ' . $db->error);
        }

        foreach ($persistedItems as $item) {
            $productId = $item['product_id'];
            $productType = $item['product_type'];
            $title = $item['title'];
            $imageUrl = $item['image_url'];
            $originalImageUrl = $item['original_image_url'];
            $unitPrice = $item['unit_price'];
            $quantity = $item['quantity'];
            $itemCurrency = $item['currency'];

            $insertItemStmt->bind_param(
                'isssssdis',
                $shopOrderId,
                $productId,
                $productType,
                $title,
                $imageUrl,
                $originalImageUrl,
                $unitPrice,
                $quantity,
                $itemCurrency
            );
            $insertItemStmt->execute();
        }

        $insertItemStmt->close();

        if ($containsSubscription && $userId !== null && $userId > 0) {
            ensureSubscriptionTables($db);
            activatePurchasedSubscriptions($db, $userId, $shopOrderId, $paypalOrderId, $paypalCaptureId, $persistedItems);
        }

        $db->commit();
        return [
            'orderNumber' => $shopOrderId,
            'invoiceNumber' => $invoiceData['invoiceNumber'],
            'invoicePdfUrl' => $invoiceData['invoicePdfUrl'],
        ];
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
}

function ensureShopOrdersCompanyNameColumn(mysqli $db, array $columns): void
{
    if (isset($columns['company_name'])) {
        return;
    }

    $db->query("ALTER TABLE shop_orders ADD COLUMN company_name VARCHAR(190) NOT NULL DEFAULT '' AFTER owner_name");
}

function buildInvoiceToken(): string
{
    return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
}

function buildInvoiceAccessData(int $orderNumber, string $invoiceToken, bool $includeToken = true): array
{
    if ($orderNumber <= 0) {
        throw new RuntimeException('Invalid order number for invoice generation.');
    }

    $invoiceNumber = str_pad((string) $orderNumber, 6, '0', STR_PAD_LEFT);

    $relativePath = '/api/invoice.php?invoice=' . rawurlencode($invoiceNumber);
    if ($includeToken) {
        $relativePath .= '&token=' . rawurlencode($invoiceToken);
    }
    $invoicePdfUrl = $relativePath;

    return [
        'invoiceNumber' => $invoiceNumber,
        'invoiceToken' => $invoiceToken,
        'invoicePdfUrl' => $invoicePdfUrl,
    ];
}

function buildPersistedOrderItems(array $catalogItems, $rawItems, string $currency): array
{
    if (!is_array($rawItems)) {
        throw new RuntimeException('Original cart items are missing.');
    }

    $rawById = [];
    foreach ($rawItems as $rawItem) {
        if (!is_array($rawItem)) {
            continue;
        }

        $id = trim((string) ($rawItem['id'] ?? ''));
        if ($id === '') {
            continue;
        }

        $rawById[$id] = $rawItem;
    }

    $items = [];
    foreach ($catalogItems as $catalogItem) {
        $id = (string) ($catalogItem['id'] ?? '');
        $rawItem = $rawById[$id] ?? [];
        $isLicenseProduct = $id === 'image-license' || $id === 'commercial-license-upgrade';
        $isSubscriptionProduct = in_array($id, SUBSCRIPTION_PLAN_IDS, true);
        $items[] = [
            'product_id' => $id,
            'product_type' => $isSubscriptionProduct ? 'subscription' : ($isLicenseProduct ? 'license' : 'photo'),
            'title' => (string) ($catalogItem['title'] ?? 'Photo Print'),
            'image_url' => normalizeNullableUrl($rawItem['imageUrl'] ?? null),
            'original_image_url' => normalizeNullableUrl($rawItem['originalImageUrl'] ?? null),
            'unit_price' => round((float) ($catalogItem['unit_price'] ?? 0), 2),
            'quantity' => max(1, (int) ($catalogItem['quantity'] ?? 1)),
            'currency' => $currency,
        ];
    }

    return $items;
}

function orderContainsSubscription(array $items): bool
{
    foreach ($items as $item) {
        if (($item['product_type'] ?? '') === 'subscription') {
            return true;
        }
    }

    return false;
}

function ensureSubscriptionTables(mysqli $db): void
{
    try {
        $probe = $db->query('SELECT 1 FROM shop_user_subscriptions LIMIT 1');
        if ($probe !== false) {
            if ($probe instanceof mysqli_result) {
                $probe->free();
            }
            return;
        }
    } catch (Throwable $ignored) {
        // Continue to CREATE TABLE.
    }

    $db->query(<<<'SQL'
CREATE TABLE IF NOT EXISTS shop_user_subscriptions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    shop_order_id INT UNSIGNED NOT NULL,
    plan_code VARCHAR(40) NOT NULL,
    plan_name VARCHAR(120) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    paypal_order_id VARCHAR(64) NOT NULL DEFAULT '',
    paypal_capture_id VARCHAR(64) NOT NULL DEFAULT '',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    monthly_download_limit SMALLINT UNSIGNED NOT NULL DEFAULT 2,
    monthly_downloads_used SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    downloads_reset_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_status (user_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);

    $db->query(<<<'SQL'
CREATE TABLE IF NOT EXISTS shop_subscription_downloads (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    subscription_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    image_id INT UNSIGNED NOT NULL,
    downloaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period_key CHAR(7) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_subscription_period (subscription_id, period_key),
    KEY idx_user_downloads (user_id, downloaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
}

function activatePurchasedSubscriptions(mysqli $db, int $userId, int $shopOrderId, string $paypalOrderId, string $paypalCaptureId, array $items): void
{
    $replaceStmt = $db->prepare("UPDATE shop_user_subscriptions SET status = 'replaced' WHERE user_id = ? AND status IN ('active', 'cancelling')");
    if ($replaceStmt) {
        $replaceStmt->bind_param('i', $userId);
        $replaceStmt->execute();
        $replaceStmt->close();
    }

    $insertStmt = $db->prepare(
        "INSERT INTO shop_user_subscriptions (user_id, shop_order_id, plan_code, plan_name, status, paypal_order_id, paypal_capture_id, started_at, expires_at, monthly_download_limit, monthly_downloads_used, downloads_reset_at) VALUES (?, ?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, ?, 2, 0, CURRENT_TIMESTAMP)"
    );
    if (!$insertStmt) {
        throw new RuntimeException('Failed to prepare subscription insert: ' . $db->error);
    }

    foreach ($items as $item) {
        if (($item['product_type'] ?? '') !== 'subscription') {
            continue;
        }

        $planCode = (string) ($item['product_id'] ?? 'subscription-monthly');
        $planName = (string) ($item['title'] ?? 'Photo Subscription');
        $expiresAt = new DateTimeImmutable('now');
        if (str_ends_with($planCode, '-yearly')) {
            $expiresAt = $expiresAt->modify('+1 year');
        } else {
            $expiresAt = $expiresAt->modify('+1 month');
        }

        $expiresAtSql = $expiresAt->format('Y-m-d H:i:s');
        $insertStmt->bind_param(
            'iisssss',
            $userId,
            $shopOrderId,
            $planCode,
            $planName,
            $paypalOrderId,
            $paypalCaptureId,
            $expiresAtSql
        );
        $insertStmt->execute();
    }

    $insertStmt->close();
}

function normalizeNullableUrl($value): ?string
{
    $text = trim((string) ($value ?? ''));
    return $text === '' ? null : $text;
}

function resolveAuthenticatedUser(mysqli $db, string $token): ?array
{
    if ($token === '') {
        return null;
    }

    $secret = getShopAuthTokenSecret();
    $claims = verifyShopUserToken($secret, $token);
    if ($claims === null) {
        throw new RuntimeException('Invalid or expired user session.');
    }

    $userId = (int) ($claims['sub'] ?? 0);
    if ($userId <= 0) {
        throw new RuntimeException('Invalid user token subject.');
    }

    $stmt = $db->prepare('SELECT id, email, display_name, status FROM users WHERE id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare user lookup: ' . $db->error);
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$user || (string) ($user['status'] ?? '') !== 'active') {
        throw new RuntimeException('User account is not active.');
    }

    return $user;
}

function getShopAuthTokenSecret(): string
{
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

    $secret = firstNonEmpty(
        $config['token_secret'] ?? null,
        $config['secret'] ?? null,
        $config['jwt_secret'] ?? null,
        $config['auth_secret'] ?? null,
        getenv('SHOP_AUTH_TOKEN_SECRET') ?: null,
        getenv('SHOP_AUTH_SECRET') ?: null,
        getenv('APP_AUTH_TOKEN_SECRET') ?: null,
        ''
    );
    if ($secret === '') {
        throw new RuntimeException('Shop auth token secret is not configured.');
    }

    return $secret;
}

function verifyShopUserToken(string $secret, string $token): ?array
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

function bindDynamicParams(mysqli_stmt $stmt, string $types, array $values): void
{
    if ($types === '' || count($values) === 0) {
        return;
    }

    $refs = [$types];
    foreach ($values as $index => $value) {
        $refs[] = &$values[$index];
    }

    call_user_func_array([$stmt, 'bind_param'], $refs);
}

function fetchTableColumns(mysqli $db, string $table): array
{
    $tableName = trim($table);
    if ($tableName === '') {
        return [];
    }

    $escapedTable = $db->real_escape_string($tableName);
    $result = $db->query('SHOW COLUMNS FROM `' . $escapedTable . '`');
    if (!$result) {
        return [];
    }

    $columns = [];
    while ($row = $result->fetch_assoc()) {
        $name = isset($row['Field']) ? trim((string) $row['Field']) : '';
        if ($name !== '') {
            $columns[$name] = true;
        }
    }

    return $columns;
}
