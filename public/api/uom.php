<?php
/**
 * KCL Stores — Units of Measure
 * GET  /api/uom.php       — list UOMs
 * POST /api/uom.php       — create UOM (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Units of Measure ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare("
        SELECT id, code, name FROM units_of_measure
        WHERE tenant_id = ?
        ORDER BY name
    ");
    $stmt->execute([$tenantId]);
    $uoms = $stmt->fetchAll();

    jsonResponse([
        'uoms' => array_map(function($u) {
            return [
                'id' => (int) $u['id'],
                'code' => $u['code'],
                'name' => $u['name'],
            ];
        }, $uoms),
    ]);
    exit;
}

// ── POST — Create Unit of Measure ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['code', 'name']);

    $code = trim($input['code']);
    $name = trim($input['name']);

    // Validate code uniqueness within tenant
    $check = $pdo->prepare("SELECT id FROM units_of_measure WHERE code = ? AND tenant_id = ?");
    $check->execute([$code, $tenantId]);
    if ($check->fetch()) {
        jsonError('UOM code already exists for this tenant', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO units_of_measure (tenant_id, code, name)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([$tenantId, $code, $name]);

    jsonResponse([
        'success' => true,
        'uom' => [
            'id' => (int) $pdo->lastInsertId(),
            'code' => $code,
            'name' => $name,
        ],
    ], 201);
    exit;
}

requireMethod('GET');
