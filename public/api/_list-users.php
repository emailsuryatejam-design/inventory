<?php
/** Temp debug — list usernames and roles (no passwords shown) */
require_once __DIR__ . '/config.php';
$pdo = getDB();
$rows = $pdo->query('SELECT id, username, name, role, is_active, tenant_id FROM users ORDER BY id')->fetchAll();
jsonResponse(['users' => $rows]);
