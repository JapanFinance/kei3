// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NATIONAL_HEALTH_INSURANCE_REGIONS } from '../data/nationalHealthInsurance/nhiParamsData';
import {
  getNHIPremiumReductionThresholdsForMonth,
  NHI_ELDERLY_PENSION_REDUCTION_SPECIAL_DEDUCTION,
} from '../data/nationalHealthInsurance/nhiPremiumReduction';
import { calculateResidenceTaxBasicDeduction } from '../data/residenceTaxBasicDeduction';
import type { Dependent } from '../types/dependents';
import { DEPENDENT_AGE_BANDS, SPOUSE_AGE_BANDS, dependentAgeCoversBand } from '../types/dependents';
import type {
  HealthInsuranceProviderId,
  NHIHouseholdComposition,
  NHIHouseholdMember,
  NHIPaymentAttribution,
} from '../types/healthInsurance';
import {
  DEFAULT_NHI_PAYMENT_ATTRIBUTION,
  LATTER_STAGE_ELDERLY_ID,
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
 * Counts salary and public-pension earners (給与所得者等の数) in the reduction test group against
 * a fiscal year's gross employment threshold (国民健康保険法施行令第29条の7第5項第1号).
 */
export function countNHISalaryEarners(
  reductionTestGroup: ReadonlyArray<
    Pick<
      NHIHouseholdMember,
      'grossEmploymentIncome' | 'netPublicPensionIncome' | 'elderlyPensionSpecialDeduction'
    >
  >,
  salaryEarnerGrossThreshold: number,
): number {
  return reductionTestGroup.filter(m => {
    const adjustedPension = m.netPublicPensionIncome - m.elderlyPensionSpecialDeduction;
    return m.grossEmploymentIncome > salaryEarnerGrossThreshold || adjustedPension > 0;
  }).length;
}

/**
 * Resolves whether a same-household dependent is enrolled in National Health Insurance in this household.
 *
 * Rules:
 * - Members who are not in the same municipal household (isSameHousehold === false) belong to a separate household
 * - Members aged 75 or older (後期高齢者医療制度) cannot be enrolled in NHI
 * - 'nhi': explicitly enrolled in NHI
 * - 'non_nhi': explicitly covered under Employees' Health Insurance or other system
 * - 'auto': follows the taxpayer's insurance (enrolled in NHI if taxpayer is on NHI, else not)
 */
export function resolveDependentNHIEnrollment(
  dependent: Dependent,
  taxpayerOnNHI: boolean,
): boolean {
  if (!dependent.isSameHousehold) {
    return false;
  }
  // Age 75+ moves to Latter-Stage Elderly Healthcare System
  if (dependent.ageRange === '75plus') {
    return false;
  }
  const option = dependent.healthInsurance;
  if (option === 'nhi') {
    return true;
  }
  if (option === 'non_nhi') {
    return false;
  }
  return taxpayerOnNHI;
}

/**
 * Returns a descriptive label for a dependent's automatic ('auto') health insurance option
 * based on the taxpayer's health insurance provider.
 */
export function getAutoHealthInsuranceLabel(
  provider?: HealthInsuranceProviderId,
  isTaxpayerNHI?: boolean,
): string {
  if (isTaxpayerNHI) {
    return 'Same as taxpayer (NHI)';
  }
  if (provider === LATTER_STAGE_ELDERLY_ID) {
    return 'Other / non-NHI';
  }
  return 'Same as taxpayer (EHI)';
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

  // Check if any same-household dependent is designated as household head
  const sameHouseholdDependents = dependents.filter(d => d.isSameHousehold);
  const designatedHeadDep = sameHouseholdDependents.find(d => d.isHouseholdHead);

  const taxpayerMember: NHIHouseholdMember = {
    id: 'taxpayer',
    relationship: 'taxpayer',
    isTaxpayer: true,
    isSameHousehold: true,
    isHouseholdHead: designatedHeadDep === undefined,
    isNHIInsured: taxpayerOnNHI,
    isLtcCat2: isLongTermCareCategory2Insured(taxpayer.ageRange),
    isPreschool: false,
    isChildSupportExempt: taxpayer.ageRange === 'under18',
    isElderly65Plus: taxpayerIs65Plus,
    netIncome: taxpayer.netIncome,
    basicDeduction: calculateResidenceTaxBasicDeduction(taxpayer.netIncome),
    calculationBase: premiumCalculationBase(taxpayer.netIncome),
    grossEmploymentIncome: taxpayer.grossEmploymentIncome,
    netPublicPensionIncome: taxpayer.netPublicPensionIncome,
    elderlyPensionSpecialDeduction: taxpayerElderlyPensionAdj,
  };

  const members: NHIHouseholdMember[] = [taxpayerMember];

  for (const dep of sameHouseholdDependents) {
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
      isSameHousehold: true,
      isHouseholdHead: isHead,
      isNHIInsured,
      isLtcCat2,
      isPreschool,
      isChildSupportExempt,
      isElderly65Plus,
      netIncome,
      basicDeduction: calculateResidenceTaxBasicDeduction(netIncome),
      calculationBase: premiumCalculationBase(netIncome),
      grossEmploymentIncome: dep.income.grossEmploymentIncome,
      netPublicPensionIncome,
      elderlyPensionSpecialDeduction,
    });
  }

  const householdHead = members.find(m => m.isHouseholdHead) ?? taxpayerMember;
  const isDeemedHead = !householdHead.isNHIInsured;

  // Note on limitation: members who moved from NHI into the 75+ Latter-Stage Elderly Healthcare
  // scheme (特定同一世帯所属者) continue to count toward the 5割/2割 reduction thresholds under
  // 国民健康保険法施行令第29条の7第5項第1号. Currently, 75+ members (including a 75+ deemed-head
  // taxpayer) are excluded from insuredCount.
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

  const prevFYThresholds = getNHIPremiumReductionThresholdsForMonth(incomeYear, 0);
  const currFYThresholds = getNHIPremiumReductionThresholdsForMonth(incomeYear, 3);
  const salaryEarnersCounts = {
    prevFY: countNHISalaryEarners(reductionTestGroup, prevFYThresholds.salaryEarnerGrossThreshold),
    currFY: countNHISalaryEarners(reductionTestGroup, currFYThresholds.salaryEarnerGrossThreshold),
  };

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
    salaryEarnersCounts,
    effectiveRegion,
    paymentAttribution: params.paymentAttribution ?? DEFAULT_NHI_PAYMENT_ATTRIBUTION,
  };
}
