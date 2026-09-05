// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ChipProps } from '@mui/material/Chip';

import { COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP } from '../../../constants/taxThresholds';
import type { IncomeStream, IncomeStreamType } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';

/**
 * The income classification (所得区分) an Advanced-mode income stream belongs to. Groups the
 * streams in {@link IncomeDetailsModal} and the types offered when adding one.
 */
export type IncomeCategoryKey =
  | 'employment'
  | 'business'
  | 'miscellaneous'
  | 'publicPension'
  | 'investment';

export interface IncomeCategory {
  key: IncomeCategoryKey;
  heading: string;
  /** Colour of each stream's type chip and of the group subtotal chip. */
  chipColor: NonNullable<ChipProps['color']>;
}

/** Categories in display order. */
export const INCOME_CATEGORIES: readonly IncomeCategory[] = [
  { key: 'employment', heading: 'Employment Income (給与所得)', chipColor: 'primary' },
  { key: 'business', heading: 'Business Income (事業所得)', chipColor: 'success' },
  { key: 'miscellaneous', heading: 'Miscellaneous Income (雑所得)', chipColor: 'warning' },
  { key: 'publicPension', heading: 'Public Pension Income (公的年金等)', chipColor: 'secondary' },
  { key: 'investment', heading: 'Investment Income (配当・譲渡・利子)', chipColor: 'info' },
];

export const getIncomeCategory = (key: IncomeCategoryKey): IncomeCategory =>
  INCOME_CATEGORIES.find(category => category.key === key)!;

export interface IncomeStreamTypeInfo {
  label: string;
  category: IncomeCategoryKey;
  /** One line shown when choosing the type to add. */
  description: string;
  /** Uppercase badge on a stream in the list; its colour comes from the category. */
  chipLabel: string;
  amountLabel: string;
  amountHelperText?: string;
  /** Maximum number of streams of this type; unlimited when omitted. */
  maxCount?: number;
}

/** Per-type presentation, in display order within each category. */
export const INCOME_STREAM_CATALOG: Record<IncomeStreamType, IncomeStreamTypeInfo> = {
  salary: {
    label: 'Salary',
    category: 'employment',
    description: 'Regular wages from an employer, entered as a monthly or annual amount.',
    chipLabel: 'SALARY',
    amountLabel: 'Gross Income',
    amountHelperText: 'Gross income before taxes and deductions',
  },
  bonus: {
    label: 'Bonus',
    category: 'employment',
    description: 'A one-off payment such as a summer or winter 賞与, with the month paid.',
    chipLabel: 'BONUS',
    amountLabel: 'Gross Income',
    amountHelperText: 'Gross bonus amount before taxes and deductions',
  },
  commutingAllowance: {
    label: 'Commuting Allowance',
    category: 'employment',
    description: `通勤手当 from the employer. Non-taxable up to ${formatJPY(COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP)} per month; one entry covers the year.`,
    chipLabel: 'COMMUTING',
    amountLabel: 'Allowance Amount',
    amountHelperText: `Commuting allowance up to ${formatJPY(COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP)} per month is non-taxable for income tax, but the full amount affects social insurance premiums.`,
    maxCount: 1,
  },
  stockCompensation: {
    label: 'Stock-Based Compensation',
    category: 'employment',
    description:
      'RSU, stock option, or ESPP income from a foreign issuer, at the JPY value realized.',
    chipLabel: 'STOCK',
    amountLabel: 'Gross Income',
  },
  business: {
    label: 'Business',
    category: 'business',
    description: 'Net income from self-employment after expenses. One entry covers all businesses.',
    chipLabel: 'BUSINESS',
    amountLabel: 'Annual Net Income',
    amountHelperText:
      'Business income minus business expenses. For multiple businesses, combine the income across all businesses.',
    maxCount: 1,
  },
  miscellaneous: {
    label: 'Miscellaneous',
    category: 'miscellaneous',
    description: 'Side income, private annuities, and other 雑所得, net of necessary expenses.',
    chipLabel: 'MISCELLANEOUS',
    amountLabel: 'Annual Net Income',
    amountHelperText: 'Income minus necessary expenses',
  },
  publicPension: {
    label: 'Public Pension',
    category: 'publicPension',
    description:
      '国民年金, 厚生年金, 共済年金, and DB/DC plan annuities such as iDeCo, gross before withholding.',
    chipLabel: 'PENSION',
    amountLabel: 'Annual Gross Pension Income',
    amountHelperText:
      'Public pension income received in the year, before withholding. The public pension deduction is applied automatically.',
  },
  listedCapitalGains: {
    label: 'Listed Share Capital Gains',
    category: 'investment',
    description: 'Net gain or loss for the year on 上場株式等 in a 特定口座（源泉徴収あり）.',
    chipLabel: 'CAPITAL GAINS',
    amountLabel: 'Annual Net Capital Gains',
    amountHelperText:
      'Net of costs, across a 特定口座（源泉徴収あり）. Enter a loss as a negative amount. Exclude NISA amounts.',
  },
  listedDividends: {
    label: 'Listed Share Dividends',
    category: 'investment',
    description: '上場株式等の配当等 and 公募株式投資信託の分配金, gross before withholding.',
    chipLabel: 'DIVIDENDS',
    amountLabel: 'Annual Gross Dividends',
    amountHelperText:
      'Before withholding. Includes 公募株式投資信託の分配金 and 特定公社債の利子. For foreign shares, enter the amount after any foreign withholding tax. Exclude NISA amounts.',
  },
  depositInterest: {
    label: 'Deposit Interest',
    category: 'investment',
    description: '預貯金の利子, taxed at source at 20.315% and never reported on a return.',
    chipLabel: 'INTEREST',
    amountLabel: 'Annual Gross Interest',
    amountHelperText:
      '預貯金の利子 and similar: taxed at source at 20.315% and never reported on a tax return.',
  },
};

export const INCOME_STREAM_TYPES = Object.keys(INCOME_STREAM_CATALOG) as IncomeStreamType[];

export const incomeStreamTypesInCategory = (category: IncomeCategoryKey): IncomeStreamType[] =>
  INCOME_STREAM_TYPES.filter(type => INCOME_STREAM_CATALOG[type].category === category);

/** Whether `streams` already holds {@link IncomeStreamTypeInfo.maxCount} streams of `type`. */
export const isIncomeStreamTypeAtLimit = (
  type: IncomeStreamType,
  streams: readonly IncomeStream[],
): boolean => {
  const max = INCOME_STREAM_CATALOG[type].maxCount;
  return max !== undefined && streams.filter(s => s.type === type).length >= max;
};
