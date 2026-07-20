// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import {
  calculateAdditionalDeductions,
  calculateMedicalExpenseDeduction,
} from '../utils/additionalDeductions';

describe('calculateMedicalExpenseDeduction', () => {
  it('subtracts the ¥100,000 floor when income is high', () => {
    expect(calculateMedicalExpenseDeduction(350_000, 100_000, 10_000_000)).toBe(150_000);
  });

  it('uses 5% of income as the floor when that is lower than ¥100,000', () => {
    expect(calculateMedicalExpenseDeduction(300_000, 0, 1_000_000)).toBe(250_000);
  });

  it('uses 5% of income as the floor when that is lower than ¥100,000 even when expenses are under ¥100,000', () => {
    expect(calculateMedicalExpenseDeduction(70_000, 0, 1_000_000)).toBe(20_000);
  });

  it('returns zero when net expenses are below the floor', () => {
    expect(calculateMedicalExpenseDeduction(80_000, 0, 10_000_000)).toBe(0);
  });

  it('clamps reimbursements that exceed what was paid', () => {
    expect(calculateMedicalExpenseDeduction(50_000, 80_000, 10_000_000)).toBe(0);
  });

  it('caps the deduction at ¥2,000,000', () => {
    expect(calculateMedicalExpenseDeduction(2_500_000, 0, 10_000_000)).toBe(2_000_000);
  });
});

describe('calculateAdditionalDeductions', () => {
  it('aggregates per-tax totals and itemizes the breakdown', () => {
    const result = calculateAdditionalDeductions(
      {
        incomeYear: 2026,
        dependents: [],
        lifeInsurance: { generalNew: 100_000, medicalCareNew: 0, pensionNew: 100_000 },
        earthquakeInsurance: { earthquake: 50_000, longTermOld: 0 },
        medicalExpenses: { paid: 350_000, reimbursed: 100_000 },
      },
      10_000_000,
    );
    expect(result.items).toHaveLength(3);
    // life 80k/56k + earthquake 50k/25k + medical 150k
    expect(result.national).toBe(280_000);
    expect(result.residence).toBe(231_000);
  });

  it('keeps medical equal across both taxes', () => {
    const result = calculateAdditionalDeductions(
      {
        ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
        incomeYear: 2026,
        dependents: [],
        medicalExpenses: { paid: 200_000, reimbursed: 0 },
      },
      10_000_000,
    );
    expect(result.items).toHaveLength(1);
    expect(result.national).toBe(result.residence);
  });

  it('omits items that compute to zero', () => {
    const result = calculateAdditionalDeductions(
      {
        ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
        incomeYear: 2026,
        dependents: [],
        medicalExpenses: { paid: 80_000, reimbursed: 0 },
      },
      5_000_000,
    );
    expect(result).toEqual({ national: 0, residence: 0, items: [] });
  });

  it('returns an empty result when no additional deductions are entered', () => {
    expect(
      calculateAdditionalDeductions(
        { ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS, incomeYear: 2026, dependents: [] },
        5_000_000,
      ),
    ).toEqual({
      national: 0,
      residence: 0,
      items: [],
    });
  });
});
