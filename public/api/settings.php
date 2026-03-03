<?php
/**
 * KCL Stores — Tenant Settings
 * GET  /api/settings.php           — get all settings (or filtered by ?keys=)
 * POST /api/settings.php           — upsert settings (admin only)
 *
 * Table: tenant_settings (id, tenant_id, setting_key, setting_value, updated_at)
 * UNIQUE(tenant_id, setting_key)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — Retrieve settings ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $keysParam = trim($_GET['keys'] ?? '');

    if ($keysParam) {
        // Filter specific keys (comma-separated)
        $keys = array_filter(array_map('trim', explode(',', $keysParam)));
        if (empty($keys)) {
            jsonResponse(['settings' => new \stdClass()]);
            exit;
        }

        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $stmt = $pdo->prepare("
            SELECT setting_key, setting_value
            FROM tenant_settings
            WHERE tenant_id = ? AND setting_key IN ({$placeholders})
        ");
        $stmt->execute(array_merge([$tenantId], $keys));
    } else {
        // All settings for tenant
        $stmt = $pdo->prepare("
            SELECT setting_key, setting_value
            FROM tenant_settings
            WHERE tenant_id = ?
        ");
        $stmt->execute([$tenantId]);
    }

    $rows = $stmt->fetchAll();
    $settings = new \stdClass();
    foreach ($rows as $row) {
        $settings->{$row['setting_key']} = $row['setting_value'];
    }

    jsonResponse(['settings' => $settings]);
    exit;
}

// ── POST — Upsert settings (admin only) ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireAdmin();
    $input = getJsonInput();

    if (!isset($input['settings']) || !is_array($input['settings'])) {
        jsonError('Missing required field: settings (object)', 400);
    }

    $settings = $input['settings'];
    if (empty($settings)) {
        jsonError('No settings provided', 400);
    }

    $stmt = $pdo->prepare("
        INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, updated_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
    ");

    $pdo->beginTransaction();
    try {
        foreach ($settings as $key => $value) {
            $stmt->execute([$tenantId, $key, $value]);
        }
        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Failed to save settings: ' . $e->getMessage(), 500);
    }

    jsonResponse(['success' => true, 'message' => 'Settings saved']);
    exit;
}

jsonError('Method not allowed', 405);
