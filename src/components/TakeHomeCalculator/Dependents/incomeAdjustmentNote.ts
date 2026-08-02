// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatJPY } from '../../../utils/formatters';

/**
 * Tooltip copy for the 所得金額調整控除 folded into a dependent's or spouse's net employment
 * income. With one variant applying, the total and its reason read as a single clause; with both,
 * the total is broken down per variant. Returns null when neither applies, which is also the
 * signal not to render a tooltip at all.
 *
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm
 */
export function describeIncomeAdjustmentDeduction(
  incomeAdjustmentDeduction: number,
  pensionIncomeAdjustmentDeduction: number,
): string | null {
  const reasons: { amount: number; clause: string }[] = [];

  if (incomeAdjustmentDeduction > 0) {
    reasons.push({
      amount: incomeAdjustmentDeduction,
      clause:
        `for special disability status (特別障害者) with employment income over ¥8,500,000 — ` +
        `10% of the excess, up to ¥150,000`,
    });
  }
  if (pensionIncomeAdjustmentDeduction > 0) {
    reasons.push({
      amount: pensionIncomeAdjustmentDeduction,
      clause:
        `for having both net employment and public pension income ` +
        `(給与所得と年金所得の双方を有する者) — each capped at ¥100,000, less ¥100,000`,
    });
  }

  if (reasons.length === 0) return null;

  const total = incomeAdjustmentDeduction + pensionIncomeAdjustmentDeduction;
  const lead = `Net of a ${formatJPY(total)} income amount adjustment deduction (所得金額調整控除)`;

  if (reasons.length === 1) return `${lead} ${reasons[0]!.clause}.`;

  return `${lead}: ${reasons.map(r => `${formatJPY(r.amount)} ${r.clause}`).join('; and ')}.`;
}
