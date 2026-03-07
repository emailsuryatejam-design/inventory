<?php
/**
 * WebSquare — Leave Calendar
 * GET /api/leave-calendar.php?month=3&year=2026  — leave data for a month
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

$month = (int) ($_GET['month'] ?? date('n'));
$year  = (int) ($_GET['year'] ?? date('Y'));

if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) {
    jsonError('Invalid month or year', 400);
}

$startDate = sprintf('%04d-%02d-01', $year, $month);
$endDate   = date('Y-m-t', strtotime($startDate));

// Get all approved leave requests that overlap with the given month
$stmt = $pdo->prepare("
    SELECT lr.id, lr.employee_id, lr.leave_type_id, lr.start_date, lr.end_date,
           lr.days, lr.status,
           CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
           e.employee_no,
           lt.name AS leave_type_name, lt.code AS leave_type_code
    FROM leave_requests lr
    JOIN hr_employees e ON lr.employee_id = e.id
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.tenant_id = ?
      AND lr.status = 'approved'
      AND lr.start_date <= ?
      AND lr.end_date >= ?
    ORDER BY e.first_name, e.last_name, lr.start_date
");
$stmt->execute([$tenantId, $endDate, $startDate]);
$requests = $stmt->fetchAll();

// Get all active employees
$empStmt = $pdo->prepare("
    SELECT id, employee_no, first_name, last_name,
           CONCAT(first_name, ' ', last_name) AS name
    FROM hr_employees
    WHERE tenant_id = ? AND status = 'active'
    ORDER BY first_name, last_name
");
$empStmt->execute([$tenantId]);
$employees = $empStmt->fetchAll();

// Group leaves by employee
$employeeLeaves = [];
foreach ($requests as $r) {
    $empId = (int) $r['employee_id'];
    if (!isset($employeeLeaves[$empId])) {
        $employeeLeaves[$empId] = [];
    }

    // Calculate which days in this month are covered
    $leaveStart = max($startDate, $r['start_date']);
    $leaveEnd   = min($endDate, $r['end_date']);

    $current = new DateTime($leaveStart);
    $end     = new DateTime($leaveEnd);

    while ($current <= $end) {
        $day = (int) $current->format('j');
        $employeeLeaves[$empId][$day] = [
            'leave_type'      => $r['leave_type_name'],
            'leave_type_code' => $r['leave_type_code'],
            'request_id'      => (int) $r['id'],
        ];
        $current->modify('+1 day');
    }
}

// Build response
$calendar = [];
foreach ($employees as $emp) {
    $empId = (int) $emp['id'];
    $calendar[] = [
        'employee_id'   => $empId,
        'employee_name' => $emp['name'],
        'employee_no'   => $emp['employee_no'],
        'days'          => $employeeLeaves[$empId] ?? [],
    ];
}

$daysInMonth = (int) date('t', strtotime($startDate));

jsonResponse([
    'calendar'      => $calendar,
    'month'         => $month,
    'year'          => $year,
    'days_in_month' => $daysInMonth,
]);
