<?php
/**
 * WebSquare — Tenant Isolation Migration
 * Adds tenant_id column + index to all data tables.
 * Safe to run multiple times (checks column existence first).
 *
 * Run once: POST /api/setup-tenant-isolation.php
 * Optional: ?backfill=1 to assign existing NULL rows to tenant 1
 */

require_once __DIR__ . '/config.php';

// Only allow POST or require debug mode
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && env('DEBUG') !== 'true') {
    jsonError('POST required (or set DEBUG=true for GET access)', 405);
}

$pdo = getDB();

// All data tables that need tenant_id
$tables = [
    // Core
    'items',
    'item_groups',
    'item_sub_categories',
    'units_of_measure',
    'suppliers',
    'item_suppliers',
    'cost_centers',
    'number_sequences',
    // Stock
    'stock_balances',
    'stock_movements',
    // Orders
    'orders',
    'order_lines',
    'order_queries',
    // Dispatch
    'dispatches',
    'dispatch_lines',
    // Receive
    'receipts',
    'receipt_lines',
    // Issue
    'issue_vouchers',
    'issue_voucher_lines',
    // Kitchen
    'kitchen_recipes',
    'kitchen_recipe_ingredients',
    'kitchen_menu_plans',
    'kitchen_menu_dishes',
    'kitchen_menu_ingredients',
    'kitchen_default_menu',
    'kitchen_weekly_groceries',
    'kitchen_menu_audit_log',
    // Bar/Menu
    'bar_menu_categories',
    'bar_menu_items',
    'bar_menu_ingredients',
];

$results = [];
$errors = [];
$added = 0;
$skipped = 0;
$missing = 0;

foreach ($tables as $table) {
    try {
        // Check if table exists
        $tableExists = $pdo->query("SHOW TABLES LIKE '{$table}'")->fetchColumn();
        if (!$tableExists) {
            $results[$table] = 'table_not_found';
            $missing++;
            continue;
        }

        // Check if tenant_id column already exists
        $cols = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE 'tenant_id'")->fetchAll();
        if (!empty($cols)) {
            $results[$table] = 'already_exists';
            $skipped++;
            continue;
        }

        // Add tenant_id column after id (or as first column if no id)
        $hasId = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE 'id'")->fetchAll();
        if (!empty($hasId)) {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN tenant_id INT DEFAULT NULL AFTER id");
        } else {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN tenant_id INT DEFAULT NULL");
        }

        // Add index for fast filtering
        $pdo->exec("ALTER TABLE `{$table}` ADD INDEX idx_{$table}_tenant (tenant_id)");

        $results[$table] = 'added';
        $added++;
    } catch (PDOException $e) {
        $results[$table] = 'error: ' . $e->getMessage();
        $errors[] = $table;
    }
}

// Backfill: assign all NULL tenant_id rows to tenant 1 (existing Karibu Camps data)
$backfilled = [];
if (isset($_GET['backfill']) || isset($_POST['backfill'])) {
    // First check tenant 1 exists
    $t1 = $pdo->query("SELECT id FROM tenants WHERE id = 1")->fetchColumn();
    if ($t1) {
        foreach ($tables as $table) {
            if ($results[$table] === 'table_not_found') continue;
            try {
                $count = $pdo->exec("UPDATE `{$table}` SET tenant_id = 1 WHERE tenant_id IS NULL");
                if ($count > 0) {
                    $backfilled[$table] = $count;
                }
            } catch (PDOException $e) {
                $backfilled[$table] = 'error: ' . $e->getMessage();
            }
        }
    } else {
        $backfilled['_note'] = 'Tenant 1 does not exist. Skipped backfill.';
    }
}

jsonResponse([
    'success' => empty($errors),
    'summary' => [
        'added' => $added,
        'already_existed' => $skipped,
        'tables_not_found' => $missing,
        'errors' => count($errors),
    ],
    'details' => $results,
    'backfilled' => $backfilled ?: null,
    'note' => 'Add ?backfill=1 to assign existing NULL rows to tenant 1',
]);
