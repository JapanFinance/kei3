// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import {
  getDedupedNationalBasicDeductionTiers,
  getNationalBasicDeductionHighlightIndex,
  getResidenceBasicDeductionHighlightIndex,
  getNationalIncomeTaxBracketHighlightIndex,
  getEmploymentIncomeDeductionHighlightIndex,
  buildNationalBasicDeductionRows,
  buildResidenceBasicDeductionRows,
  buildNationalIncomeTaxBracketRows,
} from '../components/TakeHomeCalculator/tabs/referenceTableHighlight';
import { getNationalBasicDeductionTiers } from '../data/nationalBasicDeduction';
import { calculateResidenceTaxBasicDeduction } from '../utils/residenceTax';

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

describe('buildNationalBasicDeductionRows', () => {
  it('renders the deduped 2025 tiers plus an appended "Over" row', () => {
    expect(buildNationalBasicDeductionRows(getNationalBasicDeductionTiers(2025))).toEqual([
      ['Up to 1,320,000', '950,000'],
      ['Up to 3,360,000', '880,000'],
      ['Up to 4,890,000', '680,000'],
      ['Up to 6,550,000', '630,000'],
      ['Up to 23,500,000', '580,000'],
      ['Up to 24,000,000', '480,000'],
      ['Up to 24,500,000', '320,000'],
      ['Up to 25,000,000', '160,000'],
      ['Over 25,000,000', '0'],
    ]);
  });

  it('collapses the merged 2026 tiers into one row', () => {
    expect(buildNationalBasicDeductionRows(getNationalBasicDeductionTiers(2026))).toEqual([
      ['Up to 4,890,000', '1,040,000'],
      ['Up to 6,550,000', '670,000'],
      ['Up to 23,500,000', '620,000'],
      ['Up to 24,000,000', '480,000'],
      ['Up to 24,500,000', '320,000'],
      ['Up to 25,000,000', '160,000'],
      ['Over 25,000,000', '0'],
    ]);
  });
});

describe('buildResidenceBasicDeductionRows', () => {
  it('renders the four residence tiers', () => {
    expect(buildResidenceBasicDeductionRows()).toEqual([
      ['Up to 24,000,000', '430,000'],
      ['24,000,001 - 24,500,000', '290,000'],
      ['24,500,001 - 25,000,000', '150,000'],
      ['Over 25,000,000', '0'],
    ]);
  });
});

describe('buildNationalIncomeTaxBracketRows', () => {
  it('renders the seven brackets, rounding the top-row lower bound to 40,000,000', () => {
    expect(buildNationalIncomeTaxBracketRows()).toEqual([
      ['Up to 1,949,000', '5%', '0'],
      ['1,949,001 - 3,299,000', '10%', '97,500'],
      ['3,299,001 - 6,949,000', '20%', '427,500'],
      ['6,949,001 - 8,999,000', '23%', '636,000'],
      ['8,999,001 - 17,999,000', '33%', '1,536,000'],
      ['17,999,001 - 39,999,000', '40%', '2,796,000'],
      ['40,000,000 and above', '45%', '4,796,000'],
    ]);
  });
});

// The payoff of one shared data source: the highlighted row is always the row that actually
// contains the taxpayer's figure, and (for the deduction) the number the calculation returns.
describe('table ↔ highlight consistency', () => {
  it('residence: the highlighted row is the one whose range covers the net income', () => {
    const rows = buildResidenceBasicDeductionRows();
    expect(rows[getResidenceBasicDeductionHighlightIndex(24_300_000)]?.[0]).toBe(
      '24,000,001 - 24,500,000',
    );
    expect(rows[getResidenceBasicDeductionHighlightIndex(24_000_000)]?.[0]).toBe(
      'Up to 24,000,000',
    );
    expect(rows[getResidenceBasicDeductionHighlightIndex(30_000_000)]?.[0]).toBe('Over 25,000,000');
  });

  it('income tax: the highlighted row is the marginal bracket row', () => {
    const rows = buildNationalIncomeTaxBracketRows();
    expect(rows[getNationalIncomeTaxBracketHighlightIndex(5_000_000)]?.[0]).toBe(
      '3,299,001 - 6,949,000',
    );
    expect(rows[getNationalIncomeTaxBracketHighlightIndex(1_949_000)]?.[0]).toBe('Up to 1,949,000');
    expect(rows[getNationalIncomeTaxBracketHighlightIndex(50_000_000)]?.[0]).toBe(
      '40,000,000 and above',
    );
  });

  it('residence: calc, table, and highlight agree on the deduction for each tier', () => {
    const rows = buildResidenceBasicDeductionRows();
    for (const netIncome of [10_000_000, 24_300_000, 24_800_000, 30_000_000]) {
      const idx = getResidenceBasicDeductionHighlightIndex(netIncome);
      expect(calculateResidenceTaxBasicDeduction(netIncome).toLocaleString('en')).toBe(
        rows[idx]?.[1],
      );
    }
  });
});
