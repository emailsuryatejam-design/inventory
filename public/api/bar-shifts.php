<?php
/**
 * KCL Stores — Bar Shift Management
 * GET  /api/bar-shifts.php              — current open shift + history
 * GET  /api/bar-shifts.php?id=X         — shift detail with cash entries
 * POST /api/bar-shifts.php              — open shift / record cash entry
 * PUT  /api/bar-shifts.php              — close shift
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

$campId = $auth['camp_id'];
if (!$campId) jsonError('Bar shifts require camp assignment', 400);

// ── GET ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = (int) ($_GET['id'] ?? 0);

    // ── Detail by ID ──
    if ($id) {
        $stmt = $pdo->prepare("
            SELECT s.*, u_open.name as opened_by_name, u_close.name as closed_by_name,
                   c.code as camp_code, c.name as camp_name
            FROM pos_shifts s
            LEFT JOIN users u_open ON s.opened_by = u_open.id
            LEFT JOIN users u_close ON s.closed_by = u_close.id
            LEFT JOIN camps c ON s.camp_id = c.id
            WHERE s.id = ? AND s.tenant_id = ?
        ");
        $stmt->execute([$id, $tenantId]);
        $shift = $stmt->fetch();
        if (!$shift) jsonError('Shift not found', 404);

        // Access control
        if (in_array($auth['role'], ['camp_storekeeper', 'camp_manager']) && (int)$shift['camp_id'] !== (int)$campId) {
            jsonError('Access denied', 403);
        }

        // Cash entries
        $ceStmt = $pdo->prepare("
            SELECT ce.*, u.name as created_by_name
            FROM pos_cash_entries ce
            LEFT JOIN users u ON ce.created_by = u.id
            WHERE ce.shift_id = ? AND ce.tenant_id = ?
            ORDER BY ce.created_at
        ");
        $ceStmt->execute([$id, $tenantId]);
        $entries = $ceStmt->fetchAll();

        // Tabs closed in this shift
        $tabsStmt = $pdo->prepare("
            SELECT COUNT(*) as tab_count,
                   COALESCE(SUM(CASE WHEN status = 'closed' THEN total ELSE 0 END), 0) as total_sales,
                   COALESCE(SUM(discount_amount), 0) as total_discounts,
                   COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
                   COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales,
                   COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN total ELSE 0 END), 0) as mpesa_sales,
                   COALESCE(SUM(CASE WHEN payment_method = 'room_charge' THEN total ELSE 0 END), 0) as room_charge_sales,
                   COALESCE(SUM(CASE WHEN payment_method = 'complimentary' THEN total ELSE 0 END), 0) as complimentary_total
            FROM pos_tabs
            WHERE shift_id = ? AND tenant_id = ? AND status IN ('closed', 'voided')
        ");
        $tabsStmt->execute([$id, $tenantId]);
        $tabSummary = $tabsStmt->fetch();

        jsonResponse([
            'shift' => [
                'id' => (int)$shift['id'],
                'shift_number' => $shift['shift_number'],
                'camp_code' => $shift['camp_code'],
                'camp_name' => $shift['camp_name'],
                'opened_by' => $shift['opened_by_name'],
                'closed_by' => $shift['closed_by_name'],
                'opened_at' => $shift['opened_at'],
                'closed_at' => $shift['closed_at'],
                'opening_float' => (float)$shift['opening_float'],
                'closing_cash' => $shift['closing_cash'] !== null ? (float)$shift['closing_cash'] : null,
                'expected_cash' => $shift['expected_cash'] !== null ? (float)$shift['expected_cash'] : null,
                'variance' => $shift['variance'] !== null ? (float)$shift['variance'] : null,
                'total_sales' => (float)$shift['total_sales'],
                'total_voids' => (float)$shift['total_voids'],
                'total_discounts' => (float)$shift['total_discounts'],
                'total_complimentary' => (float)$shift['total_complimentary'],
                'tab_count' => (int)$shift['tab_count'],
                'status' => $shift['status'],
                'notes' => $shift['notes'],
                'created_at' => $shift['created_at'],
            ],
            'cash_entries' => array_map(function($e) {
                return [
                    'id' => (int)$e['id'],
                    'entry_type' => $e['entry_type'],
                    'amount' => (float)$e['amount'],
                    'reason' => $e['reason'],
                    'created_by' => $e['created_by_name'],
                    'created_at' => $e['created_at'],
                ];
            }, $entries),
            'tab_summary' => [
                'tab_count' => (int)$tabSummary['tab_count'],
                'total_sales' => (float)$tabSummary['total_sales'],
                'total_discounts' => (float)$tabSummary['total_discounts'],
                'cash_sales' => (float)$tabSummary['cash_sales'],
                'card_sales' => (float)$tabSummary['card_sales'],
                'mpesa_sales' => (float)$tabSummary['mpesa_sales'],
                'room_charge_sales' => (float)$tabSummary['room_charge_sales'],
                'complimentary_total' => (float)$tabSummary['complimentary_total'],
            ],
        ]);
        exit;
    }

    // ── List: current open shift + history ──
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(50, max(10, (int)($_GET['per_page'] ?? 20)));
    $offset = ($page - 1) * $perPage;

    // Current open shift for this camp
    $openStmt = $pdo->prepare("
        SELECT s.*, u.name as opened_by_name
        FROM pos_shifts s
        LEFT JOIN users u ON s.opened_by = u.id
        WHERE s.camp_id = ? AND s.tenant_id = ? AND s.status = 'open'
        ORDER BY s.opened_at DESC LIMIT 1
    ");
    $openStmt->execute([$campId, $tenantId]);
    $openShift = $openStmt->fetch();

    // History
    $where = ['s.camp_id = ?', 's.tenant_id = ?'];
    $params = [$campId, $tenantId];

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM pos_shifts s WHERE " . implode(' AND ', $where));
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $histStmt = $pdo->prepare("
        SELECT s.*, u_open.name as opened_by_name, u_close.name as closed_by_name
        FROM pos_shifts s
        LEFT JOIN users u_open ON s.opened_by = u_open.id
        LEFT JOIN users u_close ON s.closed_by = u_close.id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY s.opened_at DESC LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $histStmt->execute($params);
    $shifts = $histStmt->fetchAll();

    $formatShift = function($s) {
        return [
            'id' => (int)$s['id'],
            'shift_number' => $s['shift_number'],
            'opened_by' => $s['opened_by_name'],
            'closed_by' => $s['closed_by_name'] ?? null,
            'opened_at' => $s['opened_at'],
            'closed_at' => $s['closed_at'],
            'opening_float' => (float)$s['opening_float'],
            'closing_cash' => $s['closing_cash'] !== null ? (float)$s['closing_cash'] : null,
            'variance' => $s['variance'] !== null ? (float)$s['variance'] : null,
            'total_sales' => (float)$s['total_sales'],
            'tab_count' => (int)$s['tab_count'],
            'status' => $s['status'],
        ];
    };

    jsonResponse([
        'current_shift' => $openShift ? $formatShift($openShift) : null,
        'shifts' => array_map($formatShift, $shifts),
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => (int)ceil($total / $perPage),
        ],
    ]);
    exit;
}

// ── POST — Open Shift / Cash Entry ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $action = $input['action'] ?? '';

    // ── Open shift ──
    if ($action === 'open') {
        $openingFloat = (float)($input['opening_float'] ?? 0);

        // Check no open shift exists for this camp
        $checkStmt = $pdo->prepare("SELECT id FROM pos_shifts WHERE camp_id = ? AND tenant_id = ? AND status = 'open'");
        $checkStmt->execute([$campId, $tenantId]);
        if ($checkStmt->fetch()) {
            jsonError('A shift is already open at this location. Close it before opening a new one.', 400);
        }

        $campCodeStmt = $pdo->prepare("SELECT code FROM camps WHERE id = ? AND tenant_id = ?");
        $campCodeStmt->execute([$campId, $tenantId]);
        $campCode = $campCodeStmt->fetchColumn();
        $shiftNumber = generateDocNumber($pdo, 'SHF', $campCode, $tenantId);

        $pdo->prepare("
            INSERT INTO pos_shifts (tenant_id, camp_id, shift_number, opened_by, opened_at, opening_float, status, created_at)
            VALUES (?, ?, ?, ?, NOW(), ?, 'open', NOW())
        ")->execute([$tenantId, $campId, $shiftNumber, $auth['user_id'], $openingFloat]);

        $shiftId = (int)$pdo->lastInsertId();

        jsonResponse([
            'message' => 'Shift opened',
            'shift' => [
                'id' => $shiftId,
                'shift_number' => $shiftNumber,
                'opening_float' => $openingFloat,
                'status' => 'open',
            ],
        ], 201);
        exit;
    }

    // ── Cash entry ──
    if ($action === 'cash_entry') {
        requireFields($input, ['shift_id', 'entry_type', 'amount', 'reason']);

        $shiftId = (int)$input['shift_id'];
        $entryType = $input['entry_type'];
        $amount = (float)$input['amount'];
        $reason = trim($input['reason']);

        if (!in_array($entryType, ['cash_in', 'cash_out', 'paid_out'])) {
            jsonError('Invalid entry type', 400);
        }
        if ($amount <= 0) jsonError('Amount must be positive', 400);

        // Verify shift is open and belongs to this camp
        $shiftStmt = $pdo->prepare("SELECT id FROM pos_shifts WHERE id = ? AND tenant_id = ? AND camp_id = ? AND status = 'open'");
        $shiftStmt->execute([$shiftId, $tenantId, $campId]);
        if (!$shiftStmt->fetch()) {
            jsonError('Shift not found or not open', 400);
        }

        $pdo->prepare("
            INSERT INTO pos_cash_entries (tenant_id, shift_id, entry_type, amount, reason, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ")->execute([$tenantId, $shiftId, $entryType, $amount, $reason, $auth['user_id']]);

        jsonResponse([
            'message' => 'Cash entry recorded',
            'entry' => [
                'id' => (int)$pdo->lastInsertId(),
                'entry_type' => $entryType,
                'amount' => $amount,
                'reason' => $reason,
            ],
        ], 201);
        exit;
    }

    jsonError('Invalid action. Use: open, cash_entry', 400);
    exit;
}

// ── PUT — Close Shift ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = getJsonInput();
    requireFields($input, ['id', 'closing_cash']);

    $shiftId = (int)$input['id'];
    $closingCash = (float)$input['closing_cash'];
    $notes = $input['notes'] ?? null;

    // Get shift
    $shiftStmt = $pdo->prepare("SELECT * FROM pos_shifts WHERE id = ? AND tenant_id = ? AND status = 'open'");
    $shiftStmt->execute([$shiftId, $tenantId]);
    $shift = $shiftStmt->fetch();

    if (!$shift) jsonError('Shift not found or already closed', 400);
    if ((int)$shift['camp_id'] !== (int)$campId) jsonError('Access denied', 403);

    // Calculate expected cash: float + cash sales - cash_out/paid_out + cash_in
    $cashEntriesStmt = $pdo->prepare("
        SELECT entry_type, COALESCE(SUM(amount), 0) as total
        FROM pos_cash_entries
        WHERE shift_id = ? AND tenant_id = ?
        GROUP BY entry_type
    ");
    $cashEntriesStmt->execute([$shiftId, $tenantId]);
    $cashEntries = $cashEntriesStmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $cashIn = (float)($cashEntries['cash_in'] ?? 0);
    $cashOut = (float)($cashEntries['cash_out'] ?? 0);
    $paidOut = (float)($cashEntries['paid_out'] ?? 0);

    // Tab totals for this shift
    $tabTotals = $pdo->prepare("
        SELECT
            COALESCE(SUM(CASE WHEN status = 'closed' THEN total ELSE 0 END), 0) as total_sales,
            COALESCE(SUM(CASE WHEN status = 'closed' AND payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
            COALESCE(SUM(discount_amount), 0) as total_discounts,
            COALESCE(SUM(CASE WHEN status = 'closed' AND payment_method = 'complimentary' THEN total ELSE 0 END), 0) as total_complimentary,
            COUNT(*) as tab_count
        FROM pos_tabs WHERE shift_id = ? AND tenant_id = ?
    ");
    $tabTotals->execute([$shiftId, $tenantId]);
    $totals = $tabTotals->fetch();

    // Voided tab amounts
    $voidTotals = $pdo->prepare("
        SELECT COALESCE(SUM(original_amount), 0) as total_voids
        FROM pos_voids WHERE tenant_id = ?
        AND reference_type = 'tab' AND reference_id IN (
            SELECT id FROM pos_tabs WHERE shift_id = ? AND tenant_id = ?
        )
    ");
    $voidTotals->execute([$tenantId, $shiftId, $tenantId]);
    $totalVoids = (float)$voidTotals->fetchColumn();

    $totalSales = (float)$totals['total_sales'];
    $cashSales = (float)$totals['cash_sales'];
    $totalDiscounts = (float)$totals['total_discounts'];
    $totalComplimentary = (float)$totals['total_complimentary'];
    $tabCount = (int)$totals['tab_count'];

    $openingFloat = (float)$shift['opening_float'];
    $expectedCash = $openingFloat + $cashSales + $cashIn - $cashOut - $paidOut;
    $variance = $closingCash - $expectedCash;

    $pdo->prepare("
        UPDATE pos_shifts
        SET status = 'closed', closed_by = ?, closed_at = NOW(),
            closing_cash = ?, expected_cash = ?, variance = ?,
            total_sales = ?, total_voids = ?, total_discounts = ?,
            total_complimentary = ?, tab_count = ?, notes = ?
        WHERE id = ? AND tenant_id = ?
    ")->execute([
        $auth['user_id'], $closingCash, $expectedCash, $variance,
        $totalSales, $totalVoids, $totalDiscounts,
        $totalComplimentary, $tabCount, $notes,
        $shiftId, $tenantId,
    ]);

    jsonResponse([
        'message' => 'Shift closed',
        'shift' => [
            'id' => $shiftId,
            'shift_number' => $shift['shift_number'],
            'opening_float' => $openingFloat,
            'closing_cash' => $closingCash,
            'expected_cash' => $expectedCash,
            'variance' => $variance,
            'total_sales' => $totalSales,
            'total_voids' => $totalVoids,
            'total_discounts' => $totalDiscounts,
            'total_complimentary' => $totalComplimentary,
            'tab_count' => $tabCount,
            'status' => 'closed',
        ],
    ]);
    exit;
}

jsonError('Method not allowed', 405);
