<?php
/**
 * KCL Stores — Goods Received Notes (GRN)
 * GET    /api/grn.php                — list GRNs
 * GET    /api/grn.php?id=X           — GRN detail with lines
 * GET    /api/grn.php?po_id=X        — PO lines for GRN creation (remaining qty)
 * POST   /api/grn.php                — create GRN from PO
 * PUT    /api/grn.php                — confirm GRN (manager+ only)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List, Detail, or PO Lines ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // ── PO lines for GRN creation ──
    if (!empty($_GET['po_id'])) {
        $poId = (int) $_GET['po_id'];

        // Verify PO belongs to tenant
        $poStmt = $pdo->prepare("
            SELECT po.id, po.po_number,
                   s.name AS supplier_name
            FROM purchase_orders po
            JOIN suppliers s ON po.supplier_id = s.id
            WHERE po.id = ? AND po.tenant_id = ?
        ");
        $poStmt->execute([$poId, $tenantId]);
        $po = $poStmt->fetch();

        if (!$po) {
            jsonError('Purchase order not found', 404);
        }

        // Get PO lines with remaining qty
        $linesStmt = $pdo->prepare("
            SELECT pol.id, pol.item_id,
                   i.item_code, i.name AS item_name,
                   pol.quantity, pol.received_qty,
                   (pol.quantity - pol.received_qty) AS remaining_qty,
                   pol.unit_price
            FROM purchase_order_lines pol
            JOIN items i ON pol.item_id = i.id
            WHERE pol.po_id = ? AND pol.tenant_id = ?
            AND (pol.quantity - pol.received_qty) > 0
            ORDER BY pol.id ASC
        ");
        $linesStmt->execute([$poId, $tenantId]);
        $lines = $linesStmt->fetchAll();

        jsonResponse([
            'purchase_order' => [
                'id'            => (int) $po['id'],
                'po_number'     => $po['po_number'],
                'supplier_name' => $po['supplier_name'],
            ],
            'lines' => array_map(function ($l) {
                return [
                    'id'            => (int) $l['id'],
                    'item_id'       => (int) $l['item_id'],
                    'item_code'     => $l['item_code'],
                    'item_name'     => $l['item_name'],
                    'quantity'      => (float) $l['quantity'],
                    'received_qty'  => (float) $l['received_qty'],
                    'remaining_qty' => (float) $l['remaining_qty'],
                    'unit_price'    => (float) $l['unit_price'],
                ];
            }, $lines),
        ]);
        exit;
    }

    // ── Detail by ID ──
    if (!empty($_GET['id'])) {
        $grnId = (int) $_GET['id'];

        $stmt = $pdo->prepare("
            SELECT g.id, g.grn_number, g.po_id,
                   po.po_number,
                   s.name AS supplier_name,
                   g.received_date, g.delivery_note_ref, g.notes,
                   g.status, g.total_value,
                   c.code AS camp_code, c.name AS camp_name,
                   ur.name AS received_by_name,
                   g.created_at,
                   g.confirmed_at, uc.name AS confirmed_by_name
            FROM grn g
            JOIN purchase_orders po ON g.po_id = po.id
            JOIN suppliers s ON po.supplier_id = s.id
            JOIN camps c ON g.camp_id = c.id
            LEFT JOIN users ur ON g.received_by = ur.id
            LEFT JOIN users uc ON g.confirmed_by = uc.id
            WHERE g.id = ? AND g.tenant_id = ?
        ");
        $stmt->execute([$grnId, $tenantId]);
        $grn = $stmt->fetch();

        if (!$grn) {
            jsonError('GRN not found', 404);
        }

        // Lines
        $linesStmt = $pdo->prepare("
            SELECT gl.id, gl.item_id,
                   i.item_code, i.name AS item_name,
                   pol.quantity AS ordered_qty,
                   gl.received_qty, gl.rejected_qty, gl.rejection_reason,
                   gl.unit_cost, gl.batch_number, gl.expiry_date,
                   gl.line_total
            FROM grn_lines gl
            JOIN items i ON gl.item_id = i.id
            LEFT JOIN purchase_order_lines pol ON gl.po_line_id = pol.id
            WHERE gl.grn_id = ? AND gl.tenant_id = ?
            ORDER BY gl.id ASC
        ");
        $linesStmt->execute([$grnId, $tenantId]);
        $lines = $linesStmt->fetchAll();

        jsonResponse([
            'grn' => [
                'id'                => (int) $grn['id'],
                'grn_number'        => $grn['grn_number'],
                'po_id'             => (int) $grn['po_id'],
                'po_number'         => $grn['po_number'],
                'supplier_name'     => $grn['supplier_name'],
                'received_date'     => $grn['received_date'],
                'delivery_note_ref' => $grn['delivery_note_ref'],
                'notes'             => $grn['notes'],
                'status'            => $grn['status'],
                'total_value'       => (float) $grn['total_value'],
                'camp_code'         => $grn['camp_code'],
                'camp_name'         => $grn['camp_name'],
                'received_by_name'  => $grn['received_by_name'],
                'created_at'        => $grn['created_at'],
                'confirmed_at'      => $grn['confirmed_at'],
                'confirmed_by_name' => $grn['confirmed_by_name'],
            ],
            'lines' => array_map(function ($l) {
                return [
                    'id'               => (int) $l['id'],
                    'item_id'          => (int) $l['item_id'],
                    'item_code'        => $l['item_code'],
                    'item_name'        => $l['item_name'],
                    'ordered_qty'      => (float) $l['ordered_qty'],
                    'received_qty'     => (float) $l['received_qty'],
                    'rejected_qty'     => (float) ($l['rejected_qty'] ?? 0),
                    'rejection_reason' => $l['rejection_reason'],
                    'unit_cost'        => (float) $l['unit_cost'],
                    'batch_number'     => $l['batch_number'],
                    'expiry_date'      => $l['expiry_date'],
                    'line_total'       => (float) $l['line_total'],
                ];
            }, $lines),
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
        $where[] = 'g.status = ?';
        $params[] = $status;
    }

    if ($search) {
        $where[] = '(g.grn_number LIKE ? OR po.po_number LIKE ? OR s.name LIKE ?)';
        $params[] = "%{$search}%";
        $params[] = "%{$search}%";
        $params[] = "%{$search}%";
    }

    tenantScope($where, $params, $tenantId, 'g');

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM grn g
        JOIN purchase_orders po ON g.po_id = po.id
        JOIN suppliers s ON po.supplier_id = s.id
        {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $stmt = $pdo->prepare("
        SELECT g.id, g.grn_number, g.po_id,
               po.po_number,
               s.name AS supplier_name,
               g.received_date, g.status, g.total_value,
               c.code AS camp_code, c.name AS camp_name,
               ur.name AS received_by_name,
               g.created_at
        FROM grn g
        JOIN purchase_orders po ON g.po_id = po.id
        JOIN suppliers s ON po.supplier_id = s.id
        JOIN camps c ON g.camp_id = c.id
        LEFT JOIN users ur ON g.received_by = ur.id
        {$whereClause}
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $grns = $stmt->fetchAll();

    jsonResponse([
        'grns' => array_map(function ($g) {
            return [
                'id'               => (int) $g['id'],
                'grn_number'       => $g['grn_number'],
                'po_id'            => (int) $g['po_id'],
                'po_number'        => $g['po_number'],
                'supplier_name'    => $g['supplier_name'],
                'received_date'    => $g['received_date'],
                'status'           => $g['status'],
                'total_value'      => (float) $g['total_value'],
                'camp_code'        => $g['camp_code'],
                'camp_name'        => $g['camp_name'],
                'received_by_name' => $g['received_by_name'],
                'created_at'       => $g['created_at'],
            ];
        }, $grns),
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create GRN from PO ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    requireFields($input, ['po_id', 'received_date', 'lines']);

    if (!is_array($input['lines']) || count($input['lines']) === 0) {
        jsonError('At least one GRN line is required', 400);
    }

    $poId = (int) $input['po_id'];

    // Validate PO exists, belongs to tenant, and is in valid status
    $poStmt = $pdo->prepare("
        SELECT po.id, po.po_number, po.status, po.supplier_id
        FROM purchase_orders po
        WHERE po.id = ? AND po.tenant_id = ?
    ");
    $poStmt->execute([$poId, $tenantId]);
    $po = $poStmt->fetch();

    if (!$po) {
        jsonError('Purchase order not found', 404);
    }

    if (!in_array($po['status'], ['approved', 'sent', 'partial_received'])) {
        jsonError('Purchase order is not in a valid status for receiving. Current status: ' . $po['status'], 400);
    }

    // Generate GRN number
    $grnNumber = generateDocNumber($pdo, 'GRN', '', $tenantId);

    $campId = $auth['camp_id'];
    if (!$campId) {
        jsonError('Must be assigned to a camp to create a GRN', 400);
    }

    $pdo->beginTransaction();
    try {
        // Insert GRN header
        $pdo->prepare("
            INSERT INTO grn (
                tenant_id, grn_number, po_id, camp_id,
                received_date, delivery_note_ref, notes,
                status, total_value, received_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, NOW())
        ")->execute([
            $tenantId, $grnNumber, $poId, $campId,
            $input['received_date'],
            $input['delivery_note_ref'] ?? null,
            $input['notes'] ?? null,
            $auth['user_id'],
        ]);

        $grnId = (int) $pdo->lastInsertId();
        $totalValue = 0;

        // Insert GRN lines
        $lineStmt = $pdo->prepare("
            INSERT INTO grn_lines (
                tenant_id, grn_id, po_line_id, item_id,
                received_qty, rejected_qty, rejection_reason,
                unit_cost, batch_number, expiry_date, line_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        // Update PO line received_qty
        $updatePolStmt = $pdo->prepare("
            UPDATE purchase_order_lines
            SET received_qty = received_qty + ?
            WHERE id = ? AND tenant_id = ?
        ");

        foreach ($input['lines'] as $line) {
            if (empty($line['item_id']) || empty($line['received_qty']) || $line['received_qty'] <= 0) continue;
            if (empty($line['po_line_id'])) continue;

            $itemId      = (int) $line['item_id'];
            $receivedQty = (float) $line['received_qty'];
            $rejectedQty = (float) ($line['rejected_qty'] ?? 0);
            $unitCost    = (float) ($line['unit_cost'] ?? 0);
            $lineTotal   = $receivedQty * $unitCost;
            $totalValue += $lineTotal;

            $lineStmt->execute([
                $tenantId, $grnId, (int) $line['po_line_id'], $itemId,
                $receivedQty, $rejectedQty, $line['rejection_reason'] ?? null,
                $unitCost, $line['batch_number'] ?? null, $line['expiry_date'] ?? null,
                $lineTotal,
            ]);

            // Update received_qty on PO line
            if (!empty($line['po_line_id'])) {
                $updatePolStmt->execute([$receivedQty, (int) $line['po_line_id'], $tenantId]);
            }
        }

        // Update GRN total_value
        $pdo->prepare("UPDATE grn SET total_value = ? WHERE id = ?")->execute([$totalValue, $grnId]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'grn'     => [
                'id'          => $grnId,
                'grn_number'  => $grnNumber,
                'total_value' => $totalValue,
            ],
        ], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('[API Error] grn POST: ' . $e->getMessage());
        jsonError('GRN creation failed: ' . $e->getMessage(), 500);
    }
    exit;
}

// ── PUT — Confirm GRN ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $user = requireManager();
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    requireFields($input, ['id', 'action']);

    if ($input['action'] !== 'confirm') {
        jsonError('Invalid action. Must be "confirm"', 400);
    }

    $grnId = (int) $input['id'];

    // Verify GRN exists, belongs to tenant, and is in draft status
    $grnStmt = $pdo->prepare("
        SELECT g.id, g.status, g.camp_id, g.po_id
        FROM grn g
        WHERE g.id = ? AND g.tenant_id = ?
    ");
    $grnStmt->execute([$grnId, $tenantId]);
    $grn = $grnStmt->fetch();

    if (!$grn) {
        jsonError('GRN not found', 404);
    }

    if ($grn['status'] !== 'draft') {
        jsonError('GRN has already been ' . $grn['status'], 400);
    }

    $campId = (int) $grn['camp_id'];
    $poId   = (int) $grn['po_id'];

    $pdo->beginTransaction();
    try {
        // Update GRN status
        $pdo->prepare("
            UPDATE grn
            SET status = 'confirmed', confirmed_by = ?, confirmed_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ")->execute([$user['user_id'], $grnId, $tenantId]);

        // Get GRN lines
        $linesStmt = $pdo->prepare("
            SELECT gl.item_id, gl.received_qty, gl.unit_cost, gl.line_total
            FROM grn_lines gl
            WHERE gl.grn_id = ? AND gl.tenant_id = ?
        ");
        $linesStmt->execute([$grnId, $tenantId]);
        $lines = $linesStmt->fetchAll();

        // Process each line: stock movement + stock balance upsert
        foreach ($lines as $line) {
            $itemId      = (int) $line['item_id'];
            $receivedQty = (float) $line['received_qty'];
            $unitCost    = (float) $line['unit_cost'];
            $lineTotal   = (float) $line['line_total'];

            // Check existing stock balance
            $balCheck = $pdo->prepare("
                SELECT id, current_qty, current_value
                FROM stock_balances
                WHERE item_id = ? AND camp_id = ? AND tenant_id = ?
            ");
            $balCheck->execute([$itemId, $campId, $tenantId]);
            $bal = $balCheck->fetch();

            if ($bal) {
                $newQty   = (float) $bal['current_qty'] + $receivedQty;
                $newValue = (float) $bal['current_value'] + $lineTotal;

                $pdo->prepare("
                    UPDATE stock_balances
                    SET current_qty = ?, current_value = ?,
                        unit_cost = CASE WHEN current_qty > 0 THEN current_value / current_qty ELSE ? END,
                        last_receipt_date = CURDATE(), updated_at = NOW()
                    WHERE id = ?
                ")->execute([$newQty, $newValue, $unitCost, $bal['id']]);

                $balanceAfter = $newQty;
            } else {
                $pdo->prepare("
                    INSERT INTO stock_balances (
                        tenant_id, camp_id, item_id, current_qty, current_value,
                        unit_cost, last_receipt_date, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), NOW())
                ")->execute([$tenantId, $campId, $itemId, $receivedQty, $lineTotal, $unitCost]);

                $balanceAfter = $receivedQty;
            }

            // Create stock movement
            $pdo->prepare("
                INSERT INTO stock_movements (
                    tenant_id, item_id, camp_id, movement_type, direction,
                    quantity, unit_cost, total_value, balance_after,
                    reference_type, reference_id, created_by, movement_date, created_at
                ) VALUES (?, ?, ?, 'receipt', 'in', ?, ?, ?, ?, 'grn', ?, ?, CURDATE(), NOW())
            ")->execute([
                $tenantId, $itemId, $campId,
                $receivedQty, $unitCost, $lineTotal, $balanceAfter,
                $grnId, $user['user_id'],
            ]);
        }

        // Check if PO is fully received
        $poLinesStmt = $pdo->prepare("
            SELECT SUM(quantity) AS total_ordered, SUM(received_qty) AS total_received
            FROM purchase_order_lines
            WHERE po_id = ? AND tenant_id = ?
        ");
        $poLinesStmt->execute([$poId, $tenantId]);
        $poTotals = $poLinesStmt->fetch();

        $totalOrdered  = (float) ($poTotals['total_ordered'] ?? 0);
        $totalReceived = (float) ($poTotals['total_received'] ?? 0);

        if ($totalOrdered > 0 && $totalReceived >= $totalOrdered) {
            $newPoStatus = 'received';
        } elseif ($totalReceived > 0) {
            $newPoStatus = 'partial_received';
        } else {
            $newPoStatus = null;
        }

        if ($newPoStatus) {
            $pdo->prepare("
                UPDATE purchase_orders SET status = ? WHERE id = ? AND tenant_id = ?
            ")->execute([$newPoStatus, $poId, $tenantId]);
        }

        $pdo->commit();

        jsonResponse(['success' => true, 'message' => 'GRN confirmed and stock updated']);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('[API Error] grn PUT confirm: ' . $e->getMessage());
        jsonError('An unexpected error occurred. Please try again.', 500);
    }
    exit;
}

jsonError('Method not allowed', 405);
