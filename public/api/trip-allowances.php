<?php
/**
 * WebSquare — Trip Allowances API (P5)
 * Ported from KaziPay tripAllowance.controller.js
 * CRUD + approve/reject for trip allowance claims
 */

require_once __DIR__ . '/middleware.php';
$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $auth['user_id'] ?? 0;
$userRole = $auth['role'] ?? '';

$action = $_GET['action'] ?? '';

switch ($action) {

// ── List trip allowances ──
case 'list':
    $status = $_GET['status'] ?? '';
    $employeeId = intval($_GET['employee_id'] ?? 0);
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = 25;
    $offset = ($page - 1) * $limit;

    $where = "WHERE ta.tenant_id = ?";
    $params = [$tenantId];

    if ($status) {
        $where .= " AND ta.status = ?";
        $params[] = $status;
    }
    if ($employeeId) {
        $where .= " AND ta.employee_id = ?";
        $params[] = $employeeId;
    }

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM trip_allowances ta $where");
    $countStmt->execute($params);
    $total = $countStmt->fetchColumn();

    $params[] = $limit;
    $params[] = $offset;
    $stmt = $pdo->prepare("
        SELECT ta.*, e.first_name, e.last_name, e.employee_no,
               r.name AS region_name
        FROM trip_allowances ta
        JOIN hr_employees e ON ta.employee_id = e.id
        LEFT JOIN hr_regions r ON ta.region_id = r.id
        $where
        ORDER BY ta.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($params);

    jsonResponse([
        'allowances' => $stmt->fetchAll(PDO::FETCH_ASSOC),
        'total' => (int)$total,
        'page' => $page,
        'pages' => ceil($total / $limit),
    ]);

// ── Get by employee ──
case 'by_employee':
    $employeeId = intval($_GET['employee_id'] ?? 0);
    if (!$employeeId) jsonError('employee_id required');

    $stmt = $pdo->prepare("
        SELECT ta.*, r.name AS region_name
        FROM trip_allowances ta
        LEFT JOIN hr_regions r ON ta.region_id = r.id
        WHERE ta.employee_id = ? AND ta.tenant_id = ?
        ORDER BY ta.start_date DESC
    ");
    $stmt->execute([$employeeId, $tenantId]);
    jsonResponse(['allowances' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ── Create trip allowance ──
case 'create':
    if (!in_array($userRole, ['admin', 'director', 'stores_manager'])) jsonError('Access denied', 403);

    $input = json_decode(file_get_contents('php://input'), true);
    $employeeId = intval($input['employee_id'] ?? 0);
    $regionId = intval($input['region_id'] ?? 0) ?: null;
    $startDate = $input['start_date'] ?? '';
    $endDate = $input['end_date'] ?? '';
    $purpose = $input['purpose'] ?? '';
    $dailyRate = floatval($input['daily_rate'] ?? 0);
    $components = $input['components'] ?? [];

    if (!$employeeId || !$startDate || !$endDate) jsonError('employee_id, start_date, and end_date required');

    // Calculate days
    $days = (int)((strtotime($endDate) - strtotime($startDate)) / 86400) + 1;
    $totalAmount = $dailyRate > 0 ? $dailyRate * $days : 0;

    // Sum component amounts if provided
    if (!empty($components)) {
        $totalAmount = 0;
        foreach ($components as $comp) {
            $totalAmount += floatval($comp['amount'] ?? 0);
        }
    }

    $pdo->prepare("
        INSERT INTO trip_allowances (tenant_id, employee_id, region_id, start_date, end_date, days, daily_rate, total_amount, purpose, components, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())
    ")->execute([
        $tenantId, $employeeId, $regionId, $startDate, $endDate, $days,
        $dailyRate, $totalAmount, $purpose, json_encode($components), $userId,
    ]);

    jsonResponse(['id' => $pdo->lastInsertId(), 'message' => 'Trip allowance created']);

// ── Update (pending only) ──
case 'update':
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    if (!$id) jsonError('id required');

    $stmt = $pdo->prepare("SELECT status FROM trip_allowances WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) jsonError('Trip allowance not found', 404);
    if ($existing['status'] !== 'pending') jsonError('Can only update pending allowances');

    $sets = [];
    $vals = [];
    foreach (['start_date', 'end_date', 'daily_rate', 'purpose', 'region_id'] as $field) {
        if (isset($input[$field])) {
            $sets[] = "$field = ?";
            $vals[] = $input[$field];
        }
    }
    if (isset($input['components'])) {
        $sets[] = "components = ?";
        $vals[] = json_encode($input['components']);
    }

    if (!empty($sets)) {
        $vals[] = $id;
        $vals[] = $tenantId;
        $pdo->prepare("UPDATE trip_allowances SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")->execute($vals);
    }

    jsonResponse(['message' => 'Trip allowance updated']);

// ── Approve ──
case 'approve':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $pdo->prepare("UPDATE trip_allowances SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ? AND tenant_id = ? AND status = 'pending'")
        ->execute([$userId, $id, $tenantId]);
    jsonResponse(['message' => 'Trip allowance approved']);

// ── Reject ──
case 'reject':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $pdo->prepare("UPDATE trip_allowances SET status = 'rejected', approved_by = ?, approved_at = NOW() WHERE id = ? AND tenant_id = ? AND status = 'pending'")
        ->execute([$userId, $id, $tenantId]);
    jsonResponse(['message' => 'Trip allowance rejected']);

// ── Delete (pending only) ──
case 'delete':
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $pdo->prepare("DELETE FROM trip_allowances WHERE id = ? AND tenant_id = ? AND status = 'pending'")->execute([$id, $tenantId]);
    jsonResponse(['message' => 'Trip allowance deleted']);

default:
    jsonError('Invalid action. Use: list, by_employee, create, update, approve, reject, delete');
}
