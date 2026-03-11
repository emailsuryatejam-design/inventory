<?php
/**
 * Migration: Bar & POS Upgrade — 6 new tables
 * Run once: php migrate-bar-pos.php
 */

require_once __DIR__ . '/config.php';
$pdo = getDB();

$sqls = [
    // 1. Shifts
    "CREATE TABLE IF NOT EXISTS pos_shifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        camp_id INT NOT NULL,
        shift_number VARCHAR(30) NOT NULL,
        opened_by INT NOT NULL,
        closed_by INT NULL,
        opened_at DATETIME NOT NULL,
        closed_at DATETIME NULL,
        opening_float DECIMAL(12,2) NOT NULL DEFAULT 0,
        closing_cash DECIMAL(12,2) NULL,
        expected_cash DECIMAL(12,2) NULL,
        variance DECIMAL(12,2) NULL,
        total_sales DECIMAL(12,2) DEFAULT 0,
        total_voids DECIMAL(12,2) DEFAULT 0,
        total_discounts DECIMAL(12,2) DEFAULT 0,
        total_complimentary DECIMAL(12,2) DEFAULT 0,
        tab_count INT DEFAULT 0,
        status ENUM('open','closed') DEFAULT 'open',
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_camp (tenant_id, camp_id),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // 2. Cash entries
    "CREATE TABLE IF NOT EXISTS pos_cash_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        shift_id INT NOT NULL,
        entry_type ENUM('cash_in','cash_out','paid_out') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_shift (shift_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // 3. Tabs
    "CREATE TABLE IF NOT EXISTS pos_tabs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        camp_id INT NOT NULL,
        shift_id INT NULL,
        tab_number VARCHAR(30) NOT NULL,
        tab_type ENUM('table','room','guest','takeaway') DEFAULT 'table',
        table_number VARCHAR(20) NULL,
        room_number VARCHAR(20) NULL,
        guest_name VARCHAR(100) NULL,
        covers INT DEFAULT 1,
        server_id INT NOT NULL,
        status ENUM('open','closed','voided','merged') DEFAULT 'open',
        subtotal DECIMAL(12,2) DEFAULT 0,
        discount_amount DECIMAL(12,2) DEFAULT 0,
        tax_amount DECIMAL(12,2) DEFAULT 0,
        total DECIMAL(12,2) DEFAULT 0,
        payment_method ENUM('cash','card','room_charge','mpesa','split','complimentary') NULL,
        payment_reference VARCHAR(100) NULL,
        issue_voucher_id INT NULL,
        closed_at DATETIME NULL,
        closed_by INT NULL,
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        INDEX idx_tenant_camp (tenant_id, camp_id),
        INDEX idx_status (status),
        INDEX idx_shift (shift_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // 4. Tab lines
    "CREATE TABLE IF NOT EXISTS pos_tab_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        tab_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        line_total DECIMAL(12,2) NOT NULL,
        round_number INT DEFAULT 1,
        is_voided TINYINT(1) DEFAULT 0,
        void_reason VARCHAR(255) NULL,
        voided_by INT NULL,
        is_complimentary TINYINT(1) DEFAULT 0,
        complimentary_reason VARCHAR(255) NULL,
        approved_by INT NULL,
        notes VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tab (tab_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // 5. Discounts
    "CREATE TABLE IF NOT EXISTS pos_discounts (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

    // 6. Voids
    "CREATE TABLE IF NOT EXISTS pos_voids (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        reference_type ENUM('tab','tab_line') NOT NULL,
        reference_id INT NOT NULL,
        original_amount DECIMAL(12,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        voided_by INT NOT NULL,
        approved_by INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ref (reference_type, reference_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
];

$ok = 0;
$skip = 0;

foreach ($sqls as $sql) {
    try {
        $pdo->exec($sql);
        $ok++;
        // Extract table name for logging
        preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/', $sql, $m);
        echo "  Created: {$m[1]}\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'already exists') !== false) {
            $skip++;
            preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/', $sql, $m);
            echo "  Exists:  {$m[1]}\n";
        } else {
            echo "  ERROR: " . $e->getMessage() . "\n";
        }
    }
}

echo "\nDone. Created: {$ok}, Already existed: {$skip}\n";
