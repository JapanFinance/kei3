// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROVIDER,
  DEPENDENT_COVERAGE_ID,
  LATTER_STAGE_ELDERLY_ID,
  NATIONAL_HEALTH_INSURANCE_ID,
} from '../types/healthInsurance';
import {
  DEFAULT_INCOME_YEAR,
  EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  type HighIncomeMinimumTaxResult,
  type HomeLoanTaxCreditResult,
  type TakeHomeInputs,
} from '../types/tax';
import {
  estimateFurusatoTemporaryIncome,
  evaluateOneStopIneligibilityReasons,
  getFurusatoOneStopOutOfPocketCost,
  getFurusatoOutOfPocketCost,
  isHighOutOfPocketCost,
  type OneStopEligibilityDerived,
} from '../utils/furusatoNozei';
import { calculateTaxes, totalSocialInsurancePaid } from '../utils/taxCalculations';
import { makeFurusatoNozeiDetails } from './fixtures/takeHomeResults';

const baseInputs = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [
    { id: 's1', type: 'salary' as const, amount: 6_000_000, frequency: 'annual' as const },
  ],
  ageRange: 'age20to39' as const,
  region: 'Tokyo',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: DEFAULT_INCOME_YEAR,
};

describe('getFurusatoOutOfPocketCost and isHighOutOfPocketCost', () => {
  it('computes total out-of-pocket cost including temporaryIncomeEffect', () => {
    const furusatoNozei = makeFurusatoNozeiDetails({
      limit: 2_101_000,
      incomeTaxReduction: 964_300,
      residenceTaxReduction: 1_134_600,
      temporaryIncomeEffect: { nationalIncomeTax: 40_400, residenceTax: 8_800, total: 49_200 },
    });

    expect(getFurusatoOutOfPocketCost(furusatoNozei)).toBe(51_300);
    expect(isHighOutOfPocketCost(getFurusatoOutOfPocketCost(furusatoNozei))).toBe(true);
  });

  it('flags costs above the ¥2,200 rounding margin', () => {
    const nominal = makeFurusatoNozeiDetails({
      limit: 77_000,
      incomeTaxReduction: 7_600,
      residenceTaxReduction: 67_300,
    });
    const highDonation = makeFurusatoNozeiDetails({
      limit: 98_000,
      incomeTaxReduction: 9_800,
      residenceTaxReduction: 76_400,
    });

    expect(isHighOutOfPocketCost(2_200)).toBe(false);
    expect(isHighOutOfPocketCost(2_201)).toBe(true);
    expect(isHighOutOfPocketCost(getFurusatoOutOfPocketCost(nominal))).toBe(false);
    expect(isHighOutOfPocketCost(getFurusatoOutOfPocketCost(highDonation))).toBe(true);
  });

  it('derives One-Stop out-of-pocket cost and high-cost warning when eligible', () => {
    const eligibleNominal = makeFurusatoNozeiDetails({
      limit: 98_000,
      incomeTaxReduction: 9_800,
      residenceTaxReduction: 76_400,
      oneStop: {
        eligible: true,
        residenceTaxDeclarationSpecialCredit: 19_605,
        municipalTaxCredit: 57_602,
        prefecturalTaxCredit: 38_401,
        residenceTaxReduction: 96_000,
      },
    });
    const eligibleHigh = makeFurusatoNozeiDetails({
      limit: 50_000,
      oneStop: {
        eligible: true,
        residenceTaxDeclarationSpecialCredit: 5_000,
        municipalTaxCredit: 28_800,
        prefecturalTaxCredit: 19_200,
        residenceTaxReduction: 40_000,
      },
    });
    const ineligible = makeFurusatoNozeiDetails({
      limit: 98_000,
      oneStop: { eligible: false, ineligibleReasons: ['medicalExpensesDeduction'] },
    });

    expect(getFurusatoOneStopOutOfPocketCost(eligibleNominal)).toBe(2_000);
    expect(isHighOutOfPocketCost(getFurusatoOneStopOutOfPocketCost(eligibleNominal)!)).toBe(false);
    expect(getFurusatoOneStopOutOfPocketCost(eligibleHigh)).toBe(10_000);
    expect(isHighOutOfPocketCost(getFurusatoOneStopOutOfPocketCost(eligibleHigh)!)).toBe(true);
    expect(getFurusatoOneStopOutOfPocketCost(ineligible)).toBeUndefined();
  });
});

describe('estimateFurusatoTemporaryIncome', () => {
  it('returns zeros for gift benefit and taxable income when donation amount is zero or negative', () => {
    expect(estimateFurusatoTemporaryIncome(0)).toEqual({
      estimatedGiftsValue: 0,
      estimatedShippingCost: 0,
      estimatedEconomicBenefit: 0,
      specialDeduction: 500_000,
      remainingDeductionAllowance: 500_000,
      netTemporaryIncome: 0,
      taxableTemporaryIncome: 0,
    });
    expect(estimateFurusatoTemporaryIncome(-10_000)).toEqual({
      estimatedGiftsValue: 0,
      estimatedShippingCost: 0,
      estimatedEconomicBenefit: 0,
      specialDeduction: 500_000,
      remainingDeductionAllowance: 500_000,
      netTemporaryIncome: 0,
      taxableTemporaryIncome: 0,
    });
  });

  it('estimates gifts (26.5%) and shipping (5.7%), reconciles benefit, and tracks remaining allowance below ¥500,000', () => {
    const estimate = estimateFurusatoTemporaryIncome(60_000);

    expect(estimate.estimatedGiftsValue).toBe(15_900);
    expect(estimate.estimatedShippingCost).toBe(3_420);
    expect(estimate.estimatedEconomicBenefit).toBe(19_320);
    expect(estimate.estimatedGiftsValue + estimate.estimatedShippingCost).toBe(
      estimate.estimatedEconomicBenefit,
    );
    expect(estimate.remainingDeductionAllowance).toBe(480_680);
    expect(estimate.netTemporaryIncome).toBe(0);
    expect(estimate.taxableTemporaryIncome).toBe(0);
  });

  it('matches the ¥500,000 benefit threshold in the tax engine', () => {
    const below = estimateFurusatoTemporaryIncome(1_552_000);
    const above = estimateFurusatoTemporaryIncome(1_553_000);

    expect(below.estimatedEconomicBenefit).toBe(499_744);
    expect(below.netTemporaryIncome).toBe(0);
    expect(above.estimatedEconomicBenefit).toBe(500_066);
    expect(above.netTemporaryIncome).toBe(66);
  });

  it('floors ½ taxable temporary income to whole yen above ¥500,000', () => {
    const estimate = estimateFurusatoTemporaryIncome(1_553_005);

    expect(estimate.estimatedEconomicBenefit).toBe(500_067);
    expect(estimate.remainingDeductionAllowance).toBe(0);
    expect(estimate.netTemporaryIncome).toBe(67);
    expect(estimate.taxableTemporaryIncome).toBe(33);
  });

  it('computes incremental net and ½ taxable temporary income when prior temporary income shares the ¥500,000 deduction', () => {
    const straddling = estimateFurusatoTemporaryIncome(60_000, 490_000);
    const alreadyAbove = estimateFurusatoTemporaryIncome(60_000, 500_001);

    // 490,000 + 19,320 = 509,320 -> net = 9,320; ½ = 4,660
    expect(straddling.remainingDeductionAllowance).toBe(0);
    expect(straddling.netTemporaryIncome).toBe(9_320);
    expect(straddling.taxableTemporaryIncome).toBe(4_660);

    // Prior net = 1 (floor(1/2) = 0); with gifts net = 19,321 (floor(19,321/2) = 9,660)
    expect(alreadyAbove.netTemporaryIncome).toBe(19_320);
    expect(alreadyAbove.taxableTemporaryIncome).toBe(9_660);
  });
});

describe('taxCalculations Furusato Nozei temporary income integration', () => {
  it('leaves furusatoNozei.temporaryIncomeEffect undefined for typical incomes', () => {
    const results = calculateTaxes(baseInputs);

    expect(results.furusatoNozei.temporaryIncomeEffect).toBeUndefined();
  });

  it('computes exact furusatoNozei.temporaryIncomeEffect via the engine for high-limit salaries', () => {
    const highInputs = {
      ...baseInputs,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 55_000_000, frequency: 'annual' as const },
      ],
    };

    const results = calculateTaxes(highInputs);
    const limit = results.furusatoNozei.limit;
    const benefit = estimateFurusatoTemporaryIncome(limit);
    const withDonationOnly = calculateTaxes({ ...highInputs, furusatoDonation: limit });
    const withDonationAndTemp = calculateTaxes({
      ...highInputs,
      furusatoDonation: limit,
      temporaryIncome: benefit.estimatedEconomicBenefit,
    });

    expect(benefit.estimatedEconomicBenefit).toBeGreaterThan(500_000);
    expect(results.furusatoNozei.temporaryIncomeEffect).toEqual({
      nationalIncomeTax: withDonationAndTemp.nationalIncomeTax - withDonationOnly.nationalIncomeTax,
      residenceTax:
        withDonationAndTemp.residenceTax.totalResidenceTax -
        withDonationOnly.residenceTax.totalResidenceTax,
      total:
        withDonationAndTemp.nationalIncomeTax -
        withDonationOnly.nationalIncomeTax +
        (withDonationAndTemp.residenceTax.totalResidenceTax -
          withDonationOnly.residenceTax.totalResidenceTax),
    });
    expect(results.furusatoNozei.temporaryIncomeEffect!.socialInsurance).toBeUndefined();
    expect(results.furusatoNozei.temporaryIncomeEffect!.total).toBeGreaterThan(0);
  });

  it('satisfies exact telescoping out-of-pocket identity across bracket shifts with temporary income', () => {
    const bracketShiftInputs = {
      ...baseInputs,
      incomeStreams: [
        { id: 's1', type: 'salary' as const, amount: 44_000_000, frequency: 'annual' as const },
      ],
    };

    const baseline = calculateTaxes(bracketShiftInputs);
    const limit = baseline.furusatoNozei.limit;
    const benefit = estimateFurusatoTemporaryIncome(limit);
    const joint = calculateTaxes({
      ...bracketShiftInputs,
      furusatoDonation: limit,
      temporaryIncome: benefit.estimatedEconomicBenefit,
    });

    const exactJointOutOfPocket =
      limit +
      (joint.nationalIncomeTax - baseline.nationalIncomeTax) +
      (joint.residenceTax.totalResidenceTax - baseline.residenceTax.totalResidenceTax) +
      (totalSocialInsurancePaid(joint) - totalSocialInsurancePaid(baseline));

    expect(getFurusatoOutOfPocketCost(baseline.furusatoNozei)).toBe(exactJointOutOfPocket);
  });

  it('triggers temporaryIncomeEffect when pre-existing temporaryIncome and gift benefit together exceed ¥500,000', () => {
    // At ¥6M salary, limit is small (~¥77k, gift benefit ~¥25k < ¥500k alone), so ¥490k prior
    // temporary income straddles the shared ¥500,000 deduction (Income Tax Act Art. 34(3)).
    const straddlingInputs = { ...baseInputs, temporaryIncome: 490_000 };
    const aboveThresholdInputs = { ...baseInputs, temporaryIncome: 600_000 };

    const straddling = calculateTaxes(straddlingInputs);
    const above = calculateTaxes(aboveThresholdInputs);

    for (const [inputs, results] of [
      [straddlingInputs, straddling],
      [aboveThresholdInputs, above],
    ] as const) {
      const limit = results.furusatoNozei.limit;
      const benefit = estimateFurusatoTemporaryIncome(limit);
      expect(benefit.estimatedEconomicBenefit).toBeLessThan(500_000);
      expect(inputs.temporaryIncome + benefit.estimatedEconomicBenefit).toBeGreaterThan(500_000);

      const withDonationOnly = calculateTaxes({ ...inputs, furusatoDonation: limit });
      const withDonationAndTemp = calculateTaxes({
        ...inputs,
        furusatoDonation: limit,
        temporaryIncome: inputs.temporaryIncome + benefit.estimatedEconomicBenefit,
      });

      const nationalDelta =
        withDonationAndTemp.nationalIncomeTax - withDonationOnly.nationalIncomeTax;
      const residenceDelta =
        withDonationAndTemp.residenceTax.totalResidenceTax -
        withDonationOnly.residenceTax.totalResidenceTax;
      const siDelta =
        totalSocialInsurancePaid(withDonationAndTemp) - totalSocialInsurancePaid(withDonationOnly);

      expect(results.furusatoNozei.temporaryIncomeEffect).toEqual({
        nationalIncomeTax: nationalDelta,
        residenceTax: residenceDelta,
        ...(siDelta !== 0 && { socialInsurance: siDelta }),
        total: nationalDelta + residenceDelta + siDelta,
      });
      expect(results.furusatoNozei.temporaryIncomeEffect!.total).toBeGreaterThan(0);
    }
  });

  it('includes NHI social insurance increase and preserves exact telescoping identity below NHI cap', () => {
    const nhiInputs = {
      ...baseInputs,
      incomeStreams: [{ id: 'b1', type: 'business' as const, amount: 4_000_000 }],
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      temporaryIncome: 500_000,
    };

    const baseline = calculateTaxes(nhiInputs);
    const limit = baseline.furusatoNozei.limit;
    const benefit = estimateFurusatoTemporaryIncome(limit);
    const withDonationOnly = calculateTaxes({ ...nhiInputs, furusatoDonation: limit });
    const withDonationAndTemp = calculateTaxes({
      ...nhiInputs,
      furusatoDonation: limit,
      temporaryIncome: nhiInputs.temporaryIncome + benefit.estimatedEconomicBenefit,
    });

    const siDelta =
      totalSocialInsurancePaid(withDonationAndTemp) - totalSocialInsurancePaid(withDonationOnly);
    expect(siDelta).toBeGreaterThan(0);
    expect(baseline.furusatoNozei.temporaryIncomeEffect?.socialInsurance).toBe(siDelta);

    const exactJointOutOfPocket =
      limit +
      (withDonationAndTemp.nationalIncomeTax - baseline.nationalIncomeTax) +
      (withDonationAndTemp.residenceTax.totalResidenceTax -
        baseline.residenceTax.totalResidenceTax) +
      (totalSocialInsurancePaid(withDonationAndTemp) - totalSocialInsurancePaid(baseline));
    expect(getFurusatoOutOfPocketCost(baseline.furusatoNozei)).toBe(exactJointOutOfPocket);
  });

  it('includes Latter-Stage Elderly (75+) and LTC Category 1 social insurance increase below cap', () => {
    const elderlyInputs = {
      ...baseInputs,
      ageRange: 'age75plus' as const,
      incomeStreams: [
        {
          id: 'p1',
          type: 'publicPension' as const,
          amount: 4_500_000,
          payerDomicile: 'domestic' as const,
          foreignTax: 0,
        },
      ],
      healthInsuranceProvider: LATTER_STAGE_ELDERLY_ID,
      temporaryIncome: 500_000,
    };

    const baseline = calculateTaxes(elderlyInputs);
    const limit = baseline.furusatoNozei.limit;
    const benefit = estimateFurusatoTemporaryIncome(limit);
    const withDonationOnly = calculateTaxes({ ...elderlyInputs, furusatoDonation: limit });
    const withDonationAndTemp = calculateTaxes({
      ...elderlyInputs,
      furusatoDonation: limit,
      temporaryIncome: elderlyInputs.temporaryIncome + benefit.estimatedEconomicBenefit,
    });

    const siDelta =
      totalSocialInsurancePaid(withDonationAndTemp) - totalSocialInsurancePaid(withDonationOnly);
    expect(siDelta).toBeGreaterThan(0);
    expect(baseline.furusatoNozei.temporaryIncomeEffect?.socialInsurance).toBe(siDelta);

    const exactJointOutOfPocket =
      limit +
      (withDonationAndTemp.nationalIncomeTax - baseline.nationalIncomeTax) +
      (withDonationAndTemp.residenceTax.totalResidenceTax -
        baseline.residenceTax.totalResidenceTax) +
      (totalSocialInsurancePaid(withDonationAndTemp) - totalSocialInsurancePaid(baseline));
    expect(getFurusatoOutOfPocketCost(baseline.furusatoNozei)).toBe(exactJointOutOfPocket);
  });

  it('preserves negative tax deltas without clamping at a 65+ LTC Category 1 tier cliff', () => {
    // Business net income ¥5,199,500 sits ¥500 below the LTC Category 1 Tier 11 bound (¥5,200,000).
    // With ¥460,000 prior temporary income, the gift benefit (~¥48k) nudges total temporary income
    // just past ¥500,000 (~¥4k taxable), crossing into Tier 11 (¥17,900 Osaka premium jump),
    // which exceeds the taxable income increase and lowers both income and residence tax.
    const ltcCliffInputs = {
      ...baseInputs,
      ageRange: 'age65to69' as const,
      region: 'Osaka',
      incomeStreams: [{ id: 'b1', type: 'business' as const, amount: 5_199_500 }],
      healthInsuranceProvider: DEPENDENT_COVERAGE_ID,
      temporaryIncome: 460_000,
    };

    const baseline = calculateTaxes(ltcCliffInputs);
    const limit = baseline.furusatoNozei.limit;
    const benefit = estimateFurusatoTemporaryIncome(limit);
    const joint = calculateTaxes({
      ...ltcCliffInputs,
      furusatoDonation: limit,
      temporaryIncome: ltcCliffInputs.temporaryIncome + benefit.estimatedEconomicBenefit,
    });
    const effect = baseline.furusatoNozei.temporaryIncomeEffect;

    expect(effect).toBeDefined();
    expect(effect!.socialInsurance).toBeGreaterThan(0);
    expect(effect!.nationalIncomeTax).toBeLessThan(0);
    expect(effect!.residenceTax).toBeLessThan(0);
    expect(effect!.total).toBe(
      effect!.nationalIncomeTax + effect!.residenceTax + (effect!.socialInsurance ?? 0),
    );

    const exactJointOutOfPocket =
      limit +
      (joint.nationalIncomeTax - baseline.nationalIncomeTax) +
      (joint.residenceTax.totalResidenceTax - baseline.residenceTax.totalResidenceTax) +
      (totalSocialInsurancePaid(joint) - totalSocialInsurancePaid(baseline));
    expect(getFurusatoOutOfPocketCost(baseline.furusatoNozei)).toBe(exactJointOutOfPocket);
  });

  it('computes exact furusatoNozei.temporaryIncomeEffect when high-income minimum tax applies', () => {
    const minTaxInputs = {
      ...baseInputs,
      incomeStreams: [
        {
          id: 'cg1',
          type: 'capitalGains' as const,
          amount: 1_500_000_000,
          shareType: 'listed' as const,
          account: 'domesticNoWithholding' as const,
        },
      ],
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 0,
    };

    const results = calculateTaxes(minTaxInputs);
    const limit = results.furusatoNozei.limit;
    const benefit = estimateFurusatoTemporaryIncome(limit);
    const withDonationOnly = calculateTaxes({ ...minTaxInputs, furusatoDonation: limit });
    const withDonationAndTemp = calculateTaxes({
      ...minTaxInputs,
      furusatoDonation: limit,
      temporaryIncome: benefit.estimatedEconomicBenefit,
    });

    expect(results.highIncomeMinimumTax).toBeDefined();
    expect(results.furusatoNozei.temporaryIncomeEffect).toEqual({
      nationalIncomeTax: withDonationAndTemp.nationalIncomeTax - withDonationOnly.nationalIncomeTax,
      residenceTax:
        withDonationAndTemp.residenceTax.totalResidenceTax -
        withDonationOnly.residenceTax.totalResidenceTax,
      total:
        withDonationAndTemp.nationalIncomeTax -
        withDonationOnly.nationalIncomeTax +
        (withDonationAndTemp.residenceTax.totalResidenceTax -
          withDonationOnly.residenceTax.totalResidenceTax),
    });
  });
});

describe('evaluateOneStopIneligibilityReasons', () => {
  const baseEligibilityInputs: Pick<
    TakeHomeInputs,
    'incomeStreams' | 'dcPlanContributions' | 'homeLoanTaxCredit' | 'incomeYear'
  > = {
    incomeStreams: [{ id: 's1', type: 'salary', amount: 6_000_000, frequency: 'annual' }],
    dcPlanContributions: 0,
    incomeYear: 2026,
  };

  const baseDerived: OneStopEligibilityDerived = {
    giftTemporaryIncome: estimateFurusatoTemporaryIncome(60_000),
    hasEmploymentIncome: true,
    grossEmploymentIncome: 6_000_000,
    netEmploymentIncome: 4_360_000,
    grossPublicPensionIncome: 0,
    netPublicPensionIncome: 0,
    netBusinessAndMiscIncome: 0,
    businessBlueFilerDeduction: 0,
    hasSeparateReportedInvestment: false,
    aggregateDividends: 0,
    aggregateInterest: 0,
    additionalDeductions: { national: 0, residence: 0, items: [] },
    familyNationalPension: undefined,
    homeLoanTaxCredit: undefined,
    foreignTax: 0,
    highIncomeMinimumTax: undefined,
  };

  const appliedHomeLoanResult: HomeLoanTaxCreditResult = {
    availableCredit: 200_000,
    appliedToIncomeTax: 200_000,
    appliedToResidenceTax: 0,
    unusedCredit: 0,
    warnings: [],
  };

  const rejectedHomeLoanResult: HomeLoanTaxCreditResult = {
    availableCredit: 0,
    appliedToIncomeTax: 0,
    appliedToResidenceTax: 0,
    unusedCredit: 0,
    warnings: ['rejected'],
  };

  it('returns empty array for an ordinary salary earner with non-taxable gift benefit', () => {
    expect(evaluateOneStopIneligibilityReasons(baseEligibilityInputs, baseDerived)).toEqual([]);
  });

  it('enforces exact statutory thresholds for salary, pension, and combined net income', () => {
    const atThresholds = evaluateOneStopIneligibilityReasons(baseEligibilityInputs, {
      ...baseDerived,
      grossEmploymentIncome: 20_000_000,
      netEmploymentIncome: 18_050_000,
      grossPublicPensionIncome: 4_000_000,
      netPublicPensionIncome: 0,
    });
    const overThresholds = evaluateOneStopIneligibilityReasons(baseEligibilityInputs, {
      ...baseDerived,
      grossEmploymentIncome: 20_000_001,
      netEmploymentIncome: 18_050_001,
      grossPublicPensionIncome: 4_000_001,
      netPublicPensionIncome: 1,
    });

    expect(atThresholds).toEqual([]);
    expect(overThresholds).toEqual([
      'employmentIncomeOverThreshold',
      'publicPensionOverThreshold',
      'employmentAndPublicPension',
    ]);
  });

  it('detects all statutory income, deduction, and tax credit disqualifiers', () => {
    const reasons = evaluateOneStopIneligibilityReasons(
      {
        ...baseEligibilityInputs,
        incomeStreams: [
          { id: 're1', type: 'realEstate', amount: 250_000, location: 'domestic', foreignTax: 0 },
          { id: 'sc1', type: 'stockCompensation', amount: 1_000_000, issuerDomicile: 'foreign' },
          {
            id: 'pp1',
            type: 'publicPension',
            amount: 1_500_000,
            payerDomicile: 'foreign',
            treatyCredit: 'unavailable',
            foreignTax: 0,
          },
        ],
        homeLoanTaxCredit: { moveInYear: 2026, creditAmount: 200_000 },
      },
      {
        ...baseDerived,
        giftTemporaryIncome: {
          ...baseDerived.giftTemporaryIncome,
          netTemporaryIncome: 100_000,
          taxableTemporaryIncome: 50_000,
        },
        netBusinessAndMiscIncome: -100_000,
        businessBlueFilerDeduction: 100_000,
        hasSeparateReportedInvestment: true,
        additionalDeductions: {
          national: 50_000,
          residence: 50_000,
          items: [{ key: 'medical', national: 50_000, residence: 50_000 }],
        },
        homeLoanTaxCredit: appliedHomeLoanResult,
        foreignTax: 10_000,
        highIncomeMinimumTax: {} as HighIncomeMinimumTaxResult,
      },
    );

    expect(reasons).toEqual([
      'taxableTemporaryIncome',
      'businessOrMiscIncome',
      'realEstateIncome',
      'foreignStockCompensation',
      'foreignPublicPension',
      'reportedInvestmentIncome',
      'medicalExpensesDeduction',
      'homeLoanFirstYear',
      'foreignTaxCredit',
      'highIncomeMinimumTax',
    ]);
  });

  it('flags pensioner unwithheld deductions when not employed and ignores Year 2+ home loan', () => {
    const pensionerWithIdeco = evaluateOneStopIneligibilityReasons(
      {
        ...baseEligibilityInputs,
        dcPlanContributions: 120_000,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 200_000 },
      },
      {
        ...baseDerived,
        hasEmploymentIncome: false,
        grossEmploymentIncome: 0,
        netEmploymentIncome: 0,
        grossPublicPensionIncome: 3_500_000,
        netPublicPensionIncome: 2_400_000,
        homeLoanTaxCredit: appliedHomeLoanResult,
      },
    );
    const salaryYear2HomeLoan = evaluateOneStopIneligibilityReasons(
      {
        ...baseEligibilityInputs,
        homeLoanTaxCredit: { moveInYear: 2024, creditAmount: 200_000 },
      },
      {
        ...baseDerived,
        homeLoanTaxCredit: appliedHomeLoanResult,
      },
    );

    expect(pensionerWithIdeco).toEqual(['pensionerUnwithheldDeductions']);
    expect(salaryYear2HomeLoan).toEqual([]);
  });

  it('ignores zero-amount real estate streams, rejected home loan credits, and 1-yen temporary income rounding to ¥0', () => {
    const zeroRealEstate = evaluateOneStopIneligibilityReasons(
      {
        ...baseEligibilityInputs,
        incomeStreams: [
          ...baseEligibilityInputs.incomeStreams,
          { id: 're-zero', type: 'realEstate', amount: 0, location: 'domestic', foreignTax: 0 },
        ],
      },
      baseDerived,
    );
    const nonzeroRealEstateWithForeignTaxOnly = evaluateOneStopIneligibilityReasons(
      {
        ...baseEligibilityInputs,
        incomeStreams: [
          ...baseEligibilityInputs.incomeStreams,
          { id: 're-ft', type: 'realEstate', amount: 0, location: 'foreign', foreignTax: 5_000 },
        ],
      },
      baseDerived,
    );
    const rejectedYear1HomeLoan = evaluateOneStopIneligibilityReasons(
      {
        ...baseEligibilityInputs,
        homeLoanTaxCredit: { moveInYear: 2026, creditAmount: 200_000 },
      },
      {
        ...baseDerived,
        homeLoanTaxCredit: rejectedHomeLoanResult,
      },
    );
    const oneYenNetTempIncome = evaluateOneStopIneligibilityReasons(baseEligibilityInputs, {
      ...baseDerived,
      giftTemporaryIncome: {
        ...baseDerived.giftTemporaryIncome,
        netTemporaryIncome: 1,
        taxableTemporaryIncome: 0,
      },
    });

    expect(zeroRealEstate).toEqual([]);
    expect(nonzeroRealEstateWithForeignTaxOnly).toEqual(['realEstateIncome']);
    expect(rejectedYear1HomeLoan).toEqual([]);
    expect(oneYenNetTempIncome).toEqual([]);
  });
});
