// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { calculateNetPublicPensionIncome } from '../data/publicPensionDeduction';

/**
 * The ¥100,000 that caps both income terms of the
 * 所得金額調整控除（給与所得と年金所得の双方を有する者）and is then subtracted from their sum.
 */
const PENSION_INCOME_ADJUSTMENT_CAP = 100_000;

/**
 * Calculates the 所得金額調整控除（給与所得と年金所得の双方を有する者）(措法41の3の11第2項): when both
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

/** Per-category net incomes composing a 合計所得金額. */
export interface NetIncomeComponents {
  /** 給与所得, net of the 給与所得控除 and both 所得金額調整控除 variants below. */
  netEmploymentIncome: number;
  /**
   * 所得金額調整控除（子ども・特別障害者等を有する者等）, already reflected in
   * {@link netEmploymentIncome}.
   */
  incomeAdjustmentDeduction: number;
  /**
   * 所得金額調整控除（給与所得と年金所得の双方を有する者）, already reflected in
   * {@link netEmploymentIncome}.
   */
  pensionIncomeAdjustmentDeduction: number;
  /** 公的年金等に係る雑所得. */
  netPublicPensionIncome: number;
  /** 合計所得金額: the net components above plus the other net income. */
  totalNetIncome: number;
}

/** Inputs to {@link composeNetIncomeComponents}. */
export interface NetIncomeComposition {
  /**
   * 給与所得 net of the 給与所得控除 and of the 所得金額調整控除（子ども・特別障害者等）, but before the
   * 給与所得と年金所得の双方 variant, which {@link composeNetIncomeComponents} applies.
   */
  netEmploymentIncomeBeforePensionAdjustment: number;
  /** The 所得金額調整控除（子ども・特別障害者等を有する者等）already taken above, for reporting. */
  incomeAdjustmentDeduction: number;
  /** 公的年金等の収入金額, before the 公的年金等控除. */
  grossPublicPensionIncome: number;
  /** Whether the recipient is 65 or older by the end of the income year, selecting the 控除 minimums. */
  is65OrOlder: boolean;
  /** Net income of every other category (事業所得, 公的年金等以外の雑所得, and so on). */
  otherNetIncome: number;
  /** Income year for the deduction table lookups. */
  year: number;
}

/**
 * Composes a 合計所得金額 out of 給与所得, 公的年金等に係る雑所得 and the remaining net income,
 * applying the 公的年金等控除 and the 所得金額調整控除（給与所得と年金所得の双方を有する者）
 * ({@link calculatePensionIncomeAdjustmentDeduction}) in statutory order. The taxpayer and each
 * dependent differ only in how their 給与所得 is derived, so both feed this.
 */
export const composeNetIncomeComponents = ({
  netEmploymentIncomeBeforePensionAdjustment,
  incomeAdjustmentDeduction,
  grossPublicPensionIncome,
  is65OrOlder,
  otherNetIncome,
  year,
}: NetIncomeComposition): NetIncomeComponents => {
  // The band of the 公的年金等控除 keys off the 合計所得金額 computed as if there were no public
  // pension income (所法35条4項1号: 公的年金等の収入金額がないものとして計算した場合における合計所得金額).
  // Without pension income the 給与+年金 adjustment below cannot apply, so 給与所得 enters the band
  // test before that adjustment but after the 子ども・特別障害者等 variant.
  const netPublicPensionIncome = calculateNetPublicPensionIncome(
    grossPublicPensionIncome,
    is65OrOlder,
    netEmploymentIncomeBeforePensionAdjustment + otherNetIncome,
    year,
  );

  const pensionIncomeAdjustmentDeduction = calculatePensionIncomeAdjustmentDeduction(
    netEmploymentIncomeBeforePensionAdjustment,
    netPublicPensionIncome,
  );
  const netEmploymentIncome =
    netEmploymentIncomeBeforePensionAdjustment - pensionIncomeAdjustmentDeduction;

  return {
    netEmploymentIncome,
    incomeAdjustmentDeduction,
    pensionIncomeAdjustmentDeduction,
    netPublicPensionIncome,
    totalNetIncome: netEmploymentIncome + netPublicPensionIncome + otherNetIncome,
  };
};
