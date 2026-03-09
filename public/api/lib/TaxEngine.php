<?php
/**
 * TaxEngine.php
 *
 * KaziPay Tax Engine - Factory + country-specific tax calculators.
 * Ported from the JavaScript tax engine for the WebSquare project.
 *
 * Supports: Kenya (KE), Uganda (UG), Tanzania (TZ), Rwanda (RW).
 */

require_once __DIR__ . '/TaxConstants.php';
require_once __DIR__ . '/TaxUtils.php';

// ============================================================================
// Factory
// ============================================================================

/**
 * Return the appropriate tax calculator instance for the given country code.
 *
 * @param string $countryCode  ISO-2 country code (KE, UG, TZ, RW).
 * @return object              A calculator with calculateNSSF, calculatePAYE, getFullBreakdown.
 * @throws InvalidArgumentException  If the country code is not supported.
 */
function getTaxCalculator(string $countryCode) {
    $code = strtoupper(trim($countryCode));
    switch ($code) {
        case 'KE': return new KenyaTaxCalculator();
        case 'UG': return new UgandaTaxCalculator();
        case 'TZ': return new TanzaniaTaxCalculator();
        case 'RW': return new RwandaTaxCalculator();
        default:
            throw new InvalidArgumentException("Unsupported country code: {$countryCode}");
    }
}

// ============================================================================
// Helper: build the standardised result array with zeros for all keys
// ============================================================================

function emptyBreakdown(): array {
    return [
        'grossPay'              => 0,
        'nssfEmployee'          => 0,
        'pensionEmployee'       => 0,
        'otherPretaxDeductions' => 0,
        'taxableIncome'         => 0,
        'paye'                  => 0,
        'personalRelief'        => 0,
        'insuranceRelief'       => 0,
        'disabilityExemption'   => 0,
        'taxPayable'            => 0,
        'shifNhif'              => 0,
        'housingLevy'           => 0,
        'lst'                   => 0,
        'sdl'                   => 0,
        'wcf'                   => 0,
        'maternityLevy'         => 0,
        'totalDeductions'       => 0,
        'netPay'                => 0,
        'nssfEmployer'          => 0,
        'pensionEmployer'       => 0,
        'shifEmployer'          => 0,
        'housingLevyEmployer'   => 0,
        'sdlEmployer'           => 0,
        'wcfEmployer'           => 0,
        'maternityEmployer'     => 0,
        'totalEmployerCost'     => 0,
    ];
}


// ============================================================================
// KENYA
// ============================================================================

class KenyaTaxCalculator {

    /**
     * NSSF contribution: 10% employee, employer matches.
     */
    public function calculateNSSF(float $grossPay): array {
        $employee = round($grossPay * KE_NSSF_RATE_EMPLOYEE / 100, 2);
        $employer = round($grossPay * KE_NSSF_RATE_EMPLOYER / 100, 2);
        return ['employee' => $employee, 'employer' => $employer];
    }

    /**
     * SHIF contribution: 2.75% employee (min 300), employer 2.75% (max 4320).
     */
    public function calculateSHIF(float $grossPay): array {
        $employee = round(max(KE_SHIF_MIN_EMPLOYEE, $grossPay * KE_SHIF_RATE_EMPLOYEE / 100), 2);
        $employer = round(min(KE_SHIF_MAX_EMPLOYER, $grossPay * KE_SHIF_RATE_EMPLOYER / 100), 2);
        return ['employee' => $employee, 'employer' => $employer];
    }

    /**
     * Housing Levy: 1.5% each.
     */
    public function calculateHousingLevy(float $grossPay): array {
        $employee = round($grossPay * KE_HOUSING_LEVY_RATE_EMPLOYEE / 100, 2);
        $employer = round($grossPay * KE_HOUSING_LEVY_RATE_EMPLOYER / 100, 2);
        return ['employee' => $employee, 'employer' => $employer];
    }

    /**
     * PAYE calculation with personal relief and insurance relief.
     *
     * Options:
     *   'hasDisability' => bool   Apply disability exemption (default false)
     */
    public function calculatePAYE(float $taxableIncome, array $options = []): float {
        $hasDisability = $options['hasDisability'] ?? false;

        $incomeForTax = $taxableIncome;
        if ($hasDisability) {
            $incomeForTax = max(0, $incomeForTax - KE_DISABILITY_EXEMPTION);
        }

        $grossTax = calculateProgressiveTax($incomeForTax, KE_PAYE_BANDS);
        return round($grossTax, 2);
    }

    /**
     * Full payroll breakdown.
     *
     * Options:
     *   'hasDisability' => bool
     */
    public function getFullBreakdown(float $grossPay, array $options = []): array {
        $hasDisability = $options['hasDisability'] ?? false;

        $result = emptyBreakdown();
        $result['grossPay'] = round($grossPay, 2);

        // --- NSSF ---
        $nssf = $this->calculateNSSF($grossPay);
        $result['nssfEmployee']  = $nssf['employee'];
        $result['nssfEmployer']  = $nssf['employer'];
        $result['pensionEmployee'] = $nssf['employee'];
        $result['pensionEmployer'] = $nssf['employer'];

        // --- SHIF ---
        $shif = $this->calculateSHIF($grossPay);
        $result['shifNhif']     = $shif['employee'];
        $result['shifEmployer'] = $shif['employer'];

        // --- Housing Levy ---
        $housing = $this->calculateHousingLevy($grossPay);
        $result['housingLevy']         = $housing['employee'];
        $result['housingLevyEmployer'] = $housing['employer'];

        // --- Taxable income ---
        $taxableIncome = $grossPay - $nssf['employee'];
        if (KE_HOUSING_LEVY_DEDUCTIBLE) {
            $taxableIncome -= $housing['employee'];
        }
        $taxableIncome = max(0, round($taxableIncome, 2));
        $result['taxableIncome'] = $taxableIncome;

        // --- PAYE (gross tax) ---
        $grossTax = $this->calculatePAYE($taxableIncome, $options);
        $result['paye'] = $grossTax;

        // --- Personal relief ---
        $result['personalRelief'] = KE_PERSONAL_RELIEF;

        // --- Insurance relief (15% of SHIF, max 5000) ---
        $insuranceRelief = round(min(KE_INSURANCE_RELIEF_MAX, $shif['employee'] * KE_INSURANCE_RELIEF_RATE / 100), 2);
        $result['insuranceRelief'] = $insuranceRelief;

        // --- Disability exemption ---
        $disabilityExemption = 0;
        if ($hasDisability) {
            $disabilityExemption = KE_DISABILITY_EXEMPTION;
        }
        $result['disabilityExemption'] = $disabilityExemption;

        // --- Tax payable ---
        $taxPayable = $grossTax - KE_PERSONAL_RELIEF - $insuranceRelief;
        $taxPayable = max(0, round($taxPayable, 2));
        $result['taxPayable'] = $taxPayable;

        // --- Pretax deductions ---
        $result['otherPretaxDeductions'] = 0;

        // --- Total deductions (employee) ---
        $totalDeductions = $nssf['employee'] + $shif['employee'] + $housing['employee'] + $taxPayable;
        $result['totalDeductions'] = round($totalDeductions, 2);

        // --- Net pay ---
        $netPay = $grossPay - $totalDeductions;
        $result['netPay'] = round($netPay, 2);

        // --- Employer cost ---
        $totalEmployerCost = $grossPay + $nssf['employer'] + $shif['employer'] + $housing['employer'];
        $result['totalEmployerCost'] = round($totalEmployerCost, 2);

        return $result;
    }
}


// ============================================================================
// UGANDA
// ============================================================================

class UgandaTaxCalculator {

    /**
     * NSSF contribution: 5% employee, 10% employer.
     */
    public function calculateNSSF(float $grossPay): array {
        $employee = round($grossPay * UG_NSSF_RATE_EMPLOYEE / 100, 2);
        $employer = round($grossPay * UG_NSSF_RATE_EMPLOYER / 100, 2);
        return ['employee' => $employee, 'employer' => $employer];
    }

    /**
     * Local Service Tax based on gross monthly income bands.
     */
    public function calculateLST(float $grossPay): float {
        foreach (UG_LST_BANDS as $band) {
            $bandMax = ($band['max'] === INF) ? INF : $band['max'];
            if ($grossPay >= $band['min'] && $grossPay <= $bandMax) {
                return round($band['amount'] / 12, 2); // monthly portion of annual LST
            }
        }
        return 0;
    }

    /**
     * PAYE: progressive bands.
     */
    public function calculatePAYE(float $taxableIncome, array $options = []): float {
        $grossTax = calculateProgressiveTax($taxableIncome, UG_PAYE_BANDS);
        return round($grossTax, 2);
    }

    /**
     * Full payroll breakdown.
     */
    public function getFullBreakdown(float $grossPay, array $options = []): array {
        $result = emptyBreakdown();
        $result['grossPay'] = round($grossPay, 2);

        // --- NSSF ---
        $nssf = $this->calculateNSSF($grossPay);
        $result['nssfEmployee']  = $nssf['employee'];
        $result['nssfEmployer']  = $nssf['employer'];
        $result['pensionEmployee'] = $nssf['employee'];
        $result['pensionEmployer'] = $nssf['employer'];

        // --- Taxable income (after NSSF employee) ---
        $taxableIncome = max(0, round($grossPay - $nssf['employee'], 2));
        $result['taxableIncome'] = $taxableIncome;

        // --- PAYE ---
        $paye = $this->calculatePAYE($taxableIncome, $options);
        $result['paye'] = $paye;
        $result['taxPayable'] = $paye;

        // --- LST ---
        $lst = $this->calculateLST($grossPay);
        $result['lst'] = $lst;

        // --- Total deductions ---
        $totalDeductions = $nssf['employee'] + $paye + $lst;
        $result['totalDeductions'] = round($totalDeductions, 2);

        // --- Net pay ---
        $result['netPay'] = round($grossPay - $totalDeductions, 2);

        // --- Employer cost ---
        $result['totalEmployerCost'] = round($grossPay + $nssf['employer'], 2);

        return $result;
    }
}


// ============================================================================
// TANZANIA
// ============================================================================

class TanzaniaTaxCalculator {

    /**
     * NSSF contribution: 10% employee, 10% employer.
     */
    public function calculateNSSF(float $grossPay): array {
        $employee = round($grossPay * TZ_NSSF_RATE_EMPLOYEE / 100, 2);
        $employer = round($grossPay * TZ_NSSF_RATE_EMPLOYER / 100, 2);
        return ['employee' => $employee, 'employer' => $employer];
    }

    /**
     * Skills Development Levy: 4% employer only.
     */
    public function calculateSDL(float $grossPay): float {
        return round($grossPay * TZ_SDL_RATE / 100, 2);
    }

    /**
     * Workers Compensation Fund: 0.5% employer only.
     */
    public function calculateWCF(float $grossPay): float {
        return round($grossPay * TZ_WCF_RATE / 100, 2);
    }

    /**
     * PAYE calculation.
     *
     * Options:
     *   'isNonResident'       => bool  (flat 15%)
     *   'isDirectorFee'      => bool  (flat 15%)
     *   'isSecondaryEmployment' => bool (flat 30%)
     */
    public function calculatePAYE(float $taxableIncome, array $options = []): float {
        $isNonResident       = $options['isNonResident'] ?? false;
        $isDirectorFee       = $options['isDirectorFee'] ?? false;
        $isSecondaryEmployment = $options['isSecondaryEmployment'] ?? false;

        if ($isNonResident) {
            return round($taxableIncome * TZ_NON_RESIDENT_RATE / 100, 2);
        }
        if ($isDirectorFee) {
            return round($taxableIncome * TZ_DIRECTOR_FEE_RATE / 100, 2);
        }
        if ($isSecondaryEmployment) {
            return round($taxableIncome * TZ_SECONDARY_EMPLOYMENT_RATE / 100, 2);
        }

        $grossTax = calculateProgressiveTax($taxableIncome, TZ_PAYE_BANDS);
        return round($grossTax, 2);
    }

    /**
     * Full payroll breakdown.
     *
     * Options:
     *   'isNonResident'         => bool
     *   'isDirectorFee'        => bool
     *   'isSecondaryEmployment' => bool
     */
    public function getFullBreakdown(float $grossPay, array $options = []): array {
        $result = emptyBreakdown();
        $result['grossPay'] = round($grossPay, 2);

        // --- NSSF ---
        $nssf = $this->calculateNSSF($grossPay);
        $result['nssfEmployee']  = $nssf['employee'];
        $result['nssfEmployer']  = $nssf['employer'];
        $result['pensionEmployee'] = $nssf['employee'];
        $result['pensionEmployer'] = $nssf['employer'];

        // --- SDL (employer) ---
        $sdl = $this->calculateSDL($grossPay);
        $result['sdl']         = 0; // employee pays nothing
        $result['sdlEmployer'] = $sdl;

        // --- WCF (employer) ---
        $wcf = $this->calculateWCF($grossPay);
        $result['wcf']         = 0; // employee pays nothing
        $result['wcfEmployer'] = $wcf;

        // --- Taxable income (after NSSF employee) ---
        $taxableIncome = max(0, round($grossPay - $nssf['employee'], 2));
        $result['taxableIncome'] = $taxableIncome;

        // --- PAYE ---
        $paye = $this->calculatePAYE($taxableIncome, $options);
        $result['paye']       = $paye;
        $result['taxPayable'] = $paye;

        // --- Total deductions (employee) ---
        $totalDeductions = $nssf['employee'] + $paye;
        $result['totalDeductions'] = round($totalDeductions, 2);

        // --- Net pay ---
        $result['netPay'] = round($grossPay - $totalDeductions, 2);

        // --- Employer cost ---
        $totalEmployerCost = $grossPay + $nssf['employer'] + $sdl + $wcf;
        $result['totalEmployerCost'] = round($totalEmployerCost, 2);

        return $result;
    }
}


// ============================================================================
// RWANDA
// ============================================================================

class RwandaTaxCalculator {

    /**
     * RSSB Pension: 6% employee, 6% employer (effective Jan 2025).
     */
    public function calculateNSSF(float $grossPay): array {
        $employee = round($grossPay * RW_RSSB_PENSION_RATE_EMPLOYEE / 100, 2);
        $employer = round($grossPay * RW_RSSB_PENSION_RATE_EMPLOYER / 100, 2);
        return ['employee' => $employee, 'employer' => $employer];
    }

    /**
     * RSSB Medical: 7.5% employee, 7.5% employer (effective Jan 2025).
     */
    public function calculateRSSBMedical(float $grossPay): array {
        $employee = round($grossPay * RW_RSSB_MEDICAL_RATE_EMPLOYEE / 100, 2);
        $employer = round($grossPay * RW_RSSB_MEDICAL_RATE_EMPLOYER / 100, 2);
        return ['employee' => $employee, 'employer' => $employer];
    }

    /**
     * Maternity Leave Contribution: 0.3% each.
     */
    public function calculateMaternity(float $grossPay): array {
        $employee = round($grossPay * RW_MATERNITY_RATE_EMPLOYEE / 100, 2);
        $employer = round($grossPay * RW_MATERNITY_RATE_EMPLOYER / 100, 2);
        return ['employee' => $employee, 'employer' => $employer];
    }

    /**
     * Community-Based Health Insurance (CBHI): 0.5% employee only.
     */
    public function calculateCBHI(float $grossPay): float {
        return round($grossPay * RW_CBHI_RATE_EMPLOYEE / 100, 2);
    }

    /**
     * Occupational Hazards: 2% employer only.
     */
    public function calculateOccupationalHazards(float $grossPay): float {
        return round($grossPay * RW_OCCUPATIONAL_HAZARDS_RATE_EMPLOYER / 100, 2);
    }

    /**
     * PAYE: progressive bands.
     */
    public function calculatePAYE(float $taxableIncome, array $options = []): float {
        $grossTax = calculateProgressiveTax($taxableIncome, RW_PAYE_BANDS);
        return round($grossTax, 2);
    }

    /**
     * Full payroll breakdown.
     */
    public function getFullBreakdown(float $grossPay, array $options = []): array {
        $result = emptyBreakdown();
        $result['grossPay'] = round($grossPay, 2);

        // --- RSSB Pension (exposed via calculateNSSF interface) ---
        $pension = $this->calculateNSSF($grossPay);
        $result['nssfEmployee']    = $pension['employee'];
        $result['nssfEmployer']    = $pension['employer'];
        $result['pensionEmployee'] = $pension['employee'];
        $result['pensionEmployer'] = $pension['employer'];

        // --- RSSB Medical ---
        $medical = $this->calculateRSSBMedical($grossPay);
        $result['shifNhif']     = $medical['employee'];  // mapped to shifNhif for standardisation
        $result['shifEmployer'] = $medical['employer'];

        // --- Maternity ---
        $maternity = $this->calculateMaternity($grossPay);
        $result['maternityLevy']     = $maternity['employee'];
        $result['maternityEmployer'] = $maternity['employer'];

        // --- CBHI (employee only) ---
        $cbhi = $this->calculateCBHI($grossPay);
        $result['otherPretaxDeductions'] = $cbhi;

        // --- Occupational Hazards (employer only) ---
        $occHazards = $this->calculateOccupationalHazards($grossPay);

        // --- Taxable income (after pension employee) ---
        $taxableIncome = max(0, round($grossPay - $pension['employee'], 2));
        $result['taxableIncome'] = $taxableIncome;

        // --- PAYE ---
        $paye = $this->calculatePAYE($taxableIncome, $options);
        $result['paye']       = $paye;
        $result['taxPayable'] = $paye;

        // --- Total deductions (employee) ---
        $totalDeductions = $pension['employee']
            + $medical['employee']
            + $maternity['employee']
            + $cbhi
            + $paye;
        $result['totalDeductions'] = round($totalDeductions, 2);

        // --- Net pay ---
        $result['netPay'] = round($grossPay - $totalDeductions, 2);

        // --- Employer cost ---
        $totalEmployerCost = $grossPay
            + $pension['employer']
            + $medical['employer']
            + $maternity['employer']
            + $occHazards;
        $result['totalEmployerCost'] = round($totalEmployerCost, 2);

        return $result;
    }
}
