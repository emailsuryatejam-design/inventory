<?php
/**
 * KCL Stores — Stock Adjustments
 * GET    /api/stock-adjustments.php            — list adjustments
 * GET    /api/stock-adjustments.php?id=X       — adjustment detail with lines
 * POST   /api/stock-adjustments.php            — create adjustment with lines
 * PUT    /api/stock-adjustments.php            — approve/reject adjustment
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List or Detail ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    // ── Detail by ID ──
    if (!empty($_GET['id'])) {
        $adjId = (int) $_GET['id'];

        $stmt = $pdo->prepare("
            SELECT sa.id, sa.adjustment_number, sa.adjustment_type, sa.camp_id,
                   c.code AS camp_code, c.name AS camp_name,
                   sa.reason, sa.status, sa.total_value,
                   uc.name AS created_by_name, sa.created_at,
                   ua.name AS approved_by_name, sa.approved_at
            FROM stock_adjustments sa
            JOIN camps c ON sa.camp_id = c.id
            LEFT JOIN users uc ON sa.created_by = uc.id
            LEFT JOIN users ua ON sa.approved_by = ua.id
            WHERE sa.id = ? AND sa.tenant_id = ?
        ");
        $stmt->execute([$adjId, $tenantId]);
        $adj = $stmt->fetch();

        if (!$adj) {
            jsonError('Adjustment not found', 404);
        }

        // Lines with current stock
        $linesStmt = $pdo->prepare("
            SELECT sal.id, sal.item_id,
                   i.item_code, i.name AS item_name,
                   COALESCE(sb.current_qty, 0) AS current_qty,
                   sal.adjustment_qty, sal.new_qty,
                   sal.unit_cost, sal.value_impact, sal.reason
            FROM stock_adjustment_lines sal
            JOIN items i ON sal.item_id = i.id
            LEFT JOIN stock_balances sb ON sb.item_id = sal.item_id AND sb.camp_id = ? AND sb.tenant_id = ?
            WHERE sal.adjustment_id = ? AND sal.tenant_id = ?
        ");
        $linesStmt->execute([$adj['camp_id'], $tenantId, $adjId, $tenantId]);
        $lines = $linesStmt->fetchAll();

        jsonResponse([
            'adjustment' => [
                'id'                => (int) $adj['id'],
                'adjustment_number' => $adj['adjustment_number'],
                'adjustment_type'   => $adj['adjustment_type'],
                'camp_id'           => (int) $adj['camp_id'],
                'camp_code'         => $adj['camp_code'],
                'camp_name'         => $adj['camp_name'],
                'reason'            => $adj['reason'],
                'status'            => $adj['status'],
                'total_value'       => (float) $adj['total_value'],
                'created_by_name'   => $adj['created_by_name'],
                'created_at'        => $adj['created_at'],
                'approved_by_name'  => $adj['approved_by_name'],
                'approved_at'       => $adj['approved_at'],
            ],
            'lines' => array_map(function ($l) {
                return [
                    'id'             => (int) $l['id'],
                    'item_id'        => (int) $l['item_id'],
                    'item_code'      => $l['item_code'],
                    'item_name'      => $l['item_name'],
                    'current_qty'    => (float) $l['current_qty'],
                    'adjustment_qty' => (float) $l['adjustment_qty'],
                    'new_qty'        => (float) $l['new_qty'],
                    'unit_cost'      => (float) $l['unit_cost'],
                    'value_impact'   => (float) $l['value_impact'],
                    'reason'         => $l['reason'],
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
    $type    = $_GET['type'] ?? '';
    $campId  = $_GET['camp_id'] ?? '';

    $where  = [];
    $params = [];

    // Camp staff auto-filter
    if (in_array($auth['role'], ['camp_storekeeper', 'camp_manager']) && $auth['camp_id']) {
        $where[] = 'sa.camp_id = ?';
        $params[] = $auth['camp_id'];
    } elseif ($campId) {
        $where[] = 'sa.camp_id = ?';
        $params[] = (int) $campId;
    }

    if ($status) {
        $where[] = 'sa.status = ?';
        $params[] = $status;
    }

    if ($type) {
        $where[] = 'sa.adjustment_type = ?';
        $params[] = $type;
    }

    if ($search) {
        $where[] = '(sa.adjustment_number LIKE ? OR sa.reason LIKE ? OR c.name LIKE ?)';
        $params[] = "%{$search}%";
        $params[] = "%{$search}%";
        $params[] = "%{$search}%";
    }

    tenantScope($where, $params, $tenantId, 'sa');

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Count
    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM stock_adjustments sa
        JOIN camps c ON sa.camp_id = c.id
        {$whereClause}
    ");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $stmt = $pdo->prepare("
        SELECT sa.id, sa.adjustment_number, sa.adjustment_type, sa.camp_id,
               c.code AS camp_code, c.name AS camp_name,
               sa.reason, sa.status, sa.total_value,
               uc.name AS created_by_name, sa.created_at,
               (SELECT COUNT(*) FROM stock_adjustment_lines sal2 WHERE sal2.adjustment_id = sa.id) AS line_count
        FROM stock_adjustments sa
        JOIN camps c ON sa.camp_id = c.id
        LEFT JOIN users uc ON sa.created_by = uc.id
        {$whereClause}
        ORDER BY sa.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $adjustments = $stmt->fetchAll();

    // Status counts
    $scStmt = $pdo->prepare("
        SELECT sa.status, COUNT(*) AS cnt
        FROM stock_adjustments sa
        WHERE sa.tenant_id = ?
        GROUP BY sa.status
    ");
    $scStmt->execute([$tenantId]);
    $statusRows = $scStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $statusCounts = [
        'draft'     => (int) ($statusRows['draft'] ?? 0),
        'submitted' => (int) ($statusRows['submitted'] ?? 0),
        'approved'  => (int) ($statusRows['approved'] ?? 0),
        'rejected'  => (int) ($statusRows['rejected'] ?? 0),
    ];

    // Camps for filter dropdown
    $camps = getTenantCamps($pdo, $tenantId);

    jsonResponse([
        'adjustments' => array_map(function ($a) {
            return [
                'id'                => (int) $a['id'],
                'adjustment_number' => $a['adjustment_number'],
                'adjustment_type'   => $a['adjustment_type'],
                'camp_id'           => (int) $a['camp_id'],
                'camp_code'         => $a['camp_code'],
                'camp_name'         => $a['camp_name'],
                'reason'            => $a['reason'],
                'status'            => $a['status'],
                'total_value'       => (float) $a['total_value'],
                'created_by_name'   => $a['created_by_name'],
                'created_at'        => $a['created_at'],
                'line_count'        => (int) $a['line_count'],
            ];
        }, $adjustments),
        'status_counts' => $statusCounts,
        'camps' => array_map(function ($c) {
            return ['id' => (int) $c['id'], 'code' => $c['code'], 'name' => $c['name']];
        }, $camps),
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Create Adjustment ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    requireFields($input, ['adjustment_type', 'camp_id', 'reason', 'lines']);

    if (!is_array($input['lines']) || count($input['lines']) === 0) {
        jsonError('At least one adjustment line is required', 400);
    }

    $campId = (int) $input['camp_id'];

    // Get camp code for doc number
    $ccStmt = $pdo->prepare("SELECT code FROM camps WHERE id = ? AND tenant_id = ?");
    $ccStmt->execute([$campId, $tenantId]);
    $campCode = $ccStmt->fetchColumn();
    if (!$campCode) {
        jsonError('Invalid camp', 400);
    }

    $adjustmentNumber = generateDocNumber($pdo, 'ADJ', $campCode, $tenantId);

    // Batch-fetch items for validation
    $itemIds = array_filter(array_map(function ($l) {
        return !empty($l['item_id']) ? (int) $l['item_id'] : null;
    }, $input['lines']));
    $itemIds = array_values(array_unique($itemIds));

    if (count($itemIds) === 0) {
        jsonError('No valid item lines provided', 400);
    }

    $ph = implode(',', array_fill(0, count($itemIds), '?'));
    $itemStmt = $pdo->prepare("SELECT id, item_code, name, weighted_avg_cost FROM items WHERE id IN ({$ph}) AND tenant_id = ?");
    $itemStmt->execute(array_merge($itemIds, [$tenantId]));
    $itemMap = [];
    foreach ($itemStmt->fetchAll() as $row) {
        $itemMap[(int) $row['id']] = $row;
    }

    // Verify all items belong to tenant
    foreach ($itemIds as $iid) {
        if (!isset($itemMap[$iid])) {
            jsonError("Item ID {$iid} not found or does not belong to this tenant", 400);
        }
    }

    // Batch-fetch current stock balances for this camp
    $sbStmt = $pdo->prepare("SELECT item_id, current_qty, unit_cost FROM stock_balances WHERE camp_id = ? AND tenant_id = ? AND item_id IN ({$ph})");
    $sbStmt->execute(array_merge([$campId, $tenantId], $itemIds));
    $stockMap = [];
    foreach ($sbStmt->fetchAll() as $row) {
        $stockMap[(int) $row['item_id']] = $row;
    }

    $pdo->beginTransaction();
    try {
        // Insert header
        $status = $input['status'] ?? 'draft';
        if (!in_array($status, ['draft', 'submitted'])) {
            $status = 'draft';
        }

        $pdo->prepare("
            INSERT INTO stock_adjustments (
                tenant_id, adjustment_number, adjustment_type, camp_id,
                reason, status, total_value, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW())
        ")->execute([
            $tenantId, $adjustmentNumber, $input['adjustment_type'], $campId,
            $input['reason'], $status, $auth['user_id'],
        ]);

        $adjustmentId = (int) $pdo->lastInsertId();
        $totalValue = 0;

        // Insert lines
        $lineStmt = $pdo->prepare("
            INSERT INTO stock_adjustment_lines (
                tenant_id, adjustment_id, item_id, adjustment_qty,
                new_qty, unit_cost, value_impact, reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        foreach ($input['lines'] as $line) {
            if (empty($line['item_id'])) continue;

            $itemId       = (int) $line['item_id'];
            $adjustQty    = (float) ($line['adjustment_qty'] ?? 0);
            $stock        = $stockMap[$itemId] ?? null;
            $currentQty   = $stock ? (float) $stock['current_qty'] : 0;
            $unitCost     = $stock ? (float) $stock['unit_cost'] : (float) ($itemMap[$itemId]['weighted_avg_cost'] ?? 0);
            $newQty       = $currentQty + $adjustQty;
            $valueImpact  = $adjustQty * $unitCost;
            $totalValue  += abs($valueImpact);

            $lineStmt->execute([
                $tenantId, $adjustmentId, $itemId, $adjustQty,
                $newQty, $unitCost, $valueImpact, $line['reason'] ?? null,
            ]);
        }

        // Update header total_value
        $pdo->prepare("UPDATE stock_adjustments SET total_value = ? WHERE id = ?")->execute([$totalValue, $adjustmentId]);

        $pdo->commit();

        jsonResponse([
            'success'    => true,
            'adjustment' => [
                'id'                => $adjustmentId,
                'adjustment_number' => $adjustmentNumber,
            ],
        ], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('[API Error] stock-adjustments POST: ' . $e->getMessage());
        jsonError('An unexpected error occurred. Please try again.', 500);
    }
    exit;
}

// ── PUT — Approve / Reject ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $user = requireManager();
    $tenantId = requireTenant($user);
    $input = getJsonInput();
    requireFields($input, ['id', 'action']);

    $adjId  = (int) $input['id'];
    $action = $input['action'];

    if (!in_array($action, ['approve', 'reject'])) {
        jsonError('Invalid action. Must be "approve" or "reject"', 400);
    }

    // Verify adjustment exists and belongs to tenant
    $adjStmt = $pdo->prepare("
        SELECT sa.id, sa.status, sa.camp_id
        FROM stock_adjustments sa
        WHERE sa.id = ? AND sa.tenant_id = ?
    ");
    $adjStmt->execute([$adjId, $tenantId]);
    $adj = $adjStmt->fetch();

    if (!$adj) {
        jsonError('Adjustment not found', 404);
    }

    if (!in_array($adj['status'], ['draft', 'submitted'])) {
        jsonError('Adjustment has already been ' . $adj['status'], 400);
    }

    if ($action === 'reject') {
        $pdo->prepare("
            UPDATE stock_adjustments
            SET status = 'rejected', approved_by = ?, approved_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ")->execute([$user['user_id'], $adjId, $tenantId]);

        jsonResponse(['success' => true, 'message' => 'Adjustment rejected']);
        exit;
    }

    // ── Approve: apply stock changes ──
    $pdo->beginTransaction();
    try {
        // Update header
        $pdo->prepare("
            UPDATE stock_adjustments
            SET status = 'approved', approved_by = ?, approved_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ")->execute([$user['user_id'], $adjId, $tenantId]);

        // Get lines
        $linesStmt = $pdo->prepare("
            SELECT sal.item_id, sal.adjustment_qty, sal.unit_cost, sal.value_impact
            FROM stock_adjustment_lines sal
            WHERE sal.adjustment_id = ? AND sal.tenant_id = ?
        ");
        $linesStmt->execute([$adjId, $tenantId]);
        $lines = $linesStmt->fetchAll();

        $campId = (int) $adj['camp_id'];

        foreach ($lines as $line) {
            $itemId    = (int) $line['item_id'];
            $adjQty    = (float) $line['adjustment_qty'];
            $unitCost  = (float) $line['unit_cost'];
            $valImpact = (float) $line['value_impact'];
            $direction = $adjQty >= 0 ? 'in' : 'out';
            $absQty    = abs($adjQty);

            // Create stock movement
            $pdo->prepare("
                INSERT INTO stock_movements (
                    tenant_id, item_id, camp_id, movement_type, direction,
                    quantity, unit_cost, total_value, balance_after,
                    reference_type, reference_id, created_by, movement_date, created_at
                ) VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, 0, 'stock_adjustment', ?, ?, CURDATE(), NOW())
            ")->execute([
                $tenantId, $itemId, $campId, $direction,
                $absQty, $unitCost, abs($valImpact),
                $adjId, $user['user_id'],
            ]);

            // Update stock_balances
            // Check if balance exists
            $balCheck = $pdo->prepare("SELECT id, current_qty, current_value FROM stock_balances WHERE item_id = ? AND camp_id = ? AND tenant_id = ?");
            $balCheck->execute([$itemId, $campId, $tenantId]);
            $bal = $balCheck->fetch();

            if ($bal) {
                $newQty   = (float) $bal['current_qty'] + $adjQty;
                $newValue = (float) $bal['current_value'] + $valImpact;
                if ($newQty < 0) $newQty = 0;
                if ($newValue < 0) $newValue = 0;

                $pdo->prepare("
                    UPDATE stock_balances
                    SET current_qty = ?, current_value = ?, updated_at = NOW()
                    WHERE id = ?
                ")->execute([$newQty, $newValue, $bal['id']]);

                // Update balance_after on the movement
                $mvId = (int) $pdo->lastInsertId();
                // Use the movement we just created — get it by reference
                $pdo->prepare("
                    UPDATE stock_movements
                    SET balance_after = ?
                    WHERE reference_type = 'stock_adjustment' AND reference_id = ? AND item_id = ? AND tenant_id = ?
                    ORDER BY id DESC LIMIT 1
                ")->execute([$newQty, $adjId, $itemId, $tenantId]);
            } else {
                // Insert new stock balance (positive adjustments only make sense here)
                $newQty   = max(0, $adjQty);
                $newValue = max(0, $valImpact);

                $pdo->prepare("
                    INSERT INTO stock_balances (tenant_id, camp_id, item_id, current_qty, current_value, unit_cost, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                ")->execute([$tenantId, $campId, $itemId, $newQty, $newValue, $unitCost]);
            }
        }

        $pdo->commit();

        jsonResponse(['success' => true, 'message' => 'Adjustment approved and stock updated']);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('[API Error] stock-adjustments PUT approve: ' . $e->getMessage());
        jsonError('An unexpected error occurred. Please try again.', 500);
    }
    exit;
}

jsonError('Method not allowed', 405);
