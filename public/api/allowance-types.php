<?php
/**
 * WebSquare — Allowance Types
 * GET    /api/allowance-types.php          — list allowance types for tenant
 * POST   /api/allowance-types.php          — create allowance type (manager+)
 * PUT    /api/allowance-types.php          — update allowance type (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Allowance Types ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $params = [];

    tenantScope($where, $params, $tenantId, 'at');

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $pdo->prepare("
        SELECT at.id, at.name, at.code, at.is_taxable, at.is_fixed, at.default_amount, at.created_at
        FROM allowance_types at
        {$whereClause}
        ORDER BY at.name ASC
    ");
    $stmt->execute($params);
    $types = $stmt->fetchAll();

    jsonResponse([
        'allowance_types' => array_map(function ($t) {
            return [
                'id' => (int) $t['id'],
                'name' => $t['name'],
                'code' => $t['code'],
                'is_taxable' => (bool) $t['is_taxable'],
                'is_fixed' => (bool) $t['is_fixed'],
                'default_amount' => $t['default_amount'] ? (float) $t['default_amount'] : null,
                'created_at' => $t['created_at'],
            ];
        }, $types),
    ]);
    exit;
}

// ── POST — Create Allowance Type ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['name', 'code']);

    // Check code uniqueness
    $check = $pdo->prepare("SELECT id FROM allowance_types WHERE code = ? AND tenant_id = ?");
    $check->execute([trim($input['code']), $tenantId]);
    if ($check->fetch()) {
        jsonError('An allowance type with this code already exists', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO allowance_types (tenant_id, name, code, is_taxable, is_fixed, default_amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([
        $tenantId,
        trim($input['name']),
        trim($input['code']),
        isset($input['is_taxable']) ? ($input['is_taxable'] ? 1 : 0) : 1,
        isset($input['is_fixed']) ? ($input['is_fixed'] ? 1 : 0) : 1,
        $input['default_amount'] ?? null,
    ]);

    jsonResponse([
        'success' => true,
        'allowance_type' => [
            'id' => (int) $pdo->lastInsertId(),
            'name' => trim($input['name']),
            'code' => trim($input['code']),
        ],
    ], 201);
    exit;
}

// ── PUT — Update Allowance Type ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Allowance Type ID required', 400);

    // Verify belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM allowance_types WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Allowance type not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = ['name', 'code', 'is_taxable', 'is_fixed', 'default_amount'];

    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            if (in_array($field, ['is_taxable', 'is_fixed'])) {
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
    $sql = "UPDATE allowance_types SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Allowance type updated successfully']);
    exit;
}

jsonError('Method not allowed', 405);
