<?php
/**
 * One-time cleanup: Delete all Karibu Camps data (tenant_id IS NULL)
 * and any test users/camps/tenants.
 * POST to execute, GET to preview counts.
 */

require_once __DIR__ . '/config.php';

$pdo = getDB();

// All tables that have tenant_id (data tables)
$dataTables = [
    'kitchen_menu_audit_log',
    'kitchen_menu_ingredients',
    'kitchen_menu_dishes',
    'kitchen_menu_plans',
    'kitchen_weekly_groceries',
    'kitchen_default_menu',
    'kitchen_recipe_ingredients',
    'kitchen_recipes',
    'bar_menu_ingredients',
    'bar_menu_items',
    'bar_menu_categories',
    'dispatch_lines',
    'dispatches',
    'receipt_lines',
    'receipts',
    'issue_voucher_lines',
    'issue_vouchers',
    'order_queries',
    'order_lines',
    'orders',
    'stock_movements',
    'stock_balances',
    'item_suppliers',
    'items',
    'item_sub_categories',
    'item_groups',
    'units_of_measure',
    'suppliers',
    'cost_centers',
    'number_sequences',
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Preview: count rows with NULL tenant_id
    $counts = [];
    $total = 0;
    foreach ($dataTables as $table) {
        try {
            $count = (int) $pdo->query("SELECT COUNT(*) FROM `{$table}` WHERE tenant_id IS NULL")->fetchColumn();
            if ($count > 0) {
                $counts[$table] = $count;
                $total += $count;
            }
        } catch (Exception $e) {
            $counts[$table] = 'error: ' . $e->getMessage();
        }
    }
    // Also count users and camps with NULL tenant_id
    $userCount = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE tenant_id IS NULL")->fetchColumn();
    $campCount = (int) $pdo->query("SELECT COUNT(*) FROM camps WHERE tenant_id IS NULL")->fetchColumn();

    jsonResponse([
        'mode' => 'preview',
        'total_orphan_rows' => $total,
        'orphan_users' => $userCount,
        'orphan_camps' => $campCount,
        'tables' => $counts,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $deleted = [];
    $total = 0;

    // Delete data rows with NULL tenant_id (child tables first)
    foreach ($dataTables as $table) {
        try {
            $count = $pdo->exec("DELETE FROM `{$table}` WHERE tenant_id IS NULL");
            if ($count > 0) {
                $deleted[$table] = $count;
                $total += $count;
            }
        } catch (Exception $e) {
            $deleted[$table] = 'error: ' . $e->getMessage();
        }
    }

    // Delete orphan users (no tenant)
    $userDel = $pdo->exec("DELETE FROM users WHERE tenant_id IS NULL");
    // Delete orphan camps (no tenant)
    $campDel = $pdo->exec("DELETE FROM camps WHERE tenant_id IS NULL");

    jsonResponse([
        'mode' => 'delete',
        'success' => true,
        'total_deleted' => $total,
        'users_deleted' => $userDel,
        'camps_deleted' => $campDel,
        'tables' => $deleted,
    ]);
}
