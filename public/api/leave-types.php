<?php
/**
 * WebSquare — Leave Types
 * GET    /api/leave-types.php       — list all leave types
 * POST   /api/leave-types.php       — create leave type
 * PUT    /api/leave-types.php       — update leave type
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List leave types ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $params = [];
    tenantScope($where, $params, $tenantId);

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $stmt = $pdo->prepare("
        SELECT id, name, code, default_days, is_paid, accrual_method,
               gender_restriction, is_active, created_at
        FROM leave_types
        {$whereClause}
        ORDER BY name ASC
    ");
    $stmt->execute($params);
    $types = $stmt->fetchAll();

    jsonResponse([
        'leave_types' => array_map(function ($t) {
            return [
                'id'                 => (int) $t['id'],
                'name'               => $t['name'],
                'code'               => $t['code'],
                'default_days'       => (int) $t['default_days'],
                'is_paid'            => (bool) $t['is_paid'],
                'accrual_method'     => $t['accrual_method'],
                'gender_restriction' => $t['gender_restriction'],
                'is_active'          => (bool) $t['is_active'],
            ];
        }, $types),
    ]);
    exit;
}

// ── POST — Create leave type ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['name', 'code']);

    $stmt = $pdo->prepare("
        INSERT INTO leave_types (tenant_id, name, code, default_days, is_paid, accrual_method, gender_restriction, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $tenantId,
        trim($input['name']),
        strtoupper(trim($input['code'])),
        (int) ($input['default_days'] ?? 0),
        (int) ($input['is_paid'] ?? 1),
        $input['accrual_method'] ?? 'annual',
        $input['gender_restriction'] ?? null,
        (int) ($input['is_active'] ?? 1),
    ]);

    $id = (int) $pdo->lastInsertId();

    jsonResponse([
        'success' => true,
        'id'      => $id,
        'message' => 'Leave type created',
    ], 201);
    exit;
}

// ── PUT — Update leave type ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['id']);

    $id = (int) $input['id'];

    // Verify leave type belongs to tenant
    $check = $pdo->prepare("SELECT id FROM leave_types WHERE id = ? AND tenant_id = ?");
    $check->execute([$id, $tenantId]);
    if (!$check->fetch()) {
        jsonError('Leave type not found', 404);
    }

    $fields = [];
    $params = [];
    $allowed = ['name', 'code', 'default_days', 'is_paid', 'accrual_method', 'gender_restriction', 'is_active'];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $input)) {
            $fields[] = "{$field} = ?";
            $value = $input[$field];
            if ($field === 'code') $value = strtoupper(trim($value));
            if ($field === 'name') $value = trim($value);
            $params[] = $value;
        }
    }

    if (empty($fields)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $id;
    $params[] = $tenantId;

    $pdo->prepare("
        UPDATE leave_types SET " . implode(', ', $fields) . "
        WHERE id = ? AND tenant_id = ?
    ")->execute($params);

    jsonResponse(['success' => true, 'message' => 'Leave type updated']);
    exit;
}

jsonError('Method not allowed', 405);
