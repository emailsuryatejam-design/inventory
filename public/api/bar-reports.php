<?php
/**
 * KCL Stores — Bar Reports & Analytics
 * GET /api/bar-reports.php?type=top_selling
 * GET /api/bar-reports.php?type=profitability
 * GET /api/bar-reports.php?type=server_performance
 * GET /api/bar-reports.php?type=hourly
 * GET /api/bar-reports.php?type=daily_summary
 * GET /api/bar-reports.php?type=payment_methods
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

$campId = $auth['camp_id'];
if (!$campId) jsonError('Reports require camp assignment', 400);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('Method not allowed', 405);

$type = $_GET['type'] ?? '';
$dateFrom = $_GET['date_from'] ?? date('Y-m-01'); // default: first of month
$dateTo = $_GET['date_to'] ?? date('Y-m-d');

// ── Top Selling ──
if ($type === 'top_selling') {
    $limit = min(50, max(10, (int)($_GET['limit'] ?? 20)));
    $orderBy = ($_GET['order_by'] ?? 'qty') === 'revenue' ? 'total_revenue' : 'total_qty';

    $stmt = $pdo->prepare("
        SELECT tl.item_id, i.name as item_name, i.item_code,
               ig.name as group_name,
               SUM(tl.quantity) as total_qty,
               SUM(tl.line_total) as total_revenue,
               COUNT(DISTINCT tl.tab_id) as tab_count
        FROM pos_tab_lines tl
        JOIN pos_tabs t ON tl.tab_id = t.id
        JOIN items i ON tl.item_id = i.id
        LEFT JOIN item_groups ig ON i.item_group_id = ig.id
        WHERE t.tenant_id = ? AND t.camp_id = ?
          AND t.status = 'closed'
          AND tl.is_voided = 0
          AND DATE(t.closed_at) BETWEEN ? AND ?
        GROUP BY tl.item_id, i.name, i.item_code, ig.name
        ORDER BY {$orderBy} DESC
        LIMIT ?
    ");
    $stmt->execute([$tenantId, $campId, $dateFrom, $dateTo, $limit]);
    $items = $stmt->fetchAll();

    jsonResponse([
        'type' => 'top_selling',
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'items' => array_map(function($r) {
            return [
                'item_id' => (int)$r['item_id'],
                'item_name' => $r['item_name'],
                'item_code' => $r['item_code'],
                'group_name' => $r['group_name'],
                'total_qty' => (float)$r['total_qty'],
                'total_revenue' => (float)$r['total_revenue'],
                'tab_count' => (int)$r['tab_count'],
            ];
        }, $items),
    ]);
    exit;
}

// ── Profitability ──
if ($type === 'profitability') {
    $stmt = $pdo->prepare("
        SELECT tl.item_id, i.name as item_name, i.item_code,
               SUM(tl.quantity) as total_qty,
               SUM(tl.line_total) as total_revenue,
               i.weighted_avg_cost, i.last_purchase_price
        FROM pos_tab_lines tl
        JOIN pos_tabs t ON tl.tab_id = t.id
        JOIN items i ON tl.item_id = i.id
        WHERE t.tenant_id = ? AND t.camp_id = ?
          AND t.status = 'closed'
          AND tl.is_voided = 0
          AND DATE(t.closed_at) BETWEEN ? AND ?
        GROUP BY tl.item_id, i.name, i.item_code, i.weighted_avg_cost, i.last_purchase_price
        ORDER BY total_revenue DESC
        LIMIT 50
    ");
    $stmt->execute([$tenantId, $campId, $dateFrom, $dateTo]);
    $items = $stmt->fetchAll();

    jsonResponse([
        'type' => 'profitability',
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'items' => array_map(function($r) {
            $revenue = (float)$r['total_revenue'];
            $costPerUnit = (float)($r['weighted_avg_cost'] ?: $r['last_purchase_price'] ?: 0);
            $totalCost = (float)$r['total_qty'] * $costPerUnit;
            $margin = $revenue - $totalCost;
            $marginPct = $revenue > 0 ? round($margin / $revenue * 100, 1) : 0;

            return [
                'item_id' => (int)$r['item_id'],
                'item_name' => $r['item_name'],
                'item_code' => $r['item_code'],
                'total_qty' => (float)$r['total_qty'],
                'total_revenue' => $revenue,
                'total_cost' => $totalCost,
                'margin' => $margin,
                'margin_pct' => $marginPct,
            ];
        }, $items),
    ]);
    exit;
}

// ── Server Performance ──
if ($type === 'server_performance') {
    $stmt = $pdo->prepare("
        SELECT t.server_id, u.name as server_name,
               COUNT(*) as tab_count,
               COALESCE(SUM(t.total), 0) as total_sales,
               COALESCE(AVG(t.total), 0) as avg_tab_value,
               COALESCE(SUM(t.covers), 0) as total_covers
        FROM pos_tabs t
        LEFT JOIN users u ON t.server_id = u.id
        WHERE t.tenant_id = ? AND t.camp_id = ?
          AND t.status = 'closed'
          AND DATE(t.closed_at) BETWEEN ? AND ?
        GROUP BY t.server_id, u.name
        ORDER BY total_sales DESC
    ");
    $stmt->execute([$tenantId, $campId, $dateFrom, $dateTo]);
    $servers = $stmt->fetchAll();

    jsonResponse([
        'type' => 'server_performance',
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'servers' => array_map(function($r) {
            return [
                'server_id' => (int)$r['server_id'],
                'server_name' => $r['server_name'],
                'tab_count' => (int)$r['tab_count'],
                'total_sales' => (float)$r['total_sales'],
                'avg_tab_value' => round((float)$r['avg_tab_value'], 2),
                'total_covers' => (int)$r['total_covers'],
            ];
        }, $servers),
    ]);
    exit;
}

// ── Hourly Sales Distribution ──
if ($type === 'hourly') {
    $stmt = $pdo->prepare("
        SELECT HOUR(t.closed_at) as hour,
               COUNT(*) as tab_count,
               COALESCE(SUM(t.total), 0) as total_sales
        FROM pos_tabs t
        WHERE t.tenant_id = ? AND t.camp_id = ?
          AND t.status = 'closed'
          AND DATE(t.closed_at) BETWEEN ? AND ?
        GROUP BY HOUR(t.closed_at)
        ORDER BY hour
    ");
    $stmt->execute([$tenantId, $campId, $dateFrom, $dateTo]);
    $hours = $stmt->fetchAll();

    // Fill all 24 hours
    $hourlyData = array_fill(0, 24, ['hour' => 0, 'tab_count' => 0, 'total_sales' => 0]);
    foreach ($hours as $h) {
        $hr = (int)$h['hour'];
        $hourlyData[$hr] = [
            'hour' => $hr,
            'tab_count' => (int)$h['tab_count'],
            'total_sales' => (float)$h['total_sales'],
        ];
    }
    // Only return hours 6-23 (bar operating hours typically)
    $hourlyData = array_values(array_filter($hourlyData, function($h) {
        return $h['hour'] >= 6;
    }));

    jsonResponse([
        'type' => 'hourly',
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'hours' => $hourlyData,
    ]);
    exit;
}

// ── Daily Summary ──
if ($type === 'daily_summary') {
    try {
        $stmt = $pdo->prepare("
            SELECT DATE(t.closed_at) as date,
                   COUNT(*) as tab_count,
                   COALESCE(SUM(t.total), 0) as total_sales,
                   COALESCE(SUM(t.discount_amount), 0) as total_discounts,
                   COALESCE(SUM(t.covers), 0) as total_covers
            FROM pos_tabs t
            WHERE t.tenant_id = ? AND t.camp_id = ?
              AND t.status = 'closed'
              AND DATE(t.closed_at) BETWEEN ? AND ?
            GROUP BY DATE(t.closed_at)
            ORDER BY date DESC
        ");
        $stmt->execute([$tenantId, $campId, $dateFrom, $dateTo]);
        $days = $stmt->fetchAll();
    } catch (Exception $e) {
        error_log('[Bar Reports] daily_summary main query failed: ' . $e->getMessage());
        $days = [];
    }

    // Void totals per day
    $voidMap = [];
    try {
        $voidStmt = $pdo->prepare("
            SELECT DATE(v.created_at) as date, COALESCE(SUM(v.original_amount), 0) as total_voids
            FROM pos_voids v
            WHERE v.tenant_id = ? AND DATE(v.created_at) BETWEEN ? AND ?
            GROUP BY DATE(v.created_at)
        ");
        $voidStmt->execute([$tenantId, $dateFrom, $dateTo]);
        foreach ($voidStmt->fetchAll() as $v) {
            $voidMap[$v['date']] = (float)$v['total_voids'];
        }
    } catch (Exception $e) {
        error_log('[Bar Reports] voids query failed: ' . $e->getMessage());
    }

    jsonResponse([
        'type' => 'daily_summary',
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'days' => array_map(function($d) use ($voidMap) {
            return [
                'date' => $d['date'],
                'tab_count' => (int)$d['tab_count'],
                'total_sales' => (float)$d['total_sales'],
                'total_discounts' => (float)$d['total_discounts'],
                'total_voids' => $voidMap[$d['date']] ?? 0,
                'total_covers' => (int)$d['total_covers'],
            ];
        }, $days),
    ]);
    exit;
}

// ── Payment Methods ──
if ($type === 'payment_methods') {
    $stmt = $pdo->prepare("
        SELECT t.payment_method,
               COUNT(*) as tab_count,
               COALESCE(SUM(t.total), 0) as total_sales
        FROM pos_tabs t
        WHERE t.tenant_id = ? AND t.camp_id = ?
          AND t.status = 'closed'
          AND t.payment_method IS NOT NULL
          AND DATE(t.closed_at) BETWEEN ? AND ?
        GROUP BY t.payment_method
        ORDER BY total_sales DESC
    ");
    $stmt->execute([$tenantId, $campId, $dateFrom, $dateTo]);
    $methods = $stmt->fetchAll();

    jsonResponse([
        'type' => 'payment_methods',
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'methods' => array_map(function($m) {
            return [
                'payment_method' => $m['payment_method'],
                'tab_count' => (int)$m['tab_count'],
                'total_sales' => (float)$m['total_sales'],
            ];
        }, $methods),
    ]);
    exit;
}

jsonError('Invalid report type. Use: top_selling, profitability, server_performance, hourly, daily_summary, payment_methods', 400);
