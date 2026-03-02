<?php
// Temporary cleanup script - DELETE AFTER USE
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/config.php';
$pdo = getDB();

$action = $_GET['action'] ?? 'list';

if ($action === 'delete') {
    $email = $_GET['email'] ?? '';
    if (!$email) {
        echo json_encode(['error' => 'email parameter required']);
        exit;
    }
    $steps = [];

    // Delete users for the tenant
    $stmt = $pdo->prepare("DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE email = ?)");
    $stmt->execute([$email]);
    $steps[] = ['deleted_users' => $stmt->rowCount()];

    // Delete camps for the tenant
    $stmt = $pdo->prepare("DELETE FROM camps WHERE tenant_id IN (SELECT id FROM tenants WHERE email = ?)");
    $stmt->execute([$email]);
    $steps[] = ['deleted_camps' => $stmt->rowCount()];

    // Delete the tenant
    $stmt = $pdo->prepare("DELETE FROM tenants WHERE email = ?");
    $stmt->execute([$email]);
    $steps[] = ['deleted_tenants' => $stmt->rowCount()];

    echo json_encode(['cleanup' => $steps], JSON_PRETTY_PRINT);
    exit;
}

// List tenants
$tenants = $pdo->query("SELECT id, company_name, email, status, trial_end FROM tenants")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['tenants' => $tenants], JSON_PRETTY_PRINT);
