<?php
/**
 * WebSquare — Expense Claims
 * GET    /api/expense-claims.php       — paginated list
 * POST   /api/expense-claims.php       — create expense claim
 * PUT    /api/expense-claims.php       — approve / reject
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List expense claims ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $status  = $_GET['status'] ?? '';

    $where  = [];
    $params = [];
    tenantScope($where, $params, $tenantId, 'ec');

    if ($status) {
        $where[] = 'ec.status = ?';
        $params[] = $status;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM expense_claims ec {$whereClause}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $dataParams = $params;
    $dataParams[] = $perPage;
    $dataParams[] = $offset;

    $stmt = $pdo->prepare("
        SELECT ec.id, ec.employee_id, ec.title, ec.amount, ec.category,
               ec.receipt_url, ec.description, ec.status,
               ec.approved_by, ec.created_at,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               e.employee_no
        FROM expense_claims ec
        JOIN hr_employees e ON ec.employee_id = e.id
        {$whereClause}
        ORDER BY ec.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($dataParams);
    $claims = $stmt->fetchAll();

    // Status counts
    $scStmt = $pdo->prepare("
        SELECT status, COUNT(*) AS cnt FROM expense_claims WHERE tenant_id = ? GROUP BY status
    ");
    $scStmt->execute([$tenantId]);
    $statusRows = $scStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $statusCounts = [
        'pending'  => (int) ($statusRows['pending'] ?? 0),
        'approved' => (int) ($statusRows['approved'] ?? 0),
        'rejected' => (int) ($statusRows['rejected'] ?? 0),
        'paid'     => (int) ($statusRows['paid'] ?? 0),
    ];

    jsonResponse([
        'claims' => array_map(function ($c) {
            return [
                'id'            => (int) $c['id'],
                'employee_id'   => (int) $c['employee_id'],
                'employee_name' => $c['employee_name'],
                'employee_no'   => $c['employee_no'],
                'title'         => $c['title'],
                'amount'        => (float) $c['amount'],
                'category'      => $c['category'],
                'receipt_url'   => $c['receipt_url'],
                'description'   => $c['description'],
                'status'        => $c['status'],
                'created_at'    => $c['created_at'],
            ];
        }, $claims),
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

// ── POST — Create expense claim ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['employee_id', 'title', 'amount', 'category']);

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

    $allowedCategories = ['transport', 'meals', 'accommodation', 'supplies', 'other'];
    $category = $input['category'];
    if (!in_array($category, $allowedCategories)) {
        jsonError('Invalid category. Must be one of: ' . implode(', ', $allowedCategories), 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO expense_claims (tenant_id, employee_id, title, amount, category, receipt_url, description, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    ");
    $stmt->execute([
        $tenantId,
        $employeeId,
        trim($input['title']),
        $amount,
        $category,
        $input['receipt_url'] ?? null,
        trim($input['description'] ?? ''),
    ]);

    jsonResponse([
        'success' => true,
        'id'      => (int) $pdo->lastInsertId(),
        'message' => 'Expense claim created',
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

    $check = $pdo->prepare("SELECT id, status FROM expense_claims WHERE id = ? AND tenant_id = ?");
    $check->execute([$id, $tenantId]);
    $claim = $check->fetch();

    if (!$claim) {
        jsonError('Expense claim not found', 404);
    }

    if ($claim['status'] !== 'pending') {
        jsonError('Expense claim has already been ' . $claim['status'], 400);
    }

    $newStatus = $action === 'approve' ? 'approved' : 'rejected';

    $pdo->prepare("
        UPDATE expense_claims
        SET status = ?, approved_by = ?
        WHERE id = ? AND tenant_id = ?
    ")->execute([$newStatus, $user['user_id'], $id, $tenantId]);

    jsonResponse(['success' => true, 'message' => "Expense claim {$newStatus}"]);
    exit;
}

jsonError('Method not allowed', 405);
