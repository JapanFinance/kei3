// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdditionalDeductionItem } from '../../types/tax';
import type { OfficialSourceId } from '../../data/officialSources';

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
   * Japanese). The Japanese term is still visible via {@link sources}' official titles. */
  name: string;
  /** How the displayed amount is computed — explains why it may differ from the raw figures. */
  explanation: string;
  /** Official sources backing the explanation, aggregated into the tooltip footer. */
  sources: OfficialSourceId[];
}

export const ADDITIONAL_DEDUCTION_INFO: Record<
  AdditionalDeductionItem['key'],
  AdditionalDeductionInfo
> = {
  lifeInsurance: {
    name: 'Life insurance',
    explanation:
      'Each category is computed from its premiums on a sliding scale, then capped (new contracts ¥40,000 income tax / ¥28,000 residence; old contracts ¥50,000 / ¥35,000), with an overall cap of ¥120,000 / ¥70,000. With both new and old policies in a category, the most favourable method is used. For 2026–2027, a household with a dependent under 23 gets the general (new) cap for income tax raised to ¥60,000.',
    sources: ['nta1140'],
  },
  earthquakeInsurance: {
    name: 'Earthquake insurance',
    explanation:
      'The earthquake premium is deductible in full up to ¥50,000 for income tax, and at half up to ¥25,000 for residence tax. A 旧長期損害保険料 portion can be added, with the combined deduction capped at ¥50,000 / ¥25,000.',
    sources: ['nta1145'],
  },
  medical: {
    name: 'Medical expenses',
    explanation:
      'The deduction is your medical expenses minus any reimbursements, minus the lower of ¥100,000 and 5% of your total net income, capped at ¥2,000,000.',
    sources: ['nta1120'],
  },
};
