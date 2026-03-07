<?php
/**
 * WebSquare — Loan Repayments
 * GET /api/loan-repayments.php?loan_id=X  — list repayments for a loan
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

if (empty($_GET['loan_id'])) {
    jsonError('loan_id is required', 400);
}

$loanId = (int) $_GET['loan_id'];

// Verify loan belongs to tenant
$loanCheck = $pdo->prepare("SELECT id FROM hr_loans WHERE id = ? AND tenant_id = ?");
$loanCheck->execute([$loanId, $tenantId]);
if (!$loanCheck->fetch()) {
    jsonError('Loan not found', 404);
}

$stmt = $pdo->prepare("
    SELECT id, loan_id, due_date, amount, status, paid_date, payroll_run_id
    FROM loan_repayments
    WHERE loan_id = ? AND tenant_id = ?
    ORDER BY due_date ASC
");
$stmt->execute([$loanId, $tenantId]);
$repayments = $stmt->fetchAll();

jsonResponse([
    'repayments' => array_map(function ($r) {
        return [
            'id'             => (int) $r['id'],
            'loan_id'        => (int) $r['loan_id'],
            'due_date'       => $r['due_date'],
            'amount'         => (float) $r['amount'],
            'status'         => $r['status'],
            'paid_date'      => $r['paid_date'],
            'payroll_run_id' => $r['payroll_run_id'] ? (int) $r['payroll_run_id'] : null,
        ];
    }, $repayments),
    'loan_id' => $loanId,
]);
