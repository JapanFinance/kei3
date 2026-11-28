// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
  MANDATORY_RETURN_PENSION_THRESHOLD,
  MANDATORY_RETURN_SALARY_THRESHOLD,
} from '../data/furusatoNozei';
import {
  TEMPORARY_INCOME_INCLUSION_DIVISOR,
  TEMPORARY_INCOME_SPECIAL_DEDUCTION,
} from '../data/temporaryIncome';
import type {
  AdditionalDeductionItem,
  FurusatoNozeiDetails,
  IncomeStream,
  OneStopIneligibilityReason,
  TakeHomeResults,
} from '../types/tax';

export type { OneStopIneligibilityReason };

// The nominal out-of-pocket cost at the limit is 2,000 yen. The residence tax
// credits are floored to 100 yen separately for the municipal and prefectural
// portions, so an ordinary result lands up to about 200 yen above the nominal
// figure; only a cost above that margin means the bracket shift, credit interaction,
// or temporary income effect on the Furusato Nozei tab has actually raised the cost.
export const OUT_OF_POCKET_ROUNDING_MARGIN = 200;
const OUT_OF_POCKET_WARNING_THRESHOLD = 2_000 + OUT_OF_POCKET_ROUNDING_MARGIN;

/**
 * Total estimated out-of-pocket cost: donation amount minus income/residence tax
 * reductions, plus any incremental tax and social insurance effect on temporary income from
 * return gifts.
 */
export const getFurusatoOutOfPocketCost = (furusatoNozei: FurusatoNozeiDetails): number =>
  furusatoNozei.limit -
  furusatoNozei.incomeTaxReduction -
  furusatoNozei.residenceTaxReduction +
  (furusatoNozei.temporaryIncomeEffect?.total ?? 0);

/**
 * Returns true when an out-of-pocket cost exceeds the nominal ¥2,200 rounding margin.
 */
export const isHighOutOfPocketCost = (cost: number): boolean =>
  cost > OUT_OF_POCKET_WARNING_THRESHOLD;

/**
 * Total out-of-pocket cost at the limit under the One-Stop Exception system
 * (ワンストップ特例制度), or undefined when One-Stop details are absent or ineligible.
 */
export const getFurusatoOneStopOutOfPocketCost = (
  furusatoNozei: FurusatoNozeiDetails,
): number | undefined =>
  furusatoNozei.oneStop?.eligible
    ? furusatoNozei.limit - furusatoNozei.oneStop.residenceTaxReduction
    : undefined;

export interface FurusatoTemporaryIncomeEstimate {
  /** Estimated procurement value of return gifts (26.5% of donation amount). */
  estimatedGiftsValue: number;
  /** Estimated shipping/delivery cost of return gifts (5.7% of donation amount). */
  estimatedShippingCost: number;
  /** Combined estimated economic benefit (gifts + shipping = 32.2%). */
  estimatedEconomicBenefit: number;
  /** Statutory annual special deduction for temporary income (¥500,000). */
  specialDeduction: number;
  /** Unused portion of the ¥500,000 special deduction when total temporary income is at or below ¥500,000. */
  remainingDeductionAllowance: number;
  /** Incremental net temporary income after the ¥500,000 special deduction (一時所得の金額). */
  netTemporaryIncome: number;
  /** Incremental amount included in aggregate taxable income: floor((prior + gifts) net / 2) - floor(prior net / 2). */
  taxableTemporaryIncome: number;
}

/**
 * Estimates the temporary income (一時所得) from Furusato Nozei return gifts for a given
 * donation amount, using FY2025 MIC survey averages (26.5% goods procurement + 5.7% shipping)
 * and the shared ¥500,000 annual special deduction.
 */
export const estimateFurusatoTemporaryIncome = (
  donationAmount: number,
  existingTemporaryIncome: number = 0,
): FurusatoTemporaryIncomeEstimate => {
  const prior = Math.max(0, Number.isFinite(existingTemporaryIncome) ? existingTemporaryIncome : 0);
  const specialDeduction = TEMPORARY_INCOME_SPECIAL_DEDUCTION;
  const isPositiveDonation = donationAmount > 0 && Number.isFinite(donationAmount);
  const estimatedGiftsValue = isPositiveDonation
    ? Math.round(donationAmount * FURUSATO_AVERAGE_GIFT_COST_RATE.toDecimal())
    : 0;
  const estimatedShippingCost = isPositiveDonation
    ? Math.round(donationAmount * FURUSATO_AVERAGE_SHIPPING_COST_RATE.toDecimal())
    : 0;
  // Sum the rounded components so displayed breakdown rows always reconcile exactly.
  const estimatedEconomicBenefit = estimatedGiftsValue + estimatedShippingCost;
  const totalBenefit = prior + estimatedEconomicBenefit;
  const remainingDeductionAllowance = Math.max(0, specialDeduction - totalBenefit);
  const netBeforeGifts = Math.max(0, prior - specialDeduction);
  const netWithGifts = Math.max(0, totalBenefit - specialDeduction);
  const netTemporaryIncome = netWithGifts - netBeforeGifts;
  const taxableTemporaryIncome =
    Math.floor(netWithGifts / TEMPORARY_INCOME_INCLUSION_DIVISOR) -
    Math.floor(netBeforeGifts / TEMPORARY_INCOME_INCLUSION_DIVISOR);

  return {
    estimatedGiftsValue,
    estimatedShippingCost,
    estimatedEconomicBenefit,
    specialDeduction,
    remainingDeductionAllowance,
    netTemporaryIncome,
    taxableTemporaryIncome,
  };
};

export interface OneStopEligibilityInputs {
  hasTaxableTemporaryIncome: boolean;
  hasEmploymentIncome: boolean;
  grossEmploymentIncome: number;
  netEmploymentIncome: number;
  grossPublicPensionIncome: number;
  netPublicPensionIncome: number;
  netBusinessAndMiscIncome: number;
  businessBlueFilerDeduction: number;
  hasRealEstateIncome: boolean;
  incomeStreams: readonly IncomeStream[];
  hasReportedInvestmentIncome: boolean;
  additionalDeductionItems: readonly AdditionalDeductionItem[];
  dcPlanContributions: number;
  familyNationalPension: number;
  homeLoanCreditAmount: number;
  homeLoanMoveInYear: number | undefined;
  incomeYear: number;
  hasForeignTaxCredit: boolean;
  hasHighIncomeMinimumTax: boolean;
}

/**
 * Evaluates statutory One-Stop Exception (ワンストップ特例制度) disqualifiers from normalized
 * inputs and baseline computed figures.
 *
 * Source: Local Tax Act Suppl. Art. 7(1) & (8); Income Tax Act Arts. 120, 121, 73;
 * Local Tax Act Arts. 45-2 & 317-2.
 */
export const evaluateOneStopIneligibilityReasons = (
  params: OneStopEligibilityInputs,
): OneStopIneligibilityReason[] => {
  const reasons: OneStopIneligibilityReason[] = [];
  const hasHomeLoanCredit = params.homeLoanCreditAmount > 0;

  if (params.hasTaxableTemporaryIncome) {
    reasons.push('taxableTemporaryIncome');
  }
  if (params.grossEmploymentIncome > MANDATORY_RETURN_SALARY_THRESHOLD) {
    reasons.push('employmentIncomeOverThreshold');
  }
  if (params.grossPublicPensionIncome > MANDATORY_RETURN_PENSION_THRESHOLD) {
    reasons.push('publicPensionOverThreshold');
  }
  if (params.netBusinessAndMiscIncome !== 0 || params.businessBlueFilerDeduction > 0) {
    reasons.push('businessOrMiscIncome');
  }
  if (params.hasRealEstateIncome) {
    reasons.push('realEstateIncome');
  }
  if (
    params.incomeStreams.some(
      s => s.type === 'stockCompensation' && s.amount > 0 && s.issuerDomicile === 'foreign',
    )
  ) {
    reasons.push('foreignStockCompensation');
  }
  if (
    params.incomeStreams.some(
      s => s.type === 'publicPension' && s.amount > 0 && s.payerDomicile === 'foreign',
    )
  ) {
    reasons.push('foreignPublicPension');
  }
  // Local Tax Act Suppl. Art. 7(1) disqualifies anyone required to file a residence tax return
  // for non-donation reasons. Local Tax Act Arts. 45-2(1) & 317-2(1) proviso only exempts
  // taxpayers with no income outside salary OR no income outside public pension
  // (給与所得以外の所得又は公的年金等に係る所得以外の所得を有しなかったもの); positive net
  // income in both categories falls outside the statutory exemption even when ≤ ¥200,000.
  if (params.netEmploymentIncome > 0 && params.netPublicPensionIncome > 0) {
    reasons.push('employmentAndPublicPension');
  }
  if (
    !params.hasEmploymentIncome &&
    params.grossPublicPensionIncome > 0 &&
    (params.dcPlanContributions > 0 ||
      params.additionalDeductionItems.some(
        item => item.key === 'lifeInsurance' || item.key === 'earthquakeInsurance',
      ) ||
      hasHomeLoanCredit ||
      params.familyNationalPension > 0)
  ) {
    reasons.push('pensionerUnwithheldDeductions');
  }
  if (params.hasReportedInvestmentIncome) {
    reasons.push('reportedInvestmentIncome');
  }
  if (params.additionalDeductionItems.some(item => item.key === 'medical')) {
    reasons.push('medicalExpensesDeduction');
  }
  if (hasHomeLoanCredit && params.homeLoanMoveInYear === params.incomeYear) {
    reasons.push('homeLoanFirstYear');
  }
  if (params.hasForeignTaxCredit) {
    reasons.push('foreignTaxCredit');
  }
  if (params.hasHighIncomeMinimumTax) {
    reasons.push('highIncomeMinimumTax');
  }

  return reasons;
};

/**
 * Returns the engine-evaluated reasons why the One-Stop Exception system (ワンストップ特例制度)
 * cannot be used for {@link TakeHomeResults}, or an empty array when eligible or when `oneStop`
 * is absent (e.g. zero donation limit).
 */
export const getOneStopIneligibilityReasons = (
  results: TakeHomeResults,
): OneStopIneligibilityReason[] =>
  results.furusatoNozei.oneStop && !results.furusatoNozei.oneStop.eligible
    ? [...results.furusatoNozei.oneStop.ineligibleReasons]
    : [];
