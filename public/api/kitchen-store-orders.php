<?php
/**
 * WebSquare — Kitchen Store Orders API
 * Ported from Karibu Pantry Planner store-orders.php + daily-groceries.php
 *
 * Actions:
 *   list           — list grocery orders
 *   get            — order detail with lines
 *   mark_sent      — storekeeper marks order as fulfilled/sent
 *   add_notes      — add notes to order
 *   get_daily      — aggregated groceries for a date (from menu plans)
 *   submit_order   — submit grocery order to store
 *   confirm_receipt — chef confirms receipt
 *   search_items   — search items for manual add
 */

require_once __DIR__ . '/middleware.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$userId = $auth['user_id'];
$userRole = $auth['role'] ?? '';
$pdo = getDB();

$input = $_SERVER['REQUEST_METHOD'] === 'POST' ? getJsonInput() : [];
$action = $_GET['action'] ?? ($input['action'] ?? '');

switch ($action) {

    // ── List orders ──
    case 'list':
        $status = $_GET['status'] ?? 'all';
        $kitchenId = (int)($_GET['kitchen_id'] ?? 0);

        $sql = 'SELECT go.*, u.name as chef_name FROM grocery_orders go LEFT JOIN users u ON go.created_by = u.id WHERE go.tenant_id = ?';
        $params = [$tenantId];

        if ($kitchenId) {
            $sql .= ' AND go.kitchen_id = ?';
            $params[] = $kitchenId;
        }

        if ($status !== 'all') {
            $sql .= ' AND go.status = ?';
            $params[] = $status;
        }

        $sql .= ' ORDER BY go.created_at DESC LIMIT 50';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        // Status counts
        $countSql = "SELECT status, COUNT(*) as count FROM grocery_orders WHERE tenant_id = ?";
        $countParams = [$tenantId];
        if ($kitchenId) {
            $countSql .= ' AND kitchen_id = ?';
            $countParams[] = $kitchenId;
        }
        $countSql .= " GROUP BY status";
        $counts = $pdo->prepare($countSql);
        $counts->execute($countParams);
        $statusCounts = ['all' => 0];
        foreach ($counts->fetchAll() as $c) {
            $statusCounts[$c['status']] = (int)$c['count'];
            $statusCounts['all'] += (int)$c['count'];
        }

        jsonResponse(['orders' => $orders, 'counts' => $statusCounts]);

    // ── Get order detail ──
    case 'get':
        $orderId = (int)($_GET['id'] ?? 0);
        if (!$orderId) jsonError('Order ID required');

        $order = $pdo->prepare('SELECT go.*, u.name as chef_name FROM grocery_orders go LEFT JOIN users u ON go.created_by = u.id WHERE go.id = ? AND go.tenant_id = ?');
        $order->execute([$orderId, $tenantId]);
        $order = $order->fetch();
        if (!$order) jsonError('Order not found', 404);

        $lines = $pdo->prepare('SELECT * FROM grocery_order_lines WHERE order_id = ? ORDER BY id');
        $lines->execute([$orderId]);

        jsonResponse(['order' => $order, 'lines' => $lines->fetchAll()]);

    // ── Mark order as sent (storekeeper sends items to kitchen) ──
    case 'mark_sent':
        requireMethod('POST');
        if (!in_array($userRole, ['storekeeper', 'camp_storekeeper', 'stores_manager', 'admin', 'director'])) jsonError('Not authorized', 403);

        $orderId = (int)($input['order_id'] ?? 0);
        $lines = $input['lines'] ?? [];
        if (!$orderId) jsonError('Order ID required');

        $stmt = $pdo->prepare('UPDATE grocery_order_lines SET fulfilled_qty = ?, unit_size = ? WHERE id = ? AND order_id = ?');
        foreach ($lines as $line) {
            $stmt->execute([
                (float)($line['fulfilled_qty'] ?? 0),
                !empty($line['unit_size']) ? (float)$line['unit_size'] : null,
                (int)$line['id'],
                $orderId
            ]);
        }

        $pdo->prepare("UPDATE grocery_orders SET status = 'fulfilled', reviewed_by = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")->execute([$userId, $orderId, $tenantId]);

        jsonResponse(['updated' => true]);

    // ── Add notes to order ──
    case 'add_notes':
        requireMethod('POST');
        $orderId = (int)($input['order_id'] ?? 0);
        $notes = $input['notes'] ?? '';
        if (!$orderId) jsonError('Order ID required');

        $pdo->prepare('UPDATE grocery_orders SET notes = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?')->execute([$notes, $orderId, $tenantId]);
        jsonResponse(['updated' => true]);

    // ── Get aggregated daily groceries ──
    case 'get_daily':
        $date = $_GET['date'] ?? date('Y-m-d');
        $kitchenId = (int)($_GET['kitchen_id'] ?? 0);

        // Get confirmed menu plans
        $plans = $pdo->prepare("SELECT * FROM menu_plans WHERE tenant_id = ? AND plan_date = ? AND status = 'confirmed'" . ($kitchenId ? " AND kitchen_id = ?" : ""));
        $planParams = [$tenantId, $date];
        if ($kitchenId) $planParams[] = $kitchenId;
        $plans->execute($planParams);
        $plans = $plans->fetchAll();

        if (empty($plans)) {
            $drafts = $pdo->prepare("SELECT COUNT(*) FROM menu_plans WHERE tenant_id = ? AND plan_date = ? AND status = 'draft'");
            $drafts->execute([$tenantId, $date]);
            $hasDrafts = (int)$drafts->fetchColumn() > 0;

            jsonResponse(['plans' => [], 'items' => [], 'order' => null, 'has_drafts' => $hasDrafts]);
        }

        $planIds = array_column($plans, 'id');
        $ph = implode(',', array_fill(0, count($planIds), '?'));

        $stmt = $pdo->prepare("
            SELECT
                di.item_id,
                di.item_name,
                di.uom,
                SUM(di.final_qty) as total_qty,
                GROUP_CONCAT(DISTINCT md.dish_name SEPARATOR ', ') as dishes,
                i.stock_qty as current_stock
            FROM dish_ingredients di
            JOIN menu_dishes md ON di.dish_id = md.id
            LEFT JOIN items i ON di.item_id = i.id
            WHERE md.plan_id IN ($ph) AND di.is_removed = 0
            GROUP BY di.item_id, di.item_name, di.uom, i.stock_qty
            ORDER BY di.item_name
        ");
        $stmt->execute($planIds);
        $items = $stmt->fetchAll();

        // Check for existing order
        $orderSql = 'SELECT * FROM grocery_orders WHERE tenant_id = ? AND order_date = ?';
        $orderParams = [$tenantId, $date];
        if ($kitchenId) {
            $orderSql .= ' AND kitchen_id = ?';
            $orderParams[] = $kitchenId;
        }
        $orderSql .= ' ORDER BY id DESC LIMIT 1';
        $order = $pdo->prepare($orderSql);
        $order->execute($orderParams);
        $order = $order->fetch();

        $orderLines = [];
        if ($order) {
            $lines = $pdo->prepare('SELECT * FROM grocery_order_lines WHERE order_id = ? ORDER BY id');
            $lines->execute([$order['id']]);
            $orderLines = $lines->fetchAll();
        }

        jsonResponse([
            'plans' => $plans,
            'items' => $items,
            'order' => $order,
            'order_lines' => $orderLines,
        ]);

    // ── Submit grocery order to store ──
    case 'submit_order':
        requireMethod('POST');
        if (!in_array($userRole, ['chef', 'camp_manager', 'admin', 'director'])) jsonError('Not authorized', 403);

        $date = $input['date'] ?? date('Y-m-d');
        $items = $input['items'] ?? [];
        $kitchenId = (int)($input['kitchen_id'] ?? 0);

        if (empty($items)) jsonError('No items to order');

        $existing = $pdo->prepare("SELECT id FROM grocery_orders WHERE tenant_id = ? AND order_date = ? AND status IN ('pending', 'reviewing')");
        $existing->execute([$tenantId, $date]);
        if ($existing->fetch()) {
            jsonError('An order already exists for this date');
        }

        $stmt = $pdo->prepare("INSERT INTO grocery_orders (tenant_id, kitchen_id, order_date, meal, total_items, created_by) VALUES (?, ?, ?, 'lunch', ?, ?)");
        $stmt->execute([$tenantId, $kitchenId, $date, count($items), $userId]);
        $orderId = $pdo->lastInsertId();

        $lineStmt = $pdo->prepare('INSERT INTO grocery_order_lines (order_id, item_id, item_name, requested_qty, uom) VALUES (?, ?, ?, ?, ?)');
        foreach ($items as $item) {
            $lineStmt->execute([
                $orderId,
                $item['item_id'] ?? null,
                $item['item_name'] ?? 'Unknown',
                (float)($item['qty'] ?? 0),
                $item['uom'] ?? 'kg',
            ]);
        }

        jsonResponse(['order_id' => $orderId]);

    // ── Chef confirms receipt ──
    case 'confirm_receipt':
        requireMethod('POST');
        $orderId = (int)($input['order_id'] ?? 0);
        $lines = $input['lines'] ?? [];
        if (!$orderId) jsonError('Order ID required');

        $stmt = $pdo->prepare('UPDATE grocery_order_lines SET received_qty = ? WHERE id = ? AND order_id = ?');
        foreach ($lines as $line) {
            $stmt->execute([(float)($line['received_qty'] ?? 0), (int)$line['id'], $orderId]);
        }

        $disputeCheck = $pdo->prepare('SELECT COUNT(*) FROM grocery_order_lines WHERE order_id = ? AND received_qty IS NOT NULL AND fulfilled_qty IS NOT NULL AND ROUND(fulfilled_qty, 2) != ROUND(received_qty, 2)');
        $disputeCheck->execute([$orderId]);
        $hasDispute = (int)$disputeCheck->fetchColumn() > 0;

        $pdo->prepare("UPDATE grocery_orders SET status = 'received', has_dispute = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")->execute([$hasDispute ? 1 : 0, $orderId, $tenantId]);

        jsonResponse(['confirmed' => true, 'has_dispute' => $hasDispute]);

    // ── Search items for manual add ──
    case 'search_items':
        $q = $_GET['q'] ?? '';
        if (strlen($q) < 2) jsonResponse(['items' => []]);

        $stmt = $pdo->prepare('SELECT id, name, code, category, uom, stock_qty FROM items WHERE tenant_id = ? AND is_active = 1 AND (name LIKE ? OR code LIKE ?) ORDER BY name LIMIT 20');
        $stmt->execute([$tenantId, "%$q%", "%$q%"]);
        jsonResponse(['items' => $stmt->fetchAll()]);

    default:
        jsonError('Unknown action');
}
