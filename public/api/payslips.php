<?php
/**
 * WebSquare — Payslips API (P2)
 * Ported from KaziPay payslip.service.js
 * Generates HTML payslips, manages templates, bulk distribution
 */

require_once __DIR__ . '/middleware.php';
$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $auth['user_id'] ?? 0;
$userRole = $auth['role'] ?? '';

$action = $_GET['action'] ?? '';

switch ($action) {

// ── Generate HTML payslip for a single payroll item ──
case 'generate':
    $itemId = intval($_GET['id'] ?? 0);
    if (!$itemId) jsonError('Payroll item id required');

    $stmt = $pdo->prepare("
        SELECT pi.*,
            e.employee_no, e.first_name, e.last_name, e.email, e.id_number,
            e.tax_pin, e.nssf_no, e.nhif_no, e.job_title,
            d.name AS department_name, jg.name AS job_grade_name,
            pp.name AS period_name, pp.start_date, pp.end_date, pp.pay_date,
            c.name AS company_name, c.address AS company_address, c.city AS company_city,
            c.phone AS company_phone, c.email AS company_email, c.currency
        FROM payroll_items pi
        JOIN hr_employees e ON pi.employee_id = e.id
        JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
        JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
        LEFT JOIN companies c ON c.tenant_id = pi.tenant_id AND c.is_primary = 1
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN job_grades jg ON e.job_grade_id = jg.id
        WHERE pi.id = ? AND pi.tenant_id = ?
    ");
    $stmt->execute([$itemId, $tenantId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$item) jsonError('Payroll item not found', 404);

    // If employee role, can only see own payslip
    if (!in_array($userRole, ['admin', 'director', 'stores_manager'])) {
        $empStmt = $pdo->prepare("SELECT id FROM hr_employees WHERE user_id = ? AND tenant_id = ?");
        $empStmt->execute([$userId, $tenantId]);
        $emp = $empStmt->fetch(PDO::FETCH_ASSOC);
        if (!$emp || $emp['id'] != $item['employee_id']) {
            jsonError('Access denied', 403);
        }
    }

    // Get detail breakdown
    $stmt = $pdo->prepare("
        SELECT * FROM payroll_item_details
        WHERE payroll_item_id = ? AND tenant_id = ?
        ORDER BY type, name
    ");
    $stmt->execute([$itemId, $tenantId]);
    $details = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $earnings = array_filter($details, fn($d) => $d['type'] === 'earning');
    $deductions = array_filter($details, fn($d) => $d['type'] === 'deduction');
    $employerContribs = array_filter($details, fn($d) => $d['type'] === 'employer_contribution');

    $currency = $item['currency'] ?? 'KES';
    $fmt = fn($v) => number_format((float)($v ?? 0), 2);

    // Build earnings rows
    $earningRows = '';
    foreach ($earnings as $e) {
        $earningRows .= "<tr><td>{$e['name']}</td><td class=\"amount\">{$fmt($e['amount'])}</td></tr>";
    }

    // Build deduction rows
    $deductionRows = '';
    foreach ($deductions as $d) {
        $deductionRows .= "<tr><td>{$d['name']}</td><td class=\"amount\">{$fmt($d['amount'])}</td></tr>";
    }

    // Build employer contribution rows
    $contribRows = '';
    foreach ($employerContribs as $c) {
        $contribRows .= "<tr><td>{$c['name']}</td><td class=\"amount\">{$fmt($c['amount'])}</td></tr>";
    }

    $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payslip - '
        . htmlspecialchars($item['first_name'] . ' ' . $item['last_name'])
        . '</title><style>'
        . 'body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#333;font-size:12px}'
        . '.header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:15px}'
        . '.company-name{font-size:18px;font-weight:bold}'
        . '.payslip-title{font-size:16px;font-weight:bold;text-align:center;margin:10px 0}'
        . '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:15px}'
        . '.info-row{display:flex}.info-label{font-weight:bold;width:140px}'
        . 'table{width:100%;border-collapse:collapse;margin-bottom:15px}'
        . 'th,td{padding:5px 8px;border:1px solid #ccc;text-align:left}'
        . 'th{background:#f0f0f0;font-weight:bold}'
        . '.amount{text-align:right}'
        . '.total-row{font-weight:bold;background:#f9f9f9}'
        . '.net-pay{font-size:16px;font-weight:bold;text-align:right;margin-top:10px;padding:10px;background:#e8f5e9;border-radius:4px}'
        . '.footer{margin-top:20px;font-size:10px;color:#666;text-align:center;border-top:1px solid #ccc;padding-top:10px}'
        . '</style></head><body>'
        . '<div class="header"><div>'
        . '<div class="company-name">' . htmlspecialchars($item['company_name'] ?? '') . '</div>'
        . '<div>' . htmlspecialchars(($item['company_address'] ?? '') . ' ' . ($item['company_city'] ?? '')) . '</div>'
        . '<div>' . htmlspecialchars(($item['company_phone'] ?? '') . ' | ' . ($item['company_email'] ?? '')) . '</div>'
        . '</div><div style="text-align:right">'
        . '<div class="payslip-title">PAYSLIP</div>'
        . '<div>Period: ' . htmlspecialchars($item['start_date'] ?? '') . ' to ' . htmlspecialchars($item['end_date'] ?? '') . '</div>'
        . '<div>Pay Date: ' . htmlspecialchars($item['pay_date'] ?? '') . '</div>'
        . '</div></div>'
        . '<div class="info-grid">'
        . '<div class="info-row"><span class="info-label">Employee No:</span> ' . htmlspecialchars($item['employee_no'] ?? '') . '</div>'
        . '<div class="info-row"><span class="info-label">Department:</span> ' . htmlspecialchars($item['department_name'] ?? 'N/A') . '</div>'
        . '<div class="info-row"><span class="info-label">Name:</span> ' . htmlspecialchars($item['first_name'] . ' ' . $item['last_name']) . '</div>'
        . '<div class="info-row"><span class="info-label">Job Grade:</span> ' . htmlspecialchars($item['job_grade_name'] ?? 'N/A') . '</div>'
        . '<div class="info-row"><span class="info-label">Tax PIN:</span> ' . htmlspecialchars($item['tax_pin'] ?? 'N/A') . '</div>'
        . '<div class="info-row"><span class="info-label">NSSF No:</span> ' . htmlspecialchars($item['nssf_no'] ?? 'N/A') . '</div>'
        . '</div>'
        . '<table><thead><tr><th colspan="2">Earnings</th></tr><tr><th>Description</th><th class="amount">Amount (' . $currency . ')</th></tr></thead>'
        . '<tbody>' . $earningRows
        . '<tr class="total-row"><td>Gross Pay</td><td class="amount">' . $fmt($item['gross_pay']) . '</td></tr></tbody></table>'
        . '<table><thead><tr><th colspan="2">Deductions</th></tr><tr><th>Description</th><th class="amount">Amount (' . $currency . ')</th></tr></thead>'
        . '<tbody>' . $deductionRows
        . '<tr class="total-row"><td>Total Deductions</td><td class="amount">' . $fmt($item['total_deductions']) . '</td></tr></tbody></table>'
        . '<div class="net-pay">Net Pay: ' . $currency . ' ' . $fmt($item['net_pay']) . '</div>';

    if (!empty($contribRows)) {
        $html .= '<table style="margin-top:15px"><thead><tr><th colspan="2">Employer Contributions</th></tr>'
            . '<tr><th>Description</th><th class="amount">Amount (' . $currency . ')</th></tr></thead>'
            . '<tbody>' . $contribRows . '</tbody></table>';
    }

    $html .= '<div class="footer">This is a computer-generated document. No signature is required.</div></body></html>';

    jsonResponse([
        'html' => $html,
        'employee' => [
            'id'   => $item['employee_id'],
            'name' => $item['first_name'] . ' ' . $item['last_name'],
            'employee_no' => $item['employee_no'],
        ],
        'period' => [
            'name'  => $item['period_name'],
            'start' => $item['start_date'],
            'end'   => $item['end_date'],
            'pay_date' => $item['pay_date'],
        ],
        'net_pay' => (float)$item['net_pay'],
        'currency' => $currency,
    ]);

// ── List payslips for a payroll run ──
case 'list':
    if (!in_array($userRole, ['admin', 'director', 'stores_manager'])) {
        jsonError('Access denied', 403);
    }
    $runId = intval($_GET['run_id'] ?? 0);
    if (!$runId) jsonError('run_id required');

    $stmt = $pdo->prepare("
        SELECT pi.id, pi.employee_id, pi.gross_pay, pi.total_deductions, pi.net_pay,
               e.employee_no, e.first_name, e.last_name, e.email
        FROM payroll_items pi
        JOIN hr_employees e ON pi.employee_id = e.id
        WHERE pi.payroll_run_id = ? AND pi.tenant_id = ?
        ORDER BY e.first_name, e.last_name
    ");
    $stmt->execute([$runId, $tenantId]);
    jsonResponse(['payslips' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ── Templates CRUD ──
case 'templates':
    if (!in_array($userRole, ['admin', 'director', 'stores_manager'])) {
        jsonError('Access denied', 403);
    }
    $stmt = $pdo->prepare("SELECT * FROM payslip_templates WHERE tenant_id = ? ORDER BY is_default DESC, name ASC");
    $stmt->execute([$tenantId]);
    jsonResponse(['templates' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

case 'save_template':
    if (!in_array($userRole, ['admin', 'director'])) {
        jsonError('Access denied', 403);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    $fields = [
        'name'            => $input['name'] ?? 'Default',
        'layout'          => $input['layout'] ?? 'standard',
        'show_employer'   => intval($input['show_employer'] ?? 1),
        'show_ytd'        => intval($input['show_ytd'] ?? 0),
        'show_loans'      => intval($input['show_loans'] ?? 0),
        'show_leave'      => intval($input['show_leave'] ?? 0),
        'show_bank'       => intval($input['show_bank'] ?? 0),
        'show_tax'        => intval($input['show_tax'] ?? 1),
        'password_type'   => $input['password_type'] ?? 'id_number',
        'header_text'     => $input['header_text'] ?? '',
        'footer_text'     => $input['footer_text'] ?? '',
    ];

    if ($id > 0) {
        $sets = [];
        $vals = [];
        foreach ($fields as $k => $v) {
            $sets[] = "$k = ?";
            $vals[] = $v;
        }
        $vals[] = $id;
        $vals[] = $tenantId;
        $pdo->prepare("UPDATE payslip_templates SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")->execute($vals);
    } else {
        $cols = array_keys($fields);
        $cols[] = 'tenant_id';
        $vals = array_values($fields);
        $vals[] = $tenantId;
        $placeholders = implode(',', array_fill(0, count($vals), '?'));
        $pdo->prepare("INSERT INTO payslip_templates (" . implode(',', $cols) . ") VALUES ($placeholders)")->execute($vals);
        $id = $pdo->lastInsertId();
    }

    // Handle is_default
    if (!empty($input['is_default'])) {
        $pdo->prepare("UPDATE payslip_templates SET is_default = 0 WHERE tenant_id = ? AND id != ?")->execute([$tenantId, $id]);
        $pdo->prepare("UPDATE payslip_templates SET is_default = 1 WHERE id = ? AND tenant_id = ?")->execute([$id, $tenantId]);
    }

    jsonResponse(['id' => $id, 'message' => 'Template saved']);

case 'delete_template':
    if (!in_array($userRole, ['admin', 'director'])) {
        jsonError('Access denied', 403);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $pdo->prepare("DELETE FROM payslip_templates WHERE id = ? AND tenant_id = ?")->execute([$id, $tenantId]);
    jsonResponse(['message' => 'Template deleted']);

// ── My Payslips (self-service — employee views own) ──
case 'my_payslips':
    // Find employee record for current user
    $empStmt = $pdo->prepare("SELECT id FROM hr_employees WHERE user_id = ? AND tenant_id = ?");
    $empStmt->execute([$userId, $tenantId]);
    $emp = $empStmt->fetch(PDO::FETCH_ASSOC);
    if (!$emp) jsonError('Employee record not found');

    $year = intval($_GET['year'] ?? date('Y'));
    $stmt = $pdo->prepare("
        SELECT pi.id, pi.gross_pay, pi.total_deductions, pi.net_pay,
               pp.name AS period_name, pp.start_date, pp.end_date, pp.pay_date,
               pr.status AS run_status
        FROM payroll_items pi
        JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
        JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
        WHERE pi.employee_id = ? AND pi.tenant_id = ?
          AND pr.status IN ('approved','paid')
          AND YEAR(pp.pay_date) = ?
        ORDER BY pp.pay_date DESC
    ");
    $stmt->execute([$emp['id'], $tenantId, $year]);
    jsonResponse(['payslips' => $stmt->fetchAll(PDO::FETCH_ASSOC), 'year' => $year]);

default:
    jsonError('Invalid action. Use: generate, list, templates, save_template, delete_template, my_payslips');
}
