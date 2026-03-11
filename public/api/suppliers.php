<?php
/**
 * KCL Stores — Suppliers
 * GET    /api/suppliers.php              — list suppliers (paginated, searchable)
 * GET    /api/suppliers.php?id=X         — single supplier detail with linked items
 * POST   /api/suppliers.php              — create supplier (manager+)
 * PUT    /api/suppliers.php              — update supplier (manager+)
 * DELETE /api/suppliers.php?id=X         — soft-deactivate supplier (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List or Detail ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = (int) ($_GET['id'] ?? 0);

    if ($id) {
        // ── Single supplier detail ──
        $stmt = $pdo->prepare("
            SELECT id, supplier_code, name, contact_person, email, phone,
                   address, city, country, tax_id, payment_terms, credit_limit,
                   bank_name, bank_account, notes, is_active, created_at
            FROM suppliers
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([$id, $tenantId]);
        $supplier = $stmt->fetch();

        if (!$supplier) {
            jsonError('Supplier not found', 404);
        }

        // Linked items via item_suppliers
        $itemsStmt = $pdo->prepare("
            SELECT
                iss.id, iss.item_id,
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
        $itemsStmt->execute([$id, $tenantId]);
        $items = $itemsStmt->fetchAll();

        jsonResponse([
            'supplier' => [
                'id' => (int) $supplier['id'],
                'supplier_code' => $supplier['supplier_code'],
                'name' => $supplier['name'],
                'contact_person' => $supplier['contact_person'],
                'email' => $supplier['email'],
                'phone' => $supplier['phone'],
                'address' => $supplier['address'],
                'city' => $supplier['city'],
                'country' => $supplier['country'],
                'tax_id' => $supplier['tax_id'],
                'payment_terms' => $supplier['payment_terms'],
                'credit_limit' => $supplier['credit_limit'] ? (float) $supplier['credit_limit'] : null,
                'bank_name' => $supplier['bank_name'],
                'bank_account' => $supplier['bank_account'],
                'notes' => $supplier['notes'],
                'is_active' => (bool) $supplier['is_active'],
                'created_at' => $supplier['created_at'],
            ],
            'items' => array_map(function ($row) {
                return [
                    'id' => (int) $row['id'],
                    'item_id' => (int) $row['item_id'],
                    'item_code' => $row['item_code'],
                    'item_name' => $row['item_name'],
                    'group_code' => $row['group_code'],
                    'uom' => $row['uom'],
                    'unit_price' => $row['unit_price'] ? (float) $row['unit_price'] : null,
                    'lead_time_days' => $row['lead_time_days'] ? (int) $row['lead_time_days'] : null,
                    'is_preferred' => (bool) $row['is_preferred'],
                ];
            }, $items),
        ]);
        exit;
    }

    // ── List suppliers with pagination ──
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 25)));
    $offset = ($page - 1) * $perPage;
    $search = trim($_GET['search'] ?? '');
    $isActive = $_GET['is_active'] ?? '1';

    $where = [];
    $params = [];

    tenantScope($where, $params, $tenantId, 's');

    if ($isActive !== 'all') {
        $where[] = 's.is_active = ?';
        $params[] = (int) $isActive;
    }

    if ($search) {
        $where[] = '(s.name LIKE ? OR s.supplier_code LIKE ? OR s.email LIKE ?)';
        $searchParam = "%{$search}%";
        $params[] = $searchParam;
        $params[] = $searchParam;
        $params[] = $searchParam;
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Total count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM suppliers s {$whereClause}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Fetch suppliers
    $sql = "
        SELECT s.id, s.supplier_code, s.name, s.contact_person, s.email, s.phone,
               s.city, s.country, s.payment_terms, s.is_active, s.created_at
        FROM suppliers s
        {$whereClause}
        ORDER BY s.name ASC
        LIMIT ? OFFSET ?
    ";
    $stmt = $pdo->prepare($sql);
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $suppliers = $stmt->fetchAll();

    jsonResponse([
        'suppliers' => array_map(function ($s) {
            return [
                'id' => (int) $s['id'],
                'supplier_code' => $s['supplier_code'],
                'name' => $s['name'],
                'contact_person' => $s['contact_person'],
                'email' => $s['email'],
                'phone' => $s['phone'],
                'city' => $s['city'],
                'country' => $s['country'],
                'payment_terms' => $s['payment_terms'],
                'is_active' => (bool) $s['is_active'],
                'created_at' => $s['created_at'],
            ];
        }, $suppliers),
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int) ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create Supplier ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['name']);

    // Validate name uniqueness within tenant
    $check = $pdo->prepare("SELECT id FROM suppliers WHERE name = ? AND tenant_id = ?");
    $check->execute([trim($input['name']), $tenantId]);
    if ($check->fetch()) {
        jsonError('A supplier with this name already exists', 400);
    }

    // Auto-generate supplier_code: SUP-XXXX
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM suppliers WHERE tenant_id = ?");
    $countStmt->execute([$tenantId]);
    $nextNum = (int) $countStmt->fetchColumn() + 1;
    $supplierCode = 'SUP-' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);

    $stmt = $pdo->prepare("
        INSERT INTO suppliers
            (tenant_id, supplier_code, name, contact_person, email, phone,
             address, city, country, tax_id, payment_terms, credit_limit,
             bank_name, bank_account, notes, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
    ");
    $stmt->execute([
        $tenantId,
        $supplierCode,
        trim($input['name']),
        $input['contact_person'] ?? null,
        $input['email'] ?? null,
        $input['phone'] ?? null,
        $input['address'] ?? null,
        $input['city'] ?? null,
        $input['country'] ?? null,
        $input['tax_id'] ?? null,
        $input['payment_terms'] ?? null,
        $input['credit_limit'] ?? null,
        $input['bank_name'] ?? null,
        $input['bank_account'] ?? null,
        $input['notes'] ?? null,
    ]);

    jsonResponse([
        'success' => true,
        'supplier' => [
            'id' => (int) $pdo->lastInsertId(),
            'supplier_code' => $supplierCode,
            'name' => trim($input['name']),
        ],
    ], 201);
    exit;
}

// ── PUT — Update Supplier ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Supplier ID required', 400);

    // Verify supplier belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Supplier not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = [
        'name', 'contact_person', 'email', 'phone', 'address',
        'city', 'country', 'tax_id', 'payment_terms', 'credit_limit',
        'bank_name', 'bank_account', 'notes', 'is_active',
    ];

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

    // If name is being changed, validate uniqueness
    if (isset($input['name'])) {
        $dupCheck = $pdo->prepare("SELECT id FROM suppliers WHERE name = ? AND tenant_id = ? AND id != ?");
        $dupCheck->execute([trim($input['name']), $tenantId, $id]);
        if ($dupCheck->fetch()) {
            jsonError('A supplier with this name already exists', 400);
        }
    }

    $updates[] = 'updated_at = NOW()';
    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE suppliers SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Supplier updated successfully']);
    exit;
}

// ── DELETE — Soft-deactivate Supplier ──
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    requireManager();
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) jsonError('Supplier ID required', 400);

    // Verify supplier belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Supplier not found', 404);
    }

    // Check for active purchase orders
    $activePOs = $pdo->prepare("
        SELECT COUNT(*) FROM purchase_orders
        WHERE supplier_id = ? AND tenant_id = ? AND status NOT IN ('cancelled', 'received')
    ");
    $activePOs->execute([$id, $tenantId]);
    $poCount = (int) $activePOs->fetchColumn();
    if ($poCount > 0) {
        jsonError("Cannot deactivate supplier: {$poCount} active purchase order(s) exist. Close or cancel them first.", 400);
    }

    $stmt = $pdo->prepare("UPDATE suppliers SET is_active = 0, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);

    jsonResponse(['success' => true, 'message' => 'Supplier deactivated']);
    exit;
}

jsonError('Method not allowed', 405);
