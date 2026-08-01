<?php

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

$debugRequested = trim((string) ($_GET['debug'] ?? '')) === '1';

try {
    $invoiceNumber = trim((string) ($_GET['invoice'] ?? ''));
    $invoiceToken = trim((string) ($_GET['token'] ?? ''));
    $language = resolvePdfLanguage((string) ($_GET['lang'] ?? 'de'));

    $db = getShopMysqli();
    $shopOrderColumns = fetchTableColumns($db, 'shop_orders');
    $supportsInvoiceToken = isset($shopOrderColumns['invoice_token']);
    $supportsInvoiceNumber = isset($shopOrderColumns['invoice_number']);

    if ($invoiceNumber === '') {
        http_response_code(400);
        if ($debugRequested) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'ok' => false,
                'error' => 'Missing invoice number',
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            header('Content-Type: text/plain; charset=utf-8');
            echo 'Missing invoice number';
        }
        exit;
    }

    if ($supportsInvoiceToken && $invoiceToken === '') {
        http_response_code(400);
        if ($debugRequested) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'ok' => false,
                'error' => 'Missing invoice token',
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            header('Content-Type: text/plain; charset=utf-8');
            echo 'Missing invoice token';
        }
        exit;
    }

    $order = fetchInvoiceOrder($db, $invoiceNumber, $invoiceToken, $supportsInvoiceToken, $supportsInvoiceNumber, $shopOrderColumns);
    if (!$order && $supportsInvoiceToken) {
        $legacyOrder = fetchInvoiceOrder($db, $invoiceNumber, $invoiceToken, false, $supportsInvoiceNumber, $shopOrderColumns);
        if ($legacyOrder) {
            $storedToken = trim((string) ($legacyOrder['invoice_token'] ?? ''));
            if ($storedToken === '') {
                $order = $legacyOrder;
            } else {
                http_response_code(403);
                if ($debugRequested) {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        'ok' => false,
                        'error' => 'Invalid invoice token',
                        'invoice' => $invoiceNumber,
                        'tokenProvided' => true,
                        'supportsInvoiceToken' => true,
                        'tokenMismatch' => true,
                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } else {
                    header('Content-Type: text/plain; charset=utf-8');
                    echo 'Invalid invoice token';
                }
                exit;
            }
        }
    }

    if (!$order) {
        http_response_code(404);
        if ($debugRequested) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'ok' => false,
                'error' => 'Invoice not found',
                'invoice' => $invoiceNumber,
                'tokenProvided' => $invoiceToken !== '',
                'supportsInvoiceToken' => $supportsInvoiceToken,
                'supportsInvoiceNumber' => $supportsInvoiceNumber,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            header('Content-Type: text/plain; charset=utf-8');
            echo 'Invoice not found';
        }
        exit;
    }

    $items = fetchInvoiceItems($db, (int) ($order['id'] ?? 0));
    $pdf = buildInvoicePdf($order, $items, $language);

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="invoice-' . preg_replace('/[^A-Za-z0-9\-]/', '-', $invoiceNumber) . '.pdf"');
    header('Cache-Control: private, max-age=300');
    echo $pdf;
} catch (Throwable $e) {
    error_log('Invoice generation failed: ' . $e->getMessage());
    http_response_code(500);
    if ($debugRequested) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false,
            'error' => 'Invoice generation failed',
            'details' => $e->getMessage(),
            'file' => basename((string) $e->getFile()),
            'line' => (int) $e->getLine(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        echo 'Invoice generation failed';
    }
}

function fetchInvoiceOrder(
    mysqli $db,
    string $invoiceNumber,
    string $invoiceToken,
    bool $useToken,
    bool $supportsInvoiceNumber,
    array $columns
): ?array {
    $idColumnExists = isset($columns['id']);
    if (!$idColumnExists) {
        throw new RuntimeException('shop_orders.id column is missing.');
    }

    $selectFields = [
        'id',
        selectColumnOrLiteral($columns, 'owner_name', "''", 'owner_name'),
        selectColumnOrLiteral($columns, 'company_name', "''", 'company_name'),
        selectColumnOrLiteral($columns, 'customer_email', "''", 'customer_email'),
        selectColumnOrLiteral($columns, 'customer_display_name', "''", 'customer_display_name'),
        selectColumnOrLiteral($columns, 'paypal_order_id', "''", 'paypal_order_id'),
        selectColumnOrLiteral($columns, 'paypal_capture_id', "''", 'paypal_capture_id'),
        selectColumnOrLiteral($columns, 'total_amount', '0', 'total_amount'),
        selectColumnOrLiteral($columns, 'currency', "'EUR'", 'currency'),
        selectColumnOrLiteral($columns, 'purchased_at', 'CURRENT_TIMESTAMP', 'purchased_at'),
        selectColumnOrLiteral($columns, 'invoice_number', "''", 'invoice_number'),
        selectColumnOrLiteral($columns, 'invoice_token', "''", 'invoice_token'),
    ];

    $baseSql = 'SELECT ' . implode(', ', $selectFields) . ' FROM shop_orders ';

    if ($useToken) {
        if ($supportsInvoiceNumber) {
            $stmt = $db->prepare($baseSql . 'WHERE invoice_number = ? AND invoice_token = ? LIMIT 1');
        } else {
            $orderId = invoiceNumberToOrderId($invoiceNumber);
            $stmt = $db->prepare($baseSql . 'WHERE id = ? LIMIT 1');
        }
    } else {
        if ($supportsInvoiceNumber) {
            $stmt = $db->prepare($baseSql . 'WHERE invoice_number = ? LIMIT 1');
        } else {
            $orderId = invoiceNumberToOrderId($invoiceNumber);
            $stmt = $db->prepare($baseSql . 'WHERE id = ? LIMIT 1');
        }
    }
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare invoice order query: ' . $db->error);
    }

    if ($supportsInvoiceNumber && $useToken) {
        $stmt->bind_param('ss', $invoiceNumber, $invoiceToken);
    } elseif ($supportsInvoiceNumber) {
        $stmt->bind_param('s', $invoiceNumber);
    } else {
        $stmt->bind_param('i', $orderId);
    }
    $stmt->execute();
    $rows = stmtFetchAllAssoc($stmt);
    $row = $rows[0] ?? null;
    $stmt->close();

    return $row ?: null;
}

function invoiceNumberToOrderId(string $invoiceNumber): int
{
    $digits = preg_replace('/\D+/', '', $invoiceNumber) ?? '';
    if ($digits === '') {
        throw new RuntimeException('Invoice number is not numeric.');
    }

    $orderId = (int) ltrim($digits, '0');
    if ($orderId <= 0) {
        $orderId = (int) $digits;
    }

    if ($orderId <= 0) {
        throw new RuntimeException('Invalid order id derived from invoice number.');
    }

    return $orderId;
}

function selectColumnOrLiteral(array $columns, string $column, string $fallbackLiteral, string $alias): string
{
    if (isset($columns[$column])) {
        return $column;
    }

    return $fallbackLiteral . ' AS ' . $alias;
}

function fetchInvoiceItems(mysqli $db, int $orderId): array
{
    $stmt = $db->prepare(
        'SELECT title, unit_price, quantity, currency FROM shop_order_items WHERE shop_order_id = ? ORDER BY id ASC'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare invoice items query: ' . $db->error);
    }

    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $items = stmtFetchAllAssoc($stmt);
    $stmt->close();

    return $items;
}

function buildInvoicePdf(array $order, array $items, string $language = 'de'): string
{
    $cfg = loadInvoiceConfig();
    $pages = [];
    $logoImage = loadInvoiceLogoImage($cfg);

    $grossTotal = round((float) ($order['total_amount'] ?? 0), 2);
    $currency = strtoupper(trim((string) ($order['currency'] ?? 'EUR')));
    $vatRate = max(0.0, round((float) ($cfg['vat_rate'] ?? 19.0), 2));
    $taxMode = (string) ($cfg['tax_mode'] ?? 'vat');

    [$netTotal, $vatAmount] = calculateTaxBreakdown($grossTotal, $vatRate, $taxMode);

    $purchaseDate = formatInvoiceDateByLocale((string) ($order['purchased_at'] ?? ''), (string) ($cfg['format_locale'] ?? 'de'));
    $buyerName = trim((string) ($order['owner_name'] ?? '') !== ''
        ? (string) ($order['owner_name'] ?? '')
        : ((string) ($order['customer_display_name'] ?? '') !== ''
            ? (string) ($order['customer_display_name']
            )
            : (string) ($order['customer_email'] ?? 'Customer')));
    $buyerEmail = trim((string) ($order['customer_email'] ?? ''));
    $buyerCompany = trim((string) ($order['company_name'] ?? ''));

    $normalizedItems = normalizeInvoiceItems($items, $currency);
    $preparedRows = [];
    foreach ($normalizedItems as $item) {
        $titleLines = splitTextLines((string) $item['title'], 44);
        $rowHeight = max(20, 12 * count($titleLines) + 8);
        $preparedRows[] = [
            'title_lines' => $titleLines,
            'row_height' => $rowHeight,
            'quantity' => (int) $item['quantity'],
            'unit_price' => (float) $item['unit_price'],
        ];
    }

    $chunks = paginateInvoiceRows($preparedRows, 360, 620);
    if (count($chunks) === 0) {
        $chunks = [[]];
    }

    foreach ($chunks as $chunkIndex => $chunkRows) {
        $pageNo = $chunkIndex + 1;
        $isFirstPage = $chunkIndex === 0;
        $isLastPage = $chunkIndex === count($chunks) - 1;
        $content = '';

        if ($isFirstPage) {
            $content .= renderFirstPageHeader($cfg, $order, $purchaseDate, $logoImage !== null, $language);

            // Seller & Buyer cards
            $content .= pdfRect(40, 652, 250, 84, [245, 247, 250]);
            $content .= pdfRect(305, 652, 250, 84, [245, 247, 250]);
            $content .= pdfText(50, 720, t($language, 'seller'), 'F2', 10, [17, 24, 39]);
            $content .= pdfText(315, 720, t($language, 'bill_to'), 'F2', 10, [17, 24, 39]);

            $sellerLines = [
                (string) ($cfg['seller_name'] ?? ''),
                trim((string) ($cfg['seller_street'] ?? '')),
                trim((string) ($cfg['seller_postal_code'] ?? '') . ' ' . (string) ($cfg['seller_city'] ?? '')),
                (string) ($cfg['seller_country'] ?? ''),
                trim((string) ($cfg['seller_email'] ?? '')),
            ];
            $buyerLines = [
                $buyerCompany !== '' ? (t($language, 'company') . ': ' . $buyerCompany) : '',
                $buyerName,
                $buyerEmail,
                t($language, 'paypal_order') . ': ' . (string) ($order['paypal_order_id'] ?? ''),
                t($language, 'capture_id') . ': ' . (string) ($order['paypal_capture_id'] ?? ''),
            ];

            $y = 705;
            foreach ($sellerLines as $line) {
                if ($line === '') {
                    continue;
                }
                $content .= pdfText(50, $y, $line, 'F1', 9, [31, 41, 55]);
                $y -= 13;
            }

            $y = 705;
            foreach ($buyerLines as $line) {
                if ($line === '') {
                    continue;
                }
                $content .= pdfText(315, $y, $line, 'F1', 9, [31, 41, 55]);
                $y -= 13;
            }

            // Invoice metadata row
            $content .= pdfRect(40, 618, 515, 24, [232, 239, 248]);
            $content .= pdfText(52, 626, t($language, 'invoice_no') . ': ' . (string) ($order['invoice_number'] ?? ''), 'F2', 9, [30, 58, 138]);
            $content .= pdfText(290, 626, t($language, 'service_date') . ': ' . $purchaseDate, 'F2', 9, [30, 58, 138]);

            $content .= renderTableHeader($cfg, 586, 594, $language);
            $tableY = 566;
        } else {
            $content .= renderContinuationHeader($cfg, $order, $purchaseDate, $pageNo, $logoImage !== null, $language);
            $content .= renderTableHeader($cfg, 730, 738, $language);
            $tableY = 710;
        }

        foreach ($chunkRows as $rowIndex => $row) {
            if (($rowIndex % 2) === 0) {
                $content .= pdfRect(40, $tableY - $row['row_height'] + 2, 515, $row['row_height'], [249, 250, 251]);
            }

            $lineY = $tableY - 10;
            foreach ($row['title_lines'] as $line) {
                $content .= pdfText(50, $lineY, $line, 'F1', 9, [15, 23, 42]);
                $lineY -= 11;
            }

            $lineTotal = round((float) $row['quantity'] * (float) $row['unit_price'], 2);

            $content .= pdfText(345, $tableY - 10, (string) $row['quantity'], 'F1', 9, [31, 41, 55]);
            $content .= pdfText(400, $tableY - 10, formatMoney((float) $row['unit_price'], $currency, (string) ($cfg['format_locale'] ?? 'de')), 'F1', 9, [31, 41, 55]);
            $content .= pdfText(545, $tableY - 10, formatMoney($lineTotal, $currency, (string) ($cfg['format_locale'] ?? 'de')), 'F2', 9, [17, 24, 39], 'right');

            $tableY -= (float) $row['row_height'];
        }

        if ($isLastPage) {
            $panelTop = $tableY - 12;
            $content .= pdfRect(320, $panelTop - 82, 235, 82, [245, 247, 250]);
            $content .= pdfText(335, $panelTop - 16, t($language, 'net_total'), 'F1', 9, [51, 65, 85]);
            $content .= pdfText(545, $panelTop - 16, formatMoney($netTotal, $currency, (string) ($cfg['format_locale'] ?? 'de')), 'F2', 9, [17, 24, 39], 'right');
            $content .= pdfText(335, $panelTop - 34, t($language, 'vat') . ' (' . number_format($taxMode === 'vat' ? $vatRate : 0, 2, ',', '.') . '%)', 'F1', 9, [51, 65, 85]);
            $content .= pdfText(545, $panelTop - 34, formatMoney($vatAmount, $currency, (string) ($cfg['format_locale'] ?? 'de')), 'F2', 9, [17, 24, 39], 'right');
            $content .= pdfLine(330, $panelTop - 42, 545, $panelTop - 42, [203, 213, 225], 0.8);
            $content .= pdfText(335, $panelTop - 60, t($language, 'grand_total'), 'F2', 10, [17, 24, 39]);
            $content .= pdfText(545, $panelTop - 60, formatMoney($grossTotal, $currency, (string) ($cfg['format_locale'] ?? 'de')), 'F2', 11, [17, 24, 39], 'right');

            $footerY = max(70, $panelTop - 110);
            $content .= pdfLine(40, $footerY + 40, 555, $footerY + 40, [203, 213, 225], 0.8);
            $content .= pdfText(40, $footerY + 26, t($language, 'tax_information'), 'F2', 9, [17, 24, 39]);
            $content .= pdfText(40, $footerY + 12, buildTaxNote($taxMode, $vatRate, $language), 'F1', 8, [71, 85, 105]);

            $paymentLine = trim((string) ($cfg['payment_bank_name'] ?? '') . ' | IBAN ' . (string) ($cfg['payment_iban'] ?? '') . ' | BIC ' . (string) ($cfg['payment_bic'] ?? ''));
            if ($paymentLine !== '' && strpos($paymentLine, 'IBAN  |') === false) {
                $content .= pdfText(40, $footerY - 2, t($language, 'payment_details') . ': ' . $paymentLine, 'F1', 8, [71, 85, 105]);
            }

            $regLine = trim(t($language, 'vat_id') . ': ' . (string) ($cfg['seller_vat_id'] ?? '') . '  ' . t($language, 'tax_no') . ': ' . (string) ($cfg['seller_tax_number'] ?? ''));
            if ($regLine !== 'VAT ID:   Tax No:') {
                $content .= pdfText(40, $footerY - 16, $regLine, 'F1', 8, [71, 85, 105]);
            }

            $content .= pdfText(555, $footerY - 30, t($language, 'thanks'), 'F1', 8, [100, 116, 139], 'right');
        }

        $pages[] = $content;
    }

    return buildPdfDocument($pages, $logoImage);
}

function buildPdfDocument(array $pageContents, ?array $logoImage = null): string
{
    $pageCount = max(1, count($pageContents));

    $catalogObj = 1;
    $pagesObj = 2;
    $fontRegularObj = 3;
    $fontBoldObj = 4;

    $nextObj = 5;
    $logoAlphaObj = 0;
    $logoImageObj = 0;
    if ($logoImage !== null) {
        $logoAlphaObj = $nextObj++;
        $logoImageObj = $nextObj++;
    }

    $firstPageObj = $nextObj;
    $firstContentObj = $firstPageObj + $pageCount;
    $maxObj = $firstContentObj + $pageCount - 1;

    $objects = [];
    $objects[$catalogObj] = '<< /Type /Catalog /Pages ' . $pagesObj . ' 0 R >>';

    $kids = [];
    for ($i = 0; $i < $pageCount; $i++) {
        $kids[] = ($firstPageObj + $i) . ' 0 R';
    }
    $objects[$pagesObj] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $pageCount . ' >>';

    $objects[$fontRegularObj] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    $objects[$fontBoldObj] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

    if ($logoImage !== null) {
        $alphaData = (string) ($logoImage['alpha_data'] ?? '');
        $alphaLength = strlen($alphaData);
        $objects[$logoAlphaObj] = '<< /Type /XObject /Subtype /Image /Width ' . (int) $logoImage['width'] . ' /Height ' . (int) $logoImage['height'] . ' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ' . $alphaLength . ' >>' . "\nstream\n" . $alphaData . "\nendstream";

        $rgbData = (string) ($logoImage['rgb_data'] ?? '');
        $rgbLength = strlen($rgbData);
        $objects[$logoImageObj] = '<< /Type /XObject /Subtype /Image /Width ' . (int) $logoImage['width'] . ' /Height ' . (int) $logoImage['height'] . ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ' . $rgbLength . ' /SMask ' . $logoAlphaObj . ' 0 R >>' . "\nstream\n" . $rgbData . "\nendstream";
    }

    for ($i = 0; $i < $pageCount; $i++) {
        $contentObjNum = $firstContentObj + $i;

        $xObjectPart = '';
        if ($logoImage !== null) {
            $xObjectPart = ' /XObject << /ImLogo ' . $logoImageObj . ' 0 R >>';
        }

        $objects[$firstPageObj + $i] = '<< /Type /Page /Parent ' . $pagesObj . ' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ' . $fontRegularObj . ' 0 R /F2 ' . $fontBoldObj . ' 0 R >>' . $xObjectPart . ' >> /Contents ' . $contentObjNum . ' 0 R >>';
    }

    for ($i = 0; $i < $pageCount; $i++) {
        $pageContent = (string) ($pageContents[$i] ?? '');
        $objects[$firstContentObj + $i] = '<< /Length ' . strlen($pageContent) . ' >>' . "\nstream\n" . $pageContent . "\nendstream";
    }

    $pdf = "%PDF-1.4\n";
    $offsets = [0];

    for ($objNum = 1; $objNum <= $maxObj; $objNum++) {
        if (!isset($objects[$objNum])) {
            continue;
        }

        $offsets[$objNum] = strlen($pdf);
        $pdf .= $objNum . " 0 obj\n" . $objects[$objNum] . "\nendobj\n";
    }

    $xrefOffset = strlen($pdf);
    $pdf .= "xref\n0 " . ($maxObj + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= $maxObj; $i++) {
        $offset = $offsets[$i] ?? 0;
        $pdf .= str_pad((string) $offset, 10, '0', STR_PAD_LEFT) . " 00000 n \n";
    }

    $pdf .= "trailer\n<< /Size " . ($maxObj + 1) . " /Root 1 0 R >>\nstartxref\n" . $xrefOffset . "\n%%EOF";

    return $pdf;
}

function escapePdfText(string $text): string
{
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
    if ($ascii === false) {
        $ascii = $text;
    }

    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $ascii);
}

function getShopMysqli(): mysqli
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

    $host = firstNonEmpty($config['host'] ?? null, getenv('GALLERY_DB_HOST') ?: null, 'db5020224670.hosting-data.io');
    $port = (int) firstNonEmpty(isset($config['port']) ? (string) $config['port'] : null, getenv('GALLERY_DB_PORT') ?: null, '3306');
    $database = firstNonEmpty($config['database'] ?? null, getenv('GALLERY_DB_NAME') ?: null, 'dbs15552605');
    $user = firstNonEmpty($config['username'] ?? null, getenv('GALLERY_DB_USER') ?: null, 'dbu595115');
    $password = firstNonEmpty($config['password'] ?? null, getenv('GALLERY_DB_PASS') ?: null, getenv('GALLERY_DB_PASSWORD') ?: null, getenv('DB_PASSWORD') ?: null, '');
    $charset = firstNonEmpty($config['charset'] ?? null, getenv('GALLERY_DB_CHARSET') ?: null, 'utf8mb4');

    if ($database === '' || $user === '' || $password === '') {
        throw new RuntimeException('Database config missing.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli($host, $user, $password, $database, $port);
    $db->set_charset($charset);
    return $db;
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

function firstNonEmpty(?string ...$values): string
{
    foreach ($values as $value) {
        if ($value !== null && trim($value) !== '') {
            return trim($value);
        }
    }

    return '';
}

function pdfText(float $x, float $y, string $text, string $font, float $size, array $rgb, string $align = 'left'): string
{
    $safe = escapePdfText($text);
    $tx = $x;

    if ($align === 'right') {
        $textWidth = estimateTextWidth($text, $size);
        $tx = max(10.0, $x - $textWidth);
    } elseif ($align === 'center') {
        $textWidth = estimateTextWidth($text, $size);
        $tx = max(10.0, $x - ($textWidth / 2.0));
    }

    return sprintf(
        "BT\n/%s %.2f Tf\n%.3f %.3f %.3f rg\n1 0 0 1 %.2f %.2f Tm\n(%s) Tj\nET\n",
        $font,
        $size,
        clampColor($rgb[0] ?? 0),
        clampColor($rgb[1] ?? 0),
        clampColor($rgb[2] ?? 0),
        $tx,
        $y,
        $safe
    );
}

function pdfRect(float $x, float $y, float $w, float $h, array $fillRgb): string
{
    return sprintf(
        "q\n%.3f %.3f %.3f rg\n%.2f %.2f %.2f %.2f re f\nQ\n",
        clampColor($fillRgb[0] ?? 255),
        clampColor($fillRgb[1] ?? 255),
        clampColor($fillRgb[2] ?? 255),
        $x,
        $y,
        $w,
        $h
    );
}

function pdfLine(float $x1, float $y1, float $x2, float $y2, array $strokeRgb, float $lineWidth): string
{
    return sprintf(
        "q\n%.3f %.3f %.3f RG\n%.2f w\n%.2f %.2f m\n%.2f %.2f l S\nQ\n",
        clampColor($strokeRgb[0] ?? 0),
        clampColor($strokeRgb[1] ?? 0),
        clampColor($strokeRgb[2] ?? 0),
        $lineWidth,
        $x1,
        $y1,
        $x2,
        $y2
    );
}

function clampColor($value): float
{
    $num = max(0.0, min(255.0, (float) $value));
    return round($num / 255.0, 3);
}

function hexToRgb(string $hex): array
{
    $clean = ltrim(trim($hex), '#');
    if (strlen($clean) === 3) {
        $clean = $clean[0] . $clean[0] . $clean[1] . $clean[1] . $clean[2] . $clean[2];
    }
    if (strlen($clean) !== 6 || !ctype_xdigit($clean)) {
        return [17, 24, 39];
    }

    return [
        hexdec(substr($clean, 0, 2)),
        hexdec(substr($clean, 2, 2)),
        hexdec(substr($clean, 4, 2)),
    ];
}

function estimateTextWidth(string $text, float $fontSize): float
{
    $len = strlen(escapePdfText($text));
    return max(0.0, $len * $fontSize * 0.5);
}

function formatMoney(float $amount, string $currency, string $locale): string
{
    $code = strtoupper(trim($currency));
    if (strtolower(trim($locale)) === 'de') {
        return number_format($amount, 2, ',', '.') . ' ' . $code;
    }

    return number_format($amount, 2, '.', ',') . ' ' . $code;
}

function formatInvoiceDateByLocale(string $value, string $locale): string
{
    if ($value === '') {
        return strtolower(trim($locale)) === 'de' ? gmdate('d.m.Y') : gmdate('Y-m-d');
    }

    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return strtolower(trim($locale)) === 'de' ? gmdate('d.m.Y') : gmdate('Y-m-d');
    }

    return strtolower(trim($locale)) === 'de' ? gmdate('d.m.Y', $timestamp) : gmdate('Y-m-d', $timestamp);
}

function paginateInvoiceRows(array $rows, float $firstPageBudget, float $nextPageBudget): array
{
    $pages = [];
    $current = [];
    $budget = $firstPageBudget;
    $used = 0.0;

    foreach ($rows as $row) {
        $height = (float) ($row['row_height'] ?? 20);
        if (count($current) > 0 && ($used + $height) > $budget) {
            $pages[] = $current;
            $current = [];
            $budget = $nextPageBudget;
            $used = 0.0;
        }

        $current[] = $row;
        $used += $height;
    }

    if (count($current) > 0) {
        $pages[] = $current;
    }

    return $pages;
}

function renderFirstPageHeader(array $cfg, array $order, string $purchaseDate, bool $hasLogo, string $language = 'de'): string
{
    $content = '';
    $content .= pdfRect(0, 750, 595, 92, hexToRgb((string) ($cfg['brand_primary'] ?? '#111827')));
    $content .= pdfText(40, 806, (string) ($cfg['document_title'] ?? 'INVOICE / RECHNUNG'), 'F2', 20, [255, 255, 255]);
    $content .= pdfText(40, 784, (string) ($cfg['seller_name'] ?? 'Christian Boehme Photography'), 'F2', 12, [255, 255, 255]);
    $content .= pdfText(555, 806, (string) ($order['invoice_number'] ?? ''), 'F2', 11, [255, 255, 255], 'right');
    $content .= pdfText(555, 788, t($language, 'issue_date') . ': ' . $purchaseDate, 'F1', 9, [230, 230, 230], 'right');

    if ($hasLogo) {
        $logoSize = 198.43; // ~7cm in PDF points
        $logoX = 356;
        $logoY = 430;
        $content .= pdfRect($logoX - 2, $logoY - 2, $logoSize + 4, $logoSize + 4, [255, 255, 255]);
        $content .= pdfRect($logoX - 1, $logoY - 1, $logoSize + 2, $logoSize + 2, [241, 245, 249]);
        $content .= pdfImage('ImLogo', $logoX, $logoY, $logoSize, $logoSize);
    } else {
        $logoText = trim((string) ($cfg['brand_logo_text'] ?? ''));
        if ($logoText !== '') {
            $content .= pdfRect(500, 754, 55, 28, hexToRgb((string) ($cfg['brand_secondary'] ?? '#1E3A8A')));
            $content .= pdfText(527.5, 765, strtoupper(substr($logoText, 0, 8)), 'F2', 10, [255, 255, 255], 'center');
        }
    }

    return $content;
}

function renderContinuationHeader(array $cfg, array $order, string $purchaseDate, int $pageNo, bool $hasLogo, string $language = 'de'): string
{
    $content = '';
    $content .= pdfRect(0, 744, 595, 70, hexToRgb((string) ($cfg['brand_primary'] ?? '#111827')));
    $content .= pdfText(40, 786, (string) ($cfg['document_title'] ?? 'INVOICE / RECHNUNG') . ' (' . t($language, 'continued') . ')', 'F2', 14, [255, 255, 255]);
    $content .= pdfText(40, 768, (string) ($cfg['seller_name'] ?? 'Christian Boehme Photography'), 'F1', 10, [235, 235, 235]);
    $content .= pdfText(555, 786, (string) ($order['invoice_number'] ?? ''), 'F2', 10, [255, 255, 255], 'right');
    $content .= pdfText(555, 770, t($language, 'page') . ' ' . $pageNo . ' | ' . $purchaseDate, 'F1', 8, [230, 230, 230], 'right');

    if ($hasLogo) {
        $content .= pdfRect(500, 748, 44, 44, [255, 255, 255]);
        $content .= pdfRect(501, 749, 42, 42, [241, 245, 249]);
        $content .= pdfImage('ImLogo', 502, 750, 40, 40);
    }

    return $content;
}

function pdfImage(string $name, float $x, float $y, float $width, float $height): string
{
    return sprintf(
        "q\n%.2f 0 0 %.2f %.2f %.2f cm\n/%s Do\nQ\n",
        $width,
        $height,
        $x,
        $y,
        $name
    );
}

function loadInvoiceLogoImage(array $cfg): ?array
{
    $configuredPath = trim((string) ($cfg['brand_logo_path'] ?? ''));
    if ($configuredPath === '') {
        return null;
    }

    $absolutePath = resolveInvoiceAssetPath($configuredPath);
    if ($absolutePath === null || !is_file($absolutePath)) {
        return null;
    }

    $pngData = file_get_contents($absolutePath);
    if ($pngData === false) {
        return null;
    }

    return decodeRgbaPngForPdf($pngData);
}

function resolveInvoiceAssetPath(string $path): ?string
{
    $normalized = str_replace(['/', '\\\\'], DIRECTORY_SEPARATOR, $path);

    $isAbsolute = preg_match('/^[A-Za-z]:\\\\/', $normalized) === 1 || invoiceStartsWith($normalized, DIRECTORY_SEPARATOR);
    if ($isAbsolute) {
        return $normalized;
    }

    $candidates = [
        __DIR__ . '/../../' . $normalized,
        __DIR__ . '/../' . $normalized,
        __DIR__ . '/' . $normalized,
    ];

    foreach ($candidates as $candidate) {
        if (is_file($candidate)) {
            return $candidate;
        }
    }

    return null;
}

function decodeRgbaPngForPdf(string $pngData): ?array
{
    if (strlen($pngData) < 34 || substr($pngData, 0, 8) !== "\x89PNG\r\n\x1a\n") {
        return null;
    }

    $offset = 8;
    $width = 0;
    $height = 0;
    $bitDepth = 0;
    $colorType = 0;
    $idatData = '';

    while ($offset + 8 <= strlen($pngData)) {
        $length = unpack('N', substr($pngData, $offset, 4))[1];
        $chunkType = substr($pngData, $offset + 4, 4);
        $chunkData = substr($pngData, $offset + 8, $length);
        $offset += 12 + $length;

        if ($chunkType === 'IHDR') {
            $width = unpack('N', substr($chunkData, 0, 4))[1];
            $height = unpack('N', substr($chunkData, 4, 4))[1];
            $bitDepth = ord($chunkData[8] ?? "\x00");
            $colorType = ord($chunkData[9] ?? "\x00");
        } elseif ($chunkType === 'IDAT') {
            $idatData .= $chunkData;
        } elseif ($chunkType === 'IEND') {
            break;
        }
    }

    if ($width <= 0 || $height <= 0 || $bitDepth !== 8 || $colorType !== 6 || $idatData === '') {
        return null;
    }

    $decompressed = @gzuncompress($idatData);
    if (!is_string($decompressed)) {
        return null;
    }

    $stride = $width * 4;
    $scanlineLength = $stride + 1;
    if (strlen($decompressed) < $scanlineLength * $height) {
        return null;
    }

    $rgbRaw = '';
    $alphaRaw = '';
    $previous = str_repeat("\x00", $stride);

    for ($row = 0; $row < $height; $row++) {
        $base = $row * $scanlineLength;
        $filterType = ord($decompressed[$base]);
        $rowData = substr($decompressed, $base + 1, $stride);
        $recon = pngUnfilterScanline($rowData, $previous, $filterType, 4);
        $previous = $recon;

        for ($i = 0; $i < $stride; $i += 4) {
            $rgbRaw .= $recon[$i] . $recon[$i + 1] . $recon[$i + 2];
            $alphaRaw .= $recon[$i + 3];
        }
    }

    return [
        'width' => $width,
        'height' => $height,
        'rgb_data' => gzcompress($rgbRaw, 9),
        'alpha_data' => gzcompress($alphaRaw, 9),
    ];
}

function pngUnfilterScanline(string $current, string $previous, int $filterType, int $bpp): string
{
    $length = strlen($current);
    $result = '';

    for ($i = 0; $i < $length; $i++) {
        $x = ord($current[$i]);
        $left = $i >= $bpp ? ord($result[$i - $bpp]) : 0;
        $up = ord($previous[$i] ?? "\x00");
        $upLeft = $i >= $bpp ? ord($previous[$i - $bpp] ?? "\x00") : 0;

        if ($filterType === 0) {
            $recon = $x;
        } elseif ($filterType === 1) {
            $recon = ($x + $left) & 255;
        } elseif ($filterType === 2) {
            $recon = ($x + $up) & 255;
        } elseif ($filterType === 3) {
            $recon = ($x + intdiv($left + $up, 2)) & 255;
        } elseif ($filterType === 4) {
            $recon = ($x + paethPredictor($left, $up, $upLeft)) & 255;
        } else {
            $recon = $x;
        }

        $result .= chr($recon);
    }

    return $result;
}

function paethPredictor(int $a, int $b, int $c): int
{
    $p = $a + $b - $c;
    $pa = abs($p - $a);
    $pb = abs($p - $b);
    $pc = abs($p - $c);

    if ($pa <= $pb && $pa <= $pc) {
        return $a;
    }

    if ($pb <= $pc) {
        return $b;
    }

    return $c;
}

function renderTableHeader(array $cfg, float $rectY, float $textY, string $language = 'de'): string
{
    $content = '';
    $content .= pdfRect(40, $rectY, 515, 24, hexToRgb((string) ($cfg['brand_secondary'] ?? '#1E3A8A')));
    $content .= pdfText(50, $textY, t($language, 'description'), 'F2', 9, [255, 255, 255]);
    $content .= pdfText(340, $textY, t($language, 'qty'), 'F2', 9, [255, 255, 255]);
    $content .= pdfText(400, $textY, t($language, 'unit'), 'F2', 9, [255, 255, 255]);
    $content .= pdfText(545, $textY, t($language, 'total'), 'F2', 9, [255, 255, 255], 'right');
    return $content;
}

function calculateTaxBreakdown(float $grossTotal, float $vatRate, string $taxMode): array
{
    if ($grossTotal <= 0) {
        return [0.0, 0.0];
    }

    if ($taxMode !== 'vat' || $vatRate <= 0) {
        return [round($grossTotal, 2), 0.0];
    }

    $divider = 1 + ($vatRate / 100.0);
    $net = round($grossTotal / $divider, 2);
    $tax = round($grossTotal - $net, 2);

    return [$net, $tax];
}

function normalizeInvoiceItems(array $items, string $fallbackCurrency): array
{
    $normalized = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $title = trim((string) ($item['title'] ?? 'Digital image license'));
        $quantity = max(1, (int) ($item['quantity'] ?? 1));
        $unitPrice = round((float) ($item['unit_price'] ?? 0), 2);
        $currency = strtoupper(trim((string) ($item['currency'] ?? $fallbackCurrency)));

        $normalized[] = [
            'title' => $title !== '' ? $title : 'Digital image license',
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'currency' => $currency,
        ];
    }

    if (count($normalized) === 0) {
        $normalized[] = [
            'title' => 'Digital image license',
            'quantity' => 1,
            'unit_price' => 0.0,
            'currency' => $fallbackCurrency,
        ];
    }

    return $normalized;
}

function splitTextLines(string $text, int $maxChars): array
{
    $clean = trim(preg_replace('/\s+/', ' ', $text) ?? '');
    if ($clean === '') {
        return [''];
    }

    $words = explode(' ', $clean);
    $lines = [];
    $current = '';
    foreach ($words as $word) {
        $candidate = $current === '' ? $word : ($current . ' ' . $word);
        if (strlen($candidate) <= $maxChars) {
            $current = $candidate;
            continue;
        }

        if ($current !== '') {
            $lines[] = $current;
        }
        $current = $word;
    }
    if ($current !== '') {
        $lines[] = $current;
    }

    return $lines;
}

function buildTaxNote(string $taxMode, float $vatRate, string $language = 'de'): string
{
    if ($taxMode === 'small_business') {
        return $language === 'de'
            ? 'Es wird keine Umsatzsteuer ausgewiesen (Kleinunternehmerregelung nach 19 UStG).'
            : 'No VAT shown due to small-business scheme (Sec. 19 UStG).';
    }

    if ($taxMode === 'reverse_charge') {
        return $language === 'de'
            ? 'Reverse-Charge-Verfahren: Die Steuerschuld geht auf den Leistungsempfaenger ueber (Art. 196 MwStSystRL).'
            : 'Reverse charge applies. VAT liability shifts to recipient (Art. 196 VAT Directive).';
    }

    return $language === 'de'
        ? 'Umsatzsteuer ist enthalten und gemaess den geltenden deutschen und EU-Rechnungsregeln ausgewiesen.'
        : 'VAT included and reported according to applicable German and EU invoicing rules.';
}

function loadInvoiceConfig(): array
{
    $config = [];
    $candidateSecretPaths = [
        __DIR__ . '/../../secrets/invoice.local.php',
        __DIR__ . '/../secrets/invoice.local.php',
        __DIR__ . '/invoice.local.php',
    ];

    $documentRoot = isset($_SERVER['DOCUMENT_ROOT']) ? rtrim((string) $_SERVER['DOCUMENT_ROOT'], DIRECTORY_SEPARATOR) : '';
    if ($documentRoot !== '') {
        $candidateSecretPaths[] = $documentRoot . '/secrets/invoice.local.php';
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

    return [
        'document_title' => firstNonEmpty($config['document_title'] ?? null, 'INVOICE / RECHNUNG'),
        'seller_name' => firstNonEmpty($config['seller_name'] ?? null, 'Christian Boehme Photography'),
        'seller_street' => firstNonEmpty($config['seller_street'] ?? null, ''),
        'seller_postal_code' => firstNonEmpty($config['seller_postal_code'] ?? null, ''),
        'seller_city' => firstNonEmpty($config['seller_city'] ?? null, ''),
        'seller_country' => firstNonEmpty($config['seller_country'] ?? null, 'Germany'),
        'seller_email' => firstNonEmpty($config['seller_email'] ?? null, 'contact@christian-boehme.com'),
        'seller_vat_id' => firstNonEmpty($config['seller_vat_id'] ?? null, ''),
        'seller_tax_number' => firstNonEmpty($config['seller_tax_number'] ?? null, ''),
        'payment_bank_name' => firstNonEmpty($config['payment_bank_name'] ?? null, ''),
        'payment_iban' => firstNonEmpty($config['payment_iban'] ?? null, ''),
        'payment_bic' => firstNonEmpty($config['payment_bic'] ?? null, ''),
        'tax_mode' => normalizeTaxMode(firstNonEmpty($config['tax_mode'] ?? null, 'vat')),
        'vat_rate' => (float) firstNonEmpty(isset($config['vat_rate']) ? (string) $config['vat_rate'] : null, '19'),
        'brand_primary' => firstNonEmpty($config['brand_primary'] ?? null, '#111827'),
        'brand_secondary' => firstNonEmpty($config['brand_secondary'] ?? null, '#1E3A8A'),
        'brand_logo_text' => firstNonEmpty($config['brand_logo_text'] ?? null, ''),
        'brand_logo_path' => firstNonEmpty($config['brand_logo_path'] ?? null, 'public/assets/img/logos/christian-boehme-logo-512px.png'),
        'format_locale' => normalizeInvoiceLocale(firstNonEmpty($config['format_locale'] ?? null, 'de')),
    ];
}

function normalizeInvoiceLocale(string $locale): string
{
    $value = strtolower(trim($locale));
    if (in_array($value, ['de', 'intl'], true)) {
        return $value;
    }

    return 'de';
}

function normalizeTaxMode(string $taxMode): string
{
    $value = strtolower(trim($taxMode));
    if (in_array($value, ['vat', 'small_business', 'reverse_charge'], true)) {
        return $value;
    }

    return 'vat';
}

function stmtFetchAllAssoc(mysqli_stmt $stmt): array
{
    if (method_exists($stmt, 'get_result')) {
        $result = $stmt->get_result();
        if ($result === false) {
            return [];
        }

        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }

        return $rows;
    }

    $metadata = $stmt->result_metadata();
    if (!$metadata) {
        return [];
    }

    $fields = $metadata->fetch_fields();
    $row = [];
    $bindRefs = [];
    foreach ($fields as $field) {
        $row[$field->name] = null;
        $bindRefs[] = &$row[$field->name];
    }

    call_user_func_array([$stmt, 'bind_result'], $bindRefs);

    $rows = [];
    while ($stmt->fetch()) {
        $copy = [];
        foreach ($row as $key => $value) {
            $copy[$key] = $value;
        }
        $rows[] = $copy;
    }

    return $rows;
}

function resolvePdfLanguage(string $value): string
{
    $lang = strtolower(trim($value));
    if ($lang === 'en') {
        return 'en';
    }

    return 'de';
}

function t(string $lang, string $key): string
{
    $de = [
        'seller' => 'Verkaeufer',
        'bill_to' => 'Rechnung an',
        'company' => 'Firma',
        'paypal_order' => 'PayPal-Bestellung',
        'capture_id' => 'Capture-ID',
        'invoice_no' => 'Rechnungsnr.',
        'service_date' => 'Leistungsdatum',
        'description' => 'Beschreibung',
        'qty' => 'Menge',
        'unit' => 'Einzelpreis',
        'total' => 'Gesamt',
        'net_total' => 'Netto',
        'vat' => 'USt.',
        'grand_total' => 'Brutto',
        'tax_information' => 'Steuerhinweis',
        'payment_details' => 'Zahlungsdetails',
        'vat_id' => 'USt-IdNr',
        'tax_no' => 'Steuernr',
        'thanks' => 'Vielen Dank fuer Ihren Einkauf.',
        'issue_date' => 'Ausgestellt am',
        'continued' => 'Fortsetzung',
        'page' => 'Seite',
    ];

    $en = [
        'seller' => 'Seller',
        'bill_to' => 'Bill to',
        'company' => 'Company',
        'paypal_order' => 'PayPal order',
        'capture_id' => 'Capture ID',
        'invoice_no' => 'Invoice no.',
        'service_date' => 'Service date',
        'description' => 'Description',
        'qty' => 'Qty',
        'unit' => 'Unit price',
        'total' => 'Total',
        'net_total' => 'Net total',
        'vat' => 'VAT',
        'grand_total' => 'Grand total',
        'tax_information' => 'Tax information',
        'payment_details' => 'Payment details',
        'vat_id' => 'VAT ID',
        'tax_no' => 'Tax no.',
        'thanks' => 'Thank you for your purchase.',
        'issue_date' => 'Issued on',
        'continued' => 'Continued',
        'page' => 'Page',
    ];

    $dict = $lang === 'en' ? $en : $de;
    return $dict[$key] ?? $key;
}

function invoiceStartsWith(string $haystack, string $needle): bool
{
    if ($needle === '') {
        return true;
    }

    if (function_exists('str_starts_with')) {
        return str_starts_with($haystack, $needle);
    }

    return strpos($haystack, $needle) === 0;
}
