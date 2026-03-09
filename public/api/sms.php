<?php
/**
 * WebSquare — SMS Integration API (P6)
 * Ported from KaziPay sms.service.js
 * Africa's Talking SMS gateway
 */

require_once __DIR__ . '/middleware.php';
$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $GLOBALS['user_id'];
$userRole = $GLOBALS['user_role'] ?? '';

if (!in_array($userRole, ['admin', 'director'])) {
    jsonError('Access denied', 403);
}

$action = $_GET['action'] ?? '';

function getSmsConfig($pdo, $tenantId) {
    $stmt = $pdo->prepare("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ? AND setting_key LIKE 'sms_%'");
    $stmt->execute([$tenantId]);
    $config = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $config[str_replace('sms_', '', $row['setting_key'])] = $row['setting_value'];
    }
    return $config;
}

function sendSms($config, $phone, $message) {
    if (empty($config['api_key']) || empty($config['username'])) {
        return ['success' => false, 'error' => 'SMS not configured'];
    }

    $env = ($config['environment'] ?? 'sandbox') === 'production'
        ? 'https://api.africastalking.com/version1/messaging'
        : 'https://api.sandbox.africastalking.com/version1/messaging';

    $data = [
        'username' => $config['username'],
        'to'       => $phone,
        'message'  => $message,
    ];
    if (!empty($config['sender_id'])) {
        $data['from'] = $config['sender_id'];
    }

    $ch = curl_init($env);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
            'apiKey: ' . $config['api_key'],
        ],
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 200 && $httpCode < 300) {
        return ['success' => true, 'response' => json_decode($response, true)];
    }
    return ['success' => false, 'error' => "HTTP $httpCode: $response"];
}

switch ($action) {

// ── Status ──
case 'status':
    $config = getSmsConfig($pdo, $tenantId);
    jsonResponse([
        'configured' => !empty($config['api_key']) && !empty($config['username']),
        'environment' => $config['environment'] ?? 'sandbox',
    ]);

// ── Save config ──
case 'save_config':
    $input = json_decode(file_get_contents('php://input'), true);
    $keys = ['api_key', 'username', 'sender_id', 'environment'];

    foreach ($keys as $key) {
        if (isset($input[$key])) {
            $pdo->prepare("
                INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ")->execute([$tenantId, 'sms_' . $key, $input[$key]]);
        }
    }
    jsonResponse(['message' => 'SMS configuration saved']);

// ── Send single SMS ──
case 'send':
    $config = getSmsConfig($pdo, $tenantId);
    $input = json_decode(file_get_contents('php://input'), true);
    $phone = $input['phone'] ?? '';
    $message = $input['message'] ?? '';

    if (!$phone || !$message) jsonError('Phone and message required');

    $result = sendSms($config, $phone, $message);

    // Log
    $pdo->prepare("
        INSERT INTO sms_logs (tenant_id, phone, message, status, response, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ")->execute([$tenantId, $phone, $message, $result['success'] ? 'sent' : 'failed', json_encode($result)]);

    if ($result['success']) {
        jsonResponse(['message' => 'SMS sent']);
    } else {
        jsonError('SMS failed: ' . ($result['error'] ?? 'Unknown error'));
    }

// ── Bulk SMS ──
case 'bulk':
    $config = getSmsConfig($pdo, $tenantId);
    $input = json_decode(file_get_contents('php://input'), true);
    $recipients = $input['recipients'] ?? [];
    $template = $input['template'] ?? '';

    if (empty($recipients) || !$template) jsonError('Recipients and template required');

    $results = ['sent' => 0, 'failed' => 0, 'total' => count($recipients)];

    foreach ($recipients as $r) {
        $phone = $r['phone'] ?? '';
        if (!$phone) { $results['failed']++; continue; }

        // Replace template variables
        $msg = str_replace(
            ['{{name}}', '{{employee_no}}', '{{amount}}', '{{period}}'],
            [$r['name'] ?? '', $r['employee_no'] ?? '', $r['amount'] ?? '', $r['period'] ?? ''],
            $template
        );

        $result = sendSms($config, $phone, $msg);
        if ($result['success']) {
            $results['sent']++;
        } else {
            $results['failed']++;
        }
    }

    jsonResponse($results);

// ── SMS Log ──
case 'logs':
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = 50;
    $offset = ($page - 1) * $limit;

    $stmt = $pdo->prepare("SELECT * FROM sms_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?");
    $stmt->execute([$tenantId, $limit, $offset]);
    jsonResponse(['logs' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

default:
    jsonError('Invalid action. Use: status, save_config, send, bulk, logs');
}
