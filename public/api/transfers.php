<?php
/**
 * WebSquare — Employee Transfers API (P5)
 * Ported from KaziPay transfer.controller.js
 */

require_once __DIR__ . '/middleware.php';
$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $GLOBALS['user_id'];
$userRole = $GLOBALS['user_role'] ?? '';

if (!in_array($userRole, ['admin', 'director'])) {
    jsonError('Access denied', 403);
}

$action = $_GET['action'] ?? '';

switch ($action) {

// ── List transfers ──
case 'list':
    $employeeId = intval($_GET['employee_id'] ?? 0);
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = 25;
    $offset = ($page - 1) * $limit;

    $where = "WHERE t.tenant_id = ?";
    $params = [$tenantId];
    if ($employeeId) {
        $where .= " AND t.employee_id = ?";
        $params[] = $employeeId;
    }

    $params[] = $limit;
    $params[] = $offset;
    $stmt = $pdo->prepare("
        SELECT t.*, e.first_name, e.last_name, e.employee_no,
            fd.name AS from_dept, td.name AS to_dept,
            fr.name AS from_region, tr.name AS to_region
        FROM employee_transfers t
        JOIN hr_employees e ON t.employee_id = e.id
        LEFT JOIN departments fd ON t.from_department_id = fd.id
        LEFT JOIN departments td ON t.to_department_id = td.id
        LEFT JOIN hr_regions fr ON t.from_region_id = fr.id
        LEFT JOIN hr_regions tr ON t.to_region_id = tr.id
        $where
        ORDER BY t.effective_date DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($params);
    jsonResponse(['transfers' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ── Transfer employee ──
case 'create':
    $input = json_decode(file_get_contents('php://input'), true);
    $employeeId = intval($input['employee_id'] ?? 0);
    $toDepartmentId = intval($input['to_department_id'] ?? 0) ?: null;
    $toRegionId = intval($input['to_region_id'] ?? 0) ?: null;
    $effectiveDate = $input['effective_date'] ?? date('Y-m-d');
    $reason = $input['reason'] ?? '';

    if (!$employeeId) jsonError('employee_id required');
    if (!$toDepartmentId && !$toRegionId) jsonError('At least one of to_department_id or to_region_id required');

    // Get current employee data
    $stmt = $pdo->prepare("SELECT department_id, region_id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$employeeId, $tenantId]);
    $emp = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$emp) jsonError('Employee not found');

    // Record transfer
    $pdo->prepare("
        INSERT INTO employee_transfers (tenant_id, employee_id, from_department_id, to_department_id, from_region_id, to_region_id, effective_date, reason, transferred_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ")->execute([
        $tenantId, $employeeId,
        $emp['department_id'], $toDepartmentId,
        $emp['region_id'] ?? null, $toRegionId,
        $effectiveDate, $reason, $userId,
    ]);

    // Update employee
    $updates = [];
    $vals = [];
    if ($toDepartmentId) {
        $updates[] = "department_id = ?";
        $vals[] = $toDepartmentId;
    }
    if ($toRegionId) {
        $updates[] = "region_id = ?";
        $vals[] = $toRegionId;
    }
    $vals[] = $employeeId;
    $vals[] = $tenantId;
    $pdo->prepare("UPDATE hr_employees SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?")->execute($vals);

    jsonResponse(['id' => $pdo->lastInsertId(), 'message' => 'Employee transferred']);

default:
    jsonError('Invalid action. Use: list, create');
}
