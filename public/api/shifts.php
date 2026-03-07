<?php
/**
 * WebSquare — Shifts
 * GET    /api/shifts.php              — list shifts for tenant
 * POST   /api/shifts.php              — create shift (manager+)
 * PUT    /api/shifts.php              — update shift (manager+)
 */

require_once __DIR__ . '/middleware.php';
require_once __DIR__ . '/helpers.php';

$auth = requireAuth();
$tenantId = requireTenant($auth);
$pdo = getDB();

// ── GET — List Shifts ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $where = [];
    $params = [];

    tenantScope($where, $params, $tenantId);

    $whereClause = 'WHERE ' . implode(' AND ', $where);

    $stmt = $pdo->prepare("
        SELECT id, name, start_time, end_time, break_minutes, is_active, created_at
        FROM shifts
        {$whereClause}
        ORDER BY name ASC
    ");
    $stmt->execute($params);
    $shifts = $stmt->fetchAll();

    jsonResponse([
        'shifts' => array_map(function ($s) {
            return [
                'id'            => (int) $s['id'],
                'name'          => $s['name'],
                'start_time'    => $s['start_time'],
                'end_time'      => $s['end_time'],
                'break_minutes' => (int) $s['break_minutes'],
                'is_active'     => (bool) $s['is_active'],
                'created_at'    => $s['created_at'],
            ];
        }, $shifts),
    ]);
    exit;
}

// ── POST — Create Shift ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requireManager();
    $input = getJsonInput();
    requireFields($input, ['name', 'start_time', 'end_time']);

    $stmt = $pdo->prepare("
        INSERT INTO shifts (tenant_id, name, start_time, end_time, break_minutes, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, NOW())
    ");
    $stmt->execute([
        $tenantId,
        trim($input['name']),
        trim($input['start_time']),
        trim($input['end_time']),
        (int) ($input['break_minutes'] ?? 0),
    ]);

    jsonResponse([
        'success' => true,
        'shift'   => [
            'id'   => (int) $pdo->lastInsertId(),
            'name' => trim($input['name']),
        ],
    ], 201);
    exit;
}

// ── PUT — Update Shift ──
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    requireManager();
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    if (!$id) jsonError('Shift ID required', 400);

    // Verify shift belongs to tenant
    $existing = $pdo->prepare("SELECT id FROM shifts WHERE id = ? AND tenant_id = ?");
    $existing->execute([$id, $tenantId]);
    if (!$existing->fetch()) {
        jsonError('Shift not found', 404);
    }

    $updates = [];
    $params = [];

    $allowedFields = ['name', 'start_time', 'end_time', 'break_minutes', 'is_active'];

    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            if ($field === 'is_active') {
                $updates[] = "{$field} = ?";
                $params[] = $input[$field] ? 1 : 0;
            } elseif ($field === 'break_minutes') {
                $updates[] = "{$field} = ?";
                $params[] = (int) $input[$field];
            } else {
                $updates[] = "{$field} = ?";
                $params[] = trim($input[$field]);
            }
        }
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $id;
    $params[] = $tenantId;
    $sql = "UPDATE shifts SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
    $pdo->prepare($sql)->execute($params);

    jsonResponse(['success' => true, 'message' => 'Shift updated successfully']);
    exit;
}

jsonError('Method not allowed', 405);
