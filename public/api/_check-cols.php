<?php
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';
$auth = requireAuth();
$pdo = getDB();

$table = $_GET['table'] ?? 'items';
$stmt = $pdo->query("SHOW COLUMNS FROM `{$table}`");
$cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
header('Content-Type: application/json');
echo json_encode(['table' => $table, 'columns' => $cols]);
