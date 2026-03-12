<?php
/**
 * WebSquare — Bulk Import API (P4)
 * Ported from KaziPay bulkImport.service.js
 * CSV import for employees with validation
 */

require_once __DIR__ . '/middleware.php';
$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $auth['id'] ?? 0;
$userRole = $auth['role'] ?? '';

if (!in_array($userRole, ['admin', 'director'])) {
    jsonError('Access denied', 403);
}

$action = $_GET['action'] ?? '';

switch ($action) {

// ── CSV Template download ──
case 'template':
    $entity = $_GET['entity'] ?? 'employees';

    $headers = [];
    switch ($entity) {
        case 'employees':
            $headers = ['first_name','last_name','email','phone','id_number','tax_pin','nssf_no','nhif_no','employee_no','basic_salary','job_title','department','job_grade','join_date','date_of_birth','gender','marital_status','address','city','payment_method','bank_name','bank_code','branch_name','account_number','account_name'];
            break;
        default:
            jsonError("Unknown entity: $entity");
    }

    header('Content-Type: text/csv');
    header("Content-Disposition: attachment; filename=\"{$entity}_import_template.csv\"");
    echo implode(',', $headers) . "\n";
    exit;

// ── Validate CSV (dry run) ──
case 'validate':
    if (!isset($_FILES['file'])) jsonError('CSV file required');

    $file = $_FILES['file'];
    $entity = $_POST['entity'] ?? 'employees';

    if ($entity !== 'employees') jsonError("Unsupported entity: $entity");

    $handle = fopen($file['tmp_name'], 'r');
    if (!$handle) jsonError('Failed to read file');

    $headers = fgetcsv($handle);
    if (!$headers) jsonError('Empty CSV file');
    $headers = array_map('strtolower', array_map('trim', $headers));

    $required = ['first_name', 'last_name', 'email', 'basic_salary'];
    $missing = array_diff($required, $headers);
    if (!empty($missing)) {
        fclose($handle);
        jsonError('Missing required columns: ' . implode(', ', $missing));
    }

    // Pre-load departments and job grades for name→id resolution
    $deptMap = [];
    $stmt = $pdo->prepare("SELECT id, LOWER(name) AS name FROM departments WHERE tenant_id = ?");
    $stmt->execute([$tenantId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $d) {
        $deptMap[$d['name']] = $d['id'];
    }

    $gradeMap = [];
    $stmt = $pdo->prepare("SELECT id, LOWER(name) AS name FROM job_grades WHERE tenant_id = ?");
    $stmt->execute([$tenantId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $g) {
        $gradeMap[$g['name']] = $g['id'];
    }

    $rows = [];
    $errors = [];
    $rowNum = 1;

    while (($line = fgetcsv($handle)) !== false) {
        $rowNum++;
        if (count($line) !== count($headers)) {
            $errors[] = "Row $rowNum: Column count mismatch";
            continue;
        }

        $row = array_combine($headers, $line);
        $rowErrors = [];

        if (empty(trim($row['first_name'] ?? ''))) $rowErrors[] = 'first_name is required';
        if (empty(trim($row['last_name'] ?? ''))) $rowErrors[] = 'last_name is required';
        if (empty(trim($row['email'] ?? ''))) $rowErrors[] = 'email is required';
        if (empty($row['basic_salary']) || !is_numeric($row['basic_salary'])) $rowErrors[] = 'basic_salary must be numeric';

        // Resolve department
        if (!empty($row['department'])) {
            $deptKey = strtolower(trim($row['department']));
            if (!isset($deptMap[$deptKey])) {
                $rowErrors[] = "Department '{$row['department']}' not found";
            } else {
                $row['department_id'] = $deptMap[$deptKey];
            }
        }

        // Resolve job grade
        if (!empty($row['job_grade'])) {
            $gradeKey = strtolower(trim($row['job_grade']));
            if (!isset($gradeMap[$gradeKey])) {
                $rowErrors[] = "Job grade '{$row['job_grade']}' not found";
            } else {
                $row['job_grade_id'] = $gradeMap[$gradeKey];
            }
        }

        if (!empty($rowErrors)) {
            $errors[] = "Row $rowNum: " . implode('; ', $rowErrors);
        }

        $rows[] = $row;
    }
    fclose($handle);

    jsonResponse([
        'valid'      => empty($errors),
        'total_rows' => count($rows),
        'errors'     => $errors,
        'preview'    => array_slice($rows, 0, 5),
    ]);

// ── Execute import ──
case 'import':
    if (!isset($_FILES['file'])) jsonError('CSV file required');

    $file = $_FILES['file'];
    $entity = $_POST['entity'] ?? 'employees';

    if ($entity !== 'employees') jsonError("Unsupported entity: $entity");

    $handle = fopen($file['tmp_name'], 'r');
    $headers = array_map('strtolower', array_map('trim', fgetcsv($handle)));

    // Pre-load maps
    $deptMap = [];
    $stmt = $pdo->prepare("SELECT id, LOWER(name) AS name FROM departments WHERE tenant_id = ?");
    $stmt->execute([$tenantId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $d) $deptMap[$d['name']] = $d['id'];

    $gradeMap = [];
    $stmt = $pdo->prepare("SELECT id, LOWER(name) AS name FROM job_grades WHERE tenant_id = ?");
    $stmt->execute([$tenantId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $g) $gradeMap[$g['name']] = $g['id'];

    // Get next employee number
    $stmt = $pdo->prepare("SELECT MAX(CAST(SUBSTRING(employee_no, 4) AS UNSIGNED)) AS max_no FROM hr_employees WHERE tenant_id = ? AND employee_no LIKE 'EMP%'");
    $stmt->execute([$tenantId]);
    $maxNo = $stmt->fetch(PDO::FETCH_ASSOC)['max_no'] ?? 0;
    $nextNo = $maxNo + 1;

    $imported = 0;
    $errors = [];
    $rowNum = 1;

    $pdo->beginTransaction();
    try {
        while (($line = fgetcsv($handle)) !== false) {
            $rowNum++;
            if (count($line) !== count($headers)) {
                $errors[] = "Row $rowNum: Column count mismatch";
                continue;
            }
            $row = array_combine($headers, $line);

            // Skip invalid
            if (empty(trim($row['first_name'] ?? '')) || empty(trim($row['email'] ?? ''))) {
                $errors[] = "Row $rowNum: Missing required fields";
                continue;
            }

            // Generate employee number if not provided
            $empNo = trim($row['employee_no'] ?? '');
            if (empty($empNo)) {
                $empNo = 'EMP' . str_pad($nextNo++, 4, '0', STR_PAD_LEFT);
            }

            // Resolve department/grade
            $deptId = null;
            if (!empty($row['department'])) {
                $deptId = $deptMap[strtolower(trim($row['department']))] ?? null;
            }
            $gradeId = null;
            if (!empty($row['job_grade'])) {
                $gradeId = $gradeMap[strtolower(trim($row['job_grade']))] ?? null;
            }

            try {
                $pdo->prepare("
                    INSERT INTO hr_employees (tenant_id, employee_no, first_name, last_name, email, phone,
                        id_number, tax_pin, nssf_no, nhif_no, basic_salary, job_title,
                        department_id, job_grade_id, join_date, date_of_birth, gender,
                        marital_status, address, city, payment_method, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
                ")->execute([
                    $tenantId, $empNo,
                    trim($row['first_name']), trim($row['last_name']),
                    trim($row['email']), trim($row['phone'] ?? ''),
                    trim($row['id_number'] ?? ''), trim($row['tax_pin'] ?? ''),
                    trim($row['nssf_no'] ?? ''), trim($row['nhif_no'] ?? ''),
                    floatval($row['basic_salary'] ?? 0), trim($row['job_title'] ?? ''),
                    $deptId, $gradeId,
                    $row['join_date'] ?? null, $row['date_of_birth'] ?? null,
                    trim($row['gender'] ?? ''), trim($row['marital_status'] ?? ''),
                    trim($row['address'] ?? ''), trim($row['city'] ?? ''),
                    trim($row['payment_method'] ?? 'bank_transfer'),
                ]);

                $employeeId = $pdo->lastInsertId();

                // Insert bank details if provided
                if (!empty($row['account_number'])) {
                    $pdo->prepare("
                        INSERT INTO bank_details (tenant_id, employee_id, bank_name, bank_code, branch_name, account_number, account_name, is_primary)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                    ")->execute([
                        $tenantId, $employeeId,
                        trim($row['bank_name'] ?? ''), trim($row['bank_code'] ?? ''),
                        trim($row['branch_name'] ?? ''), trim($row['account_number']),
                        trim($row['account_name'] ?? ($row['first_name'] . ' ' . $row['last_name'])),
                    ]);
                }

                $imported++;
            } catch (Exception $e) {
                $errors[] = "Row $rowNum: " . $e->getMessage();
            }
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Import failed: ' . $e->getMessage());
    }

    fclose($handle);

    jsonResponse([
        'imported'   => $imported,
        'errors'     => $errors,
        'total_rows' => $rowNum - 1,
    ]);

default:
    jsonError('Invalid action. Use: template, validate, import');
}
