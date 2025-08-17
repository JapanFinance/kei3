import type { HealthInsuranceProviderId } from "./healthInsurance";
export interface TakeHomeInputs {
  annualIncome: number;
  isEmploymentIncome: boolean;
  isSubjectToLongTermCarePremium: boolean; // Person is 40-64 years old (must pay long-term care insurance premiums)
  region: string;
  showDetailedInput: boolean;
  healthInsuranceProvider: HealthInsuranceProviderId;
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
  employmentInsurance?: number | undefined;
  takeHomeIncome: number;
  // Added detailed properties
  netEmploymentIncome?: number | undefined;
  nationalIncomeTaxBasicDeduction?: number | undefined;
  taxableIncomeForNationalIncomeTax?: number | undefined;
  residenceTaxBasicDeduction?: number | undefined;
  taxableIncomeForResidenceTax?: number | undefined;
  furusatoNozei: FurusatoNozeiDetails;
  dcPlanContributions: number;
  // Income tax breakdown
  nationalIncomeTaxBase?: number | undefined;
  reconstructionSurtax?: number | undefined;
  // National Health Insurance breakdown (only for non-employment income)
  nhiMedicalPortion?: number | undefined;
  nhiElderlySupportPortion?: number | undefined;
  nhiLongTermCarePortion?: number | undefined;
  // Context needed for cap detection
  healthInsuranceProvider: HealthInsuranceProviderId;
  region: string;
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
