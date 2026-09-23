// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getInvestmentIncomeTaxRates } from '../data/investmentIncomeTaxRates';
import type { InvestmentIncomeAmounts, WithheldInvestmentTax } from '../types/tax';

/** Whether any of the three investment-income amounts is non-zero. */
export const hasInvestmentIncome = (amounts: InvestmentIncomeAmounts): boolean =>
  amounts.capitalGains !== 0 || amounts.dividends !== 0 || amounts.interest !== 0;

/**
 * Tax withheld at source on investment income under 申告不要 — see {@link WithheldInvestmentTax}.
 *
 * Listed-share gains and dividends are netted within a single 特定口座（源泉徴収あり）before
 * withholding: a 譲渡損 in {@link InvestmentIncomeAmounts.capitalGains} offsets
 * {@link InvestmentIncomeAmounts.dividends} for the year, as the broker does at year end
 * (措法37条の11の6). Phase 1 models one combined account, so every reported amount nets
 * together; losses across separate accounts that are not reported do not offset each other
 * (disclosed limitation).
 *
 * {@link InvestmentIncomeAmounts.interest} is assumed non-negative, validated where the
 * amounts are gathered.
 */
export const calculateWithheldInvestmentTax = (
  amounts: InvestmentIncomeAmounts,
  year: number,
): WithheldInvestmentTax => {
  const rates = getInvestmentIncomeTaxRates(year);

  const listedBase = Math.max(0, amounts.capitalGains + amounts.dividends);
  const listedNational = Math.floor(listedBase * rates.listedNationalRate);
  const listedResidence = Math.floor(listedBase * rates.listedResidenceRate);

  const interestNational = Math.floor(amounts.interest * rates.interestNationalRate);
  const interestResidence = Math.floor(amounts.interest * rates.interestResidenceRate);

  const national = listedNational + interestNational;
  const residence = listedResidence + interestResidence;

  return { national, residence, total: national + residence };
};
