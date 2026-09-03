// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getInvestmentIncomeTaxRates } from '../data/investmentIncomeTaxRates';
import type { InvestmentIncomeAmounts, WithheldInvestmentTax, WithheldTaxLine } from '../types/tax';

/** Whether any of the three investment-income amounts is non-zero. */
export const hasInvestmentIncome = (amounts: InvestmentIncomeAmounts): boolean =>
  amounts.listedCapitalGains !== 0 ||
  amounts.listedDividends !== 0 ||
  amounts.depositInterest !== 0;

const withholdLine = (
  base: number,
  nationalRate: number,
  residenceRate: number,
): WithheldTaxLine => ({
  base,
  national: Math.floor(base * nationalRate),
  residence: Math.floor(base * residenceRate),
});

/**
 * Tax withheld at source on investment income under 申告不要 — see {@link WithheldInvestmentTax}.
 *
 * Listed-share gains and dividends are netted within a single 特定口座（源泉徴収あり）before
 * withholding: a 譲渡損 in {@link InvestmentIncomeAmounts.listedCapitalGains} offsets
 * {@link InvestmentIncomeAmounts.listedDividends} for the year, as the broker does at year end
 * (措法37条の11の6). Phase 1 models one combined account, so every reported amount nets
 * together; losses across separate accounts that are not reported do not offset each other
 * (disclosed limitation).
 *
 * {@link InvestmentIncomeAmounts.depositInterest} is assumed non-negative, validated where the
 * amounts are gathered.
 */
export const calculateWithheldInvestmentTax = (
  amounts: InvestmentIncomeAmounts,
  year: number,
): WithheldInvestmentTax => {
  const rates = getInvestmentIncomeTaxRates(year);

  const listedBase = Math.max(0, amounts.listedCapitalGains + amounts.listedDividends);
  const listed = withholdLine(listedBase, rates.listedNationalRate, rates.listedResidenceRate);

  const depositInterest = withholdLine(
    amounts.depositInterest,
    rates.depositInterestNationalRate,
    rates.depositInterestResidenceRate,
  );

  const national = listed.national + depositInterest.national;
  const residence = listed.residence + depositInterest.residence;

  return { listed, depositInterest, national, residence, total: national + residence };
};
