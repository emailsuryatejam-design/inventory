<?php
/**
 * KCL Stores — Camp Modules
 * GET  /api/modules.php?action=camp_modules   — list camps + modules + enabled state (admin)
 * POST /api/modules.php?action=toggle          — toggle module for a camp (admin)
 *
 * Table: camp_modules (id, tenant_id, camp_id, module_key, is_enabled, updated_at)
 * UNIQUE(tenant_id, camp_id, module_key)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── Hardcoded module definitions ──
$ALL_MODULES = [
    ['id' => 'stores',  'label' => 'Stores & Inventory',  'is_core' => 1],
    ['id' => 'kitchen', 'label' => 'Kitchen Planning',    'is_core' => 0],
    ['id' => 'bar',     'label' => 'Bar & POS',           'is_core' => 0],
    ['id' => 'reports', 'label' => 'Reports & Analytics', 'is_core' => 0],
    ['id' => 'admin',   'label' => 'Administration',      'is_core' => 1],
];

$coreModuleIds = array_map(
    fn($m) => $m['id'],
    array_filter($ALL_MODULES, fn($m) => $m['is_core'] === 1)
);

$action = $_GET['action'] ?? '';

// ── GET — List camps + modules + enabled state ──
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'camp_modules') {
    requireAdmin();

    // Get active camps for this tenant
    $campStmt = $pdo->prepare("
        SELECT id, code, name
        FROM camps
        WHERE tenant_id = ? AND is_active = 1
        ORDER BY name
    ");
    $campStmt->execute([$tenantId]);
    $camps = $campStmt->fetchAll();

    // Get all camp_modules records for this tenant
    $modStmt = $pdo->prepare("
        SELECT camp_id, module_key, is_enabled
        FROM camp_modules
        WHERE tenant_id = ?
    ");
    $modStmt->execute([$tenantId]);
    $modRows = $modStmt->fetchAll();

    // Build enabled-state lookup: camp_id => module_key => is_enabled
    $enabledMap = [];
    foreach ($modRows as $row) {
        $enabledMap[(int) $row['camp_id']][$row['module_key']] = (bool) $row['is_enabled'];
    }

    // Build camp_modules response: { "14": { "stores": true, "kitchen": true, ... } }
    $campModules = new \stdClass();
    foreach ($camps as $camp) {
        $campId = (int) $camp['id'];
        $moduleStates = new \stdClass();

        foreach ($ALL_MODULES as $mod) {
            if ($mod['is_core']) {
                // Core modules are always enabled
                $moduleStates->{$mod['id']} = true;
            } else {
                // Check DB record, default to false if not present
                $moduleStates->{$mod['id']} = $enabledMap[$campId][$mod['id']] ?? false;
            }
        }

        $campModules->{(string) $campId} = $moduleStates;
    }

    jsonResponse([
        'camps' => array_map(function ($c) {
            return [
                'id' => (int) $c['id'],
                'code' => $c['code'],
                'name' => $c['name'],
            ];
        }, $camps),
        'modules' => array_map(function ($m) {
            return [
                'id' => $m['id'],
                'label' => $m['label'],
                'is_core' => (bool) $m['is_core'],
            ];
        }, $ALL_MODULES),
        'camp_modules' => $campModules,
    ]);
    exit;
}

// ── POST — Toggle module for a camp ──
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'toggle') {
    requireAdmin();
    $input = getJsonInput();
    requireFields($input, ['camp_id', 'module_id', 'enabled']);

    $campId = (int) $input['camp_id'];
    $moduleId = $input['module_id'];
    $enabled = $input['enabled'] ? 1 : 0;

    // Validate module_id exists in hardcoded list
    $validModuleIds = array_map(fn($m) => $m['id'], $ALL_MODULES);
    if (!in_array($moduleId, $validModuleIds, true)) {
        jsonError('Invalid module ID', 400);
    }

    // Don't allow toggling core modules
    if (in_array($moduleId, $coreModuleIds, true)) {
        jsonError('Core modules cannot be toggled', 400);
    }

    // Verify camp belongs to tenant
    $campCheck = $pdo->prepare("SELECT id FROM camps WHERE id = ? AND tenant_id = ?");
    $campCheck->execute([$campId, $tenantId]);
    if (!$campCheck->fetch()) {
        jsonError('Camp not found', 404);
    }

    // Upsert camp_modules record
    $stmt = $pdo->prepare("
        INSERT INTO camp_modules (tenant_id, camp_id, module_key, is_enabled, updated_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_at = NOW()
    ");
    $stmt->execute([$tenantId, $campId, $moduleId, $enabled]);

    jsonResponse(['success' => true]);
    exit;
}

jsonError('Invalid action or method', 400);
