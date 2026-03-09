<?php
/**
 * WebSquare — Rotational Set Menu API
 * Ported from Karibu Pantry Planner
 *
 * Actions: get_week, get_day, get_day_with_ingredients, add_dish,
 *          remove_dish, reorder, copy_day, clear_day, search_recipes
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

$action = $_GET['action'] ?? '';

switch ($action) {

    // ── Get full week menu (all days x all types) ──
    case 'get_week':
        $stmt = $pdo->prepare("
            SELECT sm.*, r.serves AS recipe_servings, r.cuisine,
                (SELECT COUNT(*) FROM kitchen_recipe_ingredients WHERE recipe_id = sm.recipe_id AND tenant_id = ?) AS ingredient_count
            FROM set_menu_items sm
            LEFT JOIN kitchen_recipes r ON r.id = sm.recipe_id AND r.tenant_id = ?
            WHERE sm.tenant_id = ? AND sm.is_active = 1
            ORDER BY sm.day_of_week, sm.type_code, sm.sort_order, sm.recipe_name
        ");
        $stmt->execute([$tenantId, $tenantId, $tenantId]);
        $rows = $stmt->fetchAll();

        // Group by day -> type -> dishes
        $week = [];
        foreach ($rows as $r) {
            $day = (int)$r['day_of_week'];
            $type = $r['type_code'];
            if (!isset($week[$day])) $week[$day] = [];
            if (!isset($week[$day][$type])) $week[$day][$type] = [];
            $week[$day][$type][] = $r;
        }

        jsonResponse(['week' => $week]);

    // ── Get menu for a specific day + type ──
    case 'get_day':
        $dayOfWeek = (int)($_GET['day'] ?? 0);
        $typeCode = trim($_GET['type'] ?? '');
        if ($dayOfWeek < 1 || $dayOfWeek > 7) jsonError('Invalid day (1=Mon ... 7=Sun)');
        if (!$typeCode) jsonError('Type code required');

        $stmt = $pdo->prepare("
            SELECT sm.recipe_id, sm.recipe_name, sm.sort_order, sm.id,
                r.serves AS recipe_servings, r.cuisine,
                (SELECT COUNT(*) FROM kitchen_recipe_ingredients WHERE recipe_id = sm.recipe_id AND tenant_id = ?) AS ingredient_count
            FROM set_menu_items sm
            LEFT JOIN kitchen_recipes r ON r.id = sm.recipe_id AND r.tenant_id = ?
            WHERE sm.tenant_id = ? AND sm.day_of_week = ? AND sm.type_code = ? AND sm.is_active = 1
            ORDER BY sm.sort_order, sm.recipe_name
        ");
        $stmt->execute([$tenantId, $tenantId, $tenantId, $dayOfWeek, $typeCode]);

        jsonResponse(['dishes' => $stmt->fetchAll(), 'day' => $dayOfWeek, 'type' => $typeCode]);

    // ── Get day menu WITH recipe ingredients (batch — no N+1) ──
    case 'get_day_with_ingredients':
        $dayOfWeek = (int)($_GET['day'] ?? 0);
        $typeCode = trim($_GET['type'] ?? '');
        if ($dayOfWeek < 1 || $dayOfWeek > 7) jsonError('Invalid day');
        if (!$typeCode) jsonError('Type code required');

        $stmt = $pdo->prepare("
            SELECT sm.recipe_id, sm.recipe_name, sm.sort_order, sm.id,
                r.serves AS recipe_servings, r.cuisine
            FROM set_menu_items sm
            LEFT JOIN kitchen_recipes r ON r.id = sm.recipe_id AND r.tenant_id = ?
            WHERE sm.tenant_id = ? AND sm.day_of_week = ? AND sm.type_code = ? AND sm.is_active = 1
            ORDER BY sm.sort_order, sm.recipe_name
        ");
        $stmt->execute([$tenantId, $tenantId, $dayOfWeek, $typeCode]);
        $dishes = $stmt->fetchAll();

        $ingredientsByRecipe = new \stdClass();

        if (!empty($dishes)) {
            $recipeIds = array_unique(array_filter(array_column($dishes, 'recipe_id')));
            if (!empty($recipeIds)) {
                $ph = implode(',', array_fill(0, count($recipeIds), '?'));
                $iStmt = $pdo->prepare("
                    SELECT ri.recipe_id, ri.item_id, ri.qty_per_serving, ri.is_primary, ri.notes,
                        i.name AS item_name, i.stock_uom_id, i.portion_weight, i.order_mode,
                        g.name AS group_name
                    FROM kitchen_recipe_ingredients ri
                    LEFT JOIN items i ON i.id = ri.item_id AND i.tenant_id = ?
                    LEFT JOIN item_groups g ON g.id = i.item_group_id
                    WHERE ri.recipe_id IN ($ph) AND ri.tenant_id = ?
                    ORDER BY ri.recipe_id, ri.is_primary DESC, i.name
                ");
                $iParams = array_merge([$tenantId], array_values($recipeIds), [$tenantId]);
                $iStmt->execute($iParams);

                $ingredientsByRecipe = [];
                foreach ($iStmt->fetchAll() as $ing) {
                    $ingredientsByRecipe[$ing['recipe_id']][] = $ing;
                }
                if (empty($ingredientsByRecipe)) $ingredientsByRecipe = new \stdClass();
            }
        }

        jsonResponse([
            'dishes' => $dishes,
            'ingredients_by_recipe' => $ingredientsByRecipe,
            'day' => $dayOfWeek,
            'type' => $typeCode,
        ]);

    // ── Add a dish to a day/type slot ──
    case 'add_dish':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();

        $dayOfWeek = (int)($data['day_of_week'] ?? 0);
        $typeCode = trim($data['type_code'] ?? '');
        $recipeId = (int)($data['recipe_id'] ?? 0);
        $recipeName = trim($data['recipe_name'] ?? '');

        if ($dayOfWeek < 1 || $dayOfWeek > 7) jsonError('Invalid day');
        if (!$typeCode) jsonError('Type code required');
        if (!$recipeId) jsonError('Recipe ID required');
        if (!$recipeName) jsonError('Recipe name required');

        // Check duplicate
        $check = $pdo->prepare("SELECT id FROM set_menu_items WHERE tenant_id = ? AND day_of_week = ? AND type_code = ? AND recipe_id = ?");
        $check->execute([$tenantId, $dayOfWeek, $typeCode, $recipeId]);
        if ($check->fetch()) jsonError('This dish is already on this day/type');

        // Get next sort order
        $maxSort = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) FROM set_menu_items WHERE tenant_id = ? AND day_of_week = ? AND type_code = ?");
        $maxSort->execute([$tenantId, $dayOfWeek, $typeCode]);
        $nextSort = (int)$maxSort->fetchColumn() + 1;

        $stmt = $pdo->prepare("INSERT INTO set_menu_items (tenant_id, day_of_week, type_code, recipe_id, recipe_name, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$tenantId, $dayOfWeek, $typeCode, $recipeId, $recipeName, $nextSort]);

        jsonResponse(['added' => true, 'id' => (int)$pdo->lastInsertId()], 201);

    // ── Remove a dish ──
    case 'remove_dish':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();
        $id = (int)($data['id'] ?? 0);
        if (!$id) jsonError('ID required');

        $pdo->prepare("DELETE FROM set_menu_items WHERE id = ? AND tenant_id = ?")->execute([$id, $tenantId]);
        jsonResponse(['removed' => true]);

    // ── Reorder dishes within a day/type ──
    case 'reorder':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();
        $items = $data['items'] ?? [];

        $stmt = $pdo->prepare("UPDATE set_menu_items SET sort_order = ? WHERE id = ? AND tenant_id = ?");
        foreach ($items as $item) {
            $stmt->execute([(int)$item['sort_order'], (int)$item['id'], $tenantId]);
        }
        jsonResponse(['reordered' => true]);

    // ── Copy dishes from one day to another ──
    case 'copy_day':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();

        $fromDay = (int)($data['from_day'] ?? 0);
        $toDay = (int)($data['to_day'] ?? 0);
        $typeCode = trim($data['type_code'] ?? '');

        if ($fromDay < 1 || $fromDay > 7 || $toDay < 1 || $toDay > 7) jsonError('Invalid day');
        if ($fromDay === $toDay) jsonError('Cannot copy to same day');

        $where = 'tenant_id = ? AND day_of_week = ? AND is_active = 1';
        $srcParams = [$tenantId, $fromDay];
        if ($typeCode) {
            $where .= ' AND type_code = ?';
            $srcParams[] = $typeCode;
        }

        $src = $pdo->prepare("SELECT recipe_id, recipe_name, type_code, sort_order FROM set_menu_items WHERE {$where} ORDER BY type_code, sort_order");
        $src->execute($srcParams);
        $srcDishes = $src->fetchAll();

        if (empty($srcDishes)) jsonError('No dishes to copy from that day');

        $inserted = 0;
        $insertStmt = $pdo->prepare("INSERT IGNORE INTO set_menu_items (tenant_id, day_of_week, type_code, recipe_id, recipe_name, sort_order) VALUES (?, ?, ?, ?, ?, ?)");

        foreach ($srcDishes as $d) {
            $insertStmt->execute([$tenantId, $toDay, $d['type_code'], $d['recipe_id'], $d['recipe_name'], $d['sort_order']]);
            if ($insertStmt->rowCount() > 0) $inserted++;
        }

        jsonResponse(['copied' => true, 'inserted' => $inserted]);

    // ── Clear all dishes for a day/type ──
    case 'clear_day':
        requireMethod('POST');
        requireAdmin();
        $data = getJsonInput();

        $dayOfWeek = (int)($data['day_of_week'] ?? 0);
        $typeCode = trim($data['type_code'] ?? '');
        if ($dayOfWeek < 1 || $dayOfWeek > 7) jsonError('Invalid day');
        if (!$typeCode) jsonError('Type code required');

        $stmt = $pdo->prepare("DELETE FROM set_menu_items WHERE tenant_id = ? AND day_of_week = ? AND type_code = ?");
        $stmt->execute([$tenantId, $dayOfWeek, $typeCode]);
        jsonResponse(['cleared' => true]);

    // ── Search recipes for picker ──
    case 'search_recipes':
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) jsonError('Search query too short');

        $escaped = '%' . $q . '%';
        $stmt = $pdo->prepare("
            SELECT r.id, r.name, r.cuisine, r.serves,
                (SELECT COUNT(*) FROM kitchen_recipe_ingredients WHERE recipe_id = r.id AND tenant_id = ?) AS ingredient_count
            FROM kitchen_recipes r
            WHERE r.tenant_id = ? AND r.is_active = 1 AND (r.name LIKE ? OR r.cuisine LIKE ?)
            ORDER BY r.name LIMIT 20
        ");
        $stmt->execute([$tenantId, $tenantId, $escaped, $escaped]);
        jsonResponse(['recipes' => $stmt->fetchAll()]);

    default:
        jsonError('Unknown action', 400);
}
