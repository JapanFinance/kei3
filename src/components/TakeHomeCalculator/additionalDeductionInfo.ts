// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { INCOME_ADJUSTMENT_EMPLOYMENT_INCOME_THRESHOLD } from '../../data/netEmploymentIncome';
import type { AdditionalDeductionItem, PersonalDeductionItem } from '../../types/tax';
import { formatJPY } from '../../utils/formatters';
import {
  getSingleParentChildIncomeLimit,
  WIDOW_SINGLE_PARENT_INCOME_LIMIT,
} from '../../utils/personalDeductions';

/**
 * Display + explanatory metadata for a deduction entered in the Additional Deductions & Credits
 * modal — the additional income deductions and the taxpayer's own 人的控除 alike — shared between
 * the modal (the tooltip next to each computed readout) and the Taxes-tab breakdown tooltip, so
 * the "how was this computed" explanation can't drift between the two.
 *
 * These deductions are computed for the user from amounts they already know, so the explanation
 * belongs next to the *result* — unlike the home loan credit, whose accordion explains how to
 * work out the figure the user must enter.
 */
export interface AdditionalDeductionInfo {
  /** English deduction name; shown as the primary label in tooltips (we don't assume readers know
   * Japanese). The Japanese term is still available via {@link sourceLabel}. */
  name: string;
  /** How the displayed amount is computed — explains why it may differ from the raw figures. */
  explanation: string;
  /** Official source link text. */
  sourceLabel: string;
  /** Official source link URL. */
  sourceUrl: string;
}

export const ADDITIONAL_DEDUCTION_INFO: Record<
  AdditionalDeductionItem['key'],
  AdditionalDeductionInfo
> = {
  lifeInsurance: {
    name: 'Life insurance',
    explanation:
      'Each category is computed from its premiums on a sliding scale, then capped (new contracts ¥40,000 income tax / ¥28,000 residence; old contracts ¥50,000 / ¥35,000), with an overall cap of ¥120,000 / ¥70,000. With both new and old policies in a category, the most favourable method is used. For 2026–2027, a household with a dependent under 23 gets the general (new) cap for income tax raised to ¥60,000.',
    sourceLabel: '生命保険料控除 (NTA No.1140)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm',
  },
  earthquakeInsurance: {
    name: 'Earthquake insurance',
    explanation:
      'The earthquake premium is deductible in full up to ¥50,000 for income tax, and at half up to ¥25,000 for residence tax. A 旧長期損害保険料 portion can be added, with the combined deduction capped at ¥50,000 / ¥25,000.',
    sourceLabel: '地震保険料控除 (NTA No.1145)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1145.htm',
  },
  medical: {
    name: 'Medical expenses',
    explanation:
      'The deduction is the medical expenses minus any reimbursements, minus the lower of ¥100,000 and 5% of total net income, capped at ¥2,000,000.',
    sourceLabel: '医療費控除 (NTA No.1120)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',
  },
};

/**
 * The same metadata for the taxpayer's own 人的控除, keyed by income year so every figure in the
 * copy is derived from the statutory tables ({@link WIDOW_SINGLE_PARENT_INCOME_LIMIT},
 * {@link getSingleParentChildIncomeLimit}, {@link INCOME_ADJUSTMENT_EMPLOYMENT_INCOME_THRESHOLD})
 * rather than repeated as literals that could drift. Kept separate from
 * {@link ADDITIONAL_DEDUCTION_INFO} because the two are keyed by different item unions, and only
 * these affect the residence-tax 調整控除.
 */
export const getPersonalDeductionInfo = (
  incomeYear: number,
): Record<PersonalDeductionItem['key'], AdditionalDeductionInfo> => ({
  disability: {
    name: 'Disability',
    explanation: `There is no income limit. Those who qualify for the special category with employment income over ${formatJPY(INCOME_ADJUSTMENT_EMPLOYMENT_INCOME_THRESHOLD)} also receive an additional deduction to employment income.`,
    sourceLabel: '障害者控除 (NTA No.1160)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm',
  },
  widow: {
    name: 'Widow',
    explanation: `Divorced women with a dependent relative or bereaved women (no dependent required) who have not remarried and whose total net income is ${formatJPY(WIDOW_SINGLE_PARENT_INCOME_LIMIT)} or less qualify. Not available to anyone who qualifies for the larger single parent deduction.`,
    sourceLabel: '寡婦控除 (NTA No.1170)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1170.htm',
  },
  singleParent: {
    name: 'Single parent',
    explanation: `The unmarried taxpayer must support a child on the same household budget (生計を一にする子) and have a total net income of ${formatJPY(WIDOW_SINGLE_PARENT_INCOME_LIMIT)} or less. The child's total income must be ${formatJPY(getSingleParentChildIncomeLimit(incomeYear))} or less. Whether the parent is the mother or the father changes the personal deduction difference used in the residence tax adjustment credit.`,
    sourceLabel: 'ひとり親控除 (NTA No.1171)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1171.htm',
  },
});
