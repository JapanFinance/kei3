import type { HealthInsuranceProviderType } from "./healthInsurance";
export interface TakeHomeInputs {
  annualIncome: number;
  isEmploymentIncome: boolean;
  isSubjectToLongTermCarePremium: boolean; // Person is 40-64 years old (must pay long-term care insurance premiums)
  prefecture: string;
  showDetailedInput: boolean;
  healthInsuranceProvider: HealthInsuranceProviderType;
  numberOfDependents: number;
  dcPlanContributions: number;
}

export interface TakeHomeResults {
  annualIncome: number;
  isEmploymentIncome: boolean;
  nationalIncomeTax: number;
  residenceTax: ResidenceTaxDetails;
  healthInsurance: number;
  pensionPayments: number;
  employmentInsurance?: number;
  takeHomeIncome: number;
  // Added detailed properties
  netEmploymentIncome?: number;
  nationalIncomeTaxBasicDeduction?: number;
  taxableIncomeForNationalIncomeTax?: number;
  residenceTaxBasicDeduction?: number;
  taxableIncomeForResidenceTax?: number;
  furusatoNozei: FurusatoNozeiDetails;
  dcPlanContributions: number;
  // Income tax breakdown
  nationalIncomeTaxBase?: number;
  reconstructionSurtax?: number;
  // National Health Insurance breakdown (only for non-employment income)
  nhiMedicalPortion?: number;
  nhiElderlySupportPortion?: number;
  nhiLongTermCarePortion?: number;
  // Context needed for cap detection
  healthInsuranceProvider: HealthInsuranceProviderType;
  prefecture: string;
  isSubjectToLongTermCarePremium: boolean;
}

export interface ResidenceTaxDetails {
  taxableIncome: number; // 市町村民税の課税標準額
  cityProportion: number;
  prefecturalProportion: number;
  residenceTaxRate: number;
  basicDeduction: number;
  city: {
    cityTaxableIncome: number;
    cityAdjustmentCredit: number;
    cityIncomeTax: number;
    cityPerCapitaTax: number;
  }
  prefecture: {
    prefecturalTaxableIncome: number;
    prefecturalAdjustmentCredit: number;
    prefecturalIncomeTax: number;
    prefecturalPerCapitaTax: number;
  }
  perCapitaTax: number;
  forestEnvironmentTax: number; // 森林環境税
  totalResidenceTax: number;
}

export interface FurusatoNozeiDetails {
  limit: number;
  incomeTaxReduction: number;
  residenceTaxDonationBasicDeduction: number;
  residenceTaxSpecialDeduction: number;
  outOfPocketCost: number;
  residenceTaxReduction: number;
}

export interface ChartRange {
  min: number;
  max: number;
}
