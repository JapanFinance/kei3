// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getInvestmentIncomeTaxRates } from '../data/investmentIncomeTaxRates';
import { RECONSTRUCTION_SURTAX_RATE } from '../data/nationalIncomeTaxBrackets';
import { percentTo, Rate } from '../data/rate';
import { calculateResidenceTaxBasicDeduction } from '../data/residenceTaxBasicDeduction';
import type { Dependent, DependentDeductionResults } from '../types/dependents';
import {
  DEDUCTION_TYPES,
  DEPENDENT_AGE_BANDS,
  SPOUSE_AGE_BANDS,
  type DependentAgeRange,
  type SpouseAgeRange,
  dependentAgeCoversBand,
} from '../types/dependents';
import type {
  NonTaxableResidenceTaxStatus,
  PersonalCircumstancesInput,
  ResidenceTaxCredits,
  ResidenceTaxDetails,
  ResidenceTaxSeparateDetails,
  SeparateNetIncome,
} from '../types/tax';
import {
  DEFAULT_INCOME_YEAR,
  EMPTY_PERSONAL_CIRCUMSTANCES,
  NO_RESIDENCE_TAX_CREDITS,
} from '../types/tax';
import type { TaxpayerAgeRange } from '../types/taxpayerAge';
import {
  calculateDependentTotalNetIncome,
  countDependentsWithinEligibilityIncome,
} from './dependentDeductions';
import {
  applyDeductionSpillover,
  floorTaxableIncome,
  NO_SEPARATE_NET_INCOME,
  type IncomeClassAmounts,
} from './investmentIncome';
import { calculatePersonalDeductions } from './personalDeductions';

const percent = percentTo(3);

export const CITY_RESIDENCE_TAX_RATE = percent(6);
export const PREFECTURAL_RESIDENCE_TAX_RATE = percent(4);
export const RESIDENCE_TAX_RATE = Rate.sum(CITY_RESIDENCE_TAX_RATE, PREFECTURAL_RESIDENCE_TAX_RATE);

export const CITY_TAX_PROPORTION = percent(60);
export const PREFECTURAL_TAX_PROPORTION = percent(40);

export const ADJUSTMENT_CREDIT_RATE = percent(5);

// 非課税制度 - 所得割・均等割とも非課税
export const NON_TAXABLE_RESIDENCE_TAX_DETAIL: ResidenceTaxDetails = {
  taxableIncome: 0, // 市町村民税の課税標準額
  cityProportion: CITY_TAX_PROPORTION,
  prefecturalProportion: PREFECTURAL_TAX_PROPORTION,
  residenceTaxRate: RESIDENCE_TAX_RATE,
  basicDeduction: 430_000,
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
 * Whether the taxpayer owes no residence tax at all — 均等割・所得割とも非課税. Composes the same
 * two gates {@link calculateResidenceTax} applies, in the same order: a 地方税法295条1項2号 status
 * ({@link nonTaxableStatusFor}), or 合計所得金額 within the 均等割 limit of
 * {@link getResidenceTaxExemptionLimits}. Someone above those but below the 所得割 limit still
 * pays 均等割 and so is a 住民税課税者 here.
 *
 * This is the 「市町村民税が課されていない者」 test the 介護保険 第1号 income-tier judgment
 * (介護保険法施行令第38条第1項) applies to the insured person and to each 世帯 member.
 */
export function isResidenceTaxExempt(
  netIncome: number,
  qualifiedDependentsCount: number,
  ageRange: TaxpayerAgeRange,
  personalCircumstances: PersonalCircumstancesInput,
): boolean {
  return (
    nonTaxableStatusFor(ageRange, personalCircumstances, netIncome) !== undefined ||
    netIncome <= getResidenceTaxExemptionLimits(qualifiedDependentsCount).perCapitaLimit
  );
}

/**
 * Whether an entered dependent would themselves owe residence tax, for the
 * 世帯に課税者がいるかどうか half of the 介護保険 第1号 tier judgment. A dependent's own
 * dependents are not modeled, so the 0-dependent 均等割 limit applies; of the
 * 地方税法295条1項2号 statuses, 障害者 comes from the dependent's own field and 未成年者 from
 * the age range.
 *
 * The age ranges cannot always answer that second one. They are cut on the 扶養控除 boundaries
 * of 16 and 19 rather than the age of majority, so 'under16' is safely inside the 未成年者 band
 * but '16to18' spans ages 16 to 18 and holds minors and adults alike. It is resolved as an
 * adult, so a 16- or 17-year-old whose 合計所得金額 falls between the 均等割 limit and
 * {@link NON_TAXABLE_STATUS_INCOME_LIMIT} is reported as 課税 when they are in fact exempt,
 * which moves the taxpayer from tiers 1-3 to tiers 4-5 and overstates the premium. The
 * taxpayer's own ranges split exactly at 18, so only dependents are affected.
 */
export function isDependentResidenceTaxable(dependent: Dependent, year: number): boolean {
  const netIncome = calculateDependentTotalNetIncome(dependent, year);
  if (netIncome <= getResidenceTaxExemptionLimits(0).perCapitaLimit) return false;
  const hasExemptStatus =
    dependent.disability !== 'none' ||
    (dependent.relationship !== 'spouse' &&
      dependentAgeCoversBand(dependent.ageRange, DEPENDENT_AGE_BANDS.dependentUnder16));
  return !(hasExemptStatus && netIncome <= NON_TAXABLE_STATUS_INCOME_LIMIT);
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
 * @param credits - The 税額控除 after the 調整控除: the home loan credit's spillover, split 60/40
 *   between the sides, and then each side's foreign tax credit, capped at what is left of that
 *   side's 所得割. A side's credit its 所得割 cannot absorb does not move to the other side.
 * @param separateNetIncome - Investment income reported under 申告分離課税, already inside
 *   `netIncome` (合計所得金額). Taxed at 3% + 2% apart from the 6% + 4% on 課税総所得金額
 *   (地方税法附則第33条の2, 第35条の2の2), but subject to the same exemption limits, which are
 *   judged on the inclusive `netIncome`.
 */
export const calculateResidenceTax = (
  netIncome: number,
  nonBasicDeductions: number,
  dependentDeductions: DependentDeductionResults,
  year: number,
  ageRange: TaxpayerAgeRange,
  personalCircumstances: PersonalCircumstancesInput = EMPTY_PERSONAL_CIRCUMSTANCES,
  credits: ResidenceTaxCredits = NO_RESIDENCE_TAX_CREDITS,
  separateNetIncome: SeparateNetIncome = NO_SEPARATE_NET_INCOME,
): ResidenceTaxDetails => {
  const nonTaxableStatus = nonTaxableStatusFor(ageRange, personalCircumstances, netIncome);
  if (nonTaxableStatus) {
    return {
      ...NON_TAXABLE_RESIDENCE_TAX_DETAIL,
      nonTaxableStatus,
      nonTaxableLimit: NON_TAXABLE_STATUS_INCOME_LIMIT,
      basicDeduction: calculateResidenceTaxBasicDeduction(netIncome),
    };
  }

  const personalDeductions = calculatePersonalDeductions(personalCircumstances, netIncome);

  const qualifiedDependentsCount = countQualifiedDependentsFromBreakdown(dependentDeductions, year);
  const { perCapitaLimit, incomeBasedLimit } =
    getResidenceTaxExemptionLimits(qualifiedDependentsCount);

  if (netIncome <= perCapitaLimit) {
    return {
      ...NON_TAXABLE_RESIDENCE_TAX_DETAIL,
      nonTaxableStatus: 'incomeThreshold',
      nonTaxableLimit: perCapitaLimit,
      basicDeduction: calculateResidenceTaxBasicDeduction(netIncome),
    };
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

  // The 所得控除 come off 総所得金額 first, and what they cannot absorb off the 申告分離課税
  // classes (地方税法附則第33条の2第3項第3号, 第35条の2第4項第3号 as 第35条の2の2第4項 applies
  // it); each class is then floored to ¥1,000.
  const separateNetIncomeTotal = separateNetIncome.dividends + separateNetIncome.capitalGains;
  const classes = applyDeductionSpillover(
    {
      aggregate: netIncome - separateNetIncomeTotal,
      dividends: separateNetIncome.dividends,
      capitalGains: separateNetIncome.capitalGains,
    },
    nonBasicDeductions +
      basicDeduction +
      dependentDeductions.residenceTax.total +
      personalDeductions.residence,
  );
  const taxableIncome = floorTaxableIncome(classes.aggregate);
  const taxableDividends = floorTaxableIncome(classes.dividends);
  const taxableCapitalGains = floorTaxableIncome(classes.capitalGains);
  const rates = getInvestmentIncomeTaxRates(year);
  const separateTaxableIncome = taxableDividends + taxableCapitalGains;
  const separateCityIncomeTax = rates.listedReportedMunicipalRate.taxOn(separateTaxableIncome);
  const separatePrefecturalIncomeTax =
    rates.listedReportedPrefecturalRate.taxOn(separateTaxableIncome);

  const personalDeductionDifference =
    calculateStatutoryPersonalDeductionDifference(dependentDeductions, netIncome) +
    personalDeductions.statutoryDifference;

  // 調整控除額 (adjustment credit) — on 課税総所得金額 alone (地方税法第314条の6).
  const adjustmentCredit = calculateAdjustmentCredit(
    netIncome,
    taxableIncome,
    personalDeductionDifference,
  );
  const cityAdjustmentCredit = CITY_TAX_PROPORTION.taxOn(adjustmentCredit);
  const prefecturalAdjustmentCredit = PREFECTURAL_TAX_PROPORTION.taxOn(adjustmentCredit);

  // Each side's 所得割 — the 6%/4% on 課税総所得金額 and the 3%/2% on the 申告分離課税 classes
  // together — is floored to ¥100 once, after the credits.
  const cityBeforeForeignTaxCredit = Math.max(
    0,
    CITY_RESIDENCE_TAX_RATE.taxOn(taxableIncome) +
      separateCityIncomeTax -
      cityAdjustmentCredit -
      CITY_TAX_PROPORTION.taxOn(credits.homeLoan) -
      (credits.furusato?.city ?? 0),
  );
  const cityForeignTaxCredit = Math.min(credits.foreignTax?.city ?? 0, cityBeforeForeignTaxCredit);
  const cityIncomeTax = Math.floor((cityBeforeForeignTaxCredit - cityForeignTaxCredit) / 100) * 100;
  const prefecturalBeforeForeignTaxCredit = Math.max(
    0,
    PREFECTURAL_RESIDENCE_TAX_RATE.taxOn(taxableIncome) +
      separatePrefecturalIncomeTax -
      prefecturalAdjustmentCredit -
      PREFECTURAL_TAX_PROPORTION.taxOn(credits.homeLoan) -
      (credits.furusato?.prefecture ?? 0),
  );
  const prefecturalForeignTaxCredit = Math.min(
    credits.foreignTax?.prefecture ?? 0,
    prefecturalBeforeForeignTaxCredit,
  );
  const prefecturalIncomeTax =
    Math.floor((prefecturalBeforeForeignTaxCredit - prefecturalForeignTaxCredit) / 100) * 100;

  const separate: ResidenceTaxSeparateDetails | undefined =
    separateNetIncomeTotal > 0
      ? {
          taxableDividends,
          taxableCapitalGains,
          cityIncomeTax: separateCityIncomeTax,
          prefecturalIncomeTax: separatePrefecturalIncomeTax,
        }
      : undefined;

  return {
    taxableIncome,
    cityProportion: CITY_TAX_PROPORTION,
    prefecturalProportion: PREFECTURAL_TAX_PROPORTION,
    residenceTaxRate: RESIDENCE_TAX_RATE,
    basicDeduction,
    personalDeductionDifference,
    city: {
      cityTaxableIncome: CITY_TAX_PROPORTION.taxOn(taxableIncome),
      cityAdjustmentCredit,
      cityIncomeTax,
      cityPerCapitaTax,
    },
    prefecture: {
      prefecturalTaxableIncome: PREFECTURAL_TAX_PROPORTION.taxOn(taxableIncome),
      prefecturalAdjustmentCredit,
      prefecturalIncomeTax,
      prefecturalPerCapitaTax,
    },
    perCapitaTax,
    forestEnvironmentTax,
    totalResidenceTax: cityIncomeTax + prefecturalIncomeTax + perCapitaTax,
    ...(separate && { separate }),
    ...((cityForeignTaxCredit > 0 || prefecturalForeignTaxCredit > 0) && {
      foreignTaxCredit: { city: cityForeignTaxCredit, prefecture: prefecturalForeignTaxCredit },
    }),
  };
};

/**
 * {@link countDependentsWithinEligibilityIncome} for callers holding computed deductions rather
 * than the dependent list, which is what {@link calculateResidenceTax} is given. Deduplicates
 * because one dependent can contribute two breakdown rows (a 障害者控除 row alongside the main
 * deduction); every dependent contributes at least one, so this recovers the whole list.
 */
function countQualifiedDependentsFromBreakdown(
  dependentDeductions: DependentDeductionResults,
  year: number,
): number {
  const uniqueDependents = new Map<string, Dependent>();
  dependentDeductions.breakdown.forEach(b => {
    uniqueDependents.set(b.dependent.id, b.dependent);
  });

  return countDependentsWithinEligibilityIncome([...uniqueDependents.values()], year);
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
 * Exported for the 介護保険 第1号 tier judgment ({@link isResidenceTaxExempt},
 * {@link isDependentResidenceTaxable}), which shares the 級地1 simplification.
 *
 * @param qualifiedDependentsCount Number of
 *   {@link countDependentsWithinEligibilityIncome qualified dependents}
 * @returns Object containing both net income limits
 * @see https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/hikazeikijun/juuminzei-hikazei.html
 */
export function getResidenceTaxExemptionLimits(qualifiedDependentsCount: number): {
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
    adjustmentCredit = ADJUSTMENT_CREDIT_RATE.taxOn(
      Math.min(personalDeductionDifference, taxableIncome),
    );
  } else {
    // taxableIncome > 2M
    // Per 地方税法 §314-6, the personal deduction difference is first reduced by
    // (taxable income - ¥2M), then floored at ¥50,000, before the 5% rate is applied
    // (so 50_000 * 0.05 = a ¥2,500 minimum adjustment credit).
    const reducedDifference = Math.max(
      personalDeductionDifference - (taxableIncome - 2_000_000),
      50_000,
    );
    adjustmentCredit = ADJUSTMENT_CREDIT_RATE.taxOn(reducedDifference);
  }
  return adjustmentCredit;
}

// ふるさと納税の自己負担額
export const FURUSATO_OUT_OF_POCKET_COST = 2000;
// 基本控除率 (ふるさと納税の寄付金控除の基本控除率)
export const DONATION_BASIC_DEDUCTION_RATE = percent(10);
export const FURUSATO_SPECIAL_DEDUCTION_CEILING_RATE = percent(20);
export const FURUSATO_INCOME_CEILING_RATE = percent(30);

/**
 * Income ceiling rate for national income tax donation deduction (寄附金控除).
 * Eligible donations are capped at 40% of the taxpayer's total net income (総所得金額等).
 *
 * Statutory basis: 所得税法第78条第1項 (所法78条①)
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1150.htm
 */
export const NATIONAL_DONATION_INCOME_CEILING_RATE = percent(40);

export interface FurusatoResidenceCreditDetails {
  residenceTaxDonationBasicDeduction: number;
  residenceTaxSpecialDeduction: number;
  city: number;
  prefecture: number;
}

export interface FurusatoLimitDetails {
  finalLimit: number;
  deductibleDonation: number;
  residenceTaxDonationBasicDeduction: number;
  residenceTaxSpecialDeduction: number;
}

const ZERO_FURUSATO_RESIDENCE_CREDIT: FurusatoResidenceCreditDetails = {
  residenceTaxDonationBasicDeduction: 0,
  residenceTaxSpecialDeduction: 0,
  city: 0,
  prefecture: 0,
};

/**
 * Intermediate parameters used to compute Furusato Nozei deduction caps and residence tax credits.
 */
interface FurusatoCapParameters {
  totalResidenceTaxableIncome: number;
  specialDeductionRate: Rate;
  /**
   * Statutory ceiling on eligible donations based on residence taxable income (30% of total taxable income).
   *
   * Statutory basis: 地方税法第37条の2第1項第1号 (市町村民税) and 第314条の7第1項第1号 (道府県民税).
   * Total donations eligible for the residence tax credit are capped at 30% of 総所得金額等.
   */
  donationIncomeCeiling: number;
  /**
   * Maximum allowable special deduction (20% of 所得割額).
   *
   * Statutory basis: 地方税法第37条の2第2項 (市町村民税) and 第314条の7第2項 (道府県民税).
   * The special deduction (特例控除額) cannot exceed 20% of the taxpayer's 所得割 amount.
   */
  maxSpecialDeduction: number;
}

function getFurusatoCapParameters(
  residenceTaxDetailsForCap: ResidenceTaxDetails,
  year: number,
): FurusatoCapParameters | undefined {
  const residenceSeparate = residenceTaxDetailsForCap.separate;
  const residenceSeparateTaxableIncome = residenceSeparate
    ? residenceSeparate.taxableDividends + residenceSeparate.taxableCapitalGains
    : 0;
  const totalResidenceTaxableIncome =
    residenceTaxDetailsForCap.taxableIncome + residenceSeparateTaxableIncome;
  if (totalResidenceTaxableIncome <= 0) {
    return undefined;
  }

  const separateNationalRate =
    residenceSeparateTaxableIncome > 0
      ? getInvestmentIncomeTaxRates(year).listedReportedNationalRate
      : undefined;

  // 調整控除後・住宅ローン控除前の所得割 — the base for the 20% special-deduction cap. It includes
  // the 所得割 on reported investment income (地方税法附則第33条の2第3項第4号, 第35条の2第4項
  // 第4号 as 第35条の2の2第4項 applies it, which read 「所得割の額」 in 第37条の2 as the sum).
  const residentTaxAmountForIncomePortion =
    residenceTaxDetailsForCap.totalResidenceTax - residenceTaxDetailsForCap.perCapitaTax;

  // Special deduction rate for resident tax (特例控除割合)
  const specialDeductionRate = getSpecialDeductionMultiplier(
    residenceTaxDetailsForCap.taxableIncome,
    residenceTaxDetailsForCap.personalDeductionDifference,
    separateNationalRate,
  );

  // Statutory ceiling: donations eligible for the residence tax deduction cannot exceed 30% of
  // total residence taxable income (地方税法第37条の2第1項第1号, 第314条の7第1項第1号).
  const donationIncomeCeiling = FURUSATO_INCOME_CEILING_RATE.taxOn(totalResidenceTaxableIncome);
  const maxSpecialDeduction = FURUSATO_SPECIAL_DEDUCTION_CEILING_RATE.taxOn(
    residentTaxAmountForIncomePortion,
  );

  return {
    totalResidenceTaxableIncome,
    specialDeductionRate,
    donationIncomeCeiling,
    maxSpecialDeduction,
  };
}

function computeFurusatoResidenceCreditFromParams(
  donationAmount: number,
  residenceTaxDetailsForCap: ResidenceTaxDetails,
  params: FurusatoCapParameters,
): FurusatoResidenceCreditDetails {
  const deductibleDonation = Math.max(
    Math.min(donationAmount, params.donationIncomeCeiling) - FURUSATO_OUT_OF_POCKET_COST,
    0,
  );

  const residenceTaxDonationBasicDeduction =
    DONATION_BASIC_DEDUCTION_RATE.taxOn(deductibleDonation);

  const unsplitSpecialDeduction = Math.min(
    deductibleDonation * params.specialDeductionRate.toDecimal(),
    params.maxSpecialDeduction,
  );
  const residenceTaxSpecialDeduction =
    Math.ceil(unsplitSpecialDeduction * residenceTaxDetailsForCap.cityProportion.toDecimal()) +
    Math.ceil(
      unsplitSpecialDeduction * residenceTaxDetailsForCap.prefecturalProportion.toDecimal(),
    );

  const furusatoNozeiTaxCredit = residenceTaxDonationBasicDeduction + residenceTaxSpecialDeduction;
  const city = Math.ceil(
    furusatoNozeiTaxCredit * residenceTaxDetailsForCap.cityProportion.toDecimal(),
  );
  const prefecture = Math.ceil(
    furusatoNozeiTaxCredit * residenceTaxDetailsForCap.prefecturalProportion.toDecimal(),
  );

  return {
    residenceTaxDonationBasicDeduction,
    residenceTaxSpecialDeduction,
    city,
    prefecture,
  };
}

/**
 * Calculates the residence tax credits (basic and special deductions, with municipal and
 * prefectural breakdown) for a given Furusato Nozei donation amount.
 */
export function calculateFurusatoResidenceCredit(
  donationAmount: number,
  residenceTaxDetailsForCap: ResidenceTaxDetails,
  year: number,
): FurusatoResidenceCreditDetails {
  if (donationAmount <= FURUSATO_OUT_OF_POCKET_COST) {
    return ZERO_FURUSATO_RESIDENCE_CREDIT;
  }

  const params = getFurusatoCapParameters(residenceTaxDetailsForCap, year);
  if (!params) {
    return ZERO_FURUSATO_RESIDENCE_CREDIT;
  }

  return computeFurusatoResidenceCreditFromParams(
    donationAmount,
    residenceTaxDetailsForCap,
    params,
  );
}

/**
 * Calculates the maximum deductible Furusato Nozei donation limit and the corresponding
 * residence tax credits (basic and special deductions).
 */
export function calculateFurusatoLimit(
  taxableIncomeForNationalIncomeTax: number,
  residenceTaxDetailsForCap: ResidenceTaxDetails,
  reported?: { nationalTaxable: SeparateNetIncome; year: number },
): FurusatoLimitDetails {
  const nationalClasses: IncomeClassAmounts = {
    aggregate: taxableIncomeForNationalIncomeTax,
    dividends: reported?.nationalTaxable.dividends ?? 0,
    capitalGains: reported?.nationalTaxable.capitalGains ?? 0,
  };
  const noLimit: FurusatoLimitDetails = {
    finalLimit: 0,
    deductibleDonation: 0,
    residenceTaxDonationBasicDeduction: 0,
    residenceTaxSpecialDeduction: 0,
  };

  if (nationalClasses.aggregate + nationalClasses.dividends + nationalClasses.capitalGains <= 0) {
    return noLimit;
  }

  const params = getFurusatoCapParameters(
    residenceTaxDetailsForCap,
    reported?.year ?? DEFAULT_INCOME_YEAR,
  );
  if (!params) {
    return noLimit;
  }

  const furusatoNozeiLimit =
    params.maxSpecialDeduction / params.specialDeductionRate.toDecimal() +
    FURUSATO_OUT_OF_POCKET_COST;

  const finalLimit =
    Math.floor(Math.min(furusatoNozeiLimit, params.donationIncomeCeiling) / 1000) * 1000;
  const deductibleDonation = Math.max(finalLimit - FURUSATO_OUT_OF_POCKET_COST, 0);

  const credits = computeFurusatoResidenceCreditFromParams(
    finalLimit,
    residenceTaxDetailsForCap,
    params,
  );

  return {
    finalLimit,
    deductibleDonation,
    residenceTaxDonationBasicDeduction: credits.residenceTaxDonationBasicDeduction,
    residenceTaxSpecialDeduction: credits.residenceTaxSpecialDeduction,
  };
}

const ONE_HUNDRED_PERCENT = percent(100);

/**
 * Returns the 特例控除割合 for the taxpayer.
 *
 * The bands and ratios are the statute's own table (第37条の2第11項第一号: 195万円以下 →
 * 100分の85, …, 4,000万円超 → 100分の45) over 課税総所得金額 less the 人的控除差調整額, where each
 * ratio equals 90% minus the band's rate below. 附則第5条の6 replaces each ratio for
 * 平成26年度〜令和20年度 (2014–2038) with the value that folds in the 復興特別所得税 factor
 * (100分の85 → 100分の84.895, which equals 90% − 5% × 1.021), so this function computes the
 * replaced ratio as 1 − donationBasicDeductionRate − (band rate × 1.021).
 *
 * When there is no 課税総所得金額, or the 人的控除差調整額 exceeds it, and investment income is
 * reported under 申告分離課税, 附則第5条の5第1項第5号 sets the ratio to 100分の75 instead —
 * 100分の74.685 after 附則第5条の6 — which is the same computation at that income's own 15%
 * rate. (Without reported income that case is 100分の90 under 第37条の2第11項第二号, which is
 * not modelled: the band table is applied as if the adjusted figure were in its lowest band.)
 *
 * Deliberately not derived from NATIONAL_INCOME_TAX_BRACKETS: the statute defines this table
 * itself and does not reference 所得税法, so the two tables only coincide under current law. They
 * already disagree at exact band boundaries — 1,950,000 is inside the 85% band here (195万円以下),
 * while the 速算表 data ends its 5% row at 1,949,000 and starts the 10% row at 1,950,000 (equal
 * tax either way at that point, but a different marginal rate). If the income tax brackets are
 * reformed, this table changes only when 地方税法 itself is amended.
 *
 * @param taxableIncome 住民税の課税総所得金額
 * @param personalDeductionDifference 人的控除差調整額
 * @param separateNationalRate the 所得税 rate on the reported investment income, when there is
 *   any with a taxable amount left after the 所得控除; undefined otherwise
 * @returns 特例控除割合
 * @see 地方税法第37条の2第11項第一号（道府県民税）・第314条の7第11項第一号（市町村民税）
 * @see 地方税法附則第5条の5第1項第五号（分離課税所得がある場合の特例控除額の特例）
 * @see 地方税法附則第5条の6（復興特別所得税分の読替え、平成26年度〜令和20年度）
 */
export function getSpecialDeductionMultiplier(
  taxableIncome: number,
  personalDeductionDifference: number,
  separateNationalRate: Rate | undefined,
): Rate {
  const adjustedTaxableIncome = taxableIncome - personalDeductionDifference;
  let incomeTaxRate: Rate;
  if (separateNationalRate !== undefined && (taxableIncome <= 0 || adjustedTaxableIncome < 0)) {
    incomeTaxRate = separateNationalRate;
  } else if (adjustedTaxableIncome <= 1950000) incomeTaxRate = percent(5);
  else if (adjustedTaxableIncome <= 3300000) incomeTaxRate = percent(10);
  else if (adjustedTaxableIncome <= 6950000) incomeTaxRate = percent(20);
  else if (adjustedTaxableIncome <= 9000000) incomeTaxRate = percent(23);
  else if (adjustedTaxableIncome <= 18000000) incomeTaxRate = percent(33);
  else if (adjustedTaxableIncome <= 40000000) incomeTaxRate = percent(40);
  else incomeTaxRate = percent(45); // Over 40 million

  // 附則第5条の6 read-replacement: fold the 復興特別所得税 factor into the ratio
  const surtax = incomeTaxRate.times(RECONSTRUCTION_SURTAX_RATE);
  const totalIncomeTaxRate = incomeTaxRate.plus(surtax);

  return ONE_HUNDRED_PERCENT.minus(DONATION_BASIC_DEDUCTION_RATE).minus(totalIncomeTaxRate);
}
