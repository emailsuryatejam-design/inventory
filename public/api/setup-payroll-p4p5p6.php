<?php
/**
 * WebSquare — P4+P5+P6 Migration
 * Creates tables for: document templates, approval workflows,
 * trip allowances, transfers, M-Pesa, SMS
 * Run once via browser: /api/setup-payroll-p4p5p6.php
 */

require_once __DIR__ . '/middleware.php';
$auth = requireAuth();
requireAdmin();
$pdo = getDB();

$results = [];

// ── document_templates ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS document_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT DEFAULT NULL,
        name VARCHAR(200) NOT NULL,
        type ENUM('id_card','intro_letter','contract') DEFAULT 'id_card',
        category VARCHAR(100) DEFAULT 'general',
        html_content LONGTEXT DEFAULT NULL,
        back_html_content LONGTEXT DEFAULT NULL,
        is_custom TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_type (tenant_id, type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'document_templates: OK';
} catch (Exception $e) { $results[] = 'document_templates: ' . $e->getMessage(); }

// ── document_generations (audit log) ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS document_generations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        template_id INT NOT NULL,
        employee_id INT NOT NULL,
        generated_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant (tenant_id),
        INDEX idx_employee (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'document_generations: OK';
} catch (Exception $e) { $results[] = 'document_generations: ' . $e->getMessage(); }

// ── employee_documents ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS employee_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        document_type VARCHAR(50) DEFAULT 'other',
        title VARCHAR(200) NOT NULL,
        file_url VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_emp (tenant_id, employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'employee_documents: OK';
} catch (Exception $e) { $results[] = 'employee_documents: ' . $e->getMessage(); }

// ── employee_contracts ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS employee_contracts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        template_id INT DEFAULT NULL,
        contract_type VARCHAR(100) DEFAULT 'permanent',
        start_date DATE DEFAULT NULL,
        end_date DATE DEFAULT NULL,
        status ENUM('draft','active','expired','terminated') DEFAULT 'draft',
        field_overrides JSON DEFAULT NULL,
        pdf_url VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_emp (tenant_id, employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'employee_contracts: OK';
} catch (Exception $e) { $results[] = 'employee_contracts: ' . $e->getMessage(); }

// ── approval_workflows ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS approval_workflows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(50) DEFAULT 'leave',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_type (tenant_id, type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'approval_workflows: OK';
} catch (Exception $e) { $results[] = 'approval_workflows: ' . $e->getMessage(); }

// ── approval_steps ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS approval_steps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workflow_id INT NOT NULL,
        step_order INT DEFAULT 1,
        approver_type ENUM('specific_user','department_head','region_manager','role') DEFAULT 'role',
        approver_id INT DEFAULT NULL,
        approver_role VARCHAR(50) DEFAULT '',
        label VARCHAR(200) DEFAULT '',
        INDEX idx_workflow (workflow_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'approval_steps: OK';
} catch (Exception $e) { $results[] = 'approval_steps: ' . $e->getMessage(); }

// ── approval_requests ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS approval_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        workflow_id INT NOT NULL,
        current_step_id INT NOT NULL,
        reference_type VARCHAR(50) DEFAULT '',
        reference_id INT DEFAULT NULL,
        submitted_by INT DEFAULT NULL,
        description TEXT DEFAULT NULL,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_status (tenant_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'approval_requests: OK';
} catch (Exception $e) { $results[] = 'approval_requests: ' . $e->getMessage(); }

// ── approval_actions ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS approval_actions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        step_id INT NOT NULL,
        user_id INT NOT NULL,
        decision ENUM('approved','rejected') NOT NULL,
        comment TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_request (request_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'approval_actions: OK';
} catch (Exception $e) { $results[] = 'approval_actions: ' . $e->getMessage(); }

// ── trip_allowances ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS trip_allowances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        region_id INT DEFAULT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INT DEFAULT 1,
        daily_rate DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        purpose TEXT DEFAULT NULL,
        components JSON DEFAULT NULL,
        status ENUM('pending','approved','rejected','paid') DEFAULT 'pending',
        created_by INT DEFAULT NULL,
        approved_by INT DEFAULT NULL,
        approved_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_emp (tenant_id, employee_id),
        INDEX idx_status (tenant_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'trip_allowances: OK';
} catch (Exception $e) { $results[] = 'trip_allowances: ' . $e->getMessage(); }

// ── employee_transfers ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS employee_transfers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        from_department_id INT DEFAULT NULL,
        to_department_id INT DEFAULT NULL,
        from_region_id INT DEFAULT NULL,
        to_region_id INT DEFAULT NULL,
        effective_date DATE NOT NULL,
        reason TEXT DEFAULT NULL,
        transferred_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_emp (tenant_id, employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'employee_transfers: OK';
} catch (Exception $e) { $results[] = 'employee_transfers: ' . $e->getMessage(); }

// ── field_visits ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS field_visits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        client_name VARCHAR(200) DEFAULT '',
        purpose TEXT DEFAULT NULL,
        check_in_time DATETIME DEFAULT NULL,
        check_in_lat DECIMAL(10,7) DEFAULT NULL,
        check_in_lon DECIMAL(10,7) DEFAULT NULL,
        check_out_time DATETIME DEFAULT NULL,
        check_out_lat DECIMAL(10,7) DEFAULT NULL,
        check_out_lon DECIMAL(10,7) DEFAULT NULL,
        distance_km DECIMAL(10,2) DEFAULT 0,
        notes TEXT DEFAULT NULL,
        outcome VARCHAR(100) DEFAULT '',
        status ENUM('in_progress','completed','cancelled') DEFAULT 'in_progress',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_emp (tenant_id, employee_id),
        INDEX idx_date (tenant_id, check_in_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'field_visits: OK';
} catch (Exception $e) { $results[] = 'field_visits: ' . $e->getMessage(); }

// ── payslip_templates ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS payslip_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(200) DEFAULT 'Default',
        layout VARCHAR(50) DEFAULT 'standard',
        show_employer TINYINT(1) DEFAULT 1,
        show_ytd TINYINT(1) DEFAULT 0,
        show_loans TINYINT(1) DEFAULT 0,
        show_leave TINYINT(1) DEFAULT 0,
        show_bank TINYINT(1) DEFAULT 0,
        show_tax TINYINT(1) DEFAULT 1,
        password_type VARCHAR(50) DEFAULT 'id_number',
        header_text TEXT DEFAULT NULL,
        footer_text TEXT DEFAULT NULL,
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'payslip_templates: OK';
} catch (Exception $e) { $results[] = 'payslip_templates: ' . $e->getMessage(); }

// ── bank_details ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS bank_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        bank_name VARCHAR(200) DEFAULT '',
        bank_code VARCHAR(50) DEFAULT '',
        branch_name VARCHAR(200) DEFAULT '',
        branch_code VARCHAR(50) DEFAULT '',
        account_number VARCHAR(100) DEFAULT '',
        account_name VARCHAR(200) DEFAULT '',
        is_primary TINYINT(1) DEFAULT 1,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_emp (tenant_id, employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'bank_details: OK';
} catch (Exception $e) { $results[] = 'bank_details: ' . $e->getMessage(); }

// ── mpesa_transactions ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS mpesa_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        phone VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) DEFAULT 0,
        reference VARCHAR(200) DEFAULT '',
        response_code VARCHAR(20) DEFAULT '',
        conversation_id VARCHAR(200) DEFAULT '',
        status ENUM('queued','pending','completed','failed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'mpesa_transactions: OK';
} catch (Exception $e) { $results[] = 'mpesa_transactions: ' . $e->getMessage(); }

// ── sms_logs ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS sms_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        phone VARCHAR(50) NOT NULL,
        message TEXT DEFAULT NULL,
        status ENUM('sent','failed') DEFAULT 'sent',
        response TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'sms_logs: OK';
} catch (Exception $e) { $results[] = 'sms_logs: ' . $e->getMessage(); }

// ── tenant_settings (for M-Pesa/SMS config) ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS tenant_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT DEFAULT NULL,
        UNIQUE KEY uk_tenant_key (tenant_id, setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'tenant_settings: OK';
} catch (Exception $e) { $results[] = 'tenant_settings: ' . $e->getMessage(); }

// ── Add region_id to hr_employees if missing ──
try {
    $pdo->query("SELECT region_id FROM hr_employees LIMIT 0");
    $results[] = 'hr_employees.region_id: already exists';
} catch (Exception $e) {
    try {
        $pdo->exec("ALTER TABLE hr_employees ADD COLUMN region_id INT DEFAULT NULL");
        $results[] = 'hr_employees.region_id: added';
    } catch (Exception $e2) {
        $results[] = 'hr_employees.region_id: ' . $e2->getMessage();
    }
}

// ── Add companies table if missing (for multi-tenant company info) ──
try {
    $pdo->query("SELECT is_primary FROM companies LIMIT 0");
    $results[] = 'companies: already exists';
} catch (Exception $e) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS companies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            name VARCHAR(200) NOT NULL,
            trading_name VARCHAR(200) DEFAULT NULL,
            address VARCHAR(500) DEFAULT '',
            city VARCHAR(100) DEFAULT '',
            phone VARCHAR(50) DEFAULT '',
            email VARCHAR(200) DEFAULT '',
            logo_url VARCHAR(500) DEFAULT NULL,
            currency VARCHAR(10) DEFAULT 'KES',
            country VARCHAR(10) DEFAULT 'KE',
            is_primary TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $results[] = 'companies: created';
    } catch (Exception $e2) {
        $results[] = 'companies: ' . $e2->getMessage();
    }
}

jsonResponse(['results' => $results, 'status' => 'P4+P5+P6 migration complete']);
