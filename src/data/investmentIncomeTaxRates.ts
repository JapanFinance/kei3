// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Withholding rates for investment income taxed 申告不要 (not on the return), indexed by
 * income year. The rates have been unchanged since the 上場株式等 regime's 2014-01-01 start
 * (the 2013-12-31 sunset of the 10% 軽減税率); a new period is added only if that changes.
 *
 * Sources:
 * - 上場株式等の譲渡所得等 15%: 租税特別措置法第37条の11第1項
 *   https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_6-At_37_11
 * - 上場株式等の配当等 15%: 租税特別措置法第8条の4第1項
 *   https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_2-At_8_4
 * - 上場株式等の配当等の源泉徴収税率 15%: 租税特別措置法第9条の3
 *   https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_2-At_9_3
 * - 一般利子等 15% (源泉分離課税): 租税特別措置法第3条第1項
 *   https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_1-At_3
 * - 復興特別所得税 2.1% (基準所得税額に対する付加税, 2013-01-01〜2037-12-31):
 *   東日本大震災からの復興のための施策を実施するために必要な財源の確保に関する特別措置法第13条・第28条
 * - 配当割 5%: 地方税法第71条の28
 *   https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_3-At_71_28
 * - 株式等譲渡所得割 5%: 地方税法第71条の49
 *   https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_3-At_71_49
 * - 利子割 5%: 地方税法第71条の6
 *   https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_3-At_71_6
 *
 * Combined rates: national 15.315% = 15% + (15% × 2.1%); residence 5% (no surtax).
 * Verified that plain `amount * rate` followed by `Math.floor` matches exact rational
 * arithmetic for every whole-yen amount from ¥0 to ¥50,000,000 at both 0.15315 and 0.05 — no
 * integer-scaled arithmetic is needed for these particular rates.
 */

export interface InvestmentIncomeTaxRatePeriod {
  /** The income year (calendar year) from which these rates apply (inclusive). */
  effectiveYear: number;
  /** 所得税 rate on 上場株式等の譲渡所得等 and 配当等, including the 復興特別所得税 fold-in. */
  listedNationalRate: number;
  /** 住民税 rate (配当割・株式等譲渡所得割 combined) on the same. */
  listedResidenceRate: number;
  /** 所得税 rate on 一般利子等 (源泉分離課税), including the 復興特別所得税 fold-in. */
  depositInterestNationalRate: number;
  /** 住民税 rate (利子割) on the same. */
  depositInterestResidenceRate: number;
}

/** Time-series of investment-income withholding rates, sorted newest-first. */
export const INVESTMENT_INCOME_TAX_RATE_PERIODS: ReadonlyArray<InvestmentIncomeTaxRatePeriod> = [
  {
    effectiveYear: 2014,
    listedNationalRate: 0.15315,
    listedResidenceRate: 0.05,
    depositInterestNationalRate: 0.15315,
    depositInterestResidenceRate: 0.05,
  },
];

if (import.meta.env.DEV) {
  // Validate that the periods are sorted newest-first
  for (let i = 1; i < INVESTMENT_INCOME_TAX_RATE_PERIODS.length; i++) {
    const prev = INVESTMENT_INCOME_TAX_RATE_PERIODS[i - 1]!.effectiveYear;
    const curr = INVESTMENT_INCOME_TAX_RATE_PERIODS[i]!.effectiveYear;
    if (prev <= curr) {
      throw new Error(
        `INVESTMENT_INCOME_TAX_RATE_PERIODS must be sorted newest-first, ` +
          `but entry ${i - 1} (year ${prev}) is not after entry ${i} (year ${curr})`,
      );
    }
  }
}

/**
 * Returns the investment-income withholding rates applicable for the given income year.
 * Finds the most recent period whose effectiveYear is on or before the given year.
 *
 * @param year Income year (calendar year the income was earned)
 */
export const getInvestmentIncomeTaxRates = (year: number): InvestmentIncomeTaxRatePeriod => {
  for (const period of INVESTMENT_INCOME_TAX_RATE_PERIODS) {
    if (year >= period.effectiveYear) {
      return period;
    }
  }
  // Fallback to the oldest known rates
  return INVESTMENT_INCOME_TAX_RATE_PERIODS[INVESTMENT_INCOME_TAX_RATE_PERIODS.length - 1]!;
};
