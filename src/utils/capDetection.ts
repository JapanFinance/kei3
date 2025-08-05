import type { TakeHomeResults } from '../types/tax';
import { HealthInsuranceProvider } from '../types/healthInsurance';
import { EMPLOYEES_PENSION_PREMIUM } from './pensionCalculator';
import { getNationalHealthInsuranceParams } from '../data/nationalHealthInsurance';
import { getHealthInsurancePremiumTable } from '../data/employeesHealthInsurance';

export interface CapStatus {
  healthInsuranceCapped: boolean;
  pensionCapped: boolean;
  pensionFixed?: boolean;
  healthInsuranceCapDetails?: {
    medicalCapped?: boolean;
    supportCapped?: boolean;
    ltcCapped?: boolean;
  };
}

/**
 * Determines if health insurance and pension contributions are capped for the given results.
 * All necessary context is now included in the results object.
 */
export function detectCaps(results: TakeHomeResults): CapStatus {
  const monthlyIncome = results.annualIncome / 12;

  const isNationalPension = results.healthInsuranceProvider.id === HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE.id;
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
  
  if (results.healthInsuranceProvider.id === HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE.id) {
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
    const premiumTable = getHealthInsurancePremiumTable(results.healthInsuranceProvider.id, results.prefecture);
    if (!premiumTable || premiumTable.length === 0) {
      return { capped: false };
    }
    
    const lastBracket = premiumTable[premiumTable.length - 1];
    const capped = monthlyIncome >= lastBracket.minIncomeInclusive && lastBracket.maxIncomeExclusive === Infinity;
    
    return { capped };
  }
}
