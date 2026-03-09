<?php
/**
 * WebSquare — Kitchen V2 Migration
 * Creates tables for multi-kitchen, requisition types, set menus, push notifications
 * Run once: /api/setup-kitchen-v2.php
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
requireRole(['admin', 'director']);

$pdo = getDB();
$results = [];

try {
    // ── 1. Kitchens table ──
    $pdo->exec("CREATE TABLE IF NOT EXISTS kitchens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        camp_id INT DEFAULT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        default_guest_count INT DEFAULT 20,
        rounding_mode VARCHAR(20) DEFAULT 'ceil',
        min_order_qty DECIMAL(10,3) DEFAULT 0.1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_kitchens_tenant (tenant_id),
        INDEX idx_kitchens_camp (tenant_id, camp_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'kitchens table OK';

    // ── 2. Requisition types table ──
    $pdo->exec("CREATE TABLE IF NOT EXISTS requisition_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        code VARCHAR(30) NOT NULL,
        sort_order INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reqtype_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'requisition_types table OK';

    // Seed default requisition types if empty for this tenant
    $count = $pdo->prepare("SELECT COUNT(*) FROM requisition_types WHERE tenant_id = ?");
    $count->execute([$tenantId]);
    if ((int)$count->fetchColumn() === 0) {
        $types = [
            ['Full Day', 'full_day', 1],
            ['Breakfast', 'breakfast', 2],
            ['Lunch', 'lunch', 3],
            ['Dinner', 'dinner', 4],
            ['Picnic', 'picnic', 5],
        ];
        $ins = $pdo->prepare("INSERT INTO requisition_types (tenant_id, name, code, sort_order) VALUES (?, ?, ?, ?)");
        foreach ($types as $t) {
            $ins->execute([$tenantId, $t[0], $t[1], $t[2]]);
        }
        $results[] = 'Seeded 5 default requisition types';
    }

    // ── 3. Set menu items table ──
    $pdo->exec("CREATE TABLE IF NOT EXISTS set_menu_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        camp_id INT DEFAULT NULL,
        day_of_week TINYINT NOT NULL COMMENT '1=Mon...7=Sun',
        type_code VARCHAR(30) NOT NULL,
        recipe_id INT NOT NULL,
        recipe_name VARCHAR(200) NOT NULL,
        sort_order INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_setmenu_tenant (tenant_id),
        INDEX idx_setmenu_day (tenant_id, day_of_week, type_code),
        UNIQUE KEY uq_setmenu_dish (tenant_id, day_of_week, type_code, recipe_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'set_menu_items table OK';

    // ── 4. Push subscriptions table ──
    $pdo->exec("CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        user_id INT NOT NULL,
        kitchen_id INT DEFAULT NULL,
        endpoint TEXT NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        auth_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_push_tenant_user (tenant_id, user_id),
        INDEX idx_push_kitchen (tenant_id, kitchen_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'push_subscriptions table OK';

    // ── 5. Notifications table ──
    $pdo->exec("CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        kitchen_id INT DEFAULT NULL,
        user_id INT DEFAULT NULL,
        title VARCHAR(200) NOT NULL,
        body TEXT,
        type VARCHAR(50) DEFAULT NULL,
        ref_id INT DEFAULT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notif_tenant_user (tenant_id, user_id, is_read),
        INDEX idx_notif_kitchen (tenant_id, kitchen_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'notifications table OK';

    // ── 6. Add portion columns to items table (if missing) ──
    try {
        $pdo->query("SELECT portion_weight FROM items LIMIT 0");
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE items ADD COLUMN portion_weight DECIMAL(10,4) DEFAULT NULL");
        $results[] = 'Added items.portion_weight';
    }

    try {
        $pdo->query("SELECT order_mode FROM items LIMIT 0");
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE items ADD COLUMN order_mode ENUM('portion','direct_kg') DEFAULT 'direct_kg'");
        $results[] = 'Added items.order_mode';
    }

    // ── 7. Add kitchen_id to users table (if missing) ──
    try {
        $pdo->query("SELECT kitchen_id FROM users LIMIT 0");
    } catch (Exception $e) {
        $pdo->exec("ALTER TABLE users ADD COLUMN kitchen_id INT DEFAULT NULL");
        $results[] = 'Added users.kitchen_id';
    }

    jsonResponse([
        'success' => true,
        'results' => $results,
        'message' => 'Kitchen V2 migration complete',
    ]);

} catch (Exception $e) {
    jsonError('Migration failed: ' . $e->getMessage(), 500);
}
