<?php
/**
 * WebSquare — Payroll Dashboard Stats
 * GET /api/payroll-dashboard.php
 */
require_once __DIR__ . '/middleware.php';

requireMethod('GET');
$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// Total employees
$stmt = $pdo->prepare('SELECT COUNT(*) FROM hr_employees WHERE tenant_id = ? AND employment_status = ?');
$stmt->execute([$tenantId, 'active']);
$totalEmployees = (int) $stmt->fetchColumn();

// Total departments
$stmt = $pdo->prepare('SELECT COUNT(*) FROM departments WHERE tenant_id = ? AND is_active = 1');
$stmt->execute([$tenantId]);
$totalDepartments = (int) $stmt->fetchColumn();

// Monthly payroll (sum of latest run's net pay)
$stmt = $pdo->prepare('
    SELECT COALESCE(SUM(pi.net_pay), 0)
    FROM payroll_items pi
    JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
    WHERE pr.tenant_id = ? AND pr.status IN ("approved","paid")
    ORDER BY pr.created_at DESC LIMIT 1
');
$stmt->execute([$tenantId]);
$monthlyPayroll = (float) $stmt->fetchColumn();

// Pending leave requests
$stmt = $pdo->prepare('SELECT COUNT(*) FROM leave_requests WHERE tenant_id = ? AND status = ?');
$stmt->execute([$tenantId, 'pending']);
$pendingLeave = (int) $stmt->fetchColumn();

// Active loans
$stmt = $pdo->prepare('SELECT COUNT(*) FROM hr_loans WHERE tenant_id = ? AND status IN ("active","approved")');
$stmt->execute([$tenantId]);
$activeLoans = (int) $stmt->fetchColumn();

// Pending advances
$stmt = $pdo->prepare('SELECT COUNT(*) FROM hr_salary_advances WHERE tenant_id = ? AND status = ?');
$stmt->execute([$tenantId, 'pending']);
$pendingAdvances = (int) $stmt->fetchColumn();

// Active contracts
$stmt = $pdo->prepare('SELECT COUNT(*) FROM contracts WHERE tenant_id = ? AND status = ?');
$stmt->execute([$tenantId, 'active']);
$activeContracts = (int) $stmt->fetchColumn();

// Total shifts
$stmt = $pdo->prepare('SELECT COUNT(*) FROM shifts WHERE tenant_id = ? AND is_active = 1');
$stmt->execute([$tenantId]);
$totalShifts = (int) $stmt->fetchColumn();

// Recent activity (from audit log)
$recentActivity = [];
try {
    $stmt = $pdo->prepare('
        SELECT pal.action, pal.entity_type, pal.created_at, u.name as user_name
        FROM payroll_audit_log pal
        LEFT JOIN users u ON pal.user_id = u.id
        WHERE pal.tenant_id = ?
        ORDER BY pal.created_at DESC
        LIMIT 10
    ');
    $stmt->execute([$tenantId]);
    $recentActivity = $stmt->fetchAll();
} catch (PDOException $e) {
    // Table may not exist yet
}

jsonResponse([
    'stats' => [
        'totalEmployees' => $totalEmployees,
        'totalDepartments' => $totalDepartments,
        'monthlyPayroll' => $monthlyPayroll,
        'pendingLeave' => $pendingLeave,
        'activeLoans' => $activeLoans,
        'pendingAdvances' => $pendingAdvances,
        'activeContracts' => $activeContracts,
        'totalShifts' => $totalShifts,
    ],
    'recentActivity' => $recentActivity,
]);
