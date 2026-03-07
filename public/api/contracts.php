<?php
/**
 * WebSquare — Employee Contracts
 * GET    /api/contracts.php           — paginated list (filter by status)
 * POST   /api/contracts.php           — create contract (manager+)
 * PUT    /api/contracts.php           — update contract (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Contracts ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $status  = $_GET['status'] ?? '';

    $where  = [];
    $params = [];
    tenantScope($where, $params, $tenantId, 'c');

    if ($status) {
        $where[] = 'c.status = ?';
        $params[] = $status;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    // Count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM contracts c
        {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $dataParams = $params;
    $dataParams[] = $perPage;
    $dataParams[] = $offset;

    $stmt = $pdo->prepare("
        SELECT c.id, c.employee_id, c.contract_type, c.start_date, c.end_date,
               c.salary, c.document_url, c.status, c.created_at,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               e.employee_no
        FROM contracts c
        JOIN hr_employees e ON c.employee_id = e.id
        {$whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($dataParams);
    $contracts = $stmt->fetchAll();

    jsonResponse([
        'contracts' => array_map(function ($c) {
            return [
                'id'            => (int) $c['id'],
                'employee_id'   => (int) $c['employee_id'],
                'employee_name' => $c['employee_name'],
                'employee_no'   => $c['employee_no'],
                'contract_type' => $c['contract_type'],
                'start_date'    => $c['start_date'],
                'end_date'      => $c['end_date'],
                'salary'        => $c['salary'] !== null ? (float) $c['salary'] : null,
                'document_url'  => $c['document_url'],
                'status'        => $c['status'],
                'created_at'    => $c['created_at'],
            ];
        }, $contracts),
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create Contract ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['employee_id', 'contract_type', 'start_date', 'salary']);

    $employeeId   = (int) $input['employee_id'];
    $contractType = $input['contract_type'];
    $salary       = (float) $input['salary'];

    // Verify employee belongs to tenant
    $empCheck = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $empCheck->execute([$employeeId, $tenantId]);
    if (!$empCheck->fetch()) {
        jsonError('Employee not found', 404);
    }

    // Validate contract_type
    $validTypes = ['permanent', 'fixed_term', 'casual', 'probation'];
    if (!in_array($contractType, $validTypes)) {
        jsonError('Invalid contract type', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO contracts (tenant_id, employee_id, contract_type, start_date, end_date, salary, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())
    ");
    $stmt->execute([
        $tenantId,
        $employeeId,
        $contractType,
        $input['start_date'],
        $input['end_date'] ?? null,
        $salary,
    ]);

    jsonResponse([
        'success' => true,
        'id'      => (int) $pdo->lastInsertId(),
        'message' => 'Contract created',
    ], 201);
    exit;
}

// ── PUT — Update Contract ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Contract ID required', 400);

    // Verify contract belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM contracts WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Contract not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = ['contract_type', 'start_date', 'end_date', 'salary', 'status', 'document_url'];

    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            if ($field === 'salary') {
                $updates[] = "{$field} = ?";
                $params[] = (float) $input[$field];
            } else {
                $updates[] = "{$field} = ?";
                $params[] = $input[$field];
            }
        }
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    // Validate contract_type if being changed
    if (isset($input['contract_type'])) {
        $validTypes = ['permanent', 'fixed_term', 'casual', 'probation'];
        if (!in_array($input['contract_type'], $validTypes)) {
            jsonError('Invalid contract type', 400);
        }
    }

    // Validate status if being changed
    if (isset($input['status'])) {
        $validStatuses = ['active', 'expired', 'terminated', 'pending'];
        if (!in_array($input['status'], $validStatuses)) {
            jsonError('Invalid status', 400);
        }
    }

    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE contracts SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Contract updated successfully']);
    exit;
}

jsonError('Method not allowed', 405);
