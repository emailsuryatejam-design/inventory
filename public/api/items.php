<?php
/**
 * KCL Stores — Items
 * GET    /api/items.php                — list items (paginated, filtered)
 * POST   /api/items.php                — create item (manager+)
 * PUT    /api/items.php                — update item (manager+)
 * DELETE /api/items.php?id=X           — soft-deactivate item (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Items ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Pagination
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 25)));
    $offset = ($page - 1) * $perPage;

    // Filters
    $search = trim($_GET['search'] ?? '');
    $groupId = $_GET['group'] ?? '';
    $abcClass = $_GET['abc_class'] ?? '';
    $subCategoryId = $_GET['sub_category'] ?? '';
    $storageType = $_GET['storage_type'] ?? '';
    $active = $_GET['active'] ?? '1';

    // Build query
    $where = [];
    $params = [];

    // Tenant isolation — every query filters by tenant
    tenantScope($where, $params, $tenantId, 'i');

    if ($active !== 'all') {
        $where[] = 'i.is_active = ?';
        $params[] = (int) $active;
    }

    if ($search) {
        $where[] = '(i.item_code LIKE ? OR i.name LIKE ? OR i.sap_item_no LIKE ?)';
        $searchParam = "%{$search}%";
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
    }

    if ($groupId) {
        $where[] = 'i.item_group_id = ?';
        $params[] = (int) $groupId;
    }

    if ($subCategoryId) {
        $where[] = 'i.sub_category_id = ?';
        $params[] = (int) $subCategoryId;
    }

    if ($abcClass && in_array($abcClass, ['A', 'B', 'C'])) {
        $where[] = 'i.abc_class = ?';
        $params[] = $abcClass;
    }

    if ($storageType && in_array($storageType, ['ambient', 'chilled', 'frozen', 'hazardous'])) {
        $where[] = 'i.storage_type = ?';
        $params[] = $storageType;
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Total count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM items i {$whereClause}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Items query
    $sql = "
        SELECT
            i.id, i.item_code, i.sap_item_no, i.name, i.description,
            i.abc_class, i.storage_type, i.is_active, i.is_perishable, i.is_critical,
            i.last_purchase_price, i.weighted_avg_cost,
            i.shelf_life_days, i.haccp_category,
            g.code as group_code, g.name as group_name,
            s.code as sub_cat_code, s.name as sub_cat_name,
            u.code as stock_uom_code, u.name as stock_uom_name,
            pu.code as purchase_uom_code,
            iu.code as issue_uom_code,
            i.purchase_to_stock_factor, i.stock_to_issue_factor,
            i.min_order_qty, i.standard_pack_size
        FROM items i
        LEFT JOIN item_groups g ON i.item_group_id = g.id
        LEFT JOIN item_sub_categories s ON i.sub_category_id = s.id
        LEFT JOIN units_of_measure u ON i.stock_uom_id = u.id
        LEFT JOIN units_of_measure pu ON i.purchase_uom_id = pu.id
        LEFT JOIN units_of_measure iu ON i.issue_uom_id = iu.id
        {$whereClause}
        ORDER BY i.item_code ASC
        LIMIT ? OFFSET ?
    ";

    $stmt = $pdo->prepare($sql);
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    // Load item groups for filter dropdown (tenant-filtered)
    $groups = getTenantItemGroups($pdo, $tenantId);

    // Load sub-categories for filter dropdown
    $subCatStmt = $pdo->prepare("SELECT id, code, name, item_group_id FROM item_sub_categories WHERE tenant_id = ? ORDER BY name");
    $subCatStmt->execute([$tenantId]);
    $subCats = $subCatStmt->fetchAll();

    jsonResponse([
        'items' => array_map(function($i) {
            return [
                'id' => (int) $i['id'],
                'item_code' => $i['item_code'],
                'sap_item_no' => $i['sap_item_no'],
                'name' => $i['name'],
                'description' => $i['description'],
                'group_code' => $i['group_code'],
                'group_name' => $i['group_name'],
                'sub_cat_code' => $i['sub_cat_code'],
                'sub_cat_name' => $i['sub_cat_name'],
                'stock_uom' => $i['stock_uom_code'],
                'purchase_uom' => $i['purchase_uom_code'],
                'issue_uom' => $i['issue_uom_code'],
                'purchase_to_stock_factor' => $i['purchase_to_stock_factor'] ? (float) $i['purchase_to_stock_factor'] : 1,
                'stock_to_issue_factor' => $i['stock_to_issue_factor'] ? (float) $i['stock_to_issue_factor'] : 1,
                'abc_class' => $i['abc_class'],
                'storage_type' => $i['storage_type'],
                'is_active' => (bool) $i['is_active'],
                'is_perishable' => (bool) $i['is_perishable'],
                'is_critical' => (bool) $i['is_critical'],
                'last_purchase_price' => $i['last_purchase_price'] ? (float) $i['last_purchase_price'] : null,
                'weighted_avg_cost' => $i['weighted_avg_cost'] ? (float) $i['weighted_avg_cost'] : null,
                'shelf_life_days' => $i['shelf_life_days'] ? (int) $i['shelf_life_days'] : null,
                'haccp_category' => $i['haccp_category'],
                'min_order_qty' => $i['min_order_qty'] ? (float) $i['min_order_qty'] : null,
                'standard_pack_size' => $i['standard_pack_size'] ? (float) $i['standard_pack_size'] : null,
            ];
        }, $items),
        'groups' => array_map(function($g) {
            return ['id' => (int) $g['id'], 'code' => $g['code'], 'name' => $g['name']];
        }, $groups),
        'sub_categories' => array_map(function($s) {
            return ['id' => (int) $s['id'], 'code' => $s['code'], 'name' => $s['name'], 'item_group_id' => (int) $s['item_group_id']];
        }, $subCats),
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create Item ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['name']);

    if (empty($input['item_group_id'])) jsonError('Item group is required', 400);
    if (empty($input['stock_uom_id'])) jsonError('Stock UOM is required', 400);

    // Default purchase/issue UOM to stock UOM if not provided
    $stockUomId = (int) $input['stock_uom_id'];
    $purchaseUomId = !empty($input['purchase_uom_id']) ? (int) $input['purchase_uom_id'] : $stockUomId;
    $issueUomId = !empty($input['issue_uom_id']) ? (int) $input['issue_uom_id'] : $stockUomId;

    // Auto-generate item_code: count existing items + 1, format as ITM-XXXX
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM items WHERE tenant_id = ?");
    $countStmt->execute([$tenantId]);
    $nextNum = (int) $countStmt->fetchColumn() + 1;
    $itemCode = 'ITM-' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);

    // Ensure uniqueness (in case of deletions causing gaps)
    $codeCheck = $pdo->prepare("SELECT id FROM items WHERE item_code = ? AND tenant_id = ?");
    $codeCheck->execute([$itemCode, $tenantId]);
    while ($codeCheck->fetch()) {
        $nextNum++;
        $itemCode = 'ITM-' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);
        $codeCheck->execute([$itemCode, $tenantId]);
    }

    // Validate item_group_id exists within tenant
    if (!empty($input['item_group_id'])) {
        $groupCheck = $pdo->prepare("SELECT id FROM item_groups WHERE id = ? AND tenant_id = ?");
        $groupCheck->execute([$input['item_group_id'], $tenantId]);
        if (!$groupCheck->fetch()) {
            jsonError('Invalid item group', 400);
        }
    }

    // Validate stock_uom_id exists within tenant
    if (!empty($input['stock_uom_id'])) {
        $uomCheck = $pdo->prepare("SELECT id FROM units_of_measure WHERE id = ? AND tenant_id = ?");
        $uomCheck->execute([$input['stock_uom_id'], $tenantId]);
        if (!$uomCheck->fetch()) {
            jsonError('Invalid stock UOM', 400);
        }
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO items (
                tenant_id, item_code, name, description,
                item_group_id, sub_category_id, abc_class, storage_type,
                is_perishable, is_critical,
                stock_uom_id, purchase_uom_id, issue_uom_id,
                purchase_to_stock_factor, stock_to_issue_factor,
                last_purchase_price, min_order_qty, standard_pack_size,
                shelf_life_days, haccp_category,
                storage_temp_min, storage_temp_max,
                allergen_info, yield_percentage,
                sap_item_no, barcode, manufacturer,
                is_active
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?,
                ?, ?, ?,
                1
            )
        ");

        $stmt->execute([
            $tenantId,
            $itemCode,
            trim($input['name']),
            $input['description'] ?? '',
            (int) $input['item_group_id'],
            $input['sub_category_id'] ?? null,
            $input['abc_class'] ?? 'C',
            $input['storage_type'] ?? 'ambient',
            $input['is_perishable'] ?? 0,
            $input['is_critical'] ?? 0,
            $stockUomId,
            $purchaseUomId,
            $issueUomId,
            $input['purchase_to_stock_factor'] ?? 1,
            $input['stock_to_issue_factor'] ?? 1,
            $input['last_purchase_price'] ?? null,
            $input['min_order_qty'] ?? null,
            $input['standard_pack_size'] ?? null,
            $input['shelf_life_days'] ?? null,
            $input['haccp_category'] ?? '',
            $input['storage_temp_min'] ?? null,
            $input['storage_temp_max'] ?? null,
            $input['allergen_info'] ?? '',
            $input['yield_percentage'] ?? null,
            $input['sap_item_no'] ?: null,
            $input['barcode'] ?: null,
            $input['manufacturer'] ?? '',
        ]);

        jsonResponse([
            'success' => true,
            'item' => [
                'id' => (int) $pdo->lastInsertId(),
                'item_code' => $itemCode,
                'name' => trim($input['name']),
            ],
        ], 201);
    } catch (Exception $e) {
        error_log('[API Error] items create: ' . $e->getMessage());
        $msg = $e->getMessage();
        // Friendly duplicate entry errors
        if (strpos($msg, 'Duplicate entry') !== false) {
            if (strpos($msg, 'uk_sap_item_no') !== false) {
                jsonError('An item with this SAP Item No already exists', 400);
            }
            if (strpos($msg, 'barcode') !== false) {
                jsonError('An item with this barcode already exists', 400);
            }
            jsonError('Duplicate entry: this item already exists', 400);
        }
        if (strpos($msg, 'Unknown column') !== false || strpos($msg, 'Column not found') !== false) {
            jsonError('Database schema mismatch: ' . $msg, 500);
        }
        jsonError('Failed to create item: ' . $msg, 500);
    }
    exit;
}

// ── PUT — Update Item ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();

    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Item ID required', 400);

    // Verify item belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM items WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Item not found', 404);
    }

    // Dynamic update — only update fields present in input
    $allowedFields = [
        'name', 'description', 'item_group_id', 'sub_category_id',
        'abc_class', 'storage_type', 'is_perishable', 'is_critical',
        'stock_uom_id', 'purchase_uom_id', 'issue_uom_id',
        'purchase_to_stock_factor', 'stock_to_issue_factor',
        'last_purchase_price', 'min_order_qty', 'standard_pack_size',
        'shelf_life_days', 'haccp_category',
        'storage_temp_min', 'storage_temp_max',
        'allergen_info', 'yield_percentage',
        'sap_item_no', 'barcode', 'manufacturer', 'is_active',
    ];

    $updates = [];
    $params = [];

    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            $updates[] = "{$field} = ?";
            // Convert empty unique fields to NULL to avoid duplicate constraint violations
            if (in_array($field, ['sap_item_no', 'barcode']) && empty($input[$field])) {
                $params[] = null;
            } else {
                $params[] = $input[$field];
            }
        }
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $updates[] = 'updated_at = NOW()';
    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE items SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    try {
        $pdo->prepare($sql)->execute($params);
    } catch (Exception $e) {
        $msg = $e->getMessage();
        if (strpos($msg, 'Duplicate entry') !== false) {
            if (strpos($msg, 'uk_sap_item_no') !== false) {
                jsonError('An item with this SAP Item No already exists', 400);
            }
            if (strpos($msg, 'barcode') !== false) {
                jsonError('An item with this barcode already exists', 400);
            }
            jsonError('Duplicate entry: this value already exists', 400);
        }
        jsonError('Failed to update item: ' . $msg, 500);
    }

    jsonResponse(['success' => true, 'message' => 'Item updated successfully']);
    exit;
}

// ── DELETE — Soft-deactivate Item ──
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    requireManager();
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) jsonError('Item ID required', 400);

    // Verify item belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM items WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Item not found', 404);
    }

    $stmt = $pdo->prepare("UPDATE items SET is_active = 0, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);

    jsonResponse(['success' => true, 'message' => 'Item deactivated successfully']);
    exit;
}

requireMethod('GET');
