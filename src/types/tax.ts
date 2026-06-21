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
  /**
   * The credit available to apply this year (yen). Sum of {@link appliedToIncomeTax},
   * {@link appliedToResidenceTax}, and {@link unusedCredit}. Zero when the taxpayer is
   * ineligible (income over the cohort limit, or an unsupported move-in year), so it may
   * be less than the entered 控除可能額 in that case.
   */
  availableCredit: number;
  /** Portion applied against national income tax. */
  appliedToIncomeTax: number;
  /** Portion that spilled over and was applied against residence tax. */
  appliedToResidenceTax: number;
  /** Credit that could not be applied because of caps (informational). */
  unusedCredit: number;
  /**
   * The residence-tax spillover ceiling for the year, exposed so the UI can explain
   * why a credit may not be fully usable: the credit can reduce residence tax
   * by at most `applied` = min(flatCap 定額限度, incomeRateCap 定率限度).
   */
  residenceTaxSpilloverCap?: {
    /** The binding cap actually used: min(flatCap, incomeRateCap). */
    applied: number;
    /** 定額限度 — the cohort flat cap (¥97,500 or ¥136,500). */
    flatCap: number;
    /** 定率限度 — floor(課税総所得金額等 × cohort rate). */
    incomeRateCap: number;
  };
  /** Human-readable warnings: out-of-period, income exceeds limit, etc. */
  warnings: ReadonlyArray<string>;
}

/**
 * The most recent income (tax) year the calculator has data and rules for, and the
 * default written into form state.
 *
 * Pinned deliberately rather than derived from `new Date().getFullYear()`: Japanese
 * tax-year changes are frequently not finalized until ~April of that year, and the
 * data tables (e.g. NATIONAL_BASIC_DEDUCTION_TIER_PERIODS) are newest-first lookups
 * that silently reuse the latest authored period for any later year. Rolling over
 * automatically on Jan 1 would therefore present a not-yet-implemented year using the
 * prior year's rules. Bump this when the data tables gain a newer effective year.
 */
export const DEFAULT_INCOME_YEAR = 2026;

/** Interface for the UI Form State */
export interface TakeHomeFormState {
  annualIncome: number;
  /**
   * Calendar year the income is taxed in. Single source of truth for the income year,
   * defaulted to {@link DEFAULT_INCOME_YEAR} in App. A future year-picker UI writes here.
   */
  incomeYear: number;
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
  /**
   * Calendar year the income is taxed in. Required: every caller threads it through from
   * {@link TakeHomeFormState.incomeYear} (defaulted to {@link DEFAULT_INCOME_YEAR}), so the
   * calculation never has to fall back to a guessed year.
   */
  incomeYear: number;
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
  /**
   * 所得金額調整控除（子ども・特別障害者等を有する者等）applied to net employment income (給与所得).
   * Subtracted after the 給与所得控除, so it lowers 合計所得金額 and the taxable income for both
   * income tax and residence tax. 0 when the taxpayer is not eligible. {@link netEmploymentIncome}
   * is already net of this amount.
   */
  incomeAdjustmentDeduction?: number | undefined;
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
  /**
   * Residence tax income-based portion (所得割) BEFORE the home loan credit spillover, for
   * display. Not simply (post-credit 所得割 + appliedToResidenceTax): the city and prefectural
   * 所得割 are each floored to ¥100 after subtracting their share of the spillover, so the true
   * pre-credit 所得割 can differ from that sum by up to ~¥100. Taken from the pre-credit residence
   * calculation (already computed for the furusato 20% cap) so the Taxes-tab rows reconcile exactly.
   */
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
