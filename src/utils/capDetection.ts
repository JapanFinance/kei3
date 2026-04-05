// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TakeHomeResults } from '../types/tax';
import { EMPLOYEES_PENSION_BRACKETS } from './pensionCalculator';
import { getNHIParamsForMonth } from '../data/nationalHealthInsurance/nhiParamsData';
import { generateHealthInsurancePremiumTable, generatePremiumTableFromRates } from '../data/employeesHealthInsurance/providerRates';
import { NATIONAL_HEALTH_INSURANCE_ID, CUSTOM_PROVIDER_ID } from '../types/healthInsurance';
import type { EmployeesHealthInsuranceBonusBreakdownItem } from './healthInsuranceCalculator';

export interface CapStatus {
  healthInsuranceCapped: boolean;
  pensionCapped: boolean;
  pensionFixed?: boolean;
  healthInsuranceBonusCapped?: boolean;
  healthInsuranceCapDetails?: {
    medicalCapped?: boolean;
    supportCapped?: boolean;
    ltcCapped?: boolean;
    childSupportCapped?: boolean;
  } | undefined;
}

/**
 * Determines if health insurance and pension contributions are capped for the given results.
 * All necessary context is now included in the results object.
 */
export function detectCaps(
  results: TakeHomeResults,
  healthInsuranceBonusBreakdown?: EmployeesHealthInsuranceBonusBreakdownItem[]
): CapStatus {
  // Use salary + commuter allowance for social insurance cap detection (Standard Monthly Remuneration basis)
  // instead of total annual income which might include business/misc income or bonuses.
  const monthlyRemuneration = (results.salaryIncome + (results.commutingAllowanceIncome ?? 0)) / 12;

  const isNationalPension = results.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID;
  // Check pension cap
  const pensionCapped = checkPensionCap(isNationalPension, monthlyRemuneration);
  // Check health insurance cap
  const healthInsuranceCapInfo = checkHealthInsuranceCap(results, monthlyRemuneration);

  // Check health insurance bonus cap
  let healthInsuranceBonusCapped = false;
  if (healthInsuranceBonusBreakdown && healthInsuranceBonusBreakdown.length > 0) {
    // If any bonus payment was capped (standard amount < rounded amount), then the cumulative cap was hit.
    healthInsuranceBonusCapped = healthInsuranceBonusBreakdown.some(item => {
      const roundedAmount = Math.floor(item.bonusAmount / 1000) * 1000;
      return item.standardBonusAmount < roundedAmount;
    });
  }

  return {
    healthInsuranceCapped: healthInsuranceCapInfo.capped,
    pensionCapped,
    pensionFixed: isNationalPension,
    healthInsuranceBonusCapped,
    healthInsuranceCapDetails: healthInsuranceCapInfo.details,
  };
}

/**
 * Checks if pension contributions are at the maximum
 */
function checkPensionCap(isNationalPension: boolean, monthlyRemuneration: number): boolean {
  if (isNationalPension) {
    // National pension is a fixed amount, so never "capped" based on income
    return false;
  }

  // For employee pension, check if we're in the highest bracket
  const lastBracket = EMPLOYEES_PENSION_BRACKETS[EMPLOYEES_PENSION_BRACKETS.length - 1];
  if (!lastBracket) {
    return false;
  }
  return monthlyRemuneration >= lastBracket.minIncomeInclusive && lastBracket.maxIncomeExclusive === Infinity;
}

/**
 * Checks if health insurance contributions are at the maximum
 * @param results - The results of the tax calculations
 * @param monthlyRemuneration - The monthly remuneration, as needed for EHI/EPI calculations
 * @returns An object containing the cap status and details
 */
function checkHealthInsuranceCap(results: TakeHomeResults, monthlyRemuneration: number): {
  capped: boolean;
  details?: {
    medicalCapped?: boolean;
    supportCapped?: boolean;
    ltcCapped?: boolean;
    childSupportCapped?: boolean;
  };
} {
  if (results.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID) {
    if (results.nhiMedicalPortion === undefined || results.nhiElderlySupportPortion === undefined) {
      // This shouldn't happen anymore since all context is in results
      console.warn('NHI component data missing in results:', {
        nhiMedicalPortion: results.nhiMedicalPortion,
        nhiElderlySupportPortion: results.nhiElderlySupportPortion,
        nhiLongTermCarePortion: results.nhiLongTermCarePortion,
      });
      return { capped: false };
    }

    // Look up rates for both fiscal years that overlap this calendar year.
    // A portion is truly "capped" (won't increase with more income) only when
    // it's at the cap in *both* fiscal years. If only one FY is capped, the
    // other FY's portion could still grow.
    const year = new Date().getFullYear();
    const prevFYParams = getNHIParamsForMonth(results.region, year, 0);  // Jan → previous FY
    const currFYParams = getNHIParamsForMonth(results.region, year, 3);  // Apr → current FY
    if (!currFYParams) {
      return { capped: false };
    }

    // Helper: check if a portion is capped in both FYs.
    // For portions that didn't exist in the previous FY (e.g., child support),
    // the prev FY contribution is always 0 and trivially "capped".
    const isCappedInBothFYs = (
      portionAmount: number,
      prevCap: number | undefined,
      currCap: number
    ): boolean => {
      if (!prevFYParams || prevFYParams === currFYParams) {
        // No blending — single FY, just compare against current cap
        return portionAmount === currCap;
      }
      // Blended: compute what the blended amount would be if both FYs are at their caps
      const prevCapValue = prevCap ?? 0; // undefined means portion didn't exist → 0
      const blendedCap = Math.round(prevCapValue * 3 / 10 + currCap * 7 / 10);
      return portionAmount >= blendedCap;
    };

    const medicalCapped = isCappedInBothFYs(
      results.nhiMedicalPortion, prevFYParams?.medicalCap, currFYParams.medicalCap
    );
    const supportCapped = isCappedInBothFYs(
      results.nhiElderlySupportPortion, prevFYParams?.supportCap, currFYParams.supportCap
    );

    let ltcCapped = false;
    if (results.nhiLongTermCarePortion !== undefined &&
      results.isSubjectToLongTermCarePremium &&
      currFYParams.ltcCapForEligible) {
      ltcCapped = isCappedInBothFYs(
        results.nhiLongTermCarePortion, prevFYParams?.ltcCapForEligible, currFYParams.ltcCapForEligible
      );
    }

    let childSupportCapped = false;
    if (results.nhiChildSupportPortion !== undefined &&
      currFYParams.childSupportCap) {
      childSupportCapped = isCappedInBothFYs(
        results.nhiChildSupportPortion, prevFYParams?.childSupportCap, currFYParams.childSupportCap
      );
    }

    const anyCapped = medicalCapped || supportCapped || ltcCapped || childSupportCapped;

    return {
      capped: anyCapped,
      details: {
        medicalCapped,
        supportCapped,
        ltcCapped,
        childSupportCapped,
      },
    };
  } else {
    // Employee Health Insurance - check if in highest bracket
    if (!results.healthInsuranceProvider) {
      return { capped: false };
    }

    let premiumTable;
    if (results.healthInsuranceProvider === CUSTOM_PROVIDER_ID) {
      if (!results.customEHIRates) {
        return { capped: false };
      }
      const customRates = {
        employeeHealthInsuranceRate: results.customEHIRates.healthInsuranceRate / 100,
        employeeLongTermCareRate: results.customEHIRates.longTermCareRate / 100,
        employerHealthInsuranceRate: 0,
        employerLongTermCareRate: 0
      };
      premiumTable = generatePremiumTableFromRates(customRates);
    } else {
      premiumTable = generateHealthInsurancePremiumTable(results.healthInsuranceProvider, results.region);
    }

    if (!premiumTable || premiumTable.length === 0) {
      return { capped: false };
    }

    const lastBracket = premiumTable[premiumTable.length - 1];
    if (!lastBracket) {
      return { capped: false };
    }
    const capped = monthlyRemuneration >= lastBracket.minIncomeInclusive && lastBracket.maxIncomeExclusive === Infinity;

    return { capped };
  }
}
