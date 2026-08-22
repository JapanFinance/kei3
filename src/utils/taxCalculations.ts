// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { COMMUTING_ALLOWANCE_NONTAXABLE_ANNUAL_CAP } from '../constants/taxThresholds';
import { getEmploymentInsuranceRate } from '../data/employmentInsurance';
import { getNationalBasicDeductionTiers } from '../data/nationalBasicDeduction';
import { NATIONAL_INCOME_TAX_BRACKETS } from '../data/nationalIncomeTaxBrackets';
import {
  getEmploymentIncomeDeductionPeriod,
  calculateNetEmploymentIncomeForPeriod,
  calculateIncomeAdjustmentDeductionAmount,
} from '../data/netEmploymentIncome';
import { calculateNetPublicPensionIncome } from '../data/publicPensionDeduction';
import { calculateResidenceTaxBasicDeduction } from '../data/residenceTaxBasicDeduction';
import {
  DEFAULT_AGE_RANGE,
  isAge65OrOlder,
  isLongTermCareCategory1Insured,
  isSubjectToEmployeesPension,
  isSubjectToLongTermCarePremium,
  isSubjectToNationalPension,
} from '../types/ageRange';
import type { Dependent } from '../types/dependents';
import {
  CUSTOM_PROVIDER_ID,
  DEFAULT_PROVIDER,
  DEPENDENT_COVERAGE_ID,
  LATTER_STAGE_ELDERLY_ID,
  NATIONAL_HEALTH_INSURANCE_ID,
} from '../types/healthInsurance';
import type {
  BonusIncomeStream,
  IncomeStream,
  TakeHomeInputs,
  TakeHomeResults,
} from '../types/tax';
import { calculateAdditionalDeductions } from './additionalDeductions';
import {
  calculateDependentDeductions,
  hasIncomeAdjustmentDeductionDependent,
} from './dependentDeductions';
import { getCommutingAllowanceAnnualAmount } from './formatters';
import {
  calculateHealthInsuranceBreakdown,
  calculateLatterStageElderlyPremium,
  calculateNationalHealthInsurancePremiumWithBreakdown,
  type LatterStageElderlyBreakdown,
} from './healthInsuranceCalculator';
import { applyHomeLoanTaxCredit } from './homeLoanTaxCredit';
import { calculatePensionBreakdown } from './pensionCalculator';
import { calculatePersonalDeductions } from './personalDeductions';
import {
  calculateFurusatoNozeiDetails,
  calculateResidenceTax,
  NON_TAXABLE_RESIDENCE_TAX_DETAIL,
} from './residenceTax';

/**
 * Rounds the premium to a nearby whole yen according to the given mode.
 * By default, it rounds using halfTrunc mode:
 * - 0.50 yen or less rounds down
 * - more than 0.50 yen rounds up
 * @see https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/20121026.html
 */
export const roundSocialInsurancePremium = (
  amount: number,
  mode: 'halfTrunc' | 'halfExpand' = 'halfTrunc',
): number => {
  const roundedAmount = new Intl.NumberFormat('en', {
    maximumFractionDigits: 0,
    useGrouping: false,
    roundingMode: mode,
  }).format(amount);
  return Number.parseInt(roundedAmount);
};

/**
 * Composes the 所得金額調整控除（子ども・特別障害者等を有する者等）: the salary-based amount
 * ({@link calculateIncomeAdjustmentDeductionAmount}), gated on eligibility. The statute lists three
 * qualifying conditions; イ is the taxpayer being a 特別障害者 themselves, and ロ and ハ are about
 * their dependents ({@link hasIncomeAdjustmentDeductionDependent}). Any one of them suffices.
 * Returns 0 when none applies.
 *
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm
 */
const calculateIncomeAdjustmentDeduction = (
  grossEmploymentIncome: number,
  dependents: Dependent[],
  year: number,
  taxpayerIsSpecialDisability: boolean,
): number =>
  taxpayerIsSpecialDisability || hasIncomeAdjustmentDeductionDependent(dependents, year)
    ? calculateIncomeAdjustmentDeductionAmount(grossEmploymentIncome)
    : 0;

/**
 * Calculates net employment income (給与所得の金額) for the given income year: gross minus the
 * employment income deduction (給与所得控除) and — when the taxpayer is eligible — the income
 * amount adjustment deduction (所得金額調整控除). Pass the taxpayer's `dependents` and disability
 * status to apply the adjustment; omit them (the defaults) where it can't apply, e.g. when
 * computing a dependent's own net income.
 *
 * Delegates to the year-indexed period data in `src/data/netEmploymentIncome.ts`.
 *
 * @param grossEmploymentIncome  Gross employment income (給与等の収入金額) in yen
 * @param year                   Income year; defaults to the current calendar year
 * @param dependents             Taxpayer's dependents, for the 所得金額調整控除; defaults to none
 * @param taxpayerIsSpecialDisability  Whether the taxpayer is a 特別障害者, which qualifies them
 *                               for the 所得金額調整控除 on its own; defaults to false
 */
export const calculateNetEmploymentIncome = (
  grossEmploymentIncome: number,
  year: number,
  dependents: Dependent[] = [],
  taxpayerIsSpecialDisability: boolean = false,
): number =>
  calculateNetEmploymentIncomeForPeriod(
    grossEmploymentIncome,
    getEmploymentIncomeDeductionPeriod(year),
  ) -
  calculateIncomeAdjustmentDeduction(
    grossEmploymentIncome,
    dependents,
    year,
    taxpayerIsSpecialDisability,
  );

/**
 * The ¥100,000 that caps both income terms of the
 * 所得金額調整控除（給与所得と年金所得の双方を有する者）and is then subtracted from their sum.
 */
const PENSION_INCOME_ADJUSTMENT_CAP = 100_000;

/**
 * Calculates the 所得金額調整控除（給与所得と年金所得の双方を有する者）(措法41の3の12): when both
 * 給与所得 and 公的年金等に係る雑所得 are positive,
 *
 *   min(給与所得控除後の給与等の金額, ¥100,000) + min(公的年金等に係る雑所得, ¥100,000) − ¥100,000
 *
 * is deducted from 給与所得.
 *
 * The statute frames this as an adjustment made when computing 総所得金額, but what it reduces is
 * 給与所得の金額 itself. Since 所法2条1項30号 defines 合計所得金額 as the same 22条 総所得金額 plus
 * 退職所得金額 and 山林所得金額, the reduction carries into 合計所得金額 and so into the
 * 同一生計配偶者 and 扶養親族 income tests.
 *
 * @param netEmploymentIncome     給与所得 with the 給与所得控除 already taken, and with the other
 *                                variant — the 所得金額調整控除（子ども・特別障害者等を有する者等）,
 *                                措法41の3の11 — already subtracted where it applies, since the
 *                                statute deducts this one from the 給与所得 left after that. Strictly
 *                                its own capped term is the 給与所得控除後の給与等の金額, i.e. the
 *                                amount before that variant, but the variant only applies above
 *                                ¥8,500,000 of gross salary, where 給与所得 far exceeds the
 *                                ¥100,000 cap and the capped term is identical either way.
 * @param netPublicPensionIncome  公的年金等に係る雑所得, with the 公的年金等控除 already taken.
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm — 所得金額調整控除
 */
export const calculatePensionIncomeAdjustmentDeduction = (
  netEmploymentIncome: number,
  netPublicPensionIncome: number,
): number =>
  netEmploymentIncome > 0 && netPublicPensionIncome > 0
    ? Math.max(
        0,
        Math.min(netEmploymentIncome, PENSION_INCOME_ADJUSTMENT_CAP) +
          Math.min(netPublicPensionIncome, PENSION_INCOME_ADJUSTMENT_CAP) -
          PENSION_INCOME_ADJUSTMENT_CAP,
      )
    : 0;

/**
 * Breakdown of Employment Insurance premium components
 */
export interface EmploymentInsuranceBreakdown {
  total: number;
  bonusPortion: number;
}

/**
 * Calculates employment insurance premiums breakdown based on income.
 * The rate may vary by month within a calendar year (fiscal year changes in April).
 */
const calculateEmploymentInsuranceBreakdown = (
  salaryIncome: number,
  bonuses: BonusIncomeStream[],
  year: number,
): EmploymentInsuranceBreakdown => {
  // If no employment income, no employment insurance is required
  if (salaryIncome <= 0 && !bonuses.some(b => b.amount > 0)) {
    return { total: 0, bonusPortion: 0 };
  }

  let annualPremium = 0;
  let bonusPortion = 0;

  // Calculate on regular monthly salary — each month may have a different rate
  if (salaryIncome > 0) {
    const monthlySalary = salaryIncome / 12;
    for (let month = 0; month < 12; month++) {
      const rate = getEmploymentInsuranceRate(year, month);
      annualPremium += roundSocialInsurancePremium(monthlySalary * rate);
    }
  }

  // Calculate on bonuses — use the rate for the month the bonus is paid
  for (const bonus of bonuses) {
    const rate = getEmploymentInsuranceRate(year, bonus.month);
    const bonusPremium = roundSocialInsurancePremium(bonus.amount * rate);

    bonusPortion += bonusPremium;
    annualPremium += bonusPremium;
  }

  return { total: Math.max(annualPremium, 0), bonusPortion };
};

/**
 * Calculates employment insurance premiums based on income
 * Source: Ministry of Health, Labour and Welfare (MHLW)
 * https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000108634.html
 * Note: Only calculates the employee portion of the premium.
 *
 * The premium is calculated monthly with special rounding rules:
 * - Rate is looked up per month from the time-series data (rate changes in April each fiscal year)
 * - Rounding:
 *   - If decimal is 0.50 yen or less → round down
 *   - If decimal is 0.51 yen or more → round up
 * - Annual total is the sum of 12 monthly premiums
 */
// Only exported for testing
export const calculateEmploymentInsurance = (
  salaryIncome: number,
  year: number,
  bonuses: BonusIncomeStream[] = [],
): number => {
  return calculateEmploymentInsuranceBreakdown(salaryIncome, bonuses, year).total;
};

/**
 * Calculates the basic deduction (基礎控除) for national income tax based on income and year.
 * Source: National Tax Agency https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm
 *
 * @param netIncome Taxpayer's net income (合計所得金額) in yen
 * @param year Income year (calendar year the income was earned); defaults to current year
 */
export const calculateNationalIncomeTaxBasicDeduction = (
  netIncome: number,
  year: number,
): number => {
  for (const { maxIncomeInclusive, deduction } of getNationalBasicDeductionTiers(year)) {
    if (netIncome <= maxIncomeInclusive) return deduction;
  }
  return 0;
};

/**
 * Calculates the base national income tax (before reconstruction surtax) from taxable income, using
 * the shared {@link NATIONAL_INCOME_TAX_BRACKETS} speed table (net tax = income × rate − deduction).
 * Keeping the brackets as data lets the tooltip table and its row highlight reuse the exact same
 * bounds and amounts.
 * Source: National Tax Agency tax brackets — https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
 */
export const calculateNationalIncomeTaxBase = (taxableIncome: number): number => {
  // Clamp taxable income to 0 if negative
  const clampedTaxableIncome = Math.max(0, taxableIncome);

  for (const bracket of NATIONAL_INCOME_TAX_BRACKETS) {
    if (clampedTaxableIncome <= bracket.maxTaxableIncomeInclusive) {
      return clampedTaxableIncome * bracket.rate - bracket.deduction;
    }
  }

  return 0; // Unreachable: the final bracket's bound is Infinity
};

/**
 * Calculates the reconstruction surtax (復興特別所得税) at 2.1% of base income tax
 * Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
 */
export const calculateReconstructionSurtax = (baseTax: number): number => {
  return baseTax * 0.021;
};

/**
 * Calculates national income tax based on taxable income, including the 2.1% reconstruction surtax
 * Source: National Tax Agency tax brackets for 2025
 * https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
 * Note: Result is rounded down to the nearest 100 yen
 */
export const calculateNationalIncomeTax = (taxableIncome: number): number => {
  const baseTax = calculateNationalIncomeTaxBase(taxableIncome);
  const reconstructionSurtax = calculateReconstructionSurtax(baseTax);

  // Round down to the nearest 100 yen (total tax)
  return Math.floor((baseTax + reconstructionSurtax) / 100) * 100;
};

const DEFAULT_TAKE_HOME_RESULTS: TakeHomeResults = {
  annualIncome: 0,
  hasEmploymentIncome: true,
  nationalIncomeTax: 0,
  residenceTax: NON_TAXABLE_RESIDENCE_TAX_DETAIL,
  healthInsurance: 0,
  pensionPayments: 0,
  employmentInsurance: 0,
  takeHomeIncome: 0,
  furusatoNozei: calculateFurusatoNozeiDetails(0, NON_TAXABLE_RESIDENCE_TAX_DETAIL),
  dcPlanContributions: 0,
  salaryIncome: 0,
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  ageRange: DEFAULT_AGE_RANGE,
  grossEmploymentIncome: 0,
  incomeAdjustmentDeduction: 0,
  totalNetIncome: 0,
  additionalDeductions: { national: 0, residence: 0, items: [] },
};

/**
 * Intermediate breakdown of income streams for calculation
 */
interface IncomeBreakdown {
  salaryIncome: number;
  bonusIncome: BonusIncomeStream[];
  netBusinessAndMiscIncomeBeforeBlueFilerDeduction: number;
  netBusinessAndMiscIncome: number;
  blueFilerDeduction: number;
  totalAnnualIncome: number;
  commutingAllowance: number;
  stockCompensationIncome: number;
  grossPublicPensionIncome: number;
}

/**
 * Processes income streams to categorize them and calculate totals.
 * This is used by both the main tax calculation and the net income calculation.
 */
const calculateIncomeBreakdown = (incomeStreams: IncomeStream[]): IncomeBreakdown => {
  let salaryIncome = 0;
  const bonusIncome: BonusIncomeStream[] = [];
  let netBusinessAndMiscIncomeBeforeBlueFilerDeduction = 0;
  let netBusinessAndMiscIncome = 0;
  let blueFilerDeduction = 0;
  let commutingAllowance = 0;
  let stockCompensationIncome = 0;
  let grossPublicPensionIncome = 0;
  let processedBusinessIncome = false;

  for (const income of incomeStreams) {
    switch (income.type) {
      case 'salary':
        if (income.frequency === 'monthly') {
          salaryIncome += income.amount * 12;
        } else {
          salaryIncome += income.amount;
        }
        break;
      case 'commutingAllowance':
        commutingAllowance += getCommutingAllowanceAnnualAmount(income);
        break;
      case 'bonus':
        bonusIncome.push(income);
        break;
      case 'stockCompensation':
        stockCompensationIncome += income.amount;
        break;
      case 'business': {
        if (processedBusinessIncome) {
          throw new Error('Only one business income stream is allowed.');
        }
        if (income.amount < 0) {
          throw new Error('Business income losses are not currently supported.');
        }
        const maxDeduction = income.blueFilerDeduction || 0;
        netBusinessAndMiscIncomeBeforeBlueFilerDeduction += income.amount;
        // Net business income is reduced by the deduction, up to the amount of income
        const effectiveDeduction = Math.min(income.amount, maxDeduction);
        netBusinessAndMiscIncome += income.amount - effectiveDeduction;
        blueFilerDeduction = effectiveDeduction;
        processedBusinessIncome = true;
        break;
      }
      case 'miscellaneous':
        netBusinessAndMiscIncomeBeforeBlueFilerDeduction += income.amount;
        netBusinessAndMiscIncome += income.amount;
        break;
      case 'publicPension':
        grossPublicPensionIncome += income.amount;
        break;
      default: {
        const unhandled: never = income;
        throw new Error(`Unhandled income stream type: ${JSON.stringify(unhandled)}`);
      }
    }
  }

  const totalAnnualIncome =
    salaryIncome +
    bonusIncome.reduce((sum, b) => sum + b.amount, 0) +
    netBusinessAndMiscIncomeBeforeBlueFilerDeduction +
    stockCompensationIncome +
    grossPublicPensionIncome;

  return {
    salaryIncome,
    bonusIncome,
    netBusinessAndMiscIncomeBeforeBlueFilerDeduction,
    netBusinessAndMiscIncome,
    blueFilerDeduction,
    totalAnnualIncome,
    commutingAllowance,
    stockCompensationIncome,
    grossPublicPensionIncome,
  };
};

/** Per-category net incomes composing 合計所得金額, shared by the full and net-only calculations. */
interface NetIncomeComponents {
  /** Gross employment income (給与等の収入金額), incl. taxable commuting allowance. */
  grossEmploymentIncome: number;
  taxableCommutingAllowance: number;
  /** 給与所得, net of the 給与所得控除 and both 所得金額調整控除 variants below. */
  netEmploymentIncome: number;
  /** 所得金額調整控除（子ども・特別障害者等を有する者等）, already reflected in {@link netEmploymentIncome}. */
  incomeAdjustmentDeduction: number;
  /** 所得金額調整控除（給与所得と年金所得の双方を有する者）, already reflected in {@link netEmploymentIncome}. */
  pensionIncomeAdjustmentDeduction: number;
  /** 公的年金等に係る雑所得. */
  netPublicPensionIncome: number;
  /** 合計所得金額: the sum of the net components. */
  totalNetIncome: number;
}

/**
 * Derives the net income (所得) components from the categorized gross amounts:
 * 給与所得 via the 給与所得控除 and 所得金額調整控除（子ども・特別障害者等）, 公的年金等に係る雑所得
 * via the 公的年金等控除 ({@link calculateNetPublicPensionIncome}), and — when the taxpayer has
 * both — the 所得金額調整控除（給与所得と年金所得の双方を有する者）of up to ¥100,000 subtracted
 * from 給与所得 (措法41の3の12):
 *
 *   min(給与所得控除後の給与等の金額, ¥100,000) + min(公的年金等に係る雑所得, ¥100,000) − ¥100,000
 *
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm — 所得金額調整控除
 */
const calculateNetIncomeComponents = (
  breakdown: IncomeBreakdown,
  year: number,
  dependents: Dependent[],
  taxpayerIs65OrOlder: boolean,
  taxpayerIsSpecialDisability: boolean,
): NetIncomeComponents => {
  const {
    salaryIncome,
    bonusIncome,
    netBusinessAndMiscIncome,
    commutingAllowance,
    stockCompensationIncome,
    grossPublicPensionIncome,
  } = breakdown;

  const taxableCommutingAllowance = Math.max(
    0,
    commutingAllowance - COMMUTING_ALLOWANCE_NONTAXABLE_ANNUAL_CAP,
  );

  const grossEmploymentIncome =
    salaryIncome +
    taxableCommutingAllowance +
    bonusIncome.reduce((sum, b) => sum + b.amount, 0) +
    stockCompensationIncome;
  const netEmploymentIncomeBeforePensionAdjustment = calculateNetEmploymentIncome(
    grossEmploymentIncome,
    year,
    dependents,
    taxpayerIsSpecialDisability,
  );
  const incomeAdjustmentDeduction = calculateIncomeAdjustmentDeduction(
    grossEmploymentIncome,
    dependents,
    year,
    taxpayerIsSpecialDisability,
  );

  // The band of the 公的年金等控除 keys off the net income other than pension income. Statutorily
  // that is the final 合計所得金額 figure, but the 給与+年金 adjustment below needs the pension
  // income as its input, so the band is judged before that adjustment; the two can only interact
  // within ¥100,000 of the band boundaries (¥10M/¥20M).
  const netPublicPensionIncome = calculateNetPublicPensionIncome(
    grossPublicPensionIncome,
    taxpayerIs65OrOlder,
    netEmploymentIncomeBeforePensionAdjustment + netBusinessAndMiscIncome,
    year,
  );

  const pensionIncomeAdjustmentDeduction = calculatePensionIncomeAdjustmentDeduction(
    netEmploymentIncomeBeforePensionAdjustment,
    netPublicPensionIncome,
  );

  const netEmploymentIncome =
    netEmploymentIncomeBeforePensionAdjustment - pensionIncomeAdjustmentDeduction;

  return {
    grossEmploymentIncome,
    taxableCommutingAllowance,
    netEmploymentIncome,
    incomeAdjustmentDeduction,
    pensionIncomeAdjustmentDeduction,
    netPublicPensionIncome,
    totalNetIncome: netEmploymentIncome + netBusinessAndMiscIncome + netPublicPensionIncome,
  };
};

/**
 * Calculates just the total net income (合計所得金額).
 * This is lighter weight than the full tax calculation and used for dependent eligibility checks.
 *
 * @param incomeStreams  Income streams to calculate net income for
 * @param year          Income year for the employment income deduction lookup; defaults to current year
 * @param dependents    The taxpayer's dependents, used to apply the 所得金額調整控除 when a qualifying
 *                      dependent is present. Defaults to none (no adjustment).
 * @param taxpayerIs65OrOlder Whether the taxpayer is 65 or older by the end of the income year
 *                      ({@link isAge65OrOlder}), selecting the 公的年金等控除 minimums. Defaults to
 *                      false; irrelevant without a public pension stream.
 * @param taxpayerIsSpecialDisability Whether the taxpayer is a 特別障害者, which qualifies them for
 *                      the 所得金額調整控除 without a qualifying dependent. Defaults to false.
 */
export const calculateTotalNetIncome = (
  incomeStreams: IncomeStream[],
  year: number,
  dependents: Dependent[] = [],
  taxpayerIs65OrOlder: boolean = false,
  taxpayerIsSpecialDisability: boolean = false,
): number =>
  calculateNetIncomeComponents(
    calculateIncomeBreakdown(incomeStreams),
    year,
    dependents,
    taxpayerIs65OrOlder,
    taxpayerIsSpecialDisability,
  ).totalNetIncome;

export const calculateTaxes = (inputs: TakeHomeInputs): TakeHomeResults => {
  const incomeBreakdown = calculateIncomeBreakdown(inputs.incomeStreams);
  const {
    salaryIncome,
    bonusIncome,
    blueFilerDeduction,
    totalAnnualIncome,
    commutingAllowance,
    stockCompensationIncome,
    grossPublicPensionIncome,
  } = incomeBreakdown;

  if (totalAnnualIncome <= 0) {
    return DEFAULT_TAKE_HOME_RESULTS;
  }

  // Use the calculated total annual income instead of inputs.annualIncome for consistency
  const annualIncome = totalAnnualIncome;

  // Determine if there is any employment income (salary, bonus, or taxable commuting allowance)
  const hasEmploymentIncome =
    salaryIncome > 0 ||
    bonusIncome.some(b => b.amount > 0) ||
    commutingAllowance > 0 ||
    stockCompensationIncome > 0;

  const nonTaxableCommutingAllowance = Math.min(
    commutingAllowance,
    COMMUTING_ALLOWANCE_NONTAXABLE_ANNUAL_CAP,
  );
  const incomeYear = inputs.incomeYear;

  const {
    grossEmploymentIncome,
    taxableCommutingAllowance,
    netEmploymentIncome,
    incomeAdjustmentDeduction,
    pensionIncomeAdjustmentDeduction,
    netPublicPensionIncome,
    totalNetIncome: netIncome,
  } = calculateNetIncomeComponents(
    incomeBreakdown,
    incomeYear,
    inputs.dependents,
    isAge65OrOlder(inputs.ageRange),
    inputs.personalCircumstances.disability === 'special',
  );

  let healthInsurance = 0;
  let pensionPayments = 0;
  let employmentInsurance = 0;
  let longTermCareCategory1Premium = 0;
  let socialInsuranceDeduction: number;
  let nhiBreakdown = null;
  let latterStageBreakdown: LatterStageElderlyBreakdown | null = null;

  // Bonus breakdown variables
  let healthInsuranceOnBonus = 0;
  let pensionOnBonus = 0;
  let employmentInsuranceOnBonus = 0;

  if (inputs.manualSocialInsuranceEntry) {
    socialInsuranceDeduction = inputs.manualSocialInsuranceAmount;
  } else {
    // For health insurance calculation, we need to use the appropriate income:
    // - Employee health insurance: based on standard monthly remuneration
    // - National Health Insurance: based on net income

    const subjectToLongTermCarePremium = isSubjectToLongTermCarePremium(inputs.ageRange);

    if (inputs.healthInsuranceProvider === LATTER_STAGE_ELDERLY_ID) {
      // 後期高齢者医療制度 (ages 75+): premiums are income-based like NHI, with no bonus
      // portion of their own.
      latterStageBreakdown = calculateLatterStageElderlyPremium(
        netIncome,
        incomeYear,
        inputs.region,
      );
      healthInsurance = latterStageBreakdown.total;
    } else if (inputs.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID) {
      const hiResult = calculateHealthInsuranceBreakdown(
        netIncome,
        subjectToLongTermCarePremium,
        inputs.healthInsuranceProvider,
        incomeYear,
        inputs.region,
      );
      healthInsurance = hiResult.total;
      healthInsuranceOnBonus = hiResult.bonusPortion;

      // For NHI breakdown, also use net income
      nhiBreakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
        netIncome,
        subjectToLongTermCarePremium,
        incomeYear,
        inputs.region,
      );
    } else {
      // Employee Health Insurance
      // For Employee Health Insurance, the premiums are based on standard monthly remuneration,
      // which INCLUDES the full commuting allowance (taxable + non-taxable).
      const hiResult = calculateHealthInsuranceBreakdown(
        salaryIncome + commutingAllowance,
        subjectToLongTermCarePremium,
        inputs.healthInsuranceProvider,
        incomeYear,
        inputs.region,
        inputs.healthInsuranceProvider === CUSTOM_PROVIDER_ID && inputs.customEHIRates
          ? {
              healthRate: inputs.customEHIRates.healthInsuranceRate,
              ltcRate: inputs.customEHIRates.longTermCareRate,
            }
          : undefined,
        bonusIncome,
      );
      healthInsurance = hiResult.total;
      healthInsuranceOnBonus = hiResult.bonusPortion;
    }

    // Calculate pension based on health insurance type
    // People on National Health Insurance are in the National Pension system (contributions
    // due only for ages 20-59)
    // People on employee health insurance are in Employee Pension system
    // People covered as dependents do not pay pension premiums
    const isInEmployeePensionSystem =
      inputs.healthInsuranceProvider !== NATIONAL_HEALTH_INSURANCE_ID &&
      inputs.healthInsuranceProvider !== DEPENDENT_COVERAGE_ID &&
      inputs.healthInsuranceProvider !== LATTER_STAGE_ELDERLY_ID;

    if (inputs.healthInsuranceProvider === DEPENDENT_COVERAGE_ID) {
      pensionPayments = 0;
    } else if (isInEmployeePensionSystem) {
      // Employees' Pension enrollment ends at age 70, so 70-74 pays nothing.
      if (isSubjectToEmployeesPension(inputs.ageRange)) {
        // Pension also includes full commuting allowance in SMR
        const pensionResult = calculatePensionBreakdown(
          isInEmployeePensionSystem,
          (salaryIncome + commutingAllowance) / 12,
          true,
          bonusIncome,
          incomeYear,
        );
        pensionPayments = pensionResult.total;
        pensionOnBonus = pensionResult.bonusPortion;
      }
    } else if (isSubjectToNationalPension(inputs.ageRange)) {
      // National Pension: contributions are due only for ages 20-59.
      const pensionResult = calculatePensionBreakdown(
        isInEmployeePensionSystem,
        0,
        true,
        [],
        incomeYear,
      );
      pensionPayments = pensionResult.total;
      pensionOnBonus = pensionResult.bonusPortion;
    }

    // Employment Insurance also includes full commuting allowance
    const eiResult = calculateEmploymentInsuranceBreakdown(
      salaryIncome + commutingAllowance,
      bonusIncome,
      incomeYear,
    );
    employmentInsurance = eiResult.total;
    employmentInsuranceOnBonus = eiResult.bonusPortion;

    // 介護保険第1号 (ages 65+): the municipally billed annual amount entered by the user.
    // Deductible as 社会保険料控除 like the other premiums.
    if (isLongTermCareCategory1Insured(inputs.ageRange)) {
      longTermCareCategory1Premium = Math.max(0, inputs.longTermCareCategory1Premium || 0);
    }

    socialInsuranceDeduction =
      healthInsurance + pensionPayments + employmentInsurance + longTermCareCategory1Premium;
  }

  // iDeCo and corporate DC contributions are deductible as 小規模企業共済等掛金控除
  const idecoDeduction = Math.max(0, inputs.dcPlanContributions || 0);

  // Additional income deductions (生命保険料控除, 地震保険料控除, 医療費控除) entered in the modal.
  // The national and residence amounts differ for the insurance deductions; none of these are
  // 人的控除, so none affect the residence-tax 調整控除. The medical floor needs 合計所得金額.
  const additionalDeductions = calculateAdditionalDeductions(inputs, netIncome);

  // 障害者控除・寡婦控除・ひとり親控除 for the taxpayer themselves. These are 人的控除, so they also
  // feed the residence-tax 調整控除 via their 人的控除額の差.
  const personalDeductions = calculatePersonalDeductions(inputs.personalCircumstances, netIncome);

  const dependentDeductions = calculateDependentDeductions(
    inputs.dependents,
    incomeYear,
    netIncome,
  );

  const nationalIncomeTaxBasicDeduction = calculateNationalIncomeTaxBasicDeduction(
    netIncome,
    incomeYear,
  );

  // National income tax taxable income before the 1,000-yen flooring. Furusato uses this
  // pre-rounding figure (it rounds after subtracting the donation deduction), so the two share
  // this expression and can't drift apart if the deduction set changes.
  const nationalTaxableIncomeBeforeRounding =
    netIncome -
    socialInsuranceDeduction -
    idecoDeduction -
    additionalDeductions.national -
    personalDeductions.national -
    nationalIncomeTaxBasicDeduction -
    dependentDeductions.nationalTax.total;
  const taxableIncomeForNationalIncomeTax = Math.max(
    0,
    Math.floor(nationalTaxableIncomeBeforeRounding / 1000) * 1000,
  );

  // Base national income tax (所得税額) before tax credits and the reconstruction surtax
  const nationalIncomeTaxBase = calculateNationalIncomeTaxBase(taxableIncomeForNationalIncomeTax);

  const residenceTaxBasicDeduction = calculateResidenceTaxBasicDeduction(netIncome);
  const taxableIncomeForResidenceTax = Math.max(
    0,
    Math.floor(
      Math.max(
        0,
        netIncome -
          socialInsuranceDeduction -
          idecoDeduction -
          additionalDeductions.residence -
          personalDeductions.residence -
          residenceTaxBasicDeduction -
          dependentDeductions.residenceTax.total,
      ) / 1000,
    ) * 1000,
  );

  // Home loan tax credit (住宅ローン控除): applied first to the base income tax,
  // then spilled over to residence tax up to the cap.
  // Calling residence tax with appliedToResidenceTax = 0 first gives us the
  // pre-credit residence tax, needed for the furusato 20% special-deduction cap.
  const preCreditResidenceTax = calculateResidenceTax(
    netIncome,
    socialInsuranceDeduction + idecoDeduction + additionalDeductions.residence,
    dependentDeductions,
    incomeYear,
    inputs.ageRange,
    0,
    inputs.personalCircumstances,
  );

  const homeLoanTaxCreditResult = inputs.homeLoanTaxCredit
    ? applyHomeLoanTaxCredit(
        inputs.homeLoanTaxCredit,
        netIncome,
        nationalIncomeTaxBase,
        // The spillover cap uses the INCOME-TAX taxable income (所得税の課税総所得金額等),
        // NOT the residence-tax taxable income.
        taxableIncomeForNationalIncomeTax,
      )
    : undefined;

  // Reconstruction surtax (復興特別所得税) is 2.1% of the base income tax AFTER tax credits.
  const baseIncomeTaxAfterCredit = Math.max(
    0,
    nationalIncomeTaxBase - (homeLoanTaxCreditResult?.appliedToIncomeTax ?? 0),
  );
  const reconstructionSurtax = calculateReconstructionSurtax(baseIncomeTaxAfterCredit);
  const nationalIncomeTax =
    Math.floor((baseIncomeTaxAfterCredit + reconstructionSurtax) / 100) * 100;

  const residenceTax =
    homeLoanTaxCreditResult && homeLoanTaxCreditResult.appliedToResidenceTax > 0
      ? calculateResidenceTax(
          netIncome,
          socialInsuranceDeduction + idecoDeduction + additionalDeductions.residence,
          dependentDeductions,
          incomeYear,
          inputs.ageRange,
          homeLoanTaxCreditResult.appliedToResidenceTax,
          inputs.personalCircumstances,
        )
      : preCreditResidenceTax;

  // Calculate totals
  const totalSocialsAndTax =
    nationalIncomeTax + residenceTax.totalResidenceTax + socialInsuranceDeduction;
  const takeHomeIncome = annualIncome - totalSocialsAndTax;

  const furusatoNozeiLimit = calculateFurusatoNozeiDetails(
    nationalTaxableIncomeBeforeRounding,
    preCreditResidenceTax,
    residenceTax,
    homeLoanTaxCreditResult?.appliedToResidenceTax ?? 0,
    nationalIncomeTax,
  );

  return {
    annualIncome,
    hasEmploymentIncome,
    blueFilerDeduction,
    nationalIncomeTax,
    residenceTax,
    healthInsurance,
    pensionPayments,
    employmentInsurance,
    takeHomeIncome,
    socialInsuranceOverride: inputs.manualSocialInsuranceEntry
      ? inputs.manualSocialInsuranceAmount
      : undefined,
    // Commuting Allowance details
    commutingAllowanceIncome: commutingAllowance,
    commutingAllowanceTaxable: taxableCommutingAllowance,
    commutingAllowanceNonTaxable: nonTaxableCommutingAllowance,
    // Bonus breakdown
    healthInsuranceOnBonus,
    pensionOnBonus,
    employmentInsuranceOnBonus,
    netEmploymentIncome: hasEmploymentIncome ? netEmploymentIncome : undefined,
    grossEmploymentIncome,
    incomeAdjustmentDeduction,
    ...(pensionIncomeAdjustmentDeduction > 0 && { pensionIncomeAdjustmentDeduction }),
    ...(grossPublicPensionIncome > 0 && {
      grossPublicPensionIncome,
      netPublicPensionIncome,
    }),
    totalNetIncome: netIncome,
    nationalIncomeTaxBasicDeduction,
    taxableIncomeForNationalIncomeTax,
    residenceTaxBasicDeduction,
    taxableIncomeForResidenceTax,
    furusatoNozei: furusatoNozeiLimit,
    ...(homeLoanTaxCreditResult && { homeLoanTaxCredit: homeLoanTaxCreditResult }),
    additionalDeductions,
    ...(personalDeductions.items.length > 0 && { personalDeductions }),
    // Residence income-based portion (所得割) BEFORE the home loan spillover, so the
    // Taxes tab can show the spillover as its own line and have the rows sum.
    ...(homeLoanTaxCreditResult &&
      homeLoanTaxCreditResult.appliedToResidenceTax > 0 && {
        residenceTaxIncomeBasedBeforeHomeLoanCredit:
          preCreditResidenceTax.city.cityIncomeTax +
          preCreditResidenceTax.prefecture.prefecturalIncomeTax,
      }),
    dcPlanContributions: inputs.dcPlanContributions,
    // Income tax breakdown
    nationalIncomeTaxBase:
      taxableIncomeForNationalIncomeTax > 0 ? nationalIncomeTaxBase : undefined,
    reconstructionSurtax: taxableIncomeForNationalIncomeTax > 0 ? reconstructionSurtax : undefined,
    // NHI breakdown fields (populated only when NHI is selected)
    nhiMedicalPortion: nhiBreakdown?.medicalPortion,
    nhiElderlySupportPortion: nhiBreakdown?.elderlySupportPortion,
    nhiLongTermCarePortion: nhiBreakdown?.longTermCarePortion,
    nhiChildSupportPortion: nhiBreakdown?.childSupportPortion,
    // 後期高齢者医療 breakdown fields (populated only at ages 75+)
    latterStageMedicalPortion: latterStageBreakdown?.medicalPortion,
    latterStageChildSupportPortion: latterStageBreakdown?.childSupportPortion,
    longTermCareCategory1Premium:
      longTermCareCategory1Premium > 0 ? longTermCareCategory1Premium : undefined,
    // Context needed for cap detection
    salaryIncome,
    healthInsuranceProvider: inputs.healthInsuranceProvider,
    region: inputs.region,
    ageRange: inputs.ageRange,
    customEHIRates: inputs.customEHIRates,
    // Dependent deductions (always include, even if zero)
    ...(inputs.dependents.length > 0 && {
      dependentDeductions: dependentDeductions,
    }),
  };
};
