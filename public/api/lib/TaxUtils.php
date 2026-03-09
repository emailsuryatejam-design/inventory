<?php
/**
 * TaxUtils.php
 *
 * KaziPay Tax Engine - Utility functions for tax calculations.
 * Ported from taxUtils.js for the WebSquare project.
 */

/**
 * Calculate progressive tax using tax bands.
 *
 * Each band is an associative array with keys: min, max, rate.
 * The rate is a percentage (e.g. 10 means 10%).
 * Use INF for the max of the highest band.
 *
 * @param float $income   The income to tax.
 * @param array $bands    Array of band arrays with 'min', 'max', 'rate' keys.
 * @return float          The calculated tax, rounded to 2 decimal places.
 */
function calculateProgressiveTax(float $income, array $bands): float {
    $tax = 0;
    $taxed = 0;

    foreach ($bands as $band) {
        if ($taxed >= $income) {
            break;
        }

        $bandMax = ($band['max'] === INF || $band['max'] === null) ? $income : $band['max'];
        $taxableInBand = min($income, $bandMax) - $taxed;

        if ($taxableInBand > 0) {
            $tax += $taxableInBand * ($band['rate'] / 100);
        }

        $taxed = $bandMax;
    }

    return max(0, round($tax, 2));
}
