// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  getLongTermCareCategory1ParamsForMonth,
  type LongTermCareCategory1Params,
  type LongTermCareStandardTierTable,
} from '../data/longTermCareCategory1Params';
import type { LongTermCareCategory1Estimate } from '../types/healthInsurance';

/**
 * The facts about the insured person that the 所得段階 judgment reads. All of them describe the
 * previous year's income or the taxation the municipality derives from it; the calculator applies
 * the modeled year's figures, the same simplification the NHI and 後期高齢者医療 premiums use.
 */
export interface LongTermCareCategory1TierInputs {
  /** 合計所得金額. */
  totalNetIncome: number;
  /** 公的年金等の収入金額 (taxable public pension revenue). */
  grossPublicPensionIncome: number;
  /** 公的年金等に係る雑所得, removed from {@link totalNetIncome} for the 年金収入等 tests. */
  netPublicPensionIncome: number;
  /** Whether the person themselves is 住民税課税 (tiers 6-13 when true). */
  taxpayerIsTaxable: boolean;
  /**
   * Whether any other 世帯 member is 住民税課税 — splits tiers 1-3 (世帯全員が非課税) from
   * tiers 4-5 (本人非課税で世帯に課税者がいる). Read only when {@link taxpayerIsTaxable} is false.
   */
  householdHasOtherTaxableMember: boolean;
}

/** The 1-based 所得段階, as {@link judgeLongTermCareCategory1Tier} describes it. */
function incomeTierFor(
  inputs: LongTermCareCategory1TierInputs,
  tiers: LongTermCareStandardTierTable,
): number {
  if (inputs.taxpayerIsTaxable) {
    const bracket = tiers.taxedIncomeBracketUpperBounds.findIndex(
      bound => inputs.totalNetIncome < bound,
    );
    return bracket === -1 ? 13 : 6 + bracket;
  }

  const pensionIncomeEtc =
    inputs.grossPublicPensionIncome + (inputs.totalNetIncome - inputs.netPublicPensionIncome);
  if (inputs.householdHasOtherTaxableMember) {
    return pensionIncomeEtc <= tiers.tier1PensionIncomeEtcMax ? 4 : 5;
  }
  if (pensionIncomeEtc <= tiers.tier1PensionIncomeEtcMax) return 1;
  return pensionIncomeEtc <= tiers.tier2PensionIncomeEtcMax ? 2 : 3;
}

/**
 * Judges the national-standard 所得段階 (施行令第38条第1項). Tier 1 also covers 被保護者 and
 * 世帯非課税 recipients of 老齢福祉年金 regardless of income; neither status is modeled, so those
 * cases resolve through the income test alone.
 *
 * @returns The 1-based tier and its multiplier.
 */
export function judgeLongTermCareCategory1Tier(
  inputs: LongTermCareCategory1TierInputs,
  tiers: LongTermCareStandardTierTable,
): { tier: number; multiplier: number } {
  const tier = incomeTierFor(inputs, tiers);
  return { tier, multiplier: tiers.multipliers[tier - 1]! };
}

/**
 * Multipliers carry at most three decimals, so scaling by this factor keeps 基準額 × 乗率 in
 * integer arithmetic before the ¥100 floor, avoiding binary-float products that land just below
 * an exact ¥100 multiple.
 */
const MULTIPLIER_SCALE = 1_000;

/** One fiscal year's annual premium: 基準額(年額) × 乗率, rounded down to ¥100. */
function annualPremiumForParams(
  inputs: LongTermCareCategory1TierInputs,
  params: LongTermCareCategory1Params,
): number {
  const { multiplier } = judgeLongTermCareCategory1Tier(inputs, params.tiers);
  const scaled = params.annualBase * Math.round(multiplier * MULTIPLIER_SCALE);
  return Math.floor(scaled / (MULTIPLIER_SCALE * 100)) * 100;
}

/**
 * Estimates the annual 介護保険 第1号被保険者 premium for a calendar year: the prefecture-average
 * (or national-average) 基準額 times the national-standard 所得段階 multiplier.
 *
 * A calendar year straddles two fiscal years. The premium is collected on the same
 * 特別徴収 calendar as the 後期高齢者医療 premium — six bimonthly pension deductions with the
 * April-August 仮徴収 held at the previous February's level — so the same 1/3 previous FY :
 * 2/3 current FY weighting applies; `calculateLatterStageElderlyPremium` in
 * healthInsuranceCalculator.ts derives that ratio. Within one parameter period the blend
 * collapses to a single calculation.
 */
export function estimateLongTermCareCategory1Premium(
  inputs: LongTermCareCategory1TierInputs,
  year: number,
  region: string,
): LongTermCareCategory1Estimate {
  // January resolves to the previous fiscal year's parameters, April to the current ones.
  const prevFYParams = getLongTermCareCategory1ParamsForMonth(region, year, 0);
  const currFYParams = getLongTermCareCategory1ParamsForMonth(region, year, 3);

  const currFYPremium = annualPremiumForParams(inputs, currFYParams);
  const total =
    prevFYParams.periodId === currFYParams.periodId
      ? currFYPremium
      : Math.round(annualPremiumForParams(inputs, prevFYParams) / 3 + (currFYPremium * 2) / 3);

  const { tier, multiplier } = judgeLongTermCareCategory1Tier(inputs, currFYParams.tiers);
  return {
    tier,
    multiplier,
    annualBase: currFYParams.annualBase,
    baseScope: currFYParams.baseScope,
    total,
  };
}
