<?php
require_once __DIR__ . '/config.php';
$pdo = getDB();
$pdo->exec("UPDATE hr_employees SET user_id = 31, annual_leave_days = 21 WHERE tenant_id = 16 AND id = 401");
$check = $pdo->query("SELECT id, user_id, annual_leave_days FROM hr_employees WHERE id = 401")->fetch(PDO::FETCH_ASSOC);
header('Content-Type: application/json');
echo json_encode(['employee' => $check, 'message' => 'updated']);
