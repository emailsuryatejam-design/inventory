<?php
/**
 * WebSquare — HR Regions
 * GET    /api/hr-regions.php          — list regions for tenant
 * POST   /api/hr-regions.php          — create region (manager+)
 * PUT    /api/hr-regions.php          — update region (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Regions ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $params = [];

    tenantScope($where, $params, $tenantId);

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $stmt = $pdo->prepare("
        SELECT id, name, code, country, is_active, created_at
        FROM regions
        {$whereClause}
        ORDER BY name ASC
    ");
    $stmt->execute($params);
    $regions = $stmt->fetchAll();

    jsonResponse([
        'regions' => array_map(function ($r) {
            return [
                'id'         => (int) $r['id'],
                'name'       => $r['name'],
                'code'       => $r['code'],
                'country'    => $r['country'],
                'is_active'  => (bool) $r['is_active'],
                'created_at' => $r['created_at'],
            ];
        }, $regions),
    ]);
    exit;
}

// ── POST — Create Region ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['name', 'code']);

    // Check code uniqueness within tenant
    $check = $pdo->prepare("SELECT id FROM regions WHERE code = ? AND tenant_id = ?");
    $check->execute([trim($input['code']), $tenantId]);
    if ($check->fetch()) {
        jsonError('A region with this code already exists', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO regions (tenant_id, name, code, country, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, NOW())
    ");
    $stmt->execute([
        $tenantId,
        trim($input['name']),
        trim($input['code']),
        trim($input['country'] ?? ''),
    ]);

    jsonResponse([
        'success' => true,
        'region'  => [
            'id'   => (int) $pdo->lastInsertId(),
            'name' => trim($input['name']),
            'code' => trim($input['code']),
        ],
    ], 201);
    exit;
}

// ── PUT — Update Region ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Region ID required', 400);

    // Verify region belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM regions WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Region not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = ['name', 'code', 'country', 'is_active'];

    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            if ($field === 'is_active') {
                $updates[] = "{$field} = ?";
                $params[] = $input[$field] ? 1 : 0;
            } else {
                $updates[] = "{$field} = ?";
                $params[] = trim($input[$field]);
            }
        }
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    // If code is being changed, validate uniqueness
    if (isset($input['code'])) {
        $dupCheck = $pdo->prepare("SELECT id FROM regions WHERE code = ? AND tenant_id = ? AND id != ?");
        $dupCheck->execute([trim($input['code']), $tenantId, $id]);
        if ($dupCheck->fetch()) {
            jsonError('A region with this code already exists', 400);
        }
    }

    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE regions SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Region updated successfully']);
    exit;
}

jsonError('Method not allowed', 405);
