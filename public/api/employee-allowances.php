<?php
/**
 * WebSquare — Employee Allowances
 * GET    /api/employee-allowances.php?employee_id=X  — list allowances for employee
 * POST   /api/employee-allowances.php                — create employee allowance (manager+)
 * PUT    /api/employee-allowances.php                — update allowance (manager+)
 * DELETE /api/employee-allowances.php?id=X           — remove allowance (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Employee Allowances ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $employeeId = (int) ($_GET['employee_id'] ?? 0);
    if (!$employeeId) jsonError('employee_id is required', 400);

    // Verify employee belongs to tenant
    $empCheck = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $empCheck->execute([$employeeId, $tenantId]);
    if (!$empCheck->fetch()) {
        jsonError('Employee not found', 404);
    }

    $stmt = $pdo->prepare("
        SELECT ea.id, ea.employee_id, ea.allowance_type_id, ea.amount,
               ea.effective_from, ea.effective_to, ea.is_active, ea.created_at,
               at.name AS allowance_type_name, at.code AS allowance_type_code,
               at.is_taxable, at.is_fixed
        FROM employee_allowances ea
        JOIN allowance_types at ON ea.allowance_type_id = at.id
        WHERE ea.employee_id = ? AND ea.tenant_id = ?
        ORDER BY ea.is_active DESC, at.name ASC
    ");
    $stmt->execute([$employeeId, $tenantId]);
    $allowances = $stmt->fetchAll();

    jsonResponse([
        'allowances' => array_map(function ($a) {
            return [
                'id' => (int) $a['id'],
                'employee_id' => (int) $a['employee_id'],
                'allowance_type_id' => (int) $a['allowance_type_id'],
                'allowance_type_name' => $a['allowance_type_name'],
                'allowance_type_code' => $a['allowance_type_code'],
                'is_taxable' => (bool) $a['is_taxable'],
                'is_fixed' => (bool) $a['is_fixed'],
                'amount' => (float) $a['amount'],
                'effective_from' => $a['effective_from'],
                'effective_to' => $a['effective_to'],
                'is_active' => (bool) $a['is_active'],
                'created_at' => $a['created_at'],
            ];
        }, $allowances),
    ]);
    exit;
}

// ── POST — Create Employee Allowance ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['employee_id', 'allowance_type_id', 'amount']);

    // Verify employee belongs to tenant
    $empCheck = $pdo->prepare("SELECT id FROM hr_employees WHERE id = ? AND tenant_id = ?");
    $empCheck->execute([(int) $input['employee_id'], $tenantId]);
    if (!$empCheck->fetch()) {
        jsonError('Employee not found', 404);
    }

    // Verify allowance type belongs to tenant
    $typeCheck = $pdo->prepare("SELECT id FROM allowance_types WHERE id = ? AND tenant_id = ?");
    $typeCheck->execute([(int) $input['allowance_type_id'], $tenantId]);
    if (!$typeCheck->fetch()) {
        jsonError('Allowance type not found', 404);
    }

    $stmt = $pdo->prepare("
        INSERT INTO employee_allowances (tenant_id, employee_id, allowance_type_id, amount, effective_from, effective_to, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
    ");
    $stmt->execute([
        $tenantId,
        (int) $input['employee_id'],
        (int) $input['allowance_type_id'],
        (float) $input['amount'],
        $input['effective_from'] ?? null,
        $input['effective_to'] ?? null,
    ]);

    jsonResponse([
        'success' => true,
        'allowance' => [
            'id' => (int) $pdo->lastInsertId(),
        ],
    ], 201);
    exit;
}

// ── PUT — Update Employee Allowance ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Allowance ID required', 400);

    // Verify belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM employee_allowances WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Allowance not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = ['amount', 'effective_from', 'effective_to', 'is_active', 'allowance_type_id'];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $input)) {
            if ($field === 'is_active') {
                $updates[] = "{$field} = ?";
                $params[] = $input[$field] ? 1 : 0;
            } else {
                $updates[] = "{$field} = ?";
                $params[] = $input[$field];
            }
        }
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE employee_allowances SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Allowance updated successfully']);
    exit;
}

// ── DELETE — Remove Employee Allowance ──
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    requireManager();
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) jsonError('Allowance ID required', 400);

    // Verify belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM employee_allowances WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Allowance not found', 404);
    }

    $stmt = $pdo->prepare("DELETE FROM employee_allowances WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);

    jsonResponse(['success' => true, 'message' => 'Allowance removed']);
    exit;
}

jsonError('Method not allowed', 405);
