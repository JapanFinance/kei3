// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ProviderRegion, NationalHealthInsuranceRegionParams, HealthInsuranceProviderId } from '../types/healthInsurance';
import type { BonusIncomeStream } from '../types/tax';
import { getNationalHealthInsuranceParams } from '../data/nationalHealthInsurance/nhiParamsData';
import { DEFAULT_PROVIDER_REGION, NATIONAL_HEALTH_INSURANCE_ID, DEPENDENT_COVERAGE_ID, CUSTOM_PROVIDER_ID } from '../types/healthInsurance';
import { findSMRBracket } from '../data/employeesHealthInsurance/smrBrackets';
import { calculateMonthlyEmployeePremium, getRegionalRates } from '../data/employeesHealthInsurance/providerRates';

/**
 * Breakdown of National Health Insurance premium components
 */
export interface NationalHealthInsuranceBreakdown {
    medicalPortion: number;
    elderlySupportPortion: number;
    longTermCarePortion: number;
    total: number;
}

/**
 * Breakdown of Health Insurance premium components
 */
export interface HealthInsuranceBreakdown {
    total: number;
    bonusPortion: number;
}

/**
 * Calculates the annual health insurance premium breakdown.
 */
export function calculateHealthInsuranceBreakdown(
    annualIncome: number,
    isSubjectToLongTermCarePremium: boolean,
    provider: HealthInsuranceProviderId,
    region: ProviderRegion = DEFAULT_PROVIDER_REGION,
    customRates?: { healthRate: number, ltcRate: number },
    bonuses: BonusIncomeStream[] = []
): HealthInsuranceBreakdown {
    if (annualIncome < 0) {
        throw new Error('Income cannot be negative.');
    }

    // Dependent coverage has no premium
    if (provider === DEPENDENT_COVERAGE_ID) {
        return { total: 0, bonusPortion: 0 };
    }

    if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
        // For NHI, bonuses are part of the total net income.
        const total = calculateNationalHealthInsurancePremiumWithBreakdown(annualIncome, isSubjectToLongTermCarePremium, region).total;
        return { total, bonusPortion: 0 };
    } else {
        const monthlyIncome = annualIncome / 12;

        // Find the SMR bracket for this income
        const smrBracket = findSMRBracket(monthlyIncome);
        if (!smrBracket) {
            throw new Error(`Monthly income ${monthlyIncome.toLocaleString()} is outside the defined SMR ranges.`);
        }

        let regionalRates;

        if (provider === CUSTOM_PROVIDER_ID) {
            if (!customRates) {
                // Fallback if custom rates are missing but provider is custom
                return { total: 0, bonusPortion: 0 };
            }
            regionalRates = {
                employeeHealthInsuranceRate: customRates.healthRate / 100,
                employeeLongTermCareRate: customRates.ltcRate / 100,
                // Employer rates not needed for employee premium calculation
                employerHealthInsuranceRate: 0,
                employerLongTermCareRate: 0
            };
        } else {
            // Get the regional rates directly
            regionalRates = getRegionalRates(provider, region);
        }

        if (!regionalRates) {
            console.error(`Regional rates not found for provider ${provider} and region ${region}. Returning 0 premium.`);
            return { total: 0, bonusPortion: 0 };
        }

        // Calculate monthly premium and multiply by 12
        const monthlyPremium = calculateMonthlyEmployeePremium(
            smrBracket.smrAmount,
            regionalRates,
            isSubjectToLongTermCarePremium
        );

        let totalPremium = monthlyPremium * 12;
        let bonusPortion = 0;

        if (bonuses.some(b => b.amount > 0)) {
            const bonusDetails = calculateEmployeesHealthInsuranceBonusBreakdown(
                bonuses,
                regionalRates,
                isSubjectToLongTermCarePremium
            );

            bonusPortion = bonusDetails.reduce((sum, item) => sum + item.healthInsurancePremium + item.longTermCarePremium, 0);
            totalPremium += bonusPortion;
        }

        return { total: totalPremium, bonusPortion };
    }
}

/**
 * Breakdown of a single bonus payment's employeehealth insurance premium
 */
export interface EmployeesHealthInsuranceBonusBreakdownItem {
    month: number;
    bonusAmount: number;
    standardBonusAmount: number; // The rounded down, potentially capped amount
    /** Annual cumulative standard bonus amount */
    cumulativeStandardBonus: number;
    healthInsurancePremium: number;
    longTermCarePremium: number;
}

/**
 * The cumulative maximum amount of bonus income that is subject to health insurance premiums in a year (April to March).
 * Source: https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20141203.html
 */
const ANNUAL_CUMULATIVE_STANDARD_BONUS_AMOUNT_CAP = 5_730_000;

/**
 * Calculates detailed breakdown for health insurance bonuses
 */
export function calculateEmployeesHealthInsuranceBonusBreakdown(
    bonuses: BonusIncomeStream[],
    regionalRates: { employeeHealthInsuranceRate: number, employeeLongTermCareRate: number },
    isSubjectToLongTermCarePremium: boolean
): EmployeesHealthInsuranceBonusBreakdownItem[] {
    // Sort bonuses by month to apply cumulative cap correctly
    const sortedBonuses = [...bonuses].sort((a, b) => a.month - b.month);

    const breakdown: EmployeesHealthInsuranceBonusBreakdownItem[] = [];
    let cumulativeStandardBonus = 0;

    for (const bonus of sortedBonuses) {
        const roundedBonus = Math.floor(bonus.amount / 1000) * 1000;

        // Calculate how much room is left in the cap
        const remainingCap = Math.max(0, ANNUAL_CUMULATIVE_STANDARD_BONUS_AMOUNT_CAP - cumulativeStandardBonus);

        // The standard bonus amount for this payment is the rounded amount,
        // limited by the remaining cap space.
        const standardBonusAmount = Math.min(roundedBonus, remainingCap);

        cumulativeStandardBonus += standardBonusAmount;

        const healthInsurancePremium = standardBonusAmount * regionalRates.employeeHealthInsuranceRate;
        const longTermCarePremium = isSubjectToLongTermCarePremium
            ? standardBonusAmount * regionalRates.employeeLongTermCareRate
            : 0;

        breakdown.push({
            month: bonus.month,
            bonusAmount: bonus.amount,
            standardBonusAmount,
            cumulativeStandardBonus,
            healthInsurancePremium: Math.round(healthInsurancePremium),
            longTermCarePremium: Math.round(longTermCarePremium)
        });
    }

    return breakdown;
}

/**
 * Calculates the annual health insurance premium.
 *
 * @param annualIncome total annual income (gross for employees health insurance, net for NHI)
 * @param isSubjectToLongTermCarePremium True if the person is required to pay long-term care insurance
 * premiums as a Category 2 insured (介護保険第２号被保険者). This applies to people aged 40-64.
 * @param provider The health insurance provider.
 * @param region The region for the provider.
 * @param customRates Custom rates if provider is custom.
 * @param bonuses List of bonus payments.
 * @returns The annual health insurance premium.
 */
export function calculateHealthInsurancePremium(
    annualIncome: number,
    isSubjectToLongTermCarePremium: boolean,
    provider: HealthInsuranceProviderId,
    region: ProviderRegion = DEFAULT_PROVIDER_REGION,
    customRates?: { healthRate: number, ltcRate: number },
    bonuses: BonusIncomeStream[] = []
): number {
    return calculateHealthInsuranceBreakdown(
        annualIncome,
        isSubjectToLongTermCarePremium,
        provider,
        region,
        customRates,
        bonuses
    ).total;
}

/**
 * Calculates National Health Insurance premium breakdown based on regional parameters.
 */
function calculateNationalHealthInsurancePremiumBreakdown(
    annualIncome: number,
    isSubjectToLongTermCarePremium: boolean, // Person is 40-64 years old
    params: NationalHealthInsuranceRegionParams
): NationalHealthInsuranceBreakdown {
    // Calculate NHI taxable income (住民税算定基礎額等 - often previous year's income minus a standard deduction)
    // For simplicity, using current annual income minus the NHI standard deduction.
    // Real-world calculations might use prior year's certified income.
    const nhiTaxableIncome = Math.max(0, annualIncome - params.nhiStandardDeduction);

    // 1. Medical Portion (医療分)
    const incomeBasedMedical = nhiTaxableIncome * params.medicalRate;
    const perCapitaMedical = params.medicalPerCapita;
    const householdFlatMedical = params.medicalHouseholdFlat || 0;
    const totalMedicalPremium = Math.min(incomeBasedMedical + perCapitaMedical + householdFlatMedical, params.medicalCap);

    // 2. Elderly Support Portion (後期高齢者支援金分)
    const incomeBasedSupport = nhiTaxableIncome * params.supportRate;
    const perCapitaSupport = params.supportPerCapita;
    const householdFlatSupport = params.supportHouseholdFlat || 0;
    const totalSupportPremium = Math.min(incomeBasedSupport + perCapitaSupport + householdFlatSupport, params.supportCap);

    // 3. Long-Term Care Portion (介護納付金分) - only for those aged 40-64
    let totalLtcPremium = 0;
    if (isSubjectToLongTermCarePremium && params.ltcRateForEligible && params.ltcPerCapitaForEligible && params.ltcCapForEligible) {
        const incomeBasedLtc = nhiTaxableIncome * params.ltcRateForEligible;
        const perCapitaLtc = params.ltcPerCapitaForEligible;
        const householdFlatLtc = params.ltcHouseholdFlatForEligible || 0;
        totalLtcPremium = Math.min(incomeBasedLtc + perCapitaLtc + householdFlatLtc, params.ltcCapForEligible);
    }

    const totalPremium = totalMedicalPremium + totalSupportPremium + totalLtcPremium;

    return {
        medicalPortion: Math.round(totalMedicalPremium),
        elderlySupportPortion: Math.round(totalSupportPremium),
        longTermCarePortion: Math.round(totalLtcPremium),
        total: Math.round(totalPremium)
    };
}

/**
 * Calculates National Health Insurance premium with breakdown.
 * @param annualIncome The annual income to base the premium on.
 * @param isSubjectToLongTermCarePremium Whether the person is required to pay long-term care insurance premiums (age 40-64).
 * @param region Optional region key (municipality identifier). Defaults to Tokyo.
 * @returns Object containing breakdown of Medical, Elderly Support, and LTC portions plus total.
 */
export function calculateNationalHealthInsurancePremiumWithBreakdown(
    annualIncome: number,
    isSubjectToLongTermCarePremium: boolean,
    region?: string
): NationalHealthInsuranceBreakdown {
    const params = getNationalHealthInsuranceParams(region as string);
    if (!params) {
        console.error(`National Health Insurance parameters not found for region: ${region}. Returning zero breakdown.`);
        return { medicalPortion: 0, elderlySupportPortion: 0, longTermCarePortion: 0, total: 0 };
    }
    return calculateNationalHealthInsurancePremiumBreakdown(annualIncome, isSubjectToLongTermCarePremium, params);
}
