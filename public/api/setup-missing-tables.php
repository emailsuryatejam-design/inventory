<?php
/**
 * WebSquare — Migration: Create missing tables + add missing columns
 * Run once via GET /api/setup-missing-tables.php
 */

require_once __DIR__ . '/config.php';

$pdo = getDB();
$results = [];

// ── Helper: add column if missing ──────────────────
function addColumnIfMissing(PDO $pdo, string $table, string $column, string $definition, array &$results): void {
    $cols = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE '{$column}'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN {$column} {$definition}");
        $results[] = "Added {$table}.{$column}";
    }
}

// ── 1. Suppliers table — add missing columns ──────
try {
    // Check if suppliers table exists first
    $pdo->query("SELECT 1 FROM suppliers LIMIT 1");

    addColumnIfMissing($pdo, 'suppliers', 'supplier_code', "VARCHAR(30) DEFAULT NULL AFTER tenant_id", $results);
    addColumnIfMissing($pdo, 'suppliers', 'contact_person', "VARCHAR(200) DEFAULT NULL AFTER name", $results);
    addColumnIfMissing($pdo, 'suppliers', 'address', "TEXT DEFAULT NULL AFTER phone", $results);
    addColumnIfMissing($pdo, 'suppliers', 'city', "VARCHAR(100) DEFAULT NULL AFTER address", $results);
    addColumnIfMissing($pdo, 'suppliers', 'country', "VARCHAR(100) DEFAULT 'Kenya' AFTER city", $results);
    addColumnIfMissing($pdo, 'suppliers', 'tax_id', "VARCHAR(50) DEFAULT NULL AFTER country", $results);
    addColumnIfMissing($pdo, 'suppliers', 'payment_terms', "INT DEFAULT 30 AFTER tax_id", $results);
    addColumnIfMissing($pdo, 'suppliers', 'credit_limit', "DECIMAL(15,2) DEFAULT 0 AFTER payment_terms", $results);
    addColumnIfMissing($pdo, 'suppliers', 'bank_name', "VARCHAR(200) DEFAULT NULL AFTER credit_limit", $results);
    addColumnIfMissing($pdo, 'suppliers', 'bank_account', "VARCHAR(100) DEFAULT NULL AFTER bank_name", $results);
    addColumnIfMissing($pdo, 'suppliers', 'notes', "TEXT DEFAULT NULL AFTER bank_account", $results);
} catch (Exception $e) {
    $results[] = "suppliers: " . $e->getMessage();
}

// ── 2. Stock Adjustments ──────────────────────────
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT DEFAULT NULL,
        adjustment_number VARCHAR(30) NOT NULL,
        adjustment_type ENUM('damage','expiry','correction','write_off','found') NOT NULL DEFAULT 'correction',
        camp_id INT DEFAULT NULL,
        reason TEXT DEFAULT NULL,
        status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
        total_value DECIMAL(15,2) DEFAULT 0,
        created_by INT DEFAULT NULL,
        approved_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sa_tenant (tenant_id),
        INDEX idx_sa_camp (camp_id),
        INDEX idx_sa_status (status),
        UNIQUE KEY uq_sa_number (adjustment_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = "stock_adjustments: OK";
} catch (Exception $e) {
    $results[] = "stock_adjustments: " . $e->getMessage();
}

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS stock_adjustment_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT DEFAULT NULL,
        adjustment_id INT NOT NULL,
        item_id INT NOT NULL,
        current_qty DECIMAL(15,4) DEFAULT 0,
        adjustment_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
        new_qty DECIMAL(15,4) DEFAULT 0,
        unit_cost DECIMAL(15,4) DEFAULT 0,
        value_impact DECIMAL(15,2) DEFAULT 0,
        reason VARCHAR(500) DEFAULT NULL,
        INDEX idx_sal_tenant (tenant_id),
        INDEX idx_sal_adj (adjustment_id),
        INDEX idx_sal_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = "stock_adjustment_lines: OK";
} catch (Exception $e) {
    $results[] = "stock_adjustment_lines: " . $e->getMessage();
}

// ── 3. Purchase Orders ────────────────────────────
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS purchase_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT DEFAULT NULL,
        po_number VARCHAR(30) NOT NULL,
        supplier_id INT NOT NULL,
        camp_id INT DEFAULT NULL,
        status ENUM('draft','submitted','approved','sent','partial_received','received','cancelled') NOT NULL DEFAULT 'draft',
        delivery_date DATE DEFAULT NULL,
        payment_terms INT DEFAULT 30,
        currency VARCHAR(10) DEFAULT 'KES',
        notes TEXT DEFAULT NULL,
        subtotal DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        grand_total DECIMAL(15,2) DEFAULT 0,
        created_by INT DEFAULT NULL,
        approved_by INT DEFAULT NULL,
        sent_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_po_tenant (tenant_id),
        INDEX idx_po_supplier (supplier_id),
        INDEX idx_po_status (status),
        UNIQUE KEY uq_po_number (po_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = "purchase_orders: OK";
} catch (Exception $e) {
    $results[] = "purchase_orders: " . $e->getMessage();
}

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS purchase_order_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT DEFAULT NULL,
        po_id INT NOT NULL,
        item_id INT NOT NULL,
        description VARCHAR(500) DEFAULT NULL,
        quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
        unit_price DECIMAL(15,4) NOT NULL DEFAULT 0,
        tax_rate DECIMAL(5,2) DEFAULT 0,
        line_total DECIMAL(15,2) DEFAULT 0,
        received_qty DECIMAL(15,4) DEFAULT 0,
        INDEX idx_pol_tenant (tenant_id),
        INDEX idx_pol_po (po_id),
        INDEX idx_pol_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = "purchase_order_lines: OK";
} catch (Exception $e) {
    $results[] = "purchase_order_lines: " . $e->getMessage();
}

// ── 4. GRN (Goods Received Notes) ─────────────────
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS grn (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT DEFAULT NULL,
        grn_number VARCHAR(30) NOT NULL,
        po_id INT NOT NULL,
        camp_id INT DEFAULT NULL,
        received_date DATE NOT NULL,
        delivery_note_ref VARCHAR(100) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        status ENUM('draft','confirmed') NOT NULL DEFAULT 'draft',
        total_value DECIMAL(15,2) DEFAULT 0,
        received_by INT DEFAULT NULL,
        confirmed_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at DATETIME DEFAULT NULL,
        INDEX idx_grn_tenant (tenant_id),
        INDEX idx_grn_po (po_id),
        INDEX idx_grn_status (status),
        UNIQUE KEY uq_grn_number (grn_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = "grn: OK";
} catch (Exception $e) {
    $results[] = "grn: " . $e->getMessage();
}

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS grn_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT DEFAULT NULL,
        grn_id INT NOT NULL,
        po_line_id INT DEFAULT NULL,
        item_id INT NOT NULL,
        received_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
        rejected_qty DECIMAL(15,4) DEFAULT 0,
        rejection_reason VARCHAR(500) DEFAULT NULL,
        unit_cost DECIMAL(15,4) DEFAULT 0,
        batch_number VARCHAR(100) DEFAULT NULL,
        expiry_date DATE DEFAULT NULL,
        line_total DECIMAL(15,2) DEFAULT 0,
        INDEX idx_gl_tenant (tenant_id),
        INDEX idx_gl_grn (grn_id),
        INDEX idx_gl_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = "grn_lines: OK";
} catch (Exception $e) {
    $results[] = "grn_lines: " . $e->getMessage();
}

// ── 5. Tenant Settings (key-value) ────────────────
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS tenant_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tenant_key (tenant_id, setting_key),
        INDEX idx_ts_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = "tenant_settings: OK";
} catch (Exception $e) {
    $results[] = "tenant_settings: " . $e->getMessage();
}

// ── 6. Camp Modules (per-camp feature flags) ──────
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS camp_modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        camp_id INT NOT NULL,
        module_key VARCHAR(50) NOT NULL,
        is_enabled TINYINT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_camp_module (tenant_id, camp_id, module_key),
        INDEX idx_cm_tenant (tenant_id),
        INDEX idx_cm_camp (camp_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = "camp_modules: OK";
} catch (Exception $e) {
    $results[] = "camp_modules: " . $e->getMessage();
}

jsonResponse([
    'success' => true,
    'message' => 'Migration complete',
    'results' => $results,
]);
