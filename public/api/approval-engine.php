<?php
/**
 * WebSquare — Approval Engine API (P4)
 * Ported from KaziPay approvalWorkflow.controller.js
 * Multi-step approval workflows for leave, expenses, loans, etc.
 */

require_once __DIR__ . '/middleware.php';
$auth     = requireAuth();
$tenantId = requireTenant($auth);
$pdo      = getDB();
$userId   = $GLOBALS['user_id'];
$userRole = $GLOBALS['user_role'] ?? '';

if (!in_array($userRole, ['admin', 'director', 'stores_manager']) && !in_array($action ?? '', ['my_pending', 'action'])) {
    // non-admin can only view pending and action
}

$action = $_GET['action'] ?? '';

switch ($action) {

// ── List all workflows ──
case 'list':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $stmt = $pdo->prepare("
        SELECT aw.*,
            (SELECT COUNT(*) FROM approval_steps ast WHERE ast.workflow_id = aw.id) AS step_count
        FROM approval_workflows aw
        WHERE aw.tenant_id = ? AND aw.is_active = 1
        ORDER BY aw.name ASC
    ");
    $stmt->execute([$tenantId]);
    $workflows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Batch load steps
    if (!empty($workflows)) {
        $ids = array_column($workflows, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("SELECT * FROM approval_steps WHERE workflow_id IN ($placeholders) ORDER BY step_order ASC");
        $stmt->execute($ids);
        $allSteps = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stepMap = [];
        foreach ($allSteps as $s) {
            $stepMap[$s['workflow_id']][] = $s;
        }
        foreach ($workflows as &$w) {
            $w['steps'] = $stepMap[$w['id']] ?? [];
        }
    }

    jsonResponse(['workflows' => $workflows]);

// ── Get single workflow ──
case 'get':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $id = intval($_GET['id'] ?? 0);
    if (!$id) jsonError('Workflow id required');

    $stmt = $pdo->prepare("SELECT * FROM approval_workflows WHERE id = ? AND tenant_id = ?");
    $stmt->execute([$id, $tenantId]);
    $workflow = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$workflow) jsonError('Workflow not found', 404);

    $stmt = $pdo->prepare("SELECT * FROM approval_steps WHERE workflow_id = ? ORDER BY step_order ASC");
    $stmt->execute([$id]);
    $workflow['steps'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(['workflow' => $workflow]);

// ── Create or update workflow ──
case 'save':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $name = $input['name'] ?? '';
    $type = $input['type'] ?? 'leave';
    $steps = $input['steps'] ?? [];

    if (!$name) jsonError('Workflow name required');

    $pdo->beginTransaction();
    try {
        if ($id > 0) {
            $pdo->prepare("UPDATE approval_workflows SET name = ?, type = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                ->execute([$name, $type, $id, $tenantId]);

            // Delete old steps and re-insert
            $pdo->prepare("DELETE FROM approval_steps WHERE workflow_id = ?")->execute([$id]);
        } else {
            $pdo->prepare("INSERT INTO approval_workflows (tenant_id, name, type, is_active, created_at) VALUES (?, ?, ?, 1, NOW())")
                ->execute([$tenantId, $name, $type]);
            $id = $pdo->lastInsertId();
        }

        // Insert steps
        $insertStep = $pdo->prepare("
            INSERT INTO approval_steps (workflow_id, step_order, approver_type, approver_id, approver_role, label)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        foreach ($steps as $idx => $step) {
            $insertStep->execute([
                $id,
                $idx + 1,
                $step['approver_type'] ?? 'role',
                intval($step['approver_id'] ?? 0) ?: null,
                $step['approver_role'] ?? $step['role'] ?? '',
                $step['label'] ?? ('Step ' . ($idx + 1)),
            ]);
        }

        $pdo->commit();
        jsonResponse(['id' => $id, 'message' => 'Workflow saved']);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Failed to save workflow: ' . $e->getMessage());
    }

// ── Delete workflow ──
case 'delete':
    if (!in_array($userRole, ['admin', 'director'])) jsonError('Access denied', 403);

    $input = json_decode(file_get_contents('php://input'), true);
    $id = intval($input['id'] ?? 0);
    $pdo->prepare("UPDATE approval_workflows SET is_active = 0 WHERE id = ? AND tenant_id = ?")->execute([$id, $tenantId]);
    jsonResponse(['message' => 'Workflow deactivated']);

// ── My pending approvals ──
case 'my_pending':
    $stmt = $pdo->prepare("
        SELECT ar.*, aw.name AS workflow_name, aw.type AS workflow_type,
            ast.label AS current_step_label
        FROM approval_requests ar
        JOIN approval_workflows aw ON ar.workflow_id = aw.id
        JOIN approval_steps ast ON ar.current_step_id = ast.id
        WHERE ar.tenant_id = ? AND ar.status = 'pending'
          AND (
            (ast.approver_type = 'specific_user' AND ast.approver_id = ?)
            OR (ast.approver_type = 'role' AND ast.approver_role = ?)
          )
        ORDER BY ar.created_at DESC
    ");
    $stmt->execute([$tenantId, $userId, $userRole]);
    jsonResponse(['pending' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

// ── Action an approval (approve/reject) ──
case 'action':
    $input = json_decode(file_get_contents('php://input'), true);
    $requestId = intval($input['request_id'] ?? 0);
    $decision = $input['decision'] ?? '';
    $comment = $input['comment'] ?? '';

    if (!in_array($decision, ['approved', 'rejected'])) jsonError('Decision must be approved or rejected');

    $stmt = $pdo->prepare("
        SELECT ar.*, ast.step_order, ast.approver_type, ast.approver_id, ast.approver_role
        FROM approval_requests ar
        JOIN approval_steps ast ON ar.current_step_id = ast.id
        WHERE ar.id = ? AND ar.tenant_id = ? AND ar.status = 'pending'
    ");
    $stmt->execute([$requestId, $tenantId]);
    $request = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$request) jsonError('Pending approval request not found');

    // Verify user can approve this step
    $canApprove = false;
    if ($request['approver_type'] === 'specific_user' && $request['approver_id'] == $userId) $canApprove = true;
    if ($request['approver_type'] === 'role' && $request['approver_role'] === $userRole) $canApprove = true;
    if (in_array($userRole, ['admin', 'director'])) $canApprove = true;
    if (!$canApprove) jsonError('You are not authorized to action this approval');

    $pdo->beginTransaction();
    try {
        // Log the action
        $pdo->prepare("
            INSERT INTO approval_actions (request_id, step_id, user_id, decision, comment, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ")->execute([$requestId, $request['current_step_id'], $userId, $decision, $comment]);

        if ($decision === 'rejected') {
            // Reject the whole request
            $pdo->prepare("UPDATE approval_requests SET status = 'rejected', updated_at = NOW() WHERE id = ?")->execute([$requestId]);
        } else {
            // Check if there's a next step
            $stmt = $pdo->prepare("
                SELECT id FROM approval_steps
                WHERE workflow_id = ? AND step_order > ?
                ORDER BY step_order ASC LIMIT 1
            ");
            $stmt->execute([$request['workflow_id'], $request['step_order']]);
            $nextStep = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($nextStep) {
                // Move to next step
                $pdo->prepare("UPDATE approval_requests SET current_step_id = ?, updated_at = NOW() WHERE id = ?")
                    ->execute([$nextStep['id'], $requestId]);
            } else {
                // Final approval
                $pdo->prepare("UPDATE approval_requests SET status = 'approved', updated_at = NOW() WHERE id = ?")
                    ->execute([$requestId]);
            }
        }

        $pdo->commit();
        jsonResponse(['message' => "Request $decision", 'status' => $decision]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Failed to process approval: ' . $e->getMessage());
    }

// ── Submit a new approval request ──
case 'submit':
    $input = json_decode(file_get_contents('php://input'), true);
    $workflowType = $input['type'] ?? '';
    $referenceId = intval($input['reference_id'] ?? 0);
    $referenceType = $input['reference_type'] ?? $workflowType;
    $description = $input['description'] ?? '';

    // Find the workflow for this type
    $stmt = $pdo->prepare("SELECT id FROM approval_workflows WHERE tenant_id = ? AND type = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$tenantId, $workflowType]);
    $workflow = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$workflow) {
        // No workflow configured — auto-approve
        jsonResponse(['message' => 'No workflow configured — auto-approved', 'auto_approved' => true]);
    }

    // Get first step
    $stmt = $pdo->prepare("SELECT id FROM approval_steps WHERE workflow_id = ? ORDER BY step_order ASC LIMIT 1");
    $stmt->execute([$workflow['id']]);
    $firstStep = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$firstStep) jsonError('Workflow has no steps');

    $pdo->prepare("
        INSERT INTO approval_requests (tenant_id, workflow_id, current_step_id, reference_type, reference_id, submitted_by, description, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    ")->execute([$tenantId, $workflow['id'], $firstStep['id'], $referenceType, $referenceId, $userId, $description]);

    jsonResponse(['id' => $pdo->lastInsertId(), 'message' => 'Approval request submitted']);

default:
    jsonError('Invalid action. Use: list, get, save, delete, my_pending, action, submit');
}
