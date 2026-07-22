// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import type { FurusatoNozeiDetails } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { calculateTaxes } from '../utils/taxCalculations';

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
    expect(fn.outOfPocketCost).toBe(2_100);
    expect(fn.incomeTaxReduction).toBe(7_600);
    expect(fn.residenceTaxReduction).toBe(67_300);
  });

  it('calculates furusato nozei for the salary with slightly higher out-of-pocket cost', () => {
    const fn = calculateFNForIncome(8_800_000);
    expect(fn.limit).toBe(151_000);
    expect(fn.outOfPocketCost).toBe(1_800);
    expect(fn.incomeTaxReduction).toBe(30_500);
    expect(fn.residenceTaxReduction).toBe(118_700);
  });

  it('high-income salary, high out-of-pocket cost', () => {
    const fn = calculateFNForIncome(13_000_000);
    expect(fn.outOfPocketCost).toBe(35_100);
    expect(fn.limit).toBe(327_000);
    expect(fn.incomeTaxReduction).toBe(76_400);
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
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [{ id: 'test', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
      ageRange: 'age20to39' as const,
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
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [
        { id: 'test', type: 'salary' as const, amount: 7_000_000, frequency: 'annual' as const },
      ],
      ageRange: 'age20to39' as const,
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
      // NOT a flat 100,000 (which the buggy ordering would give).
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
      expect(withCredit.residenceTax.totalResidenceTax).toBe(
        baseline.residenceTax.totalResidenceTax,
      );
      // Furusato limit unchanged: 20% cap uses pre-credit residence tax (== current residence tax here)
      expect(withCredit.furusatoNozei.limit).toBe(baseline.furusatoNozei.limit);
      // Income tax refund portion unchanged: remaining income tax is still well above it
      expect(withCredit.furusatoNozei.incomeTaxReduction).toBe(
        baseline.furusatoNozei.incomeTaxReduction,
      );
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
      expect(withCredit.residenceTax.totalResidenceTax).toBeLessThan(
        baseline.residenceTax.totalResidenceTax,
      );
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
        incomeStreams: [
          { id: 'test', type: 'salary' as const, amount: 30_000_000, frequency: 'annual' as const },
        ],
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 200_000 },
      });
      const credit = withCredit.homeLoanTaxCredit!;
      expect(credit.appliedToIncomeTax).toBe(0);
      expect(credit.availableCredit).toBe(0);
      // Specifically the income-eligibility warning (it names the exceeded net income and the
      // ¥20,000,000 limit), not just any warning that happens to contain "eligibility limit".
      expect(
        credit.warnings.some(w => w.includes('net income exceeds') && w.includes('20,000,000')),
      ).toBe(true);
    });

    it('bases the residence-tax spillover cap on income-tax taxable income (所得税の課税総所得金額等), not residence taxable income', () => {
      // At ¥3.5M the residence-tax taxable income is well above the income-tax taxable
      // income (the income-tax basic deduction is larger), so the two cap bases diverge.
      const inputs = {
        ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
        incomeStreams: [
          { id: 'test', type: 'salary' as const, amount: 3_500_000, frequency: 'annual' as const },
        ],
        ageRange: 'age20to39' as const,
        region: 'Tokyo',
        healthInsuranceProvider: DEFAULT_PROVIDER,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
        incomeYear: 2026,
      };
      // A credit large enough that the spillover saturates the cap.
      const withCredit = calculateTaxes({
        ...inputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 300_000 },
      });
      const incomeTaxTaxable = withCredit.taxableIncomeForNationalIncomeTax!;
      const residenceTaxable = withCredit.taxableIncomeForResidenceTax!;
      expect(residenceTaxable).toBeGreaterThan(incomeTaxTaxable); // the two bases really differ here

      // Cap = 5% of the INCOME-TAX taxable income (under the ¥97,500 flat cap at this income).
      const expectedCap = Math.floor(incomeTaxTaxable * 0.05);
      expect(withCredit.homeLoanTaxCredit?.appliedToResidenceTax).toBe(expectedCap);
      // Guard against the old bug, which used the (larger) residence taxable income.
      expect(withCredit.homeLoanTaxCredit?.appliedToResidenceTax).toBeLessThan(
        Math.floor(residenceTaxable * 0.05),
      );
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
    // kei3 does NOT model this feedback (there's no UI to apply an actual donation or to choose
    // 確定申告 vs One-Stop), and the correct framing — it's the home loan credit that gets
    // squeezed, not furusato, plus the residence-cap recapture — would need more work. This test
    // pins the current independent calculation behavior.
    // ----------------------------------------------------------------------
    it('computes the home loan credit independently of any furusato donation (interaction deferred)', () => {
      const inputs = {
        ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
        incomeStreams: [
          { id: 'test', type: 'salary' as const, amount: 3_500_000, frequency: 'annual' as const },
        ],
        ageRange: 'age20to39' as const,
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
      const creditAmount = Math.floor(baseTax) + 40_000;
      const withCredit = calculateTaxes({
        ...inputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount },
      });
      const credit = withCredit.homeLoanTaxCredit!;

      expect(withCredit.nationalIncomeTax).toBe(0); // income tax fully wiped
      expect(credit.appliedToIncomeTax).toBe(baseTax); // whole base absorbed
      expect(credit.unusedCredit).toBe(0); // spillover under the cap
      expect(credit.appliedToResidenceTax).toBe(credit.availableCredit - credit.appliedToIncomeTax);
      // Furusato limit is unaffected (it is based on the pre-credit 所得割)...
      expect(withCredit.furusatoNozei.limit).toBe(baseline.furusatoNozei.limit);
      // ...but the income-tax refund portion is lost once the credit wipes income tax to 0
      // (a 確定申告 filer can't refund tax that is no longer owed), so the out-of-pocket cost
      // rises above the baseline by that lost refund.
      expect(credit.appliedToIncomeTax).toBeGreaterThan(0); // there WAS income tax to lose
      expect(baseline.furusatoNozei.incomeTaxReduction).toBeGreaterThan(0);
      expect(withCredit.furusatoNozei.incomeTaxReduction).toBe(0);
      expect(withCredit.furusatoNozei.outOfPocketCost).toBeGreaterThan(
        baseline.furusatoNozei.outOfPocketCost,
      );
    });

    it('exposes the pre-home-loan income-based residence portion so the breakdown reconciles', () => {
      const inputs = {
        ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
        incomeStreams: [
          { id: 'test', type: 'salary' as const, amount: 3_500_000, frequency: 'annual' as const },
        ],
        ageRange: 'age20to39' as const,
        region: 'Tokyo',
        healthInsuranceProvider: DEFAULT_PROVIDER,
        dependents: [],
        dcPlanContributions: 0,
        manualSocialInsuranceEntry: false,
        manualSocialInsuranceAmount: 0,
        incomeYear: 2026,
      };
      const withCredit = calculateTaxes({
        ...inputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 120_000 },
      });
      const pre = withCredit.residenceTaxIncomeBasedBeforeHomeLoanCredit!;
      const post =
        withCredit.residenceTax.city.cityIncomeTax +
        withCredit.residenceTax.prefecture.prefecturalIncomeTax;
      expect(pre).toBeGreaterThan(post); // the spillover reduced the income-based portion
      // Income-based (post) + per-capita reconciles to the total residence tax.
      expect(post + withCredit.residenceTax.perCapitaTax).toBe(
        withCredit.residenceTax.totalResidenceTax,
      );
      // `pre` must be exactly the income-based portion computed with NO home loan credit.
      // (We assert against an independent no-credit run rather than the applied spillover:
      // the spillover is split 60/40 across city/prefecture and each side is floored to
      // ¥100, so it only matches the displayed reduction up to rounding — but `pre` itself
      // is an exact figure.)
      const noCredit = calculateTaxes(inputs);
      expect(pre).toBe(
        noCredit.residenceTax.city.cityIncomeTax +
          noCredit.residenceTax.prefecture.prefecturalIncomeTax,
      );
    });

    it('caps the residence-tax spillover at the ¥97,500 flat cap end-to-end (2022+, mid income)', () => {
      const inputs = {
        ...baseInputs,
        incomeStreams: [
          { id: 'test', type: 'salary' as const, amount: 5_500_000, frequency: 'annual' as const },
        ],
      };
      const baseline = calculateTaxes(inputs);
      // A credit larger than the income tax plus the cap. At ~¥2.7M income-tax taxable income,
      // 5% (~¥135k) exceeds ¥97,500, so the FLAT cap binds (not the rate cap).
      const withCredit = calculateTaxes({
        ...inputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 350_000 },
      });
      const credit = withCredit.homeLoanTaxCredit!;
      expect(credit.appliedToIncomeTax).toBe(baseline.nationalIncomeTaxBase); // whole base income tax absorbed
      expect(credit.residenceTaxSpilloverCap?.flatCap).toBe(97_500);
      expect(credit.appliedToResidenceTax).toBe(97_500); // flat cap binds
      expect(credit.unusedCredit).toBeGreaterThan(0); // credit exceeds income tax + cap
      expect(withCredit.residenceTax.totalResidenceTax).toBeLessThan(
        baseline.residenceTax.totalResidenceTax,
      );
    });

    it('uses the 7% / ¥136,500 residence cap end-to-end for a 2014-2021 move-in', () => {
      const inputs = {
        ...baseInputs,
        incomeStreams: [
          { id: 'test', type: 'salary' as const, amount: 5_500_000, frequency: 'annual' as const },
        ],
      };
      const withCredit = calculateTaxes({
        ...inputs,
        homeLoanTaxCredit: { moveInYear: 2020, creditAmount: 350_000 },
      });
      const credit = withCredit.homeLoanTaxCredit!;
      expect(credit.residenceTaxSpilloverCap?.flatCap).toBe(136_500); // 2014-2021 cohort uses the higher cap
      expect(credit.appliedToResidenceTax).toBe(136_500); // flat cap binds
      expect(credit.unusedCredit).toBeGreaterThan(0);
    });

    it('applies the lower 5% / ¥97,500 residence cap for a non-特定取得 2014-2021 move-in', () => {
      // Same scenario as the 特定取得 test above, but the 2020 purchase was non-特定取得 (no
      // consumption tax — e.g. bought from a private individual): the residence cap drops to
      // ¥97,500, so the credit reduces residence tax by ¥39,000 less and leaves more unused.
      const inputs = {
        ...baseInputs,
        incomeStreams: [
          { id: 'test', type: 'salary' as const, amount: 5_500_000, frequency: 'annual' as const },
        ],
      };
      const tokutei = calculateTaxes({
        ...inputs,
        homeLoanTaxCredit: { moveInYear: 2020, creditAmount: 350_000, isTokuteiShutoku: true },
      });
      const nonTokutei = calculateTaxes({
        ...inputs,
        homeLoanTaxCredit: { moveInYear: 2020, creditAmount: 350_000, isTokuteiShutoku: false },
      });

      const nonTokuteiCredit = nonTokutei.homeLoanTaxCredit!;
      expect(nonTokuteiCredit.residenceTaxSpilloverCap?.flatCap).toBe(97_500); // non-特定取得 cap
      expect(nonTokuteiCredit.appliedToResidenceTax).toBe(97_500); // flat cap binds

      // non-特定取得 spills ¥39,000 less to residence tax than 特定取得 (¥136,500 − ¥97,500),
      // so residence tax ends up higher and the income tax is unchanged.
      expect(
        tokutei.homeLoanTaxCredit!.appliedToResidenceTax - nonTokuteiCredit.appliedToResidenceTax,
      ).toBe(39_000);
      expect(nonTokutei.residenceTax.totalResidenceTax).toBeGreaterThan(
        tokutei.residenceTax.totalResidenceTax,
      );
      expect(nonTokutei.nationalIncomeTax).toBe(tokutei.nationalIncomeTax);
    });

    it('flows dependent deductions through to the credit (lowers the income tax it offsets)', () => {
      const incomeStreams = [
        { id: 'test', type: 'salary' as const, amount: 6_000_000, frequency: 'annual' as const },
      ];
      const homeLoanTaxCredit = { moveInYear: 2024, creditAmount: 280_000 };
      const single = calculateTaxes({ ...baseInputs, incomeStreams, homeLoanTaxCredit });
      const withDeps = calculateTaxes({
        ...baseInputs,
        incomeStreams,
        dependents: [
          {
            id: 'spouse',
            relationship: 'spouse',
            ageCategory: 'under70',
            income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
            disability: 'none',
            isCohabiting: true,
          },
          {
            id: 'child',
            relationship: 'child',
            ageCategory: '16to18',
            income: { grossEmploymentIncome: 0, otherNetIncome: 0 },
            disability: 'none',
            isCohabiting: true,
          },
        ],
        homeLoanTaxCredit,
      });
      // The dependent deductions lower the income-tax base, so the same credit offsets less
      // income tax with dependents (the remainder spills to residence tax, or — once income is
      // low enough that the spillover cap binds — goes unused).
      expect(withDeps.nationalIncomeTaxBase!).toBeLessThan(single.nationalIncomeTaxBase!);
      expect(withDeps.homeLoanTaxCredit!.appliedToIncomeTax).toBeLessThan(
        single.homeLoanTaxCredit!.appliedToIncomeTax,
      );
    });
  });

  it('furusato nozei limit is affected by manual social insurance override', () => {
    // Standard calculation for 5M income has limit of 60,000
    // If we increase social insurance deduction manually, taxable income decreases, so limit should decrease
    const fnWithHighSocialInsurance = calculateTaxes({
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [{ id: 'test', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
      ageRange: 'age20to39' as const,
      region: 'Tokyo',
      healthInsuranceProvider: DEFAULT_PROVIDER,
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 1_000_000, // Higher than standard ~726k
      incomeYear: 2026,
    }).furusatoNozei;

    expect(fnWithHighSocialInsurance.limit).toBeLessThan(62_000);

    // If we decrease social insurance deduction manually, taxable income increases, so limit should increase
    const fnWithLowSocialInsurance = calculateTaxes({
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      incomeStreams: [{ id: 'test', type: 'salary', amount: 5_000_000, frequency: 'annual' }],
      ageRange: 'age20to39' as const,
      region: 'Tokyo',
      healthInsuranceProvider: DEFAULT_PROVIDER,
      dependents: [],
      dcPlanContributions: 0,
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 500_000, // Lower than standard ~726k
      incomeYear: 2026,
    }).furusatoNozei;

    expect(fnWithLowSocialInsurance.limit).toBeGreaterThan(62_000);
  });
});

function calculateFNForIncome(income: number): FurusatoNozeiDetails {
  return calculateTaxes({
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [{ id: 'test', type: 'salary', amount: income, frequency: 'annual' }],
    ageRange: 'age20to39' as const,
    region: 'Tokyo',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  }).furusatoNozei;
}
