import type { TakeHomeInputs } from '../types/tax';
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
 * Determines if health insurance and pension contributions are capped for the given inputs
 */
export function detectCaps(inputs: TakeHomeInputs): CapStatus {
  const monthlyIncome = inputs.annualIncome / 12;
  
  // Check pension cap
  const pensionCapped = checkPensionCap(inputs.isEmploymentIncome, monthlyIncome);
  
  // Check health insurance cap
  const healthInsuranceCapInfo = checkHealthInsuranceCap(inputs);
  
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
function checkHealthInsuranceCap(inputs: TakeHomeInputs): {
  capped: boolean;
  details?: {
    medicalCapped?: boolean;
    supportCapped?: boolean;
    ltcCapped?: boolean;
  };
} {
  const monthlyIncome = inputs.annualIncome / 12;
  
  if (inputs.healthInsuranceProvider.id === HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE.id) {
    // National Health Insurance - check individual component caps
    const nhiParams = getNationalHealthInsuranceParams(inputs.prefecture as string);
    if (!nhiParams) {
      return { capped: false };
    }
    
    const nhiTaxableIncome = Math.max(0, inputs.annualIncome - nhiParams.nhiStandardDeduction);
    
    // Check each component for capping
    const medicalIncomeBasedPortion = nhiTaxableIncome * nhiParams.medicalRate;
    const medicalUncapped = medicalIncomeBasedPortion + nhiParams.medicalPerCapita;
    const medicalCapped = medicalUncapped > nhiParams.medicalCap;
    
    const supportIncomeBasedPortion = nhiTaxableIncome * nhiParams.supportRate;
    const supportUncapped = supportIncomeBasedPortion + nhiParams.supportPerCapita;
    const supportCapped = supportUncapped > nhiParams.supportCap;
    
    let ltcCapped = false;
    if (inputs.isSubjectToLongTermCarePremium && nhiParams.ltcRateForEligible && 
        nhiParams.ltcPerCapitaForEligible && nhiParams.ltcCapForEligible) {
      const ltcIncomeBasedPortion = nhiTaxableIncome * nhiParams.ltcRateForEligible;
      const ltcUncapped = ltcIncomeBasedPortion + nhiParams.ltcPerCapitaForEligible;
      ltcCapped = ltcUncapped > nhiParams.ltcCapForEligible;
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
    const premiumTable = getHealthInsurancePremiumTable(inputs.healthInsuranceProvider.id, inputs.prefecture);
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
