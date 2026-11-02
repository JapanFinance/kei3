// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import {
  NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION,
  NHI_SALARY_EARNER_GROSS_EMPLOYMENT_THRESHOLD,
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
    const spouse: Dependent = makeSpouse({
      id: 'spouse',
      ageRange: '40to64',
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
    expect(composition.reductionTestIncome).toBeGreaterThan(6_000_000);
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

  it('excludes non-cohabiting dependents from NHI household', () => {
    const nonCohabitingChild: Dependent = makeDependent({
      id: 'child-away',
      relationship: 'child',
      ageRange: '19to22',
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
      ageRange: '19to22',
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
        grossPublicPensionIncome: 1_000_000, // net pension income will be calculated
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
    expect(spouseMember.elderlyPensionSpecialDeduction).toBeLessThanOrEqual(
      NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION,
    );
    expect(composition.taxpayerMember.elderlyPensionSpecialDeduction).toBe(0); // 0 net pension
  });

  it('counts salary earners accurately for reduction threshold expansion', () => {
    const earnerSpouse: Dependent = makeSpouse({
      id: 'earner-spouse',
      ageRange: '40to64',
      income: {
        grossEmploymentIncome: NHI_SALARY_EARNER_GROSS_EMPLOYMENT_THRESHOLD + 10_000,
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
      incomeYear: defaultYear,
    });

    // Taxpayer (earner) + Spouse (earner) = 2 salary earners
    expect(composition.salaryEarnersCount).toBe(2);
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
    expect(composition.salaryEarnersCount).toBe(1);
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
      ageRange: '40to64',
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
});

describe('getAutoHealthInsuranceLabel', () => {
  it('returns "Same as taxpayer (NHI)" when isTaxpayerNHI is true regardless of provider', () => {
    expect(getAutoHealthInsuranceLabel(NATIONAL_HEALTH_INSURANCE_ID, true)).toBe(
      'Same as taxpayer (NHI)',
    );
    expect(getAutoHealthInsuranceLabel(DEFAULT_PROVIDER, true)).toBe('Same as taxpayer (NHI)');
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
