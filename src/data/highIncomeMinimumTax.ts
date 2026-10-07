// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Parameters for the Minimum Tax on High Income Taxpayers
 * (特定の基準所得金額の課税の特例 / 租税特別措置法第41条の19).
 *
 * This measure ensures fair taxation for ultra-high-income individuals by imposing a minimum
 * effective national income tax on baseline income (基準所得金額) that exceeds a statutory
 * threshold, primarily targeting situations where substantial investment income taxed at a flat
 * 15% rate lowers the taxpayer's overall effective tax rate (the "¥100 million wall" / 1億円の壁).
 *
 * Statutory References:
 * - Special Tax Measures Act Art. 41-19 (租税特別措置法第41条の19):
 *   https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_6-At_41_19
 * - Order for Enforcement of the Special Tax Measures Act Art. 26-28-3-2 (租税特別措置法施行令第26条の28の3の2)
 * - Special Tax Measures Circular 41-19-2 (措法通達41の19-2)
 * - NTA Guidance: https://www.nta.go.jp/taxes/shiraberu/shinkoku/kiwataka/index.htm
 * - Calculation Sheet: https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/gengaku/01.pdf
 */

import { percentTo, type PremiumRate } from './premiumRate';

export interface HighIncomeMinimumTaxPeriod {
  /** The calendar tax year from which this period applies (inclusive). */
  effectiveYear: number;
  /** Statutory threshold / deduction (特別控除額), in yen. */
  threshold: number;
  /** Statutory tax rate (税率). */
  rate: PremiumRate;
}

const percent = percentTo(1);

/**
 * Periods for the minimum tax on high income taxpayers, sorted newest-first.
 *
 * - R9 (2027) onward: Reiwa 8 Tax Reform tightened the parameters to ¥165,000,000 deduction
 *   and 30.0% rate, effective for income year 2027 onward (令和9年分以後の所得税).
 * - R7 (2025) - R8 (2026): Reiwa 5 Tax Reform introduced the measure with ¥330,000,000 deduction
 *   and 22.5% rate, effective for income year 2025 onward (令和7年分以後の所得税).
 */
export const HIGH_INCOME_MINIMUM_TAX_PERIODS: ReadonlyArray<HighIncomeMinimumTaxPeriod> = [
  {
    effectiveYear: 2027,
    threshold: 165_000_000, // 1.65億円
    rate: percent(30), // 30.0%
  },
  {
    effectiveYear: 2025,
    threshold: 330_000_000, // 3.3億円
    rate: percent(22.5), // 22.5%
  },
];

if (import.meta.env.DEV) {
  // Validate that periods are sorted newest-first
  for (let i = 1; i < HIGH_INCOME_MINIMUM_TAX_PERIODS.length; i++) {
    const prev = HIGH_INCOME_MINIMUM_TAX_PERIODS[i - 1]!.effectiveYear;
    const curr = HIGH_INCOME_MINIMUM_TAX_PERIODS[i]!.effectiveYear;
    if (prev <= curr) {
      throw new Error(
        `HIGH_INCOME_MINIMUM_TAX_PERIODS must be sorted newest-first, ` +
          `but entry ${i - 1} (year ${prev}) is not after entry ${i} (year ${curr})`,
      );
    }
  }
}

/**
 * Returns the statutory minimum tax parameters for the given tax year.
 * Returns `undefined` for tax years before 2025, when the measure was not in force.
 *
 * @param year Income year (calendar year the income was earned)
 */
export const getHighIncomeMinimumTaxParams = (
  year: number,
): HighIncomeMinimumTaxPeriod | undefined => {
  if (year < 2025) {
    return undefined;
  }
  for (const period of HIGH_INCOME_MINIMUM_TAX_PERIODS) {
    if (year >= period.effectiveYear) {
      return period;
    }
  }
  return undefined;
};
