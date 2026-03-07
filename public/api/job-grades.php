<?php
/**
 * WebSquare — Job Grades
 * GET    /api/job-grades.php              — list job grades for tenant
 * POST   /api/job-grades.php              — create job grade (manager+)
 * PUT    /api/job-grades.php              — update job grade (manager+)
 * DELETE /api/job-grades.php?id=X         — delete job grade (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Job Grades ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $params = [];

    tenantScope($where, $params, $tenantId, 'jg');

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = $pdo->prepare("
        SELECT jg.id, jg.name, jg.level, jg.min_salary, jg.max_salary, jg.created_at
        FROM job_grades jg
        {$whereClause}
        ORDER BY jg.level ASC, jg.name ASC
    ");
    $stmt->execute($params);
    $grades = $stmt->fetchAll();

    jsonResponse([
        'job_grades' => array_map(function ($g) {
            return [
                'id' => (int) $g['id'],
                'name' => $g['name'],
                'level' => (int) $g['level'],
                'min_salary' => $g['min_salary'] ? (float) $g['min_salary'] : null,
                'max_salary' => $g['max_salary'] ? (float) $g['max_salary'] : null,
                'created_at' => $g['created_at'],
                'updated_at' => $g['created_at'],
            ];
        }, $grades),
    ]);
    exit;
}

// ── POST — Create Job Grade ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['name', 'level']);

    $stmt = $pdo->prepare("
        INSERT INTO job_grades (tenant_id, name, level, min_salary, max_salary, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([
        $tenantId,
        trim($input['name']),
        (int) $input['level'],
        $input['min_salary'] ?? null,
        $input['max_salary'] ?? null,
    ]);

    jsonResponse([
        'success' => true,
        'job_grade' => [
            'id' => (int) $pdo->lastInsertId(),
            'name' => trim($input['name']),
            'level' => (int) $input['level'],
        ],
    ], 201);
    exit;
}

// ── PUT — Update Job Grade ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Job Grade ID required', 400);

    // Verify belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM job_grades WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Job grade not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = ['name', 'level', 'min_salary', 'max_salary'];

    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            $updates[] = "{$field} = ?";
            $params[] = $input[$field];
        }
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE job_grades SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Job grade updated successfully']);
    exit;
}

// ── DELETE — Remove Job Grade ──
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    requireManager();
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) jsonError('Job Grade ID required', 400);

    // Verify belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM job_grades WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Job grade not found', 404);
    }

    // Check if any employees use this grade
    $inUse = $pdo->prepare("SELECT COUNT(*) FROM hr_employees WHERE job_grade_id = ? AND tenant_id = ?");
    $inUse->execute([$id, $tenantId]);
    if ((int) $inUse->fetchColumn() > 0) {
        jsonError('Cannot delete: job grade is assigned to employees', 400);
    }

    $stmt = $pdo->prepare("DELETE FROM job_grades WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);

    jsonResponse(['success' => true, 'message' => 'Job grade deleted']);
    exit;
}

jsonError('Method not allowed', 405);
