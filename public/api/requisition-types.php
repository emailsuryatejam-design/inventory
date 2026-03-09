<?php
/**
 * WebSquare — Requisition Types API
 * Ported from Karibu Pantry Planner
 *
 * Actions: list, list_all, save, toggle_active, reorder
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

$action = $_GET['action'] ?? 'list';

switch ($action) {

    case 'list':
        $stmt = $pdo->prepare("SELECT id, name, code, sort_order FROM requisition_types WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order, name");
        $stmt->execute([$tenantId]);
        jsonResponse(['types' => $stmt->fetchAll()]);

    case 'list_all':
        requireAdmin();
        $stmt = $pdo->prepare("SELECT * FROM requisition_types WHERE tenant_id = ? ORDER BY sort_order, name");
        $stmt->execute([$tenantId]);
        jsonResponse(['types' => $stmt->fetchAll()]);

    case 'save':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();

        $id   = (int)($data['id'] ?? 0);
        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');

        if (!$name) jsonError('Name is required');
        if (!$code) {
            $code = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $name));
            $code = trim($code, '_');
        }

        if ($id > 0) {
            $sortOrder = (int)($data['sort_order'] ?? 0);
            $stmt = $pdo->prepare("UPDATE requisition_types SET name = ?, code = ?, sort_order = ?, is_active = ? WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$name, $code, $sortOrder, (int)($data['is_active'] ?? 1), $id, $tenantId]);
        } else {
            $maxSort = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) FROM requisition_types WHERE tenant_id = ?");
            $maxSort->execute([$tenantId]);
            $nextSort = (int)$maxSort->fetchColumn() + 1;
            $stmt = $pdo->prepare("INSERT INTO requisition_types (tenant_id, name, code, sort_order) VALUES (?, ?, ?, ?)");
            $stmt->execute([$tenantId, $name, $code, $nextSort]);
            $id = (int)$pdo->lastInsertId();
        }

        jsonResponse(['saved' => true, 'id' => $id]);

    case 'toggle_active':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();
        $id = (int)($data['id'] ?? 0);
        if (!$id) jsonError('ID required');

        $pdo->prepare("UPDATE requisition_types SET is_active = NOT is_active WHERE id = ? AND tenant_id = ?")
            ->execute([$id, $tenantId]);
        jsonResponse(['toggled' => true]);

    case 'reorder':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();
        $items = $data['items'] ?? [];

        $stmt = $pdo->prepare("UPDATE requisition_types SET sort_order = ? WHERE id = ? AND tenant_id = ?");
        foreach ($items as $item) {
            $stmt->execute([(int)$item['sort_order'], (int)$item['id'], $tenantId]);
        }
        jsonResponse(['reordered' => true]);

    default:
        jsonError('Unknown action', 400);
}
