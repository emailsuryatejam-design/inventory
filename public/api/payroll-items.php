<?php
/**
 * WebSquare — Payroll Items
 * GET /api/payroll-items.php?run_id=X — list items for a payroll run
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET only ──
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$runId = (int) ($_GET['run_id'] ?? 0);
if (!$runId) {
    jsonError('Missing required parameter: run_id', 400);
}

// Verify run belongs to tenant
$runStmt = $pdo->prepare("
    SELECT id FROM payroll_runs WHERE id = ? AND tenant_id = ?
");
$runStmt->execute([$runId, $tenantId]);
if (!$runStmt->fetch()) {
    jsonError('Payroll run not found', 404);
}

// Fetch items with employee info
$stmt = $pdo->prepare("
    SELECT pi.id, pi.employee_id,
           e.employee_no, e.first_name, e.last_name,
           pi.basic_salary, pi.total_allowances, pi.gross_pay,
           pi.nssf_employee, pi.nssf_employer, pi.paye, pi.nhif, pi.housing_levy,
           pi.loan_deductions, pi.advance_deductions, pi.other_deductions,
           pi.total_deductions, pi.net_pay, pi.total_employer_cost,
           pi.overtime_hours, pi.overtime_pay, pi.absent_days, pi.absent_deduction
    FROM payroll_items pi
    JOIN hr_employees e ON pi.employee_id = e.id
    WHERE pi.payroll_run_id = ? AND pi.tenant_id = ?
    ORDER BY e.last_name ASC, e.first_name ASC
");
$stmt->execute([$runId, $tenantId]);
$items = $stmt->fetchAll();

jsonResponse([
    'items' => array_map(function ($i) {
        return [
            'id'                => (int) $i['id'],
            'employee_id'       => (int) $i['employee_id'],
            'employee_no'       => $i['employee_no'],
            'first_name'        => $i['first_name'],
            'last_name'         => $i['last_name'],
            'basic_salary'      => (float) $i['basic_salary'],
            'total_allowances'  => (float) $i['total_allowances'],
            'gross_pay'         => (float) $i['gross_pay'],
            'nssf_employee'     => (float) $i['nssf_employee'],
            'nssf_employer'     => (float) $i['nssf_employer'],
            'paye'              => (float) $i['paye'],
            'nhif'              => (float) $i['nhif'],
            'housing_levy'      => (float) $i['housing_levy'],
            'loan_deductions'   => (float) $i['loan_deductions'],
            'advance_deductions'=> (float) $i['advance_deductions'],
            'other_deductions'  => (float) $i['other_deductions'],
            'total_deductions'  => (float) $i['total_deductions'],
            'net_pay'           => (float) $i['net_pay'],
            'total_employer_cost' => (float) $i['total_employer_cost'],
            'overtime_hours'    => (float) $i['overtime_hours'],
            'overtime_pay'      => (float) $i['overtime_pay'],
            'absent_days'       => (int) $i['absent_days'],
            'absent_deduction'  => (float) $i['absent_deduction'],
        ];
    }, $items),
]);
