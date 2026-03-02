<?php
/**
 * Temporary debug script — DELETE AFTER TESTING
 */
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/config.php';
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

if ($method === 'DELETE' || $action === 'cleanup') {
    // Delete test registration data
    $steps = [];

    try {
        // Delete test user
        $stmt = $pdo->prepare("DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE email = ?)");
        $stmt->execute(['testdemo@websquare.pro']);
        $steps[] = ['action' => 'delete_users', 'affected' => $stmt->rowCount()];

        // Delete test camps
        $stmt = $pdo->prepare("DELETE FROM camps WHERE tenant_id IN (SELECT id FROM tenants WHERE email = ?)");
        $stmt->execute(['testdemo@websquare.pro']);
        $steps[] = ['action' => 'delete_camps', 'affected' => $stmt->rowCount()];

        // Delete test tenant
        $stmt = $pdo->prepare("DELETE FROM tenants WHERE email = ?");
        $stmt->execute(['testdemo@websquare.pro']);
        $steps[] = ['action' => 'delete_tenant', 'affected' => $stmt->rowCount()];

        // Also clean up any debug test data
        $pdo->exec("DELETE FROM users WHERE username LIKE 'debuguser%'");
        $pdo->exec("DELETE FROM tenants WHERE email = 'debug@test.com'");
    } catch (Throwable $e) {
        $steps[] = ['error' => $e->getMessage()];
    }

    echo json_encode(['cleanup' => $steps], JSON_PRETTY_PRINT);
    exit;
}

// GET: Show current state
$tenants = $pdo->query("SELECT id, company_name, email, status, trial_end FROM tenants")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['tenants' => $tenants, 'hint' => 'GET ?action=cleanup to delete test data'], JSON_PRETTY_PRINT);
