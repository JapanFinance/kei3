import type { TakeHomeResults } from '../types/tax';
import { HealthInsuranceProvider } from '../types/healthInsurance';
import { EMPLOYEES_PENSION_PREMIUM } from './pensionCalculator';
import { getNationalHealthInsuranceParams } from '../data/nationalHealthInsurance';
import { getHealthInsurancePremiumTable } from '../data/employeesHealthInsurance';

export interface CapStatus {
  healthInsuranceCapped: boolean;
  pensionCapped: boolean;
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
  
  // Check pension cap
  const pensionCapped = checkPensionCap(results.isEmploymentIncome, monthlyIncome);
  
  // Check health insurance cap
  const healthInsuranceCapInfo = checkHealthInsuranceCap(results);
  
  return {
    healthInsuranceCapped: healthInsuranceCapInfo.capped,
    pensionCapped,
    healthInsuranceCapDetails: healthInsuranceCapInfo.details,
  };
}

/**
 * Checks if pension contributions are at the maximum
 */
function checkPensionCap(isEmploymentIncome: boolean, monthlyIncome: number): boolean {
  if (!isEmploymentIncome) {
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
    // National Health Insurance - use pre-calculated values from results
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
    
    // Check if each component hit its cap by comparing actual vs theoretical uncapped amount
    const incomeForNHICalculation = results.isEmploymentIncome && results.netEmploymentIncome 
      ? results.netEmploymentIncome 
      : results.annualIncome;
    const nhiTaxableIncome = Math.max(0, incomeForNHICalculation - nhiParams.nhiStandardDeduction);
    
    // Medical portion cap check
    const medicalIncomeBasedPortion = nhiTaxableIncome * nhiParams.medicalRate;
    const medicalUncapped = medicalIncomeBasedPortion + nhiParams.medicalPerCapita;
    const medicalCapped = medicalUncapped > nhiParams.medicalCap &&
                         Math.abs(results.nhiMedicalPortion - nhiParams.medicalCap) < 1; // Allow for rounding
    
    // Support portion cap check
    const supportIncomeBasedPortion = nhiTaxableIncome * nhiParams.supportRate;
    const supportUncapped = supportIncomeBasedPortion + nhiParams.supportPerCapita;
    const supportCapped = supportUncapped > nhiParams.supportCap &&
                          Math.abs(results.nhiElderlySupportPortion - nhiParams.supportCap) < 1; // Allow for rounding
    
    // LTC portion cap check
    let ltcCapped = false;
    if (results.nhiLongTermCarePortion !== undefined && 
        results.isSubjectToLongTermCarePremium && 
        nhiParams.ltcRateForEligible && 
        nhiParams.ltcPerCapitaForEligible && 
        nhiParams.ltcCapForEligible) {
      const ltcIncomeBasedPortion = nhiTaxableIncome * nhiParams.ltcRateForEligible;
      const ltcUncapped = ltcIncomeBasedPortion + nhiParams.ltcPerCapitaForEligible;
      ltcCapped = ltcUncapped > nhiParams.ltcCapForEligible &&
                 Math.abs(results.nhiLongTermCarePortion - nhiParams.ltcCapForEligible) < 1; // Allow for rounding
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

/**
 * Gets a human-readable description of the cap status
 */
export function getCapDescription(capStatus: CapStatus): string {
  const cappedItems: string[] = [];
  
  if (capStatus.pensionCapped) {
    cappedItems.push('Pension');
  }
  
  if (capStatus.healthInsuranceCapped) {
    if (capStatus.healthInsuranceCapDetails) {
      const details = capStatus.healthInsuranceCapDetails;
      const cappedComponents: string[] = [];
      
      if (details.medicalCapped) cappedComponents.push('Medical');
      if (details.supportCapped) cappedComponents.push('Elderly Support');
      if (details.ltcCapped) cappedComponents.push('Long-Term Care');
      
      if (cappedComponents.length > 0) {
        cappedItems.push(`Health Insurance (${cappedComponents.join(', ')})`);
      } else {
        cappedItems.push('Health Insurance');
      }
    } else {
      cappedItems.push('Health Insurance');
    }
  }
  
  if (cappedItems.length === 0) {
    return '';
  }
  
  return `Contribution caps applied: ${cappedItems.join(' and ')}`;
}
