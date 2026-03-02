<?php
/**
 * Temporary debug/fix script.
 * GET  → diagnose
 * POST → fix constraints and test registration
 * DELETE after testing!
 */
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $action = $_GET['action'] ?? 'fix';
    $steps = [];

    if ($action === 'fix') {
        // Fix 1: Drop global unique on camps.code, add composite unique (tenant_id, code)
        try {
            // Check if uk_camps_code exists
            $indexes = $pdo->query("SHOW INDEX FROM camps WHERE Key_name = 'uk_camps_code'")->fetchAll();
            if (!empty($indexes)) {
                $pdo->exec("ALTER TABLE camps DROP INDEX uk_camps_code");
                $steps[] = ['action' => 'drop_uk_camps_code', 'ok' => true];
            } else {
                $steps[] = ['action' => 'drop_uk_camps_code', 'skipped' => 'index not found'];
            }
        } catch (Throwable $e) {
            $steps[] = ['action' => 'drop_uk_camps_code', 'error' => $e->getMessage()];
        }

        // Add composite unique index
        try {
            $indexes = $pdo->query("SHOW INDEX FROM camps WHERE Key_name = 'uk_tenant_camp_code'")->fetchAll();
            if (empty($indexes)) {
                $pdo->exec("ALTER TABLE camps ADD UNIQUE INDEX uk_tenant_camp_code (tenant_id, code)");
                $steps[] = ['action' => 'add_uk_tenant_camp_code', 'ok' => true];
            } else {
                $steps[] = ['action' => 'add_uk_tenant_camp_code', 'skipped' => 'already exists'];
            }
        } catch (Throwable $e) {
            $steps[] = ['action' => 'add_uk_tenant_camp_code', 'error' => $e->getMessage()];
        }

        // Fix 2: Create cache directories for rate limiting
        $cacheDir = __DIR__ . '/cache/rate-limits';
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
            $steps[] = ['action' => 'create_cache_dir', 'ok' => true];
        } else {
            $steps[] = ['action' => 'create_cache_dir', 'skipped' => 'already exists'];
        }

        // Fix 3: Ensure global_admins table exists
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS global_admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) DEFAULT NULL,
                is_active TINYINT(1) DEFAULT 1,
                last_login DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $steps[] = ['action' => 'ensure_global_admins', 'ok' => true];
        } catch (Throwable $e) {
            $steps[] = ['action' => 'ensure_global_admins', 'error' => $e->getMessage()];
        }

        // Cleanup: delete any orphan tenants from previous debug runs
        try {
            $deleted = $pdo->exec("DELETE FROM tenants WHERE email = 'debug@test.com'");
            $steps[] = ['action' => 'cleanup_debug_tenants', 'deleted' => $deleted];
        } catch (Throwable $e) {
            $steps[] = ['action' => 'cleanup_debug_tenants', 'error' => $e->getMessage()];
        }
    }

    if ($action === 'test') {
        // Full registration simulation
        $pdo->beginTransaction();
        try {
            $trialStart = date('Y-m-d');
            $trialEnd = date('Y-m-d', strtotime('+30 days'));
            $defaultModules = json_encode(['stores', 'kitchen', 'bar', 'admin']);

            $stmt = $pdo->prepare("INSERT INTO tenants (company_name, slug, email, phone, country, industry, status, trial_start, trial_end, plan, max_users, max_camps, modules) VALUES (?, ?, ?, ?, ?, ?, 'trial', ?, ?, 'trial', 5, 2, ?)");
            $stmt->execute(['Debug Lodge', 'debug-lodge-' . time(), 'debug@test.com', '', 'Kenya', 'Safari', $trialStart, $trialEnd, $defaultModules]);
            $tenantId = (int)$pdo->lastInsertId();
            $steps[] = ['action' => 'insert_tenant', 'ok' => true, 'id' => $tenantId];

            $stmt = $pdo->prepare("INSERT INTO camps (tenant_id, code, name, type, is_active) VALUES (?, 'HO', ?, 'head_office', 1)");
            $stmt->execute([$tenantId, 'Debug Lodge - Head Office']);
            $campId = (int)$pdo->lastInsertId();
            $steps[] = ['action' => 'insert_camp', 'ok' => true, 'id' => $campId];

            $hash = password_hash('TestPass2026', PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO users (tenant_id, name, username, password_hash, role, camp_id, approval_limit, is_active) VALUES (?, ?, ?, ?, 'admin', ?, 999999999, 1)");
            $stmt->execute([$tenantId, 'Debug User', 'debuguser' . time(), $hash, $campId]);
            $userId = (int)$pdo->lastInsertId();
            $steps[] = ['action' => 'insert_user', 'ok' => true, 'id' => $userId];

            $pdo->rollBack(); // Don't keep test data
            $steps[] = ['action' => 'rollback', 'ok' => true, 'note' => 'test data rolled back'];
        } catch (Throwable $e) {
            $pdo->rollBack();
            $steps[] = ['action' => 'error', 'error' => $e->getMessage()];
        }
    }

    echo json_encode(['action' => $action, 'steps' => $steps], JSON_PRETTY_PRINT);
    exit;
}

// GET: Diagnose
$results = [];
$results[] = ['tenants_rows' => (int)$pdo->query('SELECT COUNT(*) FROM tenants')->fetchColumn()];

$indexes = $pdo->query("SHOW INDEX FROM camps")->fetchAll(PDO::FETCH_ASSOC);
$indexNames = array_unique(array_column($indexes, 'Key_name'));
$results[] = ['camps_indexes' => array_values($indexNames)];

$cacheDir = __DIR__ . '/cache/rate-limits';
$results[] = ['cache_dir_exists' => is_dir($cacheDir), 'cache_dir_writable' => is_writable($cacheDir)];

echo json_encode($results, JSON_PRETTY_PRINT);
