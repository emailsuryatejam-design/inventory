<?php
/**
 * WebSquare — HR Employees
 * GET    /api/hr-employees.php              — paginated list with search/filter
 * POST   /api/hr-employees.php              — create employee (manager+)
 * PUT    /api/hr-employees.php              — update employee (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Employees ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 25)));
    $offset = ($page - 1) * $perPage;
    $search = trim($_GET['search'] ?? '');
    $departmentId = $_GET['department_id'] ?? '';
    $status = $_GET['employment_status'] ?? '';

    $where = [];
    $params = [];

    tenantScope($where, $params, $tenantId, 'e');

    if ($search) {
        $where[] = '(e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_no LIKE ?)';
        $searchParam = "%{$search}%";
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
    }

    if ($departmentId) {
        $where[] = 'e.department_id = ?';
        $params[] = (int) $departmentId;
    }

    if ($status) {
        $where[] = 'e.employment_status = ?';
        $params[] = $status;
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Total count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM hr_employees e {$whereClause}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Fetch employees with department + job grade names
    $sql = "
        SELECT e.id, e.employee_no, e.first_name, e.last_name, e.email, e.phone,
               e.job_title, e.employment_type, e.employment_status, e.hire_date,
               e.basic_salary, e.profile_photo,
               d.name AS department_name,
               jg.name AS job_grade_name
        FROM hr_employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN job_grades jg ON e.job_grade_id = jg.id
        {$whereClause}
        ORDER BY e.first_name ASC, e.last_name ASC
        LIMIT ? OFFSET ?
    ";
    $stmt = $pdo->prepare($sql);
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $employees = $stmt->fetchAll();

    // Also fetch departments for filter dropdown
    $deptStmt = $pdo->prepare("SELECT id, name FROM departments WHERE tenant_id = ? AND is_active = 1 ORDER BY name");
    $deptStmt->execute([$tenantId]);
    $departments = $deptStmt->fetchAll();

    jsonResponse([
        'employees' => array_map(function ($e) {
            return [
                'id' => (int) $e['id'],
                'employee_no' => $e['employee_no'],
                'first_name' => $e['first_name'],
                'last_name' => $e['last_name'],
                'email' => $e['email'],
                'phone' => $e['phone'],
                'job_title' => $e['job_title'],
                'employment_type' => $e['employment_type'],
                'employment_status' => $e['employment_status'],
                'hire_date' => $e['hire_date'],
                'basic_salary' => $e['basic_salary'] ? (float) $e['basic_salary'] : null,
                'profile_photo' => $e['profile_photo'],
                'department_name' => $e['department_name'],
                'job_grade_name' => $e['job_grade_name'],
            ];
        }, $employees),
        'departments' => array_map(function ($d) {
            return ['id' => (int) $d['id'], 'name' => $d['name']];
        }, $departments),
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create Employee ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['first_name', 'last_name']);

    // Auto-generate employee_no: EMP-XXXX
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM hr_employees WHERE tenant_id = ?");
    $countStmt->execute([$tenantId]);
    $nextNum = (int) $countStmt->fetchColumn() + 1;
    $employeeNo = $input['employee_no'] ?? ('EMP-' . str_pad($nextNum, 4, '0', STR_PAD_LEFT));

    // Check employee_no uniqueness
    $check = $pdo->prepare("SELECT id FROM hr_employees WHERE employee_no = ? AND tenant_id = ?");
    $check->execute([$employeeNo, $tenantId]);
    if ($check->fetch()) {
        // Generate a unique one
        $maxStmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(employee_no, 5) AS UNSIGNED)) FROM hr_employees WHERE tenant_id = ? AND employee_no LIKE 'EMP-%'");
        $maxStmt->execute([$tenantId]);
        $maxNum = (int) $maxStmt->fetchColumn() + 1;
        $employeeNo = 'EMP-' . str_pad($maxNum, 4, '0', STR_PAD_LEFT);
    }

    $stmt = $pdo->prepare("
        INSERT INTO hr_employees (
            tenant_id, employee_no, first_name, last_name, email, phone,
            department_id, job_grade_id, job_title, employment_type, employment_status,
            date_of_birth, gender, national_id, tax_pin, nssf_no, nhif_no,
            bank_name, bank_branch, bank_account, basic_salary, hire_date,
            profile_photo, camp_id, region_id, shift_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ");
    $stmt->execute([
        $tenantId,
        $employeeNo,
        trim($input['first_name']),
        trim($input['last_name']),
        $input['email'] ?? null,
        $input['phone'] ?? null,
        $input['department_id'] ?? null,
        $input['job_grade_id'] ?? null,
        $input['job_title'] ?? null,
        $input['employment_type'] ?? 'permanent',
        $input['employment_status'] ?? 'active',
        $input['date_of_birth'] ?? null,
        $input['gender'] ?? null,
        $input['national_id'] ?? null,
        $input['tax_pin'] ?? null,
        $input['nssf_no'] ?? null,
        $input['nhif_no'] ?? null,
        $input['bank_name'] ?? null,
        $input['bank_branch'] ?? null,
        $input['bank_account'] ?? null,
        $input['basic_salary'] ?? null,
        $input['hire_date'] ?? null,
        $input['profile_photo'] ?? null,
        $input['camp_id'] ?? null,
        $input['region_id'] ?? null,
        $input['shift_id'] ?? null,
    ]);

    jsonResponse([
        'success' => true,
        'employee' => [
            'id' => (int) $pdo->lastInsertId(),
            'employee_no' => $employeeNo,
            'first_name' => trim($input['first_name']),
            'last_name' => trim($input['last_name']),
        ],
    ], 201);
    exit;
}

// ── PUT — Update Employee ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Employee ID required', 400);

    // Verify belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Employee not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = [
        'first_name', 'last_name', 'email', 'phone',
        'department_id', 'job_grade_id', 'job_title', 'employment_type', 'employment_status',
        'date_of_birth', 'gender', 'national_id', 'tax_pin', 'nssf_no', 'nhif_no',
        'bank_name', 'bank_branch', 'bank_account', 'basic_salary', 'hire_date',
        'termination_date', 'profile_photo', 'camp_id', 'region_id', 'shift_id',
        'user_id', 'annual_leave_days',
    ];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $input)) {
            $updates[] = "{$field} = ?";
            $params[] = $input[$field];
        }
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $updates[] = 'updated_at = NOW()';
    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE hr_employees SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Employee updated successfully']);
    exit;
}

jsonError('Method not allowed', 405);
