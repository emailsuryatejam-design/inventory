<?php
/**
 * WebSquare — Payroll Runs
 * GET    /api/payroll-runs.php              — list runs (with period name)
 * GET    /api/payroll-runs.php?id=X         — single run detail
 * POST   /api/payroll-runs.php              — create run (calculate payroll)
 * PUT    /api/payroll-runs.php              — action: approve, mark_paid, cancel
 * DELETE /api/payroll-runs.php?id=X         — delete draft run
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── Kenya Tax Calculation Functions ──

/**
 * NSSF Employee contribution: 6% of gross, capped at KES 2,160
 */
function calcNSSF($gross) {
    return min($gross * 0.06, 2160);
}

/**
 * NHIF contribution based on gross pay brackets
 */
function calcNHIF($gross) {
    if ($gross <= 5999)  return 150;
    if ($gross <= 7999)  return 300;
    if ($gross <= 11999) return 400;
    if ($gross <= 14999) return 500;
    if ($gross <= 19999) return 600;
    if ($gross <= 24999) return 750;
    if ($gross <= 29999) return 850;
    if ($gross <= 34999) return 900;
    if ($gross <= 39999) return 950;
    if ($gross <= 44999) return 1000;
    if ($gross <= 49999) return 1100;
    if ($gross <= 59999) return 1200;
    if ($gross <= 69999) return 1300;
    if ($gross <= 79999) return 1400;
    if ($gross <= 89999) return 1500;
    if ($gross <= 99999) return 1600;
    return 1700;
}

/**
 * Housing Levy: 1.5% of gross
 */
function calcHousingLevy($gross) {
    return round($gross * 0.015, 2);
}

/**
 * PAYE using Kenya tax bands on taxable income (gross - nssf_employee)
 * Band 1: First 24,000 at 10%
 * Band 2: Next 8,333 at 25%
 * Band 3: Remainder at 30%
 * Then subtract personal relief of 2,400
 */
function calcPAYE($gross, $nssfEmployee) {
    $taxableIncome = $gross - $nssfEmployee;
    if ($taxableIncome <= 0) return 0;

    $tax = 0;

    // Band 1: First 24,000 at 10%
    if ($taxableIncome <= 24000) {
        $tax = $taxableIncome * 0.10;
    }
    // Band 2: Next 8,333 (24,001 - 32,333) at 25%
    elseif ($taxableIncome <= 32333) {
        $tax = 24000 * 0.10;
        $tax += ($taxableIncome - 24000) * 0.25;
    }
    // Band 3: Remainder above 32,333 at 30%
    else {
        $tax = 24000 * 0.10;
        $tax += 8333 * 0.25;
        $tax += ($taxableIncome - 32333) * 0.30;
    }

    // Subtract personal relief
    $tax -= 2400;

    return max(0, round($tax, 2));
}


// ── GET — List or Detail ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // ── Single run detail ──
    if (!empty($_GET['id'])) {
        $runId = (int) $_GET['id'];

        $stmt = $pdo->prepare("
            SELECT pr.id, pr.period_id, pr.status, pr.employee_count,
                   pr.total_gross, pr.total_net, pr.total_deductions, pr.total_employer_cost,
                   pr.created_by, pr.created_at, pr.approved_by, pr.approved_at,
                   pp.name AS period_name, pp.start_date AS period_start,
                   pp.end_date AS period_end, pp.pay_date AS period_pay_date
            FROM payroll_runs pr
            JOIN payroll_periods pp ON pr.period_id = pp.id
            WHERE pr.id = ? AND pr.tenant_id = ?
        ");
        $stmt->execute([$runId, $tenantId]);
        $run = $stmt->fetch();

        if (!$run) {
            jsonError('Payroll run not found', 404);
        }

        jsonResponse([
            'run' => [
                'id'                 => (int) $run['id'],
                'period_id'          => (int) $run['period_id'],
                'period_name'        => $run['period_name'],
                'period_start'       => $run['period_start'],
                'period_end'         => $run['period_end'],
                'period_pay_date'    => $run['period_pay_date'],
                'status'             => $run['status'],
                'employee_count'     => (int) $run['employee_count'],
                'total_gross'        => (float) $run['total_gross'],
                'total_net'          => (float) $run['total_net'],
                'total_deductions'   => (float) $run['total_deductions'],
                'total_employer_cost'=> (float) $run['total_employer_cost'],
                'created_by'         => (int) $run['created_by'],
                'created_at'         => $run['created_at'],
                'approved_by'        => $run['approved_by'] ? (int) $run['approved_by'] : null,
                'approved_at'        => $run['approved_at'],
            ],
        ]);
        exit;
    }

    // ── List all runs ──
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $status  = $_GET['status'] ?? '';

    $where  = [];
    $params = [];
    tenantScope($where, $params, $tenantId, 'pr');

    if ($status) {
        $where[] = 'pr.status = ?';
        $params[] = $status;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM payroll_runs pr
        {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $dataParams = $params;
    $dataParams[] = $perPage;
    $dataParams[] = $offset;

    $stmt = $pdo->prepare("
        SELECT pr.id, pr.period_id, pr.status, pr.employee_count,
               pr.total_gross, pr.total_net, pr.total_deductions, pr.total_employer_cost,
               pr.created_at,
               pp.name AS period_name
        FROM payroll_runs pr
        JOIN payroll_periods pp ON pr.period_id = pp.id
        {$whereClause}
        ORDER BY pr.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($dataParams);
    $runs = $stmt->fetchAll();

    jsonResponse([
        'runs' => array_map(function ($r) {
            return [
                'id'                 => (int) $r['id'],
                'period_id'          => (int) $r['period_id'],
                'period_name'        => $r['period_name'],
                'status'             => $r['status'],
                'employee_count'     => (int) $r['employee_count'],
                'total_gross'        => (float) $r['total_gross'],
                'total_net'          => (float) $r['total_net'],
                'total_deductions'   => (float) $r['total_deductions'],
                'total_employer_cost'=> (float) $r['total_employer_cost'],
                'created_at'         => $r['created_at'],
            ];
        }, $runs),
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create Payroll Run (Calculate) ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = requireManager();
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    requireFields($input, ['period_id']);

    $periodId = (int) $input['period_id'];

    // Verify period exists, is open, and belongs to tenant
    $pStmt = $pdo->prepare("
        SELECT id, name, status FROM payroll_periods
        WHERE id = ? AND tenant_id = ?
    ");
    $pStmt->execute([$periodId, $tenantId]);
    $period = $pStmt->fetch();

    if (!$period) {
        jsonError('Payroll period not found', 404);
    }
    if ($period['status'] !== 'open') {
        jsonError('Payroll period is not open. Current status: ' . $period['status'], 400);
    }

    // Get all active employees for this tenant
    $empStmt = $pdo->prepare("
        SELECT id, employee_no, first_name, last_name, basic_salary
        FROM hr_employees
        WHERE tenant_id = ? AND employment_status = 'active'
        ORDER BY last_name, first_name
    ");
    $empStmt->execute([$tenantId]);
    $employees = $empStmt->fetchAll();

    if (count($employees) === 0) {
        jsonError('No active employees found for this tenant', 400);
    }

    // Batch-fetch all active allowances for these employees
    $empIds = array_column($employees, 'id');
    $empIdPlaceholders = implode(',', array_fill(0, count($empIds), '?'));

    $allowStmt = $pdo->prepare("
        SELECT ea.employee_id, SUM(ea.amount) AS total_allowances
        FROM employee_allowances ea
        WHERE ea.tenant_id = ?
          AND ea.employee_id IN ({$empIdPlaceholders})
          AND ea.is_active = 1
        GROUP BY ea.employee_id
    ");
    $allowStmt->execute(array_merge([$tenantId], $empIds));
    $allowanceMap = [];
    foreach ($allowStmt->fetchAll() as $row) {
        $allowanceMap[(int) $row['employee_id']] = (float) $row['total_allowances'];
    }

    // Batch-fetch active loan deductions
    $loanStmt = $pdo->prepare("
        SELECT employee_id, SUM(monthly_deduction) AS total_loan_deduction
        FROM hr_loans
        WHERE tenant_id = ?
          AND employee_id IN ({$empIdPlaceholders})
          AND status IN ('active', 'approved')
          AND outstanding_balance > 0
        GROUP BY employee_id
    ");
    $loanStmt->execute(array_merge([$tenantId], $empIds));
    $loanMap = [];
    foreach ($loanStmt->fetchAll() as $row) {
        $loanMap[(int) $row['employee_id']] = (float) $row['total_loan_deduction'];
    }

    // Batch-fetch approved salary advances
    $advStmt = $pdo->prepare("
        SELECT employee_id, SUM(amount) AS total_advance
        FROM hr_salary_advances
        WHERE tenant_id = ?
          AND employee_id IN ({$empIdPlaceholders})
          AND status = 'approved'
        GROUP BY employee_id
    ");
    $advStmt->execute(array_merge([$tenantId], $empIds));
    $advanceMap = [];
    foreach ($advStmt->fetchAll() as $row) {
        $advanceMap[(int) $row['employee_id']] = (float) $row['total_advance'];
    }

    // ── Calculate payroll for each employee ──
    $pdo->beginTransaction();
    try {
        // Insert payroll_run header
        $pdo->prepare("
            INSERT INTO payroll_runs (
                tenant_id, period_id, status, employee_count,
                total_gross, total_net, total_deductions, total_employer_cost,
                created_by, created_at
            ) VALUES (?, ?, 'draft', 0, 0, 0, 0, 0, ?, NOW())
        ")->execute([$tenantId, $periodId, $user['user_id']]);

        $runId = (int) $pdo->lastInsertId();

        $totalGross = 0;
        $totalNet = 0;
        $totalDeductions = 0;
        $totalEmployerCost = 0;

        $itemStmt = $pdo->prepare("
            INSERT INTO payroll_items (
                tenant_id, payroll_run_id, employee_id,
                basic_salary, total_allowances, gross_pay,
                nssf_employee, nssf_employer, paye, nhif, housing_levy,
                loan_deductions, advance_deductions, other_deductions,
                total_deductions, net_pay, total_employer_cost,
                overtime_hours, overtime_pay, absent_days, absent_deduction
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        foreach ($employees as $emp) {
            $empId = (int) $emp['id'];
            $basicSalary = (float) $emp['basic_salary'];
            $allowances = $allowanceMap[$empId] ?? 0;
            $grossPay = $basicSalary + $allowances;

            // Statutory deductions
            $nssfEmployee = calcNSSF($grossPay);
            $nssfEmployer = calcNSSF($grossPay);
            $nhif = calcNHIF($grossPay);
            $housingLevy = calcHousingLevy($grossPay);
            $paye = calcPAYE($grossPay, $nssfEmployee);

            // Loan & advance deductions
            $loanDeduction = $loanMap[$empId] ?? 0;
            $advanceDeduction = $advanceMap[$empId] ?? 0;
            $otherDeductions = 0;

            $employeeDeductions = $nssfEmployee + $paye + $nhif + $housingLevy + $loanDeduction + $advanceDeduction + $otherDeductions;
            $netPay = $grossPay - $employeeDeductions;
            $employerCost = $grossPay + $nssfEmployer;

            // Overtime and absence — default to 0 (can be enhanced later)
            $overtimeHours = 0;
            $overtimePay = 0;
            $absentDays = 0;
            $absentDeduction = 0;

            $itemStmt->execute([
                $tenantId, $runId, $empId,
                round($basicSalary, 2),
                round($allowances, 2),
                round($grossPay, 2),
                round($nssfEmployee, 2),
                round($nssfEmployer, 2),
                round($paye, 2),
                round($nhif, 2),
                round($housingLevy, 2),
                round($loanDeduction, 2),
                round($advanceDeduction, 2),
                round($otherDeductions, 2),
                round($employeeDeductions, 2),
                round($netPay, 2),
                round($employerCost, 2),
                $overtimeHours,
                round($overtimePay, 2),
                $absentDays,
                round($absentDeduction, 2),
            ]);

            $totalGross += $grossPay;
            $totalNet += $netPay;
            $totalDeductions += $employeeDeductions;
            $totalEmployerCost += $employerCost;
        }

        // Update run totals
        $pdo->prepare("
            UPDATE payroll_runs
            SET employee_count = ?,
                total_gross = ?,
                total_net = ?,
                total_deductions = ?,
                total_employer_cost = ?
            WHERE id = ?
        ")->execute([
            count($employees),
            round($totalGross, 2),
            round($totalNet, 2),
            round($totalDeductions, 2),
            round($totalEmployerCost, 2),
            $runId,
        ]);

        // Mark approved salary advances as deducted
        if (!empty($advanceMap)) {
            $pdo->prepare("
                UPDATE hr_salary_advances
                SET status = 'deducted'
                WHERE tenant_id = ?
                  AND employee_id IN ({$empIdPlaceholders})
                  AND status = 'approved'
            ")->execute(array_merge([$tenantId], $empIds));
        }

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'id'      => $runId,
            'run'     => [
                'id'                 => $runId,
                'period_id'          => $periodId,
                'period_name'        => $period['name'],
                'status'             => 'draft',
                'employee_count'     => count($employees),
                'total_gross'        => round($totalGross, 2),
                'total_net'          => round($totalNet, 2),
                'total_deductions'   => round($totalDeductions, 2),
                'total_employer_cost'=> round($totalEmployerCost, 2),
            ],
        ], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('[API Error] payroll-runs POST: ' . $e->getMessage());
        jsonError('An unexpected error occurred while processing payroll. Please try again.', 500);
    }
    exit;
}

// ── PUT — Action-based status updates ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $user = requireManager();
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    requireFields($input, ['id', 'action']);

    $runId = (int) $input['id'];
    $action = $input['action'];

    if (!in_array($action, ['approve', 'mark_paid', 'cancel'])) {
        jsonError('Invalid action. Must be: approve, mark_paid, or cancel', 400);
    }

    // Verify run exists
    $stmt = $pdo->prepare("
        SELECT id, status FROM payroll_runs WHERE id = ? AND tenant_id = ?
    ");
    $stmt->execute([$runId, $tenantId]);
    $run = $stmt->fetch();

    if (!$run) {
        jsonError('Payroll run not found', 404);
    }

    $currentStatus = $run['status'];

    switch ($action) {
        case 'approve':
            // Can approve from draft or review
            if (!in_array($currentStatus, ['draft', 'review'])) {
                jsonError("Cannot approve a run with status: {$currentStatus}", 400);
            }
            $pdo->prepare("
                UPDATE payroll_runs
                SET status = 'approved', approved_by = ?, approved_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ")->execute([$user['user_id'], $runId, $tenantId]);

            jsonResponse(['success' => true, 'message' => 'Payroll run approved']);
            break;

        case 'mark_paid':
            if ($currentStatus !== 'approved') {
                jsonError("Cannot mark as paid. Run must be approved first. Current status: {$currentStatus}", 400);
            }
            $pdo->prepare("
                UPDATE payroll_runs SET status = 'paid' WHERE id = ? AND tenant_id = ?
            ")->execute([$runId, $tenantId]);

            jsonResponse(['success' => true, 'message' => 'Payroll run marked as paid']);
            break;

        case 'cancel':
            if (in_array($currentStatus, ['paid', 'cancelled'])) {
                jsonError("Cannot cancel a run with status: {$currentStatus}", 400);
            }
            $pdo->prepare("
                UPDATE payroll_runs SET status = 'cancelled' WHERE id = ? AND tenant_id = ?
            ")->execute([$runId, $tenantId]);

            jsonResponse(['success' => true, 'message' => 'Payroll run cancelled']);
            break;
    }
    exit;
}

// ── DELETE — Delete draft run ──
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $user = requireManager();
    $tenantId = requireTenant($user);

    $runId = (int) ($_GET['id'] ?? 0);
    if (!$runId) {
        jsonError('Missing run ID', 400);
    }

    // Verify run exists and is draft
    $stmt = $pdo->prepare("
        SELECT id, status FROM payroll_runs WHERE id = ? AND tenant_id = ?
    ");
    $stmt->execute([$runId, $tenantId]);
    $run = $stmt->fetch();

    if (!$run) {
        jsonError('Payroll run not found', 404);
    }
    if ($run['status'] !== 'draft') {
        jsonError('Only draft payroll runs can be deleted', 400);
    }

    // Delete items first, then run
    $pdo->beginTransaction();
    try {
        $pdo->prepare("DELETE FROM payroll_items WHERE payroll_run_id = ? AND tenant_id = ?")->execute([$runId, $tenantId]);
        $pdo->prepare("DELETE FROM payroll_runs WHERE id = ? AND tenant_id = ?")->execute([$runId, $tenantId]);
        $pdo->commit();

        jsonResponse(['success' => true, 'message' => 'Payroll run deleted']);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('[API Error] payroll-runs DELETE: ' . $e->getMessage());
        jsonError('Failed to delete payroll run', 500);
    }
    exit;
}

jsonError('Method not allowed', 405);
