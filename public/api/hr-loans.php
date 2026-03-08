<?php
/**
 * WebSquare — HR Loans
 * GET    /api/hr-loans.php            — paginated list of loans
 * POST   /api/hr-loans.php            — create loan
 * PUT    /api/hr-loans.php            — approve / reject loan
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List loans ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $status  = $_GET['status'] ?? '';

    $where  = [];
    $params = [];
    tenantScope($where, $params, $tenantId, 'l');

    if ($status) {
        $where[] = 'l.status = ?';
        $params[] = $status;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) FROM hr_loans l {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $dataParams = $params;
    $dataParams[] = $perPage;
    $dataParams[] = $offset;

    $stmt = $pdo->prepare("
        SELECT l.id, l.employee_id, l.loan_type, l.loan_source, l.institution_name,
               l.external_reference, l.principal_amount, l.interest_rate, l.interest_type,
               l.repayment_months, l.monthly_deduction, l.outstanding_balance,
               l.status, l.approved_by, l.approved_at, l.created_at,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               e.employee_no
        FROM hr_loans l
        JOIN hr_employees e ON l.employee_id = e.id
        {$whereClause}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($dataParams);
    $loans = $stmt->fetchAll();

    // Status counts
    $scStmt = $pdo->prepare("
        SELECT status, COUNT(*) AS cnt FROM hr_loans WHERE tenant_id = ? GROUP BY status
    ");
    $scStmt->execute([$tenantId]);
    $statusRows = $scStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $statusCounts = [
        'pending'   => (int) ($statusRows['pending'] ?? 0),
        'approved'  => (int) ($statusRows['approved'] ?? 0),
        'active'    => (int) ($statusRows['active'] ?? 0),
        'completed' => (int) ($statusRows['completed'] ?? 0),
        'rejected'  => (int) ($statusRows['rejected'] ?? 0),
    ];

    jsonResponse([
        'loans' => array_map(function ($l) {
            return [
                'id'                 => (int) $l['id'],
                'employee_id'        => (int) $l['employee_id'],
                'employee_name'      => $l['employee_name'],
                'employee_no'        => $l['employee_no'],
                'loan_type'          => $l['loan_type'],
                'loan_source'        => $l['loan_source'],
                'institution_name'   => $l['institution_name'],
                'external_reference' => $l['external_reference'],
                'principal_amount'   => (float) $l['principal_amount'],
                'interest_rate'      => (float) $l['interest_rate'],
                'interest_type'      => $l['interest_type'],
                'repayment_months'   => (int) $l['repayment_months'],
                'monthly_deduction'  => (float) $l['monthly_deduction'],
                'outstanding_balance'=> (float) $l['outstanding_balance'],
                'status'             => $l['status'],
                'approved_at'        => $l['approved_at'],
                'created_at'         => $l['created_at'],
            ];
        }, $loans),
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

// ── POST — Create loan ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['employee_id', 'loan_type', 'principal_amount', 'repayment_months']);

    $employeeId = (int) $input['employee_id'];

    // Verify employee belongs to tenant
    $empCheck = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $empCheck->execute([$employeeId, $tenantId]);
    if (!$empCheck->fetch()) {
        jsonError('Employee not found', 404);
    }

    $principal       = (float) $input['principal_amount'];
    $interestRate    = (float) ($input['interest_rate'] ?? 0);
    $repaymentMonths = (int) $input['repayment_months'];
    $loanSource      = $input['loan_source'] ?? 'company';
    $interestType    = $input['interest_type'] ?? 'flat';

    // Auto-calculate monthly deduction if not provided
    $monthlyDeduction = !empty($input['monthly_deduction'])
        ? (float) $input['monthly_deduction']
        : round($principal / max(1, $repaymentMonths), 2);

    $stmt = $pdo->prepare("
        INSERT INTO hr_loans (
            tenant_id, employee_id, loan_type, loan_source, institution_name,
            external_reference, principal_amount, interest_rate, interest_type,
            repayment_months, monthly_deduction, outstanding_balance, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    ");
    $stmt->execute([
        $tenantId,
        $employeeId,
        $input['loan_type'],
        $loanSource,
        $input['institution_name'] ?? null,
        $input['external_reference'] ?? null,
        $principal,
        $interestRate,
        $interestType,
        $repaymentMonths,
        $monthlyDeduction,
        $principal, // outstanding_balance = principal initially
    ]);

    $id = (int) $pdo->lastInsertId();

    jsonResponse([
        'success'           => true,
        'id'                => $id,
        'monthly_deduction' => $monthlyDeduction,
        'message'           => 'Loan created',
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

    // Verify loan exists and belongs to tenant
    $check = $pdo->prepare("SELECT id, status FROM hr_loans WHERE id = ? AND tenant_id = ?");
    $check->execute([$id, $tenantId]);
    $loan = $check->fetch();

    if (!$loan) {
        jsonError('Loan not found', 404);
    }

    if ($loan['status'] !== 'pending') {
        jsonError('Loan has already been ' . $loan['status'], 400);
    }

    $newStatus = $action === 'approve' ? 'approved' : 'rejected';

    $pdo->prepare("
        UPDATE hr_loans
        SET status = ?, approved_by = ?, approved_at = NOW()
        WHERE id = ? AND tenant_id = ?
    ")->execute([$newStatus, $user['user_id'], $id, $tenantId]);

    jsonResponse(['success' => true, 'message' => "Loan {$newStatus}"]);
    exit;
}

jsonError('Method not allowed', 405);
