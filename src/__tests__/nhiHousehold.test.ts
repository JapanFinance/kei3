// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import {
  getNHIPremiumReductionThresholdsForMonth,
  NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION,
} from '../data/nationalHealthInsurance/nhiPremiumReduction';
import type { Dependent } from '../types/dependents';
import {
  CUSTOM_PROVIDER_ID,
  DEFAULT_NHI_PAYMENT_ATTRIBUTION,
  DEFAULT_PROVIDER,
  DEPENDENT_COVERAGE_ID,
  LATTER_STAGE_ELDERLY_ID,
  NATIONAL_HEALTH_INSURANCE_ID,
} from '../types/healthInsurance';
import {
  composeNHIHousehold,
  countNHISalaryEarners,
  getAutoHealthInsuranceLabel,
  resolveDependentNHIEnrollment,
  resolveEffectiveNHIRegion,
} from '../utils/nhiHousehold';
import { makeDependent, makeSpouse } from './fixtures/dependents';

describe('resolveDependentNHIEnrollment', () => {
  const baseDependent: Dependent = makeDependent({
    id: 'dep-1',
    relationship: 'child',
    ageRange: '6to15',
    isSameHousehold: true,
  });

  it('returns false when the dependent is not in the same municipal household', () => {
    const nonCohabiting: Dependent = {
      ...baseDependent,
      isSameHousehold: false,
      healthInsurance: 'nhi',
    };
    expect(resolveDependentNHIEnrollment(nonCohabiting, true)).toBe(false);
    expect(resolveDependentNHIEnrollment(nonCohabiting, false)).toBe(false);
  });

  it('returns false for dependents aged 75 or older regardless of settings', () => {
    const elderlyDep: Dependent = {
      ...baseDependent,
      ageRange: '75plus',
      healthInsurance: 'nhi',
    };
    expect(resolveDependentNHIEnrollment(elderlyDep, true)).toBe(false);
  });

  it('returns true when healthInsurance is explicitly set to nhi', () => {
    const nhiDep: Dependent = {
      ...baseDependent,
      healthInsurance: 'nhi',
    };
    expect(resolveDependentNHIEnrollment(nhiDep, false)).toBe(true);
    expect(resolveDependentNHIEnrollment(nhiDep, true)).toBe(true);
  });

  it('returns false when healthInsurance is explicitly set to other', () => {
    const otherDep: Dependent = {
      ...baseDependent,
      healthInsurance: 'non_nhi',
    };
    expect(resolveDependentNHIEnrollment(otherDep, true)).toBe(false);
  });

  it('follows taxpayer insurance when healthInsurance is auto', () => {
    const autoDep: Dependent = {
      ...baseDependent,
      healthInsurance: 'auto',
    };
    expect(resolveDependentNHIEnrollment(autoDep, true)).toBe(true);
    expect(resolveDependentNHIEnrollment(autoDep, false)).toBe(false);
  });
});

describe('resolveEffectiveNHIRegion', () => {
  it('returns taxpayer region directly if taxpayer is enrolled in NHI', () => {
    expect(resolveEffectiveNHIRegion(NATIONAL_HEALTH_INSURANCE_ID, 'Osaka')).toBe('Osaka');
    expect(resolveEffectiveNHIRegion(NATIONAL_HEALTH_INSURANCE_ID, 'Tokyo-Shibuya')).toBe(
      'Tokyo-Shibuya',
    );
  });

  it('returns nhiHouseholdRegion when taxpayer is on EHI and valid region provided', () => {
    expect(resolveEffectiveNHIRegion(DEFAULT_PROVIDER, 'Tokyo', 'Osaka')).toBe('Osaka');
    expect(resolveEffectiveNHIRegion(DEFAULT_PROVIDER, 'Tokyo', 'Tokyo-Shibuya')).toBe(
      'Tokyo-Shibuya',
    );
  });

  it('falls back to taxpayer region if it is a valid NHI region', () => {
    expect(resolveEffectiveNHIRegion(DEFAULT_PROVIDER, 'Osaka')).toBe('Osaka');
  });

  it('falls back to taxpayer region when nhiHouseholdRegion is invalid', () => {
    expect(resolveEffectiveNHIRegion(DEFAULT_PROVIDER, 'Osaka', 'InvalidRegion')).toBe('Osaka');
  });

  it('resolves region for 75+ Latter-Stage Elderly taxpayer', () => {
    expect(resolveEffectiveNHIRegion(LATTER_STAGE_ELDERLY_ID, 'Osaka')).toBe('Osaka');
    expect(resolveEffectiveNHIRegion(LATTER_STAGE_ELDERLY_ID, 'Tokyo', 'Tokyo-Setagaya')).toBe(
      'Tokyo-Setagaya',
    );
  });

  it('falls back to Tokyo if neither region is a valid NHI region', () => {
    expect(resolveEffectiveNHIRegion(DEFAULT_PROVIDER, 'InvalidRegion', 'AlsoInvalid')).toBe(
      'Tokyo',
    );
  });
});

describe('composeNHIHousehold', () => {
  const defaultYear = 2026;

  it('composes single taxpayer under 40 on NHI', () => {
    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 4_000_000,
        grossEmploymentIncome: 5_400_000,
        netPublicPensionIncome: 0,
        ageRange: 'age20to39',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [],
      incomeYear: defaultYear,
    });

    expect(composition.members).toHaveLength(1);
    expect(composition.householdHead.id).toBe('taxpayer');
    expect(composition.isDeemedHead).toBe(false);
    expect(composition.insuredCount).toBe(1);
    expect(composition.ltcInsuredCount).toBe(0);
    expect(composition.preschoolCount).toBe(0);
    expect(composition.childSupportExemptCount).toBe(0);
    expect(composition.reductionTestGroup).toHaveLength(1);
    expect(composition.reductionTestIncome).toBe(4_000_000);
    expect(composition.salaryEarnersCounts).toEqual({ prevFY: 1, currFY: 1 });
    expect(composition.paymentAttribution).toBe(DEFAULT_NHI_PAYMENT_ATTRIBUTION);
  });

  it('identifies taxpayer under 18 as exempt from child support per-capita', () => {
    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 1_000_000,
        grossEmploymentIncome: 1_550_000,
        netPublicPensionIncome: 0,
        ageRange: 'under18',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [],
      incomeYear: defaultYear,
    });

    expect(composition.taxpayerMember.isChildSupportExempt).toBe(true);
    expect(composition.childSupportExemptCount).toBe(1);
  });

  it('identifies 40-64 taxpayer for Long-Term Care Category 2', () => {
    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 4_000_000,
        grossEmploymentIncome: 5_400_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [],
      incomeYear: defaultYear,
    });

    expect(composition.taxpayerMember.isLtcCat2).toBe(true);
    expect(composition.ltcInsuredCount).toBe(1);
  });

  it('correctly models deemed household head (擬制世帯主)', () => {
    // Taxpayer is on Kyokai Kenpo (EHI), but spouse is enrolled in NHI
    const spouse: Dependent = makeSpouse({
      id: 'spouse',
      ageRange: '40to59',
      income: {
        grossEmploymentIncome: 1_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 6_000_000,
        grossEmploymentIncome: 8_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: DEFAULT_PROVIDER, // Kyokai Kenpo
        region: 'Tokyo',
      },
      dependents: [spouse],
      incomeYear: defaultYear,
      paymentAttribution: 'fullHousehold',
    });

    expect(composition.householdHead.id).toBe('taxpayer');
    expect(composition.isDeemedHead).toBe(true);
    expect(composition.insuredCount).toBe(1); // Only spouse is insured under NHI
    expect(composition.ltcInsuredCount).toBe(1); // Spouse is 40-64
    // Reduction test group includes both deemed head (taxpayer) and insured member (spouse)
    expect(composition.reductionTestGroup).toHaveLength(2);
    // Taxpayer net employment (6,000,000) + spouse net employment (1,000,000 - 740,000 deduction = 260,000)
    expect(composition.reductionTestIncome).toBe(6_260_000);
  });

  it('models 75+ taxpayer (Latter-Stage Elderly) as deemed head for NHI spouse', () => {
    const spouse: Dependent = makeSpouse({
      id: 'spouse',
      ageRange: '40to59',
      income: {
        grossEmploymentIncome: 1_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      healthInsurance: 'nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 3_000_000,
        grossEmploymentIncome: 0,
        netPublicPensionIncome: 3_000_000,
        ageRange: 'age75plus',
        provider: LATTER_STAGE_ELDERLY_ID,
        region: 'Tokyo',
      },
      dependents: [spouse],
      incomeYear: defaultYear,
    });

    expect(composition.taxpayerMember.isNHIInsured).toBe(false);
    expect(composition.householdHead.id).toBe('taxpayer');
    expect(composition.isDeemedHead).toBe(true);
    expect(composition.insuredCount).toBe(1); // Only spouse is on NHI
    expect(composition.reductionTestGroup).toHaveLength(2); // 75+ deemed head included in reduction test
    const spouseMember = composition.members.find(m => m.id === 'spouse')!;
    expect(composition.calculationBase).toBe(spouseMember.calculationBase);
  });

  it('supports designated household head when dependent is head', () => {
    const parent: Dependent = makeDependent({
      id: 'parent',
      relationship: 'parent',
      ageRange: '65to69',
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 1_200_000,
        otherNetIncome: 0,
      },
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
      isHouseholdHead: true,
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 5_000_000,
        grossEmploymentIncome: 7_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age20to39',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [parent],
      incomeYear: defaultYear,
    });

    expect(composition.householdHead.id).toBe('parent');
    expect(composition.householdHead.isNHIInsured).toBe(true);
    expect(composition.isDeemedHead).toBe(false);
  });

  it('models designated dependent household head who is not NHI-insured as deemed head', () => {
    const parent: Dependent = makeDependent({
      id: 'parent',
      relationship: 'parent',
      ageRange: '75plus',
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 1_500_000,
        otherNetIncome: 0,
      },
      healthInsurance: 'non_nhi',
      isHouseholdHead: true,
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 5_000_000,
        grossEmploymentIncome: 7_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age20to39',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [parent],
      incomeYear: defaultYear,
    });

    expect(composition.householdHead.id).toBe('parent');
    expect(composition.householdHead.isNHIInsured).toBe(false);
    expect(composition.isDeemedHead).toBe(true);
    expect(composition.insuredCount).toBe(1); // Only taxpayer is NHI-insured
    expect(composition.reductionTestGroup).toHaveLength(2); // Deemed head parent + insured taxpayer
  });

  it('excludes separate-household dependents (isSameHousehold: false) from NHI household', () => {
    const nonCohabitingChild: Dependent = makeDependent({
      id: 'child-away',
      relationship: 'child',
      ageRange: '20to22',
      isSameHousehold: false,
      healthInsurance: 'nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 4_000_000,
        grossEmploymentIncome: 5_400_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [nonCohabitingChild],
      incomeYear: defaultYear,
    });

    expect(composition.members).toHaveLength(1);
    expect(composition.insuredCount).toBe(1);
  });

  it('counts preschool children and under-18 children accurately', () => {
    const preschoolChild: Dependent = makeDependent({
      id: 'child-preschool',
      relationship: 'child',
      ageRange: 'under6',
    });

    const schoolChild: Dependent = makeDependent({
      id: 'child-school',
      relationship: 'child',
      ageRange: '6to15',
    });

    const highSchoolChild: Dependent = makeDependent({
      id: 'child-highschool',
      relationship: 'child',
      ageRange: '16to18',
    });

    const universityChild: Dependent = makeDependent({
      id: 'child-college',
      relationship: 'child',
      ageRange: '20to22',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 5_000_000,
        grossEmploymentIncome: 7_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [preschoolChild, schoolChild, highSchoolChild, universityChild],
      incomeYear: defaultYear,
    });

    expect(composition.insuredCount).toBe(5);
    expect(composition.preschoolCount).toBe(1); // only under6
    expect(composition.childSupportExemptCount).toBe(3); // under6, 6to15, 16to18 (< 19)
  });

  it('applies the ¥150,000 elderly pension special deduction for 65+ members in reduction test income', () => {
    const elderlySpouse: Dependent = makeSpouse({
      id: 'elderly-spouse',
      ageRange: '65to69',
      income: {
        grossEmploymentIncome: 0,
        // Gross pension 1.5M -> Net pension (65+) = 1.5M - 1.1M = 400,000
        // Elderly pension adjustment = min(400,000, 150,000) = 150,000
        // Adjusted pension contributed to reduction test income = 400,000 - 150,000 = 250,000
        grossPublicPensionIncome: 1_500_000,
        otherNetIncome: 0,
      },
      healthInsurance: 'nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 1_000_000,
        grossEmploymentIncome: 1_550_000,
        netPublicPensionIncome: 0,
        ageRange: 'age65to69',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [elderlySpouse],
      incomeYear: defaultYear,
    });

    const spouseMember = composition.members.find(m => m.id === 'elderly-spouse')!;
    expect(spouseMember.isElderly65Plus).toBe(true);
    expect(spouseMember.elderlyPensionSpecialDeduction).toBe(
      NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION,
    );
    expect(composition.taxpayerMember.elderlyPensionSpecialDeduction).toBe(0); // 0 net pension
    // Taxpayer (1,000,000) + spouse adjusted pension (400,000 - 150,000 = 250,000) = 1,250,000
    expect(composition.reductionTestIncome).toBe(1_250_000);
  });

  it('applies the ¥150,000 elderly pension special deduction to a 65+ taxpayer with pension income', () => {
    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 400_000,
        grossEmploymentIncome: 0,
        netPublicPensionIncome: 400_000,
        ageRange: 'age65to69',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [],
      incomeYear: defaultYear,
    });

    expect(composition.taxpayerMember.isElderly65Plus).toBe(true);
    expect(composition.taxpayerMember.elderlyPensionSpecialDeduction).toBe(150_000);
    // Net income 400,000 - deduction 150,000 = 250,000
    expect(composition.reductionTestIncome).toBe(250_000);
  });

  it('does not apply elderly pension special deduction to members under age 65', () => {
    const spouseUnder65: Dependent = makeSpouse({
      id: 'spouse-under65',
      ageRange: '40to59',
      income: {
        grossEmploymentIncome: 0,
        // Under 65: gross 1.5M - 650k deduction = 850,000 net pension
        grossPublicPensionIncome: 1_500_000,
        otherNetIncome: 0,
      },
      healthInsurance: 'nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 1_000_000,
        grossEmploymentIncome: 1_550_000,
        netPublicPensionIncome: 0,
        ageRange: 'age20to39',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [spouseUnder65],
      incomeYear: defaultYear,
    });

    const spouseMember = composition.members.find(m => m.id === 'spouse-under65')!;
    expect(spouseMember.isElderly65Plus).toBe(false);
    expect(spouseMember.elderlyPensionSpecialDeduction).toBe(0);
    // Taxpayer (1,000,000) + spouse (850,000 - 0) = 1,850,000
    expect(composition.reductionTestIncome).toBe(1_850_000);
  });

  it('counts salary earners per fiscal year using FY2025 (>550k) and FY2026 (>650k) thresholds', () => {
    const fy2026Threshold = getNHIPremiumReductionThresholdsForMonth(
      2026,
      3,
    ).salaryEarnerGrossThreshold;
    expect(fy2026Threshold).toBe(650_000);

    const earnerSpouse: Dependent = makeSpouse({
      id: 'earner-spouse',
      ageRange: '40to59',
      income: {
        grossEmploymentIncome: fy2026Threshold + 10_000, // 660,000 > both FY2025 (550k) and FY2026 (650k)
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
    });

    const nonEarnerChild: Dependent = makeDependent({
      id: 'child',
      relationship: 'child',
      ageRange: '6to15',
      income: {
        grossEmploymentIncome: 200_000, // below threshold
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 4_000_000,
        grossEmploymentIncome: 5_500_000, // above threshold
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [earnerSpouse, nonEarnerChild],
      incomeYear: 2026,
    });

    // Taxpayer (earner) + Spouse (earner) = 2 salary earners in both FY2025 and FY2026
    expect(composition.salaryEarnersCounts).toEqual({ prevFY: 2, currFY: 2 });

    // Spouse earning ¥600,000 exceeds FY2025's ¥550,000 threshold (Jan–Mar 2026)
    // but has ¥0 net employment income and does NOT exceed FY2026's ¥650,000 threshold (Jun–Dec 2026).
    const boundarySpouse: Dependent = {
      ...earnerSpouse,
      income: {
        grossEmploymentIncome: 600_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
    };
    const boundaryComposition = composeNHIHousehold({
      taxpayer: {
        netIncome: 4_000_000,
        grossEmploymentIncome: 5_500_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [boundarySpouse],
      incomeYear: 2026,
    });
    expect(boundaryComposition.salaryEarnersCounts).toEqual({ prevFY: 2, currFY: 1 });
  });

  it('counts a pensioner with adjusted pension > 0 as a salary/pension earner', () => {
    const pensionerParent: Dependent = makeDependent({
      id: 'parent',
      relationship: 'parent',
      ageRange: '65to69',
      income: {
        grossEmploymentIncome: 0,
        // Gross pension 1.5M -> Net pension (65+) = 1.5M - 1.1M = 400,000
        // Elderly pension adjustment = 150,000
        // Adjusted pension = 400,000 - 150,000 = 250,000 > 0
        grossPublicPensionIncome: 1_500_000,
        otherNetIncome: 0,
      },
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 3_000_000, // Business income (not a salary or pension earner)
        grossEmploymentIncome: 0,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [pensionerParent],
      incomeYear: defaultYear,
    });

    // Parent qualifies as salary/pension earner via adjusted pension > 0
    expect(composition.salaryEarnersCounts).toEqual({ prevFY: 1, currFY: 1 });
  });

  it('sums calculationBase per member and ensures unused basic deductions do not transfer', () => {
    // Member 1 (Taxpayer, age 40-59): Net 1,000,000 -> Base: 1,000,000 - 430,000 = 570,000 (LTC: true)
    // Member 2 (Child, age 16-18): Net 200,000 -> Base: max(0, 200,000 - 430,000) = 0 (LTC: false)
    //   Unused deduction: 230,000 (must NOT transfer to reduce Taxpayer or Spouse base)
    // Member 3 (Spouse, age 40-64): Net 600,000 -> Base: 600,000 - 430,000 = 170,000 (LTC: true)
    const child: Dependent = makeDependent({
      id: 'child',
      relationship: 'child',
      ageRange: '16to18',
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 200_000,
      },
      healthInsurance: 'nhi',
    });

    const spouse: Dependent = makeSpouse({
      id: 'spouse',
      ageRange: '40to59',
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 600_000,
      },
      healthInsurance: 'nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 1_000_000,
        grossEmploymentIncome: 0,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [child, spouse],
      incomeYear: defaultYear,
    });

    expect(composition.insuredCount).toBe(3);
    expect(composition.ltcInsuredCount).toBe(2); // taxpayer + spouse

    // Taxpayer base: 570,000; Child base: 0; Spouse base: 170,000
    // Total calculation base: 570,000 + 0 + 170,000 = 740,000
    expect(composition.calculationBase).toBe(740_000);
    // LTC base: only members aged 40-64 (taxpayer 570,000 + spouse 170,000)
    expect(composition.ltcCalculationBase).toBe(740_000);

    const childMember = composition.members.find(m => m.id === 'child')!;
    expect(childMember.calculationBase).toBe(0);
    const spouseMember = composition.members.find(m => m.id === 'spouse')!;
    expect(spouseMember.calculationBase).toBe(170_000);
    expect(composition.taxpayerMember.calculationBase).toBe(570_000);
  });

  it('handles household with zero NHI-insured members safely', () => {
    const spouse: Dependent = makeSpouse({
      id: 'spouse',
      ageRange: '40to59',
      income: { grossEmploymentIncome: 0, grossPublicPensionIncome: 0, otherNetIncome: 0 },
      healthInsurance: 'non_nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 5_000_000,
        grossEmploymentIncome: 7_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age20to39',
        provider: DEFAULT_PROVIDER, // EHI
        region: 'Tokyo',
      },
      dependents: [spouse],
      incomeYear: defaultYear,
    });

    expect(composition.insuredCount).toBe(0);
    expect(composition.ltcInsuredCount).toBe(0);
    expect(composition.preschoolCount).toBe(0);
    expect(composition.childSupportExemptCount).toBe(0);
    expect(composition.calculationBase).toBe(0);
    expect(composition.ltcCalculationBase).toBe(0);
    // Reduction test group safely contains only household head
    expect(composition.reductionTestGroup).toHaveLength(1);
    expect(composition.reductionTestGroup[0]!.id).toBe('taxpayer');
  });

  it('records paymentAttribution: none when specified', () => {
    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 4_000_000,
        grossEmploymentIncome: 5_400_000,
        netPublicPensionIncome: 0,
        ageRange: 'age20to39',
        provider: NATIONAL_HEALTH_INSURANCE_ID,
        region: 'Tokyo',
      },
      dependents: [],
      incomeYear: defaultYear,
      paymentAttribution: 'none',
    });

    expect(composition.paymentAttribution).toBe('none');
  });

  it('passes through nhiHouseholdRegion to effectiveRegion when taxpayer is on EHI', () => {
    const spouse: Dependent = makeSpouse({
      id: 'spouse',
      ageRange: '40to59',
      healthInsurance: 'nhi',
    });

    const composition = composeNHIHousehold({
      taxpayer: {
        netIncome: 5_000_000,
        grossEmploymentIncome: 7_000_000,
        netPublicPensionIncome: 0,
        ageRange: 'age40to59',
        provider: DEFAULT_PROVIDER, // EHI
        region: 'Tokyo',
      },
      dependents: [spouse],
      incomeYear: defaultYear,
      nhiHouseholdRegion: 'Osaka',
    });

    expect(composition.effectiveRegion).toBe('Osaka');
  });
});

describe('getAutoHealthInsuranceLabel', () => {
  it('returns "Same as taxpayer (NHI)" when isTaxpayerNHI is true', () => {
    expect(getAutoHealthInsuranceLabel(NATIONAL_HEALTH_INSURANCE_ID, true)).toBe(
      'Same as taxpayer (NHI)',
    );
    expect(getAutoHealthInsuranceLabel(undefined, true)).toBe('Same as taxpayer (NHI)');
  });

  it('returns "Same as taxpayer (EHI)" for employee health insurance, custom providers, and dependent coverage', () => {
    expect(getAutoHealthInsuranceLabel(undefined, false)).toBe('Same as taxpayer (EHI)');
    expect(getAutoHealthInsuranceLabel(DEFAULT_PROVIDER, false)).toBe('Same as taxpayer (EHI)');
    expect(getAutoHealthInsuranceLabel('KantoItsKenpo', false)).toBe('Same as taxpayer (EHI)');
    expect(getAutoHealthInsuranceLabel(CUSTOM_PROVIDER_ID, false)).toBe('Same as taxpayer (EHI)');
    expect(getAutoHealthInsuranceLabel(DEPENDENT_COVERAGE_ID, false)).toBe(
      'Same as taxpayer (EHI)',
    );
  });

  it('returns "Other / non-NHI" when the taxpayer is on Latter-Stage Elderly', () => {
    expect(getAutoHealthInsuranceLabel(LATTER_STAGE_ELDERLY_ID, false)).toBe('Other / non-NHI');
  });
});

describe('countNHISalaryEarners', () => {
  const threshold = 650_000;

  it('counts members whose gross employment income exceeds the threshold', () => {
    const members = [
      {
        grossEmploymentIncome: 700_000,
        netPublicPensionIncome: 0,
        elderlyPensionSpecialDeduction: 0,
      },
      {
        grossEmploymentIncome: 650_000,
        netPublicPensionIncome: 0,
        elderlyPensionSpecialDeduction: 0,
      },
      {
        grossEmploymentIncome: 200_000,
        netPublicPensionIncome: 0,
        elderlyPensionSpecialDeduction: 0,
      },
    ];
    expect(countNHISalaryEarners(members, threshold)).toBe(1);
  });

  it('counts members with adjusted public pension income > 0', () => {
    const members = [
      // net pension 400k - deduction 150k = 250k > 0 -> counts
      {
        grossEmploymentIncome: 0,
        netPublicPensionIncome: 400_000,
        elderlyPensionSpecialDeduction: 150_000,
      },
      // net pension 150k - deduction 150k = 0 -> does not count
      {
        grossEmploymentIncome: 0,
        netPublicPensionIncome: 150_000,
        elderlyPensionSpecialDeduction: 150_000,
      },
    ];
    expect(countNHISalaryEarners(members, threshold)).toBe(1);
  });

  it('counts a member with BOTH gross employment > threshold AND adjusted pension > 0 only once', () => {
    const members = [
      {
        grossEmploymentIncome: 800_000,
        netPublicPensionIncome: 300_000,
        elderlyPensionSpecialDeduction: 150_000,
      },
    ];
    expect(countNHISalaryEarners(members, threshold)).toBe(1);
  });

  it('returns 0 for an empty group', () => {
    expect(countNHISalaryEarners([], threshold)).toBe(0);
  });
});
