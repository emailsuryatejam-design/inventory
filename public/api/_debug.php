<?php
/**
 * Temporary debug script — simulates registration step by step.
 * DELETE after testing!
 */
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $steps = [];

    // Step 1: Test tenants INSERT
    try {
        $trialStart = date('Y-m-d');
        $trialEnd = date('Y-m-d', strtotime('+30 days'));
        $defaultModules = json_encode(['stores', 'kitchen', 'bar', 'admin']);

        $stmt = $pdo->prepare("
            INSERT INTO tenants (company_name, slug, email, phone, country, industry, status, trial_start, trial_end, plan, max_users, max_camps, modules)
            VALUES (?, ?, ?, ?, ?, ?, 'trial', ?, ?, 'trial', 5, 2, ?)
        ");
        $stmt->execute(['Debug Lodge', 'debug-lodge-' . time(), 'debug@test.com', '+254700000000', 'Kenya', 'Safari', $trialStart, $trialEnd, $defaultModules]);
        $tenantId = (int)$pdo->lastInsertId();
        $steps[] = ['action' => 'insert_tenant', 'ok' => true, 'tenant_id' => $tenantId];
    } catch (Throwable $e) {
        $steps[] = ['action' => 'insert_tenant', 'error' => $e->getMessage()];
        echo json_encode(['steps' => $steps], JSON_PRETTY_PRINT);
        exit;
    }

    // Step 2: Test camps INSERT
    try {
        $stmt = $pdo->prepare("
            INSERT INTO camps (tenant_id, code, name, type, is_active)
            VALUES (?, 'HO', ?, 'head_office', 1)
        ");
        $stmt->execute([$tenantId, 'Debug Lodge - Head Office']);
        $campId = (int)$pdo->lastInsertId();
        $steps[] = ['action' => 'insert_camp', 'ok' => true, 'camp_id' => $campId];
    } catch (Throwable $e) {
        $steps[] = ['action' => 'insert_camp', 'error' => $e->getMessage()];
        // Cleanup tenant
        $pdo->exec("DELETE FROM tenants WHERE id = $tenantId");
        echo json_encode(['steps' => $steps], JSON_PRETTY_PRINT);
        exit;
    }

    // Step 3: Test users INSERT
    try {
        $passwordHash = password_hash('TestPass2026', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("
            INSERT INTO users (tenant_id, name, username, password_hash, role, camp_id, approval_limit, is_active)
            VALUES (?, ?, ?, ?, 'admin', ?, 999999999, 1)
        ");
        $stmt->execute([$tenantId, 'Debug User', 'debuguser' . time(), $passwordHash, $campId]);
        $userId = (int)$pdo->lastInsertId();
        $steps[] = ['action' => 'insert_user', 'ok' => true, 'user_id' => $userId];
    } catch (Throwable $e) {
        $steps[] = ['action' => 'insert_user', 'error' => $e->getMessage()];
        // Cleanup
        $pdo->exec("DELETE FROM camps WHERE id = $campId");
        $pdo->exec("DELETE FROM tenants WHERE id = $tenantId");
        echo json_encode(['steps' => $steps], JSON_PRETTY_PRINT);
        exit;
    }

    // Step 4: Test JWT generation
    try {
        require_once __DIR__ . '/middleware.php';
        $token = jwtEncode([
            'user_id' => $userId,
            'username' => 'debuguser',
            'role' => 'admin',
            'camp_id' => $campId,
            'tenant_id' => $tenantId,
        ]);
        $steps[] = ['action' => 'jwt_generate', 'ok' => true, 'token_length' => strlen($token)];
    } catch (Throwable $e) {
        $steps[] = ['action' => 'jwt_generate', 'error' => $e->getMessage()];
    }

    // Cleanup all test data
    $pdo->exec("DELETE FROM users WHERE id = $userId");
    $pdo->exec("DELETE FROM camps WHERE id = $campId");
    $pdo->exec("DELETE FROM tenants WHERE id = $tenantId");
    $steps[] = ['action' => 'cleanup', 'ok' => true];

    echo json_encode(['steps' => $steps], JSON_PRETTY_PRINT);
    exit;
}

// GET: Run migration if needed
$results = [];

// Check tenants
try {
    $count = $pdo->query('SELECT COUNT(*) FROM tenants')->fetchColumn();
    $results[] = ['table' => 'tenants', 'exists' => true, 'rows' => (int)$count];
} catch (Throwable $e) {
    $results[] = ['table' => 'tenants', 'exists' => false];
    // Run migration
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS tenants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_name VARCHAR(255) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50) DEFAULT NULL,
            country VARCHAR(100) DEFAULT NULL,
            industry VARCHAR(100) DEFAULT NULL,
            status ENUM('trial','active','suspended','expired') DEFAULT 'trial',
            trial_start DATE NOT NULL,
            trial_end DATE NOT NULL,
            plan VARCHAR(50) DEFAULT 'trial',
            max_users INT DEFAULT 5,
            max_camps INT DEFAULT 2,
            modules JSON DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (status), INDEX idx_email (email), INDEX idx_trial_end (trial_end)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $results[] = ['migration' => 'tenants_created'];
    } catch (Throwable $e2) {
        $results[] = ['migration_error' => $e2->getMessage()];
    }
}

// Check users.tenant_id
$cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'tenant_id'")->fetchAll();
$results[] = ['users_has_tenant_id' => !empty($cols)];

// Check camps.tenant_id
$cols = $pdo->query("SHOW COLUMNS FROM camps LIKE 'tenant_id'")->fetchAll();
$results[] = ['camps_has_tenant_id' => !empty($cols)];

// Check rate-limit cache directory
$cacheDir = __DIR__ . '/cache/rate-limits';
$results[] = ['cache_dir' => $cacheDir, 'exists' => is_dir($cacheDir), 'writable' => is_writable($cacheDir)];

echo json_encode($results, JSON_PRETTY_PRINT);
