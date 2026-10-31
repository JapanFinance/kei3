// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import {
  NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION,
  NHI_SALARY_EARNER_GROSS_EMPLOYMENT_THRESHOLD,
} from '../data/nationalHealthInsurance/nhiPremiumReduction';
import type { Dependent } from '../types/dependents';
import {
  DEFAULT_NHI_PAYMENT_ATTRIBUTION,
  DEFAULT_PROVIDER,
  NATIONAL_HEALTH_INSURANCE_ID,
} from '../types/healthInsurance';
import {
  composeNHIHousehold,
  resolveDependentNHIEnrollment,
  resolveEffectiveNHIRegion,
} from '../utils/nhiHousehold';

describe('resolveDependentNHIEnrollment', () => {
  const baseDependent: Dependent = {
    id: 'dep-1',
    relationship: 'child',
    ageRange: '6to15',
    isSameHousehold: true,
    income: {
      grossEmploymentIncome: 0,
      grossPublicPensionIncome: 0,
      otherNetIncome: 0,
    },
    disability: 'none',
    isClaimedAsDependent: true,
  };

  it('returns false when the dependent is not cohabiting', () => {
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
      healthInsurance: 'other',
    };
    expect(resolveDependentNHIEnrollment(otherDep, true)).toBe(false);
  });

  it('follows taxpayer insurance when healthInsurance is auto or undefined', () => {
    const autoDep: Dependent = {
      ...baseDependent,
      healthInsurance: 'auto',
    };
    expect(resolveDependentNHIEnrollment(autoDep, true)).toBe(true);
    expect(resolveDependentNHIEnrollment(autoDep, false)).toBe(false);

    const undefinedDep: Dependent = {
      ...baseDependent,
      healthInsurance: undefined,
    };
    expect(resolveDependentNHIEnrollment(undefinedDep, true)).toBe(true);
    expect(resolveDependentNHIEnrollment(undefinedDep, false)).toBe(false);
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
    expect(composition.salaryEarnersCount).toBe(1);
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
    const spouse: Dependent = {
      id: 'spouse',
      relationship: 'spouse',
      ageRange: '40to64',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: 1_000_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
    };

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
    expect(composition.reductionTestIncome).toBeGreaterThan(6_000_000);
  });

  it('supports designated household head when dependent is head', () => {
    const parent: Dependent = {
      id: 'parent',
      relationship: 'parent',
      ageRange: '65to69',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 1_200_000,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
      isHouseholdHead: true,
    };

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

  it('excludes non-cohabiting dependents from NHI household', () => {
    const nonCohabitingChild: Dependent = {
      id: 'child-away',
      relationship: 'child',
      ageRange: '19to22',
      isSameHousehold: false,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
      healthInsurance: 'nhi',
    };

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
    const preschoolChild: Dependent = {
      id: 'child-preschool',
      relationship: 'child',
      ageRange: 'under6',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
    };

    const schoolChild: Dependent = {
      id: 'child-school',
      relationship: 'child',
      ageRange: '6to15',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
    };

    const highSchoolChild: Dependent = {
      id: 'child-highschool',
      relationship: 'child',
      ageRange: '16to18',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
    };

    const universityChild: Dependent = {
      id: 'child-college',
      relationship: 'child',
      ageRange: '19to22',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
    };

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
    const elderlySpouse: Dependent = {
      id: 'elderly-spouse',
      relationship: 'spouse',
      ageRange: '65to69',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: 0,
        grossPublicPensionIncome: 1_000_000, // net pension income will be calculated
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
      healthInsurance: 'nhi',
    };

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
    expect(spouseMember.elderlyPensionSpecialDeduction).toBeLessThanOrEqual(
      NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION,
    );
    expect(composition.taxpayerMember.elderlyPensionSpecialDeduction).toBe(0); // 0 net pension
  });

  it('counts salary earners accurately for reduction threshold expansion', () => {
    const earnerSpouse: Dependent = {
      id: 'earner-spouse',
      relationship: 'spouse',
      ageRange: '40to64',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: NHI_SALARY_EARNER_GROSS_EMPLOYMENT_THRESHOLD + 10_000,
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: false,
      healthInsurance: 'nhi',
    };

    const nonEarnerChild: Dependent = {
      id: 'child',
      relationship: 'child',
      ageRange: '6to15',
      isSameHousehold: true,
      income: {
        grossEmploymentIncome: 200_000, // below threshold
        grossPublicPensionIncome: 0,
        otherNetIncome: 0,
      },
      disability: 'none',
      isClaimedAsDependent: true,
    };

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
      incomeYear: defaultYear,
    });

    // Taxpayer (earner) + Spouse (earner) = 2 salary earners
    expect(composition.salaryEarnersCount).toBe(2);
  });
});
