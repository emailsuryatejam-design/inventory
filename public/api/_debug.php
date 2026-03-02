<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

$results = [];

// Step 1: Load config
try {
    require_once __DIR__ . '/config.php';
    $results[] = ['step' => 'config_loaded', 'ok' => true];
} catch (Throwable $e) {
    $results[] = ['step' => 'config_error', 'error' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()];
    echo json_encode($results, JSON_PRETTY_PRINT);
    exit;
}

// Step 2: DB connection
try {
    $pdo = getDB();
    $results[] = ['step' => 'db_connected', 'ok' => true];
} catch (Throwable $e) {
    $results[] = ['step' => 'db_error', 'error' => $e->getMessage()];
    echo json_encode($results, JSON_PRETTY_PRINT);
    exit;
}

// Step 3: List all tables
try {
    $stmt = $pdo->query('SHOW TABLES');
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $results[] = ['step' => 'tables', 'count' => count($tables), 'tables' => $tables];
} catch (Throwable $e) {
    $results[] = ['step' => 'tables_error', 'error' => $e->getMessage()];
}

// Step 4: Check tenants table
try {
    $stmt = $pdo->query('DESCRIBE tenants');
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $results[] = ['step' => 'tenants_schema', 'columns' => array_column($cols, 'Field')];
} catch (Throwable $e) {
    $results[] = ['step' => 'tenants_missing', 'error' => $e->getMessage()];
}

// Step 5: Check users table columns
try {
    $stmt = $pdo->query('DESCRIBE users');
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $results[] = ['step' => 'users_schema', 'columns' => array_column($cols, 'Field')];
} catch (Throwable $e) {
    $results[] = ['step' => 'users_error', 'error' => $e->getMessage()];
}

// Step 6: Check camps table columns
try {
    $stmt = $pdo->query('DESCRIBE camps');
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $results[] = ['step' => 'camps_schema', 'columns' => array_column($cols, 'Field')];
} catch (Throwable $e) {
    $results[] = ['step' => 'camps_error', 'error' => $e->getMessage()];
}

echo json_encode($results, JSON_PRETTY_PRINT);
