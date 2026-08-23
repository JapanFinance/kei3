// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import {
  PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND,
  calculateNetPublicPensionIncome,
} from '../data/publicPensionDeduction';
import { assertAgeRangesDoNotCrossBands, ageRangeCoversBand } from '../types/age';
import type { Dependent } from '../types/dependents';
import { DEPENDENT_AGE_BANDS, SPOUSE_AGE_BANDS, dependentAgeCoversBand } from '../types/dependents';
import { STATUTORY_AGE_BANDS } from '../types/taxpayerAge';
import { calculateDependentNetPublicPensionIncome } from '../utils/dependentDeductions';
import { calculateNetIncomeComponents } from '../utils/taxCalculations';

const YEAR = 2026;
const GROSS_PENSION = 1_300_000;

describe('ageRangeCoversBand', () => {
  it('covers a band only when every age in the interval falls inside it', () => {
    const forties = { minAgeInclusive: 40, maxAgeExclusive: 50 };
    expect(ageRangeCoversBand(forties, { minAgeInclusive: 40, maxAgeExclusive: 50 })).toBe(true);
    expect(ageRangeCoversBand(forties, { minAgeInclusive: 20 })).toBe(true);
    expect(ageRangeCoversBand(forties, {})).toBe(true);
    // A band starting mid-interval holds for the oldest in it but not the youngest.
    expect(ageRangeCoversBand(forties, { minAgeInclusive: 45 })).toBe(false);
    expect(ageRangeCoversBand(forties, { maxAgeExclusive: 45 })).toBe(false);
  });
});

describe('assertAgeRangesDoNotCrossBands', () => {
  it('rejects an interval that spans a band boundary', () => {
    expect(() =>
      assertAgeRangesDoNotCrossBands(
        'Test category',
        { age60to69: { minAgeInclusive: 60, maxAgeExclusive: 70 } },
        { elderly: { minAgeInclusive: 65 } },
      ),
    ).toThrow(/age60to69 .* crosses the elderly band/);
  });

  it('accepts intervals that stop at every band boundary', () => {
    expect(() =>
      assertAgeRangesDoNotCrossBands(
        'Test category',
        {
          age60to64: { minAgeInclusive: 60, maxAgeExclusive: 65 },
          age65plus: { minAgeInclusive: 65, maxAgeExclusive: Infinity },
        },
        { elderly: { minAgeInclusive: 65 } },
      ),
    ).not.toThrow();
  });
});

describe('the 65 boundary of the public pension deduction', () => {
  it('is stated once, by the module that owns the deduction table', () => {
    expect(STATUTORY_AGE_BANDS.publicPensionDeductionElderly).toBe(
      PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND,
    );
    expect(SPOUSE_AGE_BANDS.publicPensionDeductionElderly).toBe(
      PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND,
    );
    expect(DEPENDENT_AGE_BANDS.publicPensionDeductionElderly).toBe(
      PUBLIC_PENSION_DEDUCTION_ELDERLY_AGE_BAND,
    );
  });

  const pensionOnly = (ageRange: Dependent['ageRange']) => ({
    ageRange,
    income: {
      grossEmploymentIncome: 0,
      grossPublicPensionIncome: GROSS_PENSION,
      otherNetIncome: 0,
    },
    disability: 'none' as const,
  });

  // At ¥1,300,000 gross the 公的年金等控除 is ¥600,000 under 65 and its ¥1,100,000 minimum from 65.
  const NET_UNDER_65 = 700_000;
  const NET_65_PLUS = 200_000;

  it('gives the taxpayer and a dependent the same net pension income on either side of it', () => {
    const taxpayerNetPension = (ageRange: 'age60to64' | 'age65to69') =>
      calculateNetIncomeComponents(
        [{ type: 'publicPension', amount: GROSS_PENSION, id: 'p1' }],
        YEAR,
        ageRange,
        [],
      ).netPublicPensionIncome;

    expect(taxpayerNetPension('age60to64')).toBe(NET_UNDER_65);
    expect(taxpayerNetPension('age65to69')).toBe(NET_65_PLUS);

    expect(calculateDependentNetPublicPensionIncome(pensionOnly('23to64'), YEAR)).toBe(
      NET_UNDER_65,
    );
    expect(calculateDependentNetPublicPensionIncome(pensionOnly('65to69'), YEAR)).toBe(NET_65_PLUS);
    expect(calculateDependentNetPublicPensionIncome(pensionOnly('70plus'), YEAR)).toBe(NET_65_PLUS);

    // A spouse is read on the same band as a non-spouse dependent.
    expect(calculateDependentNetPublicPensionIncome(pensionOnly('under65'), YEAR)).toBe(
      NET_UNDER_65,
    );
  });

  it('matches the deduction the calculation applies for the same gross amount', () => {
    expect(calculateNetPublicPensionIncome(GROSS_PENSION, false, 0, YEAR)).toBe(NET_UNDER_65);
    expect(calculateNetPublicPensionIncome(GROSS_PENSION, true, 0, YEAR)).toBe(NET_65_PLUS);
  });
});

describe('dependentAgeCoversBand', () => {
  it('answers spouse and non-spouse categories on the same bands', () => {
    expect(
      dependentAgeCoversBand('under65', DEPENDENT_AGE_BANDS.publicPensionDeductionElderly),
    ).toBe(false);
    expect(
      dependentAgeCoversBand('23to64', DEPENDENT_AGE_BANDS.publicPensionDeductionElderly),
    ).toBe(false);
    expect(
      dependentAgeCoversBand('65to69', DEPENDENT_AGE_BANDS.publicPensionDeductionElderly),
    ).toBe(true);
    expect(dependentAgeCoversBand('70plus', SPOUSE_AGE_BANDS.publicPensionDeductionElderly)).toBe(
      true,
    );
  });

  it('reads the 70 boundary of the elderly bands', () => {
    expect(dependentAgeCoversBand('65to69', DEPENDENT_AGE_BANDS.elderlyDependent)).toBe(false);
    expect(dependentAgeCoversBand('70plus', DEPENDENT_AGE_BANDS.elderlyDependent)).toBe(true);
    expect(dependentAgeCoversBand('65to69', SPOUSE_AGE_BANDS.elderlySpouse)).toBe(false);
    expect(dependentAgeCoversBand('70plus', SPOUSE_AGE_BANDS.elderlySpouse)).toBe(true);
  });

  it('reads the 23 boundary of the 所得金額調整控除 dependent condition', () => {
    expect(dependentAgeCoversBand('under16', DEPENDENT_AGE_BANDS.dependentUnder23)).toBe(true);
    expect(dependentAgeCoversBand('16to18', DEPENDENT_AGE_BANDS.dependentUnder23)).toBe(true);
    expect(dependentAgeCoversBand('19to22', DEPENDENT_AGE_BANDS.dependentUnder23)).toBe(true);
    expect(dependentAgeCoversBand('23to64', DEPENDENT_AGE_BANDS.dependentUnder23)).toBe(false);
  });
});
