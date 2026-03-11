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

// ── 4. Fix number_sequences unique key to include tenant_id ─────
$nsIndexes = $pdo->query("SHOW INDEX FROM number_sequences")->fetchAll(PDO::FETCH_ASSOC);
$nsIdxMap = [];
foreach ($nsIndexes as $idx) {
    $nsIdxMap[$idx['Key_name']][] = $idx['Column_name'];
}
$results[] = "number_sequences indexes: " . json_encode($nsIdxMap);

// Drop uk_seq if it doesn't include tenant_id
if (isset($nsIdxMap['uk_seq']) && !in_array('tenant_id', $nsIdxMap['uk_seq'])) {
    runSql($pdo, "ALTER TABLE number_sequences DROP INDEX `uk_seq`", "Drop number_sequences.uk_seq (missing tenant_id)");
    runSql($pdo, "ALTER TABLE number_sequences ADD UNIQUE INDEX uk_seq (tenant_id, prefix, camp_code, current_year, current_month)", "Add tenant-scoped uk_seq on number_sequences");
} else {
    $results[] = "SKIP: number_sequences.uk_seq already includes tenant_id or doesn't exist";
}

// ── 5. Create cost centers for tenants that don't have any ─────
$tenantsMissingCC = $pdo->query("
    SELECT DISTINCT t.id as tenant_id, c.id as camp_id, c.code as camp_code, c.name as camp_name
    FROM camps c
    JOIN tenants t ON c.tenant_id = t.id
    WHERE t.id NOT IN (SELECT DISTINCT tenant_id FROM cost_centers)
    ORDER BY t.id, c.id
")->fetchAll(PDO::FETCH_ASSOC);

if (count($tenantsMissingCC) > 0) {
    $ccInsert = $pdo->prepare("INSERT IGNORE INTO cost_centers (tenant_id, code, name, is_active) VALUES (?, ?, ?, 1)");
    foreach ($tenantsMissingCC as $row) {
        $ccInsert->execute([$row['tenant_id'], $row['camp_code'], $row['camp_name']]);
    }
    $results[] = "OK: Created cost centers for " . count($tenantsMissingCC) . " tenant/camp combos";
} else {
    $results[] = "SKIP: All tenants have cost centers";
}

// Direct-insert cost centers for any tenant that's missing them
$missingTenants = $pdo->query("
    SELECT DISTINCT c.tenant_id, c.id as camp_id, c.code, c.name
    FROM camps c
    WHERE c.tenant_id NOT IN (SELECT DISTINCT tenant_id FROM cost_centers WHERE tenant_id IS NOT NULL)
")->fetchAll(PDO::FETCH_ASSOC);
$results[] = "Missing CC tenants: " . json_encode(array_column($missingTenants, 'tenant_id'));
if (count($missingTenants) > 0) {
    $ccDirect = $pdo->prepare("INSERT INTO cost_centers (tenant_id, code, name, is_active) VALUES (?, ?, ?, 1)");
    foreach ($missingTenants as $row) {
        try { $ccDirect->execute([$row['tenant_id'], $row['code'], $row['name']]); } catch(Exception $e) { /* ignore dupes */ }
        try { $ccDirect->execute([$row['tenant_id'], 'BAR', 'Bar']); } catch(Exception $e) {}
        try { $ccDirect->execute([$row['tenant_id'], 'KIT', 'Kitchen']); } catch(Exception $e) {}
    }
    $results[] = "OK: Inserted cost centers for tenants: " . implode(',', array_column($missingTenants, 'tenant_id'));
}

// Fix cost_centers unique key to be tenant-scoped
$ccIdxs = $pdo->query("SHOW INDEX FROM cost_centers")->fetchAll(PDO::FETCH_ASSOC);
$ccIdxMap = [];
foreach ($ccIdxs as $idx) { $ccIdxMap[$idx['Key_name']][] = $idx['Column_name']; }
if (isset($ccIdxMap['uk_cc_code']) && !in_array('tenant_id', $ccIdxMap['uk_cc_code'])) {
    runSql($pdo, "ALTER TABLE cost_centers DROP INDEX `uk_cc_code`", "Drop cost_centers.uk_cc_code (not tenant-scoped)");
    runSql($pdo, "ALTER TABLE cost_centers ADD UNIQUE INDEX uk_cc_code (tenant_id, code)", "Add tenant-scoped uk_cc_code");
}

// Debug cost_centers table schema
$ccSchema = $pdo->query("SHOW COLUMNS FROM cost_centers")->fetchAll(PDO::FETCH_ASSOC);
$ccSchemaInfo = array_map(fn($c) => $c['Field'] . ':' . $c['Type'] . ($c['Null'] === 'NO' ? ':NN' : '') . ($c['Default'] !== null ? ':d=' . $c['Default'] : ''), $ccSchema);
$results[] = "cost_centers schema: " . json_encode($ccSchemaInfo);

// Try explicit insert for tenant 16
try {
    $pdo->exec("INSERT INTO cost_centers (tenant_id, code, name, is_active) VALUES (16, 'HO', 'Head Office', 1)");
    $results[] = "OK: Inserted HO cost center for tenant 16, id=" . $pdo->lastInsertId();
} catch (Exception $e) {
    $results[] = "ERR insert t16 HO: " . $e->getMessage();
}
try {
    $pdo->exec("INSERT INTO cost_centers (tenant_id, code, name, is_active) VALUES (16, 'BAR', 'Bar', 1)");
    $results[] = "OK: Inserted BAR cost center for tenant 16, id=" . $pdo->lastInsertId();
} catch (Exception $e) {
    $results[] = "ERR insert t16 BAR: " . $e->getMessage();
}
try {
    $pdo->exec("INSERT INTO cost_centers (tenant_id, code, name, is_active) VALUES (16, 'KIT', 'Kitchen', 1)");
    $results[] = "OK: Inserted KIT cost center for tenant 16, id=" . $pdo->lastInsertId();
} catch (Exception $e) {
    $results[] = "ERR insert t16 KIT: " . $e->getMessage();
}

// Show cost centers for debugging
$ccList = $pdo->query("SELECT id, tenant_id, code, name FROM cost_centers ORDER BY tenant_id, id")->fetchAll(PDO::FETCH_ASSOC);
$results[] = "cost_centers: " . json_encode($ccList);

// Ensure every tenant has at least one cost center (catch any missed)
$allTenants = $pdo->query("SELECT DISTINCT t.id as tenant_id, c.code, c.name FROM tenants t JOIN camps c ON c.tenant_id = t.id WHERE t.id NOT IN (SELECT DISTINCT tenant_id FROM cost_centers)")->fetchAll(PDO::FETCH_ASSOC);
if (count($allTenants) > 0) {
    $ccIns = $pdo->prepare("INSERT IGNORE INTO cost_centers (tenant_id, code, name, is_active) VALUES (?, ?, ?, 1)");
    foreach ($allTenants as $row) {
        $ccIns->execute([$row['tenant_id'], $row['code'], $row['name']]);
    }
    // Also create BAR and KITCHEN cost centers for all tenants
    foreach ($allTenants as $row) {
        $ccIns->execute([$row['tenant_id'], 'BAR', 'Bar']);
        $ccIns->execute([$row['tenant_id'], 'KIT', 'Kitchen']);
    }
    $results[] = "OK: Created cost centers for " . count($allTenants) . " more tenants";
} else {
    $results[] = "SKIP: All tenants have cost centers (second pass)";
}

// ── 6. Fix stock_adjustments enum to include physical_count ─────
runSql($pdo, "ALTER TABLE stock_adjustments MODIFY COLUMN adjustment_type ENUM('damage','expiry','correction','write_off','found','transfer','physical_count') NOT NULL", "Add physical_count to stock_adjustments.adjustment_type enum");

// ── 7. Fix pos_voids table — old schema has different column names ─────
// Old schema: camp_id, void_type, order_id, order_item_id, value
// New schema needs: tenant_id, reference_type, reference_id, original_amount
runSql($pdo, "ALTER TABLE pos_voids ADD COLUMN tenant_id INT NULL AFTER id", "Add tenant_id to pos_voids");
runSql($pdo, "ALTER TABLE pos_voids ADD COLUMN reference_type ENUM('tab','tab_line') NULL AFTER tenant_id", "Add reference_type to pos_voids");
runSql($pdo, "ALTER TABLE pos_voids ADD COLUMN reference_id INT NULL AFTER reference_type", "Add reference_id to pos_voids");
runSql($pdo, "ALTER TABLE pos_voids ADD COLUMN original_amount DECIMAL(12,2) NULL AFTER reference_id", "Add original_amount to pos_voids");
runSql($pdo, "ALTER TABLE pos_voids ADD COLUMN voided_by INT NULL", "Add voided_by to pos_voids");
runSql($pdo, "ALTER TABLE pos_voids ADD COLUMN approved_by INT NULL", "Add approved_by to pos_voids");

// ── 8. Ensure pos_discounts table exists ─────
runSql($pdo, "CREATE TABLE IF NOT EXISTS pos_discounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    tab_id INT NOT NULL,
    discount_type ENUM('percentage','fixed') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(12,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    applied_by INT NOT NULL,
    approved_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tab (tab_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", "Create pos_discounts table if missing");

// ── 9. Ensure pos_cash_entries table exists ─────
runSql($pdo, "CREATE TABLE IF NOT EXISTS pos_cash_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    shift_id INT NOT NULL,
    entry_type ENUM('cash_in','cash_out','paid_out') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shift (shift_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", "Create pos_cash_entries table if missing");

// ── Debug: schema check ────────────────────────
$debugTables = ['pos_voids', 'pos_discounts', 'pos_cash_entries', 'pos_shifts', 'pos_tabs', 'pos_tab_lines'];
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
