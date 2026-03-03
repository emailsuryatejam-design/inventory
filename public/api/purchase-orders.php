<?php
/**
 * KCL Stores — Purchase Orders
 * GET    /api/purchase-orders.php            — list POs
 * GET    /api/purchase-orders.php?id=X       — PO detail with lines + linked GRNs
 * POST   /api/purchase-orders.php            — create PO with lines
 * PUT    /api/purchase-orders.php            — approve / send / cancel PO
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List or Detail ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // ── Detail by ID ──
    if (!empty($_GET['id'])) {
        $poId = (int) $_GET['id'];

        $stmt = $pdo->prepare("
            SELECT po.id, po.po_number, po.supplier_id,
                   s.name AS supplier_name, s.code AS supplier_code,
                   po.delivery_date, po.payment_terms, po.currency, po.notes,
                   po.status, po.subtotal, po.tax_amount, po.grand_total,
                   po.created_at,
                   uc.name AS created_by_name,
                   po.approved_at, ua.name AS approved_by_name,
                   po.sent_at
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            LEFT JOIN users uc ON po.created_by = uc.id
            LEFT JOIN users ua ON po.approved_by = ua.id
            WHERE po.id = ? AND po.tenant_id = ?
        ");
        $stmt->execute([$poId, $tenantId]);
        $po = $stmt->fetch();

        if (!$po) {
            jsonError('Purchase order not found', 404);
        }

        // Lines
        $linesStmt = $pdo->prepare("
            SELECT pol.id, pol.item_id,
                   i.item_code, i.name AS item_name,
                   pol.quantity, pol.unit_price, pol.tax_rate, pol.line_total,
                   pol.received_qty
            FROM purchase_order_lines pol
            JOIN items i ON pol.item_id = i.id
            WHERE pol.po_id = ? AND pol.tenant_id = ?
            ORDER BY pol.id ASC
        ");
        $linesStmt->execute([$poId, $tenantId]);
        $lines = $linesStmt->fetchAll();

        // Linked GRNs
        $grnStmt = $pdo->prepare("
            SELECT id, grn_number, received_date, status, total_value
            FROM grn
            WHERE po_id = ? AND tenant_id = ?
            ORDER BY created_at DESC
        ");
        $grnStmt->execute([$poId, $tenantId]);
        $grns = $grnStmt->fetchAll();

        jsonResponse([
            'purchase_order' => [
                'id'              => (int) $po['id'],
                'po_number'       => $po['po_number'],
                'supplier_id'     => (int) $po['supplier_id'],
                'supplier_name'   => $po['supplier_name'],
                'supplier_code'   => $po['supplier_code'],
                'delivery_date'   => $po['delivery_date'],
                'payment_terms'   => $po['payment_terms'],
                'currency'        => $po['currency'],
                'notes'           => $po['notes'],
                'status'          => $po['status'],
                'subtotal'        => (float) $po['subtotal'],
                'tax_amount'      => (float) $po['tax_amount'],
                'grand_total'     => (float) $po['grand_total'],
                'created_at'      => $po['created_at'],
                'created_by_name' => $po['created_by_name'],
                'approved_at'     => $po['approved_at'],
                'approved_by_name'=> $po['approved_by_name'],
                'sent_at'         => $po['sent_at'],
            ],
            'lines' => array_map(function ($l) {
                return [
                    'id'           => (int) $l['id'],
                    'item_id'      => (int) $l['item_id'],
                    'item_code'    => $l['item_code'],
                    'item_name'    => $l['item_name'],
                    'quantity'     => (float) $l['quantity'],
                    'unit_price'   => (float) $l['unit_price'],
                    'tax_rate'     => (float) $l['tax_rate'],
                    'line_total'   => (float) $l['line_total'],
                    'received_qty' => (float) $l['received_qty'],
                ];
            }, $lines),
            'grns' => array_map(function ($g) {
                return [
                    'id'            => (int) $g['id'],
                    'grn_number'    => $g['grn_number'],
                    'received_date' => $g['received_date'],
                    'status'        => $g['status'],
                    'total_value'   => (float) $g['total_value'],
                ];
            }, $grns),
        ]);
        exit;
    }

    // ── List with pagination ──
    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? 20)));
    $offset  = ($page - 1) * $perPage;
    $search  = trim($_GET['search'] ?? '');
    $status  = $_GET['status'] ?? '';

    $where  = [];
    $params = [];

    if ($status) {
        $where[] = 'po.status = ?';
        $params[] = $status;
    }

    if ($search) {
        $where[] = '(po.po_number LIKE ? OR s.name LIKE ? OR s.code LIKE ?)';
        $params[] = "%{$search}%";
        $params[] = "%{$search}%";
        $params[] = "%{$search}%";
    }

    tenantScope($where, $params, $tenantId, 'po');

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $stmt = $pdo->prepare("
        SELECT po.id, po.po_number, po.supplier_id,
               s.name AS supplier_name, s.code AS supplier_code,
               po.status, po.subtotal, po.tax_amount, po.grand_total,
               po.delivery_date, po.created_at,
               uc.name AS created_by_name
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users uc ON po.created_by = uc.id
        {$whereClause}
        ORDER BY po.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    // Status counts
    $scStmt = $pdo->prepare("
        SELECT po.status, COUNT(*) AS cnt
        FROM purchase_orders po
        WHERE po.tenant_id = ?
        GROUP BY po.status
    ");
    $scStmt->execute([$tenantId]);
    $statusCounts = $scStmt->fetchAll(PDO::FETCH_KEY_PAIR);

    jsonResponse([
        'purchase_orders' => array_map(function ($po) {
            return [
                'id'              => (int) $po['id'],
                'po_number'       => $po['po_number'],
                'supplier_id'     => (int) $po['supplier_id'],
                'supplier_name'   => $po['supplier_name'],
                'supplier_code'   => $po['supplier_code'],
                'status'          => $po['status'],
                'subtotal'        => (float) $po['subtotal'],
                'tax_amount'      => (float) $po['tax_amount'],
                'grand_total'     => (float) $po['grand_total'],
                'delivery_date'   => $po['delivery_date'],
                'created_at'      => $po['created_at'],
                'created_by_name' => $po['created_by_name'],
            ];
        }, $orders),
        'status_counts' => $statusCounts,
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create PO ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = requireRole(['procurement_officer', 'stores_manager', 'admin', 'director']);
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    requireFields($input, ['supplier_id', 'lines']);

    if (!is_array($input['lines']) || count($input['lines']) === 0) {
        jsonError('At least one line item is required', 400);
    }

    $supplierId = (int) $input['supplier_id'];

    // Validate supplier belongs to tenant
    $supStmt = $pdo->prepare("SELECT id, name FROM suppliers WHERE id = ? AND tenant_id = ?");
    $supStmt->execute([$supplierId, $tenantId]);
    if (!$supStmt->fetch()) {
        jsonError('Supplier not found or does not belong to this tenant', 400);
    }

    // Generate PO number (no camp code for POs)
    $poNumber = generateDocNumber($pdo, 'PO', '', $tenantId);

    // Batch-fetch items for validation
    $itemIds = array_filter(array_map(function ($l) {
        return !empty($l['item_id']) ? (int) $l['item_id'] : null;
    }, $input['lines']));
    $itemIds = array_values(array_unique($itemIds));

    if (count($itemIds) === 0) {
        jsonError('No valid item lines provided', 400);
    }

    $ph = implode(',', array_fill(0, count($itemIds), '?'));
    $itemStmt = $pdo->prepare("SELECT id, item_code, name FROM items WHERE id IN ({$ph}) AND tenant_id = ?");
    $itemStmt->execute(array_merge($itemIds, [$tenantId]));
    $itemMap = [];
    foreach ($itemStmt->fetchAll() as $row) {
        $itemMap[(int) $row['id']] = $row;
    }

    foreach ($itemIds as $iid) {
        if (!isset($itemMap[$iid])) {
            jsonError("Item ID {$iid} not found or does not belong to this tenant", 400);
        }
    }

    $status = $input['status'] ?? 'draft';
    if (!in_array($status, ['draft', 'submitted'])) {
        $status = 'draft';
    }

    $pdo->beginTransaction();
    try {
        // Insert header
        $pdo->prepare("
            INSERT INTO purchase_orders (
                tenant_id, po_number, supplier_id, camp_id,
                delivery_date, payment_terms, currency, notes,
                status, subtotal, tax_amount, grand_total,
                created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, NOW())
        ")->execute([
            $tenantId, $poNumber, $supplierId, $user['camp_id'] ?? null,
            $input['delivery_date'] ?? null,
            $input['payment_terms'] ?? null,
            $input['currency'] ?? 'TZS',
            $input['notes'] ?? null,
            $status, $user['user_id'],
        ]);

        $poId = (int) $pdo->lastInsertId();

        // Insert lines & calculate totals
        $subtotal  = 0;
        $taxAmount = 0;

        $lineStmt = $pdo->prepare("
            INSERT INTO purchase_order_lines (
                tenant_id, po_id, item_id, quantity, unit_price,
                tax_rate, line_total, received_qty, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        ");

        foreach ($input['lines'] as $line) {
            if (empty($line['item_id']) || empty($line['quantity']) || $line['quantity'] <= 0) continue;

            $itemId    = (int) $line['item_id'];
            $qty       = (float) $line['quantity'];
            $unitPrice = (float) ($line['unit_price'] ?? 0);
            $taxRate   = (float) ($line['tax_rate'] ?? 0);

            $lineSubtotal = $qty * $unitPrice;
            $lineTax      = $lineSubtotal * ($taxRate / 100);
            $lineTotal    = $lineSubtotal + $lineTax;

            $subtotal  += $lineSubtotal;
            $taxAmount += $lineTax;

            $lineStmt->execute([
                $tenantId, $poId, $itemId, $qty, $unitPrice,
                $taxRate, $lineTotal, $line['description'] ?? null,
            ]);
        }

        $grandTotal = $subtotal + $taxAmount;

        // Update header totals
        $pdo->prepare("
            UPDATE purchase_orders
            SET subtotal = ?, tax_amount = ?, grand_total = ?
            WHERE id = ?
        ")->execute([$subtotal, $taxAmount, $grandTotal, $poId]);

        $pdo->commit();

        jsonResponse([
            'success'        => true,
            'purchase_order' => [
                'id'          => $poId,
                'po_number'   => $poNumber,
                'subtotal'    => $subtotal,
                'tax_amount'  => $taxAmount,
                'grand_total' => $grandTotal,
            ],
        ], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('[API Error] purchase-orders POST: ' . $e->getMessage());
        jsonError('An unexpected error occurred. Please try again.', 500);
    }
    exit;
}

// ── PUT — Approve / Send / Cancel ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = getJsonInput();
    requireFields($input, ['id', 'action']);

    $poId   = (int) $input['id'];
    $action = $input['action'];

    if (!in_array($action, ['approve', 'send', 'cancel'])) {
        jsonError('Invalid action. Must be "approve", "send", or "cancel"', 400);
    }

    // Verify PO exists and belongs to tenant
    $poStmt = $pdo->prepare("
        SELECT id, status FROM purchase_orders
        WHERE id = ? AND tenant_id = ?
    ");
    $poStmt->execute([$poId, $tenantId]);
    $po = $poStmt->fetch();

    if (!$po) {
        jsonError('Purchase order not found', 404);
    }

    switch ($action) {
        case 'approve':
            $user = requireManager();
            if (!in_array($po['status'], ['draft', 'submitted'])) {
                jsonError('PO cannot be approved in its current status: ' . $po['status'], 400);
            }
            $pdo->prepare("
                UPDATE purchase_orders
                SET status = 'approved', approved_by = ?, approved_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ")->execute([$user['user_id'], $poId, $tenantId]);

            jsonResponse(['success' => true, 'message' => 'Purchase order approved']);
            break;

        case 'send':
            if (!in_array($po['status'], ['approved'])) {
                jsonError('PO must be approved before sending', 400);
            }
            $pdo->prepare("
                UPDATE purchase_orders
                SET status = 'sent', sent_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ")->execute([$poId, $tenantId]);

            jsonResponse(['success' => true, 'message' => 'Purchase order sent to supplier']);
            break;

        case 'cancel':
            if (in_array($po['status'], ['received', 'partial_received'])) {
                jsonError('Cannot cancel a PO that has received goods', 400);
            }
            $pdo->prepare("
                UPDATE purchase_orders
                SET status = 'cancelled'
                WHERE id = ? AND tenant_id = ?
            ")->execute([$poId, $tenantId]);

            jsonResponse(['success' => true, 'message' => 'Purchase order cancelled']);
            break;
    }
    exit;
}

jsonError('Method not allowed', 405);
