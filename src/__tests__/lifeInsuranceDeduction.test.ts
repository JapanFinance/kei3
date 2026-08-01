// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { calculateLifeInsuranceDeduction } from '../data/insuranceDeductions';
import type { LifeInsuranceInput } from '../types/tax';

const life = (o: Partial<LifeInsuranceInput>): LifeInsuranceInput => ({
  generalNew: 0,
  medicalCareNew: 0,
  pensionNew: 0,
  ...o,
});

/**
 * Calls the deduction with test-friendly defaults: no child-rearing raise (year 2026, no
 * qualifying dependent). Pass `year` and `hasDependentUnder23` explicitly to exercise the
 * 令和8・9年分 expansion. Production always supplies both, so they are required there.
 */
const deduct = (input: LifeInsuranceInput, year = 2026, hasDependentUnder23 = false) =>
  calculateLifeInsuranceDeduction(input, year, hasDependentUnder23);

describe('calculateLifeInsuranceDeduction — new contract, single category', () => {
  it('applies the national bands at their boundaries', () => {
    expect(deduct(life({ generalNew: 20_000 })).national).toBe(20_000);
    expect(deduct(life({ generalNew: 40_000 })).national).toBe(30_000);
    expect(deduct(life({ generalNew: 80_000 })).national).toBe(40_000);
    expect(deduct(life({ generalNew: 200_000 })).national).toBe(40_000);
  });

  it('applies the residence bands at their boundaries', () => {
    expect(deduct(life({ generalNew: 12_000 })).residence).toBe(12_000);
    expect(deduct(life({ generalNew: 32_000 })).residence).toBe(22_000);
    expect(deduct(life({ generalNew: 56_000 })).residence).toBe(28_000);
    expect(deduct(life({ generalNew: 200_000 })).residence).toBe(28_000);
  });
});

describe('calculateLifeInsuranceDeduction — old contract, single category', () => {
  it('uses the old-contract bands and caps', () => {
    expect(deduct(life({ generalOld: 25_000 }))).toEqual({
      national: 25_000,
      residence: 20_000,
    });
    expect(deduct(life({ generalOld: 100_000 }))).toEqual({
      national: 50_000,
      residence: 35_000,
    });
  });
});

describe('calculateLifeInsuranceDeduction — combined old + new rule', () => {
  it('uses old-only when the old premium clears the national ¥60,000 break-even', () => {
    // old 70,000 > 60,000 → old-only (¥42,500) beats the ¥40,000 combined cap.
    const deduction = deduct(life({ generalNew: 40_000, generalOld: 70_000 }));
    expect(deduction.national).toBe(42_500);
    expect(deduction.residence).toBe(35_000);
  });

  it('meets the combined cap exactly at the national ¥60,000 break-even', () => {
    // old 60,000 → old-only deduction is exactly ¥40,000, the combined cap.
    const deduction = deduct(life({ generalNew: 80_000, generalOld: 60_000 }));
    expect(deduction.national).toBe(40_000);
  });

  it('honours the residence ¥42,000 break-even, not the national ¥60,000 one', () => {
    // old 50,000 ≤ 60,000, so a hardcoded national threshold would wrongly cap residence at
    // ¥28,000. The cap-agnostic max picks old-only (¥30,000), which is correct for residence.
    const deduction = deduct(life({ generalNew: 56_000, generalOld: 50_000 }));
    expect(deduction.residence).toBe(30_000);
    expect(deduction.national).toBe(40_000);
  });
});

describe('calculateLifeInsuranceDeduction — 介護医療 and caps', () => {
  it('treats 介護医療 as new-contract only', () => {
    expect(deduct(life({ medicalCareNew: 40_000 }))).toEqual({
      national: 30_000,
      residence: 24_000,
    });
  });

  it('caps the sum of all three categories at the overall maximum', () => {
    const deduction = deduct(
      life({
        generalNew: 80_000,
        generalOld: 100_000, // general category resolves to the ¥50,000 old-only amount
        medicalCareNew: 80_000,
        pensionNew: 80_000,
      }),
    );
    expect(deduction.national).toBe(120_000);
    expect(deduction.residence).toBe(70_000);
  });

  it('returns zero for empty input', () => {
    expect(deduct(life({}))).toEqual({ national: 0, residence: 0 });
  });
});

describe('calculateLifeInsuranceDeduction — child-rearing expansion (令和8・9年分)', () => {
  it('raises the 一般 new-contract income-tax cap to ¥60,000, leaving residence unchanged', () => {
    const raised = deduct(life({ generalNew: 120_000 }), 2026, true);
    expect(raised).toEqual({ national: 60_000, residence: 28_000 });
    // Without eligibility the same premium is capped at the standard ¥40,000.
    expect(deduct(life({ generalNew: 120_000 }), 2026, false).national).toBe(40_000);
  });

  it('applies the raised sliding scale at a mid boundary', () => {
    // 60,000 → ×½ + 15,000 = 45,000 (standard scale would give 35,000).
    expect(deduct(life({ generalNew: 60_000 }), 2026, true).national).toBe(45_000);
  });

  it('only raises 一般 — 介護医療 and 個人年金 stay at ¥40,000', () => {
    expect(deduct(life({ medicalCareNew: 120_000 }), 2026, true).national).toBe(40_000);
    expect(deduct(life({ pensionNew: 120_000 }), 2026, true).national).toBe(40_000);
  });

  it('does not raise outside the eligible years or without a qualifying dependent', () => {
    const big = life({ generalNew: 120_000 });
    expect(deduct(big, 2026, false).national).toBe(40_000);
    expect(deduct(big, 2025, true).national).toBe(40_000);
    expect(deduct(big, 2028, true).national).toBe(40_000);
  });

  it('keeps old-only 一般 at ¥50,000 but lets new+old combined reach ¥60,000', () => {
    // Old-only is unchanged by the measure.
    expect(deduct(life({ generalOld: 120_000 }), 2026, true).national).toBe(50_000);
    // New (¥60,000) + old (¥37,500), combined capped at the raised ¥60,000.
    expect(deduct(life({ generalNew: 120_000, generalOld: 50_000 }), 2026, true).national).toBe(
      60_000,
    );
  });

  it('still applies the ¥120,000 / ¥70,000 overall caps when eligible', () => {
    const deduction = deduct(
      life({ generalNew: 120_000, medicalCareNew: 80_000, pensionNew: 80_000 }),
      2026,
      true,
    );
    expect(deduction).toEqual({ national: 120_000, residence: 70_000 });
  });
});
