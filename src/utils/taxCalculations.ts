// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {BonusIncomeStream, IncomeStream, TakeHomeInputs, TakeHomeResults} from '../types/tax'
import {
    CUSTOM_PROVIDER_ID,
    DEFAULT_PROVIDER,
    DEPENDENT_COVERAGE_ID,
    NATIONAL_HEALTH_INSURANCE_ID
} from '../types/healthInsurance';
import {calculatePensionBreakdown} from './pensionCalculator';
import {
    calculateHealthInsuranceBreakdown,
    calculateNationalHealthInsurancePremiumWithBreakdown
} from './healthInsuranceCalculator';
import {
    calculateFurusatoNozeiDetails,
    calculateResidenceTax,
    calculateResidenceTaxBasicDeduction,
    NON_TAXABLE_RESIDENCE_TAX_DETAIL
} from './residenceTax';
import {calculateDependentDeductions} from './dependentDeductions';
import {COMMUTING_ALLOWANCE_NONTAXABLE_ANNUAL_CAP, NATIONAL_BASIC_DEDUCTION_TIERS,} from '../constants/taxThresholds';
import {getCommutingAllowanceAnnualAmount} from './formatters';
import {getEmploymentInsuranceRate} from '../data/employmentInsurance';

/**
 * Rounds the premium to a nearby whole yen according to the given mode.
 * By default, it rounds using halfTrunc mode:
 * - 0.50 yen or less rounds down
 * - more than 0.50 yen rounds up
 * @see https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/20121026.html
 */
export const roundSocialInsurancePremium = (amount: number, mode: 'halfTrunc' | 'halfExpand' = 'halfTrunc'): number => {
    const roundedAmount = new Intl.NumberFormat('en', {
        maximumFractionDigits: 0,
        useGrouping: false,
        roundingMode: mode,
    }).format(amount);
    return Number.parseInt(roundedAmount);
}

/**
 * Calculates the net employment income based on the tax rules for 2025/2026 income, applying the employment income deduction.
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
        return Math.floor(roundedGrossIncome * 0.7) - 80_000;
    } else if (grossEmploymentIncome <= 6_600_000) {
        return Math.floor(roundedGrossIncome * 0.8) - 440_000;
    }

    if (grossEmploymentIncome <= 8_500_000) {
        return Math.floor(grossEmploymentIncome * 0.9) - 1_100_000;
    } else {
        return grossEmploymentIncome - 1_950_000;
    }
}

/**
 * Breakdown of Employment Insurance premium components
 */
export interface EmploymentInsuranceBreakdown {
    total: number;
    bonusPortion: number;
}

/**
 * Calculates employment insurance premiums breakdown based on income.
 * The rate may vary by month within a calendar year (fiscal year changes in April).
 */
const calculateEmploymentInsuranceBreakdown = (
    salaryIncome: number,
    bonuses: BonusIncomeStream[],
    year: number = new Date().getFullYear()
): EmploymentInsuranceBreakdown => {
    // If no employment income, no employment insurance is required
    if (salaryIncome <= 0 && !bonuses.some(b => b.amount > 0)) {
        return { total: 0, bonusPortion: 0 };
    }

    let annualPremium = 0;
    let bonusPortion = 0;

    // Calculate on regular monthly salary — each month may have a different rate
    if (salaryIncome > 0) {
        const monthlySalary = salaryIncome / 12;
        for (let month = 0; month < 12; month++) {
            const rate = getEmploymentInsuranceRate(year, month);
            annualPremium += roundSocialInsurancePremium(monthlySalary * rate);
        }
    }

    // Calculate on bonuses — use the rate for the month the bonus is paid
    for (const bonus of bonuses) {
        const rate = getEmploymentInsuranceRate(year, bonus.month);
        const bonusPremium = roundSocialInsurancePremium(bonus.amount * rate);

        bonusPortion += bonusPremium;
        annualPremium += bonusPremium;
    }

    return { total: Math.max(annualPremium, 0), bonusPortion };
}

/**
 * Calculates employment insurance premiums based on income
 * Source: Ministry of Health, Labour and Welfare (MHLW)
 * https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html
 * Note: Only calculates the employee portion of the premium.
 *
 * The premium is calculated monthly with special rounding rules:
 * - Rate is looked up per month from the time-series data (rate changes in April each fiscal year)
 * - Rounding:
 *   - If decimal is 0.50 yen or less → round down
 *   - If decimal is 0.51 yen or more → round up
 * - Annual total is the sum of 12 monthly premiums
 */
// Only exported for testing
export const calculateEmploymentInsurance = (
    salaryIncome: number,
    bonuses: BonusIncomeStream[] = [],
    year?: number
): number => {
    return calculateEmploymentInsuranceBreakdown(salaryIncome, bonuses, year).total;
}

/**
 * Calculates the basic deduction (基礎控除) for national income tax based on income
 * Source: National Tax Agency https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm
 * 2025 Update: https://www.nta.go.jp/users/gensen/2025kiso/index.htm#a-01
 */
export const calculateNationalIncomeTaxBasicDeduction = (netIncome: number): number => {
    for (const { maxIncomeInclusive, deduction } of NATIONAL_BASIC_DEDUCTION_TIERS) {
        if (netIncome <= maxIncomeInclusive) return deduction;
    }
    return 0;
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
    hasEmploymentIncome: true,
    nationalIncomeTax: 0,
    residenceTax: NON_TAXABLE_RESIDENCE_TAX_DETAIL,
    healthInsurance: 0,
    pensionPayments: 0,
    employmentInsurance: 0,
    takeHomeIncome: 0,
    furusatoNozei: calculateFurusatoNozeiDetails(0, NON_TAXABLE_RESIDENCE_TAX_DETAIL),
    dcPlanContributions: 0,
    salaryIncome: 0,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    isSubjectToLongTermCarePremium: false,
    totalNetIncome: 0,
};

/**
 * Intermediate breakdown of income streams for calculation
 */
interface IncomeBreakdown {
    salaryIncome: number;
    bonusIncome: BonusIncomeStream[];
    netBusinessAndMiscIncomeBeforeBlueFilerDeduction: number;
    netBusinessAndMiscIncome: number;
    blueFilerDeduction: number;
    totalAnnualIncome: number;
    commutingAllowance: number;
    stockCompensationIncome: number;
}

/**
 * Processes income streams to categorize them and calculate totals.
 * This is used by both the main tax calculation and the net income calculation.
 */
const calculateIncomeBreakdown = (incomeStreams: IncomeStream[]): IncomeBreakdown => {
    let salaryIncome = 0;
    const bonusIncome: BonusIncomeStream[] = [];
    let netBusinessAndMiscIncomeBeforeBlueFilerDeduction = 0;
    let netBusinessAndMiscIncome = 0;
    let blueFilerDeduction = 0;
    let commutingAllowance = 0;
    let stockCompensationIncome = 0;
    let processedBusinessIncome = false;

    for (const income of incomeStreams) {
        if (income.type === 'salary') {
            if (income.frequency === 'monthly') {
                salaryIncome += income.amount * 12;
            } else {
                salaryIncome += income.amount;
            }
        } else if (income.type === 'commutingAllowance') {
            commutingAllowance += getCommutingAllowanceAnnualAmount(income);
        } else if (income.type === 'bonus') {
            bonusIncome.push(income);
        } else if (income.type === 'stockCompensation') {
            stockCompensationIncome += income.amount;
        } else if (income.type === 'business') {
            if (processedBusinessIncome) {
                throw new Error('Only one business income stream is allowed.');
            }
            if (income.amount < 0) {
                throw new Error('Business income losses are not currently supported.');
            }
            const maxDeduction = income.blueFilerDeduction || 0;
            netBusinessAndMiscIncomeBeforeBlueFilerDeduction += income.amount;
            // Net business income is reduced by the deduction, up to the amount of income
            const effectiveDeduction = Math.min(income.amount, maxDeduction);
            netBusinessAndMiscIncome += income.amount - effectiveDeduction;
            blueFilerDeduction = effectiveDeduction;
            processedBusinessIncome = true;
        } else if (income.type === 'miscellaneous') {
            netBusinessAndMiscIncomeBeforeBlueFilerDeduction += income.amount;
            netBusinessAndMiscIncome += income.amount;
        }
    }

    const totalAnnualIncome = salaryIncome + bonusIncome.reduce((sum, b) => sum + b.amount, 0) + netBusinessAndMiscIncomeBeforeBlueFilerDeduction + stockCompensationIncome;

    return {
        salaryIncome,
        bonusIncome,
        netBusinessAndMiscIncomeBeforeBlueFilerDeduction,
        netBusinessAndMiscIncome,
        blueFilerDeduction,
        totalAnnualIncome,
        commutingAllowance,
        stockCompensationIncome
    };
};

/**
 * Calculates just the total net income.
 * This is lighter weight than the full tax calculation and used for dependent eligibility checks.
 */
export const calculateTotalNetIncome = (incomeStreams: IncomeStream[]): number => {
    const {
        salaryIncome,
        bonusIncome,
        netBusinessAndMiscIncome,
        commutingAllowance,
        stockCompensationIncome
    } = calculateIncomeBreakdown(incomeStreams);

    const taxableCommutingAllowance = Math.max(0, commutingAllowance - COMMUTING_ALLOWANCE_NONTAXABLE_ANNUAL_CAP);

    const grossEmploymentIncome = salaryIncome + taxableCommutingAllowance + bonusIncome.reduce((sum, b) => sum + b.amount, 0) + stockCompensationIncome;
    const netEmploymentIncome = calculateNetEmploymentIncome(grossEmploymentIncome);

    return netEmploymentIncome + netBusinessAndMiscIncome;
};

export const calculateTaxes = (inputs: TakeHomeInputs): TakeHomeResults => {
    const {
        salaryIncome,
        bonusIncome,
        netBusinessAndMiscIncome,
        blueFilerDeduction,
        totalAnnualIncome,
        commutingAllowance,
        stockCompensationIncome
    } = calculateIncomeBreakdown(inputs.incomeStreams);

    if (totalAnnualIncome <= 0) {
        return DEFAULT_TAKE_HOME_RESULTS;
    }

    // Use the calculated total annual income instead of inputs.annualIncome for consistency
    const annualIncome = totalAnnualIncome;

    // Determine if there is any employment income (salary, bonus, or taxable commuting allowance)
    const hasEmploymentIncome = salaryIncome > 0 || bonusIncome.some(b => b.amount > 0) || commutingAllowance > 0 || stockCompensationIncome > 0;

    const nonTaxableCommutingAllowance = Math.min(commutingAllowance, COMMUTING_ALLOWANCE_NONTAXABLE_ANNUAL_CAP);
    const taxableCommutingAllowance = Math.max(0, commutingAllowance - COMMUTING_ALLOWANCE_NONTAXABLE_ANNUAL_CAP);

    const grossEmploymentIncome = salaryIncome + taxableCommutingAllowance + bonusIncome.reduce((sum, b) => sum + b.amount, 0) + stockCompensationIncome;
    const netEmploymentIncome = calculateNetEmploymentIncome(grossEmploymentIncome);

    const netIncome = netEmploymentIncome + netBusinessAndMiscIncome;

    let healthInsurance = 0;
    let pensionPayments = 0;
    let employmentInsurance = 0;
    let socialInsuranceDeduction = 0;
    let nhiBreakdown = null;

    // Bonus breakdown variables
    let healthInsuranceOnBonus = 0;
    let pensionOnBonus = 0;
    let employmentInsuranceOnBonus = 0;

    if (inputs.manualSocialInsuranceEntry) {
        socialInsuranceDeduction = inputs.manualSocialInsuranceAmount;
    } else {
        // For health insurance calculation, we need to use the appropriate income:
        // - Employee health insurance: based on standard monthly remuneration
        // - National Health Insurance: based on net income

        if (inputs.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID) {
            const hiResult = calculateHealthInsuranceBreakdown(
                netIncome,
                inputs.isSubjectToLongTermCarePremium,
                inputs.healthInsuranceProvider,
                inputs.region
            );
            healthInsurance = hiResult.total;
            healthInsuranceOnBonus = hiResult.bonusPortion;

            // For NHI breakdown, also use net income
            nhiBreakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
                netIncome,
                inputs.isSubjectToLongTermCarePremium,
                inputs.region as string
            );
        } else { // Employee Health Insurance
            // For Employee Health Insurance, the premiums are based on standard monthly remuneration,
            // which INCLUDES the full commuting allowance (taxable + non-taxable).
            const hiResult = calculateHealthInsuranceBreakdown(
                salaryIncome + commutingAllowance,
                inputs.isSubjectToLongTermCarePremium,
                inputs.healthInsuranceProvider,
                inputs.region,
                inputs.healthInsuranceProvider === CUSTOM_PROVIDER_ID && inputs.customEHIRates ? {
                    healthRate: inputs.customEHIRates.healthInsuranceRate,
                    ltcRate: inputs.customEHIRates.longTermCareRate
                } : undefined,
                bonusIncome
            );
            healthInsurance = hiResult.total;
            healthInsuranceOnBonus = hiResult.bonusPortion;
        }

        // Calculate pension based on health insurance type
        // People on National Health Insurance are in National Pension system
        // People on employee health insurance are in Employee Pension system
        // People covered as dependents do not pay pension premiums
        const isInEmployeePensionSystem = inputs.healthInsuranceProvider !== NATIONAL_HEALTH_INSURANCE_ID && inputs.healthInsuranceProvider !== DEPENDENT_COVERAGE_ID;

        if (inputs.healthInsuranceProvider === DEPENDENT_COVERAGE_ID) {
            pensionPayments = 0;
        } else if (isInEmployeePensionSystem) {
            // Pension also includes full commuting allowance in SMR
            const pensionResult = calculatePensionBreakdown(isInEmployeePensionSystem, (salaryIncome + commutingAllowance) / 12, true, bonusIncome);
            pensionPayments = pensionResult.total;
            pensionOnBonus = pensionResult.bonusPortion;
        } else { // National Pension
            const pensionResult = calculatePensionBreakdown(isInEmployeePensionSystem);
            pensionPayments = pensionResult.total;
            pensionOnBonus = pensionResult.bonusPortion;
        }



        // Employment Insurance also includes full commuting allowance
        const eiResult = calculateEmploymentInsuranceBreakdown(salaryIncome + commutingAllowance, bonusIncome);
        employmentInsurance = eiResult.total;
        employmentInsuranceOnBonus = eiResult.bonusPortion;

        socialInsuranceDeduction = healthInsurance + pensionPayments + employmentInsurance;
    }

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
    const totalSocialsAndTax = nationalIncomeTax + residenceTax.totalResidenceTax + socialInsuranceDeduction;
    const takeHomeIncome = annualIncome - totalSocialsAndTax;

    const furusatoNozeiLimit = calculateFurusatoNozeiDetails(netIncome - socialInsuranceDeduction - idecoDeduction - nationalIncomeTaxBasicDeduction - dependentDeductions.nationalTax.total, residenceTax);

    return {
        annualIncome,
        hasEmploymentIncome,
        blueFilerDeduction,
        nationalIncomeTax,
        residenceTax,
        healthInsurance,
        pensionPayments,
        employmentInsurance,
        takeHomeIncome,
        socialInsuranceOverride: inputs.manualSocialInsuranceEntry ? inputs.manualSocialInsuranceAmount : undefined,
        // Commuting Allowance details
        commutingAllowanceIncome: commutingAllowance,
        commutingAllowanceTaxable: taxableCommutingAllowance,
        commutingAllowanceNonTaxable: nonTaxableCommutingAllowance,
        // Bonus breakdown
        healthInsuranceOnBonus,
        pensionOnBonus,
        employmentInsuranceOnBonus,
        netEmploymentIncome: hasEmploymentIncome ? netEmploymentIncome : undefined,
        totalNetIncome: netIncome,
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
        salaryIncome,
        healthInsuranceProvider: inputs.healthInsuranceProvider,
        region: inputs.region,
        isSubjectToLongTermCarePremium: inputs.isSubjectToLongTermCarePremium,
        customEHIRates: inputs.customEHIRates,
        // Dependent deductions (always include, even if zero)
        ...(inputs.dependents.length > 0 && {
            dependentDeductions: dependentDeductions
        }),
    };
}
