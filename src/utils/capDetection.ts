import type { TakeHomeResults } from '../types/tax';
import { EMPLOYEES_PENSION_PREMIUM } from './pensionCalculator';
import { getNationalHealthInsuranceParams } from '../data/nationalHealthInsurance/nhiParamsData';
import { generateHealthInsurancePremiumTable } from '../data/employeesHealthInsurance/providerRates';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';

export interface CapStatus {
  healthInsuranceCapped: boolean;
  pensionCapped: boolean;
  pensionFixed?: boolean;
  healthInsuranceCapDetails?: {
    medicalCapped?: boolean;
    supportCapped?: boolean;
    ltcCapped?: boolean;
  } | undefined;
}

/**
 * Determines if health insurance and pension contributions are capped for the given results.
 * All necessary context is now included in the results object.
 */
export function detectCaps(results: TakeHomeResults): CapStatus {
  const monthlyIncome = results.annualIncome / 12;

  const isNationalPension = results.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID;
  // Check pension cap
  const pensionCapped = checkPensionCap(!isNationalPension, monthlyIncome);
  // Check health insurance cap
  const healthInsuranceCapInfo = checkHealthInsuranceCap(results);

  return {
    healthInsuranceCapped: healthInsuranceCapInfo.capped,
    pensionCapped,
    pensionFixed: isNationalPension,
    healthInsuranceCapDetails: healthInsuranceCapInfo.details,
  };
}

/**
 * Checks if pension contributions are at the maximum
 */
function checkPensionCap(isEmployeesPension: boolean, monthlyIncome: number): boolean {
  if (!isEmployeesPension) {
    // National pension is a fixed amount, so never "capped" based on income
    return false;
  }
  
  // For employee pension, check if we're in the highest bracket
  const lastBracket = EMPLOYEES_PENSION_PREMIUM[EMPLOYEES_PENSION_PREMIUM.length - 1];
  if (!lastBracket) {
    return false;
  }
  return monthlyIncome >= lastBracket.min && lastBracket.max === null;
}

/**
 * Checks if health insurance contributions are at the maximum
 */
function checkHealthInsuranceCap(results: TakeHomeResults): {
  capped: boolean;
  details?: {
    medicalCapped?: boolean;
    supportCapped?: boolean;
    ltcCapped?: boolean;
  };
} {
  const monthlyIncome = results.annualIncome / 12;
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
    
    // Use the pre-calculated results to check against caps
    const nhiParams = getNationalHealthInsuranceParams(results.prefecture);
    if (!nhiParams) {
      return { capped: false };
    }

    const medicalCapped = results.nhiMedicalPortion === nhiParams.medicalCap;
    const supportCapped = results.nhiElderlySupportPortion === nhiParams.supportCap;

    let ltcCapped = false;
    if (results.nhiLongTermCarePortion !== undefined &&
        results.isSubjectToLongTermCarePremium &&
        nhiParams.ltcCapForEligible) {
      ltcCapped = results.nhiLongTermCarePortion === nhiParams.ltcCapForEligible;
    }
    
    const anyCapped = medicalCapped || supportCapped || ltcCapped;
    
    return {
      capped: anyCapped,
      details: {
        medicalCapped,
        supportCapped,
        ltcCapped,
      },
    };
  } else {
    // Employee Health Insurance - check if in highest bracket
    if (!results.healthInsuranceProvider) {
      return { capped: false };
    }
    const premiumTable = generateHealthInsurancePremiumTable(results.healthInsuranceProvider, results.prefecture);
    if (!premiumTable || premiumTable.length === 0) {
      return { capped: false };
    }
    
    const lastBracket = premiumTable[premiumTable.length - 1];
    if (!lastBracket) {
      return { capped: false };
    }
    const capped = monthlyIncome >= lastBracket.minIncomeInclusive && lastBracket.maxIncomeExclusive === Infinity;
    
    return { capped };
  }
}
