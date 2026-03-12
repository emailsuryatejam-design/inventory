<?php
/**
 * WebSquare — Employee Self-Service API (P3)
 * Ported from KaziPay selfService.service.js + selfService.controller.js
 * Dashboard, profile, leave, loans, attendance, documents, field work
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
set_exception_handler(function($e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});

$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $GLOBALS['user_id'];
$userRole = $GLOBALS['user_role'] ?? '';

$action = $_GET['action'] ?? '';

// Resolve employee ID for current user
function getMyEmployee($pdo, $userId, $tenantId) {
    static $emp = null;
    if ($emp !== null) return $emp;
    $stmt = $pdo->prepare("SELECT * FROM hr_employees WHERE user_id = ? AND tenant_id = ?");
    $stmt->execute([$userId, $tenantId]);
    $emp = $stmt->fetch(PDO::FETCH_ASSOC);
    return $emp;
}

// Haversine distance (meters)
function haversine($lat1, $lon1, $lat2, $lon2) {
    $R = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat/2) * sin($dLat/2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2) * sin($dLon/2);
    $c = 2 * atan2(sqrt($a), sqrt(1-$a));
    return $R * $c;
}

switch ($action) {

// ── Dashboard ──
case 'dashboard':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');
    $empId = $emp['id'];

    // Latest payslip
    $stmt = $pdo->prepare("
        SELECT pi.net_pay, pp.name AS period_name, pp.pay_date, c.currency
        FROM payroll_items pi
        JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
        JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
        LEFT JOIN companies c ON c.tenant_id = pi.tenant_id AND c.is_primary = 1
        WHERE pi.employee_id = ? AND pi.tenant_id = ? AND pr.status IN ('approved','paid')
        ORDER BY pp.pay_date DESC LIMIT 1
    ");
    $stmt->execute([$empId, $tenantId]);
    $latestPay = $stmt->fetch(PDO::FETCH_ASSOC);

    // Leave balance
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(CASE WHEN lr.status='approved' THEN lr.days ELSE 0 END), 0) AS used_days
        FROM leave_requests lr
        WHERE lr.employee_id = ? AND lr.tenant_id = ? AND YEAR(lr.start_date) = YEAR(CURDATE())
    ");
    $stmt->execute([$empId, $tenantId]);
    $leaveUsed = $stmt->fetch(PDO::FETCH_ASSOC);
    $annualEntitlement = (float)($emp['annual_leave_days'] ?? 21);
    $leaveBalance = $annualEntitlement - (float)($leaveUsed['used_days'] ?? 0);

    // Active loans
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS active_loans,
               COALESCE(SUM(outstanding_balance), 0) AS total_outstanding
        FROM hr_loans
        WHERE employee_id = ? AND tenant_id = ? AND status = 'active'
    ");
    $stmt->execute([$empId, $tenantId]);
    $loans = $stmt->fetch(PDO::FETCH_ASSOC);

    // Pending requests
    $stmt = $pdo->prepare("
        SELECT
            (SELECT COUNT(*) FROM leave_requests WHERE employee_id = ? AND tenant_id = ? AND status = 'pending') +
            (SELECT COUNT(*) FROM hr_loans WHERE employee_id = ? AND tenant_id = ? AND status = 'pending') AS pending
    ");
    $stmt->execute([$empId, $tenantId, $empId, $tenantId]);
    $pending = $stmt->fetch(PDO::FETCH_ASSOC);

    // Recent payslips
    $stmt = $pdo->prepare("
        SELECT pi.id, pi.net_pay, pp.name AS period_name, pp.pay_date
        FROM payroll_items pi
        JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
        JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
        WHERE pi.employee_id = ? AND pi.tenant_id = ? AND pr.status IN ('approved','paid')
        ORDER BY pp.pay_date DESC LIMIT 3
    ");
    $stmt->execute([$empId, $tenantId]);
    $recentPayslips = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Upcoming leave
    $stmt = $pdo->prepare("
        SELECT lr.id, lr.start_date, lr.end_date, lr.days, lr.status, lt.name AS leave_type
        FROM leave_requests lr
        LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = ? AND lr.tenant_id = ? AND lr.start_date >= CURDATE() AND lr.status IN ('pending','approved')
        ORDER BY lr.start_date ASC LIMIT 3
    ");
    $stmt->execute([$empId, $tenantId]);
    $upcomingLeave = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Field work today
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS visits_today
        FROM field_visits
        WHERE employee_id = ? AND tenant_id = ? AND DATE(check_in_time) = CURDATE()
    ");
    $stmt->execute([$empId, $tenantId]);
    $fieldToday = $stmt->fetch(PDO::FETCH_ASSOC);

    jsonResponse([
        'employee' => [
            'id' => $empId,
            'name' => $emp['first_name'] . ' ' . $emp['last_name'],
            'employee_no' => $emp['employee_no'],
            'department' => $emp['department_id'] ?? null,
        ],
        'latest_pay' => $latestPay,
        'leave_balance' => round($leaveBalance, 1),
        'annual_entitlement' => $annualEntitlement,
        'active_loans' => (int)($loans['active_loans'] ?? 0),
        'total_outstanding' => (float)($loans['total_outstanding'] ?? 0),
        'pending_requests' => (int)($pending['pending'] ?? 0),
        'recent_payslips' => $recentPayslips,
        'upcoming_leave' => $upcomingLeave,
        'visits_today' => (int)($fieldToday['visits_today'] ?? 0),
        'currency' => $latestPay['currency'] ?? 'KES',
    ]);

// ── My Profile ──
case 'profile':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    // Get bank details
    $stmt = $pdo->prepare("SELECT * FROM bank_details WHERE employee_id = ? AND tenant_id = ? ORDER BY is_primary DESC");
    $stmt->execute([$emp['id'], $tenantId]);
    $banks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get department name
    $deptName = null;
    if ($emp['department_id']) {
        $stmt = $pdo->prepare("SELECT name FROM departments WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$emp['department_id'], $tenantId]);
        $dept = $stmt->fetch(PDO::FETCH_ASSOC);
        $deptName = $dept ? $dept['name'] : null;
    }

    jsonResponse([
        'profile' => [
            'id' => $emp['id'],
            'employee_no' => $emp['employee_no'],
            'first_name' => $emp['first_name'],
            'last_name' => $emp['last_name'],
            'email' => $emp['email'],
            'phone' => $emp['phone'] ?? '',
            'id_number' => $emp['id_number'] ?? '',
            'tax_pin' => $emp['tax_pin'] ?? '',
            'nssf_no' => $emp['nssf_no'] ?? '',
            'nhif_no' => $emp['nhif_no'] ?? '',
            'date_of_birth' => $emp['date_of_birth'] ?? '',
            'gender' => $emp['gender'] ?? '',
            'marital_status' => $emp['marital_status'] ?? '',
            'address' => $emp['address'] ?? '',
            'city' => $emp['city'] ?? '',
            'join_date' => $emp['join_date'] ?? '',
            'job_title' => $emp['job_title'] ?? '',
            'department' => $deptName,
            'photo_url' => $emp['photo_url'] ?? null,
        ],
        'bank_details' => $banks,
    ]);

// ── Update Profile (limited fields) ──
case 'update_profile':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $allowed = ['phone', 'address', 'city', 'emergency_contact', 'emergency_phone'];
    $sets = [];
    $vals = [];
    foreach ($allowed as $field) {
        if (isset($input[$field])) {
            $sets[] = "$field = ?";
            $vals[] = $input[$field];
        }
    }
    if (empty($sets)) jsonError('No updatable fields provided');

    $vals[] = $emp['id'];
    $vals[] = $tenantId;
    $pdo->prepare("UPDATE hr_employees SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")->execute($vals);
    jsonResponse(['message' => 'Profile updated']);

// ── Save Bank Details ──
case 'save_bank':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $bankId = intval($input['id'] ?? 0);

    $fields = [
        'bank_name'      => $input['bank_name'] ?? '',
        'bank_code'      => $input['bank_code'] ?? '',
        'branch_name'    => $input['branch_name'] ?? '',
        'branch_code'    => $input['branch_code'] ?? '',
        'account_number' => $input['account_number'] ?? '',
        'account_name'   => $input['account_name'] ?? '',
        'is_primary'     => intval($input['is_primary'] ?? 1),
    ];

    if ($bankId > 0) {
        $sets = [];
        $vals = [];
        foreach ($fields as $k => $v) {
            $sets[] = "$k = ?";
            $vals[] = $v;
        }
        $vals[] = $bankId;
        $vals[] = $emp['id'];
        $vals[] = $tenantId;
        $pdo->prepare("UPDATE bank_details SET " . implode(', ', $sets) . " WHERE id = ? AND employee_id = ? AND tenant_id = ?")->execute($vals);
    } else {
        $cols = array_keys($fields);
        $cols[] = 'employee_id';
        $cols[] = 'tenant_id';
        $vals = array_values($fields);
        $vals[] = $emp['id'];
        $vals[] = $tenantId;
        $placeholders = implode(',', array_fill(0, count($vals), '?'));
        $pdo->prepare("INSERT INTO bank_details (" . implode(',', $cols) . ") VALUES ($placeholders)")->execute($vals);
        $bankId = $pdo->lastInsertId();
    }

    // If primary, reset others
    if ($fields['is_primary']) {
        $pdo->prepare("UPDATE bank_details SET is_primary = 0 WHERE employee_id = ? AND tenant_id = ? AND id != ?")->execute([$emp['id'], $tenantId, $bankId]);
    }

    jsonResponse(['id' => $bankId, 'message' => 'Bank details saved']);

// ── Leave Balance ──
case 'leave_balance':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $year = intval($_GET['year'] ?? date('Y'));
    $stmt = $pdo->prepare("
        SELECT lt.id, lt.name, lt.days_per_year,
            COALESCE(SUM(CASE WHEN lr.status = 'approved' THEN lr.days ELSE 0 END), 0) AS used_days,
            COALESCE(SUM(CASE WHEN lr.status = 'pending' THEN lr.days ELSE 0 END), 0) AS pending_days
        FROM leave_types lt
        LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id
            AND lr.employee_id = ? AND lr.tenant_id = ? AND YEAR(lr.start_date) = ?
        WHERE lt.tenant_id = ? AND lt.is_active = 1
        GROUP BY lt.id, lt.name, lt.days_per_year
        ORDER BY lt.name
    ");
    $stmt->execute([$emp['id'], $tenantId, $year, $tenantId]);
    $balances = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($balances as &$b) {
        $b['remaining'] = (float)$b['days_per_year'] - (float)$b['used_days'];
    }

    jsonResponse(['balances' => $balances, 'year' => $year]);

// ── My Leave Requests ──
case 'my_leave':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $year = intval($_GET['year'] ?? date('Y'));
    $stmt = $pdo->prepare("
        SELECT lr.*, lt.name AS leave_type
        FROM leave_requests lr
        LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = ? AND lr.tenant_id = ? AND YEAR(lr.start_date) = ?
        ORDER BY lr.created_at DESC
    ");
    $stmt->execute([$emp['id'], $tenantId, $year]);
    jsonResponse(['requests' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ── Request Leave ──
case 'request_leave':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $typeId = intval($input['leave_type_id'] ?? 0);
    $startDate = $input['start_date'] ?? '';
    $endDate = $input['end_date'] ?? '';
    $reason = $input['reason'] ?? '';
    $days = floatval($input['days'] ?? 0);

    if (!$typeId || !$startDate || !$endDate || $days <= 0) {
        jsonError('Leave type, dates, and days are required');
    }

    $pdo->prepare("
        INSERT INTO leave_requests (employee_id, tenant_id, leave_type_id, start_date, end_date, days, reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    ")->execute([$emp['id'], $tenantId, $typeId, $startDate, $endDate, $days, $reason]);

    jsonResponse(['id' => $pdo->lastInsertId(), 'message' => 'Leave request submitted']);

// ── Cancel Leave Request ──
case 'cancel_leave':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $stmt = $pdo->prepare("UPDATE leave_requests SET status = 'cancelled' WHERE id = ? AND employee_id = ? AND tenant_id = ? AND status = 'pending'");
    $stmt->execute([$id, $emp['id'], $tenantId]);
    if ($stmt->rowCount() === 0) jsonError('Cannot cancel — leave request not found or not pending');
    jsonResponse(['message' => 'Leave request cancelled']);

// ── My Loans ──
case 'my_loans':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $stmt = $pdo->prepare("
        SELECT * FROM hr_loans
        WHERE employee_id = ? AND tenant_id = ?
        ORDER BY created_at DESC
    ");
    $stmt->execute([$emp['id'], $tenantId]);
    $loans = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get repayments for active loans
    $activeIds = array_column(array_filter($loans, fn($l) => $l['status'] === 'active'), 'id');
    $repayments = [];
    if (!empty($activeIds)) {
        $placeholders = implode(',', array_fill(0, count($activeIds), '?'));
        $stmt = $pdo->prepare("SELECT * FROM loan_repayments WHERE loan_id IN ($placeholders) AND tenant_id = ? ORDER BY repayment_date DESC");
        $stmt->execute([...$activeIds, $tenantId]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $repayments[$r['loan_id']][] = $r;
        }
    }

    jsonResponse(['loans' => $loans, 'repayments' => $repayments]);

// ── Request Loan ──
case 'request_loan':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $loanType = $input['loan_type'] ?? 'personal';
    $amount = floatval($input['amount'] ?? 0);
    $months = intval($input['repayment_months'] ?? 12);
    $reason = $input['reason'] ?? '';

    if ($amount <= 0 || $months <= 0) jsonError('Valid amount and repayment months required');

    $monthlyDeduction = round($amount / $months, 2);

    $pdo->prepare("
        INSERT INTO hr_loans (employee_id, tenant_id, loan_type, amount, repayment_months, monthly_deduction, outstanding_balance, reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    ")->execute([$emp['id'], $tenantId, $loanType, $amount, $months, $monthlyDeduction, $amount, $reason]);

    jsonResponse(['id' => $pdo->lastInsertId(), 'message' => 'Loan request submitted']);

// ── My Attendance ──
case 'my_attendance':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $month = $_GET['month'] ?? date('Y-m');
    $stmt = $pdo->prepare("
        SELECT * FROM attendance
        WHERE employee_id = ? AND tenant_id = ? AND DATE_FORMAT(date, '%Y-%m') = ?
        ORDER BY date ASC
    ");
    $stmt->execute([$emp['id'], $tenantId, $month]);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Summary
    $present = 0; $absent = 0; $late = 0; $totalHours = 0; $overtime = 0;
    foreach ($records as $r) {
        if ($r['status'] === 'present') $present++;
        elseif ($r['status'] === 'absent') $absent++;
        if (!empty($r['is_late'])) $late++;
        $totalHours += (float)($r['hours_worked'] ?? 0);
        $overtime += (float)($r['overtime_hours'] ?? 0);
    }

    jsonResponse([
        'records' => $records,
        'summary' => [
            'present' => $present,
            'absent'  => $absent,
            'late'    => $late,
            'total_hours' => round($totalHours, 1),
            'overtime'    => round($overtime, 1),
        ],
        'month' => $month,
    ]);

// ── Check In (GPS-based) ──
case 'check_in':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $lat = floatval($input['latitude'] ?? 0);
    $lon = floatval($input['longitude'] ?? 0);
    $today = date('Y-m-d');

    // Check if already checked in today
    $stmt = $pdo->prepare("SELECT id FROM attendance WHERE employee_id = ? AND tenant_id = ? AND date = ?");
    $stmt->execute([$emp['id'], $tenantId, $today]);
    if ($stmt->fetch()) jsonError('Already checked in today');

    // Geofence check (if site coordinates set)
    $geoNote = '';
    if (!empty($emp['site_lat']) && !empty($emp['site_lon'])) {
        $dist = haversine($lat, $lon, (float)$emp['site_lat'], (float)$emp['site_lon']);
        $maxDist = floatval($emp['geofence_radius'] ?? 500);
        if ($dist > $maxDist) {
            $geoNote = 'Outside geofence (' . round($dist) . 'm)';
        }
    }

    $now = date('H:i:s');
    $isLate = ($now > '09:00:00') ? 1 : 0;

    $pdo->prepare("
        INSERT INTO attendance (employee_id, tenant_id, date, check_in, status, is_late, latitude, longitude, notes, created_at)
        VALUES (?, ?, ?, ?, 'present', ?, ?, ?, ?, NOW())
    ")->execute([$emp['id'], $tenantId, $today, $now, $isLate, $lat, $lon, $geoNote]);

    jsonResponse(['message' => 'Checked in at ' . $now, 'is_late' => (bool)$isLate, 'geo_note' => $geoNote]);

// ── Check Out ──
case 'check_out':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $today = date('Y-m-d');

    $stmt = $pdo->prepare("SELECT id, check_in FROM attendance WHERE employee_id = ? AND tenant_id = ? AND date = ?");
    $stmt->execute([$emp['id'], $tenantId, $today]);
    $att = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$att) jsonError('No check-in found for today');

    $now = date('H:i:s');
    $checkIn = strtotime($att['check_in']);
    $checkOut = strtotime($now);
    $hoursWorked = round(($checkOut - $checkIn) / 3600, 2);
    $overtime = max(0, $hoursWorked - 8);

    $pdo->prepare("UPDATE attendance SET check_out = ?, hours_worked = ?, overtime_hours = ? WHERE id = ? AND tenant_id = ?")
        ->execute([$now, $hoursWorked, $overtime, $att['id'], $tenantId]);

    jsonResponse(['message' => 'Checked out at ' . $now, 'hours_worked' => $hoursWorked, 'overtime' => $overtime]);

// ── My Allowances ──
case 'my_allowances':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $stmt = $pdo->prepare("
        SELECT ea.*, at.name AS allowance_name, at.is_taxable
        FROM employee_allowances ea
        JOIN allowance_types at ON ea.allowance_type_id = at.id
        WHERE ea.employee_id = ? AND ea.tenant_id = ? AND ea.is_active = 1
        ORDER BY at.name
    ");
    $stmt->execute([$emp['id'], $tenantId]);
    $allowances = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $total = array_sum(array_column($allowances, 'amount'));
    jsonResponse(['allowances' => $allowances, 'total_monthly' => round($total, 2)]);

// ── My Documents (contracts, letters) ──
case 'my_documents':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $type = $_GET['type'] ?? '';
    $where = "WHERE ed.employee_id = ? AND ed.tenant_id = ?";
    $params = [$emp['id'], $tenantId];
    if ($type) {
        $where .= " AND ed.document_type = ?";
        $params[] = $type;
    }

    $stmt = $pdo->prepare("
        SELECT ed.id, ed.document_type, ed.title, ed.file_url, ed.created_at
        FROM employee_documents ed
        $where
        ORDER BY ed.created_at DESC
    ");
    $stmt->execute($params);
    jsonResponse(['documents' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ── Field Work — Start Visit ──
case 'start_visit':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $lat = floatval($input['latitude'] ?? 0);
    $lon = floatval($input['longitude'] ?? 0);
    $clientName = $input['client_name'] ?? '';
    $purpose = $input['purpose'] ?? '';

    $pdo->prepare("
        INSERT INTO field_visits (employee_id, tenant_id, client_name, purpose, check_in_time, check_in_lat, check_in_lon, status, created_at)
        VALUES (?, ?, ?, ?, NOW(), ?, ?, 'in_progress', NOW())
    ")->execute([$emp['id'], $tenantId, $clientName, $purpose, $lat, $lon]);

    jsonResponse(['id' => $pdo->lastInsertId(), 'message' => 'Visit started']);

// ── Field Work — End Visit ──
case 'end_visit':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $input = json_decode(file_get_contents('php://input'), true);
    $visitId = intval($input['visit_id'] ?? 0);
    $lat = floatval($input['latitude'] ?? 0);
    $lon = floatval($input['longitude'] ?? 0);
    $notes = $input['notes'] ?? '';
    $outcome = $input['outcome'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM field_visits WHERE id = ? AND employee_id = ? AND tenant_id = ? AND status = 'in_progress'");
    $stmt->execute([$visitId, $emp['id'], $tenantId]);
    $visit = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$visit) jsonError('Active visit not found');

    // Calculate distance from check-in to check-out
    $distance = haversine((float)$visit['check_in_lat'], (float)$visit['check_in_lon'], $lat, $lon);

    $pdo->prepare("
        UPDATE field_visits
        SET check_out_time = NOW(), check_out_lat = ?, check_out_lon = ?,
            distance_km = ?, notes = ?, outcome = ?, status = 'completed'
        WHERE id = ? AND tenant_id = ?
    ")->execute([$lat, $lon, round($distance / 1000, 2), $notes, $outcome, $visitId, $tenantId]);

    jsonResponse(['message' => 'Visit completed', 'distance_km' => round($distance / 1000, 2)]);

// ── Field Work — My Visits ──
case 'my_visits':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    $month = $_GET['month'] ?? date('Y-m');
    $stmt = $pdo->prepare("
        SELECT * FROM field_visits
        WHERE employee_id = ? AND tenant_id = ? AND DATE_FORMAT(check_in_time, '%Y-%m') = ?
        ORDER BY check_in_time DESC
    ");
    $stmt->execute([$emp['id'], $tenantId, $month]);
    $visits = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Summary
    $totalDistance = 0;
    $completedVisits = 0;
    $fieldDays = [];
    foreach ($visits as $v) {
        if ($v['status'] === 'completed') {
            $completedVisits++;
            $totalDistance += (float)($v['distance_km'] ?? 0);
        }
        $day = substr($v['check_in_time'], 0, 10);
        $fieldDays[$day] = true;
    }

    jsonResponse([
        'visits' => $visits,
        'summary' => [
            'total_visits' => count($visits),
            'completed' => $completedVisits,
            'total_distance_km' => round($totalDistance, 1),
            'field_days' => count($fieldDays),
        ],
        'month' => $month,
    ]);

// ── ID Card Data ──
case 'my_id_card':
    $emp = getMyEmployee($pdo, $userId, $tenantId);
    if (!$emp) jsonError('Employee record not found');

    // Get company info
    $stmt = $pdo->prepare("SELECT name, address, city, phone, email, logo_url FROM companies WHERE tenant_id = ? AND is_primary = 1");
    $stmt->execute([$tenantId]);
    $company = $stmt->fetch(PDO::FETCH_ASSOC);

    // Get department
    $deptName = '';
    if ($emp['department_id']) {
        $stmt = $pdo->prepare("SELECT name FROM departments WHERE id = ?");
        $stmt->execute([$emp['department_id']]);
        $dept = $stmt->fetch(PDO::FETCH_ASSOC);
        $deptName = $dept ? $dept['name'] : '';
    }

    jsonResponse([
        'employee' => [
            'name' => $emp['first_name'] . ' ' . $emp['last_name'],
            'employee_no' => $emp['employee_no'],
            'job_title' => $emp['job_title'] ?? '',
            'department' => $deptName,
            'id_number' => $emp['id_number'] ?? '',
            'photo_url' => $emp['photo_url'] ?? null,
            'join_date' => $emp['join_date'] ?? '',
        ],
        'company' => $company,
    ]);

// ── Change Password ──
case 'change_password':
    $input = json_decode(file_get_contents('php://input'), true);
    $currentPassword = $input['current_password'] ?? '';
    $newPassword = $input['new_password'] ?? '';

    if (strlen($newPassword) < 6) jsonError('New password must be at least 6 characters');

    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$userId, $tenantId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) jsonError('User not found');

    if (!password_verify($currentPassword, $user['password_hash'])) {
        jsonError('Current password is incorrect');
    }

    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ? AND tenant_id = ?")->execute([$hash, $userId, $tenantId]);
    jsonResponse(['message' => 'Password changed successfully']);

default:
    jsonError('Invalid action. Use: dashboard, profile, update_profile, save_bank, leave_balance, my_leave, request_leave, cancel_leave, my_loans, request_loan, my_attendance, check_in, check_out, my_allowances, my_documents, start_visit, end_visit, my_visits, my_id_card, change_password');
}
