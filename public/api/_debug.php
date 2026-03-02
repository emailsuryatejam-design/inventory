<?php
/**
 * Temporary debug/migration script.
 * GET  → diagnose tables
 * POST → run tenant migration
 * DELETE after testing!
 */
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    // ── RUN MIGRATION ──────────────────────────────────────
    $steps = [];

    // 1. Create tenants table
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tenants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50) DEFAULT NULL,
                country VARCHAR(100) DEFAULT NULL,
                industry VARCHAR(100) DEFAULT NULL,
                status ENUM('trial', 'active', 'suspended', 'expired') DEFAULT 'trial',
                trial_start DATE NOT NULL,
                trial_end DATE NOT NULL,
                plan VARCHAR(50) DEFAULT 'trial',
                max_users INT DEFAULT 5,
                max_camps INT DEFAULT 2,
                modules JSON DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_status (status),
                INDEX idx_email (email),
                INDEX idx_trial_end (trial_end)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $steps[] = ['action' => 'create_tenants_table', 'ok' => true];
    } catch (Throwable $e) {
        $steps[] = ['action' => 'create_tenants_table', 'error' => $e->getMessage()];
    }

    // 2. Create global_admins table
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS global_admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) DEFAULT NULL,
                is_active TINYINT(1) DEFAULT 1,
                last_login DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $steps[] = ['action' => 'create_global_admins_table', 'ok' => true];
    } catch (Throwable $e) {
        $steps[] = ['action' => 'create_global_admins_table', 'error' => $e->getMessage()];
    }

    // 3. Add tenant_id to users
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'tenant_id'")->fetchAll();
        if (empty($cols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN tenant_id INT DEFAULT NULL AFTER id");
            $pdo->exec("ALTER TABLE users ADD INDEX idx_tenant (tenant_id)");
            $steps[] = ['action' => 'add_users_tenant_id', 'ok' => true];
        } else {
            $steps[] = ['action' => 'add_users_tenant_id', 'skipped' => 'already exists'];
        }
    } catch (Throwable $e) {
        $steps[] = ['action' => 'add_users_tenant_id', 'error' => $e->getMessage()];
    }

    // 4. Add tenant_id to camps
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM camps LIKE 'tenant_id'")->fetchAll();
        if (empty($cols)) {
            $pdo->exec("ALTER TABLE camps ADD COLUMN tenant_id INT DEFAULT NULL AFTER id");
            $pdo->exec("ALTER TABLE camps ADD INDEX idx_camp_tenant (tenant_id)");
            $steps[] = ['action' => 'add_camps_tenant_id', 'ok' => true];
        } else {
            $steps[] = ['action' => 'add_camps_tenant_id', 'skipped' => 'already exists'];
        }
    } catch (Throwable $e) {
        $steps[] = ['action' => 'add_camps_tenant_id', 'error' => $e->getMessage()];
    }

    echo json_encode(['migration' => 'complete', 'steps' => $steps], JSON_PRETTY_PRINT);
    exit;
}

// ── GET: DIAGNOSE ──────────────────────────────────────────
$results = [];

// Check tenants table
try {
    $stmt = $pdo->query('DESCRIBE tenants');
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $results[] = ['table' => 'tenants', 'exists' => true, 'columns' => array_column($cols, 'Field')];
} catch (Throwable $e) {
    $results[] = ['table' => 'tenants', 'exists' => false, 'error' => $e->getMessage()];
}

// Check users.tenant_id
try {
    $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'tenant_id'")->fetchAll();
    $results[] = ['table' => 'users', 'has_tenant_id' => !empty($cols)];
} catch (Throwable $e) {
    $results[] = ['table' => 'users', 'error' => $e->getMessage()];
}

// Check camps.tenant_id
try {
    $cols = $pdo->query("SHOW COLUMNS FROM camps LIKE 'tenant_id'")->fetchAll();
    $results[] = ['table' => 'camps', 'has_tenant_id' => !empty($cols)];
} catch (Throwable $e) {
    $results[] = ['table' => 'camps', 'error' => $e->getMessage()];
}

echo json_encode(['diagnose' => $results, 'hint' => 'POST to this URL to run migration'], JSON_PRETTY_PRINT);
