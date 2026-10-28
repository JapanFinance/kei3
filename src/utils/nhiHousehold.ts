// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NATIONAL_HEALTH_INSURANCE_REGIONS } from '../data/nationalHealthInsurance/nhiParamsData';
import {
  NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION,
  NHI_SALARY_EARNER_GROSS_EMPLOYMENT_THRESHOLD,
} from '../data/nationalHealthInsurance/nhiPremiumReduction';
import type { Dependent } from '../types/dependents';
import { DEPENDENT_AGE_BANDS, SPOUSE_AGE_BANDS, dependentAgeCoversBand } from '../types/dependents';
import type { HealthInsuranceProviderId, NHIPaymentAttribution } from '../types/healthInsurance';
import {
  DEFAULT_NHI_PAYMENT_ATTRIBUTION,
  NATIONAL_HEALTH_INSURANCE_ID,
} from '../types/healthInsurance';
import type { TaxpayerAgeRange } from '../types/taxpayerAge';
import {
  isLongTermCareCategory2Insured,
  isNationalHealthInsuranceEligible,
  STATUTORY_AGE_BANDS,
  taxpayerAgeCoversBand,
} from '../types/taxpayerAge';
import {
  calculateDependentNetPublicPensionIncome,
  calculateDependentTotalNetIncome,
} from './dependentDeductions';
import { premiumCalculationBase } from './healthInsuranceCalculator';

/**
 * A household member evaluated for National Health Insurance.
 */
export interface NHIHouseholdMember {
  id: string;
  relationship: 'taxpayer' | 'spouse' | 'child' | 'parent' | 'other';
  isTaxpayer: boolean;
  isCohabiting: boolean;
  isHouseholdHead: boolean;
  isNHIInsured: boolean;
  isLtcCat2: boolean;
  isPreschool: boolean;
  isChildSupportExempt: boolean;
  isElderly65Plus: boolean;
  netIncome: number;
  calculationBase: number;
  grossEmploymentIncome: number;
  netPublicPensionIncome: number;
  elderlyPensionSpecialDeduction: number;
}

/**
 * Composed household-level NHI structure and statutory reduction inputs.
 */
export interface NHIHouseholdComposition {
  /** All members belonging to the 住民票 household (taxpayer + cohabiting dependents) */
  members: NHIHouseholdMember[];
  /** Designated household head (世帯主) */
  householdHead: NHIHouseholdMember;
  /** Whether the household head is a deemed head (擬制世帯主, not enrolled in NHI) */
  isDeemedHead: boolean;
  /** Taxpayer member reference */
  taxpayerMember: NHIHouseholdMember;
  /** Number of NHI-insured members */
  insuredCount: number;
  /** Number of NHI-insured members aged 40-64 */
  ltcInsuredCount: number;
  /** Number of NHI-insured preschool children under age 6 */
  preschoolCount: number;
  /** Number of NHI-insured children under 19 exempt from child support per-capita */
  childSupportExemptCount: number;
  /** Sum of premiumCalculationBase across all NHI-insured members */
  calculationBase: number;
  /** Sum of premiumCalculationBase across NHI-insured members aged 40-64 */
  ltcCalculationBase: number;
  /** Group evaluated for 7/5/2割 low-income reduction: household head + all NHI-insured members */
  reductionTestGroup: NHIHouseholdMember[];
  /** 軽減判定所得 across the reduction test group */
  reductionTestIncome: number;
  /** 給与所得者等の数 across the reduction test group */
  salaryEarnersCount: number;
  /** Region key to look up NHI parameters from */
  effectiveRegion: string;
  /** Configured payment attribution */
  paymentAttribution: NHIPaymentAttribution;
}

/**
 * Resolves whether a cohabiting dependent is enrolled in National Health Insurance in this household.
 *
 * Rules:
 * - Members who do not live together (isCohabiting === false) belong to a separate household
 * - Members aged 75 or older (後期高齢者医療制度) cannot be enrolled in NHI
 * - 'nhi': explicitly enrolled in NHI
 * - 'other': explicitly covered under Employees' Health Insurance or other system
 * - 'auto': follows the taxpayer's insurance (enrolled in NHI if taxpayer is on NHI, else not)
 */
export function resolveDependentNHIEnrollment(
  dependent: Dependent,
  taxpayerOnNHI: boolean,
): boolean {
  if (!dependent.isCohabiting) {
    return false;
  }
  // Age 75+ moves to Latter-Stage Elderly Healthcare System
  if (dependent.ageRange === '75plus') {
    return false;
  }
  const option = dependent.healthInsurance ?? 'auto';
  if (option === 'nhi') {
    return true;
  }
  if (option === 'other') {
    return false;
  }
  return taxpayerOnNHI;
}

/**
 * Resolves the effective NHI region parameter key.
 */
export function resolveEffectiveNHIRegion(
  provider: HealthInsuranceProviderId,
  region: string,
  nhiHouseholdRegion?: string,
): string {
  if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
    return region;
  }
  if (nhiHouseholdRegion && NATIONAL_HEALTH_INSURANCE_REGIONS.includes(nhiHouseholdRegion)) {
    return nhiHouseholdRegion;
  }
  if (NATIONAL_HEALTH_INSURANCE_REGIONS.includes(region)) {
    return region;
  }
  return 'Tokyo';
}

export interface ComposeNHIHouseholdParams {
  taxpayer: {
    netIncome: number;
    grossEmploymentIncome: number;
    netPublicPensionIncome: number;
    ageRange: TaxpayerAgeRange;
    provider: HealthInsuranceProviderId;
    region: string;
  };
  dependents: readonly Dependent[];
  incomeYear: number;
  paymentAttribution?: NHIPaymentAttribution | undefined;
  nhiHouseholdRegion?: string | undefined;
}

/**
 * Assembles the full NHI household composition, resolving enrollment, deemed household head,
 * portion calculation bases, and the low-income reduction test group.
 */
export function composeNHIHousehold(params: ComposeNHIHouseholdParams): NHIHouseholdComposition {
  const { taxpayer, dependents, incomeYear } = params;
  const taxpayerOnNHI =
    taxpayer.provider === NATIONAL_HEALTH_INSURANCE_ID &&
    isNationalHealthInsuranceEligible(taxpayer.ageRange);

  const taxpayerIs65Plus = taxpayerAgeCoversBand(
    taxpayer.ageRange,
    STATUTORY_AGE_BANDS.publicPensionDeductionElderly,
  );
  const taxpayerElderlyPensionAdj = taxpayerIs65Plus
    ? Math.min(taxpayer.netPublicPensionIncome, NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION)
    : 0;

  // Check if any cohabiting dependent is designated as household head
  const cohabitingDependents = dependents.filter(d => d.isCohabiting);
  const designatedHeadDep = cohabitingDependents.find(d => d.isHouseholdHead === true);

  const taxpayerMember: NHIHouseholdMember = {
    id: 'taxpayer',
    relationship: 'taxpayer',
    isTaxpayer: true,
    isCohabiting: true,
    isHouseholdHead: designatedHeadDep === undefined,
    isNHIInsured: taxpayerOnNHI,
    isLtcCat2: isLongTermCareCategory2Insured(taxpayer.ageRange),
    isPreschool: false,
    isChildSupportExempt: taxpayer.ageRange === 'under18',
    isElderly65Plus: taxpayerIs65Plus,
    netIncome: taxpayer.netIncome,
    calculationBase: premiumCalculationBase(taxpayer.netIncome),
    grossEmploymentIncome: taxpayer.grossEmploymentIncome,
    netPublicPensionIncome: taxpayer.netPublicPensionIncome,
    elderlyPensionSpecialDeduction: taxpayerElderlyPensionAdj,
  };

  const members: NHIHouseholdMember[] = [taxpayerMember];

  for (const dep of cohabitingDependents) {
    const isNHIInsured = resolveDependentNHIEnrollment(dep, taxpayerOnNHI);
    const isHead = designatedHeadDep !== undefined && dep.id === designatedHeadDep.id;
    const isLtcCat2 =
      dep.relationship === 'spouse'
        ? dependentAgeCoversBand(dep.ageRange, SPOUSE_AGE_BANDS.longTermCareCategory2)
        : dependentAgeCoversBand(dep.ageRange, DEPENDENT_AGE_BANDS.longTermCareCategory2);
    const isPreschool =
      dep.relationship !== 'spouse' &&
      dependentAgeCoversBand(dep.ageRange, DEPENDENT_AGE_BANDS.nhiPreschool);
    const isChildSupportExempt =
      dep.relationship !== 'spouse' &&
      dependentAgeCoversBand(dep.ageRange, DEPENDENT_AGE_BANDS.nhiChildSupportExempt);
    const isElderly65Plus =
      dep.relationship === 'spouse'
        ? dependentAgeCoversBand(dep.ageRange, SPOUSE_AGE_BANDS.publicPensionDeductionElderly)
        : dependentAgeCoversBand(dep.ageRange, DEPENDENT_AGE_BANDS.publicPensionDeductionElderly);

    const netIncome = calculateDependentTotalNetIncome(dep, incomeYear);
    const netPublicPensionIncome = calculateDependentNetPublicPensionIncome(dep, incomeYear);
    const elderlyPensionSpecialDeduction = isElderly65Plus
      ? Math.min(netPublicPensionIncome, NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION)
      : 0;

    members.push({
      id: dep.id,
      relationship: dep.relationship,
      isTaxpayer: false,
      isCohabiting: true,
      isHouseholdHead: isHead,
      isNHIInsured,
      isLtcCat2,
      isPreschool,
      isChildSupportExempt,
      isElderly65Plus,
      netIncome,
      calculationBase: premiumCalculationBase(netIncome),
      grossEmploymentIncome: dep.income.grossEmploymentIncome,
      netPublicPensionIncome,
      elderlyPensionSpecialDeduction,
    });
  }

  const householdHead = members.find(m => m.isHouseholdHead) ?? taxpayerMember;
  const isDeemedHead = !householdHead.isNHIInsured;

  const insuredMembers = members.filter(m => m.isNHIInsured);
  const insuredCount = insuredMembers.length;
  const ltcInsuredCount = insuredMembers.filter(m => m.isLtcCat2).length;
  const preschoolCount = insuredMembers.filter(m => m.isPreschool).length;
  const childSupportExemptCount = insuredMembers.filter(m => m.isChildSupportExempt).length;

  const calculationBase = insuredMembers.reduce((sum, m) => sum + m.calculationBase, 0);
  const ltcCalculationBase = insuredMembers
    .filter(m => m.isLtcCat2)
    .reduce((sum, m) => sum + m.calculationBase, 0);

  // Reduction test group: household head (including deemed head) + all NHI-insured members
  const reductionTestGroupMap = new Map<string, NHIHouseholdMember>();
  reductionTestGroupMap.set(householdHead.id, householdHead);
  for (const m of insuredMembers) {
    reductionTestGroupMap.set(m.id, m);
  }
  const reductionTestGroup = Array.from(reductionTestGroupMap.values());

  const reductionTestIncome = reductionTestGroup.reduce(
    (sum, m) => sum + (m.netIncome - m.elderlyPensionSpecialDeduction),
    0,
  );

  const salaryEarnersCount = reductionTestGroup.filter(m => {
    const adjustedPension = m.netPublicPensionIncome - m.elderlyPensionSpecialDeduction;
    return (
      m.grossEmploymentIncome > NHI_SALARY_EARNER_GROSS_EMPLOYMENT_THRESHOLD || adjustedPension > 0
    );
  }).length;

  const effectiveRegion = resolveEffectiveNHIRegion(
    taxpayer.provider,
    taxpayer.region,
    params.nhiHouseholdRegion,
  );

  return {
    members,
    householdHead,
    isDeemedHead,
    taxpayerMember,
    insuredCount,
    ltcInsuredCount,
    preschoolCount,
    childSupportExemptCount,
    calculationBase,
    ltcCalculationBase,
    reductionTestGroup,
    reductionTestIncome,
    salaryEarnersCount,
    effectiveRegion,
    paymentAttribution: params.paymentAttribution ?? DEFAULT_NHI_PAYMENT_ATTRIBUTION,
  };
}
