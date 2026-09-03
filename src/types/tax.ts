// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Dependent, DependentDeductionResults, DisabilityLevel } from './dependents';
import type { HealthInsuranceProviderId, LongTermCareCategory1Estimate } from './healthInsurance';
import type { TaxpayerAgeRange } from './taxpayerAge';

export type IncomeMode = 'salary' | 'miscellaneous' | 'advanced';

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

/**
 * Public pension income (公的年金等): {@link BaseIncomeStream.amount} is the gross annual
 * amount received (公的年金等の収入金額), before withholding. The public pension deduction (公的年金等控除)
 * is applied by the calculation, using the taxpayer's age range for the 65 boundary.
 */
export interface PublicPensionIncomeStream extends BaseIncomeStream {
  type: 'publicPension';
}

export interface StockCompensationIncomeStream extends BaseIncomeStream {
  type: 'stockCompensation';
  issuerDomicile: 'foreign' | 'domestic';
}

/**
 * 上場株式等に係る譲渡所得等の金額 for the year, net of acquisition and transfer costs.
 * {@link BaseIncomeStream.amount} may be negative (譲渡損失). Currently modeled as 申告不要
 * (源泉徴収ありの特定口座, domestic broker only) — see {@link ListedDividendsIncomeStream}.
 */
export interface ListedCapitalGainsIncomeStream extends BaseIncomeStream {
  type: 'listedCapitalGains';
}

/**
 * 上場株式等の配当等: gross dividends before withholding, including 公募株式投資信託の分配金 and
 * 特定公社債の利子. Currently modeled as 申告不要 (国内で源泉徴収済みのもの): a loss on
 * {@link ListedCapitalGainsIncomeStream} in the same year is assumed netted against this within
 * one 源泉徴収あり特定口座 before withholding, as the broker does at year end.
 */
export interface ListedDividendsIncomeStream extends BaseIncomeStream {
  type: 'listedDividends';
}

/** 預貯金等の利子 and other 一般公社債の利子: 源泉分離課税, gross before withholding. */
export interface DepositInterestIncomeStream extends BaseIncomeStream {
  type: 'depositInterest';
}

export type IncomeStream =
  | SalaryIncomeStream
  | BonusIncomeStream
  | BusinessIncomeStream
  | MiscellaneousIncomeStream
  | PublicPensionIncomeStream
  | CommutingAllowanceIncomeStream
  | StockCompensationIncomeStream
  | ListedCapitalGainsIncomeStream
  | ListedDividendsIncomeStream
  | DepositInterestIncomeStream;

export type IncomeStreamType = IncomeStream['type'];

/**
 * Whether `stream` is one of the investment-income types. These are never earned income: they
 * are excluded from {@link IncomeMode} totals and social-insurance routing, and are taxed
 * separately from the progressive brackets — see
 * {@link import("../utils/investmentIncome").calculateWithheldInvestmentTax}.
 */
export const isInvestmentIncomeStream = (
  stream: IncomeStream,
): stream is
  | ListedCapitalGainsIncomeStream
  | ListedDividendsIncomeStream
  | DepositInterestIncomeStream =>
  stream.type === 'listedCapitalGains' ||
  stream.type === 'listedDividends' ||
  stream.type === 'depositInterest';

/** Gross investment-income amounts for the year, before withholding. */
export interface InvestmentIncomeAmounts {
  /** See {@link ListedCapitalGainsIncomeStream}; may be negative. */
  listedCapitalGains: number;
  /** See {@link ListedDividendsIncomeStream}. */
  listedDividends: number;
  /** See {@link DepositInterestIncomeStream}. */
  depositInterest: number;
}

/** One category's withholding: the amount actually subject to it, and the tax withheld. */
export interface WithheldTaxLine {
  /** Amount subject to withholding, after any in-account netting (yen, ≥ 0). */
  base: number;
  national: number;
  residence: number;
}

/**
 * Tax withheld at source on investment income under 申告不要 (措法9条の3, 3条①, 8条の4;
 * 地方税法71条の28〔配当割〕, 71条の49〔株式等譲渡所得割〕, 71条の6〔利子割〕). Cash-flow only: kei3
 * shows the annual amount withheld, not a balance-due/refund position.
 */
export interface WithheldInvestmentTax {
  /** 上場株式等の譲渡所得等 and 配当等 combined: `base` = max(0, gains + dividends). */
  listed: WithheldTaxLine;
  depositInterest: WithheldTaxLine;
  national: number;
  residence: number;
  total: number;
}

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
  /**
   * Whether the home was a 特定取得 — acquired under the 8%/10% consumption tax (a new build,
   * or a pre-owned home bought from a business). A non-特定取得 (e.g. a pre-owned home bought from
   * a private individual, with no consumption tax) uses a lower residence-tax spillover cap.
   * Only affects the 2014–2021 move-in cohort (特定取得 → 7%/¥136,500; non-特定取得 → 5%/¥97,500);
   * 2022+ move-ins use 5%/¥97,500 regardless. Defaults to true (特定取得) when omitted.
   */
  isTokuteiShutoku?: boolean;
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
 * User input for the life insurance premium deduction (生命保険料控除). All values are
 * annual premiums paid, in yen. New-contract (新契約) categories are 2012-01-01-onward
 * policies; old-contract (旧契約) categories are pre-2012 policies. 介護医療 has no
 * old-contract equivalent.
 */
export interface LifeInsuranceInput {
  /** 一般生命保険料 — new contract (新契約). */
  generalNew: number;
  /** 介護医療保険料 — new contract only. */
  medicalCareNew: number;
  /** 個人年金保険料 — new contract (新契約). */
  pensionNew: number;
  /** 一般生命保険料 — old contract (旧契約, pre-2012). */
  generalOld?: number;
  /** 個人年金保険料 — old contract (旧契約, pre-2012). */
  pensionOld?: number;
}

/**
 * User input for the earthquake insurance premium deduction (地震保険料控除). Values are
 * annual premiums in yen.
 */
export interface EarthquakeInsuranceInput {
  /** 地震保険料 paid in the year. */
  earthquake: number;
  /** 旧長期損害保険料 — qualifying pre-2007 long-term casualty contracts (0 if none). */
  longTermOld: number;
}

/** User input for the medical expense deduction (医療費控除). Amounts in yen. */
export interface MedicalExpensesInput {
  /** Total medical expenses paid (支払った医療費の合計). */
  paid: number;
  /** Amounts reimbursed by insurance, etc. (保険金などで補填される金額). */
  reimbursed: number;
}

/**
 * Whether the taxpayer is a 寡婦 or an ひとり親, and which statutory sub-case. One field carries
 * all of them because they are mutually exclusive: a 寡婦 is defined as a woman who does not
 * qualify as an ひとり親 (所法2①三十), and its two branches partition the ways of not being
 * married.
 *
 * The mother/father split changes no deduction amount — both are ¥350,000 income tax / ¥300,000
 * residence tax. It selects the 人的控除額の差 that the residence-tax 調整控除 uses: 地方税法
 * 第314条の6第1号イ(3) gives ¥10,000 and (4) gives ¥50,000, and 地方税法施行令 assigns (3) to
 * ひとり親のうち父である者 and (4) to ひとり親のうち母である者.
 *
 * The 寡婦 split changes no amount either — it distinguishes the branches of 所法2①三十イ/ロ so
 * the calculator can check the one requirement that differs: a divorced 寡婦 (イ) must have a
 * dependent relative (扶養親族), while a bereaved one — 死別, or the husband's survival unknown
 * (ロ) — needs none.
 *
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1170.htm — 寡婦控除
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1171.htm — ひとり親控除
 */
export type WidowOrSingleParentStatus =
  | 'none'
  | 'singleParentMother'
  | 'singleParentFather'
  | 'widowDivorced'
  | 'widowBereaved';

/**
 * The taxpayer's own circumstances that carry a 人的控除 of their own, as entered in the
 * Additional Deductions & Credits modal. Every one of them is self-asserted: the calculator can
 * check the 合計所得金額 ceilings it knows and cross-check the Dependents list
 * ({@link import("../utils/personalDeductions").getPersonalCircumstanceWarnings}), but not
 * 障害者手帳 status, marital history, or 事実婚, so the modal states those requirements and
 * applies what is selected.
 */
export interface PersonalCircumstancesInput {
  /**
   * 障害者控除 for the taxpayer themselves. There is no 同居特別障害者 option here: that higher
   * amount exists only for a 同一生計配偶者 or 扶養親族 living with the taxpayer, never for the
   * taxpayer (所法79).
   * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm
   */
  disability: DisabilityLevel;
  /** 寡婦控除 / ひとり親控除 — see {@link WidowOrSingleParentStatus}. */
  widowOrSingleParent: WidowOrSingleParentStatus;
}

/**
 * Zero-value defaults for the additional-deduction inputs. The modal always shows these fields
 * (defaulting to 0), so "nothing entered" is all-zeros rather than absent — which is why these
 * inputs are required, not optional. Use these to seed form state, and spread
 * {@link EMPTY_ADDITIONAL_DEDUCTION_INPUTS} in tests to satisfy the required fields in one line.
 */
export const EMPTY_LIFE_INSURANCE: LifeInsuranceInput = {
  generalNew: 0,
  medicalCareNew: 0,
  pensionNew: 0,
};
export const EMPTY_EARTHQUAKE_INSURANCE: EarthquakeInsuranceInput = {
  earthquake: 0,
  longTermOld: 0,
};
export const EMPTY_MEDICAL_EXPENSES: MedicalExpensesInput = { paid: 0, reimbursed: 0 };
export const EMPTY_PERSONAL_CIRCUMSTANCES: PersonalCircumstancesInput = {
  disability: 'none',
  widowOrSingleParent: 'none',
};
export const EMPTY_ADDITIONAL_DEDUCTION_INPUTS = {
  lifeInsurance: EMPTY_LIFE_INSURANCE,
  earthquakeInsurance: EMPTY_EARTHQUAKE_INSURANCE,
  medicalExpenses: EMPTY_MEDICAL_EXPENSES,
  personalCircumstances: EMPTY_PERSONAL_CIRCUMSTANCES,
};

/** One line in the additional-deductions breakdown, with its per-tax amounts (yen). */
export interface AdditionalDeductionItem {
  key: 'lifeInsurance' | 'earthquakeInsurance' | 'medical';
  /** Amount deductible against national income tax. */
  national: number;
  /** Amount deductible against residence tax. */
  residence: number;
}

/**
 * Aggregated additional income deductions (所得控除) entered in the modal, beyond the
 * basic, dependent, social-insurance, and 小規模企業共済等掛金 deductions handled elsewhere. Shaped like
 * {@link DependentDeductionResults}: per-tax totals plus an itemized breakdown for display.
 * Because every member is a 物的控除, none of these affect the residence-tax 調整控除.
 */
export interface AdditionalDeductionsResult {
  /** Total deductible against national income tax (yen). */
  national: number;
  /** Total deductible against residence tax (yen). */
  residence: number;
  /** Per-item breakdown; only items contributing a positive amount are included. */
  items: AdditionalDeductionItem[];
}

/** One line in the personal-deduction breakdown, with its per-tax amounts (yen). */
export interface PersonalDeductionItem {
  /** 障害者控除 covers both 一般の障害者 and 特別障害者; the amounts distinguish them. */
  key: 'disability' | 'widow' | 'singleParent';
  /** Amount deductible against national income tax. */
  national: number;
  /** Amount deductible against residence tax. */
  residence: number;
  /** This item's 人的控除額の差 — see {@link PersonalDeductionsResult.statutoryDifference}. */
  statutoryDifference: number;
}

/**
 * The 人的控除 arising from the taxpayer's own circumstances (障害者控除・寡婦控除・ひとり親控除),
 * shaped like {@link AdditionalDeductionsResult} with one extra member. Unlike the 物的控除 in that
 * result, these are 人的控除 and so add to the residence-tax 調整控除's 人的控除額の差.
 */
export interface PersonalDeductionsResult {
  /** Total deductible against national income tax (yen). */
  national: number;
  /** Total deductible against residence tax (yen). */
  residence: number;
  /**
   * Combined 人的控除額の差 these deductions contribute to the residence-tax 調整控除
   * (地方税法第314条の6第1号イ). A statutory figure, not the arithmetic difference between the
   * national and residence amounts — the two disagree for an ひとり親（父）.
   */
  statutoryDifference: number;
  /** Per-item breakdown; only items contributing a positive amount are included. */
  items: PersonalDeductionItem[];
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
  ageRange: TaxpayerAgeRange;
  /**
   * True when the user has switched off the calculated 介護保険料 estimate to enter the billed
   * annual amount into {@link longTermCareCategory1Premium}. Named for the manual side so that
   * the false default means "estimate", matching {@link manualSocialInsuranceEntry}'s
   * convention. Ignored below age 65 and under manual social insurance entry.
   */
  longTermCareCategory1ManualEntry: boolean;
  /**
   * Annual 介護保険料 billed directly to a 第1号被保険者 (ages 65 and over), from the
   * June-July 介護保険料決定通知書. Read only when {@link longTermCareCategory1ManualEntry}
   * is on; 0 when nothing has been entered. Required (rather than optional) because it
   * backs a controlled number field, matching {@link manualSocialInsuranceAmount}, which
   * is likewise only meaningful when a sibling field says so.
   */
  longTermCareCategory1Premium: number;
  region: string;
  healthInsuranceProvider: HealthInsuranceProviderId;
  dependents: Dependent[];
  dcPlanContributions: number;
  manualSocialInsuranceEntry: boolean;
  manualSocialInsuranceAmount: number;
  customEHIRates?: CustomEmployeesHealthInsuranceRates | undefined;
  savedIncomeStreams: IncomeStream[];
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
  lifeInsurance: LifeInsuranceInput;
  earthquakeInsurance: EarthquakeInsuranceInput;
  medicalExpenses: MedicalExpensesInput;
  personalCircumstances: PersonalCircumstancesInput;
}

/** Interface for Calculation Logic (clean, normalized inputs) */
export interface TakeHomeInputs {
  incomeStreams: IncomeStream[];
  ageRange: TaxpayerAgeRange;
  /** See {@link TakeHomeFormState.longTermCareCategory1ManualEntry}. Absent means false. */
  longTermCareCategory1ManualEntry?: boolean | undefined;
  /** See {@link TakeHomeFormState.longTermCareCategory1Premium}. Absent means 0. */
  longTermCareCategory1Premium?: number | undefined;
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
  lifeInsurance: LifeInsuranceInput;
  earthquakeInsurance: EarthquakeInsuranceInput;
  medicalExpenses: MedicalExpensesInput;
  personalCircumstances: PersonalCircumstancesInput;
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
   * Canonical gross employment income (給与等の収入金額): the exact figure the employment income
   * deduction (給与所得控除) and {@link netEmploymentIncome}/{@link incomeAdjustmentDeduction} are
   * derived from — salary + taxable commuting allowance + bonus + stock compensation. The UI must
   * display THIS value rather than recomputing a per-tab subset, which can understate gross and make
   * the derived deduction (gross − net − adjustment) wrong or even negative. 0 when no employment income.
   */
  grossEmploymentIncome: number;
  /**
   * 所得金額調整控除（子ども・特別障害者等を有する者等）applied to net employment income (給与所得).
   * Subtracted after the 給与所得控除, so it lowers 合計所得金額 and the taxable income for both
   * income tax and residence tax. 0 when the taxpayer is not eligible. {@link netEmploymentIncome}
   * is already net of this amount.
   */
  incomeAdjustmentDeduction?: number | undefined;
  /**
   * 所得金額調整控除（給与所得と年金所得の双方を有する者）: up to ¥100,000 subtracted from net
   * employment income when the taxpayer has both 給与所得 and 公的年金等に係る雑所得.
   * {@link netEmploymentIncome} is already net of this amount. Absent when not applicable.
   */
  pensionIncomeAdjustmentDeduction?: number | undefined;
  /**
   * 事業所得 and 雑所得 other than public pensions, net of the 青色申告特別控除
   * ({@link blueFilerDeduction}). 0 when there is no business or miscellaneous income.
   */
  netBusinessAndMiscIncome: number;
  /** Gross public pension income (公的年金等の収入金額). Absent when there is none. */
  grossPublicPensionIncome?: number | undefined;
  /**
   * Net public pension income (公的年金等に係る雑所得): {@link grossPublicPensionIncome} minus the
   * public pension deduction (公的年金等控除). Absent when there is no public pension income.
   */
  netPublicPensionIncome?: number | undefined;
  totalNetIncome: number;
  /**
   * 通勤手当 paid over the year. Wholly non-taxable, so it is no part of 給与等の収入金額 and does
   * not reach any tax; it counts towards 報酬 for social insurance.
   */
  commutingAllowance?: number;
  /**
   * Investment income (listed-share capital gains and dividends, deposit interest), currently
   * always 申告不要 and taxed at source — none of it is part of {@link totalNetIncome}. Absent
   * when every amount is 0.
   */
  investmentIncome?:
    | {
        gross: InvestmentIncomeAmounts;
        /**
         * Sum of the three {@link InvestmentIncomeAmounts}; may be negative when a capital-gains
         * loss exceeds the dividends and interest. Included in {@link takeHomeIncome} but not in
         * {@link annualIncome}, which stays earned income only.
         */
        grossTotal: number;
        withheld: WithheldInvestmentTax;
      }
    | undefined;
  nationalIncomeTaxBasicDeduction?: number | undefined;
  taxableIncomeForNationalIncomeTax?: number | undefined;
  residenceTaxBasicDeduction?: number | undefined;
  taxableIncomeForResidenceTax?: number | undefined;
  furusatoNozei: FurusatoNozeiDetails;
  homeLoanTaxCredit?: HomeLoanTaxCreditResult;
  additionalDeductions: AdditionalDeductionsResult;
  /**
   * 障害者控除・寡婦控除・ひとり親控除 for the taxpayer themselves. Absent when none applies, so
   * the display rows can key off its presence (as they do for {@link dependentDeductions}).
   */
  personalDeductions?: PersonalDeductionsResult;
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
  // 後期高齢者医療制度 breakdown (only at ages 75+); the portions sum to healthInsurance
  latterStageMedicalPortion?: number | undefined;
  latterStageChildSupportPortion?: number | undefined;
  /**
   * Whether {@link latterStageMedicalPortion} has stopped rising with income, which for a
   * calendar year that blends two fiscal years needs both of them at their 賦課限度額.
   */
  latterStageMedicalCapped?: boolean | undefined;
  /**
   * Annual 介護保険料第1号 amount actually applied at ages 65+ outside manual social insurance
   * entry: the calculator's estimate, or the entered billed amount when positive. Included in
   * the social insurance deduction but not in {@link healthInsurance}.
   */
  longTermCareCategory1Premium?: number | undefined;
  /**
   * Present exactly when {@link longTermCareCategory1Premium} is the calculator's estimate
   * rather than an entered billed amount; carries the 所得段階 and 基準額 behind the figure.
   */
  longTermCareCategory1Estimate?: LongTermCareCategory1Estimate | undefined;
  // Context needed for cap detection
  salaryIncome: number; // Regular salary income (monthly * 12 or annual amount) excluding bonuses
  healthInsuranceProvider: HealthInsuranceProviderId;
  region: string;
  ageRange: TaxpayerAgeRange;
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
  };
  prefecture: {
    prefecturalTaxableIncome: number;
    prefecturalAdjustmentCredit: number;
    prefecturalIncomeTax: number;
    prefecturalPerCapitaTax: number;
  };
  perCapitaTax: number;
  forestEnvironmentTax: number; // 森林環境税
  totalResidenceTax: number;
  /**
   * Set when the result is non-taxable under 地方税法第295条第1項第2号, naming the status that
   * applied, so the display can explain the zero rows without re-deriving the rule.
   */
  nonTaxableStatus?: NonTaxableResidenceTaxStatus;
}

/**
 * The statuses 地方税法第295条第1項第2号 exempts from residence tax entirely when 合計所得金額 is
 * within the statutory limit: 障害者・未成年者・寡婦・ひとり親.
 */
export type NonTaxableResidenceTaxStatus = 'minor' | 'disability' | 'widow' | 'singleParent';

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
