<?php
/**
 * KCL Stores — Item Groups & Sub-Categories
 * GET  /api/item-groups.php       — list groups + sub-categories
 * POST /api/item-groups.php       — create group (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Item Groups + Sub-Categories ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $groupStmt = $pdo->prepare("
        SELECT id, code, name FROM item_groups
        WHERE tenant_id = ?
        ORDER BY name
    ");
    $groupStmt->execute([$tenantId]);
    $groups = $groupStmt->fetchAll();

    $subCatStmt = $pdo->prepare("
        SELECT id, code, name, item_group_id FROM item_sub_categories
        WHERE tenant_id = ?
        ORDER BY name
    ");
    $subCatStmt->execute([$tenantId]);
    $subCategories = $subCatStmt->fetchAll();

    jsonResponse([
        'groups' => array_map(function($g) {
            return [
                'id' => (int) $g['id'],
                'code' => $g['code'],
                'name' => $g['name'],
            ];
        }, $groups),
        'sub_categories' => array_map(function($s) {
            return [
                'id' => (int) $s['id'],
                'code' => $s['code'],
                'name' => $s['name'],
                'item_group_id' => (int) $s['item_group_id'],
            ];
        }, $subCategories),
    ]);
    exit;
}

// ── POST — Create Item Group or Sub-Category ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    $entity = $input['entity'] ?? ($_GET['entity'] ?? 'group');

    if ($entity === 'sub_category') {
        // ── Create Sub-Category ──
        requireFields($input, ['name', 'item_group_id']);

        // Validate group exists within tenant
        $groupCheck = $pdo->prepare("SELECT id FROM item_groups WHERE id = ? AND tenant_id = ?");
        $groupCheck->execute([(int) $input['item_group_id'], $tenantId]);
        if (!$groupCheck->fetch()) {
            jsonError('Invalid item group', 400);
        }

        // Auto-generate code if not provided
        $code = trim($input['code'] ?? '');
        if (!$code) {
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM item_sub_categories WHERE tenant_id = ?");
            $countStmt->execute([$tenantId]);
            $count = (int) $countStmt->fetchColumn();
            $code = 'SC-' . str_pad($count + 1, 3, '0', STR_PAD_LEFT);
        }

        // Check code uniqueness within tenant
        $check = $pdo->prepare("SELECT id FROM item_sub_categories WHERE code = ? AND tenant_id = ?");
        $check->execute([$code, $tenantId]);
        if ($check->fetch()) {
            jsonError('Sub-category code already exists', 400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO item_sub_categories (tenant_id, code, name, item_group_id)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$tenantId, $code, trim($input['name']), (int) $input['item_group_id']]);

        jsonResponse([
            'success' => true,
            'sub_category' => [
                'id' => (int) $pdo->lastInsertId(),
                'code' => $code,
                'name' => trim($input['name']),
                'item_group_id' => (int) $input['item_group_id'],
            ],
        ], 201);
        exit;
    }

    // ── Create Item Group (default) ──
    requireFields($input, ['name']);

    // Auto-generate code if not provided
    $code = trim($input['code'] ?? '');
    if (!$code) {
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM item_groups WHERE tenant_id = ?");
        $countStmt->execute([$tenantId]);
        $count = (int) $countStmt->fetchColumn();
        $code = 'GRP-' . str_pad($count + 1, 3, '0', STR_PAD_LEFT);
    }

    // Check code uniqueness within tenant
    $check = $pdo->prepare("SELECT id FROM item_groups WHERE code = ? AND tenant_id = ?");
    $check->execute([$code, $tenantId]);
    if ($check->fetch()) {
        jsonError('Group code already exists', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO item_groups (tenant_id, code, name)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([$tenantId, $code, trim($input['name'])]);

    jsonResponse([
        'success' => true,
        'group' => [
            'id' => (int) $pdo->lastInsertId(),
            'code' => $code,
            'name' => trim($input['name']),
        ],
    ], 201);
    exit;
}

requireMethod('GET');
