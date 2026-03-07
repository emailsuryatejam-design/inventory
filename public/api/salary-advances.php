<?php
/**
 * WebSquare — Salary Advances
 * GET    /api/salary-advances.php       — paginated list
 * POST   /api/salary-advances.php       — create salary advance
 * PUT    /api/salary-advances.php       — approve / reject
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List salary advances ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $status  = $_GET['status'] ?? '';

    $where  = [];
    $params = [];
    tenantScope($where, $params, $tenantId, 'sa');

    if ($status) {
        $where[] = 'sa.status = ?';
        $params[] = $status;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM hr_salary_advances sa {$whereClause}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $dataParams = $params;
    $dataParams[] = $perPage;
    $dataParams[] = $offset;

    $stmt = $pdo->prepare("
        SELECT sa.id, sa.employee_id, sa.amount, sa.advance_date, sa.reason,
               sa.status, sa.approved_by, sa.created_at,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               e.employee_no
        FROM hr_salary_advances sa
        JOIN hr_employees e ON sa.employee_id = e.id
        {$whereClause}
        ORDER BY sa.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($dataParams);
    $advances = $stmt->fetchAll();

    // Status counts
    $scStmt = $pdo->prepare("
        SELECT status, COUNT(*) AS cnt FROM hr_salary_advances WHERE tenant_id = ? GROUP BY status
    ");
    $scStmt->execute([$tenantId]);
    $statusRows = $scStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $statusCounts = [
        'pending'  => (int) ($statusRows['pending'] ?? 0),
        'approved' => (int) ($statusRows['approved'] ?? 0),
        'rejected' => (int) ($statusRows['rejected'] ?? 0),
        'deducted' => (int) ($statusRows['deducted'] ?? 0),
    ];

    jsonResponse([
        'advances' => array_map(function ($a) {
            return [
                'id'            => (int) $a['id'],
                'employee_id'   => (int) $a['employee_id'],
                'employee_name' => $a['employee_name'],
                'employee_no'   => $a['employee_no'],
                'amount'        => (float) $a['amount'],
                'advance_date'  => $a['advance_date'],
                'reason'        => $a['reason'],
                'status'        => $a['status'],
                'created_at'    => $a['created_at'],
            ];
        }, $advances),
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

// ── POST — Create salary advance ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['employee_id', 'amount']);

    $employeeId = (int) $input['employee_id'];

    // Verify employee belongs to tenant
    $empCheck = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $empCheck->execute([$employeeId, $tenantId]);
    if (!$empCheck->fetch()) {
        jsonError('Employee not found', 404);
    }

    $amount = (float) $input['amount'];
    if ($amount <= 0) {
        jsonError('Amount must be greater than zero', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO hr_salary_advances (tenant_id, employee_id, amount, advance_date, reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', NOW())
    ");
    $stmt->execute([
        $tenantId,
        $employeeId,
        $amount,
        $input['advance_date'] ?? date('Y-m-d'),
        trim($input['reason'] ?? ''),
    ]);

    jsonResponse([
        'success' => true,
        'id'      => (int) $pdo->lastInsertId(),
        'message' => 'Salary advance created',
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

    $check = $pdo->prepare("SELECT id, status FROM hr_salary_advances WHERE id = ? AND tenant_id = ?");
    $check->execute([$id, $tenantId]);
    $advance = $check->fetch();

    if (!$advance) {
        jsonError('Salary advance not found', 404);
    }

    if ($advance['status'] !== 'pending') {
        jsonError('Salary advance has already been ' . $advance['status'], 400);
    }

    $newStatus = $action === 'approve' ? 'approved' : 'rejected';

    $pdo->prepare("
        UPDATE hr_salary_advances
        SET status = ?, approved_by = ?
        WHERE id = ? AND tenant_id = ?
    ")->execute([$newStatus, $user['user_id'], $id, $tenantId]);

    jsonResponse(['success' => true, 'message' => "Salary advance {$newStatus}"]);
    exit;
}

jsonError('Method not allowed', 405);
