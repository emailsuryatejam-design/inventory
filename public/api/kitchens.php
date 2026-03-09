<?php
/**
 * WebSquare — Kitchens API
 * Ported from Karibu Pantry Planner
 *
 * Actions: list, get, save, toggle_active, get_settings, save_settings
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list':
        $activeOnly = ($_GET['active'] ?? '1') === '1';

        $where = ['k.tenant_id = ?'];
        $params = [$tenantId];

        if ($activeOnly) {
            $where[] = 'k.is_active = 1';
        }

        $whereClause = implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT k.*,
                (SELECT COUNT(*) FROM users WHERE kitchen_id = k.id AND is_active = 1) AS user_count,
                c.name AS camp_name, c.code AS camp_code
            FROM kitchens k
            LEFT JOIN camps c ON c.id = k.camp_id
            WHERE {$whereClause}
            ORDER BY k.name
        ");
        $stmt->execute($params);
        jsonResponse(['kitchens' => $stmt->fetchAll()]);

    case 'get':
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('Kitchen ID required');

        $stmt = $pdo->prepare('SELECT k.*, c.name AS camp_name, c.code AS camp_code
            FROM kitchens k LEFT JOIN camps c ON c.id = k.camp_id
            WHERE k.id = ? AND k.tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
        $kitchen = $stmt->fetch();
        if (!$kitchen) jsonError('Kitchen not found', 404);
        jsonResponse(['kitchen' => $kitchen]);

    case 'save':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();

        $id = (int)($data['id'] ?? 0);
        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $campId = isset($data['camp_id']) ? (int)$data['camp_id'] : null;
        if (!$name || !$code) jsonError('Name and code required');

        if ($id) {
            $stmt = $pdo->prepare('UPDATE kitchens SET name = ?, code = ?, camp_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?');
            $stmt->execute([$name, $code, $campId, $id, $tenantId]);
            jsonResponse(['updated' => true]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO kitchens (tenant_id, name, code, camp_id) VALUES (?, ?, ?, ?)');
            $stmt->execute([$tenantId, $name, $code, $campId]);
            jsonResponse(['created' => true, 'id' => (int)$pdo->lastInsertId()], 201);
        }

    case 'toggle_active':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();
        $id = (int)($data['id'] ?? 0);
        if (!$id) jsonError('Kitchen ID required');

        $pdo->prepare('UPDATE kitchens SET is_active = NOT is_active, updated_at = NOW() WHERE id = ? AND tenant_id = ?')
            ->execute([$id, $tenantId]);
        jsonResponse(['toggled' => true]);

    case 'get_settings':
        $kid = (int)($_GET['kitchen_id'] ?? 0);
        if (!$kid) jsonError('Kitchen ID required');

        $stmt = $pdo->prepare("SELECT default_guest_count, rounding_mode, min_order_qty FROM kitchens WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$kid, $tenantId]);
        $settings = $stmt->fetch();
        if (!$settings) jsonError('Kitchen not found', 404);

        jsonResponse(['settings' => [
            'default_guest_count' => (int)($settings['default_guest_count'] ?? 20),
            'rounding_mode'       => $settings['rounding_mode'] ?? 'ceil',
            'min_order_qty'       => (float)($settings['min_order_qty'] ?? 0.1),
        ]]);

    case 'save_settings':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();

        $kid = (int)($data['kitchen_id'] ?? 0);
        if (!$kid) jsonError('Kitchen ID required');

        $defaultGuests = max(1, (int)($data['default_guest_count'] ?? 20));
        $roundingMode  = in_array($data['rounding_mode'] ?? '', ['ceil', 'half', 'whole', 'none']) ? $data['rounding_mode'] : 'ceil';
        $minOrderQty   = max(0, (float)($data['min_order_qty'] ?? 0.1));

        $stmt = $pdo->prepare("UPDATE kitchens SET default_guest_count = ?, rounding_mode = ?, min_order_qty = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$defaultGuests, $roundingMode, $minOrderQty, $kid, $tenantId]);
        jsonResponse(['saved' => true]);

    default:
        jsonError('Unknown action');
}
