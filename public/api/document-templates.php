<?php
/**
 * WebSquare — Document Templates API (P4)
 * Ported from KaziPay documentTemplate.service.js
 * Manages ID card, intro letter, and contract templates
 */

require_once __DIR__ . '/middleware.php';
$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $GLOBALS['user_id'];
$userRole = $GLOBALS['user_role'] ?? '';

$action = $_GET['action'] ?? '';

switch ($action) {

// ── List templates ──
case 'list':
    $type = $_GET['type'] ?? '';
    $where = "WHERE (dt.tenant_id = ? OR dt.tenant_id IS NULL)";
    $params = [$tenantId];
    if ($type) {
        $where .= " AND dt.type = ?";
        $params[] = $type;
    }

    $stmt = $pdo->prepare("
        SELECT dt.*,
            CASE WHEN dt.tenant_id IS NULL THEN 'built_in' ELSE 'custom' END AS source
        FROM document_templates dt
        $where
        ORDER BY dt.type, dt.is_custom ASC, dt.name ASC
    ");
    $stmt->execute($params);
    jsonResponse(['templates' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ── Get single template ──
case 'get':
    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonError('Template id required');

    $stmt = $pdo->prepare("SELECT * FROM document_templates WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)");
    $stmt->execute([$id, $tenantId]);
    $template = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$template) jsonError('Template not found', 404);
    jsonResponse(['template' => $template]);

// ── Save custom template ──
case 'save':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);

    $fields = [
        'name'              => $input['name'] ?? 'Custom Template',
        'type'              => $input['type'] ?? 'id_card',
        'category'          => $input['category'] ?? 'general',
        'html_content'      => $input['html_content'] ?? '',
        'back_html_content' => $input['back_html_content'] ?? '',
        'is_custom'         => 1,
    ];

    if ($id > 0) {
        // Only allow editing custom templates belonging to tenant
        $stmt = $pdo->prepare("SELECT id FROM document_templates WHERE id = ? AND tenant_id = ? AND is_custom = 1");
        $stmt->execute([$id, $tenantId]);
        if (!$stmt->fetch()) jsonError('Cannot edit built-in templates');

        $sets = [];
        $vals = [];
        foreach ($fields as $k => $v) {
            $sets[] = "$k = ?";
            $vals[] = $v;
        }
        $vals[] = $id;
        $vals[] = $tenantId;
        $pdo->prepare("UPDATE document_templates SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")->execute($vals);
    } else {
        $cols = array_keys($fields);
        $cols[] = 'tenant_id';
        $vals = array_values($fields);
        $vals[] = $tenantId;
        $placeholders = implode(',', array_fill(0, count($vals), '?'));
        $pdo->prepare("INSERT INTO document_templates (" . implode(',', $cols) . ") VALUES ($placeholders)")->execute($vals);
        $id = $pdo->lastInsertId();
    }

    jsonResponse(['id' => $id, 'message' => 'Template saved']);

// ── Duplicate template ──
case 'duplicate':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $input = json_decode(file_get_contents('php://input'), true);
    $sourceId = intval($input['id'] ?? 0);

    $stmt = $pdo->prepare("SELECT * FROM document_templates WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)");
    $stmt->execute([$sourceId, $tenantId]);
    $source = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$source) jsonError('Source template not found', 404);

    $pdo->prepare("
        INSERT INTO document_templates (tenant_id, name, type, category, html_content, back_html_content, is_custom)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    ")->execute([
        $tenantId,
        $source['name'] . ' (Copy)',
        $source['type'],
        $source['category'],
        $source['html_content'],
        $source['back_html_content'],
    ]);

    jsonResponse(['id' => $pdo->lastInsertId(), 'message' => 'Template duplicated']);

// ── Delete custom template ──
case 'delete':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $pdo->prepare("DELETE FROM document_templates WHERE id = ? AND tenant_id = ? AND is_custom = 1")->execute([$id, $tenantId]);
    jsonResponse(['message' => 'Template deleted']);

// ── Generate document for employee ──
case 'generate':
    $input = json_decode(file_get_contents('php://input'), true);
    $templateId = intval($input['template_id'] ?? 0);
    $employeeId = intval($input['employee_id'] ?? 0);

    if (!$templateId || !$employeeId) jsonError('template_id and employee_id required');

    // Get template
    $stmt = $pdo->prepare("SELECT * FROM document_templates WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)");
    $stmt->execute([$templateId, $tenantId]);
    $template = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$template) jsonError('Template not found', 404);

    // Get employee data
    $stmt = $pdo->prepare("
        SELECT e.*, d.name AS department_name, jg.name AS job_grade_name,
               c.name AS company_name, c.address AS company_address, c.city AS company_city,
               c.phone AS company_phone, c.email AS company_email, c.logo_url AS company_logo,
               c.currency
        FROM hr_employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN job_grades jg ON e.job_grade_id = jg.id
        LEFT JOIN companies c ON c.tenant_id = e.tenant_id AND c.is_primary = 1
        WHERE e.id = ? AND e.tenant_id = ?
    ");
    $stmt->execute([$employeeId, $tenantId]);
    $emp = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$emp) jsonError('Employee not found', 404);

    // Build replacement map
    $replacements = [
        '{{company_name}}'     => $emp['company_name'] ?? '',
        '{{company_address}}'  => $emp['company_address'] ?? '',
        '{{company_city}}'     => $emp['company_city'] ?? '',
        '{{company_phone}}'    => $emp['company_phone'] ?? '',
        '{{company_email}}'    => $emp['company_email'] ?? '',
        '{{company_logo}}'     => $emp['company_logo'] ?? '',
        '{{employee_name}}'    => $emp['first_name'] . ' ' . $emp['last_name'],
        '{{first_name}}'       => $emp['first_name'] ?? '',
        '{{last_name}}'        => $emp['last_name'] ?? '',
        '{{employee_no}}'      => $emp['employee_no'] ?? '',
        '{{id_number}}'        => $emp['id_number'] ?? '',
        '{{tax_pin}}'          => $emp['tax_pin'] ?? '',
        '{{nssf_no}}'          => $emp['nssf_no'] ?? '',
        '{{nhif_no}}'          => $emp['nhif_no'] ?? '',
        '{{email}}'            => $emp['email'] ?? '',
        '{{phone}}'            => $emp['phone'] ?? '',
        '{{job_title}}'        => $emp['job_title'] ?? '',
        '{{department}}'       => $emp['department_name'] ?? '',
        '{{job_grade}}'        => $emp['job_grade_name'] ?? '',
        '{{join_date}}'        => $emp['join_date'] ?? '',
        '{{photo_url}}'        => $emp['photo_url'] ?? '',
        '{{date_of_birth}}'    => $emp['date_of_birth'] ?? '',
        '{{gender}}'           => $emp['gender'] ?? '',
        '{{address}}'          => $emp['address'] ?? '',
        '{{city}}'             => $emp['city'] ?? '',
        '{{date}}'             => date('Y-m-d'),
        '{{date_long}}'        => date('F j, Y'),
        '{{year}}'             => date('Y'),
        '{{currency}}'         => $emp['currency'] ?? 'KES',
    ];

    $html = str_replace(array_keys($replacements), array_values($replacements), $template['html_content'] ?? '');
    $backHtml = str_replace(array_keys($replacements), array_values($replacements), $template['back_html_content'] ?? '');

    // Log generation
    try {
        $pdo->prepare("
            INSERT INTO document_generations (tenant_id, template_id, employee_id, generated_by, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ")->execute([$tenantId, $templateId, $employeeId, $userId]);
    } catch (Exception $e) {
        // Table may not exist yet, non-critical
    }

    jsonResponse([
        'html'      => $html,
        'back_html' => $backHtml,
        'template'  => ['id' => $template['id'], 'name' => $template['name'], 'type' => $template['type']],
        'employee'  => ['id' => $emp['id'], 'name' => $emp['first_name'] . ' ' . $emp['last_name']],
    ]);

// ── Placeholders reference ──
case 'placeholders':
    jsonResponse(['placeholders' => [
        'Company' => ['{{company_name}}', '{{company_address}}', '{{company_city}}', '{{company_phone}}', '{{company_email}}', '{{company_logo}}', '{{currency}}'],
        'Employee' => ['{{employee_name}}', '{{first_name}}', '{{last_name}}', '{{employee_no}}', '{{id_number}}', '{{tax_pin}}', '{{nssf_no}}', '{{nhif_no}}', '{{email}}', '{{phone}}', '{{photo_url}}'],
        'Employment' => ['{{job_title}}', '{{department}}', '{{job_grade}}', '{{join_date}}'],
        'Personal' => ['{{date_of_birth}}', '{{gender}}', '{{address}}', '{{city}}'],
        'Dates' => ['{{date}}', '{{date_long}}', '{{year}}'],
    ]]);

default:
    jsonError('Invalid action. Use: list, get, save, duplicate, delete, generate, placeholders');
}
