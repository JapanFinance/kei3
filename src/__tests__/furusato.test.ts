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

  describe('home loan tax credit (住宅ローン控除) interactions', () => {
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
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 100_000 },
      });
      expect(withCredit.homeLoanTaxCredit?.appliedToIncomeTax).toBe(100_000);
      expect(withCredit.homeLoanTaxCredit?.appliedToResidenceTax).toBe(0);
      // The credit reduces the base income tax, then the 2.1% surtax recomputes on the
      // smaller base — so the total income tax falls by exactly 100,000 × 1.021 = 102,100,
      // NOT a flat 100,000 (which the buggy ordering would give). It is exact, not a range:
      // total tax = floor(base × 1.021 / 100) × 100, and the with-credit base is reduced by
      // 100,000, so its total is floor((base × 1.021 - 102,100) / 100) × 100. Because both the
      // credit (100,000) and the surtax delta (100,000 × 0.021 = 2,100) are multiples of 100,
      // the 100-yen flooring shifts both totals identically, leaving a reduction of exactly
      // 102,100 for any income.
      const reduction = baseline.nationalIncomeTax - withCredit.nationalIncomeTax;
      expect(reduction).toBe(102_100);
    });

    it('20% furusato cap is calculated against pre-credit residence tax (limit unchanged when no spillover)', () => {
      const baseline = calculateTaxes(baseInputs);
      const withCredit = calculateTaxes({
        ...baseInputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 100_000 }, // small credit, all absorbed by income tax
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
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: baseline.nationalIncomeTax + 50_000 },
      });
      expect(withCredit.nationalIncomeTax).toBe(0);
      expect(withCredit.homeLoanTaxCredit?.appliedToResidenceTax).toBeGreaterThan(0);
      expect(withCredit.residenceTax.totalResidenceTax).toBeLessThan(baseline.residenceTax.totalResidenceTax);
      // Furusato limit is still based on pre-credit 所得割 → unchanged.
      expect(withCredit.furusatoNozei.limit).toBe(baseline.furusatoNozei.limit);
    });

    it('caps income-tax refund portion at remaining income tax after home loan credit', () => {
      const baseline = calculateTaxes(baseInputs);
      const withCredit = calculateTaxes({
        ...baseInputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: baseline.nationalIncomeTax + 100_000 }, // wipes out income tax
      });
      // With remaining income tax = 0, the income-tax refund portion of furusato must be 0.
      expect(withCredit.nationalIncomeTax).toBe(0);
      expect(withCredit.furusatoNozei.incomeTaxReduction).toBe(0);
    });

    it('returns warnings when net income exceeds the cohort limit', () => {
      const withCredit = calculateTaxes({
        ...baseInputs,
        incomeStreams: [{ id: 'test', type: 'salary' as const, amount: 30_000_000, frequency: 'annual' as const }],
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 200_000 },
      });
      expect(withCredit.homeLoanTaxCredit?.appliedToIncomeTax).toBe(0);
      expect(withCredit.homeLoanTaxCredit?.warnings.length ?? 0).toBeGreaterThan(0);
    });

    it('bases the residence-tax spillover cap on income-tax taxable income (所得税の課税総所得金額等), not residence taxable income', () => {
      // At ¥3.5M the residence-tax taxable income is well above the income-tax taxable
      // income (the income-tax basic deduction is larger), so the two cap bases diverge.
      const inputs = {
        incomeStreams: [{ id: 'test', type: 'salary' as const, amount: 3_500_000, frequency: 'annual' as const }],
        isSubjectToLongTermCarePremium: false,
        region: 'Tokyo',
        healthInsuranceProvider: DEFAULT_PROVIDER,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
        incomeYear: 2026,
      };
      // A credit large enough that the spillover saturates the cap.
      const r = calculateTaxes({ ...inputs, homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 300_000 } });
      const incomeTaxTaxable = r.taxableIncomeForNationalIncomeTax!;
      const residenceTaxable = r.taxableIncomeForResidenceTax!;
      expect(residenceTaxable).toBeGreaterThan(incomeTaxTaxable); // the two bases really differ here

      // Cap = 5% of the INCOME-TAX taxable income (under the ¥97,500 flat cap at this income).
      const expectedCap = Math.floor(incomeTaxTaxable * 0.05);
      expect(r.homeLoanTaxCredit?.appliedToResidenceTax).toBe(expectedCap);
      // Guard against the old bug, which used the (larger) residence taxable income.
      expect(r.homeLoanTaxCredit?.appliedToResidenceTax).toBeLessThan(Math.floor(residenceTaxable * 0.05));
    });

    // ----------------------------------------------------------------------
    // KNOWN LIMITATION (deferred to a follow-up) — furusato ⇄ home loan credit.
    //
    // kei3 computes the home loan credit as if NO furusato donation is made. A real
    // furusato 寄附金控除 lowers both the base income tax and the income-tax taxable
    // income (所得税の課税総所得金額等), which would change how much credit income tax
    // absorbs AND the residence-tax spillover cap. kei3 treats the two independently
    // because there's no UI yet to apply an actual donation or to choose 確定申告 vs
    // One-Stop. The furusato LIMIT and OUT-OF-POCKET shown are unaffected — this only
    // concerns how an *actual* donation would feed back into the home loan credit.
    // kei3 computes a detection flag (furusatoDonationReducesHomeLoanCredit) for this case but
    // does NOT surface it in the UI yet — the framing needs more work (it's the home loan credit
    // that's squeezed, not furusato, and the residence-cap recapture isn't modeled). This test
    // pins the independent calculation behavior.
    // ----------------------------------------------------------------------
    it('computes the home loan credit independently of any furusato donation (interaction deferred)', () => {
      const inputs = {
        incomeStreams: [{ id: 'test', type: 'salary' as const, amount: 3_500_000, frequency: 'annual' as const }],
        isSubjectToLongTermCarePremium: false,
        region: 'Tokyo',
        healthInsuranceProvider: DEFAULT_PROVIDER,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
        incomeYear: 2026,
      };
      const baseline = calculateTaxes(inputs);
      const baseTax = baseline.nationalIncomeTaxBase!; // 所得税額 before surtax (~40,100)
      // There is a furusato income-tax portion at this income — i.e. a real donation would
      // interact with the home loan credit (the deferred feedback described above).
      expect(baseline.furusatoNozei.incomeTaxReduction).toBeGreaterThan(0);

      // Credit that absorbs the whole base income tax, leaving spillover under the cap.
      const M = Math.floor(baseTax) + 40_000;
      const withCredit = calculateTaxes({ ...inputs, homeLoanTaxCredit: { moveInYear: 2024, creditAmount: M } });
      const mc = withCredit.homeLoanTaxCredit!;

      expect(withCredit.nationalIncomeTax).toBe(0);          // income tax fully wiped
      expect(mc.appliedToIncomeTax).toBe(baseTax);           // whole base absorbed
      expect(mc.unusedCredit).toBe(0);                       // spillover under the cap
      expect(mc.appliedToResidenceTax).toBe(mc.annualCredit - mc.appliedToIncomeTax);
      // Furusato limit unaffected; the income-tax refund portion is correctly lost
      // once income tax hits 0 for a 確定申告 filer.
      expect(withCredit.furusatoNozei.limit).toBe(baseline.furusatoNozei.limit);
      expect(withCredit.furusatoNozei.incomeTaxReduction).toBe(0);
    });

    it('flags the furusato interaction only when donating the limit would squeeze the credit', () => {
      // No squeeze: at ¥7M a small ¥100,000 credit leaves ample income tax even after a
      // donation up to the furusato limit, so the warning flag stays off.
      const ample = calculateTaxes({
        ...baseInputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 100_000 },
      });
      expect(ample.furusatoDonationReducesHomeLoanCredit).toBeFalsy();

      // Squeeze: at ¥3.5M a credit that wipes income tax leaves nothing for the furusato
      // income-tax refund once a donation is made (a tax-return-only effect), turning the flag on.
      const squeezeInputs = {
        incomeStreams: [{ id: 'test', type: 'salary' as const, amount: 3_500_000, frequency: 'annual' as const }],
        isSubjectToLongTermCarePremium: false,
        region: 'Tokyo',
        healthInsuranceProvider: DEFAULT_PROVIDER,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
        incomeYear: 2026,
      };
      const baseline = calculateTaxes(squeezeInputs);
      const squeeze = calculateTaxes({
        ...squeezeInputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: Math.floor(baseline.nationalIncomeTaxBase!) + 40_000 },
      });
      expect(squeeze.nationalIncomeTax).toBe(0); // credit wipes income tax
      expect(squeeze.furusatoDonationReducesHomeLoanCredit).toBe(true);
    });

    it('exposes the pre-home-loan income-based residence portion so the breakdown reconciles', () => {
      const inputs = {
        incomeStreams: [{ id: 'test', type: 'salary' as const, amount: 3_500_000, frequency: 'annual' as const }],
        isSubjectToLongTermCarePremium: false,
        region: 'Tokyo',
        healthInsuranceProvider: DEFAULT_PROVIDER,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
        incomeYear: 2026,
      };
      const r = calculateTaxes({ ...inputs, homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 120_000 } });
      const pre = r.residenceTaxIncomeBasedBeforeHomeLoanCredit!;
      const post = r.residenceTax.city.cityIncomeTax + r.residenceTax.prefecture.prefecturalIncomeTax;
      expect(pre).toBeGreaterThan(post); // the spillover reduced the income-based portion
      // Income-based (post) + per-capita reconciles to the total residence tax.
      expect(post + r.residenceTax.perCapitaTax).toBe(r.residenceTax.totalResidenceTax);
      // The displayed reduction (pre − post) matches the applied spillover within ¥100 rounding.
      expect(Math.abs((pre - post) - r.homeLoanTaxCredit!.appliedToResidenceTax)).toBeLessThanOrEqual(100);
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
