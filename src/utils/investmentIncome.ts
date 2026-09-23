// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getInvestmentIncomeTaxRates } from '../data/investmentIncomeTaxRates';
import type {
  InvestmentIncomeAmounts,
  ReportedInvestmentAmounts,
  SeparateNetIncome,
  WithheldInvestmentTax,
} from '../types/tax';

/** Whether any of the three withheld investment-income amounts is non-zero. */
export const hasInvestmentIncome = (amounts: InvestmentIncomeAmounts): boolean =>
  amounts.capitalGains !== 0 || amounts.dividends !== 0 || amounts.interest !== 0;

/** Whether any amount is reported under 申告分離課税. */
export const hasReportedInvestmentIncome = (amounts: ReportedInvestmentAmounts): boolean =>
  amounts.capitalGains !== 0 || amounts.dividends !== 0;

export const NO_SEPARATE_NET_INCOME: SeparateNetIncome = { capitalGains: 0, dividends: 0 };

/**
 * Tax withheld at source on investment income under 申告不要 — see {@link WithheldInvestmentTax}.
 *
 * Listed-share gains and dividends are netted within a single 特定口座（源泉徴収あり）before
 * withholding: a 譲渡損 in {@link InvestmentIncomeAmounts.capitalGains} offsets
 * {@link InvestmentIncomeAmounts.dividends} for the year, as the broker does at year end
 * (措法37条の11の6). One combined account is modelled, so every 申告不要 amount nets together;
 * losses across separate accounts that are not reported do not offset each other (disclosed
 * limitation).
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

/** How the reported amounts net against each other before any of them is taxed. */
export interface ReportedInvestmentClassification {
  /** 上場株式等に係る譲渡損失の金額 deducted from the reported dividends (措法37条の12の2①). */
  lossOffsetAgainstDividends: number;
  /** Qualifying loss the dividends did not absorb; it would carry forward (not modelled). */
  unabsorbedQualifyingLoss: number;
  /** Foreign-account loss the year's gains did not absorb; it offsets nothing. */
  nonQualifyingLoss: number;
  netIncome: SeparateNetIncome;
}

/**
 * Nets the 申告分離課税 amounts the way the return does. Every reported sale first nets into one
 * 上場株式等に係る譲渡所得等の金額 for the year, whichever account it came from. A loss left
 * after that is 上場株式等に係る譲渡損失の金額 only up to the losses realized through a licensed
 * 金融商品取引業者 or 登録金融機関 (措法37条の12の2②一〜三; 措令25条の11の2②③ caps it at the
 * sum of those qualifying losses), and only that much offsets the reported 配当等
 * (措法37条の12の2①, and 地方税法附則35条の2の6① for the 所得割). What the 配当等 do not absorb
 * would carry forward for three years, which is not modelled; a foreign-account loss that the
 * gains did not absorb is lost for the year.
 */
export const classifyReportedInvestmentIncome = (
  amounts: ReportedInvestmentAmounts,
): ReportedInvestmentClassification => {
  const loss = Math.max(0, -amounts.capitalGains);
  const qualifyingLoss = Math.min(loss, amounts.qualifyingCapitalLosses);
  const lossOffsetAgainstDividends = Math.min(qualifyingLoss, amounts.dividends);

  return {
    lossOffsetAgainstDividends,
    unabsorbedQualifyingLoss: qualifyingLoss - lossOffsetAgainstDividends,
    nonQualifyingLoss: loss - qualifyingLoss,
    netIncome: {
      capitalGains: Math.max(0, amounts.capitalGains),
      dividends: amounts.dividends - lossOffsetAgainstDividends,
    },
  };
};

/** The income the 所得控除 are deducted from, by class. */
export interface IncomeClassAmounts {
  /** 総所得金額, or what is left of it. */
  aggregate: number;
  /** 上場株式等に係る配当所得等の金額, or what is left of it. */
  dividends: number;
  /** 上場株式等に係る譲渡所得等の金額, or what is left of it. */
  capitalGains: number;
}

/**
 * Deducts `deductions` (所得控除, or a further amount treated the same way) from the income
 * classes in the order the return applies them: 総所得金額 first, then what it could not absorb
 * from the 上場株式等に係る配当所得等の金額, then from the 上場株式等に係る譲渡所得等の金額.
 * 措法8条の4③三 and 37条の10⑥五 (as 37条の11⑥ applies it) read the 分離 classes into
 * 所法72条〜87条 alongside 総所得金額; the order between the two 分離 classes follows the
 * 確定申告書第三表, and does not change the tax, since both are taxed at the same rates. No
 * class goes below zero.
 */
export const applyDeductionSpillover = (
  classes: IncomeClassAmounts,
  deductions: number,
): IncomeClassAmounts => {
  let remaining = Math.max(0, deductions);
  const aggregate = Math.max(0, classes.aggregate - remaining);
  remaining = Math.max(0, remaining - Math.max(0, classes.aggregate));
  const dividends = Math.max(0, classes.dividends - remaining);
  remaining = Math.max(0, remaining - Math.max(0, classes.dividends));
  const capitalGains = Math.max(0, classes.capitalGains - remaining);
  return { aggregate, dividends, capitalGains };
};

/** 課税標準 rounding: floors to ¥1,000, and to zero when negative (通則法118条①). */
export const floorTaxableIncome = (amount: number): number =>
  Math.max(0, Math.floor(amount / 1000) * 1000);

/**
 * The 所得税 assessed on the 申告分離課税 amounts: 15% of the taxable total (措法8条の4①,
 * 37条の11①), before the 復興特別所得税, which the total income tax applies to the whole
 * 基準所得税額.
 */
export const calculateSeparateNationalIncomeTaxBase = (
  taxable: SeparateNetIncome,
  year: number,
): number =>
  (taxable.dividends + taxable.capitalGains) *
  getInvestmentIncomeTaxRates(year).listedAssessedNationalRate;
