// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { HealthInsuranceProviderId } from "./healthInsurance";
import type { Dependent, DependentDeductionResults } from "./dependents";

export type IncomeMode = 'salary' | 'miscellaneous' | 'advanced';

export type IncomeStreamType = 'salary' | 'bonus' | 'business' | 'miscellaneous' | 'commutingAllowance' | 'stockCompensation';

export interface BaseIncomeStream {
  id: string;
  type: IncomeStreamType;
  amount: number;
}

export interface SalaryIncomeStream extends BaseIncomeStream {
  type: 'salary';
  frequency: 'monthly' | 'annual';
}

export interface CommutingAllowanceIncomeStream extends BaseIncomeStream {
  type: 'commutingAllowance';
  frequency: 'monthly' | '3-months' | '6-months' | 'annual';
}

export interface BonusIncomeStream extends BaseIncomeStream {
  type: 'bonus';
  month: number; // 0-11 for Jan-Dec
}

export interface BusinessIncomeStream extends BaseIncomeStream {
  type: 'business';
  blueFilerDeduction?: number; // 0, 100000, 550000, or 650000
}

export interface MiscellaneousIncomeStream extends BaseIncomeStream {
  type: 'miscellaneous';
}

export interface StockCompensationIncomeStream extends BaseIncomeStream {
  type: 'stockCompensation';
  issuerDomicile: 'foreign' | 'domestic';
}

export type IncomeStream = SalaryIncomeStream | BonusIncomeStream | BusinessIncomeStream | MiscellaneousIncomeStream | CommutingAllowanceIncomeStream | StockCompensationIncomeStream;

/**
 * User input for the home loan tax credit (住宅ローン控除).
 *
 * The user supplies the calculated credit amount directly (the 控除可能額 — see
 * `creditAmount` below). The only other thing we need is the move-in year, which
 * determines the residence-tax spillover cap and the income-eligibility limit.
 */
export interface HomeLoanTaxCreditInput {
  /**
   * Calendar year the user first moved into the residence. Drives the cohort
   * lookup for the residence-tax spillover cap and the income-eligibility limit.
   */
  moveInYear: number;
  /**
   * The full calculated annual credit (住宅借入金等特別控除可能額) in yen — i.e.
   * year-end loan balance × the credit rate, up to the home's qualifying maximum.
   * This is the 控除可能額 (E2 on the 源泉徴収票), NOT the already-applied amount
   * (E1 / 住宅借入金等特別控除の額), which is capped at the prior year's income tax.
   */
  creditAmount: number;
}

/** Computed application of the home loan tax credit. */
export interface HomeLoanTaxCreditResult {
  /** Pre-spillover total credit for the year (yen). */
  annualCredit: number;
  /** Portion applied against national income tax. */
  appliedToIncomeTax: number;
  /** Portion that spilled over and was applied against residence tax. */
  appliedToResidenceTax: number;
  /** Credit that could not be applied because of caps (informational). */
  unusedCredit: number;
  /** Human-readable warnings: out-of-period, income exceeds limit, etc. */
  warnings: ReadonlyArray<string>;
}

/** Interface for the UI Form State */
export interface TakeHomeFormState {
  annualIncome: number;
  incomeMode: IncomeMode;
  incomeStreams: IncomeStream[];
  isSubjectToLongTermCarePremium: boolean;
  region: string;
  healthInsuranceProvider: HealthInsuranceProviderId;
  dependents: Dependent[];
  dcPlanContributions: number;
  manualSocialInsuranceEntry: boolean;
  manualSocialInsuranceAmount: number;
  customEHIRates?: CustomEmployeesHealthInsuranceRates | undefined;
  savedIncomeStreams?: IncomeStream[];
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
}

/** Interface for Calculation Logic (clean, normalized inputs) */
export interface TakeHomeInputs {
  incomeStreams: IncomeStream[];
  isSubjectToLongTermCarePremium: boolean;
  region: string;
  healthInsuranceProvider: HealthInsuranceProviderId;
  dependents: Dependent[];
  dcPlanContributions: number;
  manualSocialInsuranceEntry: boolean;
  manualSocialInsuranceAmount: number;
  customEHIRates?: CustomEmployeesHealthInsuranceRates | undefined;
  incomeYear?: number;
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
}

export interface CustomEmployeesHealthInsuranceRates {
  healthInsuranceRate: number;
  longTermCareRate: number;
}

export interface TakeHomeResults {
  annualIncome: number;
  hasEmploymentIncome: boolean;
  blueFilerDeduction?: number;
  nationalIncomeTax: number;
  residenceTax: ResidenceTaxDetails;
  healthInsurance: number;
  pensionPayments: number;
  employmentInsurance?: number | undefined;
  takeHomeIncome: number;
  socialInsuranceOverride?: number | undefined;
  // Bonus breakdown
  healthInsuranceOnBonus?: number;
  pensionOnBonus?: number;
  employmentInsuranceOnBonus?: number;
  // Added detailed properties
  netEmploymentIncome?: number | undefined;
  totalNetIncome: number;
  commutingAllowanceIncome?: number; // Total amount
  commutingAllowanceTaxable?: number;
  commutingAllowanceNonTaxable?: number;
  nationalIncomeTaxBasicDeduction?: number | undefined;
  taxableIncomeForNationalIncomeTax?: number | undefined;
  residenceTaxBasicDeduction?: number | undefined;
  taxableIncomeForResidenceTax?: number | undefined;
  furusatoNozei: FurusatoNozeiDetails;
  homeLoanTaxCredit?: HomeLoanTaxCreditResult;
  /** Residence income-based portion (所得割) before the home loan credit spillover, for display. */
  residenceTaxIncomeBasedBeforeHomeLoanCredit?: number | undefined;
  dcPlanContributions: number;
  // Dependent deductions
  dependentDeductions?: DependentDeductionResults;
  // Income tax breakdown
  nationalIncomeTaxBase?: number | undefined;
  reconstructionSurtax?: number | undefined;
  // National Health Insurance breakdown (only for non-employment income)
  nhiMedicalPortion?: number | undefined;
  nhiElderlySupportPortion?: number | undefined;
  nhiLongTermCarePortion?: number | undefined;
  nhiChildSupportPortion?: number | undefined;
  // Context needed for cap detection
  salaryIncome: number; // Regular salary income (monthly * 12 or annual amount) excluding bonuses
  healthInsuranceProvider: HealthInsuranceProviderId;
  region: string;
  isSubjectToLongTermCarePremium: boolean;
  // Custom provider rates (percentages, e.g. 5.0 for 5%)
  customEHIRates?: CustomEmployeesHealthInsuranceRates | undefined;
}

export interface ResidenceTaxDetails {
  taxableIncome: number; // 市町村民税の課税標準額
  cityProportion: number;
  prefecturalProportion: number;
  residenceTaxRate: number;
  basicDeduction: number;
  personalDeductionDifference: number; // 人的控除額の差 - difference between national and residence tax personal deductions
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
