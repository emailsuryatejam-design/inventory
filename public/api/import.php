<?php
/**
 * WebSquare — Data Import (CSV)
 * POST /api/import.php
 * Multipart form: file (CSV), entity (items|suppliers), mode (validate|import)
 *
 * Two modes:
 *   mode=validate  — parse file, return preview (no DB changes)
 *   mode=import    — parse file, validate, insert into DB
 *
 * Admin/Director only. All inserts include tenant_id.
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('POST required', 405);
}

$auth = requireAdmin();
$tenantId = requireTenant($auth);

if (empty($_FILES['file'])) {
    jsonError('No file uploaded. Send a CSV file as "file" field.', 400);
}

$file = $_FILES['file'];
$entity = trim($_POST['entity'] ?? 'items');
$mode = trim($_POST['mode'] ?? 'validate');

// ── File validation ───────────────────────────────
$maxSize = 5 * 1024 * 1024; // 5MB
if ($file['size'] > $maxSize) {
    jsonError('File too large. Maximum size is 5MB.', 400);
}

if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonError('File upload failed. Error code: ' . $file['error'], 400);
}

// Check MIME type
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$allowedMimes = ['text/csv', 'text/plain', 'application/csv',
                 'application/vnd.ms-excel', 'text/x-csv'];
if (!in_array($mimeType, $allowedMimes)) {
    jsonError('Invalid file type (' . $mimeType . '). Please upload a CSV file.', 400);
}

// ── Parse CSV ────────────────────────────────────
$handle = fopen($file['tmp_name'], 'r');
if (!$handle) {
    jsonError('Cannot read uploaded file', 500);
}

$headers = fgetcsv($handle);
if (!$headers || empty($headers)) {
    fclose($handle);
    jsonError('Empty file or invalid CSV format', 400);
}

// Strip BOM from first header if present
$headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]);
$headers = array_map('trim', $headers);

$rows = [];
$lineNum = 1;
while (($row = fgetcsv($handle)) !== false) {
    $lineNum++;
    // Skip completely empty rows
    if (count($row) === 1 && trim($row[0]) === '') continue;

    if (count($row) !== count($headers)) {
        // Pad or trim to match header count
        $row = array_pad($row, count($headers), '');
        $row = array_slice($row, 0, count($headers));
    }
    $rows[] = ['line' => $lineNum, 'data' => array_combine($headers, array_map('trim', $row))];
}
fclose($handle);

if (empty($rows)) {
    jsonError('No data rows found in the CSV file', 400);
}

$pdo = getDB();

// ── Entity-specific processing ──────────────────
switch ($entity) {
    case 'items':
        $result = processItemsImport($pdo, $tenantId, $rows, $mode, (int)$auth['user_id']);
        break;
    case 'suppliers':
        $result = processSuppliersImport($pdo, $tenantId, $rows, $mode);
        break;
    default:
        jsonError("Unknown entity: {$entity}. Use: items, suppliers", 400);
}

jsonResponse($result);

// ═══════════════════════════════════════════════════
// ITEMS IMPORT
// ═══════════════════════════════════════════════════

function processItemsImport(PDO $pdo, int $tenantId, array $rows, string $mode, int $userId): array
{
    $errors = [];
    $valid = [];

    // Pre-fetch lookup tables for validation
    $groupStmt = $pdo->prepare("SELECT id, code FROM item_groups WHERE tenant_id = ?");
    $groupStmt->execute([$tenantId]);
    $groupMap = array_column($groupStmt->fetchAll(), 'id', 'code'); // code => id

    $uomStmt = $pdo->prepare("SELECT id, code FROM units_of_measure WHERE tenant_id = ?");
    $uomStmt->execute([$tenantId]);
    $uomMap = array_column($uomStmt->fetchAll(), 'id', 'code'); // code => id

    // Existing item codes for duplicate detection
    $existStmt = $pdo->prepare("SELECT item_code FROM items WHERE tenant_id = ?");
    $existStmt->execute([$tenantId]);
    $existingCodes = $existStmt->fetchAll(PDO::FETCH_COLUMN);
    $existingSet = array_flip($existingCodes);

    // Track codes within this import for intra-file duplicate detection
    $importCodes = [];

    foreach ($rows as $entry) {
        $lineNum = $entry['line'];
        $row = $entry['data'];
        $rowErrors = [];

        // Required: Name
        $name = $row['Name'] ?? '';
        if (empty($name)) {
            $rowErrors[] = 'Name is required';
        }

        // Item Code (optional — auto-generate if empty)
        $itemCode = $row['Item Code'] ?? '';
        if ($itemCode) {
            if (isset($existingSet[$itemCode])) {
                $rowErrors[] = "Item code '{$itemCode}' already exists";
            }
            if (isset($importCodes[$itemCode])) {
                $rowErrors[] = "Duplicate item code '{$itemCode}' in file (also on line {$importCodes[$itemCode]})";
            }
            $importCodes[$itemCode] = $lineNum;
        }

        // Group code validation
        $groupId = null;
        $groupCode = $row['Group Code'] ?? '';
        if ($groupCode) {
            $groupId = $groupMap[$groupCode] ?? null;
            if (!$groupId) {
                $rowErrors[] = "Unknown group code: '{$groupCode}'";
            }
        }

        // UOM validations
        $stockUomId = null;
        $stockUomCode = $row['Stock UOM Code'] ?? '';
        if ($stockUomCode) {
            $stockUomId = $uomMap[$stockUomCode] ?? null;
            if (!$stockUomId) {
                $rowErrors[] = "Unknown stock UOM: '{$stockUomCode}'";
            }
        }

        $purchaseUomId = null;
        $purchaseUomCode = $row['Purchase UOM Code'] ?? '';
        if ($purchaseUomCode) {
            $purchaseUomId = $uomMap[$purchaseUomCode] ?? null;
            if (!$purchaseUomId) {
                $rowErrors[] = "Unknown purchase UOM: '{$purchaseUomCode}'";
            }
        }

        $issueUomId = null;
        $issueUomCode = $row['Issue UOM Code'] ?? '';
        if ($issueUomCode) {
            $issueUomId = $uomMap[$issueUomCode] ?? null;
            if (!$issueUomId) {
                $rowErrors[] = "Unknown issue UOM: '{$issueUomCode}'";
            }
        }

        // ABC Class validation
        $abcClass = strtoupper($row['ABC Class'] ?? 'C');
        if (!in_array($abcClass, ['A', 'B', 'C'])) {
            $rowErrors[] = "ABC Class must be A, B, or C (got: '{$abcClass}')";
            $abcClass = 'C';
        }

        // Storage type validation
        $storageType = strtolower($row['Storage Type'] ?? 'ambient');
        if (!in_array($storageType, ['ambient', 'chilled', 'frozen', 'hazardous'])) {
            $rowErrors[] = "Storage Type must be: ambient, chilled, frozen, or hazardous";
            $storageType = 'ambient';
        }

        if ($rowErrors) {
            $errors[] = ['line' => $lineNum, 'errors' => $rowErrors, 'data' => $row];
        } else {
            $valid[] = [
                'line' => $lineNum,
                'row' => $row,
                'item_code' => $itemCode,
                'name' => $name,
                'description' => $row['Description'] ?? null,
                'group_id' => $groupId,
                'stock_uom_id' => $stockUomId,
                'purchase_uom_id' => $purchaseUomId ?: $stockUomId,
                'issue_uom_id' => $issueUomId ?: $stockUomId,
                'abc_class' => $abcClass,
                'storage_type' => $storageType,
                'is_perishable' => parseBool($row['Is Perishable'] ?? 'No'),
                'is_critical' => parseBool($row['Is Critical'] ?? 'No'),
                'shelf_life_days' => numOrNull($row['Shelf Life Days'] ?? ''),
                'min_order_qty' => numOrNull($row['Min Order Qty'] ?? ''),
                'standard_pack_size' => numOrNull($row['Standard Pack Size'] ?? ''),
            ];
        }
    }

    // ── Validate mode: return preview ──
    if ($mode === 'validate') {
        return [
            'mode' => 'validate',
            'entity' => 'items',
            'total_rows' => count($rows),
            'valid_count' => count($valid),
            'error_count' => count($errors),
            'errors' => array_slice($errors, 0, 50),
            'preview' => array_slice(array_map(fn($v) => $v['row'], $valid), 0, 10),
            'available_groups' => array_keys($groupMap),
            'available_uoms' => array_keys($uomMap),
        ];
    }

    // ── Import mode: insert valid rows ──
    $inserted = 0;
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO items (
                tenant_id, item_code, name, description,
                item_group_id, stock_uom_id, purchase_uom_id, issue_uom_id,
                abc_class, storage_type,
                is_perishable, is_critical,
                shelf_life_days, min_order_qty, standard_pack_size,
                is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ");

        // Auto-generate item codes if needed
        $nextAutoNum = getNextAutoItemNumber($pdo, $tenantId);

        foreach ($valid as $v) {
            $code = $v['item_code'];
            if (!$code) {
                $code = 'ITM-' . str_pad($nextAutoNum++, 4, '0', STR_PAD_LEFT);
            }

            $stmt->execute([
                $tenantId,
                $code,
                $v['name'],
                $v['description'],
                $v['group_id'],
                $v['stock_uom_id'],
                $v['purchase_uom_id'],
                $v['issue_uom_id'],
                $v['abc_class'],
                $v['storage_type'],
                $v['is_perishable'],
                $v['is_critical'],
                $v['shelf_life_days'],
                $v['min_order_qty'],
                $v['standard_pack_size'],
            ]);
            $inserted++;
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        return [
            'mode' => 'import',
            'success' => false,
            'message' => 'Import failed: ' . $e->getMessage(),
            'inserted' => $inserted,
        ];
    }

    return [
        'mode' => 'import',
        'entity' => 'items',
        'success' => true,
        'total_rows' => count($rows),
        'inserted' => $inserted,
        'error_count' => count($errors),
        'errors' => array_slice($errors, 0, 50),
    ];
}

// ═══════════════════════════════════════════════════
// SUPPLIERS IMPORT
// ═══════════════════════════════════════════════════

function processSuppliersImport(PDO $pdo, int $tenantId, array $rows, string $mode): array
{
    $errors = [];
    $valid = [];

    // Existing supplier codes
    $existStmt = $pdo->prepare("SELECT code FROM suppliers WHERE tenant_id = ?");
    $existStmt->execute([$tenantId]);
    $existingCodes = array_flip($existStmt->fetchAll(PDO::FETCH_COLUMN));

    $importCodes = [];

    foreach ($rows as $entry) {
        $lineNum = $entry['line'];
        $row = $entry['data'];
        $rowErrors = [];

        $name = $row['Name'] ?? '';
        if (empty($name)) {
            $rowErrors[] = 'Name is required';
        }

        $code = $row['Code'] ?? '';
        if ($code) {
            if (isset($existingCodes[$code])) {
                $rowErrors[] = "Supplier code '{$code}' already exists";
            }
            if (isset($importCodes[$code])) {
                $rowErrors[] = "Duplicate code '{$code}' in file";
            }
            $importCodes[$code] = $lineNum;
        }

        if ($rowErrors) {
            $errors[] = ['line' => $lineNum, 'errors' => $rowErrors, 'data' => $row];
        } else {
            $valid[] = [
                'line' => $lineNum,
                'row' => $row,
                'code' => $code,
                'name' => $name,
                'contact_person' => $row['Contact Person'] ?? null,
                'email' => $row['Email'] ?? null,
                'phone' => $row['Phone'] ?? null,
                'address' => $row['Address'] ?? null,
                'city' => $row['City'] ?? null,
                'country' => $row['Country'] ?? null,
                'payment_terms' => $row['Payment Terms'] ?? null,
                'lead_time_days' => numOrNull($row['Lead Time Days'] ?? ''),
            ];
        }
    }

    if ($mode === 'validate') {
        return [
            'mode' => 'validate',
            'entity' => 'suppliers',
            'total_rows' => count($rows),
            'valid_count' => count($valid),
            'error_count' => count($errors),
            'errors' => array_slice($errors, 0, 50),
            'preview' => array_slice(array_map(fn($v) => $v['row'], $valid), 0, 10),
        ];
    }

    $inserted = 0;
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("
            INSERT INTO suppliers (
                tenant_id, code, name, contact_person, email, phone,
                address, city, country, payment_terms, lead_time_days,
                is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ");

        $nextAutoNum = getNextAutoSupplierNumber($pdo, $tenantId);

        foreach ($valid as $v) {
            $code = $v['code'];
            if (!$code) {
                $code = 'SUP-' . str_pad($nextAutoNum++, 3, '0', STR_PAD_LEFT);
            }

            $stmt->execute([
                $tenantId,
                $code,
                $v['name'],
                $v['contact_person'],
                $v['email'],
                $v['phone'],
                $v['address'],
                $v['city'],
                $v['country'],
                $v['payment_terms'],
                $v['lead_time_days'],
            ]);
            $inserted++;
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        return [
            'mode' => 'import',
            'success' => false,
            'message' => 'Import failed: ' . $e->getMessage(),
            'inserted' => $inserted,
        ];
    }

    return [
        'mode' => 'import',
        'entity' => 'suppliers',
        'success' => true,
        'total_rows' => count($rows),
        'inserted' => $inserted,
        'error_count' => count($errors),
        'errors' => array_slice($errors, 0, 50),
    ];
}

// ═══════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════

function parseBool($value): int
{
    $v = strtolower(trim($value));
    return in_array($v, ['yes', 'true', '1', 'y']) ? 1 : 0;
}

function numOrNull($value)
{
    $v = trim($value);
    if ($v === '' || $v === null) return null;
    return is_numeric($v) ? (float) $v : null;
}

function getNextAutoItemNumber(PDO $pdo, int $tenantId): int
{
    $stmt = $pdo->prepare("
        SELECT item_code FROM items WHERE tenant_id = ? AND item_code LIKE 'ITM-%'
        ORDER BY item_code DESC LIMIT 1
    ");
    $stmt->execute([$tenantId]);
    $last = $stmt->fetchColumn();
    if ($last && preg_match('/ITM-(\d+)$/', $last, $m)) {
        return (int) $m[1] + 1;
    }
    return 1;
}

function getNextAutoSupplierNumber(PDO $pdo, int $tenantId): int
{
    $stmt = $pdo->prepare("
        SELECT code FROM suppliers WHERE tenant_id = ? AND code LIKE 'SUP-%'
        ORDER BY code DESC LIMIT 1
    ");
    $stmt->execute([$tenantId]);
    $last = $stmt->fetchColumn();
    if ($last && preg_match('/SUP-(\d+)$/', $last, $m)) {
        return (int) $m[1] + 1;
    }
    return 1;
}
