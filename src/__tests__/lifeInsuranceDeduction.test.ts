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

describe('calculateLifeInsuranceDeduction — new contract, single category', () => {
  it('applies the national bands at their boundaries', () => {
    expect(calculateLifeInsuranceDeduction(life({ generalNew: 20_000 })).national).toBe(20_000);
    expect(calculateLifeInsuranceDeduction(life({ generalNew: 40_000 })).national).toBe(30_000);
    expect(calculateLifeInsuranceDeduction(life({ generalNew: 80_000 })).national).toBe(40_000);
    expect(calculateLifeInsuranceDeduction(life({ generalNew: 200_000 })).national).toBe(40_000);
  });

  it('applies the residence bands at their boundaries', () => {
    expect(calculateLifeInsuranceDeduction(life({ generalNew: 12_000 })).residence).toBe(12_000);
    expect(calculateLifeInsuranceDeduction(life({ generalNew: 32_000 })).residence).toBe(22_000);
    expect(calculateLifeInsuranceDeduction(life({ generalNew: 56_000 })).residence).toBe(28_000);
    expect(calculateLifeInsuranceDeduction(life({ generalNew: 200_000 })).residence).toBe(28_000);
  });
});

describe('calculateLifeInsuranceDeduction — old contract, single category', () => {
  it('uses the old-contract bands and caps', () => {
    expect(calculateLifeInsuranceDeduction(life({ generalOld: 25_000 }))).toEqual({
      national: 25_000,
      residence: 20_000,
    });
    expect(calculateLifeInsuranceDeduction(life({ generalOld: 100_000 }))).toEqual({
      national: 50_000,
      residence: 35_000,
    });
  });
});

describe('calculateLifeInsuranceDeduction — combined old + new rule', () => {
  it('uses old-only when the old premium clears the national ¥60,000 break-even', () => {
    // old 70,000 > 60,000 → old-only (¥42,500) beats the ¥40,000 combined cap.
    const d = calculateLifeInsuranceDeduction(life({ generalNew: 40_000, generalOld: 70_000 }));
    expect(d.national).toBe(42_500);
    expect(d.residence).toBe(35_000);
  });

  it('meets the combined cap exactly at the national ¥60,000 break-even', () => {
    // old 60,000 → old-only deduction is exactly ¥40,000, the combined cap.
    const d = calculateLifeInsuranceDeduction(life({ generalNew: 80_000, generalOld: 60_000 }));
    expect(d.national).toBe(40_000);
  });

  it('honours the residence ¥42,000 break-even, not the national ¥60,000 one', () => {
    // old 50,000 ≤ 60,000, so a hardcoded national threshold would wrongly cap residence at
    // ¥28,000. The cap-agnostic max picks old-only (¥30,000), which is correct for residence.
    const d = calculateLifeInsuranceDeduction(life({ generalNew: 56_000, generalOld: 50_000 }));
    expect(d.residence).toBe(30_000);
    expect(d.national).toBe(40_000);
  });
});

describe('calculateLifeInsuranceDeduction — 介護医療 and caps', () => {
  it('treats 介護医療 as new-contract only', () => {
    expect(calculateLifeInsuranceDeduction(life({ medicalCareNew: 40_000 }))).toEqual({
      national: 30_000,
      residence: 24_000,
    });
  });

  it('caps the sum of all three categories at the overall maximum', () => {
    const d = calculateLifeInsuranceDeduction(
      life({
        generalNew: 80_000,
        generalOld: 100_000, // general category resolves to the ¥50,000 old-only amount
        medicalCareNew: 80_000,
        pensionNew: 80_000,
      }),
    );
    expect(d.national).toBe(120_000);
    expect(d.residence).toBe(70_000);
  });

  it('returns zero for empty input', () => {
    expect(calculateLifeInsuranceDeduction(life({}))).toEqual({ national: 0, residence: 0 });
  });
});
