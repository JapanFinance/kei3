import type { TakeHomeInputs, TakeHomeResults } from '../types/tax'
import { DEFAULT_PROVIDER, NATIONAL_HEALTH_INSURANCE_ID, DEPENDENT_COVERAGE_ID } from '../types/healthInsurance';
import { calculatePensionPremium } from './pensionCalculator';
import { calculateHealthInsurancePremium, calculateNationalHealthInsurancePremiumWithBreakdown } from './healthInsuranceCalculator';
import { calculateFurusatoNozeiDetails, calculateResidenceTax, calculateResidenceTaxBasicDeduction, NON_TAXABLE_RESIDENCE_TAX_DETAIL } from './residenceTax';
import { calculateDependentDeductions } from './dependentDeductions';

/** https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html */
export const employmentInsuranceRate = 0.0055; // 0.55%

/**
 * Calculates the net employment income based on the tax rules for 2025 income, applying the employment income deduction.
 * Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm
 */
export const calculateNetEmploymentIncome = (grossEmploymentIncome: number): number => {
    if (grossEmploymentIncome < 651_000) 
        return 0;
    
    if (grossEmploymentIncome < 1_900_000)
        return grossEmploymentIncome - 650_000;

    // From 1.9M yen through 6.6M yen, gross income is rounded down to the nearest 4,000 yen
    const roundedGrossIncome = Math.floor(grossEmploymentIncome / 4000) * 4000;

    if (grossEmploymentIncome <= 3_600_000) {
        return Math.floor(roundedGrossIncome * 0.7) - 80_000
    } else if (grossEmploymentIncome <= 6_600_000) {
        return Math.floor(roundedGrossIncome * 0.8) - 440_000
    } 
    
    if (grossEmploymentIncome <= 8_500_000) {
        return Math.floor(grossEmploymentIncome * 0.9) - 1_100_000
    } else {
        return grossEmploymentIncome - 1_950_000
    }
}

/**
 * Calculates employment insurance premiums based on income
 * Source: Ministry of Health, Labour and Welfare (MHLW) rates for 2025
 * https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html
 * Note: Only calculates employee portion of the premium.
 * 
 * The premium is calculated monthly with special rounding rules:
 * - 0.55% of monthly salary
 * - Rounding: 
 *   - If decimal is 0.50 yen or less → round down
 *   - If decimal is 0.51 yen or more → round up
 * - Annual total is the sum of 12 monthly premiums
 */
export const calculateEmploymentInsurance = (annualIncome: number, isEmploymentIncome: boolean): number => {
    // If not employment income, no employment insurance is required
    if (!isEmploymentIncome || annualIncome <= 0) {
        return 0;
    }

    const monthlySalary = annualIncome / 12;
    let annualPremium = 0;


    for (let i = 0; i < 12; i++) {
        const monthlyPremium = monthlySalary * employmentInsuranceRate;
        // Apply special rounding rules
        const decimal = monthlyPremium - Math.floor(monthlyPremium);
        let roundedPremium: number;
        
        if (decimal <= 0.5) {
            roundedPremium = Math.floor(monthlyPremium);
        } else {
            roundedPremium = Math.ceil(monthlyPremium);
        }
        
        annualPremium += roundedPremium;
    }

    return Math.max(annualPremium, 0);
}

/**
 * Calculates the basic deduction (基礎控除) for national income tax based on income
 * Source: National Tax Agency https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm
 * 2025 Update: https://www.nta.go.jp/users/gensen/2025kiso/index.htm#a-01
 * 
 * 2025 Changes:
 * - 1,320,000 yen or less: 950,000 yen (was 480,000 yen)
 * - 1,320,001 - 3,360,000 yen: 880,000 yen (will be 580,000 from 2027) (was 480,000 yen)
 * - 3,360,001 - 4,890,000 yen: 680,000 yen (will be 580,000 from 2027) (was 480,000 yen)
 * - 4,890,001 - 6,550,000 yen: 630,000 yen (will be 580,000 from 2027) (was 480,000 yen)
 * - 6,550,001 - 23,500,000 yen: 580,000 yen (was 480,000 yen)
 * - Over 23,500,000 yen: no change
 */
export const calculateNationalIncomeTaxBasicDeduction = (netIncome: number): number => {
    if (netIncome <= 1_320_000) {
        return 950_000; // Up from 480,000 yen
    } else if (netIncome <= 3_360_000) {
        return 880_000; // Will be 580,000 from 2027 (currently 480,000 in 2024)
    } else if (netIncome <= 4_890_000) {
        return 680_000; // Will be 580,000 from 2027 (currently 480,000 in 2024)
    } else if (netIncome <= 6_550_000) {
        return 630_000; // Will be 580,000 from 2027 (currently 480,000 in 2024)
    } else if (netIncome <= 23_500_000) {
        return 580_000; // Up from 480,000 yen
    } else if (netIncome <= 24000000) { // No change for income over 23.5M yen
        return 480000;
    } else if (netIncome <= 24500000) { // No change for income over 23.5M yen
        return 320000;
    } else if (netIncome <= 25000000) { // No change for income over 23.5M yen
        return 160000;
    } else {
        return 0;
    }
}

/**
 * Calculates the base national income tax (before reconstruction surtax) based on taxable income
 * Source: National Tax Agency tax brackets for 2025
 * https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
 */
export const calculateNationalIncomeTaxBase = (taxableIncome: number): number => {
    // Clamp taxable income to 0 if negative
    taxableIncome = Math.max(0, taxableIncome);

    let baseTax = 0;
    if (taxableIncome <= 1949000) {
        baseTax = taxableIncome * 0.05;
    } else if (taxableIncome <= 3299000) {
        baseTax = taxableIncome * 0.1 - 97500;
    } else if (taxableIncome <= 6949000) {
        baseTax = taxableIncome * 0.2 - 427500;
    } else if (taxableIncome <= 8999000) {
        baseTax = taxableIncome * 0.23 - 636000;
    } else if (taxableIncome <= 17999000) {
        baseTax = taxableIncome * 0.33 - 1536000;
    } else if (taxableIncome <= 39999000) {
        baseTax = taxableIncome * 0.4 - 2796000;
    } else {
        baseTax = taxableIncome * 0.45 - 4796000;
    }

    return baseTax;
}

/**
 * Calculates the reconstruction surtax (復興特別所得税) at 2.1% of base income tax
 * Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
 */
export const calculateReconstructionSurtax = (baseTax: number): number => {
    return baseTax * 0.021;
}

/**
 * Calculates national income tax based on taxable income, including the 2.1% reconstruction surtax
 * Source: National Tax Agency tax brackets for 2025
 * https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
 * Note: Result is rounded down to the nearest 100 yen
 */
export const calculateNationalIncomeTax = (taxableIncome: number): number => {
    const baseTax = calculateNationalIncomeTaxBase(taxableIncome);
    const reconstructionSurtax = calculateReconstructionSurtax(baseTax);
    
    // Round down to the nearest 100 yen (total tax)
    return Math.floor((baseTax + reconstructionSurtax) / 100) * 100;
}

const DEFAULT_TAKE_HOME_RESULTS: TakeHomeResults = {
    annualIncome: 0,
    isEmploymentIncome: true,
    nationalIncomeTax: 0,
    residenceTax: NON_TAXABLE_RESIDENCE_TAX_DETAIL,
    healthInsurance: 0,
    pensionPayments: 0,
    employmentInsurance: 0,
    takeHomeIncome: 0,
    furusatoNozei: calculateFurusatoNozeiDetails(0, NON_TAXABLE_RESIDENCE_TAX_DETAIL),
    dcPlanContributions: 0,
    // Add the new required properties with default values
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    isSubjectToLongTermCarePremium: false,
};

export const calculateTaxes = (inputs: TakeHomeInputs): TakeHomeResults => {
    if (inputs.annualIncome <= 0) {
        return DEFAULT_TAKE_HOME_RESULTS;
    }
    const annualIncome = inputs.annualIncome;
    const isEmploymentIncome = inputs.isEmploymentIncome;
    const netIncome = isEmploymentIncome ? calculateNetEmploymentIncome(annualIncome) : annualIncome;

    // For health insurance calculation, we need to use the appropriate income:
    // - Employee health insurance: uses gross employment income (monthly salary-based calculation)
    // - National Health Insurance: uses net income (after employment income deduction if applicable)
    //   This is because NHI premiums are based on taxable income, while employee health insurance
    //   is based on standard monthly remuneration before deductions.
    const incomeForHealthInsurance = inputs.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID
        ? netIncome
        : inputs.annualIncome;

    const healthInsurance = calculateHealthInsurancePremium(
        incomeForHealthInsurance,
        inputs.isSubjectToLongTermCarePremium,
        inputs.healthInsuranceProvider,
        inputs.region
    );

    // Calculate NHI breakdown if National Health Insurance is selected
    let nhiBreakdown = null;
    if (inputs.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID) {
        // For NHI breakdown, also use net income
        nhiBreakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
            netIncome,
            inputs.isSubjectToLongTermCarePremium,
            inputs.region as string
        );
    }

    // Calculate pension based on health insurance type
    // People on National Health Insurance are in National Pension system
    // People on employee health insurance are in Employee Pension system
    // People covered as dependents do not pay pension premiums
    const isInEmployeePensionSystem = inputs.healthInsuranceProvider !== NATIONAL_HEALTH_INSURANCE_ID && inputs.healthInsuranceProvider !== DEPENDENT_COVERAGE_ID;
    const pensionPayments = inputs.healthInsuranceProvider === DEPENDENT_COVERAGE_ID 
        ? 0 
        : calculatePensionPremium(isInEmployeePensionSystem, annualIncome / 12);

    const employmentInsurance = calculateEmploymentInsurance(annualIncome, isEmploymentIncome);

    const socialInsuranceDeduction = healthInsurance + pensionPayments + employmentInsurance;

    // iDeCo and corporate DC contributions are deductible as 小規模企業共済等掛金控除
    const idecoDeduction = Math.max(0, inputs.dcPlanContributions || 0);

    const dependentDeductions = calculateDependentDeductions(inputs.dependents, netIncome);

    const nationalIncomeTaxBasicDeduction = calculateNationalIncomeTaxBasicDeduction(netIncome);

    const taxableIncomeForNationalIncomeTax = Math.max(0, Math.floor((netIncome - socialInsuranceDeduction - idecoDeduction - nationalIncomeTaxBasicDeduction - dependentDeductions.nationalTax.total) / 1000) * 1000);

    const nationalIncomeTax = calculateNationalIncomeTax(taxableIncomeForNationalIncomeTax);
    
    // Calculate base tax and reconstruction surtax breakdown for display
    // Show the actual calculated amounts (before final rounding)
    const nationalIncomeTaxBase = calculateNationalIncomeTaxBase(taxableIncomeForNationalIncomeTax);
    const reconstructionSurtax = calculateReconstructionSurtax(nationalIncomeTaxBase);

    const residenceTaxBasicDeduction = calculateResidenceTaxBasicDeduction(netIncome);
    const taxableIncomeForResidenceTax = Math.max(0, Math.floor(Math.max(0, netIncome - socialInsuranceDeduction - idecoDeduction - residenceTaxBasicDeduction - dependentDeductions.residenceTax.total) / 1000) * 1000);

    const residenceTax = calculateResidenceTax(netIncome, socialInsuranceDeduction + idecoDeduction, dependentDeductions);

    // Calculate totals
    const totalSocialsAndTax = nationalIncomeTax + residenceTax.totalResidenceTax + healthInsurance + pensionPayments + employmentInsurance;
    const takeHomeIncome = annualIncome - totalSocialsAndTax;

    const furusatoNozeiLimit = calculateFurusatoNozeiDetails(netIncome - socialInsuranceDeduction - idecoDeduction - nationalIncomeTaxBasicDeduction - dependentDeductions.nationalTax.total, residenceTax);

    return {
        annualIncome,
        isEmploymentIncome,
        nationalIncomeTax,
        residenceTax,
        healthInsurance,
        pensionPayments,
        employmentInsurance,
        takeHomeIncome,
        netEmploymentIncome: isEmploymentIncome ? netIncome : undefined,
        nationalIncomeTaxBasicDeduction,
        taxableIncomeForNationalIncomeTax,
        residenceTaxBasicDeduction,
        taxableIncomeForResidenceTax,
        furusatoNozei: furusatoNozeiLimit,
        dcPlanContributions: inputs.dcPlanContributions,
        // Income tax breakdown
        nationalIncomeTaxBase: taxableIncomeForNationalIncomeTax > 0 ? nationalIncomeTaxBase : undefined,
        reconstructionSurtax: taxableIncomeForNationalIncomeTax > 0 ? reconstructionSurtax : undefined,
        // NHI breakdown fields (populated only when NHI is selected)
        nhiMedicalPortion: nhiBreakdown?.medicalPortion,
        nhiElderlySupportPortion: nhiBreakdown?.elderlySupportPortion,
        nhiLongTermCarePortion: nhiBreakdown?.longTermCarePortion,
        // Context needed for cap detection
        healthInsuranceProvider: inputs.healthInsuranceProvider,
        region: inputs.region,
        isSubjectToLongTermCarePremium: inputs.isSubjectToLongTermCarePremium,
        // Dependent deductions (always include, even if zero)
        ...(inputs.dependents.length > 0 && {
            dependentDeductions: dependentDeductions
        }),
    };
}
