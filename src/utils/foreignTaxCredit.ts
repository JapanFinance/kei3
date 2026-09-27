// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  DividendsIncomeStream,
  ForeignTaxCreditAmounts,
  ForeignTaxCreditResult,
  InterestIncomeStream,
  WithholdingAccountIncomeStream,
} from '../types/tax';

/**
 * The 道府県民税 limit as a percentage of the 所得税 limit (地方税法施行令7条の19③). A resident of
 * a designated city (指定都市) has 6 instead, with 24 on the municipal side; that split is not
 * modelled. The 施行令 sets this figure itself, so it is not derived from the 4%/6% residence tax
 * rates it shares a ratio with.
 *
 * @see https://laws.e-gov.go.jp/law/325CO0000000245#Mp-Ch_2-Se_1-At_7_19
 */
export const PREFECTURAL_LIMIT_PERCENT = 12;

/**
 * The 市町村民税 limit as a percentage of the 所得税 limit (地方税法施行令48条の9の2④); 24 in a
 * designated city (指定都市), which is not modelled. Set by the 施行令 itself, like
 * {@link PREFECTURAL_LIMIT_PERCENT}.
 *
 * @see https://laws.e-gov.go.jp/law/325CO0000000245#Mp-Ch_3-Se_1-At_48_9_2
 */
export const MUNICIPAL_LIMIT_PERCENT = 18;

/**
 * An amount floored to the whole yen and to zero. The chart sweep and the tooltip's cap probe
 * scale the salary by a float ratio, which makes 合計所得金額 fractional, and `BigInt` throws on a
 * fraction.
 */
const wholeYen = (amount: number): number => Math.max(0, Math.floor(amount));

/**
 * ⌊a × b / c⌋ exactly, for whole-yen inputs. Float arithmetic is not exact here: a × b can pass
 * 2^53, and B 96,717,250 with A = T 225,585,093 gives 96,717,249 in floats.
 */
const floorMulDiv = (a: number, b: number, c: number): number =>
  Number((BigInt(a) * BigInt(b)) / BigInt(c));

/** The figures the credit is computed from; each is floored to the whole yen first. */
export interface ForeignTaxCreditInputs {
  /** B: 所得税額 after the home loan credit, before the 復興特別所得税. */
  incomeTax: number;
  /** R: 復興特別所得税 on {@link incomeTax}, before this credit. */
  reconstructionSurtax: number;
  /** T: 所得総額. */
  totalIncome: number;
  /** Foreign-source income (国外所得金額), before the cap at {@link totalIncome}. */
  foreignSourceIncome: number;
  /** F: creditable foreign tax. */
  foreignTax: number;
}

/**
 * The foreign tax credit (外国税額控除): foreign tax on foreign-source income comes off 所得税, the
 * 復興特別所得税, 道府県民税 and 市町村民税 in that order, each up to its own limit.
 *
 * - 所得税: up to L = ⌊B × A / T⌋ (所法95条①; 所令222条①), where A is the foreign-source income
 *   capped at T (所令222条③) and T is 所得総額 (所令222条②), which counts the separately taxed
 *   dividends and listed-share gains (措令4条の2⑨, 25条の11の2⑳). B includes the 15% separate
 *   tax on them (措法8条の4③四, 37条の11⑥).
 * - 復興特別所得税: what the 所得税 limit leaves, up to L_R = ⌊R × A / T⌋ (復興財確法14条①;
 *   復興特別所得税に関する政令3条①). R is charged on B before this credit (復興財確法10条①一, 13条).
 * - Residence tax: what is left after those two, up to ⌊L × 12 / 100⌋ against 道府県民税 and
 *   then ⌊L × 18 / 100⌋ against 市町村民税 (地方税法37条の3, 314条の8; 地方税法施行令7条の19③,
 *   48条の9の2④). This follows the NTA's form instructions, which take what is left after the
 *   復興特別所得税 credit as well, where the text of 37条の3 measures the excess over the 所得税
 *   limit alone; the two differ by at most L_R.
 *
 * Every limit is floored to the yen. What is left over is {@link ForeignTaxCreditResult.excess},
 * which carries forward for three years in law (所法95条②③; 地方税法施行令7条の19②, 48条の9の2②
 * for residence tax) and is not modelled. The residence credits are before the cap at each side's
 * 所得割, which the residence tax calculation applies; a credit a 所得割 cannot absorb also
 * carries forward in law (地方税法施行令7条の19⑧, 48条の9の2⑨), which is not modelled either.
 *
 * @see https://laws.e-gov.go.jp/law/340AC0000000033#Mp-Pa_2-Ch_3-Se_2-At_95
 * @see https://laws.e-gov.go.jp/law/340CO0000000096#Mp-Pa_2-Ch_3-At_222
 * @see https://laws.e-gov.go.jp/law/332CO0000000043#Mp-Ch_2-Se_1-At_4_2
 * @see https://laws.e-gov.go.jp/law/332CO0000000043#Mp-Ch_2-Se_8_2-At_25_11_2
 * @see https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_1-At_8_4
 * @see https://laws.e-gov.go.jp/law/332AC0000000026#Mp-Ch_2-Se_4-Ss_9-At_37_11
 * @see https://laws.e-gov.go.jp/law/423AC0000000117#Mp-Ch_4-Se_1-At_10
 * @see https://laws.e-gov.go.jp/law/423AC0000000117#Mp-Ch_4-Se_2-At_13
 * @see https://laws.e-gov.go.jp/law/423AC0000000117#Mp-Ch_4-Se_2-At_14
 * @see https://laws.e-gov.go.jp/law/424CO0000000016#Mp-At_3
 * @see https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_2-Se_1-Ss_2-Di_1-At_37_3
 * @see https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_8
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1240.htm
 * @see https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/pdf/040.pdf
 */
export const calculateForeignTaxCredit = (
  inputs: ForeignTaxCreditInputs,
): ForeignTaxCreditResult => {
  const incomeTax = wholeYen(inputs.incomeTax);
  const reconstructionSurtax = wholeYen(inputs.reconstructionSurtax);
  const totalIncome = wholeYen(inputs.totalIncome);
  const foreignSourceIncome = wholeYen(inputs.foreignSourceIncome);
  const foreignTax = wholeYen(inputs.foreignTax);
  const adjustedForeignSourceIncome = Math.min(foreignSourceIncome, totalIncome);

  const hasLimit = incomeTax > 0 && totalIncome > 0;
  const incomeTaxLimit = hasLimit
    ? floorMulDiv(incomeTax, adjustedForeignSourceIncome, totalIncome)
    : 0;
  const limit: ForeignTaxCreditAmounts = {
    incomeTax: incomeTaxLimit,
    reconstructionSurtax: hasLimit
      ? floorMulDiv(reconstructionSurtax, adjustedForeignSourceIncome, totalIncome)
      : 0,
    prefecture: floorMulDiv(incomeTaxLimit, PREFECTURAL_LIMIT_PERCENT, 100),
    city: floorMulDiv(incomeTaxLimit, MUNICIPAL_LIMIT_PERCENT, 100),
  };

  const incomeTaxCredit = Math.min(foreignTax, limit.incomeTax);
  const surtaxCredit = Math.min(foreignTax - incomeTaxCredit, limit.reconstructionSurtax);
  const leftForResidenceTax = foreignTax - incomeTaxCredit - surtaxCredit;
  const prefectureCredit = Math.min(leftForResidenceTax, limit.prefecture);
  const cityCredit = Math.min(leftForResidenceTax - prefectureCredit, limit.city);

  return {
    foreignTax,
    foreignSourceIncome,
    adjustedForeignSourceIncome,
    totalIncome,
    incomeTax,
    limit,
    credit: {
      incomeTax: incomeTaxCredit,
      reconstructionSurtax: surtaxCredit,
      prefecture: prefectureCredit,
      city: cityCredit,
    },
    excess: leftForResidenceTax - prefectureCredit - cityCredit,
  };
};

/**
 * Why an entry's foreign-tax figures cannot be used, or undefined when they can. Shared by the
 * calculation, which throws the message, and the entry form, which shows it.
 */
export const foreignTaxEntryError = (
  stream: DividendsIncomeStream | InterestIncomeStream | WithholdingAccountIncomeStream,
): string | undefined => {
  if (stream.foreignTax < 0) return 'Foreign tax cannot be negative.';
  switch (stream.type) {
    case 'dividends':
      if (stream.foreignTax > 0 && stream.issuerDomicile === 'domestic') {
        return 'Only a dividend from a foreign company or fund has foreign tax withheld.';
      }
      if (stream.foreignTax > 0 && stream.foreignTax > stream.amount) {
        return 'Foreign tax cannot be more than the gross dividend.';
      }
      return undefined;
    case 'interest':
      if (stream.foreignTax > 0 && stream.payerDomicile === 'domestic') {
        return 'Foreign tax on interest paid in Japan is not supported.';
      }
      if (stream.foreignTax > 0 && stream.foreignTax > stream.amount) {
        return 'Foreign tax cannot be more than the gross interest.';
      }
      return undefined;
    case 'withholdingAccount':
      if (stream.foreignDividends < 0) return 'Foreign dividends cannot be negative.';
      if (stream.foreignDividends > 0 && stream.foreignDividends > stream.dividends) {
        return 'Foreign dividends cannot be more than the dividends received into the account.';
      }
      if (stream.foreignTax > 0 && stream.foreignTax > stream.foreignDividends) {
        return 'Foreign tax cannot be more than the foreign dividends.';
      }
      return undefined;
    default: {
      const unhandled: never = stream;
      throw new Error(`Unhandled income stream type: ${JSON.stringify(unhandled)}`);
    }
  }
};
