<?php
/**
 * TaxConstants.php
 *
 * KaziPay Tax Engine - Tax constants for Kenya, Uganda, Tanzania, and Rwanda.
 * Ported from taxConstants.js for the WebSquare project.
 */

// ============================================================================
// KENYA (KE) - 2025
// ============================================================================

define('KE_PAYE_BANDS', [
    ['min' => 0,      'max' => 24000,  'rate' => 10],
    ['min' => 24001,  'max' => 32333,  'rate' => 25],
    ['min' => 32334,  'max' => 500000, 'rate' => 30],
    ['min' => 500001, 'max' => 800000, 'rate' => 32.5],
    ['min' => 800001, 'max' => INF,    'rate' => 35],
]);

define('KE_PERSONAL_RELIEF', 2400);

define('KE_NSSF_RATE_EMPLOYEE', 10);   // percent
define('KE_NSSF_RATE_EMPLOYER', 10);   // employer matches

define('KE_SHIF_RATE_EMPLOYEE', 2.75); // percent
define('KE_SHIF_MIN_EMPLOYEE', 300);
define('KE_SHIF_RATE_EMPLOYER', 2.75); // percent
define('KE_SHIF_MAX_EMPLOYER', 4320);

define('KE_INSURANCE_RELIEF_RATE', 15);   // percent of SHIF contribution
define('KE_INSURANCE_RELIEF_MAX', 5000);

define('KE_HOUSING_LEVY_RATE_EMPLOYEE', 1.5); // percent
define('KE_HOUSING_LEVY_RATE_EMPLOYER', 1.5); // percent
define('KE_HOUSING_LEVY_DEDUCTIBLE', true);   // deductible from Dec 2024

define('KE_DISABILITY_EXEMPTION', 150000);

// ============================================================================
// UGANDA (UG)
// ============================================================================

define('UG_PAYE_BANDS', [
    ['min' => 0,        'max' => 235000,   'rate' => 0],
    ['min' => 235001,   'max' => 335000,   'rate' => 10],
    ['min' => 335001,   'max' => 410000,   'rate' => 20],
    ['min' => 410001,   'max' => 10000000, 'rate' => 30],
    ['min' => 10000001, 'max' => INF,      'rate' => 40],
]);

define('UG_NSSF_RATE_EMPLOYEE', 5);   // percent
define('UG_NSSF_RATE_EMPLOYER', 10);  // percent

define('UG_LST_BANDS', [
    ['min' => 0,      'max' => 100000, 'amount' => 0],
    ['min' => 100001, 'max' => 200000, 'amount' => 5000],
    ['min' => 200001, 'max' => 300000, 'amount' => 10000],
    ['min' => 300001, 'max' => 400000, 'amount' => 20000],
    ['min' => 400001, 'max' => 500000, 'amount' => 30000],
    ['min' => 500001, 'max' => INF,    'amount' => 100000],
]);

// ============================================================================
// TANZANIA (TZ)
// ============================================================================

define('TZ_PAYE_BANDS', [
    ['min' => 0,       'max' => 270000,  'rate' => 0],
    ['min' => 270001,  'max' => 520000,  'rate' => 8],
    ['min' => 520001,  'max' => 760000,  'rate' => 20],
    ['min' => 760001,  'max' => 1000000, 'rate' => 25],
    ['min' => 1000001, 'max' => INF,     'rate' => 30],
]);

define('TZ_NSSF_RATE_EMPLOYEE', 10);  // percent
define('TZ_NSSF_RATE_EMPLOYER', 10);  // percent
define('TZ_SDL_RATE', 4);             // percent, employer only
define('TZ_WCF_RATE', 0.5);           // percent, employer only

define('TZ_NON_RESIDENT_RATE', 15);   // flat percent for non-residents
define('TZ_DIRECTOR_FEE_RATE', 15);   // flat percent for director fees
define('TZ_SECONDARY_EMPLOYMENT_RATE', 30); // flat percent for secondary employment

// ============================================================================
// RWANDA (RW) - Effective January 2025
// ============================================================================

define('RW_PAYE_BANDS', [
    ['min' => 0,      'max' => 60000,  'rate' => 0],
    ['min' => 60001,  'max' => 100000, 'rate' => 10],
    ['min' => 100001, 'max' => 200000, 'rate' => 20],
    ['min' => 200001, 'max' => INF,    'rate' => 30],
]);

define('RW_RSSB_PENSION_RATE_EMPLOYEE', 6);   // percent, effective Jan 2025
define('RW_RSSB_PENSION_RATE_EMPLOYER', 6);   // percent, effective Jan 2025

define('RW_RSSB_MEDICAL_RATE_EMPLOYEE', 7.5); // percent, effective Jan 2025
define('RW_RSSB_MEDICAL_RATE_EMPLOYER', 7.5); // percent, effective Jan 2025

define('RW_MATERNITY_RATE_EMPLOYEE', 0.3);    // percent
define('RW_MATERNITY_RATE_EMPLOYER', 0.3);    // percent

define('RW_CBHI_RATE_EMPLOYEE', 0.5);         // percent, employee only

define('RW_OCCUPATIONAL_HAZARDS_RATE_EMPLOYER', 2); // percent, employer only
