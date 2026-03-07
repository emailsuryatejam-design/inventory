<?php
/**
 * WebSquare — Payroll Periods
 * GET    /api/payroll-periods.php           — list all periods
 * POST   /api/payroll-periods.php           — create period
 * PUT    /api/payroll-periods.php           — update period
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List all periods ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $params = [];
    tenantScope($where, $params, $tenantId, 'pp');

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $stmt = $pdo->prepare("
        SELECT pp.id, pp.name, pp.period_type, pp.start_date, pp.end_date,
               pp.pay_date, pp.status, pp.created_at
        FROM payroll_periods pp
        {$whereClause}
        ORDER BY pp.start_date DESC
    ");
    $stmt->execute($params);
    $periods = $stmt->fetchAll();

    jsonResponse([
        'periods' => array_map(function ($p) {
            return [
                'id'          => (int) $p['id'],
                'name'        => $p['name'],
                'period_type' => $p['period_type'],
                'start_date'  => $p['start_date'],
                'end_date'    => $p['end_date'],
                'pay_date'    => $p['pay_date'],
                'status'      => $p['status'],
                'created_at'  => $p['created_at'],
                'updated_at'  => $p['created_at'],
            ];
        }, $periods),
    ]);
    exit;
}

// ── POST — Create period ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = requireManager();
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    requireFields($input, ['name', 'period_type', 'start_date', 'end_date', 'pay_date']);

    // Validate period_type
    $validTypes = ['monthly', 'bi_weekly', 'weekly'];
    if (!in_array($input['period_type'], $validTypes)) {
        jsonError('Invalid period type. Must be: monthly, bi_weekly, or weekly', 400);
    }

    // Validate dates
    $startDate = $input['start_date'];
    $endDate = $input['end_date'];
    $payDate = $input['pay_date'];

    if ($endDate <= $startDate) {
        jsonError('End date must be after start date', 400);
    }

    $status = $input['status'] ?? 'open';
    if (!in_array($status, ['open', 'locked'])) {
        $status = 'open';
    }

    $stmt = $pdo->prepare("
        INSERT INTO payroll_periods (tenant_id, name, period_type, start_date, end_date, pay_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ");
    $stmt->execute([
        $tenantId,
        trim($input['name']),
        $input['period_type'],
        $startDate,
        $endDate,
        $payDate,
        $status,
    ]);

    $periodId = (int) $pdo->lastInsertId();

    jsonResponse([
        'success' => true,
        'period'  => [
            'id'          => $periodId,
            'name'        => trim($input['name']),
            'period_type' => $input['period_type'],
            'start_date'  => $startDate,
            'end_date'    => $endDate,
            'pay_date'    => $payDate,
            'status'      => $status,
        ],
    ], 201);
    exit;
}

// ── PUT — Update period ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $user = requireManager();
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    requireFields($input, ['id']);

    $periodId = (int) $input['id'];

    // Verify period exists and belongs to tenant
    $stmt = $pdo->prepare("SELECT id, status FROM payroll_periods WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$periodId, $tenantId]);
    $period = $stmt->fetch();

    if (!$period) {
        jsonError('Payroll period not found', 404);
    }

    // Build update fields dynamically
    $updates = [];
    $params = [];

    if (isset($input['name'])) {
        $updates[] = 'name = ?';
        $params[] = trim($input['name']);
    }

    if (isset($input['period_type'])) {
        $validTypes = ['monthly', 'bi_weekly', 'weekly'];
        if (!in_array($input['period_type'], $validTypes)) {
            jsonError('Invalid period type', 400);
        }
        $updates[] = 'period_type = ?';
        $params[] = $input['period_type'];
    }

    if (isset($input['start_date'])) {
        $updates[] = 'start_date = ?';
        $params[] = $input['start_date'];
    }

    if (isset($input['end_date'])) {
        $updates[] = 'end_date = ?';
        $params[] = $input['end_date'];
    }

    if (isset($input['pay_date'])) {
        $updates[] = 'pay_date = ?';
        $params[] = $input['pay_date'];
    }

    if (isset($input['status'])) {
        $validStatuses = ['open', 'locked'];
        if (!in_array($input['status'], $validStatuses)) {
            jsonError('Invalid status. Must be: open, closed, or locked', 400);
        }
        $updates[] = 'status = ?';
        $params[] = $input['status'];
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $periodId;
    $params[] = $tenantId;

    $sql = "UPDATE payroll_periods SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Period updated']);
    exit;
}

jsonError('Method not allowed', 405);
