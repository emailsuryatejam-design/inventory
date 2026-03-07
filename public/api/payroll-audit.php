<?php
/**
 * WebSquare — Payroll Audit Log
 * GET /api/payroll-audit.php — paginated list (filter by entity_type, date range)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$page       = max(1, (int) ($_GET['page'] ?? 1));
$perPage    = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
$offset     = ($page - 1) * $perPage;
$entityType = $_GET['entity_type'] ?? '';
$dateFrom   = $_GET['date_from'] ?? '';
$dateTo     = $_GET['date_to'] ?? '';

$where  = [];
$params = [];
tenantScope($where, $params, $tenantId, 'pal');

if ($entityType) {
    $where[] = 'pal.entity_type = ?';
    $params[] = $entityType;
}

if ($dateFrom) {
    $where[] = 'pal.created_at >= ?';
    $params[] = $dateFrom . ' 00:00:00';
}

if ($dateTo) {
    $where[] = 'pal.created_at <= ?';
    $params[] = $dateTo . ' 23:59:59';
}

$whereClause = 'WHERE ' . implode(' AND ', $where);

// Count
$countStmt = $pdo->prepare("
    SELECT COUNT(*)
    FROM payroll_audit_log pal
    {$whereClause}
");
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

// Data
$dataParams = $params;
$dataParams[] = $perPage;
$dataParams[] = $offset;

$stmt = $pdo->prepare("
    SELECT pal.id, pal.user_id, pal.action, pal.entity_type, pal.entity_id,
           pal.details, pal.created_at,
           COALESCE(u.name, CONCAT(u.first_name, ' ', u.last_name), 'System') AS user_name
    FROM payroll_audit_log pal
    LEFT JOIN users u ON pal.user_id = u.id
    {$whereClause}
    ORDER BY pal.created_at DESC
    LIMIT ? OFFSET ?
");
$stmt->execute($dataParams);
$logs = $stmt->fetchAll();

jsonResponse([
    'logs' => array_map(function ($l) {
        return [
            'id'          => (int) $l['id'],
            'user_id'     => $l['user_id'] ? (int) $l['user_id'] : null,
            'user_name'   => $l['user_name'],
            'action'      => $l['action'],
            'entity_type' => $l['entity_type'],
            'entity_id'   => $l['entity_id'] ? (int) $l['entity_id'] : null,
            'details'     => $l['details'],
            'created_at'  => $l['created_at'],
        ];
    }, $logs),
    'pagination' => [
        'page'        => $page,
        'per_page'    => $perPage,
        'total'       => $total,
        'total_pages' => (int) ceil($total / $perPage),
    ],
]);
