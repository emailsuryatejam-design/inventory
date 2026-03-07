<?php
/**
 * WebSquare — Payroll & HR Module: Database Migration
 * Creates all payroll/HR tables with tenant isolation.
 * Run once: GET /api/setup-payroll-tables.php?key=ws-payroll-2026
 */

require_once __DIR__ . '/config.php';

if (($_GET['key'] ?? '') !== 'ws-payroll-2026') {
    jsonError('Migration key required', 403);
}

$pdo = getDB();
$results = [];

// Helper: run SQL, catch errors
function runSQL($pdo, $label, $sql) {
    global $results;
    try {
        $pdo->exec($sql);
        $results[] = "$label — OK";
    } catch (PDOException $e) {
        $results[] = "$label — ERROR: " . $e->getMessage();
    }
}

// ── 1. Departments ──
runSQL($pdo, '1. departments', "
    CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) DEFAULT NULL,
        head_employee_id INT DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dept_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 2. Job Grades ──
runSQL($pdo, '2. job_grades', "
    CREATE TABLE IF NOT EXISTS job_grades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        level INT DEFAULT 1,
        min_salary DECIMAL(15,2) DEFAULT 0,
        max_salary DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_jg_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 3. Regions ──
runSQL($pdo, '3. regions', "
    CREATE TABLE IF NOT EXISTS hr_regions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) DEFAULT NULL,
        country VARCHAR(5) DEFAULT 'TZ',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reg_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 4. Shifts ──
runSQL($pdo, '4. shifts', "
    CREATE TABLE IF NOT EXISTS shifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        start_time TIME DEFAULT '08:00:00',
        end_time TIME DEFAULT '17:00:00',
        break_minutes INT DEFAULT 60,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_shift_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 5. HR Employees ──
runSQL($pdo, '5. hr_employees', "
    CREATE TABLE IF NOT EXISTS hr_employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_no VARCHAR(20) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) DEFAULT '',
        phone VARCHAR(30) DEFAULT '',
        department_id INT DEFAULT NULL,
        job_grade_id INT DEFAULT NULL,
        job_title VARCHAR(100) DEFAULT '',
        employment_type ENUM('full_time','part_time','contract','intern','casual') DEFAULT 'full_time',
        employment_status ENUM('active','inactive','on_leave','suspended','terminated') DEFAULT 'active',
        date_of_birth DATE DEFAULT NULL,
        gender ENUM('male','female','other') DEFAULT NULL,
        national_id VARCHAR(50) DEFAULT '',
        tax_pin VARCHAR(50) DEFAULT '',
        nssf_no VARCHAR(50) DEFAULT '',
        nhif_no VARCHAR(50) DEFAULT '',
        bank_name VARCHAR(100) DEFAULT '',
        bank_branch VARCHAR(100) DEFAULT '',
        bank_account VARCHAR(50) DEFAULT '',
        basic_salary DECIMAL(15,2) DEFAULT 0,
        hire_date DATE DEFAULT NULL,
        termination_date DATE DEFAULT NULL,
        profile_photo VARCHAR(255) DEFAULT NULL,
        camp_id INT DEFAULT NULL,
        region_id INT DEFAULT NULL,
        shift_id INT DEFAULT NULL,
        address TEXT DEFAULT NULL,
        emergency_contact VARCHAR(255) DEFAULT '',
        emergency_phone VARCHAR(30) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_hre_tenant (tenant_id),
        INDEX idx_hre_dept (department_id),
        INDEX idx_hre_status (employment_status),
        UNIQUE KEY uq_hre_empno (tenant_id, employee_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 6. Allowance Types ──
runSQL($pdo, '6. allowance_types', "
    CREATE TABLE IF NOT EXISTS allowance_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) DEFAULT NULL,
        is_taxable TINYINT(1) DEFAULT 1,
        is_fixed TINYINT(1) DEFAULT 1,
        default_amount DECIMAL(15,2) DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_at_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 7. Employee Allowances ──
runSQL($pdo, '7. employee_allowances', "
    CREATE TABLE IF NOT EXISTS employee_allowances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        allowance_type_id INT NOT NULL,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        effective_from DATE DEFAULT NULL,
        effective_to DATE DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ea_tenant (tenant_id),
        INDEX idx_ea_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 8. Deduction Types ──
runSQL($pdo, '8. deduction_types', "
    CREATE TABLE IF NOT EXISTS deduction_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) DEFAULT NULL,
        is_statutory TINYINT(1) DEFAULT 0,
        calculation_method ENUM('fixed','percentage','tiered') DEFAULT 'fixed',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_dt_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 9. Payroll Periods ──
runSQL($pdo, '9. payroll_periods', "
    CREATE TABLE IF NOT EXISTS payroll_periods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        period_type ENUM('monthly','bi_weekly','weekly') DEFAULT 'monthly',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        pay_date DATE NOT NULL,
        status ENUM('open','locked') DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pp_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 10. Payroll Runs ──
runSQL($pdo, '10. payroll_runs', "
    CREATE TABLE IF NOT EXISTS payroll_runs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        period_id INT NOT NULL,
        status ENUM('draft','review','approved','paid','cancelled') DEFAULT 'draft',
        employee_count INT DEFAULT 0,
        total_gross DECIMAL(15,2) DEFAULT 0,
        total_net DECIMAL(15,2) DEFAULT 0,
        total_deductions DECIMAL(15,2) DEFAULT 0,
        total_employer_cost DECIMAL(15,2) DEFAULT 0,
        created_by INT DEFAULT NULL,
        approved_by INT DEFAULT NULL,
        approved_at TIMESTAMP NULL DEFAULT NULL,
        paid_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pr_tenant (tenant_id),
        INDEX idx_pr_period (period_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 11. Payroll Items (per-employee line items) ──
runSQL($pdo, '11. payroll_items', "
    CREATE TABLE IF NOT EXISTS payroll_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        payroll_run_id INT NOT NULL,
        employee_id INT NOT NULL,
        basic_salary DECIMAL(15,2) DEFAULT 0,
        total_allowances DECIMAL(15,2) DEFAULT 0,
        gross_pay DECIMAL(15,2) DEFAULT 0,
        nssf_employee DECIMAL(15,2) DEFAULT 0,
        nssf_employer DECIMAL(15,2) DEFAULT 0,
        paye DECIMAL(15,2) DEFAULT 0,
        nhif DECIMAL(15,2) DEFAULT 0,
        housing_levy DECIMAL(15,2) DEFAULT 0,
        loan_deductions DECIMAL(15,2) DEFAULT 0,
        advance_deductions DECIMAL(15,2) DEFAULT 0,
        other_deductions DECIMAL(15,2) DEFAULT 0,
        total_deductions DECIMAL(15,2) DEFAULT 0,
        net_pay DECIMAL(15,2) DEFAULT 0,
        total_employer_cost DECIMAL(15,2) DEFAULT 0,
        overtime_hours DECIMAL(5,2) DEFAULT 0,
        overtime_pay DECIMAL(15,2) DEFAULT 0,
        absent_days INT DEFAULT 0,
        absent_deduction DECIMAL(15,2) DEFAULT 0,
        INDEX idx_pi_tenant (tenant_id),
        INDEX idx_pi_run (payroll_run_id),
        INDEX idx_pi_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 12. Leave Types ──
runSQL($pdo, '12. leave_types', "
    CREATE TABLE IF NOT EXISTS leave_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(10) DEFAULT NULL,
        default_days INT DEFAULT 21,
        is_paid TINYINT(1) DEFAULT 1,
        accrual_method ENUM('annual','monthly','none') DEFAULT 'annual',
        gender_restriction ENUM('all','male','female') DEFAULT 'all',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lt_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 13. Leave Requests ──
runSQL($pdo, '13. leave_requests', "
    CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        leave_type_id INT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days DECIMAL(4,1) DEFAULT 1,
        reason TEXT DEFAULT NULL,
        status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
        approved_by INT DEFAULT NULL,
        approved_at TIMESTAMP NULL DEFAULT NULL,
        rejection_reason TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lr_tenant (tenant_id),
        INDEX idx_lr_emp (employee_id),
        INDEX idx_lr_dates (start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 14. Loans ──
runSQL($pdo, '14. loans', "
    CREATE TABLE IF NOT EXISTS hr_loans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        loan_type ENUM('personal','salary_advance','emergency','education','housing','sacco','helb') DEFAULT 'personal',
        loan_source ENUM('company','sacco','bank','microfinance','other_institution') DEFAULT 'company',
        institution_name VARCHAR(200) DEFAULT '',
        external_reference VARCHAR(100) DEFAULT '',
        principal_amount DECIMAL(15,2) NOT NULL,
        interest_rate DECIMAL(5,2) DEFAULT 0,
        interest_type ENUM('flat','reducing') DEFAULT 'flat',
        repayment_months INT DEFAULT 12,
        monthly_deduction DECIMAL(15,2) DEFAULT 0,
        outstanding_balance DECIMAL(15,2) DEFAULT 0,
        status ENUM('pending','approved','active','completed','rejected','cancelled') DEFAULT 'pending',
        approved_by INT DEFAULT NULL,
        approved_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_loan_tenant (tenant_id),
        INDEX idx_loan_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 15. Loan Repayments ──
runSQL($pdo, '15. loan_repayments', "
    CREATE TABLE IF NOT EXISTS loan_repayments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        loan_id INT NOT NULL,
        due_date DATE NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        status ENUM('pending','paid','overdue') DEFAULT 'pending',
        paid_date DATE DEFAULT NULL,
        payroll_run_id INT DEFAULT NULL,
        INDEX idx_lrp_tenant (tenant_id),
        INDEX idx_lrp_loan (loan_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 16. Attendance ──
runSQL($pdo, '16. attendance', "
    CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        date DATE NOT NULL,
        clock_in TIME DEFAULT NULL,
        clock_out TIME DEFAULT NULL,
        hours_worked DECIMAL(4,2) DEFAULT 0,
        overtime DECIMAL(4,2) DEFAULT 0,
        status ENUM('present','absent','half_day','on_leave','holiday','rest_day') DEFAULT 'present',
        leave_type_id INT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        INDEX idx_att_tenant (tenant_id),
        INDEX idx_att_emp_date (employee_id, date),
        UNIQUE KEY uq_att_emp_date (tenant_id, employee_id, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 17. Salary Advances ──
runSQL($pdo, '17. salary_advances', "
    CREATE TABLE IF NOT EXISTS hr_salary_advances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        advance_date DATE NOT NULL,
        reason TEXT DEFAULT NULL,
        status ENUM('pending','approved','deducted','cancelled') DEFAULT 'pending',
        approved_by INT DEFAULT NULL,
        approved_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sa_tenant (tenant_id),
        INDEX idx_sa_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 18. Expense Claims ──
runSQL($pdo, '18. expense_claims', "
    CREATE TABLE IF NOT EXISTS expense_claims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        category ENUM('travel','meals','accommodation','transport','office_supplies','other') DEFAULT 'other',
        receipt_url VARCHAR(500) DEFAULT NULL,
        description TEXT DEFAULT NULL,
        status ENUM('pending','approved','rejected','reimbursed') DEFAULT 'pending',
        approved_by INT DEFAULT NULL,
        approved_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ec_tenant (tenant_id),
        INDEX idx_ec_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 19. Field Tracking ──
runSQL($pdo, '19. field_tracking', "
    CREATE TABLE IF NOT EXISTS field_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        date DATE NOT NULL,
        trip_type ENUM('field_visit','delivery','inspection','meeting','other') DEFAULT 'field_visit',
        travel_from VARCHAR(200) DEFAULT '',
        travel_to VARCHAR(200) DEFAULT '',
        distance_km DECIMAL(8,2) DEFAULT 0,
        allowance_amount DECIMAL(15,2) DEFAULT 0,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        notes TEXT DEFAULT NULL,
        approved_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ft_tenant (tenant_id),
        INDEX idx_ft_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 20. Contracts ──
runSQL($pdo, '20. contracts', "
    CREATE TABLE IF NOT EXISTS contracts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        employee_id INT NOT NULL,
        contract_type ENUM('permanent','fixed_term','probation','internship','casual') DEFAULT 'permanent',
        start_date DATE NOT NULL,
        end_date DATE DEFAULT NULL,
        salary DECIMAL(15,2) DEFAULT 0,
        document_url VARCHAR(500) DEFAULT NULL,
        status ENUM('active','expired','terminated','renewed') DEFAULT 'active',
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_con_tenant (tenant_id),
        INDEX idx_con_emp (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 21. Payroll Audit Log ──
runSQL($pdo, '21. payroll_audit_log', "
    CREATE TABLE IF NOT EXISTS payroll_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        user_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT DEFAULT NULL,
        details JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pal_tenant (tenant_id),
        INDEX idx_pal_entity (entity_type, entity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 22. Approval Workflows ──
runSQL($pdo, '22. approval_workflows', "
    CREATE TABLE IF NOT EXISTS approval_workflows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        entity_type ENUM('leave','loan','expense','salary_advance','payroll') NOT NULL,
        steps JSON DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_aw_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 23. Payslip Templates ──
runSQL($pdo, '23. payslip_templates', "
    CREATE TABLE IF NOT EXISTS payslip_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        template_html TEXT DEFAULT NULL,
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pt_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── 24. Document Templates (ID cards, intro letters) ──
runSQL($pdo, '24. document_templates', "
    CREATE TABLE IF NOT EXISTS document_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        type ENUM('id_card','intro_letter','contract','offer_letter') NOT NULL,
        name VARCHAR(100) NOT NULL,
        template_html TEXT DEFAULT NULL,
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_doctpl_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// ── Seed default leave types for all existing tenants ──
runSQL($pdo, '25. seed_leave_types', "
    INSERT IGNORE INTO leave_types (tenant_id, name, code, default_days, is_paid, accrual_method, gender_restriction)
    SELECT t.id, lt.name, lt.code, lt.default_days, lt.is_paid, lt.accrual_method, lt.gender_restriction
    FROM tenants t
    CROSS JOIN (
        SELECT 'Annual Leave' AS name, 'AL' AS code, 21 AS default_days, 1 AS is_paid, 'annual' AS accrual_method, 'all' AS gender_restriction
        UNION ALL SELECT 'Sick Leave', 'SL', 14, 1, 'annual', 'all'
        UNION ALL SELECT 'Maternity Leave', 'ML', 84, 1, 'none', 'female'
        UNION ALL SELECT 'Paternity Leave', 'PL', 14, 1, 'none', 'male'
        UNION ALL SELECT 'Compassionate Leave', 'CL', 5, 1, 'none', 'all'
        UNION ALL SELECT 'Unpaid Leave', 'UL', 30, 0, 'none', 'all'
    ) lt
");

jsonResponse([
    'message' => 'Payroll tables migration complete',
    'results' => $results,
]);
