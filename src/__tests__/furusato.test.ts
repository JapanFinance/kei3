// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { calculateTaxes } from '../utils/taxCalculations';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import type { FurusatoNozeiDetails } from '../types/tax';

// Pin the year so employment insurance rate lookups are deterministic.
beforeAll(() => { vi.useFakeTimers({ now: new Date(2025, 5, 1) }) })
afterAll(() => { vi.useRealTimers() })

describe('calculateFurusatoNozeiLimit', () => {

  it('calculates furusato nozei for the default salary', () => {
    const fn = calculateFNForIncome(5_000_000);
    expect(fn.limit).toBe(61_000);
    expect(fn.outOfPocketCost).toBe(5_000);
    expect(fn.incomeTaxReduction).toBe(3_000);
    expect(fn.residenceTaxReduction).toBe(53_000);
  });

  it('calculates furusato nozei for the salary with lower out-of-pocket cost', () => {
    const fn = calculateFNForIncome(6_000_000);
    expect(fn.limit).toBe(77_000);
    expect(fn.outOfPocketCost).toBe(1_900);
    expect(fn.incomeTaxReduction).toBe(7_600);
    expect(fn.residenceTaxReduction).toBe(67_500);
  });

  it('calculates furusato nozei for the salary with slightly higher out-of-pocket cost', () => {
    const fn = calculateFNForIncome(8_800_000);
    expect(fn.limit).toBe(151_000);
    expect(fn.outOfPocketCost).toBe(2_000);
    expect(fn.incomeTaxReduction).toBe(30_500);
    expect(fn.residenceTaxReduction).toBe(118_500);
  });

  it('high-income salary, high out-of-pocket cost', () => {
    const fn = calculateFNForIncome(13_000_000);
    expect(fn.outOfPocketCost).toBe(35_200);
    expect(fn.limit).toBe(327_000);
    expect(fn.incomeTaxReduction).toBe(76_300);
    expect(fn.residenceTaxReduction).toBe(215_500);
  });

  it('mid range salary, high out-of-pocket cost', () => {
    const fn = calculateFNForIncome(6_500_000);
    expect(fn.limit).toBe(98_000);
    expect(fn.outOfPocketCost).toBe(11_800);
    expect(fn.incomeTaxReduction).toBe(9_800);
    expect(fn.residenceTaxReduction).toBe(76_400);
  });

  it('returns 0 for zero or negative taxable income', () => {
    expect(calculateFNForIncome(0).limit).toBe(0);
    expect(calculateFNForIncome(-1000).limit).toBe(0);
  });

  it('furusato nozei limit is reduced by DC plan contributions', () => {
    const fn = calculateTaxes({
      incomeStreams: [{ id: 'test', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
      isSubjectToLongTermCarePremium: false,
      region: 'Tokyo',
      healthInsuranceProvider: DEFAULT_PROVIDER,
      dependents: [],
      dcPlanContributions: 240_000, // 20,000 yen per month
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    }).furusatoNozei;

    const fnWithoutDC = calculateFNForIncome(5_000_000);

    expect(fn.limit).toBeLessThan(fnWithoutDC.limit);
    expect(fn.limit).toBe(55_000);
    expect(fn.outOfPocketCost).toBe(4_700);
  });

  describe('mortgage tax credit (住宅ローン控除) interactions', () => {
    const baseInputs = {
      incomeStreams: [{ id: 'test', type: 'salary' as const, amount: 7_000_000, frequency: 'annual' as const }],
      isSubjectToLongTermCarePremium: false,
      region: 'Tokyo',
      healthInsuranceProvider: DEFAULT_PROVIDER,
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
      incomeYear: 2026,
    };

    it('reduces income tax by the credit plus the recomputed surtax (correct surtax ordering)', () => {
      const baseline = calculateTaxes(baseInputs);
      const withCredit = calculateTaxes({
        ...baseInputs,
        mortgageTaxCredit: { moveInYear: 2024, creditAmount: 100_000 },
      });
      expect(withCredit.mortgageTaxCredit?.appliedToIncomeTax).toBe(100_000);
      expect(withCredit.mortgageTaxCredit?.appliedToResidenceTax).toBe(0);
      // The credit reduces the base income tax, then the 2.1% surtax recomputes on the
      // smaller base — so the total income tax falls by ~100,000 × 1.021 = 102,100, NOT
      // a flat 100,000. (The buggy ordering would give exactly 100,000.)
      const reduction = baseline.nationalIncomeTax - withCredit.nationalIncomeTax;
      expect(reduction).toBeGreaterThanOrEqual(102_000);
      expect(reduction).toBeLessThanOrEqual(102_200);
    });

    it('20% furusato cap is calculated against pre-credit residence tax (limit unchanged when no spillover)', () => {
      const baseline = calculateTaxes(baseInputs);
      const withCredit = calculateTaxes({
        ...baseInputs,
        mortgageTaxCredit: { moveInYear: 2024, creditAmount: 100_000 }, // small credit, all absorbed by income tax
      });
      // Residence tax unchanged because no spillover happens
      expect(withCredit.residenceTax.totalResidenceTax).toBe(baseline.residenceTax.totalResidenceTax);
      // Furusato limit unchanged: 20% cap uses pre-credit residence tax (== current residence tax here)
      expect(withCredit.furusatoNozei.limit).toBe(baseline.furusatoNozei.limit);
      // Income tax refund portion unchanged: remaining income tax is still well above it
      expect(withCredit.furusatoNozei.incomeTaxReduction).toBe(baseline.furusatoNozei.incomeTaxReduction);
    });

    it('spillover into residence tax reduces actual residence tax without shrinking furusato limit', () => {
      // Large credit relative to income tax → spillover triggers
      const baseline = calculateTaxes(baseInputs);
      const withCredit = calculateTaxes({
        ...baseInputs,
        mortgageTaxCredit: { moveInYear: 2024, creditAmount: baseline.nationalIncomeTax + 50_000 },
      });
      expect(withCredit.nationalIncomeTax).toBe(0);
      expect(withCredit.mortgageTaxCredit?.appliedToResidenceTax).toBeGreaterThan(0);
      expect(withCredit.residenceTax.totalResidenceTax).toBeLessThan(baseline.residenceTax.totalResidenceTax);
      // Furusato limit is still based on pre-credit 所得割 → unchanged.
      expect(withCredit.furusatoNozei.limit).toBe(baseline.furusatoNozei.limit);
    });

    it('caps income-tax refund portion at remaining income tax after mortgage credit', () => {
      const baseline = calculateTaxes(baseInputs);
      const withCredit = calculateTaxes({
        ...baseInputs,
        mortgageTaxCredit: { moveInYear: 2024, creditAmount: baseline.nationalIncomeTax + 100_000 }, // wipes out income tax
      });
      // With remaining income tax = 0, the income-tax refund portion of furusato must be 0.
      expect(withCredit.nationalIncomeTax).toBe(0);
      expect(withCredit.furusatoNozei.incomeTaxReduction).toBe(0);
    });

    it('returns warnings when net income exceeds the cohort limit', () => {
      const withCredit = calculateTaxes({
        ...baseInputs,
        incomeStreams: [{ id: 'test', type: 'salary' as const, amount: 30_000_000, frequency: 'annual' as const }],
        mortgageTaxCredit: { moveInYear: 2024, creditAmount: 200_000 },
      });
      expect(withCredit.mortgageTaxCredit?.appliedToIncomeTax).toBe(0);
      expect(withCredit.mortgageTaxCredit?.warnings.length ?? 0).toBeGreaterThan(0);
    });
  });

  it('furusato nozei limit is affected by manual social insurance override', () => {
    // Standard calculation for 5M income has limit of 60,000
    // If we increase social insurance deduction manually, taxable income decreases, so limit should decrease
    const fnWithHighSocialInsurance = calculateTaxes({
      incomeStreams: [{ id: 'test', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
      isSubjectToLongTermCarePremium: false,
      region: 'Tokyo',
      healthInsuranceProvider: DEFAULT_PROVIDER,
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 1_000_000, // Higher than standard ~726k
    }).furusatoNozei;

    expect(fnWithHighSocialInsurance.limit).toBeLessThan(62_000);

    // If we decrease social insurance deduction manually, taxable income increases, so limit should increase
    const fnWithLowSocialInsurance = calculateTaxes({
      incomeStreams: [{ id: 'test', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
      isSubjectToLongTermCarePremium: false,
      region: 'Tokyo',
      healthInsuranceProvider: DEFAULT_PROVIDER,
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 500_000, // Lower than standard ~726k
    }).furusatoNozei;

    expect(fnWithLowSocialInsurance.limit).toBeGreaterThan(62_000);
  });
});

function calculateFNForIncome(income: number): FurusatoNozeiDetails {
  return calculateTaxes({
    incomeStreams: [{ id: 'test', type: 'salary', amount: income, frequency: 'annual' }],
    isSubjectToLongTermCarePremium: false,
    region: 'Tokyo',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  }).furusatoNozei;
}
