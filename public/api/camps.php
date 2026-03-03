<?php
/**
 * KCL Stores — Camps Management
 * GET  /api/camps.php       — list camps
 * POST /api/camps.php       — create camp (admin only)
 * PUT  /api/camps.php?id=X  — update camp (admin only)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Camps ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("
        SELECT id, code, name, type, is_active FROM camps
        WHERE tenant_id = ?
        ORDER BY name
    ");
    $stmt->execute([$tenantId]);
    $camps = $stmt->fetchAll();

    jsonResponse([
        'camps' => array_map(function($c) {
            return [
                'id' => (int) $c['id'],
                'code' => $c['code'],
                'name' => $c['name'],
                'type' => $c['type'],
                'is_active' => (bool) $c['is_active'],
            ];
        }, $camps),
    ]);
    exit;
}

// ── POST — Create Camp ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireAdmin();
    $input = getJsonInput();
    requireFields($input, ['code', 'name']);

    $code = trim($input['code']);
    $name = trim($input['name']);
    $type = trim($input['type'] ?? 'camp');

    // Check code uniqueness within tenant
    $check = $pdo->prepare("SELECT id FROM camps WHERE code = ? AND tenant_id = ?");
    $check->execute([$code, $tenantId]);
    if ($check->fetch()) {
        jsonError('Camp code already exists', 400);
    }

    // Check tenant's max_camps limit
    $tenantStmt = $pdo->prepare("SELECT max_camps FROM tenants WHERE id = ?");
    $tenantStmt->execute([$tenantId]);
    $tenant = $tenantStmt->fetch();

    if ($tenant && $tenant['max_camps']) {
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM camps WHERE tenant_id = ?");
        $countStmt->execute([$tenantId]);
        $currentCount = (int) $countStmt->fetchColumn();

        if ($currentCount >= (int) $tenant['max_camps']) {
            jsonError('Maximum number of camps reached for this tenant (' . (int) $tenant['max_camps'] . ')', 400);
        }
    }

    $stmt = $pdo->prepare("
        INSERT INTO camps (tenant_id, code, name, type, is_active)
        VALUES (?, ?, ?, ?, 1)
    ");
    $stmt->execute([$tenantId, $code, $name, $type]);

    jsonResponse([
        'success' => true,
        'camp' => [
            'id' => (int) $pdo->lastInsertId(),
            'code' => $code,
            'name' => $name,
            'type' => $type,
        ],
    ], 201);
    exit;
}

// ── PUT — Update Camp ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireAdmin();
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) jsonError('Camp ID required', 400);

    $input = getJsonInput();

    // Check camp exists within tenant
    $existing = $pdo->prepare("SELECT id FROM camps WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Camp not found', 404);
    }

    $updates = [];
    $params = [];

    if (isset($input['name'])) {
        $updates[] = 'name = ?';
        $params[] = trim($input['name']);
    }
    if (isset($input['type'])) {
        $updates[] = 'type = ?';
        $params[] = trim($input['type']);
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE camps SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Camp updated successfully']);
    exit;
}

requireMethod('GET');
