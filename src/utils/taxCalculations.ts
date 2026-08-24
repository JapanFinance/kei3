// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP } from '../constants/taxThresholds';
import { getEmploymentInsuranceRate } from '../data/employmentInsurance';
import { getNationalBasicDeductionTiers } from '../data/nationalBasicDeduction';
import { NATIONAL_INCOME_TAX_BRACKETS } from '../data/nationalIncomeTaxBrackets';
import { calculateIncomeAdjustmentDeductionAmount } from '../data/netEmploymentIncome';
import { calculateResidenceTaxBasicDeduction } from '../data/residenceTaxBasicDeduction';
import type { Dependent } from '../types/dependents';
import {
  CUSTOM_PROVIDER_ID,
  DEFAULT_PROVIDER,
  DEPENDENT_COVERAGE_ID,
  LATTER_STAGE_ELDERLY_ID,
  NATIONAL_HEALTH_INSURANCE_ID,
  isEmployeeHealthProvider,
} from '../types/healthInsurance';
import type {
  BonusIncomeStream,
  IncomeStream,
  TakeHomeInputs,
  TakeHomeResults,
} from '../types/tax';
import {
  type TaxpayerAgeRange,
  DEFAULT_TAXPAYER_AGE_RANGE,
  taxpayerAgeRangeBounds,
  isLongTermCareCategory1Insured,
  isLongTermCareCategory2Insured,
  isSubjectToEmployeesPension,
  isSubjectToNationalPension,
} from '../types/taxpayerAge';
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
import { composeNetIncomeComponents, type NetIncomeComponents } from './netIncomeComponents';
import { calculatePensionBreakdown } from './pensionCalculator';
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
 * Composes the 所得金額調整控除（子ども・特別障害者等）: the salary-based amount
 * ({@link calculateIncomeAdjustmentDeductionAmount}), gated on the taxpayer having a qualifying
 * dependent ({@link hasIncomeAdjustmentDeductionDependent}). Returns 0 when not eligible.
 */
const calculateIncomeAdjustmentDeduction = (
  grossEmploymentIncome: number,
  dependents: Dependent[],
  year: number,
): number =>
  hasIncomeAdjustmentDeductionDependent(dependents, year)
    ? calculateIncomeAdjustmentDeductionAmount(grossEmploymentIncome)
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
  ageRange: DEFAULT_TAXPAYER_AGE_RANGE,
  grossEmploymentIncome: 0,
  incomeAdjustmentDeduction: 0,
  netBusinessAndMiscIncome: 0,
  totalNetIncome: 0,
  additionalDeductions: { national: 0, residence: 0, items: [] },
};

/**
 * Intermediate breakdown of income streams for calculation
 */
interface IncomeBreakdown {
  salaryIncome: number;
  bonusIncome: BonusIncomeStream[];
  /**
   * 給与等の収入金額: salary, bonuses and stock compensation. A commuting allowance is wholly
   * non-taxable up to {@link COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP}, which is the most this
   * calculator accepts, so none of it is employment income.
   */
  grossEmploymentIncome: number;
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
      case 'commutingAllowance': {
        const annualAmount = getCommutingAllowanceAnnualAmount(income);
        if (annualAmount / 12 > COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP) {
          throw new Error(
            'A commuting allowance above the non-taxable cap is not supported. Enter the excess as salary.',
          );
        }
        commutingAllowance += annualAmount;
        break;
      }
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

  const grossEmploymentIncome =
    salaryIncome + bonusIncome.reduce((sum, b) => sum + b.amount, 0) + stockCompensationIncome;
  const totalAnnualIncome =
    grossEmploymentIncome +
    netBusinessAndMiscIncomeBeforeBlueFilerDeduction +
    grossPublicPensionIncome;

  return {
    salaryIncome,
    bonusIncome,
    grossEmploymentIncome,
    netBusinessAndMiscIncomeBeforeBlueFilerDeduction,
    netBusinessAndMiscIncome,
    blueFilerDeduction,
    totalAnnualIncome,
    commutingAllowance,
    stockCompensationIncome,
    grossPublicPensionIncome,
  };
};

/**
 * The taxpayer's net income (所得) components, from the categorized gross amounts. Everything the
 * 合計所得金額 is composed of is the same for the taxpayer as for a dependent, so only the
 * taxpayer's own 所得金額調整控除（子ども・特別障害者等）is decided here.
 */
const composeTaxpayerNetIncomeComponents = (
  breakdown: IncomeBreakdown,
  year: number,
  ageRange: TaxpayerAgeRange,
  dependents: Dependent[],
): NetIncomeComponents => {
  const { grossEmploymentIncome, netBusinessAndMiscIncome, grossPublicPensionIncome } = breakdown;

  return composeNetIncomeComponents({
    grossEmploymentIncome,
    incomeAdjustmentDeduction: calculateIncomeAdjustmentDeduction(
      grossEmploymentIncome,
      dependents,
      year,
    ),
    grossPublicPensionIncome,
    recipientAgeRange: taxpayerAgeRangeBounds(ageRange),
    otherNetIncome: netBusinessAndMiscIncome,
    year,
  });
};

/**
 * The net income (所得) components of {@link calculateTaxes} on their own, without the rest of the
 * calculation — the input form previews 公的年金等に係る雑所得 from this so the 公的年金等控除 is
 * visible while entering the gross amount, and uses {@link NetIncomeComponents.totalNetIncome} for
 * the dependent eligibility checks.
 *
 * @param incomeStreams  Income streams to calculate net income for
 * @param year           Income year for the deduction table lookups
 * @param ageRange       The taxpayer's age range, passed on to the age-keyed net income rules for
 *                       them to read
 * @param dependents     The taxpayer's dependents, for the 所得金額調整控除 they may qualify the
 *                       taxpayer for
 */
export const calculateNetIncomeComponents = (
  incomeStreams: IncomeStream[],
  year: number,
  ageRange: TaxpayerAgeRange,
  dependents: Dependent[],
): NetIncomeComponents =>
  composeTaxpayerNetIncomeComponents(
    calculateIncomeBreakdown(incomeStreams),
    year,
    ageRange,
    dependents,
  );

export const calculateTaxes = (inputs: TakeHomeInputs): TakeHomeResults => {
  const incomeBreakdown = calculateIncomeBreakdown(inputs.incomeStreams);
  const {
    salaryIncome,
    bonusIncome,
    grossEmploymentIncome,
    netBusinessAndMiscIncome,
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

  // Whether the person is employed at all, which a commuting allowance alone attests to even
  // though none of it is 給与等の収入金額 — social insurance is charged on it either way.
  const hasEmploymentIncome =
    salaryIncome > 0 ||
    bonusIncome.some(b => b.amount > 0) ||
    commutingAllowance > 0 ||
    stockCompensationIncome > 0;

  const incomeYear = inputs.incomeYear;

  const {
    netEmploymentIncome,
    incomeAdjustmentDeduction,
    pensionIncomeAdjustmentDeduction,
    netPublicPensionIncome,
    totalNetIncome: netIncome,
  } = composeTaxpayerNetIncomeComponents(
    incomeBreakdown,
    incomeYear,
    inputs.ageRange,
    inputs.dependents,
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

    const subjectToLongTermCarePremium = isLongTermCareCategory2Insured(inputs.ageRange);

    if (inputs.healthInsuranceProvider === LATTER_STAGE_ELDERLY_ID) {
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
      isEmployeeHealthProvider(inputs.healthInsuranceProvider) ||
      inputs.healthInsuranceProvider === CUSTOM_PROVIDER_ID;

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
    commutingAllowance,
    // Bonus breakdown
    healthInsuranceOnBonus,
    pensionOnBonus,
    employmentInsuranceOnBonus,
    netEmploymentIncome: hasEmploymentIncome ? netEmploymentIncome : undefined,
    grossEmploymentIncome,
    incomeAdjustmentDeduction,
    ...(pensionIncomeAdjustmentDeduction > 0 && { pensionIncomeAdjustmentDeduction }),
    netBusinessAndMiscIncome,
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
    latterStageMedicalCapped: latterStageBreakdown?.medicalCapped,
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
