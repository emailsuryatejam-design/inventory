<?php
/**
 * WebSquare — Kitchen Requisitions API
 * Ported from Karibu Pantry Planner (1,075 lines → adapted for multi-tenant)
 *
 * Actions:
 *   list                     — list requisitions for a date/kitchen
 *   get                      — single requisition with lines
 *   auto_create_for_date     — create draft requisitions for all active types
 *   create_supplementary     — supplementary order for same meal type
 *   create                   — create new draft requisition
 *   save_lines               — save/update lines (bulk, legacy)
 *   submit                   — draft → submitted
 *   fulfill                  — storekeeper fills the order
 *   confirm_receipt           — chef confirms receipt
 *   close                    — close single or all for date
 *   close_with_unused        — close with unused qty return
 *   update_unused            — update unused on already-closed
 *   dashboard_stats          — chef dashboard counts
 *   store_stats              — storekeeper dashboard counts
 *   day_summary              — full day summary with lines
 *   get_items                — items for requisition form
 *   search_recipes           — recipe search
 *   get_recipe_ingredients   — recipe with ingredients + stock
 *   add_single_dish          — add one dish to a requisition
 *   save_dish_lines          — save dish-based requisition lines (aggregated)
 *   get_dishes_with_ingredients — dishes + batch ingredients
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
require_once __DIR__ . '/lib/push-sender.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$userId = $auth['user_id'];
$userRole = $auth['role'] ?? '';
$pdo = getDB();

$action = $_GET['action'] ?? 'list';

// Helper: get user's kitchen_id from the users table
function getUserKitchenId($pdo, $userId) {
    try {
        $stmt = $pdo->prepare("SELECT kitchen_id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ? (int)$row['kitchen_id'] : 0;
    } catch (Exception $e) {
        // Column may not exist yet — return 0 (will use kitchen_id from request params)
        return 0;
    }
}

$kitchenId = getUserKitchenId($pdo, $userId);

switch ($action) {

    // ── List requisitions for a date/kitchen ──
    case 'list':
        $date = $_GET['date'] ?? date('Y-m-d');
        $status = $_GET['status'] ?? '';
        $kid = (int)($_GET['kitchen_id'] ?? $kitchenId);

        $sql = "SELECT r.*, u.name AS chef_name,
                (SELECT COUNT(*) FROM kitchen_requisition_lines WHERE requisition_id = r.id) AS line_count
                FROM kitchen_requisitions r
                LEFT JOIN users u ON u.id = r.created_by
                WHERE r.tenant_id = ? AND r.req_date = ? AND r.kitchen_id = ?";
        $params = [$tenantId, $date, $kid];

        if ($status) {
            $sql .= " AND r.status = ?";
            $params[] = $status;
        }
        $sql .= " ORDER BY r.session_number ASC, r.supplement_number ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(['requisitions' => $stmt->fetchAll()]);

    // ── Get single requisition with lines ──
    case 'get':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('Requisition ID required');

        if (in_array($userRole, ['admin', 'director'])) {
            $stmt = $pdo->prepare("SELECT r.*, u.name AS chef_name FROM kitchen_requisitions r LEFT JOIN users u ON u.id = r.created_by WHERE r.id = ? AND r.tenant_id = ?");
            $stmt->execute([$id, $tenantId]);
        } else {
            $stmt = $pdo->prepare("SELECT r.*, u.name AS chef_name FROM kitchen_requisitions r LEFT JOIN users u ON u.id = r.created_by WHERE r.id = ? AND r.tenant_id = ? AND r.kitchen_id = ?");
            $stmt->execute([$id, $tenantId, $kitchenId]);
        }
        $req = $stmt->fetch();
        if (!$req) jsonError('Requisition not found', 404);

        $lines = $pdo->prepare("SELECT rl.*, 0 AS current_stock FROM kitchen_requisition_lines rl LEFT JOIN items i ON i.id = rl.item_id WHERE rl.requisition_id = ? ORDER BY rl.item_name");
        $lines->execute([$id]);

        jsonResponse(['requisition' => $req, 'lines' => $lines->fetchAll()]);

    // ── Auto-create requisitions for all active types on a date ──
    case 'auto_create_for_date':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();

        $reqDate = $data['req_date'] ?? date('Y-m-d');
        $kid = (int)($data['kitchen_id'] ?? $kitchenId);
        $guestCount = (int)($data['guest_count'] ?? 20);
        if (!$kid) jsonError('Kitchen ID required');

        // Get active types
        $types = $pdo->prepare("SELECT id, name, code, sort_order FROM requisition_types WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order, name");
        $types->execute([$tenantId]);
        $types = $types->fetchAll();

        if (empty($types)) {
            jsonError('No requisition types configured. Ask admin to add types.');
        }

        $created = 0;
        $insertStmt = $pdo->prepare("INSERT IGNORE INTO kitchen_requisitions
            (tenant_id, kitchen_id, req_date, session_number, guest_count, meals, supplement_number, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'draft', ?)");

        foreach ($types as $type) {
            $insertStmt->execute([$tenantId, $kid, $reqDate, $type['sort_order'], $guestCount, $type['code'], $userId]);
            if ($insertStmt->rowCount() > 0) $created++;
        }

        // Return all requisitions for this date
        $stmt = $pdo->prepare("SELECT r.*, u.name AS chef_name,
            (SELECT COUNT(*) FROM kitchen_requisition_lines WHERE requisition_id = r.id) AS line_count
            FROM kitchen_requisitions r LEFT JOIN users u ON u.id = r.created_by
            WHERE r.tenant_id = ? AND r.req_date = ? AND r.kitchen_id = ?
            ORDER BY r.session_number ASC, r.supplement_number ASC");
        $stmt->execute([$tenantId, $reqDate, $kid]);

        jsonResponse(['requisitions' => $stmt->fetchAll(), 'created' => $created]);

    // ── Create supplementary order for same meal type ──
    case 'create_supplementary':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();

        $parentId = (int)($data['parent_id'] ?? 0);
        if (!$parentId) jsonError('Parent requisition ID required');

        $parentStmt = $pdo->prepare("SELECT * FROM kitchen_requisitions WHERE id = ? AND tenant_id = ? AND kitchen_id = ?");
        $parentStmt->execute([$parentId, $tenantId, $kitchenId]);
        $parent = $parentStmt->fetch();
        if (!$parent) jsonError('Parent requisition not found');

        if ($parent['status'] === 'draft') jsonError('Cannot create supplementary for a draft order. Submit the original first.');

        $maxStmt = $pdo->prepare("SELECT COALESCE(MAX(supplement_number), 0) + 1 AS next_supp FROM kitchen_requisitions WHERE tenant_id = ? AND kitchen_id = ? AND req_date = ? AND meals = ?");
        $maxStmt->execute([$tenantId, $parent['kitchen_id'], $parent['req_date'], $parent['meals']]);
        $nextSupp = (int)$maxStmt->fetch()['next_supp'];

        $insertStmt = $pdo->prepare("INSERT INTO kitchen_requisitions
            (tenant_id, kitchen_id, req_date, session_number, guest_count, meals, supplement_number, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)");
        $insertStmt->execute([
            $tenantId, $parent['kitchen_id'], $parent['req_date'], $parent['session_number'],
            $parent['guest_count'], $parent['meals'], $nextSupp, $userId
        ]);
        $newId = $pdo->lastInsertId();

        $allStmt = $pdo->prepare("SELECT r.*, u.name AS chef_name,
            (SELECT COUNT(*) FROM kitchen_requisition_lines WHERE requisition_id = r.id) AS line_count
            FROM kitchen_requisitions r LEFT JOIN users u ON u.id = r.created_by
            WHERE r.tenant_id = ? AND r.req_date = ? AND r.kitchen_id = ?
            ORDER BY r.session_number ASC, r.supplement_number ASC");
        $allStmt->execute([$tenantId, $parent['req_date'], $parent['kitchen_id']]);

        jsonResponse(['requisition_id' => $newId, 'requisitions' => $allStmt->fetchAll()]);

    // ── Create new draft requisition ──
    case 'create':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();

        $reqDate = $data['req_date'] ?? date('Y-m-d');
        $kid = (int)($data['kitchen_id'] ?? $kitchenId);
        $guestCount = (int)($data['guest_count'] ?? 20);
        $meals = $data['meals'] ?? 'lunch';
        if (is_array($meals)) $meals = implode(',', $meals);

        if (!$kid) jsonError('Kitchen ID required');

        $stmt = $pdo->prepare("SELECT COALESCE(MAX(session_number), 0) + 1 AS next_session FROM kitchen_requisitions WHERE tenant_id = ? AND req_date = ? AND kitchen_id = ?");
        $stmt->execute([$tenantId, $reqDate, $kid]);
        $sessionNum = (int)$stmt->fetch()['next_session'];

        $stmt = $pdo->prepare("INSERT INTO kitchen_requisitions (tenant_id, kitchen_id, req_date, session_number, guest_count, meals, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)");
        $stmt->execute([$tenantId, $kid, $reqDate, $sessionNum, $guestCount, $meals, $userId]);
        $reqId = $pdo->lastInsertId();

        jsonResponse(['requisition_id' => $reqId, 'session_number' => $sessionNum]);

    // ── Save/update lines (bulk) ──
    case 'save_lines':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();

        $reqId = (int)($data['requisition_id'] ?? 0);
        $lines = $data['lines'] ?? [];
        if (!$reqId) jsonError('Requisition ID required');

        $stmt = $pdo->prepare("SELECT * FROM kitchen_requisitions WHERE id = ? AND tenant_id = ? AND status = 'draft'");
        $stmt->execute([$reqId, $tenantId]);
        $req = $stmt->fetch();
        if (!$req) jsonError('Requisition not found or not in draft status');

        $pdo->prepare("DELETE FROM kitchen_requisition_lines WHERE requisition_id = ?")->execute([$reqId]);

        // Batch-load items
        $itemIds = array_filter(array_map(fn($l) => (int)($l['item_id'] ?? 0), $lines));
        $itemMap = [];
        if ($itemIds) {
            $ph = implode(',', array_fill(0, count($itemIds), '?'));
            $bStmt = $pdo->prepare("SELECT i.id, i.name, 0 AS stock_qty, 0 AS portion_weight, 'direct_kg' AS order_mode, COALESCE(u.code, 'EA') AS uom FROM items i LEFT JOIN units_of_measure u ON i.stock_uom_id = u.id WHERE i.tenant_id = ? AND i.id IN ($ph)");
            $bStmt->execute(array_merge([$tenantId], array_values($itemIds)));
            foreach ($bStmt->fetchAll() as $it) {
                $itemMap[(int)$it['id']] = $it;
            }
        }

        $insertStmt = $pdo->prepare("INSERT INTO kitchen_requisition_lines
            (requisition_id, item_id, item_name, meal, order_mode, portions, portion_weight, required_kg, stock_qty, order_qty, uom)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        $totalItems = 0;
        $totalKg = 0;

        foreach ($lines as $line) {
            $itemId = (int)$line['item_id'];
            $item = $itemMap[$itemId] ?? null;
            if (!$item) continue;

            $orderMode = $item['order_mode'];
            $portionWeight = (float)$item['portion_weight'];
            $stockQty = (float)$item['stock_qty'];
            $meal = $line['meal'] ?? 'lunch';

            if ($orderMode === 'direct_kg') {
                $requiredKg = (float)($line['direct_kg'] ?? 0);
                $portions = 0;
            } else {
                $portions = (int)($line['portions'] ?? 0);
                $requiredKg = $portions * $portionWeight;
            }

            $requiredKg = ceil($requiredKg * 2) / 2;
            $orderQty = max(0, $requiredKg - $stockQty);
            $orderQty = ceil($orderQty * 2) / 2;

            if ($requiredKg <= 0) continue;

            $insertStmt->execute([
                $reqId, $itemId, $item['name'], $meal, $orderMode,
                $portions, $portionWeight, $requiredKg, $stockQty, $orderQty, $item['uom']
            ]);

            $totalItems++;
            $totalKg += $orderQty;
        }

        jsonResponse(['saved' => true, 'total_items' => $totalItems, 'total_kg' => round($totalKg, 2)]);

    // ── Submit requisition (draft → submitted) ──
    case 'submit':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();
        $reqId = (int)($data['requisition_id'] ?? 0);
        if (!$reqId) jsonError('Requisition ID required');

        $stmt = $pdo->prepare("SELECT * FROM kitchen_requisitions WHERE id = ? AND tenant_id = ? AND status = 'draft'");
        $stmt->execute([$reqId, $tenantId]);
        $req = $stmt->fetch();
        if (!$req) jsonError('Requisition not found or already submitted');

        $lineCount = $pdo->prepare("SELECT COUNT(*) FROM kitchen_requisition_lines WHERE requisition_id = ?");
        $lineCount->execute([$reqId]);
        if ((int)$lineCount->fetchColumn() === 0) jsonError('Cannot submit empty requisition');

        $pdo->prepare("UPDATE kitchen_requisitions SET status = 'submitted', updated_at = NOW() WHERE id = ?")->execute([$reqId]);

        // Push notification to storekeepers
        try {
            $kStmt = $pdo->prepare("SELECT name FROM kitchens WHERE id = ? AND tenant_id = ?");
            $kStmt->execute([$req['kitchen_id'], $tenantId]);
            $kRow = $kStmt->fetch();
            $kitchenName = $kRow ? $kRow['name'] : '';

            $mealLabel = ucfirst($req['meals'] ?? 'order');
            $suppNum = (int)($req['supplement_number'] ?? 0);
            if ($suppNum > 0) $mealLabel .= ' (' . ($suppNum + 1) . ')';

            $pushPayload = [
                'title' => 'New Requisition',
                'body'  => "Submitted {$mealLabel} for {$kitchenName}",
                'tag'   => 'req-submitted-' . $reqId,
            ];
            sendPushToKitchen($tenantId, (int)$req['kitchen_id'], $pushPayload, 'storekeeper', $userId);
            storeNotification($tenantId, (int)$req['kitchen_id'], null, $pushPayload['title'], $pushPayload['body'], 'requisition_submitted', $reqId);
        } catch (Exception $e) {
            error_log('Notification error on submit: ' . $e->getMessage());
        }

        jsonResponse(['submitted' => true]);

    // ── Fulfill requisition (storekeeper) ──
    case 'fulfill':
        requireMethod('POST');
        if (!in_array($userRole, ['storekeeper', 'camp_storekeeper', 'stores_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();
        $reqId = (int)($data['requisition_id'] ?? 0);
        $fulfillLines = $data['lines'] ?? [];
        if (!$reqId) jsonError('Requisition ID required');

        $stmt = $pdo->prepare("SELECT * FROM kitchen_requisitions WHERE id = ? AND tenant_id = ? AND status IN ('submitted','processing')");
        $stmt->execute([$reqId, $tenantId]);
        $req = $stmt->fetch();
        if (!$req) jsonError('Requisition not found or not in submittable status');

        $updateLine = $pdo->prepare("UPDATE kitchen_requisition_lines SET fulfilled_qty = ?, status = 'approved', store_notes = ? WHERE id = ? AND requisition_id = ?");
        foreach ($fulfillLines as $fl) {
            $updateLine->execute([
                (float)($fl['fulfilled_qty'] ?? 0),
                $fl['store_notes'] ?? null,
                (int)$fl['id'],
                $reqId
            ]);
        }

        $pdo->prepare("UPDATE kitchen_requisitions SET status = 'fulfilled', reviewed_by = ?, updated_at = NOW() WHERE id = ?")->execute([$userId, $reqId]);

        // Push notification to chef
        try {
            $kStmt2 = $pdo->prepare("SELECT name FROM kitchens WHERE id = ? AND tenant_id = ?");
            $kStmt2->execute([$req['kitchen_id'], $tenantId]);
            $kRow2 = $kStmt2->fetch();
            $kitchenName = $kRow2 ? $kRow2['name'] : '';

            $mealLabel = ucfirst($req['meals'] ?? 'order');
            $pushPayload = [
                'title' => 'Order Fulfilled',
                'body'  => "{$mealLabel} for {$kitchenName} has been fulfilled by store",
                'tag'   => 'req-fulfilled-' . $reqId,
            ];
            sendPushToKitchen($tenantId, (int)$req['kitchen_id'], $pushPayload, 'chef', $userId);
            storeNotification($tenantId, (int)$req['kitchen_id'], (int)$req['created_by'], $pushPayload['title'], $pushPayload['body'], 'requisition_fulfilled', $reqId);
        } catch (Exception $e) {
            error_log('Notification error on fulfill: ' . $e->getMessage());
        }

        jsonResponse(['fulfilled' => true]);

    // ── Confirm receipt (chef) ──
    case 'confirm_receipt':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();
        $reqId = (int)($data['requisition_id'] ?? 0);
        $receiptLines = $data['lines'] ?? [];
        if (!$reqId) jsonError('Requisition ID required');

        $stmt = $pdo->prepare("SELECT * FROM kitchen_requisitions WHERE id = ? AND tenant_id = ? AND status = 'fulfilled'");
        $stmt->execute([$reqId, $tenantId]);
        $req = $stmt->fetch();
        if (!$req) jsonError('Requisition not found or not fulfilled');

        // Batch-load fulfilled_qty
        $lineIds = array_map(fn($rl) => (int)$rl['id'], $receiptLines);
        $fulfilledMap = [];
        if ($lineIds) {
            $ph = implode(',', array_fill(0, count($lineIds), '?'));
            $fStmt = $pdo->prepare("SELECT id, fulfilled_qty FROM kitchen_requisition_lines WHERE requisition_id = ? AND id IN ($ph)");
            $fStmt->execute(array_merge([$reqId], $lineIds));
            foreach ($fStmt->fetchAll() as $fl) {
                $fulfilledMap[(int)$fl['id']] = (float)$fl['fulfilled_qty'];
            }
        }

        $hasDispute = false;
        $updateLine = $pdo->prepare("UPDATE kitchen_requisition_lines SET received_qty = ? WHERE id = ? AND requisition_id = ?");
        foreach ($receiptLines as $rl) {
            $receivedQty = (float)($rl['received_qty'] ?? 0);
            $updateLine->execute([$receivedQty, (int)$rl['id'], $reqId]);

            $fulfilledQty = $fulfilledMap[(int)$rl['id']] ?? 0;
            if (abs($fulfilledQty - $receivedQty) > 0.01) {
                $hasDispute = true;
            }
        }

        $pdo->prepare("UPDATE kitchen_requisitions SET status = 'received', has_dispute = ?, updated_at = NOW() WHERE id = ?")->execute([$hasDispute ? 1 : 0, $reqId]);

        jsonResponse(['confirmed' => true, 'has_dispute' => $hasDispute]);

    // ── Close day ──
    case 'close':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();
        $reqId = (int)($data['requisition_id'] ?? 0);

        if ($reqId) {
            $pdo->prepare("UPDATE kitchen_requisition_lines rl
                JOIN kitchen_requisitions r ON r.id = rl.requisition_id
                SET rl.received_qty = rl.fulfilled_qty
                WHERE r.id = ? AND r.tenant_id = ? AND r.status = 'fulfilled' AND (rl.received_qty IS NULL OR rl.received_qty = 0)")->execute([$reqId, $tenantId]);
            $pdo->prepare("UPDATE kitchen_requisitions SET status = 'closed', updated_at = NOW() WHERE id = ? AND tenant_id = ? AND status IN ('received', 'fulfilled')")->execute([$reqId, $tenantId]);
        } else {
            $date = $data['date'] ?? date('Y-m-d');
            $kid = (int)($data['kitchen_id'] ?? $kitchenId);
            $pdo->prepare("UPDATE kitchen_requisition_lines rl
                JOIN kitchen_requisitions r ON r.id = rl.requisition_id
                SET rl.received_qty = rl.fulfilled_qty
                WHERE r.tenant_id = ? AND r.req_date = ? AND r.kitchen_id = ? AND r.status = 'fulfilled' AND (rl.received_qty IS NULL OR rl.received_qty = 0)")->execute([$tenantId, $date, $kid]);
            $pdo->prepare("UPDATE kitchen_requisitions SET status = 'closed', updated_at = NOW() WHERE tenant_id = ? AND req_date = ? AND kitchen_id = ? AND status IN ('received', 'fulfilled')")->execute([$tenantId, $date, $kid]);
        }

        jsonResponse(['closed' => true]);

    // ── Close with unused quantities ──
    case 'close_with_unused':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();
        $date = $data['date'] ?? date('Y-m-d');
        $kid = (int)($data['kitchen_id'] ?? $kitchenId);
        $unusedLines = $data['unused_lines'] ?? [];

        $pdo->beginTransaction();
        try {
            $updateLine = $pdo->prepare("UPDATE kitchen_requisition_lines SET unused_qty = ? WHERE id = ?");
            $updateStock = $pdo->prepare("UPDATE items SET stock_qty = stock_qty + ? WHERE id = ? AND tenant_id = ?");

            foreach ($unusedLines as $ul) {
                $lineId = (int)($ul['line_id'] ?? 0);
                $unusedQty = max(0, (float)($ul['unused_qty'] ?? 0));
                if (!$lineId || $unusedQty <= 0) continue;

                $checkStmt = $pdo->prepare("SELECT rl.item_id, rl.received_qty, rl.fulfilled_qty FROM kitchen_requisition_lines rl
                    JOIN kitchen_requisitions r ON r.id = rl.requisition_id
                    WHERE rl.id = ? AND r.tenant_id = ? AND r.kitchen_id = ? AND r.req_date = ? AND r.status IN ('received', 'fulfilled')");
                $checkStmt->execute([$lineId, $tenantId, $kid, $date]);
                $lineRow = $checkStmt->fetch();
                if (!$lineRow) continue;

                $maxUnused = (float)$lineRow['received_qty'] ?: (float)$lineRow['fulfilled_qty'];
                if ($unusedQty > $maxUnused) $unusedQty = $maxUnused;

                $updateLine->execute([$unusedQty, $lineId]);
                $updateStock->execute([$unusedQty, (int)$lineRow['item_id'], $tenantId]);
            }

            // Auto-set received_qty = fulfilled_qty for fulfilled orders
            $pdo->prepare("UPDATE kitchen_requisition_lines rl
                JOIN kitchen_requisitions r ON r.id = rl.requisition_id
                SET rl.received_qty = rl.fulfilled_qty
                WHERE r.tenant_id = ? AND r.req_date = ? AND r.kitchen_id = ? AND r.status = 'fulfilled' AND (rl.received_qty IS NULL OR rl.received_qty = 0)")->execute([$tenantId, $date, $kid]);

            $pdo->prepare("UPDATE kitchen_requisitions SET status = 'closed', updated_at = NOW() WHERE tenant_id = ? AND req_date = ? AND kitchen_id = ? AND status IN ('received', 'fulfilled')")->execute([$tenantId, $date, $kid]);

            $pdo->commit();
            jsonResponse(['closed' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed to close: ' . $e->getMessage());
        }

    // ── Update unused quantities on already-closed requisitions ──
    case 'update_unused':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();
        $reqId = (int)($data['requisition_id'] ?? 0);
        $unusedLines = $data['unused_lines'] ?? [];
        if (!$reqId) jsonError('Requisition ID required');

        $stmt = $pdo->prepare("SELECT * FROM kitchen_requisitions WHERE id = ? AND tenant_id = ? AND status IN ('closed', 'fulfilled', 'received') AND kitchen_id = ?");
        $stmt->execute([$reqId, $tenantId, $kitchenId]);
        $req = $stmt->fetch();
        if (!$req) jsonError('Requisition not found or not in closeable status');

        $pdo->beginTransaction();
        try {
            $updateLine = $pdo->prepare("UPDATE kitchen_requisition_lines SET unused_qty = ? WHERE id = ? AND requisition_id = ?");
            $adjustStock = $pdo->prepare("UPDATE items SET stock_qty = stock_qty + ? WHERE id = ? AND tenant_id = ?");

            foreach ($unusedLines as $ul) {
                $lineId = (int)($ul['line_id'] ?? 0);
                $newUnused = max(0, (float)($ul['unused_qty'] ?? 0));
                if (!$lineId) continue;

                $checkStmt = $pdo->prepare("SELECT item_id, received_qty, fulfilled_qty, unused_qty FROM kitchen_requisition_lines WHERE id = ? AND requisition_id = ?");
                $checkStmt->execute([$lineId, $reqId]);
                $lineRow = $checkStmt->fetch();
                if (!$lineRow) continue;

                $maxUnused = (float)$lineRow['received_qty'] ?: (float)$lineRow['fulfilled_qty'];
                if ($newUnused > $maxUnused) $newUnused = $maxUnused;

                $oldUnused = (float)$lineRow['unused_qty'];
                $delta = $newUnused - $oldUnused;

                if (abs($delta) < 0.001) continue;

                $updateLine->execute([$newUnused, $lineId, $reqId]);
                $adjustStock->execute([$delta, (int)$lineRow['item_id'], $tenantId]);
            }

            $pdo->commit();
            jsonResponse(['updated' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed to update: ' . $e->getMessage());
        }

    // ── Dashboard stats (chef) ──
    case 'dashboard_stats':
        $kid = (int)($_GET['kitchen_id'] ?? $kitchenId);
        $today = date('Y-m-d');

        $stmt = $pdo->prepare("SELECT r.status, COUNT(*) AS cnt,
            SUM(CASE WHEN r.status = 'draft' AND (SELECT COUNT(*) FROM kitchen_requisition_lines WHERE requisition_id = r.id) = 0 THEN 1 ELSE 0 END) AS empty_drafts
            FROM kitchen_requisitions r WHERE r.tenant_id = ? AND r.req_date = ? AND r.kitchen_id = ? GROUP BY r.status");
        $stmt->execute([$tenantId, $today, $kid]);
        $rows = $stmt->fetchAll();

        $counts = [];
        $total = 0;
        $emptyDrafts = 0;
        foreach ($rows as $r) {
            $counts[$r['status']] = (int)$r['cnt'];
            $total += (int)$r['cnt'];
            if ($r['status'] === 'draft') $emptyDrafts = (int)$r['empty_drafts'];
        }

        $activeDrafts = max(0, ($counts['draft'] ?? 0) - $emptyDrafts);
        $stats = [
            'active_sessions' => $activeDrafts + ($counts['submitted'] ?? 0) + ($counts['processing'] ?? 0),
            'awaiting_supply' => $counts['submitted'] ?? 0,
            'ready_close'     => ($counts['fulfilled'] ?? 0) + ($counts['received'] ?? 0),
            'total_sessions'  => $total,
        ];

        jsonResponse(['stats' => $stats, 'date' => $today]);

    // ── Store stats ──
    case 'store_stats':
        $kid = (int)($_GET['kitchen_id'] ?? $kitchenId);
        $today = date('Y-m-d');

        $stmt = $pdo->prepare("SELECT status, COUNT(*) AS cnt,
            SUM(CASE WHEN status = 'fulfilled' AND DATE(updated_at) = ? THEN 1 ELSE 0 END) AS fulfilled_today
            FROM kitchen_requisitions WHERE tenant_id = ? AND kitchen_id = ? AND status IN ('submitted','processing','fulfilled')
            GROUP BY status");
        $stmt->execute([$today, $tenantId, $kid]);
        $rows = $stmt->fetchAll();

        $stats = ['new_orders' => 0, 'processing' => 0, 'fulfilled_today' => 0];
        foreach ($rows as $r) {
            if ($r['status'] === 'submitted') $stats['new_orders'] = (int)$r['cnt'];
            if ($r['status'] === 'processing') $stats['processing'] = (int)$r['cnt'];
            if ($r['status'] === 'fulfilled') $stats['fulfilled_today'] = (int)$r['fulfilled_today'];
        }

        jsonResponse(['stats' => $stats]);

    // ── Day summary ──
    case 'day_summary':
        $date = $_GET['date'] ?? date('Y-m-d');
        $kid = (int)($_GET['kitchen_id'] ?? $kitchenId);

        $stmt = $pdo->prepare("SELECT r.*, u.name AS chef_name,
            (SELECT COUNT(*) FROM kitchen_requisition_lines WHERE requisition_id = r.id) AS line_count,
            (SELECT COALESCE(SUM(order_qty), 0) FROM kitchen_requisition_lines WHERE requisition_id = r.id) AS total_kg
            FROM kitchen_requisitions r
            LEFT JOIN users u ON u.id = r.created_by
            WHERE r.tenant_id = ? AND r.req_date = ? AND r.kitchen_id = ?
            ORDER BY r.session_number ASC, r.supplement_number ASC");
        $stmt->execute([$tenantId, $date, $kid]);
        $reqs = $stmt->fetchAll();

        $summary = [
            'total_sessions' => count($reqs),
            'draft' => 0, 'submitted' => 0, 'processing' => 0,
            'fulfilled' => 0, 'received' => 0, 'closed' => 0,
            'empty_drafts' => 0
        ];
        foreach ($reqs as $r) {
            $summary[$r['status']] = ($summary[$r['status']] ?? 0) + 1;
            if ($r['status'] === 'draft' && (int)$r['line_count'] === 0) {
                $summary['empty_drafts']++;
            }
        }

        // Load lines for fulfilled/received/closed
        $receivedIds = array_filter(array_map(fn($r) => in_array($r['status'], ['fulfilled', 'received', 'closed']) ? (int)$r['id'] : null, $reqs));
        $linesByReq = [];
        if (!empty($receivedIds)) {
            $ph = implode(',', array_fill(0, count($receivedIds), '?'));
            $lStmt = $pdo->prepare("SELECT rl.id, rl.requisition_id, rl.item_id, rl.item_name, rl.uom,
                rl.order_qty, rl.fulfilled_qty, rl.received_qty, rl.unused_qty
                FROM kitchen_requisition_lines rl WHERE rl.requisition_id IN ($ph) ORDER BY rl.item_name");
            $lStmt->execute(array_values($receivedIds));
            foreach ($lStmt->fetchAll() as $line) {
                $linesByReq[(int)$line['requisition_id']][] = $line;
            }
        }

        jsonResponse(['requisitions' => $reqs, 'summary' => $summary, 'lines_by_req' => $linesByReq ?: new \stdClass()]);

    // ── Get items for requisition form ──
    case 'get_items':
        $q = trim($_GET['q'] ?? '');

        if (!$q) {
            $stmt = $pdo->prepare("SELECT i.id, i.name, i.item_code AS code, COALESCE(g.name, 'Uncategorized') AS category, COALESCE(u.code, 'EA') AS uom, 0 AS stock_qty, 0 AS portion_weight, 'direct_kg' AS order_mode FROM items i LEFT JOIN item_groups g ON i.item_group_id = g.id LEFT JOIN units_of_measure u ON i.stock_uom_id = u.id WHERE i.tenant_id = ? AND i.is_active = 1 ORDER BY g.name, i.name");
            $stmt->execute([$tenantId]);
            $items = $stmt->fetchAll();
        } else {
            $escaped = str_replace(['%', '_'], ['\\%', '\\_'], $q);
            $stmt = $pdo->prepare("SELECT i.id, i.name, i.item_code AS code, COALESCE(g.name, 'Uncategorized') AS category, COALESCE(u.code, 'EA') AS uom, 0 AS stock_qty, 0 AS portion_weight, 'direct_kg' AS order_mode FROM items i LEFT JOIN item_groups g ON i.item_group_id = g.id LEFT JOIN units_of_measure u ON i.stock_uom_id = u.id WHERE i.tenant_id = ? AND i.is_active = 1 AND (i.name LIKE ? OR i.item_code LIKE ?) ORDER BY g.name, i.name");
            $stmt->execute([$tenantId, "%$escaped%", "%$escaped%"]);
            $items = $stmt->fetchAll();
        }

        $grouped = [];
        foreach ($items as $item) {
            $c = $item['category'] ?: 'Uncategorized';
            $grouped[$c][] = $item;
        }

        jsonResponse(['items' => $items, 'grouped' => $grouped]);

    // ── Search recipes ──
    case 'search_recipes':
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) jsonError('Search query too short');

        $escaped = str_replace(['%', '_'], ['\\%', '\\_'], $q);
        $stmt = $pdo->prepare("SELECT id, name, cuisine, servings, prep_time,
            (SELECT COUNT(*) FROM kitchen_recipe_ingredients WHERE recipe_id = kitchen_recipes.id) AS ingredient_count
            FROM kitchen_recipes WHERE tenant_id = ? AND (name LIKE ? OR cuisine LIKE ?)
            ORDER BY name LIMIT 20");
        $stmt->execute([$tenantId, "%$escaped%", "%$escaped%"]);

        jsonResponse(['recipes' => $stmt->fetchAll()]);

    // ── Get recipe ingredients ──
    case 'get_recipe_ingredients':
        $recipeId = (int)($_GET['recipe_id'] ?? 0);
        if (!$recipeId) jsonError('Recipe ID required');

        $stmt = $pdo->prepare("SELECT id, name, cuisine, servings, prep_time FROM kitchen_recipes WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$recipeId, $tenantId]);
        $recipe = $stmt->fetch();
        if (!$recipe) jsonError('Recipe not found', 404);

        $stmt = $pdo->prepare("SELECT ri.id, ri.item_id, ri.qty, ri.uom, ri.is_primary,
            i.name AS item_name, 0 AS stock_qty, 0 AS portion_weight, 'direct_kg' AS order_mode, 'General' AS category
            FROM kitchen_recipe_ingredients ri
            LEFT JOIN items i ON i.id = ri.item_id
            WHERE ri.recipe_id = ? ORDER BY ri.is_primary DESC, i.name");
        $stmt->execute([$recipeId]);

        jsonResponse(['recipe' => $recipe, 'ingredients' => $stmt->fetchAll()]);

    // ── Add single dish to requisition ──
    case 'add_single_dish':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();

        $reqId = (int)($data['requisition_id'] ?? 0);
        $recipeId = (int)($data['recipe_id'] ?? 0);
        if (!$reqId || !$recipeId) jsonError('Requisition ID and Recipe ID required');

        $stmt = $pdo->prepare("SELECT * FROM kitchen_requisitions WHERE id = ? AND tenant_id = ? AND status = 'draft'");
        $stmt->execute([$reqId, $tenantId]);
        $req = $stmt->fetch();
        if (!$req) jsonError('Requisition not found or not in draft status');

        $stmt = $pdo->prepare("SELECT id, name, servings FROM kitchen_recipes WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$recipeId, $tenantId]);
        $recipe = $stmt->fetch();
        if (!$recipe) jsonError('Recipe not found');

        $stmt = $pdo->prepare("SELECT id FROM kitchen_requisition_dishes WHERE requisition_id = ? AND recipe_id = ?");
        $stmt->execute([$reqId, $recipeId]);
        if ($stmt->fetch()) jsonError('This dish is already in that order');

        $guestCount = (int)($req['guest_count'] ?? 20);
        $recipeServings = max(1, (int)($recipe['servings'] ?? 4));
        $scaleFactor = $guestCount / $recipeServings;

        $stmt = $pdo->prepare("INSERT INTO kitchen_requisition_dishes (requisition_id, recipe_id, recipe_name, recipe_servings, scale_factor, guest_count)
            VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$reqId, $recipeId, $recipe['name'], $recipeServings, round($scaleFactor, 3), $guestCount]);

        jsonResponse(['added' => true, 'recipe_name' => $recipe['name']]);

    // ── Save dish-based requisition lines (aggregated) ──
    case 'save_dish_lines':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);
        $data = getJsonInput();

        $reqId = (int)($data['requisition_id'] ?? 0);
        $dishes = $data['dishes'] ?? [];
        $guestCount = (int)($data['guest_count'] ?? 20);
        if (!$reqId) jsonError('Requisition ID required');
        if (empty($dishes)) jsonError('At least one dish is required');

        $stmt = $pdo->prepare("SELECT * FROM kitchen_requisitions WHERE id = ? AND tenant_id = ? AND status = 'draft'");
        $stmt->execute([$reqId, $tenantId]);
        $req = $stmt->fetch();
        if (!$req) jsonError('Requisition not found or not in draft status');

        // Load kitchen rounding settings
        $roundingMode = 'half';
        try {
            $settingsStmt = $pdo->prepare("SELECT rounding_mode FROM kitchens WHERE id = ? AND tenant_id = ?");
            $settingsStmt->execute([$req['kitchen_id'], $tenantId]);
            $kitchenRow = $settingsStmt->fetch();
            if ($kitchenRow && !empty($kitchenRow['rounding_mode'])) $roundingMode = $kitchenRow['rounding_mode'];
        } catch (Exception $e) { /* column may not exist */ }

        $pdo->beginTransaction();
        try {
            $pdo->prepare("DELETE FROM kitchen_requisition_dishes WHERE requisition_id = ?")->execute([$reqId]);
            $pdo->prepare("DELETE FROM kitchen_requisition_lines WHERE requisition_id = ?")->execute([$reqId]);

            $aggregated = [];

            // Batch-load ALL recipe ingredients
            $recipeIds = array_unique(array_filter(array_map(fn($d) => (int)($d['recipe_id'] ?? 0), $dishes)));
            $allIngredients = [];
            if ($recipeIds) {
                $ph = implode(',', array_fill(0, count($recipeIds), '?'));
                $bStmt = $pdo->prepare("SELECT ri.recipe_id, ri.item_id, ri.qty, ri.uom,
                    i.name AS item_name, 0 AS stock_qty, 0 AS portion_weight, 'direct_kg' AS order_mode, 'General' AS category
                    FROM kitchen_recipe_ingredients ri
                    LEFT JOIN items i ON i.id = ri.item_id
                    WHERE ri.recipe_id IN ($ph)");
                $bStmt->execute(array_values($recipeIds));
                foreach ($bStmt->fetchAll() as $ing) {
                    $allIngredients[(int)$ing['recipe_id']][] = $ing;
                }
            }

            foreach ($dishes as $dish) {
                $recipeId = (int)($dish['recipe_id'] ?? 0);
                $recipeName = $dish['recipe_name'] ?? '';
                $recipeServings = max(1, (int)($dish['recipe_servings'] ?? 4));
                $dishPortions = max(1, (int)($dish['dish_portions'] ?? $guestCount));
                $scaleFactor = $dishPortions / $recipeServings;

                $dStmt = $pdo->prepare("INSERT INTO kitchen_requisition_dishes (requisition_id, recipe_id, recipe_name, recipe_servings, scale_factor, guest_count)
                    VALUES (?, ?, ?, ?, ?, ?)");
                $dStmt->execute([$reqId, $recipeId, $recipeName, $recipeServings, round($scaleFactor, 3), $dishPortions]);
                $dishId = $pdo->lastInsertId();

                $ingredients = $allIngredients[$recipeId] ?? [];

                foreach ($ingredients as $ing) {
                    $itemId = (int)$ing['item_id'];
                    $scaledQty = (float)$ing['qty'] * $scaleFactor;

                    if (isset($aggregated[$itemId])) {
                        $aggregated[$itemId]['total_qty'] += $scaledQty;
                    } else {
                        $aggregated[$itemId] = [
                            'item_name' => $ing['item_name'],
                            'total_qty' => $scaledQty,
                            'uom' => $ing['uom'] ?? 'kg',
                            'stock_qty' => (float)$ing['stock_qty'],
                            'portion_weight' => (float)$ing['portion_weight'],
                            'order_mode' => $ing['order_mode'],
                            'category' => $ing['category'],
                        ];
                    }
                }
            }

            // Apply manual adjustments
            $adjustments = $data['adjustments'] ?? [];
            foreach ($adjustments as $itemId => $adj) {
                if (isset($aggregated[(int)$itemId])) {
                    $aggregated[(int)$itemId]['total_qty'] += (float)$adj;
                }
            }

            // Insert aggregated lines
            $insertStmt = $pdo->prepare("INSERT INTO kitchen_requisition_lines
                (requisition_id, item_id, item_name, meal, order_mode, portions, portion_weight, required_kg, stock_qty, order_qty, uom)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)");

            $totalItems = 0;
            $totalKg = 0;
            $meal = $req['meals'] ?? 'lunch';

            $roundUp = function($val) use ($roundingMode) {
                if ($roundingMode === 'none') return $val;
                if ($roundingMode === 'whole') return ceil($val);
                return ceil($val * 2) / 2;
            };

            foreach ($aggregated as $itemId => $agg) {
                $requiredKg = $roundUp($agg['total_qty']);
                $orderQty = max(0, $roundUp($requiredKg - $agg['stock_qty']));

                if ($requiredKg <= 0) continue;

                $insertStmt->execute([
                    $reqId, $itemId, $agg['item_name'], $meal, $agg['order_mode'],
                    $agg['portion_weight'], $requiredKg, $agg['stock_qty'], $orderQty,
                    $agg['uom']
                ]);

                $totalItems++;
                $totalKg += $orderQty;
            }

            $pdo->prepare("UPDATE kitchen_requisitions SET guest_count = ?, updated_at = NOW() WHERE id = ?")->execute([$guestCount, $reqId]);

            $pdo->commit();

            jsonResponse(['saved' => true, 'total_items' => $totalItems, 'total_kg' => round($totalKg, 2), 'dish_count' => count($dishes)]);

        } catch (Exception $e) {
            $pdo->rollBack();
            jsonError('Failed to save dish lines: ' . $e->getMessage());
        }

    // ── Get dishes with ingredients (batch) ──
    case 'get_dishes_with_ingredients':
        $reqId = (int)($_GET['requisition_id'] ?? 0);
        if (!$reqId) jsonError('Requisition ID required');

        $dStmt = $pdo->prepare("SELECT rd.recipe_id, rd.recipe_name, rd.recipe_servings, rd.scale_factor
            FROM kitchen_requisition_dishes rd WHERE rd.requisition_id = ? ORDER BY rd.created_at");
        $dStmt->execute([$reqId]);
        $dishes = $dStmt->fetchAll();

        if (empty($dishes)) {
            jsonResponse(['dishes' => [], 'ingredients_by_recipe' => new \stdClass()]);
        }

        $recipeIds = array_unique(array_column($dishes, 'recipe_id'));
        $ph = implode(',', array_fill(0, count($recipeIds), '?'));
        $iStmt = $pdo->prepare("SELECT ri.recipe_id, ri.item_id, ri.qty, ri.uom, ri.is_primary,
            i.name AS item_name, 0 AS stock_qty, 0 AS portion_weight, 'direct_kg' AS order_mode, 'General' AS category
            FROM kitchen_recipe_ingredients ri
            LEFT JOIN items i ON i.id = ri.item_id
            WHERE ri.recipe_id IN ($ph)
            ORDER BY ri.recipe_id, ri.is_primary DESC, i.name");
        $iStmt->execute(array_values($recipeIds));

        $ingredientsByRecipe = [];
        foreach ($iStmt->fetchAll() as $ing) {
            $ingredientsByRecipe[$ing['recipe_id']][] = $ing;
        }

        jsonResponse(['dishes' => $dishes, 'ingredients_by_recipe' => $ingredientsByRecipe ?: new \stdClass()]);

    default:
        jsonError('Unknown action');
}
