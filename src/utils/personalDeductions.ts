// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The 人的控除 that arise from the taxpayer's own circumstances, entered in the Additional
 * Deductions & Credits modal: 障害者控除 (for the taxpayer themselves), 寡婦控除, and ひとり親控除.
 *
 * 障害者控除 for a 同一生計配偶者 or 扶養親族 is calculated in `dependentDeductions.ts` instead —
 * the amounts there include the 同居特別障害者 case, which cannot apply to the taxpayer.
 *
 * Unlike the 物的控除 in `additionalDeductions.ts`, every deduction here is a 人的控除, so each
 * carries the 人的控除額の差 that the residence-tax 調整控除 adds up (地方税法第314条の6第1号イ).
 * The difference is decided here, where the deduction amount is chosen, so the two can never
 * disagree about which category applied.
 *
 * References:
 * - 障害者控除: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm
 * - 寡婦控除: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1170.htm
 * - ひとり親控除: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1171.htm
 * - Residence tax amounts: https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html
 * - 人的控除額の差: https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 */

import type { Dependent } from '../types/dependents';
import type {
  PersonalCircumstancesInput,
  PersonalDeductionItem,
  PersonalDeductionsResult,
} from '../types/tax';
import {
  calculateDependentTotalNetIncome,
  getDependentEligibilityMax,
} from './dependentDeductions';

/**
 * Maximum 合計所得金額 for both 寡婦控除 and ひとり親控除 (所法2①三十・三十一). The other
 * statutory requirements — not having remarried, having no 事実婚 partner, and (for an ひとり親)
 * having a 生計を一にする子 whose 総所得金額等 is within the threshold — are asserted by the user,
 * since the calculator cannot observe them.
 */
export const WIDOW_SINGLE_PARENT_INCOME_LIMIT = 5_000_000;

/**
 * The ひとり親's qualifying child: 総所得金額等 limits by income year, newest-first
 * (所令11条の2第2項, delegated from 所法2条1項31号イ). Its values have tracked the 扶養親族
 * eligibility threshold's history, but the provision sets its own figure.
 * The same provision also requires the child not to be another person's 同一生計配偶者 or
 * 扶養親族, and sets no age limit.
 */
const SINGLE_PARENT_CHILD_INCOME_LIMIT_PERIODS: ReadonlyArray<{
  effectiveYear: number;
  limit: number;
}> = [
  // R8 (2026): raised from 58万 to 62万 per 令和8年度税制改正
  { effectiveYear: 2026, limit: 620_000 },
  // R7 (2025): raised from 48万 to 58万 per 令和7年度税制改正
  { effectiveYear: 2025, limit: 580_000 },
];

/** The ひとり親 qualifying child's 総所得金額等 limit for the given income year. */
export const getSingleParentChildIncomeLimit = (year: number): number => {
  for (const period of SINGLE_PARENT_CHILD_INCOME_LIMIT_PERIODS) {
    if (year >= period.effectiveYear) return period.limit;
  }
  return SINGLE_PARENT_CHILD_INCOME_LIMIT_PERIODS[
    SINGLE_PARENT_CHILD_INCOME_LIMIT_PERIODS.length - 1
  ]!.limit;
};

/**
 * Deduction amounts and their statutory 人的控除額の差, by category.
 *
 * `statutoryDifference` is the figure 地方税法第314条の6第1号イ names for the 調整控除, NOT the
 * arithmetic `national - residence`. The two coincide everywhere here except ひとり親（父）, where
 * the statute says ¥10,000 though the amounts differ by ¥50,000 — the table in the law predates
 * the 2020 merge of 寡夫控除 into ひとり親控除 and was carried over unchanged for fathers.
 *
 * The two disability rows apply the same statutory rows as the dependent-side 障害者控除 — the
 * amounts in `dependentDeductions.ts` (NATIONAL_TAX_DEDUCTIONS / RESIDENCE_TAX_DEDUCTIONS) and
 * the differences in `residenceTax.ts` (STATUTORY_DEDUCTION_DIFFERENCES) — because 所法79 and
 * 314条の6 make no taxpayer/dependent distinction. An amendment must change both sides together;
 * only 同居特別障害者 is dependent-side-only, which is why it has no row here.
 */
const PERSONAL_DEDUCTIONS = {
  /** 障害者控除（一般の障害者）— 314条の6第1号イ(1)(i) */
  disabilityRegular: { national: 270_000, residence: 260_000, statutoryDifference: 10_000 },
  /** 障害者控除（特別障害者）— 314条の6第1号イ(1)(ii) */
  disabilitySpecial: { national: 400_000, residence: 300_000, statutoryDifference: 100_000 },
  /** 寡婦控除 — 314条の6第1号イ(3) */
  widow: { national: 270_000, residence: 260_000, statutoryDifference: 10_000 },
  /** ひとり親控除（母）— 314条の6第1号イ(4) */
  singleParentMother: { national: 350_000, residence: 300_000, statutoryDifference: 50_000 },
  /** ひとり親控除（父）— 314条の6第1号イ(3) */
  singleParentFather: { national: 350_000, residence: 300_000, statutoryDifference: 10_000 },
} as const;

/**
 * Calculates the taxpayer's own 人的控除 from their selected circumstances.
 *
 * 障害者控除 has no income condition. 寡婦控除 and ひとり親控除 both stop at
 * {@link WIDOW_SINGLE_PARENT_INCOME_LIMIT}, so a selected status contributes nothing above it;
 * the two are mutually exclusive by statute and the single {@link PersonalCircumstancesInput}
 * field enforces that.
 *
 * @param circumstances The statuses the taxpayer selected
 * @param netIncome     The taxpayer's 合計所得金額, for the 寡婦/ひとり親 ceiling
 */
export const calculatePersonalDeductions = (
  circumstances: PersonalCircumstancesInput,
  netIncome: number,
): PersonalDeductionsResult => {
  const items: PersonalDeductionItem[] = [];

  if (circumstances.disability !== 'none') {
    const amounts =
      circumstances.disability === 'special'
        ? PERSONAL_DEDUCTIONS.disabilitySpecial
        : PERSONAL_DEDUCTIONS.disabilityRegular;
    items.push({ key: 'disability', ...amounts });
  }

  if (netIncome <= WIDOW_SINGLE_PARENT_INCOME_LIMIT) {
    switch (circumstances.widowOrSingleParent) {
      case 'widowDivorced':
      case 'widowBereaved':
        items.push({ key: 'widow', ...PERSONAL_DEDUCTIONS.widow });
        break;
      case 'singleParentMother':
        items.push({ key: 'singleParent', ...PERSONAL_DEDUCTIONS.singleParentMother });
        break;
      case 'singleParentFather':
        items.push({ key: 'singleParent', ...PERSONAL_DEDUCTIONS.singleParentFather });
        break;
      case 'none':
        break;
      default: {
        const unhandled: never = circumstances.widowOrSingleParent;
        throw new Error(`Unhandled widow/single parent status: ${JSON.stringify(unhandled)}`);
      }
    }
  }

  return {
    national: items.reduce((sum, item) => sum + item.national, 0),
    residence: items.reduce((sum, item) => sum + item.residence, 0),
    statutoryDifference: items.reduce((sum, item) => sum + item.statutoryDifference, 0),
    items,
  };
};

/**
 * Mismatches between the 寡婦/ひとり親 selection and the Dependents list. Advisory, not gates:
 * a spouse entry can be legitimate alongside the deduction in the year the spouse died
 * (配偶者控除 is judged at the time of death, this deduction at December 31), a qualifying child
 * or relative may simply not have been entered yet, and facts the list cannot hold — 事実婚, or
 * the child being claimed by the other parent — stay the user's to assert.
 */
export type PersonalCircumstanceWarning =
  | 'spouseEntered'
  | 'singleParentNoQualifyingChild'
  | 'widowDivorcedNoDependentRelative';

/**
 * Cross-checks the 寡婦/ひとり親 selection against the Dependents list — see
 * {@link PersonalCircumstanceWarning} for why the results are advisory. The checks:
 *
 *  - Any selection conflicts with an entered spouse (現に婚姻をしていない, 所法2①三十・三十一).
 *  - ひとり親 requires a 生計を一にする子 with 総所得金額等 within
 *    {@link getSingleParentChildIncomeLimit} (所令11条の2②) — matched against entered children.
 *  - A divorced 寡婦 (所法2①三十イ) requires a 扶養親族: any entered non-spouse relative with
 *    合計所得金額 within {@link getDependentEligibilityMax}.
 */
export const getPersonalCircumstanceWarnings = (
  circumstances: PersonalCircumstancesInput,
  dependents: Dependent[],
  year: number,
): PersonalCircumstanceWarning[] => {
  const selection = circumstances.widowOrSingleParent;
  if (selection === 'none') return [];

  const warnings: PersonalCircumstanceWarning[] = [];
  if (dependents.some(dependent => dependent.relationship === 'spouse')) {
    warnings.push('spouseEntered');
  }

  if (selection === 'singleParentMother' || selection === 'singleParentFather') {
    const hasQualifyingChild = dependents.some(
      dependent =>
        dependent.relationship === 'child' &&
        calculateDependentTotalNetIncome(dependent, year) <= getSingleParentChildIncomeLimit(year),
    );
    if (!hasQualifyingChild) warnings.push('singleParentNoQualifyingChild');
  }

  if (selection === 'widowDivorced') {
    const hasDependentRelative = dependents.some(
      dependent =>
        dependent.relationship !== 'spouse' &&
        calculateDependentTotalNetIncome(dependent, year) <= getDependentEligibilityMax(year),
    );
    if (!hasDependentRelative) warnings.push('widowDivorcedNoDependentRelative');
  }

  return warnings;
};
