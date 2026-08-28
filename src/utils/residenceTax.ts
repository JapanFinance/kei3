// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { calculateResidenceTaxBasicDeduction } from '../data/residenceTaxBasicDeduction';
import type { Dependent, DependentDeductionResults } from '../types/dependents';
import {
  DEDUCTION_TYPES,
  SPOUSE_AGE_BANDS,
  type DependentAgeRange,
  type SpouseAgeRange,
  dependentAgeCoversBand,
} from '../types/dependents';
import type {
  FurusatoNozeiDetails,
  NonTaxableResidenceTaxStatus,
  PersonalCircumstancesInput,
  ResidenceTaxDetails,
} from '../types/tax';
import { EMPTY_PERSONAL_CIRCUMSTANCES } from '../types/tax';
import type { TaxpayerAgeRange } from '../types/taxpayerAge';
import {
  calculateDependentTotalNetIncome,
  getDependentEligibilityMax,
} from './dependentDeductions';
import { calculatePersonalDeductions } from './personalDeductions';
import { calculateNationalIncomeTax } from './taxCalculations';

const RESIDENCE_TAX_RATE = 0.1;
const CITY_TAX_PROPORTION = 0.6;
const PREFECTURAL_TAX_PROPORTION = 0.4;

// 非課税制度 - 所得割・均等割とも非課税
export const NON_TAXABLE_RESIDENCE_TAX_DETAIL: ResidenceTaxDetails = {
  taxableIncome: 0, // 市町村民税の課税標準額
  cityProportion: CITY_TAX_PROPORTION,
  prefecturalProportion: PREFECTURAL_TAX_PROPORTION,
  residenceTaxRate: RESIDENCE_TAX_RATE,
  basicDeduction: 0,
  personalDeductionDifference: 0,
  city: {
    cityTaxableIncome: 0,
    cityAdjustmentCredit: 0,
    cityIncomeTax: 0,
    cityPerCapitaTax: 0,
  },
  prefecture: {
    prefecturalTaxableIncome: 0,
    prefecturalAdjustmentCredit: 0,
    prefecturalIncomeTax: 0,
    prefecturalPerCapitaTax: 0,
  },
  perCapitaTax: 0,
  forestEnvironmentTax: 0,
  totalResidenceTax: 0,
};

// Per capita tax breakdown
const cityPerCapitaTax = 3000; // Municipal per capita tax
const prefecturalPerCapitaTax = 1000;
const forestEnvironmentTax = 1000; // 森林環境税
const perCapitaTax = cityPerCapitaTax + prefecturalPerCapitaTax + forestEnvironmentTax;

/**
 * 障害者・未成年者・寡婦・ひとり親 with 前年中の合計所得金額 at or below this limit are exempt from
 * residence tax entirely — both 所得割 and 均等割.
 *
 * Statutory basis: 地方税法第295条第1項第2号 (市町村民税) and 第24条の5第1項第2号 (道府県民税):
 * 「障害者、未成年者、寡婦又はひとり親（これらの者の前年の合計所得金額が135万円を超える場合を
 * 除く。）」, under the mandatory opening 「市町村は、次の各号のいずれかに該当する者に対しては
 * 市町村民税を課することができない」. The 135万円 is written in the statute itself (125万円 until
 * the 令和3年度 basic-deduction shift), so this limit is uniform nationwide with no municipal
 * discretion — unlike the dependent-count limits in {@link getResidenceTaxExemptionLimits},
 * whose amounts vary by the municipality's 級地区分.
 * @see https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_1-At_295
 * @see https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju#gaiyo_06
 */
export const NON_TAXABLE_STATUS_INCOME_LIMIT = 1_350_000;

/**
 * Which of the 地方税法第295条第1項第2号 statuses exempts the taxpayer, if any, given a
 * 合計所得金額 at or below {@link NON_TAXABLE_STATUS_INCOME_LIMIT}. Minor status is judged as of
 * the January 1 (賦課期日) following the income year, which is what the under-18 age range selects;
 * 未成年者 has no definition of its own in 地方税法, borrowing the 民法 age of majority, which is
 * why the boundary moved from 20 to 18 (from 令和5年度) with no tax-law amendment.
 *
 * Any one status is enough, so when several apply the first is reported; the choice only affects
 * which reason the display names.
 */
function nonTaxableStatusFor(
  ageRange: TaxpayerAgeRange,
  circumstances: PersonalCircumstancesInput,
  netIncome: number,
): NonTaxableResidenceTaxStatus | undefined {
  if (netIncome > NON_TAXABLE_STATUS_INCOME_LIMIT) return undefined;
  if (ageRange === 'under18') return 'minor';
  if (circumstances.disability !== 'none') return 'disability';
  if (
    circumstances.widowOrSingleParent === 'widowDivorced' ||
    circumstances.widowOrSingleParent === 'widowBereaved'
  ) {
    return 'widow';
  }
  if (circumstances.widowOrSingleParent !== 'none') return 'singleParent';
  return undefined;
}

/**
 * Calculates residence tax (住民税) based on net income and deductions
 * Rate: 10% (6% municipal tax + 4% prefectural tax) of taxable income
 * Taxable income = net income - social insurance deductions - residence tax basic deduction
 * The details vary by municipality, but most deviate little from this calculation.
 * https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju
 *
 * @param netIncome - Net income
 * @param nonBasicDeductions - The 物的控除: social insurance, iDeCo, and the additional income
 *   deductions (life/earthquake insurance, medical expenses) at their residence-tax amounts
 * @param dependentDeductions - Full dependent deduction results
 * @param ageRange - Taxpayer age range; required because the 未成年者 exemption
 *   ({@link nonTaxableStatusFor}) is part of the statutory calculation
 * @param personalCircumstances - The taxpayer's own 障害者・寡婦・ひとり親 status. Drives both the
 *   remaining {@link nonTaxableStatusFor} exemptions and the 人的控除 this function deducts and
 *   feeds into the 調整控除
 * @param taxCredit - Tax credit amount
 */
export const calculateResidenceTax = (
  netIncome: number,
  nonBasicDeductions: number,
  dependentDeductions: DependentDeductionResults,
  year: number,
  ageRange: TaxpayerAgeRange,
  personalCircumstances: PersonalCircumstancesInput = EMPTY_PERSONAL_CIRCUMSTANCES,
  taxCredit: number = 0,
): ResidenceTaxDetails => {
  const nonTaxableStatus = nonTaxableStatusFor(ageRange, personalCircumstances, netIncome);
  if (nonTaxableStatus) {
    return { ...NON_TAXABLE_RESIDENCE_TAX_DETAIL, nonTaxableStatus };
  }

  const personalDeductions = calculatePersonalDeductions(personalCircumstances, netIncome);

  const qualifiedDependentsCount = countQualifiedDependents(dependentDeductions, year);
  const { perCapitaLimit, incomeBasedLimit } =
    getResidenceTaxExemptionLimits(qualifiedDependentsCount);

  if (netIncome <= perCapitaLimit) {
    return NON_TAXABLE_RESIDENCE_TAX_DETAIL;
  }

  // If income is below Income Based Limit, Income portion is 0.
  if (netIncome <= incomeBasedLimit) {
    return {
      taxableIncome: 0,
      cityProportion: CITY_TAX_PROPORTION,
      prefecturalProportion: PREFECTURAL_TAX_PROPORTION,
      residenceTaxRate: RESIDENCE_TAX_RATE,
      basicDeduction: calculateResidenceTaxBasicDeduction(netIncome),
      personalDeductionDifference: 0,
      city: {
        cityTaxableIncome: 0,
        cityAdjustmentCredit: 0,
        cityIncomeTax: 0,
        cityPerCapitaTax,
      },
      prefecture: {
        prefecturalTaxableIncome: 0,
        prefecturalAdjustmentCredit: 0,
        prefecturalIncomeTax: 0,
        prefecturalPerCapitaTax,
      },
      perCapitaTax,
      forestEnvironmentTax,
      totalResidenceTax: perCapitaTax,
    };
  }

  const basicDeduction = calculateResidenceTaxBasicDeduction(netIncome);

  // Calculate taxable income using residence tax deductions
  const dependentDeductionsResidenceTaxTotal = dependentDeductions.residenceTax.total;
  const taxableIncome =
    Math.floor(
      Math.max(
        0,
        netIncome -
          nonBasicDeductions -
          basicDeduction -
          dependentDeductionsResidenceTaxTotal -
          personalDeductions.residence,
      ) / 1000,
    ) * 1000;

  const personalDeductionDifference =
    calculateStatutoryPersonalDeductionDifference(dependentDeductions, netIncome) +
    personalDeductions.statutoryDifference;

  // 調整控除額 (adjustment credit)
  const adjustmentCredit = calculateAdjustmentCredit(
    netIncome,
    taxableIncome,
    personalDeductionDifference,
  );
  const cityAdjustmentCredit = adjustmentCredit * CITY_TAX_PROPORTION;
  const prefecturalAdjustmentCredit = adjustmentCredit * PREFECTURAL_TAX_PROPORTION;

  const cityIncomeTax =
    Math.floor(
      Math.max(0, taxableIncome * 0.06 - cityAdjustmentCredit - taxCredit * CITY_TAX_PROPORTION) /
        100,
    ) * 100;
  const prefecturalIncomeTax =
    Math.floor(
      Math.max(
        0,
        taxableIncome * 0.04 - prefecturalAdjustmentCredit - taxCredit * PREFECTURAL_TAX_PROPORTION,
      ) / 100,
    ) * 100;

  return {
    taxableIncome,
    cityProportion: CITY_TAX_PROPORTION,
    prefecturalProportion: PREFECTURAL_TAX_PROPORTION,
    residenceTaxRate: RESIDENCE_TAX_RATE,
    basicDeduction,
    personalDeductionDifference,
    city: {
      cityTaxableIncome: taxableIncome * CITY_TAX_PROPORTION,
      cityAdjustmentCredit,
      cityIncomeTax,
      cityPerCapitaTax,
    },
    prefecture: {
      prefecturalTaxableIncome: taxableIncome * PREFECTURAL_TAX_PROPORTION,
      prefecturalAdjustmentCredit,
      prefecturalIncomeTax,
      prefecturalPerCapitaTax,
    },
    perCapitaTax,
    forestEnvironmentTax,
    totalResidenceTax: cityIncomeTax + prefecturalIncomeTax + perCapitaTax,
  };
};

/**
 * Counts the number of qualified dependents for residence tax non-taxable limit calculations.
 * Includes spouse and other dependents with total net income <= threshold.
 * Note: Includes dependents under 16.
 * 扶養親族は、年齢16歳未満の者及び地方税法第314条の2第1項第11号に規定する控除対象扶養親族に限ります。
 * @see https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju#gaiyo_06
 */
function countQualifiedDependents(
  dependentDeductions: DependentDeductionResults,
  year: number,
): number {
  const uniqueDependents = new Map<string, Dependent>();
  dependentDeductions.breakdown.forEach(b => {
    uniqueDependents.set(b.dependent.id, b.dependent);
  });

  let qualifiedDependentsCount = 0;
  uniqueDependents.forEach(dependent => {
    const totalNetIncome = calculateDependentTotalNetIncome(dependent, year);
    if (totalNetIncome <= getDependentEligibilityMax(year)) {
      qualifiedDependentsCount++;
    }
  });
  return qualifiedDependentsCount;
}

/**
 * Calculates the non-taxable limits for residence tax (Tokyo 23 wards standard).
 *
 * There are two limits:
 * 1. Per Capita Exempt Limit (所得割・均等割とも非課税): Below this, no residence tax at all.
 * 2. Income Exempt Limit (所得割が非課税): Below this, no income-based residence tax but per capita residence tax applies.
 *
 * Unlike the statute-fixed {@link NON_TAXABLE_STATUS_INCOME_LIMIT}, the 均等割 limit's amounts are
 * set by each municipality's ordinance within nationally prescribed bands keyed to the
 * 生活保護基準の級地区分; the amounts here are the 級地1 values (which include the Tokyo 23
 * wards), so they can overstate the limits for municipalities in 級地2・3.
 *
 * @param qualifiedDependentsCount Number of {@link countQualifiedDependents qualified dependents}
 * @returns Object containing both net income limits
 * @see https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/hikazeikijun/juuminzei-hikazei.html
 */
function getResidenceTaxExemptionLimits(qualifiedDependentsCount: number): {
  perCapitaLimit: number;
  incomeBasedLimit: number;
} {
  if (qualifiedDependentsCount === 0) {
    return {
      perCapitaLimit: 450_000,
      incomeBasedLimit: 450_000,
    };
  }

  // With dependents: 350,000 * (dependents + 1) + 100,000 + add-on
  // Note: (dependents + 1) accounts for the taxpayer themselves
  const baseAmount = 350_000 * (qualifiedDependentsCount + 1) + 100_000;

  return {
    perCapitaLimit: baseAmount + 210_000,
    incomeBasedLimit: baseAmount + 320_000,
  };
}

/**
 * Statutory personal deduction difference amounts per Local Tax Act Article 314-6
 * These are used for the adjustment credit calculation (調整控除)
 *
 * IMPORTANT: These are specific statutory amounts defined in law, NOT actual differences between national and residence tax deductions.
 *
 * Reference: https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 */
const STATUTORY_DEDUCTION_DIFFERENCES = {
  // 扶養控除 (Dependent Deduction) (8) and (9) in the statutory table.
  DEPENDENT_GENERAL: 50_000, // General dependent (16-18, 23-69)
  DEPENDENT_SPECIAL: 180_000, // Special dependent (19-22)
  DEPENDENT_ELDERLY: 100_000, // Elderly dependent (70+)
  DEPENDENT_ELDERLY_COHABITING: 130_000, // Elderly cohabiting parent/grandparent (70+)

  // 障害者控除 (Disability Deduction) (1) and (2) in the statutory table. The 一般/特別 rows
  // mirror the taxpayer's own statutoryDifference values in personalDeductions.ts (314条の6
  // makes no taxpayer/dependent distinction); an amendment must change both files together.
  DISABILITY_REGULAR: 10_000, // Regular disability
  DISABILITY_SPECIAL: 100_000, // Special disability
  DISABILITY_SPECIAL_COHABITING: 220_000, // Special disability with cohabitation
} as const;

/**
 * Calculates the statutory personal deduction difference (人的控除額の差) per Local Tax Act Article 314-6
 *
 * IMPORTANT: These are NOT the actual arithmetic differences between national and residence tax deductions.
 * They are specific statutory amounts defined in law for the adjustment credit calculation.
 *
 * Covers the basic deduction and the dependent-related ones. The taxpayer's own
 * 障害者控除・寡婦控除・ひとり親控除 carry their difference alongside their amount, in
 * `personalDeductions.ts`, and the caller adds it to this total.
 *
 * @param deductions - The dependent deduction results containing breakdown by deduction
 * @param taxpayerNetIncome - Taxpayer's total net income (納税義務者の前年の合計所得金額)
 * @returns The statutory personal deduction difference amount for adjustment credit calculation
 * @see https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 * @see https://www.town.hinode.tokyo.jp/0000000519.html
 */
function calculateStatutoryPersonalDeductionDifference(
  deductions: DependentDeductionResults,
  taxpayerNetIncome: number,
): number {
  // Basic deduction difference is 50,000 yen regardless of income
  // Although adjustment credit is 0 for income > 25M, the statutory difference itself is defined.
  let totalDifference = 50_000;

  // Calculate the statutory difference for each deduction in the breakdown
  for (const breakdown of deductions.breakdown) {
    const dep = breakdown.dependent;

    switch (breakdown.deductionType) {
      case DEDUCTION_TYPES.SPOUSE:
        totalDifference += getSpouseDeductionDifference(dep.ageRange, taxpayerNetIncome);
        break;

      case DEDUCTION_TYPES.SPECIAL_DEPENDENT:
        // Special dependent (19-22)
        totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_SPECIAL;
        break;

      case DEDUCTION_TYPES.ELDERLY_COHABITING_DEPENDENT:
        // 同居老親等 (cohabiting elderly 直系尊属, 70+). Whether a dependent qualifies is decided
        // once, where the deduction amount is chosen (isCohabitingElderlyDependent); we switch on
        // the resulting breakdown type alone and never re-derive it from relationship/isCohabiting.
        totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_ELDERLY_COHABITING;
        break;

      case DEDUCTION_TYPES.ELDERLY_DEPENDENT:
        // 老人扶養親族 (70+) that is not 同居老親等 (incl. a cohabiting elderly 'other' relative).
        totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_ELDERLY;
        break;

      case DEDUCTION_TYPES.GENERAL_DEPENDENT:
        // General dependent (16-18, 23-69)
        totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_GENERAL;
        break;

      case DEDUCTION_TYPES.DISABILITY:
        totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_REGULAR;
        break;

      case DEDUCTION_TYPES.SPECIAL_DISABILITY:
        totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_SPECIAL;
        break;

      case DEDUCTION_TYPES.SPECIAL_DISABILITY_COHABITING:
        totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_SPECIAL_COHABITING;
        break;

      /*
              Spouse Special Deduction contributes no statutory difference because of a quirk in the statute.
              The income ranges for qualifying for Spouse Special Deduction (>580,000 yen) are mutually exclusive
              with the ranges where statutory differences are defined (<550,000 yen) in Article 314-6(7) of the Local Tax Act.
              
              The Specific Relative Special Deduction has no statutory difference defined in the law.
              The relevant statute was not updated when the Specific Relative Special Deduction was introduced.

              Therefore, no statutory personal difference is added for the Spouse Special Deduction or Specific Relative Special Deduction.
            */
      case DEDUCTION_TYPES.SPOUSE_SPECIAL:
      case DEDUCTION_TYPES.SPECIFIC_RELATIVE_SPECIAL:
      case DEDUCTION_TYPES.NOT_ELIGIBLE:
      default:
        // No statutory difference
        break;
    }
  }

  return totalDifference;
}

/**
 * Get statutory difference for spouse deduction based on taxpayer's income
 * Per Local Tax Act Article 314-6(6), varies by taxpayer income.
 *
 * Note: Spouse special deduction has NO statutory difference because the income ranges
 * for qualifying for spouse special deduction (>58万円) are mutually exclusive with
 * the ranges where statutory differences are defined (<55万円) in Article 314-6(7).
 *
 * Reference: 地方税法第314条の6第6号 (6) in the statutory table.
 * Reference: https://www.town.hinode.tokyo.jp/0000000519.html
 *
 * @param spouseAgeRange - The spouse's age range, judged here against
 *   {@link SPOUSE_AGE_BANDS.residenceTaxElderlySpouse}, the 老人控除対象配偶者 band 地方税法
 *   defines for itself
 * @param taxpayerNetIncome - Taxpayer's net income (納税義務者の前年の合計所得金額)
 * @returns Statutory deduction difference amount
 */
function getSpouseDeductionDifference(
  spouseAgeRange: SpouseAgeRange | DependentAgeRange,
  taxpayerNetIncome: number,
): number {
  const isElderly = dependentAgeCoversBand(
    spouseAgeRange,
    SPOUSE_AGE_BANDS.residenceTaxElderlySpouse,
  );
  if (taxpayerNetIncome <= 9_000_000) {
    return isElderly ? 100_000 : 50_000;
  } else if (taxpayerNetIncome <= 9_500_000) {
    return isElderly ? 60_000 : 40_000;
  } else if (taxpayerNetIncome <= 10_000_000) {
    return isElderly ? 30_000 : 20_000;
  }
  return 0;
}

/**
 * 調整控除額 (adjustment credit)
 * For taxable income of 2M or less: min(personal deduction difference x 5%, taxable income x 5%)
 * For taxable income over 2M: {personal deduction difference - (taxable income - 2M)}, floored at ¥50,000, x 5% (a ¥2,500 minimum)
 * No adjustment credit if net income exceeds 25M yen
 * @param netIncome
 * @param taxableIncome
 * @param personalDeductionDifference
 * @returns adjustment credit amount
 * @see https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 * @see https://www.town.hinode.tokyo.jp/0000000519.html
 */
// Exported for testing.
export function calculateAdjustmentCredit(
  netIncome: number,
  taxableIncome: number,
  personalDeductionDifference: number,
): number {
  let adjustmentCredit: number;
  if (netIncome > 25000000) {
    adjustmentCredit = 0;
  } else if (taxableIncome <= 2000000) {
    adjustmentCredit = Math.min(personalDeductionDifference * 0.05, taxableIncome * 0.05);
  } else {
    // taxableIncome > 2M
    // Per 地方税法 §314-6, the personal deduction difference is first reduced by
    // (taxable income - ¥2M), then floored at ¥50,000, before the 5% rate is applied
    // (so 50_000 * 0.05 = a ¥2,500 minimum adjustment credit).
    const reducedDifference = Math.max(
      personalDeductionDifference - (taxableIncome - 2_000_000),
      50_000,
    );
    adjustmentCredit = reducedDifference * 0.05;
  }
  return adjustmentCredit;
}

// ふるさと納税の自己負担額
const FURUSATO_OUT_OF_POCKET_COST = 2000;
// 基本控除率 (ふるさと納税の寄付金控除の基本控除率)
const donationBasicDeductionRate = 0.1;

/**
 * Calculate the maximum deductible ふるさと納税 (Furusato Nozei) donation limit for which the user's out-of-pocket cost is ~2,000 yen.
 *
 * Accurate handling of home loan tax credit interactions:
 * - The 20% special-deduction cap (特例控除上限) uses 所得割 AFTER 調整控除 but
 *   BEFORE 住宅ローン控除 — pass the pre-credit residence tax via
 *   `residenceTaxDetailsForCap`. When no home loan credit is in play, pass the
 *   same details for both `residenceTaxDetailsForCap` and `residenceTaxDetailsForFinal`.
 * - The income-tax refund portion can't exceed the income tax actually owed. When a home loan
 *   credit has reduced that income tax, pass the post-credit figure via `remainingIncomeTax` to
 *   cap the refund at it. Omit it (undefined) when nothing has reduced income tax — then the
 *   refund is limited only by the normal furusato math (no extra cap needed).
 * - `appliedHomeLoanCreditToResidenceTax` is the amount of home loan credit
 *   spillover applied to residence tax. Used to compute the raw post-credit
 *   city/prefectural income tax for the furusato application step. Defaults to 0.
 *
 * @param taxableIncomeForNationalIncomeTax - Taxable income for national income tax, before rounding (所得税課税所得)
 * @param residenceTaxDetailsForCap - Residence tax details PRE home loan credit — used for the 20% special-deduction cap
 * @param residenceTaxDetailsForFinal - Residence tax details POST home loan credit — used for the totalResidenceTax baseline. Defaults to `residenceTaxDetailsForCap`.
 * @param appliedHomeLoanCreditToResidenceTax - Home loan credit spillover applied to residence tax (yen). Defaults to 0.
 * @param remainingIncomeTax - Optional cap on the income-tax refund portion (post home loan credit).
 * @returns The various details of the Furusato Nozei deduction, including the limit, out-of-pocket cost, and tax reductions.
 * @see https://kaikei7.com/furusato_nouzei_keisan/
 * @see https://kaikei7.com/furusato_nouzei_onestop/
 */
export function calculateFurusatoNozeiDetails(
  taxableIncomeForNationalIncomeTax: number,
  residenceTaxDetailsForCap: ResidenceTaxDetails,
  residenceTaxDetailsForFinal: ResidenceTaxDetails = residenceTaxDetailsForCap,
  appliedHomeLoanCreditToResidenceTax: number = 0,
  remainingIncomeTax?: number,
): FurusatoNozeiDetails {
  if (taxableIncomeForNationalIncomeTax <= 0 || residenceTaxDetailsForCap.taxableIncome <= 0) {
    return {
      limit: 0,
      incomeTaxReduction: 0,
      residenceTaxDonationBasicDeduction: 0,
      residenceTaxSpecialDeduction: 0,
      outOfPocketCost: 0,
      residenceTaxReduction: 0,
    };
  }
  // 調整控除後・住宅ローン控除前の所得割 — the base for the 20% special-deduction cap.
  const residentTaxAmountForIncomePortion =
    residenceTaxDetailsForCap.totalResidenceTax - residenceTaxDetailsForCap.perCapitaTax;

  // Special deduction rate for resident tax (特例控除割合)
  const specialDeductionRate = getSpecialDeductionMultiplier(
    residenceTaxDetailsForCap.taxableIncome - residenceTaxDetailsForCap.personalDeductionDifference,
  );

  // The deduction breakdown:
  // Income tax deduction: (X - 2000) * incomeTaxRate (not used if one-stop)
  // Resident tax basic deduction (基本控除): (X - 2000) * residenceTaxRate
  // Resident tax special deduction (特例控除): (X - 2000) * (1 - residenceTaxRate - marginalIncomeTaxRate) [capped at 20% of resident tax amount for the income portion]
  // One-stop special deduction (申告特例控除):

  // We need to find X such that:
  // (X - 2000) * specialDeductionRate <= residentTaxAmountForIncomePortion * 0.2
  const maxSpecialDeduction = residentTaxAmountForIncomePortion * 0.2;
  const furusatoNozeiLimit =
    maxSpecialDeduction / specialDeductionRate + FURUSATO_OUT_OF_POCKET_COST;

  // Statutory cap: donation cannot exceed 30% of resident tax taxable income
  // This will always be higher than the 20% cap for the special deduction
  const statutoryCap = residenceTaxDetailsForCap.taxableIncome * 0.3;

  // Final limit is the lower of the two, rounded down to the nearest 1,000 yen
  const finalLimit = Math.floor(Math.min(furusatoNozeiLimit, statutoryCap) / 1000) * 1000;
  const deductibleDonation = Math.max(finalLimit - FURUSATO_OUT_OF_POCKET_COST, 0);
  // const incomeTaxReduction = deductibleDonation * (1 - specialDeductionRate - donationBasicDeductionRate);
  let incomeTaxReduction = calculateIncomeTaxReduction(
    taxableIncomeForNationalIncomeTax,
    deductibleDonation,
  );
  // When the home loan tax credit reduces the actual income tax paid, the income-tax
  // refund portion of furusato can only be claimed up to the remaining income tax.
  if (remainingIncomeTax !== undefined) {
    incomeTaxReduction = Math.min(incomeTaxReduction, Math.max(0, remainingIncomeTax));
  }
  const residenceTaxDonationBasicDeduction = deductibleDonation * donationBasicDeductionRate;
  let residenceTaxSpecialDeduction = deductibleDonation * specialDeductionRate;
  residenceTaxSpecialDeduction =
    Math.ceil(residenceTaxSpecialDeduction * residenceTaxDetailsForFinal.cityProportion) +
    Math.ceil(residenceTaxSpecialDeduction * residenceTaxDetailsForFinal.prefecturalProportion);

  const furusatoNozeiTaxCredit = residenceTaxDonationBasicDeduction + residenceTaxSpecialDeduction;
  // City/prefectural income-based residence tax, pre-rounding, with the home loan credit
  // spillover removed first, then the furusato tax credit subtracted. When there is no home
  // loan credit, appliedHomeLoanCreditToResidenceTax is 0, the spillover term drops out, and
  // this reduces to the residence income-based portion minus the furusato credit.
  const beforeCityIncomeTax =
    residenceTaxDetailsForCap.city.cityTaxableIncome * residenceTaxDetailsForCap.residenceTaxRate -
    residenceTaxDetailsForCap.city.cityAdjustmentCredit -
    appliedHomeLoanCreditToResidenceTax * residenceTaxDetailsForCap.cityProportion;
  const cityIncomeTaxWithFurusato =
    Math.floor(
      Math.max(
        0,
        beforeCityIncomeTax -
          Math.ceil(furusatoNozeiTaxCredit * residenceTaxDetailsForFinal.cityProportion),
      ) / 100,
    ) * 100;
  const beforePrefectureIncomeTax =
    residenceTaxDetailsForCap.prefecture.prefecturalTaxableIncome *
      residenceTaxDetailsForCap.residenceTaxRate -
    residenceTaxDetailsForCap.prefecture.prefecturalAdjustmentCredit -
    appliedHomeLoanCreditToResidenceTax * residenceTaxDetailsForCap.prefecturalProportion;
  const prefectureIncomeTaxWithFurusato =
    Math.floor(
      Math.max(
        0,
        beforePrefectureIncomeTax -
          Math.ceil(furusatoNozeiTaxCredit * residenceTaxDetailsForFinal.prefecturalProportion),
      ) / 100,
    ) * 100;
  const residenceTaxDifference =
    residenceTaxDetailsForFinal.totalResidenceTax -
    (cityIncomeTaxWithFurusato +
      prefectureIncomeTaxWithFurusato +
      residenceTaxDetailsForFinal.perCapitaTax);

  return {
    limit: finalLimit,
    incomeTaxReduction,
    residenceTaxDonationBasicDeduction,
    residenceTaxSpecialDeduction,
    residenceTaxReduction: residenceTaxDifference,
    outOfPocketCost: finalLimit - residenceTaxDifference - incomeTaxReduction,
  };
}

function calculateIncomeTaxReduction(
  taxableIncome: number,
  furusatoNozeiDeduction: number,
): number {
  const incomeTaxBefore = calculateNationalIncomeTax(Math.floor(taxableIncome / 1000) * 1000);
  const incomeTaxAfter = calculateNationalIncomeTax(
    Math.floor((taxableIncome - furusatoNozeiDeduction) / 1000) * 1000,
  );

  return incomeTaxBefore - incomeTaxAfter;
}

/**
 * Returns the 特例控除割合 for the band that `taxableIncome` falls in.
 *
 * The bands and ratios are the statute's own table (第37条の2第11項第一号: 195万円以下 →
 * 100分の85, …, 4,000万円超 → 100分の45), where each ratio equals 90% minus the band's rate below.
 * 附則第5条の6 replaces each ratio for 平成26年度〜令和20年度 (2014–2038) with the value that folds
 * in the 復興特別所得税 factor (100分の85 → 100分の84.895, which equals 90% − 5% × 1.021), so this
 * function computes the replaced ratio as 1 − donationBasicDeductionRate − (band rate × 1.021).
 *
 * Deliberately not derived from NATIONAL_INCOME_TAX_BRACKETS: the statute defines this table
 * itself and does not reference 所得税法, so the two tables only coincide under current law. They
 * already disagree at exact band boundaries — 1,950,000 is inside the 85% band here (195万円以下),
 * while the 速算表 data ends its 5% row at 1,949,000 and starts the 10% row at 1,950,000 (equal
 * tax either way at that point, but a different marginal rate). If the income tax brackets are
 * reformed, this table changes only when 地方税法 itself is amended.
 *
 * @param taxableIncome taxable income for residence tax minus the personal deduction difference (住民税の課税総所得金額 - 人的控除差調整額)
 * @returns 特例控除割合
 * @see 地方税法第37条の2第11項第一号（道府県民税）・第314条の7第11項第一号（市町村民税）
 * @see 地方税法附則第5条の6（復興特別所得税分の読替え、平成26年度〜令和20年度）
 */
function getSpecialDeductionMultiplier(taxableIncome: number): number {
  let incomeTaxRate: number;
  if (taxableIncome <= 1950000) incomeTaxRate = 0.05;
  else if (taxableIncome <= 3300000) incomeTaxRate = 0.1;
  else if (taxableIncome <= 6950000) incomeTaxRate = 0.2;
  else if (taxableIncome <= 9000000) incomeTaxRate = 0.23;
  else if (taxableIncome <= 18000000) incomeTaxRate = 0.33;
  else if (taxableIncome <= 40000000) incomeTaxRate = 0.4;
  else incomeTaxRate = 0.45; // Over 40 million

  incomeTaxRate *= 1.021; // 附則第5条の6 read-replacement: fold the 復興特別所得税 factor into the ratio

  return 1 - donationBasicDeductionRate - incomeTaxRate;
}
