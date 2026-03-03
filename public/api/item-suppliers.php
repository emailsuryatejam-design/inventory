<?php
/**
 * KCL Stores — Item-Supplier Links
 * GET    /api/item-suppliers.php?item_id=X       — suppliers for an item
 * GET    /api/item-suppliers.php?supplier_id=X    — items for a supplier
 * POST   /api/item-suppliers.php                  — create link
 * PUT    /api/item-suppliers.php                  — update link
 * DELETE /api/item-suppliers.php?id=X             — remove link
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List linked records ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $itemId = (int) ($_GET['item_id'] ?? 0);
    $supplierId = (int) ($_GET['supplier_id'] ?? 0);

    if ($itemId) {
        // Get suppliers for a specific item
        $stmt = $pdo->prepare("
            SELECT
                iss.id, iss.item_id, iss.supplier_id,
                s.name AS supplier_name, s.supplier_code,
                iss.unit_price, iss.lead_time_days, iss.is_preferred
            FROM item_suppliers iss
            JOIN suppliers s ON iss.supplier_id = s.id
            WHERE iss.item_id = ? AND iss.tenant_id = ?
            ORDER BY iss.is_preferred DESC, s.name
        ");
        $stmt->execute([$itemId, $tenantId]);
        $rows = $stmt->fetchAll();

        jsonResponse(array_map(function ($r) {
            return [
                'id' => (int) $r['id'],
                'item_id' => (int) $r['item_id'],
                'supplier_id' => (int) $r['supplier_id'],
                'supplier_name' => $r['supplier_name'],
                'supplier_code' => $r['supplier_code'],
                'unit_price' => $r['unit_price'] ? (float) $r['unit_price'] : null,
                'lead_time_days' => $r['lead_time_days'] ? (int) $r['lead_time_days'] : null,
                'is_preferred' => (bool) $r['is_preferred'],
            ];
        }, $rows));
        exit;
    }

    if ($supplierId) {
        // Get items for a specific supplier
        $stmt = $pdo->prepare("
            SELECT
                iss.id, iss.item_id, iss.supplier_id,
                i.item_code, i.name AS item_name,
                g.code AS group_code,
                u.code AS uom,
                iss.unit_price, iss.lead_time_days, iss.is_preferred
            FROM item_suppliers iss
            JOIN items i ON iss.item_id = i.id
            LEFT JOIN item_groups g ON i.item_group_id = g.id
            LEFT JOIN units_of_measure u ON i.stock_uom_id = u.id
            WHERE iss.supplier_id = ? AND iss.tenant_id = ?
            ORDER BY i.name
        ");
        $stmt->execute([$supplierId, $tenantId]);
        $rows = $stmt->fetchAll();

        jsonResponse(array_map(function ($r) {
            return [
                'id' => (int) $r['id'],
                'item_id' => (int) $r['item_id'],
                'supplier_id' => (int) $r['supplier_id'],
                'item_code' => $r['item_code'],
                'item_name' => $r['item_name'],
                'group_code' => $r['group_code'],
                'uom' => $r['uom'],
                'unit_price' => $r['unit_price'] ? (float) $r['unit_price'] : null,
                'lead_time_days' => $r['lead_time_days'] ? (int) $r['lead_time_days'] : null,
                'is_preferred' => (bool) $r['is_preferred'],
            ];
        }, $rows));
        exit;
    }

    jsonError('Either item_id or supplier_id is required', 400);
}

// ── POST — Create link ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    requireFields($input, ['item_id', 'supplier_id']);

    $itemId = (int) $input['item_id'];
    $supplierId = (int) $input['supplier_id'];

    // Validate item belongs to tenant
    $itemCheck = $pdo->prepare("SELECT id FROM items WHERE id = ? AND tenant_id = ?");
    $itemCheck->execute([$itemId, $tenantId]);
    if (!$itemCheck->fetch()) {
        jsonError('Item not found', 404);
    }

    // Validate supplier belongs to tenant
    $supCheck = $pdo->prepare("SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?");
    $supCheck->execute([$supplierId, $tenantId]);
    if (!$supCheck->fetch()) {
        jsonError('Supplier not found', 404);
    }

    // Check for duplicate link
    $dupCheck = $pdo->prepare("
        SELECT id FROM item_suppliers
        WHERE item_id = ? AND supplier_id = ? AND tenant_id = ?
    ");
    $dupCheck->execute([$itemId, $supplierId, $tenantId]);
    if ($dupCheck->fetch()) {
        jsonError('This item-supplier link already exists', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO item_suppliers
            (tenant_id, item_id, supplier_id, unit_price, lead_time_days, is_preferred)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $tenantId,
        $itemId,
        $supplierId,
        $input['unit_price'] ?? null,
        $input['lead_time_days'] ?? null,
        !empty($input['is_preferred']) ? 1 : 0,
    ]);

    jsonResponse([
        'success' => true,
        'id' => (int) $pdo->lastInsertId(),
        'message' => 'Item-supplier link created',
    ], 201);
    exit;
}

// ── PUT — Update link ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Link ID required', 400);

    // Verify link belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM item_suppliers WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Link not found', 404);
    }

    $updates = [];
    $params = [];

    if (isset($input['unit_price'])) {
        $updates[] = 'unit_price = ?';
        $params[] = $input['unit_price'];
    }
    if (isset($input['lead_time_days'])) {
        $updates[] = 'lead_time_days = ?';
        $params[] = $input['lead_time_days'];
    }
    if (isset($input['is_preferred'])) {
        $updates[] = 'is_preferred = ?';
        $params[] = $input['is_preferred'] ? 1 : 0;
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE item_suppliers SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Link updated successfully']);
    exit;
}

// ── DELETE — Remove link ──
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) jsonError('Link ID required', 400);

    // Verify link belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM item_suppliers WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Link not found', 404);
    }

    $stmt = $pdo->prepare("DELETE FROM item_suppliers WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);

    jsonResponse(['success' => true, 'message' => 'Link removed']);
    exit;
}

jsonError('Method not allowed', 405);
