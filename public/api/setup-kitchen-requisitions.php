<?php
/**
 * WebSquare — Kitchen Requisitions Migration (K2)
 * Creates requisition tables + grocery order tables
 * Run once via browser: /api/setup-kitchen-requisitions.php
 */

require_once __DIR__ . '/middleware.php';
$auth = requireAuth();
requireAdmin();
$pdo = getDB();

$results = [];

// ── kitchen_requisitions ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS kitchen_requisitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        kitchen_id INT NOT NULL,
        req_date DATE NOT NULL,
        session_number INT DEFAULT 1,
        supplement_number INT DEFAULT 0,
        guest_count INT DEFAULT 20,
        meals VARCHAR(100) DEFAULT 'lunch',
        status ENUM('draft','submitted','processing','fulfilled','received','closed') DEFAULT 'draft',
        has_dispute TINYINT(1) DEFAULT 0,
        created_by INT DEFAULT NULL,
        reviewed_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_date (tenant_id, req_date),
        INDEX idx_kitchen_date (kitchen_id, req_date),
        UNIQUE KEY uk_tenant_kitchen_date_meals_supp (tenant_id, kitchen_id, req_date, meals, supplement_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'kitchen_requisitions: OK';
} catch (Exception $e) {
    $results[] = 'kitchen_requisitions: ' . $e->getMessage();
}

// ── kitchen_requisition_lines ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS kitchen_requisition_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        requisition_id INT NOT NULL,
        item_id INT DEFAULT NULL,
        item_name VARCHAR(200) NOT NULL,
        meal VARCHAR(50) DEFAULT 'lunch',
        order_mode VARCHAR(50) DEFAULT 'direct_kg',
        portions INT DEFAULT 0,
        portion_weight DECIMAL(10,4) DEFAULT 0,
        required_kg DECIMAL(10,2) DEFAULT 0,
        stock_qty DECIMAL(10,2) DEFAULT 0,
        order_qty DECIMAL(10,2) DEFAULT 0,
        fulfilled_qty DECIMAL(10,2) DEFAULT NULL,
        received_qty DECIMAL(10,2) DEFAULT NULL,
        unused_qty DECIMAL(10,2) DEFAULT 0,
        uom VARCHAR(20) DEFAULT 'kg',
        status VARCHAR(50) DEFAULT 'pending',
        store_notes TEXT DEFAULT NULL,
        source_dish_id INT DEFAULT NULL,
        source_recipe_id INT DEFAULT NULL,
        INDEX idx_requisition (requisition_id),
        INDEX idx_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'kitchen_requisition_lines: OK';
} catch (Exception $e) {
    $results[] = 'kitchen_requisition_lines: ' . $e->getMessage();
}

// ── kitchen_requisition_dishes ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS kitchen_requisition_dishes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        requisition_id INT NOT NULL,
        recipe_id INT NOT NULL,
        recipe_name VARCHAR(200) NOT NULL,
        recipe_servings INT DEFAULT 4,
        scale_factor DECIMAL(10,3) DEFAULT 1.000,
        guest_count INT DEFAULT 20,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_req_dish (requisition_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'kitchen_requisition_dishes: OK';
} catch (Exception $e) {
    $results[] = 'kitchen_requisition_dishes: ' . $e->getMessage();
}

// ── grocery_orders (daily grocery flow) ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS grocery_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        kitchen_id INT DEFAULT NULL,
        order_date DATE NOT NULL,
        meal VARCHAR(50) DEFAULT 'lunch',
        total_items INT DEFAULT 0,
        status ENUM('pending','reviewing','fulfilled','received','closed') DEFAULT 'pending',
        has_dispute TINYINT(1) DEFAULT 0,
        notes TEXT DEFAULT NULL,
        created_by INT DEFAULT NULL,
        reviewed_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_date (tenant_id, order_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'grocery_orders: OK';
} catch (Exception $e) {
    $results[] = 'grocery_orders: ' . $e->getMessage();
}

// ── grocery_order_lines ──
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS grocery_order_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        item_id INT DEFAULT NULL,
        item_name VARCHAR(200) NOT NULL,
        requested_qty DECIMAL(10,2) DEFAULT 0,
        fulfilled_qty DECIMAL(10,2) DEFAULT NULL,
        received_qty DECIMAL(10,2) DEFAULT NULL,
        unit_size DECIMAL(10,2) DEFAULT NULL,
        uom VARCHAR(20) DEFAULT 'kg',
        INDEX idx_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $results[] = 'grocery_order_lines: OK';
} catch (Exception $e) {
    $results[] = 'grocery_order_lines: ' . $e->getMessage();
}

// ── Add rounding_mode to kitchens if missing ──
try {
    $pdo->query("SELECT rounding_mode FROM kitchens LIMIT 0");
    $results[] = 'kitchens.rounding_mode: already exists';
} catch (Exception $e) {
    try {
        $pdo->exec("ALTER TABLE kitchens ADD COLUMN rounding_mode VARCHAR(20) DEFAULT 'half'");
        $results[] = 'kitchens.rounding_mode: added';
    } catch (Exception $e2) {
        $results[] = 'kitchens.rounding_mode: ' . $e2->getMessage();
    }
}

jsonResponse(['results' => $results, 'status' => 'K2 migration complete']);
