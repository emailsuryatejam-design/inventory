<?php
/**
 * WebSquare — Attendance
 * GET  /api/attendance.php?date=YYYY-MM-DD   — daily attendance for all employees
 * GET  /api/attendance.php?month=YYYY-MM     — monthly attendance grid
 * POST /api/attendance.php                    — create single or bulk attendance
 * PUT  /api/attendance.php                    — update attendance record
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // ── Daily view ──
    if (!empty($_GET['date'])) {
        $date = $_GET['date'];

        // Get all active employees with their attendance for this date
        $stmt = $pdo->prepare("
            SELECT e.id AS employee_id,
                   CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                   e.employee_no,
                   a.id AS attendance_id, a.clock_in, a.clock_out,
                   a.hours_worked, a.overtime, a.status, a.notes, a.leave_type_id,
                   lt.name AS leave_type_name
            FROM hr_employees e
            LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ? AND a.tenant_id = ?
            LEFT JOIN leave_types lt ON a.leave_type_id = lt.id
            WHERE e.tenant_id = ? AND e.status = 'active'
            ORDER BY e.first_name, e.last_name
        ");
        $stmt->execute([$date, $tenantId, $tenantId]);
        $rows = $stmt->fetchAll();

        jsonResponse([
            'date'       => $date,
            'attendance' => array_map(function ($r) {
                return [
                    'employee_id'     => (int) $r['employee_id'],
                    'employee_name'   => $r['employee_name'],
                    'employee_no'     => $r['employee_no'],
                    'attendance_id'   => $r['attendance_id'] ? (int) $r['attendance_id'] : null,
                    'clock_in'        => $r['clock_in'],
                    'clock_out'       => $r['clock_out'],
                    'hours_worked'    => $r['hours_worked'] !== null ? (float) $r['hours_worked'] : null,
                    'overtime'        => $r['overtime'] !== null ? (float) $r['overtime'] : null,
                    'status'          => $r['status'] ?? 'absent',
                    'notes'           => $r['notes'],
                    'leave_type_id'   => $r['leave_type_id'] ? (int) $r['leave_type_id'] : null,
                    'leave_type_name' => $r['leave_type_name'],
                ];
            }, $rows),
        ]);
        exit;
    }

    // ── Monthly view ──
    if (!empty($_GET['month'])) {
        $month = $_GET['month']; // YYYY-MM
        $startDate = $month . '-01';
        $endDate   = date('Y-m-t', strtotime($startDate));
        $daysInMonth = (int) date('t', strtotime($startDate));

        // Get all active employees
        $empStmt = $pdo->prepare("
            SELECT id, employee_no, CONCAT(first_name, ' ', last_name) AS name
            FROM hr_employees
            WHERE tenant_id = ? AND status = 'active'
            ORDER BY first_name, last_name
        ");
        $empStmt->execute([$tenantId]);
        $employees = $empStmt->fetchAll();

        // Get all attendance records for the month
        $attStmt = $pdo->prepare("
            SELECT employee_id, DAY(date) AS day_num, status
            FROM attendance
            WHERE tenant_id = ? AND date BETWEEN ? AND ?
        ");
        $attStmt->execute([$tenantId, $startDate, $endDate]);
        $attRows = $attStmt->fetchAll();

        // Build lookup: employee_id => [day => status]
        $attMap = [];
        foreach ($attRows as $row) {
            $empId = (int) $row['employee_id'];
            $day   = (int) $row['day_num'];
            $attMap[$empId][$day] = $row['status'];
        }

        $grid = [];
        foreach ($employees as $emp) {
            $empId = (int) $emp['id'];
            $days = [];
            for ($d = 1; $d <= $daysInMonth; $d++) {
                $days[$d] = $attMap[$empId][$d] ?? null;
            }
            $grid[] = [
                'employee_id'   => $empId,
                'employee_name' => $emp['name'],
                'employee_no'   => $emp['employee_no'],
                'days'          => $days,
            ];
        }

        jsonResponse([
            'month'         => $month,
            'days_in_month' => $daysInMonth,
            'grid'          => $grid,
        ]);
        exit;
    }

    jsonError('Provide either "date" or "month" query parameter', 400);
}

// ── POST — Create attendance (single or bulk) ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();

    // ── Bulk mode ──
    if (!empty($input['bulk']) && !empty($input['entries'])) {
        $entries = $input['entries'];
        $created = 0;
        $updated = 0;

        $checkStmt = $pdo->prepare("
            SELECT id FROM attendance WHERE employee_id = ? AND date = ? AND tenant_id = ?
        ");
        $insertStmt = $pdo->prepare("
            INSERT INTO attendance (tenant_id, employee_id, date, clock_in, clock_out, hours_worked, overtime, status, leave_type_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $updateStmt = $pdo->prepare("
            UPDATE attendance SET clock_in = ?, clock_out = ?, hours_worked = ?, overtime = ?, status = ?, leave_type_id = ?, notes = ?
            WHERE id = ? AND tenant_id = ?
        ");

        $pdo->beginTransaction();
        try {
            foreach ($entries as $entry) {
                if (empty($entry['employee_id']) || empty($entry['date'])) continue;

                $checkStmt->execute([(int) $entry['employee_id'], $entry['date'], $tenantId]);
                $existing = $checkStmt->fetch();

                $status   = $entry['status'] ?? 'present';
                $clockIn  = $entry['clock_in'] ?? null;
                $clockOut = $entry['clock_out'] ?? null;
                $hours    = isset($entry['hours_worked']) ? (float) $entry['hours_worked'] : null;
                $overtime = isset($entry['overtime']) ? (float) $entry['overtime'] : null;
                $leaveTypeId = !empty($entry['leave_type_id']) ? (int) $entry['leave_type_id'] : null;
                $notes    = $entry['notes'] ?? null;

                if ($existing) {
                    $updateStmt->execute([
                        $clockIn, $clockOut, $hours, $overtime, $status, $leaveTypeId, $notes,
                        (int) $existing['id'], $tenantId,
                    ]);
                    $updated++;
                } else {
                    $insertStmt->execute([
                        $tenantId, (int) $entry['employee_id'], $entry['date'],
                        $clockIn, $clockOut, $hours, $overtime, $status, $leaveTypeId, $notes,
                    ]);
                    $created++;
                }
            }
            $pdo->commit();

            jsonResponse([
                'success' => true,
                'created' => $created,
                'updated' => $updated,
                'message' => "Bulk attendance saved: {$created} created, {$updated} updated",
            ], 201);
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] attendance bulk POST: ' . $e->getMessage());
            jsonError('An unexpected error occurred. Please try again.', 500);
        }
        exit;
    }

    // ── Single mode ──
    requireFields($input, ['employee_id', 'date', 'status']);

    $employeeId = (int) $input['employee_id'];
    $date       = $input['date'];
    $status     = $input['status'];

    // Verify employee belongs to tenant
    $empCheck = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $empCheck->execute([$employeeId, $tenantId]);
    if (!$empCheck->fetch()) {
        jsonError('Employee not found', 404);
    }

    // Check if record already exists for this employee + date
    $existing = $pdo->prepare("SELECT id FROM attendance WHERE employee_id = ? AND date = ? AND tenant_id = ?");
    $existing->execute([$employeeId, $date, $tenantId]);
    $existingRow = $existing->fetch();

    if ($existingRow) {
        // Update existing
        $pdo->prepare("
            UPDATE attendance SET clock_in = ?, clock_out = ?, hours_worked = ?, overtime = ?, status = ?, leave_type_id = ?, notes = ?
            WHERE id = ? AND tenant_id = ?
        ")->execute([
            $input['clock_in'] ?? null,
            $input['clock_out'] ?? null,
            isset($input['hours_worked']) ? (float) $input['hours_worked'] : null,
            isset($input['overtime']) ? (float) $input['overtime'] : null,
            $status,
            !empty($input['leave_type_id']) ? (int) $input['leave_type_id'] : null,
            $input['notes'] ?? null,
            (int) $existingRow['id'], $tenantId,
        ]);

        jsonResponse(['success' => true, 'id' => (int) $existingRow['id'], 'message' => 'Attendance updated']);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO attendance (tenant_id, employee_id, date, clock_in, clock_out, hours_worked, overtime, status, leave_type_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId, $employeeId, $date,
            $input['clock_in'] ?? null,
            $input['clock_out'] ?? null,
            isset($input['hours_worked']) ? (float) $input['hours_worked'] : null,
            isset($input['overtime']) ? (float) $input['overtime'] : null,
            $status,
            !empty($input['leave_type_id']) ? (int) $input['leave_type_id'] : null,
            $input['notes'] ?? null,
        ]);

        jsonResponse(['success' => true, 'id' => (int) $pdo->lastInsertId(), 'message' => 'Attendance recorded'], 201);
    }
    exit;
}

// ── PUT — Update attendance record ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['id']);

    $id = (int) $input['id'];

    // Verify record belongs to tenant
    $check = $pdo->prepare("SELECT id FROM attendance WHERE id = ? AND tenant_id = ?");
    $check->execute([$id, $tenantId]);
    if (!$check->fetch()) {
        jsonError('Attendance record not found', 404);
    }

    $fields = [];
    $params = [];
    $allowed = ['clock_in', 'clock_out', 'hours_worked', 'overtime', 'status', 'leave_type_id', 'notes'];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $input)) {
            $fields[] = "{$field} = ?";
            $params[] = $input[$field];
        }
    }

    if (empty($fields)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $id;
    $params[] = $tenantId;

    $pdo->prepare("
        UPDATE attendance SET " . implode(', ', $fields) . "
        WHERE id = ? AND tenant_id = ?
    ")->execute($params);

    jsonResponse(['success' => true, 'message' => 'Attendance updated']);
    exit;
}

jsonError('Method not allowed', 405);
