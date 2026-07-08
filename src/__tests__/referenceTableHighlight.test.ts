// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import {
  getDedupedNationalBasicDeductionTiers,
  getNationalBasicDeductionHighlightIndex,
  getResidenceBasicDeductionHighlightIndex,
  getNationalIncomeTaxBracketHighlightIndex,
  getEmploymentIncomeDeductionHighlightIndex,
} from '../components/TakeHomeCalculator/tabs/referenceTableHighlight';
import { getNationalBasicDeductionTiers } from '../data/nationalBasicDeduction';

describe('getDedupedNationalBasicDeductionTiers', () => {
  it('keeps every tier when no consecutive deductions match (2025)', () => {
    const deduped = getDedupedNationalBasicDeductionTiers(getNationalBasicDeductionTiers(2025));
    expect(deduped.map(t => t.maxIncomeInclusive)).toEqual([
      1_320_000, 3_360_000, 4_890_000, 6_550_000, 23_500_000, 24_000_000, 24_500_000, 25_000_000,
    ]);
  });

  it('collapses a run of equal deductions to its last tier (2026)', () => {
    // 2026 has three consecutive 1,040,000 tiers (≤1.32M, ≤3.36M, ≤4.89M) → one "Up to 4,890,000" row.
    const deduped = getDedupedNationalBasicDeductionTiers(getNationalBasicDeductionTiers(2026));
    expect(deduped.map(t => t.maxIncomeInclusive)).toEqual([
      4_890_000, 6_550_000, 23_500_000, 24_000_000, 24_500_000, 25_000_000,
    ]);
  });
});

describe('getNationalBasicDeductionHighlightIndex', () => {
  // 2025 displayed rows: eight deduped "Up to X" rows (indices 0–7) + appended "Over 25M" (index 8).
  const tiers2025 = getNationalBasicDeductionTiers(2025);

  it('maps net income to the first tier it does not exceed', () => {
    expect(getNationalBasicDeductionHighlightIndex(tiers2025, 1)).toBe(0);
    expect(getNationalBasicDeductionHighlightIndex(tiers2025, 1_320_000)).toBe(0);
    expect(getNationalBasicDeductionHighlightIndex(tiers2025, 1_320_001)).toBe(1);
    expect(getNationalBasicDeductionHighlightIndex(tiers2025, 25_000_000)).toBe(7);
  });

  it('maps income above every tier to the appended "Over" row', () => {
    expect(getNationalBasicDeductionHighlightIndex(tiers2025, 25_000_001)).toBe(8);
    expect(getNationalBasicDeductionHighlightIndex(tiers2025, 100_000_000)).toBe(8);
  });

  it('indexes against the deduplicated rows, not the raw tiers (2026)', () => {
    const tiers2026 = getNationalBasicDeductionTiers(2026);
    // The three merged 1.04M tiers are one row (index 0), so anything ≤4.89M highlights it.
    expect(getNationalBasicDeductionHighlightIndex(tiers2026, 1_000_000)).toBe(0);
    expect(getNationalBasicDeductionHighlightIndex(tiers2026, 4_890_000)).toBe(0);
    expect(getNationalBasicDeductionHighlightIndex(tiers2026, 4_890_001)).toBe(1);
    // Appended "Over 25M" row is index 6 (six deduped rows).
    expect(getNationalBasicDeductionHighlightIndex(tiers2026, 25_000_001)).toBe(6);
  });
});

describe('getResidenceBasicDeductionHighlightIndex', () => {
  it('selects the row from net income at each inclusive boundary', () => {
    expect(getResidenceBasicDeductionHighlightIndex(0)).toBe(0);
    expect(getResidenceBasicDeductionHighlightIndex(24_000_000)).toBe(0);
    expect(getResidenceBasicDeductionHighlightIndex(24_000_001)).toBe(1);
    expect(getResidenceBasicDeductionHighlightIndex(24_500_000)).toBe(1);
    expect(getResidenceBasicDeductionHighlightIndex(24_500_001)).toBe(2);
    expect(getResidenceBasicDeductionHighlightIndex(25_000_000)).toBe(2);
    expect(getResidenceBasicDeductionHighlightIndex(25_000_001)).toBe(3);
  });
});

describe('getNationalIncomeTaxBracketHighlightIndex', () => {
  it('selects the marginal bracket at each boundary', () => {
    expect(getNationalIncomeTaxBracketHighlightIndex(0)).toBe(0);
    expect(getNationalIncomeTaxBracketHighlightIndex(1_949_000)).toBe(0);
    expect(getNationalIncomeTaxBracketHighlightIndex(1_949_001)).toBe(1);
    expect(getNationalIncomeTaxBracketHighlightIndex(3_299_000)).toBe(1);
    expect(getNationalIncomeTaxBracketHighlightIndex(3_299_001)).toBe(2);
    expect(getNationalIncomeTaxBracketHighlightIndex(6_949_000)).toBe(2);
    expect(getNationalIncomeTaxBracketHighlightIndex(6_949_001)).toBe(3);
    expect(getNationalIncomeTaxBracketHighlightIndex(8_999_000)).toBe(3);
    expect(getNationalIncomeTaxBracketHighlightIndex(8_999_001)).toBe(4);
    expect(getNationalIncomeTaxBracketHighlightIndex(17_999_000)).toBe(4);
    expect(getNationalIncomeTaxBracketHighlightIndex(17_999_001)).toBe(5);
    expect(getNationalIncomeTaxBracketHighlightIndex(39_999_000)).toBe(5);
    expect(getNationalIncomeTaxBracketHighlightIndex(39_999_001)).toBe(6);
    expect(getNationalIncomeTaxBracketHighlightIndex(40_000_000)).toBe(6);
  });
});

describe('getEmploymentIncomeDeductionHighlightIndex', () => {
  // Standard tiers are shared by 2025 & 2026: three finite steps then the Infinity cap.
  const standardTiers = [
    { grossMaxInclusive: 3_600_000 },
    { grossMaxInclusive: 6_600_000 },
    { grossMaxInclusive: 8_500_000 },
    { grossMaxInclusive: Infinity },
  ];

  it('selects the flat-floor row 0 at and below the flat upper bound (2025: 1,900,000)', () => {
    const flatUpperBound = 1_900_000;
    expect(getEmploymentIncomeDeductionHighlightIndex(1, flatUpperBound, standardTiers)).toBe(0);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(1_900_000, flatUpperBound, standardTiers),
    ).toBe(0);
  });

  it('selects tier rows (offset by the flat-floor row) above the flat upper bound (2025)', () => {
    const flatUpperBound = 1_900_000;
    expect(
      getEmploymentIncomeDeductionHighlightIndex(1_900_001, flatUpperBound, standardTiers),
    ).toBe(1);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(3_600_000, flatUpperBound, standardTiers),
    ).toBe(1);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(3_600_001, flatUpperBound, standardTiers),
    ).toBe(2);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(6_600_000, flatUpperBound, standardTiers),
    ).toBe(2);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(6_600_001, flatUpperBound, standardTiers),
    ).toBe(3);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(8_500_000, flatUpperBound, standardTiers),
    ).toBe(3);
    // Above the last finite tier → the Infinity cap row (index 4).
    expect(
      getEmploymentIncomeDeductionHighlightIndex(8_500_001, flatUpperBound, standardTiers),
    ).toBe(4);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(50_000_000, flatUpperBound, standardTiers),
    ).toBe(4);
  });

  it('treats the flat-floor + transition span as row 0 (2026: 2,200,000)', () => {
    const flatUpperBound = 2_200_000;
    // 2,190,999 (flat floor) and 2,199,999 (transition) both fall in the "Up to 2,200,000" row.
    expect(
      getEmploymentIncomeDeductionHighlightIndex(2_190_999, flatUpperBound, standardTiers),
    ).toBe(0);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(2_199_999, flatUpperBound, standardTiers),
    ).toBe(0);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(2_200_000, flatUpperBound, standardTiers),
    ).toBe(0);
    expect(
      getEmploymentIncomeDeductionHighlightIndex(2_200_001, flatUpperBound, standardTiers),
    ).toBe(1);
  });
});
