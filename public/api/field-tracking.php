<?php
/**
 * WebSquare — Field Tracking
 * GET    /api/field-tracking.php      — paginated list (filter by status, date range)
 * POST   /api/field-tracking.php      — create record (manager+)
 * PUT    /api/field-tracking.php      — approve record (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Field Tracking Records ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $status  = $_GET['status'] ?? '';
    $dateFrom = $_GET['date_from'] ?? '';
    $dateTo   = $_GET['date_to'] ?? '';

    $where  = [];
    $params = [];
    tenantScope($where, $params, $tenantId, 'ft');

    if ($status) {
        $where[] = 'ft.status = ?';
        $params[] = $status;
    }

    if ($dateFrom) {
        $where[] = 'ft.date >= ?';
        $params[] = $dateFrom;
    }

    if ($dateTo) {
        $where[] = 'ft.date <= ?';
        $params[] = $dateTo;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM field_tracking ft
        {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $dataParams = $params;
    $dataParams[] = $perPage;
    $dataParams[] = $offset;

    $stmt = $pdo->prepare("
        SELECT ft.id, ft.employee_id, ft.date, ft.trip_type, ft.travel_from, ft.travel_to,
               ft.distance_km, ft.allowance_amount, ft.status, ft.notes, ft.created_at,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               e.employee_no
        FROM field_tracking ft
        JOIN hr_employees e ON ft.employee_id = e.id
        {$whereClause}
        ORDER BY ft.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($dataParams);
    $records = $stmt->fetchAll();

    jsonResponse([
        'records' => array_map(function ($r) {
            return [
                'id'               => (int) $r['id'],
                'employee_id'      => (int) $r['employee_id'],
                'employee_name'    => $r['employee_name'],
                'employee_no'      => $r['employee_no'],
                'date'             => $r['date'],
                'trip_type'        => $r['trip_type'],
                'travel_from'      => $r['travel_from'],
                'travel_to'        => $r['travel_to'],
                'distance_km'      => $r['distance_km'] !== null ? (float) $r['distance_km'] : null,
                'allowance_amount' => $r['allowance_amount'] !== null ? (float) $r['allowance_amount'] : null,
                'status'           => $r['status'],
                'notes'            => $r['notes'],
                'created_at'       => $r['created_at'],
            ];
        }, $records),
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create Field Tracking Record ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['employee_id', 'date', 'trip_type', 'travel_from', 'travel_to']);

    $employeeId = (int) $input['employee_id'];

    // Verify employee belongs to tenant
    $empCheck = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $empCheck->execute([$employeeId, $tenantId]);
    if (!$empCheck->fetch()) {
        jsonError('Employee not found', 404);
    }

    // Validate trip_type
    $validTripTypes = ['field_visit', 'delivery', 'client_meeting', 'training', 'other'];
    if (!in_array($input['trip_type'], $validTripTypes)) {
        jsonError('Invalid trip type', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO field_tracking (tenant_id, employee_id, date, trip_type, travel_from, travel_to,
                                     distance_km, allowance_amount, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())
    ");
    $stmt->execute([
        $tenantId,
        $employeeId,
        $input['date'],
        $input['trip_type'],
        trim($input['travel_from']),
        trim($input['travel_to']),
        isset($input['distance_km']) ? (float) $input['distance_km'] : null,
        isset($input['allowance_amount']) ? (float) $input['allowance_amount'] : null,
        trim($input['notes'] ?? ''),
    ]);

    jsonResponse([
        'success' => true,
        'id'      => (int) $pdo->lastInsertId(),
        'message' => 'Field tracking record created',
    ], 201);
    exit;
}

// ── PUT — Approve Record ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $user = requireManager();
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    $id     = (int) ($input['id'] ?? 0);
    $action = $input['action'] ?? '';

    if (!$id) jsonError('Record ID required', 400);

    if ($action !== 'approve') {
        jsonError('Invalid action. Must be "approve"', 400);
    }

    // Verify record exists and belongs to tenant
    $check = $pdo->prepare("SELECT id, status FROM field_tracking WHERE id = ? AND tenant_id = ?");
    $check->execute([$id, $tenantId]);
    $record = $check->fetch();

    if (!$record) {
        jsonError('Record not found', 404);
    }

    if ($record['status'] !== 'pending') {
        jsonError('Record has already been ' . $record['status'], 400);
    }

    $pdo->prepare("
        UPDATE field_tracking SET status = 'approved' WHERE id = ? AND tenant_id = ?
    ")->execute([$id, $tenantId]);

    jsonResponse(['success' => true, 'message' => 'Record approved']);
    exit;
}

jsonError('Method not allowed', 405);
