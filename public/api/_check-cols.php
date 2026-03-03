<?php
require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';
$auth = requireAuth();
$pdo = getDB();

$table = $_GET['table'] ?? 'items';
$stmt = $pdo->query("SHOW COLUMNS FROM `{$table}`");
$cols = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
header('Content-Type: application/json');
echo json_encode(['table' => $table, 'columns' => $cols]);
