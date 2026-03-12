<?php
/**
 * KCL Stores — Bar Tabs / Bills
 * GET  /api/bar-tabs.php              — list open + recent tabs
 * GET  /api/bar-tabs.php?id=X         — tab detail with lines
 * POST /api/bar-tabs.php              — open tab / add items
 * PUT  /api/bar-tabs.php              — close / void / discount / transfer / merge / split / complimentary
 */

ini_set('display_errors', 0);
error_reporting(E_ALL);
set_error_handler(function($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
set_exception_handler(function($e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

$campId = $auth['camp_id'];
if (!$campId) jsonError('Bar tabs require camp assignment', 400);

// ── GET ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = (int) ($_GET['id'] ?? 0);

    // ── Tab Detail ──
    if ($id) {
        $stmt = $pdo->prepare("
            SELECT t.*, u_server.name as server_name, u_close.name as closed_by_name,
                   c.code as camp_code, c.name as camp_name,
                   s.shift_number
            FROM pos_tabs t
            LEFT JOIN users u_server ON t.server_id = u_server.id
            LEFT JOIN users u_close ON t.closed_by = u_close.id
            LEFT JOIN camps c ON t.camp_id = c.id
            LEFT JOIN pos_shifts s ON t.shift_id = s.id
            WHERE t.id = ? AND t.tenant_id = ?
        ");
        $stmt->execute([$id, $tenantId]);
        $tab = $stmt->fetch();
        if (!$tab) jsonError('Tab not found', 404);

        if (in_array($auth['role'], ['camp_storekeeper', 'camp_manager']) && (int)$tab['camp_id'] !== (int)$campId) {
            jsonError('Access denied', 403);
        }

        // Lines
        $linesStmt = $pdo->prepare("
            SELECT tl.*, i.item_code, i.name as item_name,
                   ig.name as group_name, u.code as uom,
                   uv.name as voided_by_name, ua.name as approved_by_name
            FROM pos_tab_lines tl
            JOIN items i ON tl.item_id = i.id
            LEFT JOIN item_groups ig ON i.item_group_id = ig.id
            LEFT JOIN units_of_measure u ON i.stock_uom_id = u.id
            LEFT JOIN users uv ON tl.voided_by = uv.id
            LEFT JOIN users ua ON tl.approved_by = ua.id
            WHERE tl.tab_id = ? AND tl.tenant_id = ?
            ORDER BY tl.round_number, tl.id
        ");
        $linesStmt->execute([$id, $tenantId]);
        $lines = $linesStmt->fetchAll();

        // Discounts
        $discStmt = $pdo->prepare("
            SELECT d.*, u.name as applied_by_name, ua.name as approved_by_name
            FROM pos_discounts d
            LEFT JOIN users u ON d.applied_by = u.id
            LEFT JOIN users ua ON d.approved_by = ua.id
            WHERE d.tab_id = ? AND d.tenant_id = ?
            ORDER BY d.created_at
        ");
        $discStmt->execute([$id, $tenantId]);
        $discounts = $discStmt->fetchAll();

        // Max round number
        $maxRound = 1;
        foreach ($lines as $l) {
            if ((int)$l['round_number'] > $maxRound) $maxRound = (int)$l['round_number'];
        }

        jsonResponse([
            'tab' => [
                'id' => (int)$tab['id'],
                'tab_number' => $tab['tab_number'],
                'tab_type' => $tab['tab_type'],
                'table_number' => $tab['table_number'],
                'room_number' => $tab['room_number'],
                'guest_name' => $tab['guest_name'],
                'covers' => (int)$tab['covers'],
                'server' => $tab['server_name'],
                'server_id' => (int)$tab['server_id'],
                'shift_number' => $tab['shift_number'],
                'status' => $tab['status'],
                'subtotal' => (float)$tab['subtotal'],
                'discount_amount' => (float)$tab['discount_amount'],
                'tax_amount' => (float)$tab['tax_amount'],
                'total' => (float)$tab['total'],
                'payment_method' => $tab['payment_method'],
                'payment_reference' => $tab['payment_reference'],
                'closed_by' => $tab['closed_by_name'],
                'closed_at' => $tab['closed_at'],
                'notes' => $tab['notes'],
                'created_at' => $tab['created_at'],
                'current_round' => $maxRound,
            ],
            'lines' => array_map(function($l) {
                return [
                    'id' => (int)$l['id'],
                    'item_id' => (int)$l['item_id'],
                    'item_code' => $l['item_code'],
                    'item_name' => $l['item_name'],
                    'group_name' => $l['group_name'],
                    'uom' => $l['uom'],
                    'quantity' => (float)$l['quantity'],
                    'unit_price' => (float)$l['unit_price'],
                    'line_total' => (float)$l['line_total'],
                    'round_number' => (int)$l['round_number'],
                    'is_voided' => (bool)$l['is_voided'],
                    'void_reason' => $l['void_reason'],
                    'voided_by' => $l['voided_by_name'],
                    'is_complimentary' => (bool)$l['is_complimentary'],
                    'complimentary_reason' => $l['complimentary_reason'],
                    'approved_by' => $l['approved_by_name'],
                    'notes' => $l['notes'],
                    'created_at' => $l['created_at'],
                ];
            }, $lines),
            'discounts' => array_map(function($d) {
                return [
                    'id' => (int)$d['id'],
                    'discount_type' => $d['discount_type'],
                    'discount_value' => (float)$d['discount_value'],
                    'discount_amount' => (float)$d['discount_amount'],
                    'reason' => $d['reason'],
                    'applied_by' => $d['applied_by_name'],
                    'approved_by' => $d['approved_by_name'],
                    'created_at' => $d['created_at'],
                ];
            }, $discounts),
        ]);
        exit;
    }

    // ── List tabs ──
    $status = $_GET['status'] ?? 'open';
    $serverId = $_GET['server_id'] ?? '';
    $shiftId = $_GET['shift_id'] ?? '';
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int)($_GET['per_page'] ?? 50)));
    $offset = ($page - 1) * $perPage;

    $where = ['t.tenant_id = ?', 't.camp_id = ?'];
    $params = [$tenantId, $campId];

    if ($status && $status !== 'all') {
        $where[] = 't.status = ?';
        $params[] = $status;
    }
    if ($serverId) {
        $where[] = 't.server_id = ?';
        $params[] = (int)$serverId;
    }
    if ($shiftId) {
        $where[] = 't.shift_id = ?';
        $params[] = (int)$shiftId;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM pos_tabs t {$whereClause}");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT t.*, u.name as server_name,
               (SELECT COUNT(*) FROM pos_tab_lines WHERE tab_id = t.id AND is_voided = 0) as item_count,
               (SELECT MAX(round_number) FROM pos_tab_lines WHERE tab_id = t.id) as current_round
        FROM pos_tabs t
        LEFT JOIN users u ON t.server_id = u.id
        {$whereClause}
        ORDER BY FIELD(t.status, 'open', 'closed', 'voided', 'merged'), t.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $tabs = $stmt->fetchAll();

    // Status counts for this camp
    $scStmt = $pdo->prepare("SELECT status, COUNT(*) as cnt FROM pos_tabs WHERE tenant_id = ? AND camp_id = ? GROUP BY status");
    $scStmt->execute([$tenantId, $campId]);
    $statusCounts = $scStmt->fetchAll(PDO::FETCH_KEY_PAIR);

    jsonResponse([
        'tabs' => array_map(function($t) {
            $elapsed = null;
            if ($t['status'] === 'open') {
                $opened = strtotime($t['created_at']);
                $elapsed = time() - $opened;
            }
            return [
                'id' => (int)$t['id'],
                'tab_number' => $t['tab_number'],
                'tab_type' => $t['tab_type'],
                'table_number' => $t['table_number'],
                'room_number' => $t['room_number'],
                'guest_name' => $t['guest_name'],
                'covers' => (int)$t['covers'],
                'server' => $t['server_name'],
                'status' => $t['status'],
                'subtotal' => (float)$t['subtotal'],
                'discount_amount' => (float)$t['discount_amount'],
                'total' => (float)$t['total'],
                'payment_method' => $t['payment_method'],
                'item_count' => (int)$t['item_count'],
                'current_round' => (int)($t['current_round'] ?? 1),
                'elapsed_seconds' => $elapsed,
                'created_at' => $t['created_at'],
            ];
        }, $tabs),
        'status_counts' => $statusCounts,
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int)ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Open Tab / Add Items ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $action = $input['action'] ?? '';

    // ── Open Tab ──
    if ($action === 'open') {
        $tabType = $input['tab_type'] ?? 'table';
        if (!in_array($tabType, ['table', 'room', 'guest', 'takeaway'])) {
            jsonError('Invalid tab type', 400);
        }

        // Get current open shift (optional — tabs can exist without a shift)
        $shiftId = null;
        $shiftStmt = $pdo->prepare("SELECT id FROM pos_shifts WHERE camp_id = ? AND tenant_id = ? AND status = 'open' LIMIT 1");
        $shiftStmt->execute([$campId, $tenantId]);
        $shiftRow = $shiftStmt->fetch();
        if ($shiftRow) $shiftId = (int)$shiftRow['id'];

        $campCodeStmt = $pdo->prepare("SELECT code FROM camps WHERE id = ? AND tenant_id = ?");
        $campCodeStmt->execute([$campId, $tenantId]);
        $campCode = $campCodeStmt->fetchColumn();
        $tabNumber = generateDocNumber($pdo, 'TAB', $campCode, $tenantId);

        $pdo->prepare("
            INSERT INTO pos_tabs (
                tenant_id, camp_id, shift_id, tab_number, tab_type,
                table_number, room_number, guest_name, covers,
                server_id, status, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, NOW())
        ")->execute([
            $tenantId, $campId, $shiftId, $tabNumber, $tabType,
            $input['table_number'] ?? null,
            $input['room_number'] ?? null,
            $input['guest_name'] ?? null,
            max(1, (int)($input['covers'] ?? 1)),
            $auth['user_id'],
            $input['notes'] ?? null,
        ]);

        $tabId = (int)$pdo->lastInsertId();

        jsonResponse([
            'message' => 'Tab opened',
            'tab' => [
                'id' => $tabId,
                'tab_number' => $tabNumber,
                'tab_type' => $tabType,
                'table_number' => $input['table_number'] ?? null,
                'status' => 'open',
            ],
        ], 201);
        exit;
    }

    // ── Add Items to Tab ──
    if ($action === 'add_items') {
        requireFields($input, ['tab_id', 'items']);

        $tabId = (int)$input['tab_id'];

        // Verify tab is open
        $tabStmt = $pdo->prepare("SELECT * FROM pos_tabs WHERE id = ? AND tenant_id = ? AND status = 'open'");
        $tabStmt->execute([$tabId, $tenantId]);
        $tab = $tabStmt->fetch();
        if (!$tab) jsonError('Tab not found or not open', 400);
        if ((int)$tab['camp_id'] !== (int)$campId) jsonError('Access denied', 403);

        if (!is_array($input['items']) || count($input['items']) === 0) {
            jsonError('Add at least one item', 400);
        }

        // Determine next round number
        $roundStmt = $pdo->prepare("SELECT COALESCE(MAX(round_number), 0) FROM pos_tab_lines WHERE tab_id = ? AND tenant_id = ?");
        $roundStmt->execute([$tabId, $tenantId]);
        $nextRound = (int)$roundStmt->fetchColumn() + 1;

        // Batch-fetch item prices
        $itemIds = array_filter(array_map(function($i) {
            return (!empty($i['item_id']) && !empty($i['qty']) && $i['qty'] > 0) ? (int)$i['item_id'] : null;
        }, $input['items']));
        $itemIds = array_values(array_unique($itemIds));

        if (count($itemIds) === 0) jsonError('No valid items provided', 400);

        $ph = implode(',', array_fill(0, count($itemIds), '?'));
        $itemStmt = $pdo->prepare("
            SELECT id, name, weighted_avg_cost, last_purchase_price
            FROM items WHERE id IN ({$ph}) AND tenant_id = ?
        ");
        $itemStmt->execute(array_merge($itemIds, [$tenantId]));
        $itemMap = [];
        foreach ($itemStmt->fetchAll() as $row) {
            $itemMap[(int)$row['id']] = $row;
        }

        // Try to get menu sell prices (bar_menu_items may link via ingredients, not item_id)
        $menuPriceMap = [];
        try {
            // Check if bar_menu_ingredients links menu items to inventory items
            $menuPriceStmt = $pdo->prepare("
                SELECT bmi.id as menu_item_id, bmi.price_usd, bming.item_id
                FROM bar_menu_ingredients bming
                JOIN bar_menu_items bmi ON bmi.id = bming.menu_item_id
                WHERE bming.item_id IN ({$ph}) AND bmi.is_active = 1
            ");
            $menuPriceStmt->execute($itemIds);
            foreach ($menuPriceStmt->fetchAll() as $row) {
                if ($row['item_id'] && $row['price_usd']) {
                    $menuPriceMap[(int)$row['item_id']] = (float)$row['price_usd'];
                }
            }
        } catch (Exception $e) {
            // Menu price lookup failed — proceed with cost price or explicit price
            error_log('[bar-tabs] Menu price lookup failed: ' . $e->getMessage());
        }

        $pdo->beginTransaction();
        try {
            $lineStmt = $pdo->prepare("
                INSERT INTO pos_tab_lines (tenant_id, tab_id, item_id, quantity, unit_price, line_total, round_number, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");

            $addedLines = 0;
            $roundTotal = 0;

            foreach ($input['items'] as $item) {
                if (empty($item['item_id']) || empty($item['qty']) || $item['qty'] <= 0) continue;

                $itemId = (int)$item['item_id'];
                $qty = (float)$item['qty'];
                $itemData = $itemMap[$itemId] ?? null;
                if (!$itemData) continue;

                // Use explicit price if provided, else menu sell_price, else cost price
                $unitPrice = isset($item['unit_price']) ? (float)$item['unit_price'] : 0;
                if (!$unitPrice && isset($menuPriceMap[$itemId])) {
                    $unitPrice = $menuPriceMap[$itemId];
                }
                if (!$unitPrice) {
                    $unitPrice = (float)($itemData['weighted_avg_cost'] ?: $itemData['last_purchase_price'] ?: 0);
                }

                $lineTotal = $qty * $unitPrice;
                $roundTotal += $lineTotal;
                $addedLines++;

                $lineStmt->execute([
                    $tenantId, $tabId, $itemId, $qty, $unitPrice, $lineTotal,
                    $nextRound, $item['notes'] ?? null,
                ]);
            }

            if ($addedLines === 0) {
                $pdo->rollBack();
                jsonError('No valid items added', 400);
            }

            // Update tab subtotal and total
            $pdo->prepare("
                UPDATE pos_tabs
                SET subtotal = subtotal + ?,
                    total = subtotal + ? - discount_amount + tax_amount,
                    updated_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ")->execute([$roundTotal, $roundTotal, $tabId, $tenantId]);

            // Re-read correct total
            $pdo->prepare("
                UPDATE pos_tabs SET total = subtotal - discount_amount + tax_amount WHERE id = ?
            ")->execute([$tabId]);

            $pdo->commit();

            // Get updated tab totals
            $updatedTab = $pdo->prepare("SELECT subtotal, discount_amount, total FROM pos_tabs WHERE id = ?");
            $updatedTab->execute([$tabId]);
            $updated = $updatedTab->fetch();

            jsonResponse([
                'message' => "{$addedLines} item(s) added to tab (Round {$nextRound})",
                'round' => $nextRound,
                'round_total' => $roundTotal,
                'tab_subtotal' => (float)$updated['subtotal'],
                'tab_total' => (float)$updated['total'],
            ], 201);

        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] bar-tabs add_items: ' . $e->getMessage());
            jsonError('An unexpected error occurred. Please try again.', 500);
        }
        exit;
    }

    jsonError('Invalid action. Use: open, add_items', 400);
    exit;
}

// ── PUT — Close / Void / Discount / Transfer / Merge / Split / Complimentary ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = getJsonInput();
    $action = $input['action'] ?? '';

    // ── Close Tab ──
    if ($action === 'close') {
        requireFields($input, ['tab_id', 'payment_method']);

        $tabId = (int)$input['tab_id'];
        $paymentMethod = $input['payment_method'];

        if (!in_array($paymentMethod, ['cash', 'card', 'room_charge', 'mpesa', 'split', 'complimentary'])) {
            jsonError('Invalid payment method', 400);
        }

        $tabStmt = $pdo->prepare("SELECT * FROM pos_tabs WHERE id = ? AND tenant_id = ? AND status = 'open'");
        $tabStmt->execute([$tabId, $tenantId]);
        $tab = $tabStmt->fetch();
        if (!$tab) jsonError('Tab not found or not open', 400);
        if ((int)$tab['camp_id'] !== (int)$campId) jsonError('Access denied', 403);

        // Get active lines for stock deduction
        $linesStmt = $pdo->prepare("
            SELECT tl.item_id, SUM(tl.quantity) as total_qty, SUM(tl.line_total) as total_value
            FROM pos_tab_lines tl
            WHERE tl.tab_id = ? AND tl.tenant_id = ? AND tl.is_voided = 0
            GROUP BY tl.item_id
        ");
        $linesStmt->execute([$tabId, $tenantId]);
        $aggregatedLines = $linesStmt->fetchAll();

        if (count($aggregatedLines) === 0) {
            jsonError('Cannot close an empty tab. Void it instead.', 400);
        }

        // Get cost center
        $ccStmt = $pdo->prepare("SELECT id FROM cost_centers WHERE code = 'BAR' AND tenant_id = ? LIMIT 1");
        $ccStmt->execute([$tenantId]);
        $costCenterId = $ccStmt->fetchColumn();
        if (!$costCenterId) {
            $ccFallback = $pdo->prepare("SELECT id FROM cost_centers WHERE is_active = 1 AND tenant_id = ? ORDER BY id LIMIT 1");
            $ccFallback->execute([$tenantId]);
            $costCenterId = $ccFallback->fetchColumn();
        }

        $campCodeStmt = $pdo->prepare("SELECT code FROM camps WHERE id = ? AND tenant_id = ?");
        $campCodeStmt->execute([$campId, $tenantId]);
        $campCode = $campCodeStmt->fetchColumn();
        $voucherNumber = generateDocNumber($pdo, 'BAR', $campCode, $tenantId);

        // Batch fetch item data for stock deduction
        $itemIds = array_map(function($l) { return (int)$l['item_id']; }, $aggregatedLines);
        $ph = implode(',', array_fill(0, count($itemIds), '?'));

        $itemDataStmt = $pdo->prepare("SELECT id, name, weighted_avg_cost, last_purchase_price FROM items WHERE id IN ({$ph}) AND tenant_id = ?");
        $itemDataStmt->execute(array_merge($itemIds, [$tenantId]));
        $itemCostMap = [];
        foreach ($itemDataStmt->fetchAll() as $row) {
            $itemCostMap[(int)$row['id']] = $row;
        }

        // Check for bar_menu_ingredients (recipe-based deduction)
        // bar_menu_items doesn't have item_id — ingredients link via bming.item_id
        // For tab lines that reference inventory items directly, check if they appear in any recipe
        $recipeMap = [];
        try {
            $menuIngStmt = $pdo->prepare("
                SELECT bming.item_id as ingredient_item_id, bming.qty_per_serving, bming.menu_item_id
                FROM bar_menu_ingredients bming
                WHERE bming.item_id IN ({$ph})
            ");
            $menuIngStmt->execute($itemIds);
            foreach ($menuIngStmt->fetchAll() as $row) {
                $recipeMap[(int)$row['ingredient_item_id']][] = $row;
            }
        } catch (Exception $e) {
            error_log('[bar-tabs] Recipe lookup failed: ' . $e->getMessage());
        }

        $pdo->beginTransaction();
        try {
            // Build tab description for voucher notes
            $tabDesc = "Tab {$tab['tab_number']}";
            if ($tab['table_number']) $tabDesc .= " (Table {$tab['table_number']})";
            if ($tab['guest_name']) $tabDesc .= " — {$tab['guest_name']}";

            // Create issue voucher
            $pdo->prepare("
                INSERT INTO issue_vouchers (
                    tenant_id, voucher_number, camp_id, issue_type, cost_center_id,
                    issue_date, issued_by, received_by_name, department,
                    room_numbers, guest_count, total_value, notes, status, created_at
                ) VALUES (?, ?, ?, 'kitchen', ?, CURDATE(), ?, ?, 'Bar', ?, ?, 0, ?, 'confirmed', NOW())
            ")->execute([
                $tenantId, $voucherNumber, $campId, (int)$costCenterId,
                $auth['user_id'],
                $tab['guest_name'] ?? 'Bar Tab',
                $tab['room_number'], $tab['covers'] ? (int)$tab['covers'] : null,
                $tabDesc,
            ]);
            $voucherId = (int)$pdo->lastInsertId();
            $totalValue = 0;

            $ivLineStmt = $pdo->prepare("
                INSERT INTO issue_voucher_lines (tenant_id, voucher_id, item_id, quantity, unit_cost, total_value, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");

            $deductStmt = $pdo->prepare("
                UPDATE stock_balances
                SET current_qty = GREATEST(0, current_qty - ?),
                    current_value = GREATEST(0, current_value - ?),
                    last_issue_date = CURDATE(), updated_at = NOW()
                WHERE camp_id = ? AND item_id = ?
            ");

            $balStmt = $pdo->prepare("SELECT current_qty FROM stock_balances WHERE camp_id = ? AND item_id = ?");

            $mvStmt = $pdo->prepare("
                INSERT INTO stock_movements (tenant_id, item_id, camp_id, movement_type, direction, quantity, unit_cost, total_value,
                    balance_after, reference_type, reference_id, cost_center_id, created_by, movement_date, created_at)
                VALUES (?, ?, ?, 'issue_kitchen', 'out', ?, ?, ?, ?, 'issue_voucher', ?, ?, ?, CURDATE(), NOW())
            ");

            foreach ($aggregatedLines as $aLine) {
                $itemId = (int)$aLine['item_id'];
                $totalQty = (float)$aLine['total_qty'];

                // Check if this item has recipe ingredients
                if (isset($recipeMap[$itemId])) {
                    // Recipe-based: deduct each ingredient
                    foreach ($recipeMap[$itemId] as $ing) {
                        $ingItemId = (int)$ing['ingredient_item_id'];
                        $deductQty = (float)$ing['qty_per_serving'] * $totalQty;
                        $ingData = $itemCostMap[$ingItemId] ?? null;

                        // Fetch ingredient cost if not in batch
                        if (!$ingData) {
                            $ingCostStmt = $pdo->prepare("SELECT id, name, weighted_avg_cost, last_purchase_price FROM items WHERE id = ?");
                            $ingCostStmt->execute([$ingItemId]);
                            $ingData = $ingCostStmt->fetch();
                        }

                        $unitCost = $ingData ? (float)($ingData['weighted_avg_cost'] ?: $ingData['last_purchase_price'] ?: 0) : 0;
                        $lineValue = $deductQty * $unitCost;
                        $totalValue += $lineValue;

                        $ivLineStmt->execute([$tenantId, $voucherId, $ingItemId, $deductQty, $unitCost, $lineValue, $tabDesc]);
                        $deductStmt->execute([$deductQty, $lineValue, $campId, $ingItemId]);

                        $balStmt->execute([$campId, $ingItemId]);
                        $balAfter = (float)($balStmt->fetchColumn() ?: 0);

                        $mvStmt->execute([$tenantId, $ingItemId, $campId, $deductQty, $unitCost, $lineValue, $balAfter,
                            $voucherId, (int)$costCenterId, $auth['user_id']]);
                    }
                } else {
                    // Direct item deduction
                    $itemData = $itemCostMap[$itemId] ?? null;
                    $unitCost = $itemData ? (float)($itemData['weighted_avg_cost'] ?: $itemData['last_purchase_price'] ?: 0) : 0;
                    $lineValue = $totalQty * $unitCost;
                    $totalValue += $lineValue;

                    $ivLineStmt->execute([$tenantId, $voucherId, $itemId, $totalQty, $unitCost, $lineValue, $tabDesc]);
                    $deductStmt->execute([$totalQty, $lineValue, $campId, $itemId]);

                    $balStmt->execute([$campId, $itemId]);
                    $balAfter = (float)($balStmt->fetchColumn() ?: 0);

                    $mvStmt->execute([$tenantId, $itemId, $campId, $totalQty, $unitCost, $lineValue, $balAfter,
                        $voucherId, (int)$costCenterId, $auth['user_id']]);
                }
            }

            // Update issue voucher total
            $pdo->prepare("UPDATE issue_vouchers SET total_value = ? WHERE id = ?")->execute([$totalValue, $voucherId]);

            // Close tab
            $pdo->prepare("
                UPDATE pos_tabs
                SET status = 'closed', payment_method = ?, payment_reference = ?,
                    issue_voucher_id = ?, closed_at = NOW(), closed_by = ?, updated_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ")->execute([
                $paymentMethod, $input['payment_reference'] ?? null,
                $voucherId, $auth['user_id'],
                $tabId, $tenantId,
            ]);

            $pdo->commit();

            jsonResponse([
                'message' => 'Tab closed and stock deducted',
                'tab' => [
                    'id' => $tabId,
                    'tab_number' => $tab['tab_number'],
                    'total' => (float)$tab['total'],
                    'payment_method' => $paymentMethod,
                    'status' => 'closed',
                ],
                'voucher' => [
                    'id' => $voucherId,
                    'voucher_number' => $voucherNumber,
                    'total_value' => $totalValue,
                ],
            ]);

        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] bar-tabs close: ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
            jsonError('An unexpected error occurred. Please try again.', 500);
        }
        exit;
    }

    // ── Void Line ──
    if ($action === 'void_line') {
        requireFields($input, ['line_id', 'reason']);

        $lineId = (int)$input['line_id'];
        $reason = trim($input['reason']);

        $lineStmt = $pdo->prepare("
            SELECT tl.*, t.status as tab_status, t.camp_id
            FROM pos_tab_lines tl
            JOIN pos_tabs t ON tl.tab_id = t.id
            WHERE tl.id = ? AND tl.tenant_id = ?
        ");
        $lineStmt->execute([$lineId, $tenantId]);
        $line = $lineStmt->fetch();

        if (!$line) jsonError('Line not found', 404);
        if ($line['tab_status'] !== 'open') jsonError('Cannot void items on a closed tab', 400);
        if ($line['is_voided']) jsonError('Line already voided', 400);
        if ((int)$line['camp_id'] !== (int)$campId) jsonError('Access denied', 403);

        $pdo->beginTransaction();
        try {
            $pdo->prepare("
                UPDATE pos_tab_lines SET is_voided = 1, void_reason = ?, voided_by = ? WHERE id = ?
            ")->execute([$reason, $auth['user_id'], $lineId]);

            // Log void
            $pdo->prepare("
                INSERT INTO pos_voids (tenant_id, reference_type, reference_id, original_amount, reason, voided_by, created_at)
                VALUES (?, 'tab_line', ?, ?, ?, ?, NOW())
            ")->execute([$tenantId, $lineId, (float)$line['line_total'], $reason, $auth['user_id']]);

            // Update tab totals
            $tabId = (int)$line['tab_id'];
            $pdo->prepare("
                UPDATE pos_tabs
                SET subtotal = GREATEST(0, subtotal - ?),
                    total = GREATEST(0, subtotal - ? - discount_amount + tax_amount),
                    updated_at = NOW()
                WHERE id = ?
            ")->execute([(float)$line['line_total'], (float)$line['line_total'], $tabId]);

            $pdo->prepare("UPDATE pos_tabs SET total = subtotal - discount_amount + tax_amount WHERE id = ?")->execute([$tabId]);

            $pdo->commit();

            jsonResponse(['message' => 'Line voided', 'voided_amount' => (float)$line['line_total']]);

        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] bar-tabs void_line: ' . $e->getMessage());
            jsonError('An unexpected error occurred.', 500);
        }
        exit;
    }

    // ── Void Tab ──
    if ($action === 'void_tab') {
        $user = requireManager();
        requireFields($input, ['tab_id', 'reason']);

        $tabId = (int)$input['tab_id'];
        $reason = trim($input['reason']);

        $tabStmt = $pdo->prepare("SELECT * FROM pos_tabs WHERE id = ? AND tenant_id = ? AND status = 'open'");
        $tabStmt->execute([$tabId, $tenantId]);
        $tab = $tabStmt->fetch();
        if (!$tab) jsonError('Tab not found or not open', 400);

        $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE pos_tabs SET status = 'voided', notes = CONCAT(COALESCE(notes, ''), ' [VOIDED: ', ?, ']'), updated_at = NOW() WHERE id = ?")->execute([$reason, $tabId]);

            $pdo->prepare("
                INSERT INTO pos_voids (tenant_id, reference_type, reference_id, original_amount, reason, voided_by, approved_by, created_at)
                VALUES (?, 'tab', ?, ?, ?, ?, ?, NOW())
            ")->execute([$tenantId, $tabId, (float)$tab['total'], $reason, $auth['user_id'], $user['user_id']]);

            $pdo->commit();
            jsonResponse(['message' => 'Tab voided', 'voided_amount' => (float)$tab['total']]);

        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] bar-tabs void_tab: ' . $e->getMessage());
            jsonError('An unexpected error occurred.', 500);
        }
        exit;
    }

    // ── Discount ──
    if ($action === 'discount') {
        requireFields($input, ['tab_id', 'discount_type', 'discount_value', 'reason']);

        $tabId = (int)$input['tab_id'];
        $discType = $input['discount_type'];
        $discValue = (float)$input['discount_value'];
        $reason = trim($input['reason']);

        if (!in_array($discType, ['percentage', 'fixed'])) jsonError('Invalid discount type', 400);
        if ($discValue <= 0) jsonError('Discount value must be positive', 400);

        $tabStmt = $pdo->prepare("SELECT * FROM pos_tabs WHERE id = ? AND tenant_id = ? AND status = 'open'");
        $tabStmt->execute([$tabId, $tenantId]);
        $tab = $tabStmt->fetch();
        if (!$tab) jsonError('Tab not found or not open', 400);

        $subtotal = (float)$tab['subtotal'];
        $discAmount = $discType === 'percentage'
            ? round($subtotal * min($discValue, 100) / 100, 2)
            : min($discValue, $subtotal);

        $pdo->beginTransaction();
        try {
            $pdo->prepare("
                INSERT INTO pos_discounts (tenant_id, tab_id, discount_type, discount_value, discount_amount, reason, applied_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ")->execute([$tenantId, $tabId, $discType, $discValue, $discAmount, $reason, $auth['user_id']]);

            // Update tab
            $newDiscTotal = (float)$tab['discount_amount'] + $discAmount;
            $newTotal = $subtotal - $newDiscTotal + (float)$tab['tax_amount'];

            $pdo->prepare("
                UPDATE pos_tabs SET discount_amount = ?, total = ?, updated_at = NOW() WHERE id = ?
            ")->execute([$newDiscTotal, max(0, $newTotal), $tabId]);

            $pdo->commit();

            jsonResponse([
                'message' => 'Discount applied',
                'discount_amount' => $discAmount,
                'new_total' => max(0, $newTotal),
            ]);

        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] bar-tabs discount: ' . $e->getMessage());
            jsonError('An unexpected error occurred.', 500);
        }
        exit;
    }

    // ── Transfer ──
    if ($action === 'transfer') {
        requireFields($input, ['tab_id']);

        $tabId = (int)$input['tab_id'];

        $tabStmt = $pdo->prepare("SELECT * FROM pos_tabs WHERE id = ? AND tenant_id = ? AND status = 'open'");
        $tabStmt->execute([$tabId, $tenantId]);
        $tab = $tabStmt->fetch();
        if (!$tab) jsonError('Tab not found or not open', 400);

        $updates = [];
        $params = [];

        if (isset($input['table_number'])) { $updates[] = 'table_number = ?'; $params[] = $input['table_number']; }
        if (isset($input['server_id'])) { $updates[] = 'server_id = ?'; $params[] = (int)$input['server_id']; }
        if (isset($input['room_number'])) { $updates[] = 'room_number = ?'; $params[] = $input['room_number']; }
        if (isset($input['guest_name'])) { $updates[] = 'guest_name = ?'; $params[] = $input['guest_name']; }

        if (empty($updates)) jsonError('Nothing to transfer — provide table_number, server_id, room_number, or guest_name', 400);

        $updates[] = 'updated_at = NOW()';
        $params[] = $tabId;
        $params[] = $tenantId;

        $pdo->prepare("UPDATE pos_tabs SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?")->execute($params);

        jsonResponse(['message' => 'Tab transferred']);
        exit;
    }

    // ── Merge ──
    if ($action === 'merge') {
        requireFields($input, ['source_tab_id', 'target_tab_id']);

        $sourceId = (int)$input['source_tab_id'];
        $targetId = (int)$input['target_tab_id'];

        if ($sourceId === $targetId) jsonError('Cannot merge a tab into itself', 400);

        $srcStmt = $pdo->prepare("SELECT * FROM pos_tabs WHERE id = ? AND tenant_id = ? AND status = 'open'");
        $srcStmt->execute([$sourceId, $tenantId]);
        $src = $srcStmt->fetch();

        $tgtStmt = $pdo->prepare("SELECT * FROM pos_tabs WHERE id = ? AND tenant_id = ? AND status = 'open'");
        $tgtStmt->execute([$targetId, $tenantId]);
        $tgt = $tgtStmt->fetch();

        if (!$src) jsonError('Source tab not found or not open', 400);
        if (!$tgt) jsonError('Target tab not found or not open', 400);

        $pdo->beginTransaction();
        try {
            // Move lines to target
            $pdo->prepare("UPDATE pos_tab_lines SET tab_id = ? WHERE tab_id = ? AND tenant_id = ?")->execute([$targetId, $sourceId, $tenantId]);

            // Move discounts
            $pdo->prepare("UPDATE pos_discounts SET tab_id = ? WHERE tab_id = ? AND tenant_id = ?")->execute([$targetId, $sourceId, $tenantId]);

            // Update target totals
            $pdo->prepare("
                UPDATE pos_tabs
                SET subtotal = subtotal + ?,
                    discount_amount = discount_amount + ?,
                    total = (subtotal + ?) - (discount_amount + ?) + tax_amount,
                    updated_at = NOW()
                WHERE id = ?
            ")->execute([
                (float)$src['subtotal'], (float)$src['discount_amount'],
                (float)$src['subtotal'], (float)$src['discount_amount'],
                $targetId,
            ]);

            $pdo->prepare("UPDATE pos_tabs SET total = subtotal - discount_amount + tax_amount WHERE id = ?")->execute([$targetId]);

            // Void source
            $pdo->prepare("UPDATE pos_tabs SET status = 'merged', notes = CONCAT(COALESCE(notes, ''), ' [Merged into ', ?, ']'), updated_at = NOW() WHERE id = ?")->execute([$tgt['tab_number'], $sourceId]);

            $pdo->commit();

            jsonResponse(['message' => "Tab {$src['tab_number']} merged into {$tgt['tab_number']}"]);

        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] bar-tabs merge: ' . $e->getMessage());
            jsonError('An unexpected error occurred.', 500);
        }
        exit;
    }

    // ── Split ──
    if ($action === 'split') {
        requireFields($input, ['tab_id', 'line_ids']);

        $tabId = (int)$input['tab_id'];

        $tabStmt = $pdo->prepare("SELECT * FROM pos_tabs WHERE id = ? AND tenant_id = ? AND status = 'open'");
        $tabStmt->execute([$tabId, $tenantId]);
        $tab = $tabStmt->fetch();
        if (!$tab) jsonError('Tab not found or not open', 400);

        $lineIds = array_map('intval', $input['line_ids']);
        if (count($lineIds) === 0) jsonError('Select lines to split', 400);

        $pdo->beginTransaction();
        try {
            // Create new tab
            $campCodeStmt = $pdo->prepare("SELECT code FROM camps WHERE id = ? AND tenant_id = ?");
            $campCodeStmt->execute([$campId, $tenantId]);
            $campCode = $campCodeStmt->fetchColumn();
            $newTabNumber = generateDocNumber($pdo, 'TAB', $campCode, $tenantId);

            $pdo->prepare("
                INSERT INTO pos_tabs (
                    tenant_id, camp_id, shift_id, tab_number, tab_type,
                    table_number, room_number, guest_name, covers,
                    server_id, status, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, NOW())
            ")->execute([
                $tenantId, $campId, $tab['shift_id'], $newTabNumber, $tab['tab_type'],
                $tab['table_number'], $tab['room_number'],
                ($input['guest_name'] ?? $tab['guest_name']),
                max(1, (int)($input['covers'] ?? 1)),
                $auth['user_id'],
                "Split from {$tab['tab_number']}",
            ]);
            $newTabId = (int)$pdo->lastInsertId();

            // Move selected lines
            $ph = implode(',', array_fill(0, count($lineIds), '?'));
            $pdo->prepare("UPDATE pos_tab_lines SET tab_id = ? WHERE id IN ({$ph}) AND tab_id = ? AND tenant_id = ?")->execute(
                array_merge([$newTabId], $lineIds, [$tabId, $tenantId])
            );

            // Recalculate both tabs
            foreach ([$tabId, $newTabId] as $tid) {
                $sumStmt = $pdo->prepare("SELECT COALESCE(SUM(line_total), 0) FROM pos_tab_lines WHERE tab_id = ? AND is_voided = 0");
                $sumStmt->execute([$tid]);
                $newSubtotal = (float)$sumStmt->fetchColumn();

                $pdo->prepare("UPDATE pos_tabs SET subtotal = ?, total = ? - discount_amount + tax_amount, updated_at = NOW() WHERE id = ?")->execute([$newSubtotal, $newSubtotal, $tid]);
            }

            $pdo->commit();

            jsonResponse([
                'message' => "Split {$tab['tab_number']} → new tab {$newTabNumber}",
                'new_tab' => [
                    'id' => $newTabId,
                    'tab_number' => $newTabNumber,
                ],
            ]);

        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] bar-tabs split: ' . $e->getMessage());
            jsonError('An unexpected error occurred.', 500);
        }
        exit;
    }

    // ── Complimentary ──
    if ($action === 'complimentary') {
        requireFields($input, ['line_id', 'reason']);

        $lineId = (int)$input['line_id'];
        $reason = trim($input['reason']);

        $lineStmt = $pdo->prepare("
            SELECT tl.*, t.status as tab_status
            FROM pos_tab_lines tl
            JOIN pos_tabs t ON tl.tab_id = t.id
            WHERE tl.id = ? AND tl.tenant_id = ?
        ");
        $lineStmt->execute([$lineId, $tenantId]);
        $line = $lineStmt->fetch();

        if (!$line) jsonError('Line not found', 404);
        if ($line['tab_status'] !== 'open') jsonError('Cannot modify a closed tab', 400);
        if ($line['is_voided']) jsonError('Line is voided', 400);
        if ($line['is_complimentary']) jsonError('Line already complimentary', 400);

        $pdo->beginTransaction();
        try {
            $pdo->prepare("
                UPDATE pos_tab_lines
                SET is_complimentary = 1, complimentary_reason = ?, approved_by = ?,
                    line_total = 0, unit_price = 0
                WHERE id = ?
            ")->execute([$reason, $auth['user_id'], $lineId]);

            // Update tab totals
            $tabId = (int)$line['tab_id'];
            $pdo->prepare("
                UPDATE pos_tabs
                SET subtotal = GREATEST(0, subtotal - ?),
                    updated_at = NOW()
                WHERE id = ?
            ")->execute([(float)$line['line_total'], $tabId]);

            $pdo->prepare("UPDATE pos_tabs SET total = subtotal - discount_amount + tax_amount WHERE id = ?")->execute([$tabId]);

            $pdo->commit();

            jsonResponse(['message' => 'Line marked as complimentary', 'comp_amount' => (float)$line['line_total']]);

        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[API Error] bar-tabs complimentary: ' . $e->getMessage());
            jsonError('An unexpected error occurred.', 500);
        }
        exit;
    }

    jsonError('Invalid action. Use: close, void_line, void_tab, discount, transfer, merge, split, complimentary', 400);
    exit;
}

jsonError('Method not allowed', 405);
