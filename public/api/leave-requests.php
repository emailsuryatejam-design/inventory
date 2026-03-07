<?php
/**
 * WebSquare — Leave Requests
 * GET    /api/leave-requests.php           — paginated list of leave requests
 * POST   /api/leave-requests.php           — create leave request
 * PUT    /api/leave-requests.php           — approve / reject leave request
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List leave requests ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $status  = $_GET['status'] ?? '';
    $employeeId = $_GET['employee_id'] ?? '';

    $where  = [];
    $params = [];
    tenantScope($where, $params, $tenantId, 'lr');

    if ($status) {
        $where[] = 'lr.status = ?';
        $params[] = $status;
    }

    if ($employeeId) {
        $where[] = 'lr.employee_id = ?';
        $params[] = (int) $employeeId;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM leave_requests lr
        {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $dataParams = $params;
    $dataParams[] = $perPage;
    $dataParams[] = $offset;

    $stmt = $pdo->prepare("
        SELECT lr.id, lr.employee_id, lr.leave_type_id, lr.start_date, lr.end_date,
               lr.days, lr.reason, lr.status, lr.rejection_reason,
               lr.approved_by, lr.approved_at, lr.created_at,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               e.employee_no,
               lt.name AS leave_type_name, lt.code AS leave_type_code
        FROM leave_requests lr
        JOIN hr_employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        {$whereClause}
        ORDER BY lr.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($dataParams);
    $requests = $stmt->fetchAll();

    // Status counts
    $scStmt = $pdo->prepare("
        SELECT lr.status, COUNT(*) AS cnt
        FROM leave_requests lr
        WHERE lr.tenant_id = ?
        GROUP BY lr.status
    ");
    $scStmt->execute([$tenantId]);
    $statusRows = $scStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $statusCounts = [
        'pending'  => (int) ($statusRows['pending'] ?? 0),
        'approved' => (int) ($statusRows['approved'] ?? 0),
        'rejected' => (int) ($statusRows['rejected'] ?? 0),
    ];

    jsonResponse([
        'requests' => array_map(function ($r) {
            return [
                'id'               => (int) $r['id'],
                'employee_id'      => (int) $r['employee_id'],
                'employee_name'    => $r['employee_name'],
                'employee_no'      => $r['employee_no'],
                'leave_type_id'    => (int) $r['leave_type_id'],
                'leave_type_name'  => $r['leave_type_name'],
                'leave_type_code'  => $r['leave_type_code'],
                'start_date'       => $r['start_date'],
                'end_date'         => $r['end_date'],
                'days'             => (int) $r['days'],
                'reason'           => $r['reason'],
                'status'           => $r['status'],
                'rejection_reason' => $r['rejection_reason'],
                'approved_at'      => $r['approved_at'],
                'created_at'       => $r['created_at'],
            ];
        }, $requests),
        'status_counts' => $statusCounts,
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create leave request ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['employee_id', 'leave_type_id', 'start_date', 'end_date']);

    $employeeId  = (int) $input['employee_id'];
    $leaveTypeId = (int) $input['leave_type_id'];
    $startDate   = $input['start_date'];
    $endDate     = $input['end_date'];
    $reason      = trim($input['reason'] ?? '');

    // Verify employee belongs to tenant
    $empCheck = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $empCheck->execute([$employeeId, $tenantId]);
    if (!$empCheck->fetch()) {
        jsonError('Employee not found', 404);
    }

    // Verify leave type belongs to tenant
    $ltCheck = $pdo->prepare("SELECT id FROM leave_types WHERE id = ? AND tenant_id = ?");
    $ltCheck->execute([$leaveTypeId, $tenantId]);
    if (!$ltCheck->fetch()) {
        jsonError('Leave type not found', 404);
    }

    // Calculate days
    $start = new DateTime($startDate);
    $end   = new DateTime($endDate);
    if ($end < $start) {
        jsonError('End date must be on or after start date', 400);
    }
    $days = $start->diff($end)->days + 1;

    $stmt = $pdo->prepare("
        INSERT INTO leave_requests (tenant_id, employee_id, leave_type_id, start_date, end_date, days, reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    ");
    $stmt->execute([$tenantId, $employeeId, $leaveTypeId, $startDate, $endDate, $days, $reason]);

    $id = (int) $pdo->lastInsertId();

    jsonResponse([
        'success' => true,
        'id'      => $id,
        'days'    => $days,
        'message' => 'Leave request created',
    ], 201);
    exit;
}

// ── PUT — Approve / Reject ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $user = requireManager();
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    requireFields($input, ['id', 'action']);

    $id     = (int) $input['id'];
    $action = $input['action'];

    if (!in_array($action, ['approve', 'reject'])) {
        jsonError('Invalid action. Must be "approve" or "reject"', 400);
    }

    // Verify request exists and belongs to tenant
    $check = $pdo->prepare("SELECT id, status FROM leave_requests WHERE id = ? AND tenant_id = ?");
    $check->execute([$id, $tenantId]);
    $request = $check->fetch();

    if (!$request) {
        jsonError('Leave request not found', 404);
    }

    if ($request['status'] !== 'pending') {
        jsonError('Leave request has already been ' . $request['status'], 400);
    }

    if ($action === 'approve') {
        $pdo->prepare("
            UPDATE leave_requests
            SET status = 'approved', approved_by = ?, approved_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ")->execute([$user['user_id'], $id, $tenantId]);

        jsonResponse(['success' => true, 'message' => 'Leave request approved']);
    } else {
        $reason = trim($input['reason'] ?? '');
        $pdo->prepare("
            UPDATE leave_requests
            SET status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_reason = ?
            WHERE id = ? AND tenant_id = ?
        ")->execute([$user['user_id'], $reason, $id, $tenantId]);

        jsonResponse(['success' => true, 'message' => 'Leave request rejected']);
    }
    exit;
}

jsonError('Method not allowed', 405);
