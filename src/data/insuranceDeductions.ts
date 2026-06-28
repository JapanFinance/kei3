// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Life insurance (生命保険料控除) and earthquake insurance (地震保険料控除) premium
 * deductions. Both produce a {@link DeductionAmount} because the income-tax and
 * residence-tax amounts differ — which is exactly why they get structured inputs
 * rather than being folded into a single combined figure.
 *
 * Sources:
 *   - 生命保険料控除 (national): NTA No.1140 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm
 *   - 生命保険料控除 (residence): 練馬区 https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/seimeihokenryokojo.html
 *   - 地震保険料控除 (national): NTA No.1145 https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1145.htm
 *   - 地震保険料控除 (residence): 練馬区 https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jishinhokenryoukojo.html
 *
 * These figures have been stable since the 新契約 regime began in 2012 (life) and the
 * earthquake deduction replaced 損害保険料控除 in 2007, so they are plain constants rather
 * than year-indexed tables — with one year-bound exception: the 令和8・9年分 (2026–2027)
 * child-rearing measure that raises the 一般 (new-contract) income-tax cap to ¥60,000 (see
 * {@link isChildRearingLifeExpansionYear}). If other figures change, convert to year-banded
 * tables like `data/homeLoanTaxCredit.ts`.
 */

import type { DeductionAmount } from '../types/dependents';
import type { EarthquakeInsuranceInput, LifeInsuranceInput } from '../types/tax';

/**
 * A premium band: every premium up to and including `upTo` (yen) uses `amount` to compute
 * the raw (pre-rounding) deduction. Tables are ordered ascending and the final band uses
 * `upTo: Infinity` for the flat maximum.
 */
interface DeductionBand {
  upTo: number;
  amount: (premium: number) => number;
}

/**
 * Rounds a raw deduction up to the next whole yen (1円未満切上げ). Premiums are usually
 * round figures, so this only bites on the ½/¼ formulas with odd premiums. The small
 * epsilon keeps an exactly-integer result (e.g. 30000.0000001 from float error) from
 * rounding spuriously up to 30001.
 */
const roundUpYen = (amount: number): number => {
  const rounded = Math.ceil(amount - 1e-9);
  // Math.ceil(-1e-9) yields -0; normalize so deduction outputs never carry a negative zero.
  return rounded === 0 ? 0 : rounded;
};

const applyBands = (premium: number, bands: ReadonlyArray<DeductionBand>): number => {
  const p = Math.max(0, premium);
  for (const band of bands) {
    if (p <= band.upTo) return roundUpYen(band.amount(p));
  }
  return 0; // Unreachable: the last band is always upTo: Infinity.
};

// 生命保険料控除 — per-category bands, new (新契約) and old (旧契約) regimes.
const LIFE_NEW_NATIONAL: ReadonlyArray<DeductionBand> = [
  { upTo: 20_000, amount: p => p },
  { upTo: 40_000, amount: p => p / 2 + 10_000 },
  { upTo: 80_000, amount: p => p / 4 + 20_000 },
  { upTo: Infinity, amount: () => 40_000 },
];
const LIFE_OLD_NATIONAL: ReadonlyArray<DeductionBand> = [
  { upTo: 25_000, amount: p => p },
  { upTo: 50_000, amount: p => p / 2 + 12_500 },
  { upTo: 100_000, amount: p => p / 4 + 25_000 },
  { upTo: Infinity, amount: () => 50_000 },
];
const LIFE_NEW_RESIDENCE: ReadonlyArray<DeductionBand> = [
  { upTo: 12_000, amount: p => p },
  { upTo: 32_000, amount: p => p / 2 + 6_000 },
  { upTo: 56_000, amount: p => p / 4 + 14_000 },
  { upTo: Infinity, amount: () => 28_000 },
];
const LIFE_OLD_RESIDENCE: ReadonlyArray<DeductionBand> = [
  { upTo: 15_000, amount: p => p },
  { upTo: 40_000, amount: p => p / 2 + 7_500 },
  { upTo: 70_000, amount: p => p / 4 + 17_500 },
  { upTo: Infinity, amount: () => 35_000 },
];

/**
 * 令和8・9年分 (2026–2027) child-rearing measure: when the taxpayer has a 23歳未満の扶養親族, the
 * 一般 (new-contract) income-tax deduction uses this scale (the standard ¥40,000 table scaled
 * ×1.5) with a ¥60,000 cap. Income tax only — residence tax, the 介護医療/個人年金 categories, the
 * old-contract cap, and the ¥120,000 overall cap are unchanged. 令和7年度改正 introduced it for
 * 令和8年分; 令和8年度改正 extended it to 令和9年分.
 * Sources: 税理士 https://www.yamada-partners.jp/reform/r7/k02-expansion-of-life-insurance-premium-deduction ;
 *          NTA 令和8改正 https://www.nta.go.jp/publication/pamph/gensen/2026kaisei.pdf
 */
const LIFE_NEW_GENERAL_NATIONAL_CHILD_REARING: ReadonlyArray<DeductionBand> = [
  { upTo: 30_000, amount: p => p },
  { upTo: 60_000, amount: p => p / 2 + 15_000 },
  { upTo: 120_000, amount: p => p / 4 + 30_000 },
  { upTo: Infinity, amount: () => 60_000 },
];
const CHILD_REARING_LIFE_EXPANSION_YEARS: ReadonlySet<number> = new Set([2026, 2027]);

/** Whether the income year is covered by the child-rearing 一般生命保険料控除 expansion (令和8・9年分).
 * @see LIFE_NEW_GENERAL_NATIONAL_CHILD_REARING
 */
export const isChildRearingLifeExpansionYear = (year: number): boolean =>
  CHILD_REARING_LIFE_EXPANSION_YEARS.has(year);

/** Per-category and overall caps for one tax regime. */
interface LifeRegime {
  newBands: ReadonlyArray<DeductionBand>;
  oldBands: ReadonlyArray<DeductionBand>;
  /** Cap on the new-only and the new+old combined methods. */
  newCategoryCap: number;
  /** Cap on the old-only method. */
  oldCategoryCap: number;
  /** Cap on the sum of all categories. */
  overallCap: number;
}

const LIFE_NATIONAL: LifeRegime = {
  newBands: LIFE_NEW_NATIONAL,
  oldBands: LIFE_OLD_NATIONAL,
  newCategoryCap: 40_000,
  oldCategoryCap: 50_000,
  overallCap: 120_000,
};
const LIFE_RESIDENCE: LifeRegime = {
  newBands: LIFE_NEW_RESIDENCE,
  oldBands: LIFE_OLD_RESIDENCE,
  newCategoryCap: 28_000,
  oldCategoryCap: 35_000,
  overallCap: 70_000,
};

/**
 * The national regime with the 令和8・9年分 child-rearing raise applied to the 一般 category: the
 * new-contract scale and cap become ¥60,000 (income tax only). Used solely for the 一般 category
 * when eligible — 介護医療, 個人年金, and the overall cap still come from {@link LIFE_NATIONAL}.
 */
const LIFE_GENERAL_NATIONAL_CHILD_REARING: LifeRegime = {
  ...LIFE_NATIONAL,
  newBands: LIFE_NEW_GENERAL_NATIONAL_CHILD_REARING,
  newCategoryCap: 60_000,
};

/**
 * Deduction for one life-insurance category (一般 or 個人年金), which may hold both old and
 * new contracts. Computed cap-agnostically as the most favourable of: new-only (cap
 * newCategoryCap), old-only (cap oldCategoryCap), and new+old combined (cap newCategoryCap).
 *
 * This deliberately does NOT hardcode the NTA's "old premium > ¥60,000" rule from
 * https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1140.htm: that ¥60,000 is the
 * break-even where the old-only deduction reaches the ¥40,000 combined cap, and it is
 * specific to national income tax. The residence brackets put the break-even at ¥42,000,
 * so a hardcoded threshold would understate residence tax. Taking the max reproduces the
 * national rule exactly and stays correct for residence (練馬区: "有利な適用方法を選択").
 */
const lifeCategoryDeduction = (
  newPremium: number,
  oldPremium: number,
  regime: LifeRegime,
): number => {
  const newDed = Math.min(applyBands(newPremium, regime.newBands), regime.newCategoryCap);
  const oldDed = Math.min(applyBands(oldPremium, regime.oldBands), regime.oldCategoryCap);
  const combined = Math.min(newDed + oldDed, regime.newCategoryCap);
  return Math.max(newDed, oldDed, combined);
};

const lifeDeductionForRegime = (
  input: LifeInsuranceInput,
  regime: LifeRegime,
  generalRegime: LifeRegime = regime,
): number => {
  // The child-rearing raise applies to the 一般 category only, so it uses `generalRegime` (which
  // differs from `regime` only when the raise is in effect); 介護医療, 個人年金, and the overall cap
  // always use the base `regime`.
  const total =
    lifeCategoryDeduction(input.generalNew, input.generalOld ?? 0, generalRegime) +
    lifeCategoryDeduction(input.medicalCareNew, 0, regime) + // 介護医療: new-contract only.
    lifeCategoryDeduction(input.pensionNew, input.pensionOld ?? 0, regime);
  return Math.min(total, regime.overallCap);
};

/**
 * Life insurance premium deduction (生命保険料控除) from annual premiums, split by tax.
 * Sums the three categories (一般 / 介護医療 / 個人年金) and applies the overall cap
 * (¥120,000 national / ¥70,000 residence).
 *
 * For an eligible child-rearing year (`year`) with a 23歳未満 dependent (`hasDependentUnder23`),
 * the 一般 (new-contract) income-tax cap is raised to ¥60,000. Residence tax is never affected.
 *
 * @param year                 Income (tax) year being modeled.
 * @param hasDependentUnder23  Whether the taxpayer has a 23歳未満の扶養親族.
 */
export const calculateLifeInsuranceDeduction = (
  input: LifeInsuranceInput,
  year: number,
  hasDependentUnder23: boolean,
): DeductionAmount => {
  // The raise applies to the 一般 category of national income tax only, so it is passed as that
  // category's regime; every other category uses the base national regime.
  const generalRaised = hasDependentUnder23 && isChildRearingLifeExpansionYear(year);
  const nationalGeneralRegime = generalRaised ? LIFE_GENERAL_NATIONAL_CHILD_REARING : LIFE_NATIONAL;
  return {
    national: lifeDeductionForRegime(input, LIFE_NATIONAL, nationalGeneralRegime),
    residence: lifeDeductionForRegime(input, LIFE_RESIDENCE),
  };
};

// 地震保険料控除 — the 旧長期損害保険料 sub-portion (the 地震保険料 portion is handled inline).
const QUAKE_OLD_LONG_TERM_NATIONAL: ReadonlyArray<DeductionBand> = [
  { upTo: 10_000, amount: p => p },
  { upTo: 20_000, amount: p => p / 2 + 5_000 },
  { upTo: Infinity, amount: () => 15_000 },
];
const QUAKE_OLD_LONG_TERM_RESIDENCE: ReadonlyArray<DeductionBand> = [
  { upTo: 5_000, amount: p => p },
  { upTo: 15_000, amount: p => p / 2 + 2_500 },
  { upTo: Infinity, amount: () => 10_000 },
];

const QUAKE_OVERALL_CAP_NATIONAL = 50_000;
const QUAKE_OVERALL_CAP_RESIDENCE = 25_000;

/**
 * Earthquake insurance premium deduction (地震保険料控除) from annual premiums, split by tax.
 * National: 地震保険料 is deductible in full up to ¥50,000. Residence: 地震保険料 is ×½ up to
 * ¥25,000. Each may add a 旧長期損害保険料 portion; the combined total is capped at the
 * overall maximum (¥50,000 national / ¥25,000 residence).
 */
export const calculateEarthquakeInsuranceDeduction = (
  input: EarthquakeInsuranceInput,
): DeductionAmount => {
  const earthquake = Math.max(0, input.earthquake);
  const longTermOld = Math.max(0, input.longTermOld ?? 0);

  const quakeNational = Math.min(earthquake, QUAKE_OVERALL_CAP_NATIONAL);
  const oldNational = applyBands(longTermOld, QUAKE_OLD_LONG_TERM_NATIONAL);
  const national = Math.min(quakeNational + oldNational, QUAKE_OVERALL_CAP_NATIONAL);

  const quakeResidence = Math.min(roundUpYen(earthquake / 2), QUAKE_OVERALL_CAP_RESIDENCE);
  const oldResidence = applyBands(longTermOld, QUAKE_OLD_LONG_TERM_RESIDENCE);
  const residence = Math.min(quakeResidence + oldResidence, QUAKE_OVERALL_CAP_RESIDENCE);

  return { national, residence };
};

if (import.meta.env.DEV) {
  // Each band table must be ascending by `upTo` and terminate with an Infinity band.
  const tables: Record<string, ReadonlyArray<DeductionBand>> = {
    LIFE_NEW_NATIONAL,
    LIFE_NEW_NATIONAL_CHILD_REARING: LIFE_NEW_GENERAL_NATIONAL_CHILD_REARING,
    LIFE_OLD_NATIONAL,
    LIFE_NEW_RESIDENCE,
    LIFE_OLD_RESIDENCE,
    QUAKE_OLD_LONG_TERM_NATIONAL,
    QUAKE_OLD_LONG_TERM_RESIDENCE,
  };
  for (const [name, bands] of Object.entries(tables)) {
    if (bands.length === 0 || bands[bands.length - 1]!.upTo !== Infinity) {
      throw new Error(`insuranceDeductions: ${name} must end with an upTo: Infinity band`);
    }
    for (let i = 1; i < bands.length; i++) {
      if (bands[i]!.upTo <= bands[i - 1]!.upTo) {
        throw new Error(`insuranceDeductions: ${name} bands must be strictly ascending by upTo`);
      }
    }
  }
}
