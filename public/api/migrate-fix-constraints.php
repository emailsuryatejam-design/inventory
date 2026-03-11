<?php
/**
 * Migration: Fix multi-tenant unique constraints
 *
 * Problem: items.item_code and suppliers.supplier_code have UNIQUE indexes
 * that are NOT scoped to tenant_id, causing new tenants to fail when
 * generating codes like ITM-0001 that already exist in other tenants.
 *
 * Fix: Drop global UNIQUE and replace with UNIQUE(tenant_id, column)
 */

require_once __DIR__ . '/config.php';

$pdo = getDB();
$results = [];

// Helper to run SQL safely
function runSql($pdo, $sql, $desc) {
    global $results;
    try {
        $pdo->exec($sql);
        $results[] = "OK: {$desc}";
    } catch (Exception $e) {
        $msg = $e->getMessage();
        // Ignore "Can't DROP" errors (index doesn't exist)
        if (strpos($msg, "check that column/key exists") !== false ||
            strpos($msg, "Can't DROP") !== false) {
            $results[] = "SKIP: {$desc} (already done)";
        } else {
            $results[] = "ERR: {$desc} — {$msg}";
        }
    }
}

// ── 1. Fix items table ──────────────────────────────────────────

// Find and list current indexes on items
$indexes = $pdo->query("SHOW INDEX FROM items")->fetchAll(PDO::FETCH_ASSOC);
$itemIndexes = [];
foreach ($indexes as $idx) {
    $itemIndexes[$idx['Key_name']][] = $idx['Column_name'];
}
$results[] = "Items indexes: " . json_encode($itemIndexes);

// Drop global unique on item_code (various possible names)
$possibleItemCodeIndexes = ['item_code', 'uk_item_code', 'uq_item_code', 'items_item_code_unique', 'idx_item_code'];
foreach ($possibleItemCodeIndexes as $idxName) {
    if (isset($itemIndexes[$idxName])) {
        $cols = $itemIndexes[$idxName];
        // Only drop if it's NOT already tenant-scoped
        if (!in_array('tenant_id', $cols)) {
            runSql($pdo, "ALTER TABLE items DROP INDEX `{$idxName}`", "Drop items.{$idxName}");
        } else {
            $results[] = "SKIP: items.{$idxName} already tenant-scoped";
        }
    }
}

// Also check for any unique index that contains item_code but not tenant_id
foreach ($itemIndexes as $idxName => $cols) {
    if (in_array('item_code', $cols) && !in_array('tenant_id', $cols) && $idxName !== 'PRIMARY') {
        runSql($pdo, "ALTER TABLE items DROP INDEX `{$idxName}`", "Drop items.{$idxName} (contains item_code without tenant_id)");
    }
}

// Create tenant-scoped unique index on item_code
runSql($pdo, "ALTER TABLE items ADD UNIQUE INDEX uq_tenant_item_code (tenant_id, item_code)", "Add UNIQUE(tenant_id, item_code) on items");

// Also check for name uniqueness issues
foreach ($itemIndexes as $idxName => $cols) {
    if (in_array('name', $cols) && !in_array('tenant_id', $cols) && $idxName !== 'PRIMARY') {
        runSql($pdo, "ALTER TABLE items DROP INDEX `{$idxName}`", "Drop items.{$idxName} (contains name without tenant_id)");
    }
}

// ── 2. Fix suppliers table ──────────────────────────────────────

$indexes = $pdo->query("SHOW INDEX FROM suppliers")->fetchAll(PDO::FETCH_ASSOC);
$supplierIndexes = [];
foreach ($indexes as $idx) {
    $supplierIndexes[$idx['Key_name']][] = $idx['Column_name'];
}
$results[] = "Supplier indexes: " . json_encode($supplierIndexes);

// Drop global unique on supplier_code
foreach ($supplierIndexes as $idxName => $cols) {
    if ($idxName === 'PRIMARY') continue;
    // Drop any unique index that doesn't include tenant_id
    if (!in_array('tenant_id', $cols)) {
        // Check if it's actually unique
        $isUnique = false;
        foreach ($indexes as $idx) {
            if ($idx['Key_name'] === $idxName && $idx['Non_unique'] == 0) {
                $isUnique = true;
                break;
            }
        }
        if ($isUnique) {
            runSql($pdo, "ALTER TABLE suppliers DROP INDEX `{$idxName}`", "Drop suppliers.{$idxName} (unique without tenant_id)");
        }
    }
}

// Create tenant-scoped unique on supplier_code if column exists
$supplierCols = $pdo->query("SHOW COLUMNS FROM suppliers")->fetchAll(PDO::FETCH_COLUMN);
if (in_array('supplier_code', $supplierCols)) {
    runSql($pdo, "ALTER TABLE suppliers ADD UNIQUE INDEX uq_tenant_supplier_code (tenant_id, supplier_code)", "Add UNIQUE(tenant_id, supplier_code) on suppliers");
}
if (in_array('code', $supplierCols)) {
    runSql($pdo, "ALTER TABLE suppliers ADD UNIQUE INDEX uq_tenant_supplier_code2 (tenant_id, code)", "Add UNIQUE(tenant_id, code) on suppliers");
}

// ── 3. Fix stock_balances tenant isolation ───────────────────────
// Check if stock_camp.php properly filters by tenant_id
$results[] = "--- stock_balances check ---";
$sbIndexes = $pdo->query("SHOW INDEX FROM stock_balances")->fetchAll(PDO::FETCH_ASSOC);
$sbIdxMap = [];
foreach ($sbIndexes as $idx) {
    $sbIdxMap[$idx['Key_name']][] = $idx['Column_name'];
}
$results[] = "stock_balances indexes: " . json_encode($sbIdxMap);

// Check if tenant_id column exists on stock_balances
$sbCols = $pdo->query("SHOW COLUMNS FROM stock_balances")->fetchAll(PDO::FETCH_COLUMN);
$results[] = "stock_balances columns: " . json_encode($sbCols);

// ── 4. Full schema debug ────────────────────────
$debugTables = ['camp_modules', 'stock_adjustments', 'stock_adjustment_lines', 'purchase_orders', 'purchase_order_lines'];
foreach ($debugTables as $dt) {
    try {
        $dtCols = $pdo->query("SHOW COLUMNS FROM {$dt}")->fetchAll(PDO::FETCH_ASSOC);
        $colInfo = array_map(fn($c) => $c['Field'] . ':' . $c['Type'] . ($c['Null'] === 'NO' ? ':NN' : '') . ($c['Default'] !== null ? ':d=' . $c['Default'] : ''), $dtCols);
        $results[] = "{$dt}: " . json_encode($colInfo);
    } catch (Exception $e) {
        $results[] = "{$dt}: ERR " . $e->getMessage();
    }
}

header('Content-Type: application/json');
echo json_encode(['results' => $results], JSON_PRETTY_PRINT);
