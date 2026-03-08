<?php
/**
 * WebSquare — Data Export (CSV)
 * GET /api/export.php?type=items
 * GET /api/export.php?type=suppliers
 * GET /api/export.php?type=stock&camp_id=X
 * GET /api/export.php?type=template&entity=items   (empty template with headers)
 *
 * Admin/Director only. All queries filtered by tenant_id.
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';
requireMethod('GET');
$auth = requireAdmin();
$tenantId = requireTenant($auth);

$pdo = getDB();
$type = trim($_GET['type'] ?? '');

if (!$type) {
    jsonError('Export type required. Use: items, suppliers, stock, template', 400);
}

// ── CSV output helper ─────────────────────────────
function outputCSV(string $filename, array $headers, array $rows): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');

    $output = fopen('php://output', 'w');
    // UTF-8 BOM for Excel compatibility
    fwrite($output, "\xEF\xBB\xBF");
    fputcsv($output, $headers);
    foreach ($rows as $row) {
        fputcsv($output, $row);
    }
    fclose($output);
    exit;
}

switch ($type) {

    // ── Items Export ───────────────────────────────
    case 'items':
        $stmt = $pdo->prepare("
            SELECT i.item_code, i.name, i.description,
                   g.code as group_code, g.name as group_name,
                   s.code as sub_cat_code, s.name as sub_cat_name,
                   u.code as stock_uom, pu.code as purchase_uom, iu.code as issue_uom,
                   i.purchase_to_stock_factor, i.stock_to_issue_factor,
                   i.abc_class, i.storage_type,
                   CASE WHEN i.is_active THEN 'Yes' ELSE 'No' END as is_active,
                   CASE WHEN i.is_perishable THEN 'Yes' ELSE 'No' END as is_perishable,
                   CASE WHEN i.is_critical THEN 'Yes' ELSE 'No' END as is_critical,
                   i.last_purchase_price, i.weighted_avg_cost,
                   i.shelf_life_days, i.min_order_qty, i.standard_pack_size,
                   i.sap_item_no
            FROM items i
            LEFT JOIN item_groups g ON i.item_group_id = g.id
            LEFT JOIN item_sub_categories s ON i.sub_category_id = s.id
            LEFT JOIN units_of_measure u ON i.stock_uom_id = u.id
            LEFT JOIN units_of_measure pu ON i.purchase_uom_id = pu.id
            LEFT JOIN units_of_measure iu ON i.issue_uom_id = iu.id
            WHERE i.tenant_id = ?
            ORDER BY i.item_code
        ");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_NUM);

        outputCSV(
            'items_export_' . date('Y-m-d') . '.csv',
            ['Item Code', 'Name', 'Description',
             'Group Code', 'Group Name', 'Sub Category Code', 'Sub Category Name',
             'Stock UOM', 'Purchase UOM', 'Issue UOM',
             'Purchase-to-Stock Factor', 'Stock-to-Issue Factor',
             'ABC Class', 'Storage Type',
             'Active', 'Perishable', 'Critical',
             'Last Purchase Price', 'Weighted Avg Cost',
             'Shelf Life Days', 'Min Order Qty', 'Standard Pack Size',
             'SAP Item No'],
            $rows
        );
        break;

    // ── Suppliers Export ───────────────────────────
    case 'suppliers':
        $stmt = $pdo->prepare("
            SELECT s.supplier_code, s.name, s.contact_person, s.email, s.phone,
                   s.address, s.city, s.country,
                   s.payment_terms, COALESCE(s.credit_limit, 0),
                   CASE WHEN s.is_active THEN 'Yes' ELSE 'No' END as is_active,
                   s.notes
            FROM suppliers s
            WHERE s.tenant_id = ?
            ORDER BY s.name
        ");
        $stmt->execute([$tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_NUM);

        outputCSV(
            'suppliers_export_' . date('Y-m-d') . '.csv',
            ['Code', 'Name', 'Contact Person', 'Email', 'Phone',
             'Address', 'City', 'Country',
             'Payment Terms', 'Credit Limit', 'Active', 'Notes'],
            $rows
        );
        break;

    // ── Stock Export ──────────────────────────────
    case 'stock':
        $campId = (int) ($_GET['camp_id'] ?? 0);
        $where = ['sb.tenant_id = ?'];
        $params = [$tenantId];

        if ($campId) {
            $where[] = 'sb.camp_id = ?';
            $params[] = $campId;
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT c.code as camp_code, c.name as camp_name,
                   i.item_code, i.name as item_name,
                   g.code as group_code,
                   uom.code as uom_code,
                   sb.current_qty, sb.current_value, sb.unit_cost,
                   sb.par_level, sb.min_level, sb.max_level,
                   sb.avg_daily_usage, sb.days_stock_on_hand, sb.stock_status,
                   sb.last_receipt_date, sb.last_issue_date
            FROM stock_balances sb
            JOIN items i ON sb.item_id = i.id
            JOIN camps c ON sb.camp_id = c.id
            LEFT JOIN item_groups g ON i.item_group_id = g.id
            LEFT JOIN units_of_measure uom ON i.stock_uom_id = uom.id
            {$whereClause}
            ORDER BY c.code, i.item_code
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_NUM);

        $filename = $campId
            ? "stock_camp_{$campId}_" . date('Y-m-d') . '.csv'
            : 'stock_all_camps_' . date('Y-m-d') . '.csv';

        outputCSV(
            $filename,
            ['Camp Code', 'Camp Name', 'Item Code', 'Item Name',
             'Group Code', 'UOM',
             'Current Qty', 'Current Value', 'Unit Cost',
             'Par Level', 'Min Level', 'Max Level',
             'Avg Daily Usage', 'Days Stock on Hand', 'Stock Status',
             'Last Receipt Date', 'Last Issue Date'],
            $rows
        );
        break;

    // ── Template Download ─────────────────────────
    case 'template':
        $entity = trim($_GET['entity'] ?? 'items');
        $templates = [
            'items' => [
                'headers' => ['Item Code', 'Name', 'Description', 'Group Code',
                              'Stock UOM Code', 'Purchase UOM Code', 'Issue UOM Code',
                              'ABC Class', 'Storage Type',
                              'Is Perishable', 'Is Critical',
                              'Shelf Life Days', 'Min Order Qty', 'Standard Pack Size'],
                'example' => ['ITM-001', 'Rice Basmati 5kg', 'Premium basmati rice', 'DRY',
                              'KG', 'KG', 'KG',
                              'A', 'ambient',
                              'No', 'No',
                              '365', '10', '5'],
            ],
            'suppliers' => [
                'headers' => ['Code', 'Name', 'Contact Person', 'Email', 'Phone',
                              'Address', 'City', 'Country',
                              'Payment Terms', 'Lead Time Days'],
                'example' => ['SUP-001', 'Fresh Foods Ltd', 'John Smith', 'john@freshfoods.com', '+254 700 123456',
                              '123 Market Street', 'Nairobi', 'Kenya',
                              'Net 30', '7'],
            ],
        ];

        if (!isset($templates[$entity])) {
            jsonError('Unknown entity. Use: items, suppliers', 400);
        }

        $tpl = $templates[$entity];
        outputCSV(
            "{$entity}_import_template.csv",
            $tpl['headers'],
            [$tpl['example']] // Include one example row
        );
        break;

    default:
        jsonError('Unknown export type. Use: items, suppliers, stock, template', 400);
}
