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
  /** Label of the button that adds a stream to this category. */
  addLabel: string;
  /** Colour of each stream's type chip and of the group subtotal chip. */
  chipColor: NonNullable<ChipProps['color']>;
}

/** Categories in display order. */
export const INCOME_CATEGORIES: readonly IncomeCategory[] = [
  {
    key: 'employment',
    heading: 'Employment Income (給与所得)',
    addLabel: 'Add Employment Income',
    chipColor: 'primary',
  },
  {
    key: 'business',
    heading: 'Business Income (事業所得)',
    addLabel: 'Add Business Income',
    chipColor: 'success',
  },
  {
    key: 'miscellaneous',
    heading: 'Miscellaneous Income (雑所得)',
    addLabel: 'Add Miscellaneous Income',
    chipColor: 'warning',
  },
  {
    key: 'publicPension',
    heading: 'Public Pension Income (公的年金等)',
    addLabel: 'Add Public Pension',
    chipColor: 'secondary',
  },
  {
    key: 'investment',
    heading: 'Investment Income (配当・譲渡・利子)',
    addLabel: 'Add Investment Income',
    chipColor: 'info',
  },
];

export const getIncomeCategory = (key: IncomeCategoryKey): IncomeCategory =>
  INCOME_CATEGORIES.find(category => category.key === key)!;

export interface IncomeStreamTypeInfo {
  label: string;
  category: IncomeCategoryKey;
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
    chipLabel: 'SALARY',
    amountLabel: 'Gross Income',
    amountHelperText: 'Gross income before taxes and deductions',
  },
  bonus: {
    label: 'Bonus',
    category: 'employment',
    chipLabel: 'BONUS',
    amountLabel: 'Gross Income',
    amountHelperText: 'Gross bonus amount before taxes and deductions',
  },
  commutingAllowance: {
    label: 'Commuting Allowance',
    category: 'employment',
    chipLabel: 'COMMUTING',
    amountLabel: 'Allowance Amount',
    amountHelperText: `Commuting allowance up to ${formatJPY(COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP)} per month is non-taxable for income tax, but the full amount affects social insurance premiums.`,
    maxCount: 1,
  },
  stockCompensation: {
    label: 'Stock-Based Compensation',
    category: 'employment',
    chipLabel: 'STOCK',
    amountLabel: 'Gross Income',
  },
  business: {
    label: 'Business',
    category: 'business',
    chipLabel: 'BUSINESS',
    amountLabel: 'Annual Net Income',
    amountHelperText:
      'Business income minus business expenses. For multiple businesses, combine the income across all businesses.',
    maxCount: 1,
  },
  miscellaneous: {
    label: 'Miscellaneous',
    category: 'miscellaneous',
    chipLabel: 'MISCELLANEOUS',
    amountLabel: 'Annual Net Income',
    amountHelperText: 'Income minus necessary expenses',
  },
  publicPension: {
    label: 'Public Pension',
    category: 'publicPension',
    chipLabel: 'PENSION',
    amountLabel: 'Annual Gross Pension Income',
    amountHelperText:
      'Public pension income received in the year, before withholding. The public pension deduction is applied automatically.',
  },
  listedCapitalGains: {
    label: 'Listed Share Capital Gains',
    category: 'investment',
    chipLabel: 'CAPITAL GAINS',
    amountLabel: 'Annual Net Capital Gains',
    amountHelperText:
      'Net of costs, across a 特定口座（源泉徴収あり）. Enter a loss as a negative amount. Exclude NISA amounts.',
  },
  listedDividends: {
    label: 'Listed Share Dividends',
    category: 'investment',
    chipLabel: 'DIVIDENDS',
    amountLabel: 'Annual Gross Dividends',
    amountHelperText:
      'Before withholding. Includes 公募株式投資信託の分配金 and 特定公社債の利子. For foreign shares, enter the amount after any foreign withholding tax. Exclude NISA amounts.',
  },
  depositInterest: {
    label: 'Deposit Interest',
    category: 'investment',
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
