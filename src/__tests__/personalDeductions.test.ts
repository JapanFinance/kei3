// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import type { PersonalCircumstancesInput, TakeHomeInputs } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import {
  calculatePersonalDeductions,
  WIDOW_SINGLE_PARENT_INCOME_LIMIT,
} from '../utils/personalDeductions';
import { calculateTaxes } from '../utils/taxCalculations';

const circumstances = (patch: Partial<PersonalCircumstancesInput>): PersonalCircumstancesInput => ({
  disability: 'none',
  widowOrSingleParent: 'none',
  ...patch,
});

/** Income comfortably under the ¥5,000,000 寡婦/ひとり親 ceiling. */
const UNDER_LIMIT = 3_000_000;

describe('calculatePersonalDeductions', () => {
  it('returns an empty result when nothing is selected', () => {
    expect(calculatePersonalDeductions(circumstances({}), UNDER_LIMIT)).toEqual({
      national: 0,
      residence: 0,
      statutoryDifference: 0,
      items: [],
    });
  });

  it('applies 障害者控除 for a 一般の障害者', () => {
    const result = calculatePersonalDeductions(circumstances({ disability: 'regular' }), 0);
    expect(result.items).toEqual([
      { key: 'disability', national: 270_000, residence: 260_000, statutoryDifference: 10_000 },
    ]);
    expect(result.national).toBe(270_000);
    expect(result.residence).toBe(260_000);
    expect(result.statutoryDifference).toBe(10_000);
  });

  it('applies 障害者控除 for a 特別障害者', () => {
    const result = calculatePersonalDeductions(circumstances({ disability: 'special' }), 0);
    expect(result.national).toBe(400_000);
    expect(result.residence).toBe(300_000);
    expect(result.statutoryDifference).toBe(100_000);
  });

  it('never applies the 同居特別障害者 amount, which is only for a spouse or dependent', () => {
    // ¥750,000 / ¥530,000 must be unreachable from the taxpayer's own status.
    const result = calculatePersonalDeductions(circumstances({ disability: 'special' }), 0);
    expect(result.national).not.toBe(750_000);
    expect(result.residence).not.toBe(530_000);
  });

  it('applies 障害者控除 regardless of income, which has no ceiling', () => {
    const result = calculatePersonalDeductions(
      circumstances({ disability: 'regular' }),
      50_000_000,
    );
    expect(result.national).toBe(270_000);
  });

  it('applies 寡婦控除', () => {
    const result = calculatePersonalDeductions(
      circumstances({ widowOrSingleParent: 'widow' }),
      UNDER_LIMIT,
    );
    expect(result.items).toEqual([
      { key: 'widow', national: 270_000, residence: 260_000, statutoryDifference: 10_000 },
    ]);
  });

  it('applies ひとり親控除 with the mother 人的控除額の差 of ¥50,000', () => {
    const result = calculatePersonalDeductions(
      circumstances({ widowOrSingleParent: 'singleParentMother' }),
      UNDER_LIMIT,
    );
    expect(result.items).toEqual([
      { key: 'singleParent', national: 350_000, residence: 300_000, statutoryDifference: 50_000 },
    ]);
  });

  it('applies ひとり親控除 with the father 人的控除額の差 of ¥10,000', () => {
    // 地方税法第314条の6第1号イ(3) puts an ひとり親のうち父 at ¥10,000, though the deduction
    // amounts differ by ¥50,000 — the statutory figure is not the arithmetic difference.
    const result = calculatePersonalDeductions(
      circumstances({ widowOrSingleParent: 'singleParentFather' }),
      UNDER_LIMIT,
    );
    expect(result.items).toEqual([
      { key: 'singleParent', national: 350_000, residence: 300_000, statutoryDifference: 10_000 },
    ]);
  });

  it('allows 寡婦/ひとり親控除 exactly at the income ceiling', () => {
    const result = calculatePersonalDeductions(
      circumstances({ widowOrSingleParent: 'widow' }),
      WIDOW_SINGLE_PARENT_INCOME_LIMIT,
    );
    expect(result.national).toBe(270_000);
  });

  it('drops 寡婦/ひとり親控除 above the income ceiling, keeping 障害者控除', () => {
    const result = calculatePersonalDeductions(
      circumstances({ disability: 'regular', widowOrSingleParent: 'singleParentMother' }),
      WIDOW_SINGLE_PARENT_INCOME_LIMIT + 1,
    );
    expect(result.items.map(item => item.key)).toEqual(['disability']);
    expect(result.national).toBe(270_000);
  });

  it('combines 障害者控除 with ひとり親控除', () => {
    const result = calculatePersonalDeductions(
      circumstances({ disability: 'special', widowOrSingleParent: 'singleParentMother' }),
      UNDER_LIMIT,
    );
    expect(result.national).toBe(750_000);
    expect(result.residence).toBe(600_000);
    expect(result.statutoryDifference).toBe(150_000);
  });
});

describe('personal deductions in the full calculation', () => {
  const baseInputs: TakeHomeInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [{ type: 'salary', amount: 5_000_000, frequency: 'annual', id: 's1' }],
    ageRange: 'age20to39',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    region: 'Tokyo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  };

  it('omits the result entirely when no status is selected', () => {
    expect(calculateTaxes(baseInputs).personalDeductions).toBeUndefined();
  });

  it('subtracts the deduction from both taxable incomes and raises the 調整控除 difference', () => {
    const base = calculateTaxes(baseInputs);
    const withDisability = calculateTaxes({
      ...baseInputs,
      personalCircumstances: circumstances({ disability: 'special' }),
    });

    expect(withDisability.personalDeductions!.national).toBe(400_000);
    expect(
      base.taxableIncomeForNationalIncomeTax! - withDisability.taxableIncomeForNationalIncomeTax!,
    ).toBe(400_000);
    expect(base.taxableIncomeForResidenceTax! - withDisability.taxableIncomeForResidenceTax!).toBe(
      300_000,
    );

    // Unlike the 物的控除 in additionalDeductions, a 人的控除 also raises the 人的控除額の差.
    expect(withDisability.residenceTax.personalDeductionDifference).toBe(
      base.residenceTax.personalDeductionDifference + 100_000,
    );
    expect(withDisability.nationalIncomeTax).toBeLessThan(base.nationalIncomeTax);
    expect(withDisability.residenceTax.totalResidenceTax).toBeLessThan(
      base.residenceTax.totalResidenceTax,
    );
    // The lower 所得割 carries into the furusato nozei limit.
    expect(withDisability.furusatoNozei.limit).toBeLessThan(base.furusatoNozei.limit);
  });

  it('gives a single mother and a single father the same deduction but different 調整控除', () => {
    // A ¥3,000,000 salary keeps the residence taxable income under ¥2,000,000, where the credit is
    // 5% of the 人的控除額の差 itself. Above that the difference is reduced by the excess and
    // floored at ¥50,000, which hides the mother/father split for most incomes.
    const streams = [
      { type: 'salary' as const, amount: 3_000_000, frequency: 'annual' as const, id: 's1' },
    ];
    const mother = calculateTaxes({
      ...baseInputs,
      incomeStreams: streams,
      personalCircumstances: circumstances({ widowOrSingleParent: 'singleParentMother' }),
    });
    const father = calculateTaxes({
      ...baseInputs,
      incomeStreams: streams,
      personalCircumstances: circumstances({ widowOrSingleParent: 'singleParentFather' }),
    });
    expect(mother.residenceTax.taxableIncome).toBeLessThan(2_000_000);

    expect(mother.personalDeductions!.national).toBe(father.personalDeductions!.national);
    expect(mother.personalDeductions!.residence).toBe(father.personalDeductions!.residence);
    expect(mother.taxableIncomeForResidenceTax).toBe(father.taxableIncomeForResidenceTax);
    expect(mother.residenceTax.personalDeductionDifference).toBe(
      father.residenceTax.personalDeductionDifference + 40_000,
    );
    expect(mother.residenceTax.totalResidenceTax).toBeLessThan(
      father.residenceTax.totalResidenceTax,
    );
  });

  it('does not apply 寡婦控除 when 合計所得金額 exceeds ¥5,000,000', () => {
    // Gross ¥7,000,000 salary → 給与所得 ¥5,200,000, over the ceiling.
    const overLimit = calculateTaxes({
      ...baseInputs,
      incomeStreams: [{ type: 'salary', amount: 7_000_000, frequency: 'annual', id: 's1' }],
      personalCircumstances: circumstances({ widowOrSingleParent: 'widow' }),
    });
    expect(overLimit.totalNetIncome).toBeGreaterThan(WIDOW_SINGLE_PARENT_INCOME_LIMIT);
    expect(overLimit.personalDeductions).toBeUndefined();
  });

  it('exempts a 障害者 from residence tax entirely up to 合計所得金額 ¥1,350,000', () => {
    // Gross ¥2,090,000 salary → 給与所得 ¥1,350,000 exactly.
    const streams = [
      { type: 'salary' as const, amount: 2_090_000, frequency: 'annual' as const, id: 's1' },
    ];
    const withoutStatus = calculateTaxes({ ...baseInputs, incomeStreams: streams });
    const withStatus = calculateTaxes({
      ...baseInputs,
      incomeStreams: streams,
      personalCircumstances: circumstances({ disability: 'regular' }),
    });

    expect(withoutStatus.totalNetIncome).toBe(1_350_000);
    expect(withoutStatus.residenceTax.totalResidenceTax).toBeGreaterThan(0);
    expect(withStatus.residenceTax.totalResidenceTax).toBe(0);
    expect(withStatus.residenceTax.nonTaxableStatus).toBe('disability');
    expect(withStatus.furusatoNozei.limit).toBe(0);
  });

  it('keeps the personal deduction in the post-home-loan-credit residence tax', () => {
    // A credit large enough to spill over to residence tax makes calculateTaxes call
    // calculateResidenceTax a second time; the status must reach that call too.
    const withCredit = calculateTaxes({
      ...baseInputs,
      homeLoanTaxCredit: { creditAmount: 800_000, moveInYear: 2024 },
    });
    const withBoth = calculateTaxes({
      ...baseInputs,
      homeLoanTaxCredit: { creditAmount: 800_000, moveInYear: 2024 },
      personalCircumstances: circumstances({ disability: 'special' }),
    });

    expect(withCredit.homeLoanTaxCredit!.appliedToResidenceTax).toBeGreaterThan(0);
    expect(withBoth.homeLoanTaxCredit!.appliedToResidenceTax).toBeGreaterThan(0);
    // The displayed residence result comes from the post-credit call when the credit spills, so
    // these two fields prove that call received the circumstances: the ¥300,000 deduction and the
    // ¥100,000 人的控除額の差. (totalResidenceTax alone cannot distinguish — the deduction also
    // shifts how much credit spills over from income tax.)
    expect(withCredit.residenceTax.taxableIncome - withBoth.residenceTax.taxableIncome).toBe(
      300_000,
    );
    expect(withBoth.residenceTax.personalDeductionDifference).toBe(
      withCredit.residenceTax.personalDeductionDifference + 100_000,
    );
    // The pre-credit leg feeds the furusato cap, so the status must lower it as well.
    expect(withBoth.furusatoNozei.limit).toBeLessThan(withCredit.furusatoNozei.limit);
  });

  it('tests the 寡婦/ひとり親 ceiling against 合計所得金額, not gross income', () => {
    // Gross ¥6,400,000 salary → 給与所得 ¥4,680,000: over the ceiling in gross terms only.
    const result = calculateTaxes({
      ...baseInputs,
      incomeStreams: [{ type: 'salary', amount: 6_400_000, frequency: 'annual', id: 's1' }],
      personalCircumstances: circumstances({ widowOrSingleParent: 'widow' }),
    });
    expect(result.totalNetIncome).toBeLessThanOrEqual(WIDOW_SINGLE_PARENT_INCOME_LIMIT);
    expect(result.personalDeductions!.items.map(item => item.key)).toEqual(['widow']);
  });

  it('gives a 特別障害者 the 所得金額調整控除 without any qualifying dependent', () => {
    const streams = [
      { type: 'salary' as const, amount: 9_000_000, frequency: 'annual' as const, id: 's1' },
    ];
    const base = calculateTaxes({ ...baseInputs, incomeStreams: streams });
    const special = calculateTaxes({
      ...baseInputs,
      incomeStreams: streams,
      personalCircumstances: circumstances({ disability: 'special' }),
    });
    const regular = calculateTaxes({
      ...baseInputs,
      incomeStreams: streams,
      personalCircumstances: circumstances({ disability: 'regular' }),
    });

    // (¥9,000,000 − ¥8,500,000) × 10% = ¥50,000 off 給与所得, so 合計所得金額 falls by the same.
    expect(base.incomeAdjustmentDeduction).toBe(0);
    expect(special.incomeAdjustmentDeduction).toBe(50_000);
    expect(base.totalNetIncome - special.totalNetIncome).toBe(50_000);

    // A 一般の障害者 does not qualify — only a 特別障害者 (条件イ).
    expect(regular.incomeAdjustmentDeduction).toBe(0);
    expect(regular.totalNetIncome).toBe(base.totalNetIncome);
  });
});
