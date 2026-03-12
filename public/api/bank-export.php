<?php
/**
 * WebSquare — Bank Export API (P2)
 * Ported from KaziPay bankExport.service.js
 * Generates CSV bank files for payroll salary payments
 */

require_once __DIR__ . '/middleware.php';
$auth    = requireAuth();
$tenantId = requireTenant($auth);
$pdo     = getDB();
$userId   = $auth['user_id'] ?? 0;
$userRole = $auth['role'] ?? '';

if (!in_array($userRole, ['admin', 'director', 'stores_manager'])) {
    jsonError('Access denied', 403);
}

$action = $_GET['action'] ?? '';

switch ($action) {

// ── List exportable payroll runs (approved or paid) ──
case 'list_runs':
    $stmt = $pdo->prepare("
        SELECT pr.id, pr.status, pr.total_net_pay, pr.employee_count,
               pp.name AS period_name, pp.start_date, pp.end_date, pp.pay_date,
               c.currency
        FROM payroll_runs pr
        JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
        LEFT JOIN companies c ON c.tenant_id = pr.tenant_id AND c.is_primary = 1
        WHERE pr.tenant_id = ? AND pr.status IN ('approved','paid')
        ORDER BY pp.pay_date DESC
        LIMIT 50
    ");
    $stmt->execute([$tenantId]);
    jsonResponse(['runs' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ── Generate bank file CSV ──
case 'generate':
    $input = json_decode(file_get_contents('php://input'), true);
    $runId = intval($input['run_id'] ?? 0);
    $format = $input['format'] ?? 'generic';

    if (!$runId) jsonError('run_id required');

    $supportedFormats = ['generic', 'kcb', 'equity', 'stanbic', 'crdb', 'nmb'];
    if (!in_array($format, $supportedFormats)) {
        jsonError("Unsupported format: $format. Supported: " . implode(', ', $supportedFormats));
    }

    // Validate run belongs to tenant
    $stmt = $pdo->prepare("
        SELECT pr.*, pp.name AS period_name, pp.pay_date,
               c.name AS company_name, c.currency
        FROM payroll_runs pr
        JOIN payroll_periods pp ON pr.payroll_period_id = pp.id
        LEFT JOIN companies c ON c.tenant_id = pr.tenant_id AND c.is_primary = 1
        WHERE pr.id = ? AND pr.tenant_id = ? AND pr.status IN ('approved','paid')
    ");
    $stmt->execute([$runId, $tenantId]);
    $run = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$run) jsonError('Approved payroll run not found', 404);

    $currency = $run['currency'] ?? 'KES';

    // Get payroll items with bank details
    $stmt = $pdo->prepare("
        SELECT
            e.employee_no, e.first_name, e.last_name, e.id_number,
            pi.net_pay, pi.payment_method,
            bd.bank_name, bd.bank_code, bd.branch_name, bd.branch_code,
            bd.account_name, bd.account_number
        FROM payroll_items pi
        JOIN hr_employees e ON pi.employee_id = e.id
        LEFT JOIN bank_details bd ON e.id = bd.employee_id AND bd.tenant_id = ? AND bd.is_primary = 1
        WHERE pi.payroll_run_id = ? AND pi.tenant_id = ? AND pi.payment_method = 'bank_transfer'
        ORDER BY e.first_name, e.last_name
    ");
    $stmt->execute([$tenantId, $runId, $tenantId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($items)) jsonError('No bank transfer items found for this payroll run');

    $payDate = date('Y-m-d');
    $companyName = preg_replace('/\s+/', '_', $run['company_name'] ?? 'Company');
    $totalAmount = 0;
    $rows = [];

    switch ($format) {
        case 'kcb':
            $rows[] = 'Payment Type,Beneficiary Name,Bank Code,Branch Code,Account Number,Amount,Reference,Narrative';
            foreach ($items as $item) {
                $name = $item['first_name'] . ' ' . $item['last_name'];
                $ref = "SAL-{$item['employee_no']}-{$payDate}";
                $amt = number_format((float)$item['net_pay'], 2, '.', '');
                $totalAmount += (float)$item['net_pay'];
                $rows[] = "\"EFT\",\"$name\",\"{$item['bank_code']}\",\"{$item['branch_code']}\",\"{$item['account_number']}\",$amt,\"$ref\",\"Salary Payment\"";
            }
            break;

        case 'equity':
            $rows[] = 'Payment Type,Account Number,Account Name,Amount,Currency,Narration,Bank Code';
            foreach ($items as $item) {
                $name = $item['account_name'] ?: ($item['first_name'] . ' ' . $item['last_name']);
                $ref = "SAL-{$item['employee_no']}-{$payDate}";
                $amt = number_format((float)$item['net_pay'], 2, '.', '');
                $totalAmount += (float)$item['net_pay'];
                $rows[] = "\"RTGS\",\"{$item['account_number']}\",\"$name\",$amt,\"$currency\",\"Salary $ref\",\"{$item['bank_code']}\"";
            }
            break;

        case 'stanbic':
            $rows[] = 'Record Type,Beneficiary Account,Beneficiary Name,Bank Code,Branch Code,Amount,Currency,Reference';
            foreach ($items as $item) {
                $name = $item['first_name'] . ' ' . $item['last_name'];
                $ref = "SAL-{$item['employee_no']}-{$payDate}";
                $amt = number_format((float)$item['net_pay'], 2, '.', '');
                $totalAmount += (float)$item['net_pay'];
                $rows[] = "\"CR\",\"{$item['account_number']}\",\"$name\",\"{$item['bank_code']}\",\"{$item['branch_code']}\",$amt,\"$currency\",\"$ref\"";
            }
            break;

        case 'crdb':
            $rows[] = 'Account Number,Account Name,Amount,Currency,Reference,Narration';
            foreach ($items as $item) {
                $name = $item['account_name'] ?: ($item['first_name'] . ' ' . $item['last_name']);
                $ref = "SAL-{$item['employee_no']}-{$payDate}";
                $amt = number_format((float)$item['net_pay'], 2, '.', '');
                $totalAmount += (float)$item['net_pay'];
                $rows[] = "\"{$item['account_number']}\",\"$name\",$amt,\"$currency\",\"$ref\",\"Salary Payment\"";
            }
            break;

        case 'nmb':
            $rows[] = 'Debit Account,Beneficiary Account,Beneficiary Name,Amount,Reference,Bank Code';
            foreach ($items as $item) {
                $name = $item['first_name'] . ' ' . $item['last_name'];
                $ref = "SAL-{$item['employee_no']}-{$payDate}";
                $amt = number_format((float)$item['net_pay'], 2, '.', '');
                $totalAmount += (float)$item['net_pay'];
                $rows[] = "\"\",\"{$item['account_number']}\",\"$name\",$amt,\"$ref\",\"{$item['bank_code']}\"";
            }
            break;

        default: // generic
            $rows[] = 'Employee No,Employee Name,Bank Name,Bank Code,Branch Name,Account Number,Account Name,Amount,Currency,Reference';
            foreach ($items as $item) {
                $name = $item['first_name'] . ' ' . $item['last_name'];
                $ref = "SAL-{$runId}-{$item['employee_no']}";
                $amt = number_format((float)$item['net_pay'], 2, '.', '');
                $totalAmount += (float)$item['net_pay'];
                $rows[] = "\"{$item['employee_no']}\",\"$name\",\"{$item['bank_name']}\",\"{$item['bank_code']}\",\"{$item['branch_name']}\",\"{$item['account_number']}\",\"{$item['account_name']}\",$amt,\"$currency\",\"$ref\"";
            }
    }

    $csvContent = implode("\n", $rows);
    $filename = "payroll_{$companyName}_{$format}_{$payDate}.csv";

    jsonResponse([
        'format'       => $format,
        'filename'     => $filename,
        'content'      => $csvContent,
        'record_count' => count($items),
        'total_amount' => round($totalAmount, 2),
        'currency'     => $currency,
    ]);

// ── Download CSV directly (Content-Disposition) ──
case 'download':
    $input = json_decode(file_get_contents('php://input'), true);
    $content  = $input['content'] ?? '';
    $filename = $input['filename'] ?? 'bank-export.csv';

    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo $content;
    exit;

default:
    jsonError('Invalid action. Use: list_runs, generate, download');
}
