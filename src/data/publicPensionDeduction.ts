// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Public pension deduction (公的年金等控除) parameters, indexed by income year.
 *
 * Converts gross public pension income (公的年金等の収入金額) into net pension income
 * (公的年金等に係る雑所得). The calculation is parameterized directly from the statute rather
 * than from the NTA's precomputed 速算表 — the tests pin the 速算表 values, so the two official
 * sources cross-validate each other:
 *
 *  - 所得税法第35条第4項 defines the deduction per band of the recipient's total net income other
 *    than public pension income (公的年金等に係る雑所得以外の合計所得金額). Each band's deduction
 *    is a fixed amount (第1〜3号イ) plus a variable component every band shares (第2号ロ・第3号ロ
 *    are 「前号ロ／第一号ロに掲げる金額」): progressive brackets applied to the remainder of the
 *    gross amount after subtracting the
 *    {@link PublicPensionDeductionPeriod.pensionIncomeAllowance}. Each band also guarantees its
 *    own minimum deduction.
 *  - 租税特別措置法第41条の15の3 replaces each band's
 *    {@link PublicPensionDeductionBand.minimumDeduction} with its
 *    {@link PublicPensionDeductionBand.minimumDeduction65Plus} for recipients aged 65 or older on
 *    December 31 of the income year (同条第4項).
 *
 * @see https://laws.e-gov.go.jp/law/340AC0000000033#Mp-Pa_2-Ch_2-Se_2-Ss_1-At_35 — 所得税法第35条第4項
 * @see https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_6-At_41_15_3 — 租税特別措置法第41条の15の3
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm — the precomputed 速算表
 * @see https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/03/order2/3-2_07.htm — the
 *   確定申告の手引き worksheet, which states the 1円未満切り捨て of the resulting 雑所得
 */

/**
 * One bracket (第1号ロ(1)〜(4)) of the variable component of the deduction. The statute writes
 * each stage as an accumulated amount plus a rate on the excess over the previous ceiling;
 * applying the rates progressively reproduces those accumulated amounts, so only the rates are
 * stored.
 */
export interface PublicPensionDeductionBracket {
  /** Highest remainder (gross pension income minus the allowance) this bracket covers, inclusive, in yen */
  remainderMaxInclusive: number;
  /** Percentage applied to the part of the remainder within this bracket; kept as an integer so
   * yen amounts compute exactly in floating point */
  marginalRatePercent: number;
}

/** One band (第1〜3号) of non-pension total net income, with its fixed amount and minimums. */
export interface PublicPensionDeductionBand {
  /** Highest 公的年金等に係る雑所得以外の合計所得金額 (inclusive) this band covers, in yen */
  nonPensionNetIncomeMaxInclusive: number;
  /** The band's fixed amount of the deduction (第1〜3号イ), in yen */
  fixedAmount: number;
  /** The band's minimum deduction (各号柱書の最低保障), in yen */
  minimumDeduction: number;
  /**
   * Replaces {@link minimumDeduction} for recipients 65 or older on December 31 of the income
   * year (租税特別措置法第41条の15の3), in yen
   */
  minimumDeduction65Plus: number;
}

/** The complete deduction parameter set effective from a given income year. */
export interface PublicPensionDeductionPeriod {
  /** The income year (calendar year) from which these parameters apply (inclusive) */
  effectiveYear: number;
  /** Subtracted from gross pension income to form the remainder the brackets apply to (第1号ロ柱書), in yen */
  pensionIncomeAllowance: number;
  /** The brackets of the variable component of the deduction (第1号ロ), shared by every band */
  brackets: ReadonlyArray<PublicPensionDeductionBracket>;
  /** The fixed amounts and minimum guarantees per band of non-pension income (第1〜3号) */
  bands: ReadonlyArray<PublicPensionDeductionBand>;
}

/**
 * Time-series of public pension deduction parameters, sorted newest-first.
 */
export const PUBLIC_PENSION_DEDUCTION_PERIODS: ReadonlyArray<PublicPensionDeductionPeriod> = [
  {
    effectiveYear: 2020,
    pensionIncomeAllowance: 500_000,
    brackets: [
      { remainderMaxInclusive: 3_600_000, marginalRatePercent: 25 },
      { remainderMaxInclusive: 7_200_000, marginalRatePercent: 15 },
      { remainderMaxInclusive: 9_500_000, marginalRatePercent: 5 },
      { remainderMaxInclusive: Number.POSITIVE_INFINITY, marginalRatePercent: 0 },
    ],
    bands: [
      {
        nonPensionNetIncomeMaxInclusive: 10_000_000,
        fixedAmount: 400_000,
        minimumDeduction: 600_000,
        minimumDeduction65Plus: 1_100_000,
      },
      {
        nonPensionNetIncomeMaxInclusive: 20_000_000,
        fixedAmount: 300_000,
        minimumDeduction: 500_000,
        minimumDeduction65Plus: 1_000_000,
      },
      {
        nonPensionNetIncomeMaxInclusive: Number.POSITIVE_INFINITY,
        fixedAmount: 200_000,
        minimumDeduction: 400_000,
        minimumDeduction65Plus: 900_000,
      },
    ],
  },
];

if (import.meta.env.DEV) {
  for (let i = 1; i < PUBLIC_PENSION_DEDUCTION_PERIODS.length; i++) {
    const prev = PUBLIC_PENSION_DEDUCTION_PERIODS[i - 1]!.effectiveYear;
    const curr = PUBLIC_PENSION_DEDUCTION_PERIODS[i]!.effectiveYear;
    if (prev <= curr) {
      throw new Error(
        `PUBLIC_PENSION_DEDUCTION_PERIODS must be sorted newest-first, ` +
          `but entry ${i - 1} (year ${prev}) is not after entry ${i} (year ${curr})`,
      );
    }
  }
}

const getPublicPensionDeductionPeriod = (year: number): PublicPensionDeductionPeriod => {
  for (const period of PUBLIC_PENSION_DEDUCTION_PERIODS) {
    if (year >= period.effectiveYear) {
      return period;
    }
  }
  return PUBLIC_PENSION_DEDUCTION_PERIODS[PUBLIC_PENSION_DEDUCTION_PERIODS.length - 1]!;
};

/**
 * Calculate net public pension income (公的年金等に係る雑所得) from the gross amount.
 *
 * @param grossPublicPension  Gross public pension income (公的年金等の収入金額), in yen
 * @param is65OrOlder         Whether the recipient is 65 or older on December 31 of the income year
 * @param otherTotalNetIncome The recipient's total net income excluding public pension income
 *                            (公的年金等に係る雑所得以外の合計所得金額), in yen
 * @param year                Income year for the parameter lookup
 */
export function calculateNetPublicPensionIncome(
  grossPublicPension: number,
  is65OrOlder: boolean,
  otherTotalNetIncome: number,
  year: number,
): number {
  const period = getPublicPensionDeductionPeriod(year);
  const band = period.bands.find(b => otherTotalNetIncome <= b.nonPensionNetIncomeMaxInclusive)!;

  // The variable component (ロ): apply each bracket's rate to the part of the remainder it covers
  const remainder = Math.max(0, grossPublicPension - period.pensionIncomeAllowance);
  let variableComponent = 0;
  let previousCeiling = 0;
  for (const bracket of period.brackets) {
    const portionWithinBracket =
      Math.min(remainder, bracket.remainderMaxInclusive) - previousCeiling;
    if (portionWithinBracket <= 0) {
      break;
    }
    variableComponent += (portionWithinBracket * bracket.marginalRatePercent) / 100;
    previousCeiling = bracket.remainderMaxInclusive;
  }

  // Fixed amount plus variable component, no lower than the band's minimum deduction
  const minimumDeduction = is65OrOlder ? band.minimumDeduction65Plus : band.minimumDeduction;
  const deduction = Math.max(band.fixedAmount + variableComponent, minimumDeduction);

  // The 確定申告の手引き worksheet drops any fraction of a yen from the resulting 雑所得
  // (1円未満の端数があるときは、その端数を切り捨てます).
  return Math.max(0, Math.floor(grossPublicPension - deduction));
}
