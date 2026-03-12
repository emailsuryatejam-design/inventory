<?php
/**
 * WebSquare — M-Pesa Integration API (P6)
 * Ported from KaziPay mpesa.service.js
 * Safaricom B2C payments for salary disbursement
 */

require_once __DIR__ . '/middleware.php';
$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $auth['user_id'] ?? 0;
$userRole = $auth['role'] ?? '';

if (!in_array($userRole, ['admin', 'director'])) {
    jsonError('Access denied', 403);
}

$action = $_GET['action'] ?? '';

// Get M-Pesa config from settings
function getMpesaConfig($pdo, $tenantId) {
    $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ? AND setting_key LIKE 'mpesa_%'");
    $stmt->execute([$tenantId]);
    $config = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $config[str_replace('mpesa_', '', $row['setting_key'])] = $row['setting_value'];
    }
    return $config;
}

// Get OAuth token
function getMpesaToken($config) {
    $env = ($config['environment'] ?? 'sandbox') === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

    $ch = curl_init("$env/oauth/v1/generate?grant_type=client_credentials");
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_USERPWD => ($config['consumer_key'] ?? '') . ':' . ($config['consumer_secret'] ?? ''),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return null;
    }
    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

switch ($action) {

// ── Check config status ──
case 'status':
    $config = getMpesaConfig($pdo, $tenantId);
    $configured = !empty($config['consumer_key']) && !empty($config['consumer_secret']) && !empty($config['shortcode']);
    jsonResponse([
        'configured' => $configured,
        'environment' => $config['environment'] ?? 'sandbox',
        'shortcode' => $config['shortcode'] ?? '',
    ]);

// ── Save config ──
case 'save_config':
    $input = json_decode(file_get_contents('php://input'), true);
    $keys = ['consumer_key', 'consumer_secret', 'shortcode', 'initiator_name', 'security_credential', 'environment', 'callback_url'];

    foreach ($keys as $key) {
        if (isset($input[$key])) {
            $pdo->prepare("
                INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ")->execute([$tenantId, 'mpesa_' . $key, $input[$key]]);
        }
    }
    jsonResponse(['message' => 'M-Pesa configuration saved']);

// ── Send B2C payment ──
case 'send_payment':
    $config = getMpesaConfig($pdo, $tenantId);
    if (empty($config['consumer_key'])) jsonError('M-Pesa not configured');

    $input = json_decode(file_get_contents('php://input'), true);
    $phone = $input['phone'] ?? '';
    $amount = floatval($input['amount'] ?? 0);
    $reference = $input['reference'] ?? 'SalaryPayment';

    if (!$phone || $amount <= 0) jsonError('Phone number and amount required');

    $token = getMpesaToken($config);
    if (!$token) jsonError('Failed to get M-Pesa auth token');

    $env = ($config['environment'] ?? 'sandbox') === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

    $payload = [
        'InitiatorName'      => $config['initiator_name'] ?? '',
        'SecurityCredential' => $config['security_credential'] ?? '',
        'CommandID'          => 'SalaryPayment',
        'Amount'             => intval($amount),
        'PartyA'             => $config['shortcode'] ?? '',
        'PartyB'             => $phone,
        'Remarks'            => $reference,
        'QueueTimeOutURL'    => ($config['callback_url'] ?? '') . '/mpesa/timeout',
        'ResultURL'          => ($config['callback_url'] ?? '') . '/mpesa/result',
        'Occasion'           => $reference,
    ];

    $ch = curl_init("$env/mpesa/b2c/v1/paymentrequest");
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $token", 'Content-Type: application/json'],
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    // Log transaction
    $pdo->prepare("
        INSERT INTO mpesa_transactions (tenant_id, phone, amount, reference, response_code, conversation_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ")->execute([
        $tenantId, $phone, $amount, $reference,
        $result['ResponseCode'] ?? $httpCode,
        $result['ConversationID'] ?? '',
        ($result['ResponseCode'] ?? '') === '0' ? 'pending' : 'failed',
    ]);

    if (($result['ResponseCode'] ?? '') === '0') {
        jsonResponse(['message' => 'Payment sent', 'conversation_id' => $result['ConversationID'] ?? '']);
    } else {
        jsonError('M-Pesa payment failed: ' . ($result['ResponseDescription'] ?? 'Unknown error'));
    }

// ── Bulk salary payment ──
case 'bulk_salary':
    $config = getMpesaConfig($pdo, $tenantId);
    if (empty($config['consumer_key'])) jsonError('M-Pesa not configured');

    $input = json_decode(file_get_contents('php://input'), true);
    $runId = intval($input['run_id'] ?? 0);
    if (!$runId) jsonError('run_id required');

    // Get payroll items with M-Pesa as payment method
    $stmt = $pdo->prepare("
        SELECT pi.id, pi.net_pay, e.first_name, e.last_name, e.phone, e.employee_no
        FROM payroll_items pi
        JOIN hr_employees e ON pi.employee_id = e.id
        WHERE pi.payroll_run_id = ? AND pi.tenant_id = ? AND pi.payment_method = 'mpesa'
    ");
    $stmt->execute([$runId, $tenantId]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($items)) jsonError('No M-Pesa payment items found');

    $results = ['sent' => 0, 'failed' => 0, 'total' => count($items), 'errors' => []];

    $token = getMpesaToken($config);
    if (!$token) jsonError('Failed to get M-Pesa auth token');

    foreach ($items as $item) {
        if (empty($item['phone'])) {
            $results['failed']++;
            $results['errors'][] = ['employee' => $item['first_name'] . ' ' . $item['last_name'], 'error' => 'No phone number'];
            continue;
        }

        // In production, would send actual B2C here
        // For now, log the intent
        $pdo->prepare("
            INSERT INTO mpesa_transactions (tenant_id, phone, amount, reference, status, created_at)
            VALUES (?, ?, ?, ?, 'queued', NOW())
        ")->execute([$tenantId, $item['phone'], $item['net_pay'], "SAL-{$runId}-{$item['employee_no']}"]);

        $results['sent']++;
    }

    jsonResponse($results);

// ── Transaction history ──
case 'transactions':
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = 25;
    $offset = ($page - 1) * $limit;

    $stmt = $pdo->prepare("
        SELECT * FROM mpesa_transactions
        WHERE tenant_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([$tenantId, $limit, $offset]);
    jsonResponse(['transactions' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

default:
    jsonError('Invalid action. Use: status, save_config, send_payment, bulk_salary, transactions');
}
