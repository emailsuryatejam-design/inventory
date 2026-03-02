<?php
/**
 * KCL Stores — PIN Login (Camp Staff)
 * POST /api/auth-pin-login.php
 * Body: { "username": "...", "pin": "1234" }
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/audit.php';

requireMethod('POST');
$input = getJsonInput();
requireFields($input, ['username', 'pin']);

// Rate limit: 5 attempts per IP+username per 5 minutes
$rateLimitKey = ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . ':pin:' . $input['username'];
checkRateLimit($rateLimitKey);

// Validate PIN format (4 digits)
if (!preg_match('/^\d{4}$/', $input['pin'])) {
    jsonError('PIN must be 4 digits', 400);
}

$pdo = getDB();

// Find user
$stmt = $pdo->prepare('
    SELECT u.*, c.code as camp_code, c.name as camp_name, c.type as camp_type
    FROM users u
    LEFT JOIN camps c ON u.camp_id = c.id
    WHERE u.username = ? AND u.is_active = 1
');
$stmt->execute([$input['username']]);
$user = $stmt->fetch();

if (!$user) {
    jsonError('Invalid username or PIN', 401);
}

// Verify PIN
if (empty($user['pin_hash'])) {
    jsonError('PIN login not configured for this user. Use password login.', 401);
}

if (!password_verify($input['pin'], $user['pin_hash'])) {
    jsonError('Invalid username or PIN', 401);
}

// Update last login & clear rate limit on success
$pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')
    ->execute([$user['id']]);
clearRateLimit($rateLimitKey);
auditLog($pdo, 'login', (int) $user['id'], ['method' => 'pin']);

// Generate JWT (include tenant_id for data isolation)
$tenantId = $user['tenant_id'] ?? null;
$token = jwtEncode([
    'user_id' => (int) $user['id'],
    'username' => $user['username'],
    'role' => $user['role'],
    'camp_id' => $user['camp_id'] ? (int) $user['camp_id'] : null,
    'tenant_id' => $tenantId ? (int) $tenantId : null,
]);

// Load camps filtered by tenant
if ($tenantId) {
    $campsStmt = $pdo->prepare('SELECT id, code, name, type FROM camps WHERE tenant_id = ? AND is_active = 1 ORDER BY name');
    $campsStmt->execute([$tenantId]);
    $camps = $campsStmt->fetchAll();
} else {
    $camps = $pdo->query('SELECT id, code, name, type FROM camps WHERE is_active = 1 ORDER BY id')
        ->fetchAll();
}

// Load tenant trial info
$tenant = null;
if ($tenantId) {
    $tenantStmt = $pdo->prepare('SELECT id, company_name, status, trial_start, trial_end, plan, max_users, max_camps FROM tenants WHERE id = ?');
    $tenantStmt->execute([$tenantId]);
    $tenantRow = $tenantStmt->fetch();
    if ($tenantRow) {
        $tenant = [
            'id' => (int) $tenantRow['id'],
            'company_name' => $tenantRow['company_name'],
            'status' => $tenantRow['status'],
            'plan' => $tenantRow['plan'],
            'trial_start' => $tenantRow['trial_start'],
            'trial_end' => $tenantRow['trial_end'],
            'max_users' => (int) $tenantRow['max_users'],
            'max_camps' => (int) $tenantRow['max_camps'],
        ];
    }
}

jsonResponse([
    'token' => $token,
    'user' => [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'username' => $user['username'],
        'role' => $user['role'],
        'camp_id' => $user['camp_id'] ? (int) $user['camp_id'] : null,
        'camp_code' => $user['camp_code'],
        'camp_name' => $user['camp_name'],
        'approval_limit' => $user['approval_limit'] ? (float) $user['approval_limit'] : null,
    ],
    'camps' => array_map(function($c) {
        return [
            'id' => (int) $c['id'],
            'code' => $c['code'],
            'name' => $c['name'],
            'type' => $c['type'],
        ];
    }, $camps),
    'tenant' => $tenant,
    'modules' => getModulesForRole($user['role']),
    'permissions' => getPermissionsForRole($user['role']),
]);

// ── Role-based module/permission helpers ──

function getModulesForRole(string $role): array {
    $allModules = ['stores', 'kitchen', 'bar', 'admin', 'reports'];
    switch ($role) {
        case 'admin':
        case 'director':
            return $allModules;
        case 'stores_manager':
        case 'procurement_officer':
            return ['stores', 'kitchen', 'bar', 'reports'];
        case 'camp_manager':
            return ['stores', 'kitchen', 'bar'];
        case 'camp_storekeeper':
            return ['stores'];
        case 'chef':
            return ['kitchen'];
        case 'housekeeping':
            return ['stores'];
        default:
            return ['stores'];
    }
}

function getPermissionsForRole(string $role): array {
    $full = ['view', 'create', 'edit', 'approve', 'delete', 'export'];
    $readWrite = ['view', 'create', 'edit'];
    $readOnly = ['view'];

    switch ($role) {
        case 'admin':
        case 'director':
            return [
                'stores' => $full,
                'kitchen' => $full,
                'bar' => $full,
                'admin' => $full,
                'reports' => $full,
            ];
        case 'stores_manager':
            return [
                'stores' => $full,
                'kitchen' => $readWrite,
                'bar' => $readWrite,
                'reports' => $readOnly,
            ];
        case 'procurement_officer':
            return [
                'stores' => ['view', 'create', 'edit', 'approve'],
                'kitchen' => $readOnly,
                'bar' => $readOnly,
                'reports' => $readOnly,
            ];
        case 'camp_manager':
            return [
                'stores' => $readWrite,
                'kitchen' => $readWrite,
                'bar' => $readWrite,
            ];
        case 'camp_storekeeper':
            return [
                'stores' => $readWrite,
            ];
        case 'chef':
            return [
                'kitchen' => $readWrite,
            ];
        default:
            return [
                'stores' => $readOnly,
            ];
    }
}
