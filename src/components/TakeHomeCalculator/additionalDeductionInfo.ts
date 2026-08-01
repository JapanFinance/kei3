// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdditionalDeductionItem, PersonalDeductionItem } from '../../types/tax';

/**
 * Display + explanatory metadata for an additional income deduction, shared between the
 * Additional Deductions modal (the tooltip next to each computed readout) and the Taxes-tab
 * breakdown tooltip, so the "how was this computed" explanation can't drift between the two.
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
 * The same metadata for the taxpayer's own 人的控除. Kept separate from
 * {@link ADDITIONAL_DEDUCTION_INFO} because the two are keyed by different item unions, and only
 * these affect the residence-tax 調整控除.
 */
export const PERSONAL_DEDUCTION_INFO: Record<
  PersonalDeductionItem['key'],
  AdditionalDeductionInfo
> = {
  disability: {
    name: 'Disability',
    explanation:
      'A flat ¥270,000 income tax / ¥260,000 residence tax for a 障害者, or ¥400,000 / ¥300,000 for a 特別障害者. There is no income limit. A 特別障害者 with employment income over ¥8,500,000 also qualifies for the 所得金額調整控除.',
    sourceLabel: '障害者控除 (NTA No.1160)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm',
  },
  widow: {
    name: 'Widow',
    explanation:
      'A flat ¥270,000 income tax / ¥260,000 residence tax, for a woman who has not remarried and whose total net income is ¥5,000,000 or less — either divorced with a dependent relative, or bereaved (no dependent needed). Not available to anyone who qualifies as a single parent, who gets the larger ひとり親控除 instead.',
    sourceLabel: '寡婦控除 (NTA No.1170)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1170.htm',
  },
  singleParent: {
    name: 'Single parent',
    explanation:
      'A flat ¥350,000 income tax / ¥300,000 residence tax, regardless of marital history or gender, for an unmarried taxpayer with a 生計を一にする子 whose total income is within the threshold (¥580,000 from 2025) and whose own total net income is ¥5,000,000 or less. Whether the parent is the mother or the father changes no amount, but it does change the 人的控除額の差 behind the residence-tax adjustment credit.',
    sourceLabel: 'ひとり親控除 (NTA No.1171)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1171.htm',
  },
};
