<?php
/**
 * KCL Stores — Shared Helpers
 */

/**
 * Generate a document number like ORD-NGO-2602-0001
 * @param PDO $pdo
 * @param string $prefix  e.g. 'ORD', 'DSP', 'RCV', 'ISS'
 * @param string $campCode e.g. 'NGO', 'SER'
 * @return string
 */
function generateDocNumber(PDO $pdo, string $prefix, string $campCode, ?int $tenantId = null): string
{
    $year = date('y');
    $month = (int) date('m');
    $yearMonth = $year . str_pad($month, 2, '0', STR_PAD_LEFT);

    // Lock row and increment atomically
    $pdo->beginTransaction();
    try {
        // Include tenant_id in sequence lookup to prevent collisions between tenants
        $tenantFilter = $tenantId ? ' AND tenant_id = ?' : ' AND tenant_id IS NULL';
        $stmt = $pdo->prepare("
            SELECT last_number FROM number_sequences
            WHERE prefix = ? AND camp_code = ? AND current_year = YEAR(NOW()) AND current_month = ?{$tenantFilter}
            FOR UPDATE
        ");
        $params = [$prefix, $campCode, $month];
        if ($tenantId) $params[] = $tenantId;
        $stmt->execute($params);
        $row = $stmt->fetch();

        if ($row) {
            $next = (int) $row['last_number'] + 1;
            $updateParams = [$next, $prefix, $campCode, $month];
            if ($tenantId) $updateParams[] = $tenantId;
            $pdo->prepare("
                UPDATE number_sequences SET last_number = ?
                WHERE prefix = ? AND camp_code = ? AND current_year = YEAR(NOW()) AND current_month = ?{$tenantFilter}
            ")->execute($updateParams);
        } else {
            $next = 1;
            $pdo->prepare("
                INSERT INTO number_sequences (tenant_id, prefix, camp_code, current_year, current_month, last_number)
                VALUES (?, ?, ?, YEAR(NOW()), ?, 1)
            ")->execute([$tenantId, $prefix, $campCode, $month]);
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

    return "{$prefix}-{$campCode}-{$yearMonth}-" . str_pad($next, 4, '0', STR_PAD_LEFT);
}

/**
 * Validate an order line against stock levels and rules
 * Returns: ['status' => 'clear|review|flagged', 'note' => '...']
 */
function validateOrderLine(array $line, float $campStock, float $hoStock, ?float $parLevel, ?float $avgDailyUsage): array
{
    $qty = (float) $line['qty'];
    $notes = [];
    $status = 'clear';

    // Check 1: Ordering more than par level
    if ($parLevel && $qty > $parLevel * 1.5) {
        $status = 'flagged';
        $notes[] = "Qty ({$qty}) exceeds 150% of par ({$parLevel})";
    }

    // Check 2: Camp has enough stock already
    if ($campStock > 0 && $parLevel && $campStock >= $parLevel * 0.8) {
        $status = ($status === 'flagged') ? 'flagged' : 'review';
        $notes[] = "Camp stock ({$campStock}) already at " . round($campStock / $parLevel * 100) . "% of par";
    }

    // Check 3: HO has low stock
    if ($hoStock <= 0) {
        $status = 'flagged';
        $notes[] = "HO is out of stock";
    } elseif ($hoStock < $qty) {
        $status = ($status === 'flagged') ? 'flagged' : 'review';
        $notes[] = "HO stock ({$hoStock}) less than requested ({$qty})";
    }

    return [
        'status' => $status,
        'note' => implode('; ', $notes) ?: null,
    ];
}

// ── Tenant Scope Helpers ────────────────────────────

/**
 * Inject tenant_id filter into existing $where[]/$params[] query builders.
 * Usage: tenantScope($where, $params, $tenantId, 'i');  // → "i.tenant_id = ?"
 *        tenantScope($where, $params, $tenantId);        // → "tenant_id = ?"
 */
function tenantScope(array &$where, array &$params, int $tenantId, ?string $alias = null): void
{
    $col = $alias ? "{$alias}.tenant_id" : "tenant_id";
    $where[] = "{$col} = ?";
    $params[] = $tenantId;
}

/**
 * Get camps filtered by tenant (replaces bare $pdo->query() calls).
 */
function getTenantCamps(PDO $pdo, int $tenantId): array
{
    $stmt = $pdo->prepare('SELECT id, code, name, type FROM camps WHERE tenant_id = ? AND is_active = 1 ORDER BY name');
    $stmt->execute([$tenantId]);
    return $stmt->fetchAll();
}

/**
 * Get item_groups filtered by tenant.
 */
function getTenantItemGroups(PDO $pdo, int $tenantId): array
{
    $stmt = $pdo->prepare('SELECT id, code, name FROM item_groups WHERE tenant_id = ? ORDER BY name');
    $stmt->execute([$tenantId]);
    return $stmt->fetchAll();
}

/**
 * Get cost_centers filtered by tenant.
 */
function getTenantCostCenters(PDO $pdo, int $tenantId): array
{
    $stmt = $pdo->prepare('SELECT id, code, name FROM cost_centers WHERE tenant_id = ? AND is_active = 1 ORDER BY name');
    $stmt->execute([$tenantId]);
    return $stmt->fetchAll();
}

/**
 * Get the HO (Head Office) camp ID for a specific tenant.
 */
function getTenantHOCampId(PDO $pdo, int $tenantId): ?int
{
    $stmt = $pdo->prepare("SELECT id FROM camps WHERE tenant_id = ? AND code = 'HO' LIMIT 1");
    $stmt->execute([$tenantId]);
    $id = $stmt->fetchColumn();
    if (!$id) {
        $stmt = $pdo->prepare("SELECT id FROM camps WHERE tenant_id = ? AND type = 'head_office' LIMIT 1");
        $stmt->execute([$tenantId]);
        $id = $stmt->fetchColumn();
    }
    return $id ? (int) $id : null;
}

/**
 * Get units_of_measure filtered by tenant.
 */
function getTenantUOMs(PDO $pdo, int $tenantId): array
{
    $stmt = $pdo->prepare('SELECT id, code, name FROM units_of_measure WHERE tenant_id = ? ORDER BY name');
    $stmt->execute([$tenantId]);
    return $stmt->fetchAll();
}

// ── Input Validation Helpers ────────────────────────

function validateInt($value, $min = null, $max = null) {
    $v = filter_var($value, FILTER_VALIDATE_INT);
    if ($v === false) return false;
    if ($min !== null && $v < $min) return false;
    if ($max !== null && $v > $max) return false;
    return $v;
}

function validateNumeric($value, $min = null, $max = null) {
    if (!is_numeric($value)) return false;
    $v = (float)$value;
    if ($min !== null && $v < $min) return false;
    if ($max !== null && $v > $max) return false;
    return $v;
}

function validatePagination($page, $perPage, $maxPerPage = 100) {
    $page = validateInt($page, 1) ?: 1;
    $perPage = validateInt($perPage, 1, $maxPerPage) ?: 20;
    $offset = ($page - 1) * $perPage;
    return [$page, $perPage, $offset];
}
