<?php
/**
 * WebSquare — Payroll Reports
 * GET /api/payroll-reports.php?type=X&start_date=Y&end_date=Z
 * Returns { title, headers: [...], rows: [[...], ...] }
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$type      = $_GET['type'] ?? '';
$startDate = $_GET['start_date'] ?? date('Y-m-01');
$endDate   = $_GET['end_date'] ?? date('Y-m-d');

if (!$type) {
    jsonError('Report type is required', 400);
}

$validTypes = [
    'payroll_summary', 'employee_list', 'department_costs', 'statutory',
    'leave_summary', 'loan_report', 'attendance_report', 'advance_report',
    'expense_report', 'headcount', 'bank_file',
];

if (!in_array($type, $validTypes)) {
    jsonError('Invalid report type', 400);
}

$title   = '';
$headers = [];
$rows    = [];

switch ($type) {
    case 'payroll_summary':
        $title = 'Payroll Summary';
        $headers = ['Period', 'Employees', 'Gross Pay', 'Total Deductions', 'Net Pay', 'Status'];

        $stmt = $pdo->prepare("
            SELECT pp.name AS period_name,
                   COUNT(DISTINCT pi.employee_id) AS emp_count,
                   COALESCE(SUM(pi.gross_pay), 0) AS gross,
                   COALESCE(SUM(pi.total_deductions), 0) AS deductions,
                   COALESCE(SUM(pi.net_pay), 0) AS net,
                   pr.status
            FROM payroll_runs pr
            JOIN payroll_periods pp ON pr.period_id = pp.id
            LEFT JOIN payroll_items pi ON pi.payroll_run_id = pr.id
            WHERE pr.tenant_id = ?
              AND pp.start_date >= ?
              AND pp.end_date <= ?
            GROUP BY pr.id, pp.name, pr.status
            ORDER BY pp.start_date DESC
        ");
        $stmt->execute([$tenantId, $startDate, $endDate]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['period_name'],
                (int) $r['emp_count'],
                round((float) $r['gross']),
                round((float) $r['deductions']),
                round((float) $r['net']),
                $r['status'],
            ];
        }
        break;

    case 'employee_list':
        $title = 'Employee Directory';
        $headers = ['Employee No', 'Name', 'Department', 'Job Grade', 'Basic Salary', 'Status'];

        $stmt = $pdo->prepare("
            SELECT e.employee_no,
                   CONCAT(e.first_name, ' ', e.last_name) AS name,
                   COALESCE(d.name, '--') AS dept,
                   COALESCE(jg.name, '--') AS grade,
                   COALESCE(e.basic_salary, 0) AS salary,
                   e.employment_status AS status
            FROM hr_employees e
            LEFT JOIN departments d ON e.department_id = d.id
            LEFT JOIN job_grades jg ON e.job_grade_id = jg.id
            WHERE e.tenant_id = ?
            ORDER BY e.first_name, e.last_name
        ");
        $stmt->execute([$tenantId]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['employee_no'],
                $r['name'],
                $r['dept'],
                $r['grade'],
                round((float) $r['salary']),
                $r['status'],
            ];
        }
        break;

    case 'department_costs':
        $title = 'Department Costs';
        $headers = ['Department', 'Employees', 'Total Gross', 'Total Deductions', 'Total Net Pay'];

        $stmt = $pdo->prepare("
            SELECT COALESCE(d.name, 'Unassigned') AS dept,
                   COUNT(DISTINCT pi.employee_id) AS emp_count,
                   COALESCE(SUM(pi.gross_pay), 0) AS gross,
                   COALESCE(SUM(pi.total_deductions), 0) AS deductions,
                   COALESCE(SUM(pi.net_pay), 0) AS net
            FROM payroll_items pi
            JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
            JOIN payroll_periods pp ON pr.period_id = pp.id
            JOIN hr_employees e ON pi.employee_id = e.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE pr.tenant_id = ?
              AND pp.start_date >= ?
              AND pp.end_date <= ?
            GROUP BY d.name
            ORDER BY gross DESC
        ");
        $stmt->execute([$tenantId, $startDate, $endDate]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['dept'],
                (int) $r['emp_count'],
                round((float) $r['gross']),
                round((float) $r['deductions']),
                round((float) $r['net']),
            ];
        }
        break;

    case 'statutory':
        $title = 'Statutory Returns';
        $headers = ['Period', 'PAYE', 'NSSF Employee', 'NSSF Employer', 'NHIF', 'Housing Levy'];

        $stmt = $pdo->prepare("
            SELECT pp.name AS period_name,
                   COALESCE(SUM(pi.paye), 0) AS paye,
                   COALESCE(SUM(pi.nssf_employee), 0) AS nssf_emp,
                   COALESCE(SUM(pi.nssf_employer), 0) AS nssf_er,
                   COALESCE(SUM(pi.nhif), 0) AS nhif,
                   COALESCE(SUM(pi.housing_levy), 0) AS housing
            FROM payroll_items pi
            JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE pr.tenant_id = ?
              AND pp.start_date >= ?
              AND pp.end_date <= ?
            GROUP BY pp.name, pp.start_date
            ORDER BY pp.start_date DESC
        ");
        $stmt->execute([$tenantId, $startDate, $endDate]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['period_name'],
                round((float) $r['paye']),
                round((float) $r['nssf_emp']),
                round((float) $r['nssf_er']),
                round((float) $r['nhif']),
                round((float) $r['housing']),
            ];
        }
        break;

    case 'leave_summary':
        $title = 'Leave Summary';
        $headers = ['Leave Type', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Total Days'];

        $stmt = $pdo->prepare("
            SELECT lt.name AS leave_type,
                   COUNT(*) AS total,
                   SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) AS approved,
                   SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) AS pending,
                   SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                   SUM(CASE WHEN lr.status = 'approved' THEN lr.days ELSE 0 END) AS total_days
            FROM leave_requests lr
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.tenant_id = ?
              AND lr.start_date >= ?
              AND lr.end_date <= ?
            GROUP BY lt.name
            ORDER BY total DESC
        ");
        $stmt->execute([$tenantId, $startDate, $endDate]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['leave_type'],
                (int) $r['total'],
                (int) $r['approved'],
                (int) $r['pending'],
                (int) $r['rejected'],
                (int) $r['total_days'],
            ];
        }
        break;

    case 'loan_report':
        $title = 'Loan Report';
        $headers = ['Employee', 'Employee No', 'Loan Amount', 'Repaid', 'Balance', 'Status'];

        $stmt = $pdo->prepare("
            SELECT CONCAT(e.first_name, ' ', e.last_name) AS name,
                   e.employee_no,
                   l.principal_amount AS amount,
                   (l.principal_amount - l.outstanding_balance) AS repaid,
                   l.outstanding_balance AS balance,
                   l.status
            FROM hr_loans l
            JOIN hr_employees e ON l.employee_id = e.id
            WHERE l.tenant_id = ?
              AND l.status IN ('active', 'approved')
            ORDER BY l.outstanding_balance DESC
        ");
        $stmt->execute([$tenantId]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['name'],
                $r['employee_no'],
                round((float) $r['amount']),
                round((float) $r['repaid']),
                round((float) $r['balance']),
                $r['status'],
            ];
        }
        break;

    case 'attendance_report':
        $title = 'Attendance Report';
        $headers = ['Employee', 'Employee No', 'Present', 'Absent', 'On Leave', 'Half Day', 'Total Days'];

        $stmt = $pdo->prepare("
            SELECT CONCAT(e.first_name, ' ', e.last_name) AS name,
                   e.employee_no,
                   SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
                   SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
                   SUM(CASE WHEN a.status = 'on_leave' THEN 1 ELSE 0 END) AS late,
                   SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END) AS half_day,
                   COUNT(*) AS total
            FROM attendance a
            JOIN hr_employees e ON a.employee_id = e.id
            WHERE a.tenant_id = ?
              AND a.date >= ?
              AND a.date <= ?
            GROUP BY e.id, e.first_name, e.last_name, e.employee_no
            ORDER BY e.first_name, e.last_name
        ");
        $stmt->execute([$tenantId, $startDate, $endDate]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['name'],
                $r['employee_no'],
                (int) $r['present'],
                (int) $r['absent'],
                (int) $r['late'],
                (int) $r['half_day'],
                (int) $r['total'],
            ];
        }
        break;

    case 'advance_report':
        $title = 'Advance Report';
        $headers = ['Employee', 'Employee No', 'Amount', 'Reason', 'Status', 'Date'];

        $stmt = $pdo->prepare("
            SELECT CONCAT(e.first_name, ' ', e.last_name) AS name,
                   e.employee_no,
                   sa.amount,
                   sa.reason,
                   sa.status,
                   sa.created_at
            FROM hr_salary_advances sa
            JOIN hr_employees e ON sa.employee_id = e.id
            WHERE sa.tenant_id = ?
              AND sa.created_at >= ?
              AND sa.created_at <= ?
            ORDER BY sa.created_at DESC
        ");
        $stmt->execute([$tenantId, $startDate, $endDate . ' 23:59:59']);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['name'],
                $r['employee_no'],
                round((float) $r['amount']),
                $r['reason'] ?: '--',
                $r['status'],
                date('d M Y', strtotime($r['created_at'])),
            ];
        }
        break;

    case 'expense_report':
        $title = 'Expense Report';
        $headers = ['Employee', 'Employee No', 'Description', 'Amount', 'Status', 'Date'];

        $stmt = $pdo->prepare("
            SELECT CONCAT(e.first_name, ' ', e.last_name) AS name,
                   e.employee_no,
                   ec.description,
                   ec.amount,
                   ec.status,
                   ec.created_at
            FROM expense_claims ec
            JOIN hr_employees e ON ec.employee_id = e.id
            WHERE ec.tenant_id = ?
              AND ec.created_at >= ?
              AND ec.created_at <= ?
            ORDER BY ec.created_at DESC
        ");
        $stmt->execute([$tenantId, $startDate, $endDate . ' 23:59:59']);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['name'],
                $r['employee_no'],
                $r['description'] ?: '--',
                round((float) $r['amount']),
                $r['status'],
                date('d M Y', strtotime($r['created_at'])),
            ];
        }
        break;

    case 'headcount':
        $title = 'Headcount Report';
        $headers = ['Department', 'Active', 'Inactive', 'On Leave', 'Total'];

        $stmt = $pdo->prepare("
            SELECT COALESCE(d.name, 'Unassigned') AS dept,
                   SUM(CASE WHEN e.employment_status = 'active' THEN 1 ELSE 0 END) AS active,
                   SUM(CASE WHEN e.employment_status IN ('inactive','suspended','terminated') THEN 1 ELSE 0 END) AS inactive,
                   SUM(CASE WHEN e.employment_status = 'on_leave' THEN 1 ELSE 0 END) AS on_leave,
                   COUNT(*) AS total
            FROM hr_employees e
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.tenant_id = ?
            GROUP BY d.name
            ORDER BY total DESC
        ");
        $stmt->execute([$tenantId]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['dept'],
                (int) $r['active'],
                (int) $r['inactive'],
                (int) $r['on_leave'],
                (int) $r['total'],
            ];
        }
        break;

    case 'bank_file':
        $title = 'Bank File';
        $headers = ['Employee No', 'Name', 'Bank Name', 'Branch', 'Account No', 'Net Pay'];

        $stmt = $pdo->prepare("
            SELECT e.employee_no,
                   CONCAT(e.first_name, ' ', e.last_name) AS name,
                   COALESCE(e.bank_name, '--') AS bank_name,
                   COALESCE(e.bank_branch, '--') AS bank_branch,
                   COALESCE(e.bank_account, '--') AS account_no,
                   COALESCE(pi.net_pay, 0) AS net_pay
            FROM payroll_items pi
            JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
            JOIN payroll_periods pp ON pr.period_id = pp.id
            JOIN hr_employees e ON pi.employee_id = e.id
            WHERE pr.tenant_id = ?
              AND pp.start_date >= ?
              AND pp.end_date <= ?
              AND pr.status IN ('approved', 'paid')
            ORDER BY e.first_name, e.last_name
        ");
        $stmt->execute([$tenantId, $startDate, $endDate]);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['employee_no'],
                $r['name'],
                $r['bank_name'],
                $r['bank_branch'],
                $r['account_no'],
                round((float) $r['net_pay']),
            ];
        }
        break;
}

jsonResponse([
    'title'   => $title,
    'type'    => $type,
    'headers' => $headers,
    'rows'    => $rows,
    'period'  => "{$startDate} to {$endDate}",
]);
