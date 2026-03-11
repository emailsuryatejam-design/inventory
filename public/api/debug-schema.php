<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/middleware.php';
if (env('DEBUG') !== 'true') {
    requireAdmin();
}
$pdo = getDB();

$tables = ['stock_balances', 'stock_movements', 'dispatch_notes', 'dispatch_lines', 'items', 'item_suppliers', 'suppliers', 'users', 'camp_modules', 'stock_adjustments', 'stock_adjustment_lines', 'purchase_orders', 'purchase_order_lines'];
$result = [];

foreach ($tables as $table) {
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM {$table}")->fetchAll(PDO::FETCH_ASSOC);
        $result[$table] = array_map(fn($c) => $c['Field'] . ':' . $c['Type'] . ($c['Null'] === 'NO' ? ':NOT_NULL' : '') . ($c['Default'] !== null ? ':def=' . $c['Default'] : ''), $cols);
    } catch (Exception $e) {
        $result[$table] = "ERROR: " . $e->getMessage();
    }
}

jsonResponse($result);
