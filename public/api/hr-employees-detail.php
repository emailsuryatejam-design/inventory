<?php
/**
 * WebSquare — HR Employee Detail
 * GET /api/hr-employees-detail.php?id=X — single employee with full details
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET Only ──
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$id = (int) ($_GET['id'] ?? 0);
if (!$id) jsonError('Employee ID required', 400);

// Fetch employee with JOINs for related names
$stmt = $pdo->prepare("
    SELECT e.*,
           d.name AS department_name,
           jg.name AS job_grade_name,
           jg.level AS job_grade_level,
           s.name AS shift_name,
           r.name AS region_name
    FROM hr_employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN job_grades jg ON e.job_grade_id = jg.id
    LEFT JOIN shifts s ON e.shift_id = s.id
    LEFT JOIN hr_regions r ON e.region_id = r.id
    WHERE e.id = ? AND e.tenant_id = ?
");
$stmt->execute([$id, $tenantId]);
$employee = $stmt->fetch();

if (!$employee) {
    jsonError('Employee not found', 404);
}

// Fetch employee allowances with type names
$allowStmt = $pdo->prepare("
    SELECT ea.id, ea.allowance_type_id, ea.amount, ea.effective_from, ea.effective_to, ea.is_active, ea.created_at,
           at.name AS allowance_type_name, at.code AS allowance_type_code, at.is_taxable, at.is_fixed
    FROM employee_allowances ea
    JOIN allowance_types at ON ea.allowance_type_id = at.id
    WHERE ea.employee_id = ? AND ea.tenant_id = ?
    ORDER BY ea.is_active DESC, at.name ASC
");
$allowStmt->execute([$id, $tenantId]);
$allowances = $allowStmt->fetchAll();

// Fetch recent leave requests
$leaveStmt = $pdo->prepare("
    SELECT lr.id, lr.leave_type_id, lr.start_date, lr.end_date, lr.days, lr.reason, lr.status, lr.created_at,
           lt.name AS leave_type_name
    FROM leave_requests lr
    LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.employee_id = ? AND lr.tenant_id = ?
    ORDER BY lr.created_at DESC
    LIMIT 20
");
$leaveStmt->execute([$id, $tenantId]);
$leaveRequests = $leaveStmt->fetchAll();

jsonResponse([
    'employee' => [
        'id' => (int) $employee['id'],
        'employee_no' => $employee['employee_no'],
        'first_name' => $employee['first_name'],
        'last_name' => $employee['last_name'],
        'email' => $employee['email'],
        'phone' => $employee['phone'],
        'department_id' => $employee['department_id'] ? (int) $employee['department_id'] : null,
        'department_name' => $employee['department_name'],
        'job_grade_id' => $employee['job_grade_id'] ? (int) $employee['job_grade_id'] : null,
        'job_grade_name' => $employee['job_grade_name'],
        'job_grade_level' => $employee['job_grade_level'] ? (int) $employee['job_grade_level'] : null,
        'job_title' => $employee['job_title'],
        'employment_type' => $employee['employment_type'],
        'employment_status' => $employee['employment_status'],
        'date_of_birth' => $employee['date_of_birth'],
        'gender' => $employee['gender'],
        'national_id' => $employee['national_id'],
        'tax_pin' => $employee['tax_pin'],
        'nssf_no' => $employee['nssf_no'],
        'nhif_no' => $employee['nhif_no'],
        'bank_name' => $employee['bank_name'],
        'bank_branch' => $employee['bank_branch'],
        'bank_account' => $employee['bank_account'],
        'basic_salary' => $employee['basic_salary'] ? (float) $employee['basic_salary'] : null,
        'hire_date' => $employee['hire_date'],
        'termination_date' => $employee['termination_date'],
        'profile_photo' => $employee['profile_photo'],
        'camp_id' => $employee['camp_id'] ? (int) $employee['camp_id'] : null,
        'region_id' => $employee['region_id'] ? (int) $employee['region_id'] : null,
        'region_name' => $employee['region_name'],
        'shift_id' => $employee['shift_id'] ? (int) $employee['shift_id'] : null,
        'shift_name' => $employee['shift_name'],
        'created_at' => $employee['created_at'],
        'updated_at' => $employee['updated_at'],
    ],
    'allowances' => array_map(function ($a) {
        return [
            'id' => (int) $a['id'],
            'allowance_type_id' => (int) $a['allowance_type_id'],
            'allowance_type_name' => $a['allowance_type_name'],
            'allowance_type_code' => $a['allowance_type_code'],
            'is_taxable' => (bool) $a['is_taxable'],
            'is_fixed' => (bool) $a['is_fixed'],
            'amount' => (float) $a['amount'],
            'effective_from' => $a['effective_from'],
            'effective_to' => $a['effective_to'],
            'is_active' => (bool) $a['is_active'],
            'created_at' => $a['created_at'],
        ];
    }, $allowances),
    'leave_requests' => array_map(function ($l) {
        return [
            'id' => (int) $l['id'],
            'leave_type_id' => (int) $l['leave_type_id'],
            'leave_type_name' => $l['leave_type_name'],
            'start_date' => $l['start_date'],
            'end_date' => $l['end_date'],
            'days' => (int) $l['days'],
            'reason' => $l['reason'],
            'status' => $l['status'],
            'created_at' => $l['created_at'],
        ];
    }, $leaveRequests),
]);
