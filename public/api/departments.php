<?php
/**
 * WebSquare — Departments
 * GET    /api/departments.php              — list departments for tenant
 * POST   /api/departments.php              — create department (manager+)
 * PUT    /api/departments.php              — update department (manager+)
 * DELETE /api/departments.php?id=X         — soft-deactivate department (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Departments ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $params = [];

    tenantScope($where, $params, $tenantId, 'd');

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $pdo->prepare("
        SELECT d.id, d.name, d.code, d.head_employee_id, d.is_active, d.created_at, d.updated_at,
               CONCAT(e.first_name, ' ', e.last_name) AS head_name
        FROM departments d
        LEFT JOIN hr_employees e ON d.head_employee_id = e.id
        {$whereClause}
        ORDER BY d.name ASC
    ");
    $stmt->execute($params);
    $departments = $stmt->fetchAll();

    jsonResponse([
        'departments' => array_map(function ($d) {
            return [
                'id' => (int) $d['id'],
                'name' => $d['name'],
                'code' => $d['code'],
                'head_employee_id' => $d['head_employee_id'] ? (int) $d['head_employee_id'] : null,
                'head_name' => $d['head_name'],
                'is_active' => (bool) $d['is_active'],
                'created_at' => $d['created_at'],
                'updated_at' => $d['updated_at'],
            ];
        }, $departments),
    ]);
    exit;
}

// ── POST — Create Department ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['name', 'code']);

    // Check code uniqueness within tenant
    $check = $pdo->prepare("SELECT id FROM departments WHERE code = ? AND tenant_id = ?");
    $check->execute([trim($input['code']), $tenantId]);
    if ($check->fetch()) {
        jsonError('A department with this code already exists', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO departments (tenant_id, name, code, head_employee_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, NOW(), NOW())
    ");
    $stmt->execute([
        $tenantId,
        trim($input['name']),
        trim($input['code']),
        $input['head_employee_id'] ?? null,
    ]);

    jsonResponse([
        'success' => true,
        'department' => [
            'id' => (int) $pdo->lastInsertId(),
            'name' => trim($input['name']),
            'code' => trim($input['code']),
        ],
    ], 201);
    exit;
}

// ── PUT — Update Department ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Department ID required', 400);

    // Verify department belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM departments WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Department not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = ['name', 'code', 'head_employee_id', 'is_active'];

    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
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

    // If code is being changed, validate uniqueness
    if (isset($input['code'])) {
        $dupCheck = $pdo->prepare("SELECT id FROM departments WHERE code = ? AND tenant_id = ? AND id != ?");
        $dupCheck->execute([trim($input['code']), $tenantId, $id]);
        if ($dupCheck->fetch()) {
            jsonError('A department with this code already exists', 400);
        }
    }

    $updates[] = 'updated_at = NOW()';
    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE departments SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Department updated successfully']);
    exit;
}

// ── DELETE — Soft-deactivate Department ──
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    requireManager();
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) jsonError('Department ID required', 400);

    // Verify department belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM departments WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Department not found', 404);
    }

    $stmt = $pdo->prepare("UPDATE departments SET is_active = 0, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);

    jsonResponse(['success' => true, 'message' => 'Department deactivated']);
    exit;
}

jsonError('Method not allowed', 405);
