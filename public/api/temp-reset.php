<?php
// Temporary password reset - DELETE AFTER USE
require_once __DIR__ . '/config.php';
$pdo = getDB();

if ($_GET['action'] === 'list') {
    $stmt = $pdo->query("SELECT id, username, name, role, tenant_id FROM users LIMIT 10");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} elseif ($_GET['action'] === 'reset') {
    $hash = password_hash('admin123', PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE username = 'sundeepnani6117'");
    $stmt->execute([$hash]);
    echo json_encode(['ok' => true, 'updated' => $stmt->rowCount(), 'user' => 'sundeepnani6117']);
}
