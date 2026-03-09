<?php
/**
 * WebSquare — Push Subscription & Notification API
 * Ported from Karibu Pantry Planner
 *
 * Actions (GET):
 *   vapid_key     — get VAPID public key
 *   status        — check if user has active subscriptions
 *   notifications — list in-app notifications
 *   unread_count  — count unread notifications
 *
 * Actions (POST):
 *   subscribe     — register push subscription
 *   unsubscribe   — remove push subscription
 *   mark_read     — mark notification as read
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/lib/push-sender.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$userId = $auth['user_id'];
$pdo = getDB();

$input = $_SERVER['REQUEST_METHOD'] === 'POST' ? getJsonInput() : [];
$action = $_GET['action'] ?? ($input['action'] ?? '');

switch ($action) {

    // ── Get VAPID public key ──
    case 'vapid_key':
        if (!defined('VAPID_PUBLIC_KEY')) {
            jsonError('Push notifications not configured');
        }
        jsonResponse(['key' => VAPID_PUBLIC_KEY]);

    // ── Subscribe ──
    case 'subscribe':
        requireMethod('POST');
        $endpoint = trim($input['endpoint'] ?? '');
        $p256dh = trim($input['p256dh'] ?? '');
        $authKey = trim($input['auth_key'] ?? '');

        if (!$endpoint || !$p256dh || !$authKey) {
            jsonError('Missing subscription data');
        }

        $kitchenId = (int)($input['kitchen_id'] ?? 0);

        // Upsert: remove old subscription for this endpoint, insert new
        $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND tenant_id = ?')->execute([$endpoint, $tenantId]);
        $stmt = $pdo->prepare('INSERT INTO push_subscriptions (tenant_id, user_id, kitchen_id, endpoint, p256dh, auth_key) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$tenantId, $userId, $kitchenId, $endpoint, $p256dh, $authKey]);

        jsonResponse(['subscribed' => true]);

    // ── Unsubscribe ──
    case 'unsubscribe':
        requireMethod('POST');
        $endpoint = trim($input['endpoint'] ?? '');
        if ($endpoint) {
            $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ? AND tenant_id = ?')
               ->execute([$endpoint, $userId, $tenantId]);
        }
        jsonResponse(['unsubscribed' => true]);

    // ── Check subscription status ──
    case 'status':
        $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ? AND tenant_id = ?');
        $stmt->execute([$userId, $tenantId]);
        $count = $stmt->fetch()['count'];
        jsonResponse(['subscribed' => $count > 0, 'count' => (int)$count]);

    // ── List notifications ──
    case 'notifications':
        $kitchenId = (int)($_GET['kitchen_id'] ?? 0);
        $limit = min((int)($_GET['limit'] ?? 20), 50);
        $stmt = $pdo->prepare('SELECT * FROM notifications WHERE tenant_id = ? AND (kitchen_id = ? OR user_id = ?) ORDER BY created_at DESC LIMIT ?');
        $stmt->execute([$tenantId, $kitchenId, $userId, $limit]);
        jsonResponse(['notifications' => $stmt->fetchAll()]);

    // ── Mark notification read ──
    case 'mark_read':
        requireMethod('POST');
        $id = (int)($input['id'] ?? 0);
        if ($id) {
            $pdo->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ? AND (user_id = ? OR kitchen_id IN (SELECT kitchen_id FROM push_subscriptions WHERE user_id = ? AND tenant_id = ?))')
               ->execute([$id, $tenantId, $userId, $userId, $tenantId]);
        }
        jsonResponse(['ok' => true]);

    // ── Unread count ──
    case 'unread_count':
        $kitchenId = (int)($_GET['kitchen_id'] ?? 0);
        $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND (kitchen_id = ? OR user_id = ?) AND is_read = 0');
        $stmt->execute([$tenantId, $kitchenId, $userId]);
        jsonResponse(['count' => (int)$stmt->fetch()['count']]);

    default:
        jsonError('Unknown action');
}
