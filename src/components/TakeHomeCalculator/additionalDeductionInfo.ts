// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdditionalDeductionItem } from '../../types/tax';

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
  /** Japanese deduction name; used as the tooltip title. */
  label: string;
  /** How the displayed amount is computed — explains why it may differ from the raw figures. */
  explanation: string;
  /** Official source link text and URL. */
  sourceLabel: string;
  sourceUrl: string;
}

export const ADDITIONAL_DEDUCTION_INFO: Record<
  AdditionalDeductionItem['key'],
  AdditionalDeductionInfo
> = {
  lifeInsurance: {
    label: '生命保険料控除',
    explanation:
      'Each category is computed from its premiums on a sliding scale, then capped (new contracts ¥40,000 income tax / ¥28,000 residence; old contracts ¥50,000 / ¥35,000), with an overall cap of ¥120,000 / ¥70,000. With both new and old policies in a category, the most favourable method is used. For 2026–2027, a household with a dependent under 23 gets the general (new) income-tax cap raised to ¥60,000.',
    sourceLabel: '生命保険料控除 (NTA No.1140)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm',
  },
  earthquakeInsurance: {
    label: '地震保険料控除',
    explanation:
      'The earthquake premium is deductible in full up to ¥50,000 for income tax, and at half up to ¥25,000 for residence tax. A 旧長期損害保険料 portion can be added, with the combined deduction capped at ¥50,000 / ¥25,000.',
    sourceLabel: '地震保険料控除 (NTA No.1145)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1145.htm',
  },
  medical: {
    label: '医療費控除',
    explanation:
      'The deduction is your medical expenses minus any reimbursements, minus the lower of ¥100,000 and 5% of your total income, capped at ¥2,000,000.',
    sourceLabel: '医療費控除 (NTA No.1120)',
    sourceUrl: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm',
  },
};
