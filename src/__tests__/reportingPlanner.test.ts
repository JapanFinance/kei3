// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import {
  DEFAULT_REPORTED_DIVIDENDS_TAXATION,
  EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  type CapitalGainsIncomeStream,
  type DividendsIncomeStream,
  type IncomeStream,
  type InterestIncomeStream,
  type TakeHomeInputs,
  type WithholdingAccountIncomeStream,
} from '../types/tax';
import {
  allReportedPlan,
  countPlans,
  currentPlan,
  deriveReportingUnits,
  descend,
  describePlan,
  evaluatePlan,
  generatePlans,
  hasOptionalUnit,
  isBetterPlan,
  mandatoryReportingNote,
  neighbourPlans,
  withheldOnlyPlan,
  type EvaluatedPlan,
  type PlanEvaluation,
  type ReportingPlan,
  type ReportingUnit,
} from '../utils/reportingPlanner';

const account = (
  overrides: Partial<WithholdingAccountIncomeStream> & Pick<WithholdingAccountIncomeStream, 'id'>,
): WithholdingAccountIncomeStream => ({
  type: 'withholdingAccount',
  capitalGains: 0,
  dividends: 0,
  reportsCapitalGains: false,
  reportsDividends: false,
  ...overrides,
});

const dividend = (
  overrides: Partial<DividendsIncomeStream> & Pick<DividendsIncomeStream, 'id'>,
): DividendsIncomeStream => ({
  type: 'dividends',
  shareType: 'listed',
  paymentChannel: 'domestic',
  isReported: false,
  amount: 0,
  ...overrides,
});

const outsideSale = (id: string, amount = 500_000): CapitalGainsIncomeStream => ({
  id,
  type: 'capitalGains',
  shareType: 'listed',
  account: 'domesticNoWithholding',
  amount,
});

const domesticInterest = (id: string, amount = 100_000): InterestIncomeStream => ({
  id,
  type: 'interest',
  payerDomicile: 'domestic',
  amount,
});

/**
 * A 協会けんぽ Tokyo employee, matching the taxCalculations.test.ts baseline at its default
 * 5,000,000-yen salary.
 */
const salaryInputs = (
  streams: IncomeStream[],
  { salary = 5_000_000, incomeYear = 2026 }: { salary?: number; incomeYear?: number } = {},
): TakeHomeInputs => ({
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [
    { id: 'salary', type: 'salary', amount: salary, frequency: 'annual' },
    ...streams,
  ],
  ageRange: 'age20to39',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear,
});

describe('deriveReportingUnits', () => {
  it('gives a gain-with-dividends account four states', () => {
    const units = deriveReportingUnits([
      account({ id: 'a', capitalGains: 500_000, dividends: 300_000 }),
    ]);
    expect(units).toHaveLength(1);
    expect(units[0]!.states).toHaveLength(4);
  });

  it('gives a loss-with-dividends account two states, never the 措法37条の11の6⑩ state', () => {
    const source = account({ id: 'a', capitalGains: -500_000, dividends: 300_000 });
    const units = deriveReportingUnits([source]);
    expect(units[0]!.states).toHaveLength(2);

    for (const state of units[0]!.states) {
      const applied = state.apply(source) as WithholdingAccountIncomeStream;
      // Reporting the loss without the dividends is the forbidden state; it must never appear.
      expect(applied.reportsCapitalGains && !applied.reportsDividends).toBe(false);
    }
  });

  it('gives an account with only a gain two states', () => {
    const units = deriveReportingUnits([account({ id: 'a', capitalGains: 500_000 })]);
    expect(units[0]!.states).toHaveLength(2);
  });

  it('gives an account with only dividends two states', () => {
    const units = deriveReportingUnits([account({ id: 'a', dividends: 300_000 })]);
    expect(units[0]!.states).toHaveLength(2);
  });

  it('gives an account with both figures at zero one state', () => {
    const units = deriveReportingUnits([account({ id: 'a' })]);
    expect(units[0]!.states).toHaveLength(1);
  });

  it('gives a domestic dividend with a nonzero amount two states', () => {
    const units = deriveReportingUnits([dividend({ id: 'd', amount: 300_000 })]);
    expect(units[0]!.states).toHaveLength(2);
  });

  it('gives a zero-amount domestic dividend one state', () => {
    const units = deriveReportingUnits([dividend({ id: 'd', amount: 0 })]);
    expect(units[0]!.states).toHaveLength(1);
  });

  it('fixes a dividend paid abroad to one, reported state', () => {
    const source = dividend({
      id: 'd',
      paymentChannel: 'abroad',
      amount: 300_000,
      isReported: false,
    });
    const units = deriveReportingUnits([source]);
    expect(units[0]!.states).toHaveLength(1);
    const applied = units[0]!.states[0]!.apply(source) as DividendsIncomeStream;
    expect(applied.isReported).toBe(true);
  });

  it('gives a sale outside a withholding account no unit at all: it is always reported', () => {
    expect(deriveReportingUnits([outsideSale('g')])).toHaveLength(0);
  });

  it('gives interest no unit at all: it is never reported', () => {
    expect(deriveReportingUnits([domesticInterest('i')])).toHaveLength(0);
  });
});

describe('countPlans', () => {
  it('equals the generator length on a mix of unit kinds, without the ⑩ state', () => {
    const streams: IncomeStream[] = [
      account({ id: 'a', capitalGains: -500_000, dividends: 300_000 }), // loss + dividends: 2 states
      account({ id: 'b', capitalGains: 800_000, dividends: 200_000 }), // gain + dividends: 4 states
      dividend({ id: 'd', amount: 100_000 }), // 2 states
      outsideSale('g'), // fixed, no unit
    ];
    const units = deriveReportingUnits(streams);
    const plans = [...generatePlans(streams, units)];

    expect(plans).toHaveLength(countPlans(units));
    for (const plan of plans) {
      const a = plan.streams[0] as WithholdingAccountIncomeStream;
      expect(a.reportsCapitalGains && !a.reportsDividends).toBe(false);
    }
  });

  it('is 1 when nothing among the streams can vary', () => {
    const streams: IncomeStream[] = [outsideSale('g'), domesticInterest('i')];
    const units = deriveReportingUnits(streams);
    expect(countPlans(units)).toBe(1);
    expect([...generatePlans(streams, units)]).toHaveLength(1);
  });

  it('doubles a single domestic dividend for the election, but not a withheld one', () => {
    const reported = deriveReportingUnits([dividend({ id: 'd', amount: 100_000 })]);
    // States: withheld (no dividend reported) and reported (a dividend reported) → 2*2 - 1 = 3.
    expect(countPlans(reported)).toBe(3);
  });
});

describe('search-space reduction', () => {
  it('keeps the same optimum on a two-account case whether or not the dominance and zero-amount reductions are applied', () => {
    const streams: IncomeStream[] = [
      account({ id: 'a', capitalGains: -500_000, dividends: 800_000 }),
      account({ id: 'b', capitalGains: 300_000, dividends: 150_000 }),
    ];
    const inputs = salaryInputs(streams);
    const prunedUnits = deriveReportingUnits(streams);

    // The unpruned space: both accounts get all four flag combinations, including the
    // 措法37条の11の6⑩ state (reporting the loss alone) and the state 7.3.1 finds dominated
    // (reporting the dividends alone). evaluatePlan corrects the ⑩ state through
    // withRequiredReporting rather than throwing, so it is safe to generate here.
    const allFourStates = (streamIndex: number): ReportingUnit => ({
      streamIndex,
      states: [false, true].flatMap(reportsCapitalGains =>
        [false, true].map(reportsDividends => ({
          reportsDividend: reportsDividends,
          apply: (stream: IncomeStream) => ({
            ...(stream as WithholdingAccountIncomeStream),
            reportsCapitalGains,
            reportsDividends,
          }),
        })),
      ),
    });
    const unprunedUnits: ReportingUnit[] = [allFourStates(0), allFourStates(1)];

    const bestKept = (units: ReportingUnit[]): number =>
      Math.max(
        ...[...generatePlans(streams, units)].map(plan => evaluatePlan(inputs, plan).figures.kept),
      );

    expect(bestKept(prunedUnits)).toBe(bestKept(unprunedUnits));
  });
});

describe('uniform plans reproduce the migrated comparison figures', () => {
  // The comparison this module replaces asserted these figures for 1,000,000 of domestic
  // dividends on the 5,000,000-yen employee (src/__tests__/investmentTreatmentComparison.test.ts,
  // now removed): 申告不要 kept 3,942,948 + 1,000,000 − 203,150, 申告分離課税 kept 4,739,848,
  // 総合課税 kept 6,000,000 − 186,000 − 343,100 − 722,252, furusato limits 61,000 / 74,000 /
  // 99,000. totalIncome (合計所得金額) is new here: the baseline 5,000,000-yen salary nets
  // 3,560,000 (給与所得控除 2026: floor(5,000,000 × 0.8) − 440,000), which the withheld case
  // leaves untouched and both reported cases raise by the full 1,000,000 — into
  // separateNetIncome.dividends for 申告分離課税, into aggregateDividendIncome for 総合課税, either
  // way added once into 合計所得金額.
  const streams: IncomeStream[] = [dividend({ id: 'd', amount: 1_000_000, isReported: true })];
  const inputs = salaryInputs(streams);
  const units = deriveReportingUnits(inputs.incomeStreams);

  it('withheld only', () => {
    const evaluated = evaluatePlan(inputs, withheldOnlyPlan(inputs, units));
    expect(evaluated.figures).toEqual({
      kept: 3_942_948 + 1_000_000 - 203_150,
      incomeTax: 91_700 + 153_150,
      residenceTax: 243_100 + 50_000,
      socialInsurance: 722_252,
      furusatoNozeiLimit: 61_000,
      totalIncome: 3_560_000,
    });
  });

  it('all reported, 申告分離課税', () => {
    const evaluated = evaluatePlan(inputs, allReportedPlan(inputs, units, 'separate'));
    expect(evaluated.figures).toEqual({
      kept: 4_739_848,
      incomeTax: 244_800,
      residenceTax: 293_100,
      socialInsurance: 722_252,
      furusatoNozeiLimit: 74_000,
      totalIncome: 4_560_000,
    });
  });

  it('all reported, 総合課税', () => {
    const evaluated = evaluatePlan(inputs, allReportedPlan(inputs, units, 'aggregate'));
    expect(evaluated.figures).toEqual({
      kept: 6_000_000 - 186_000 - 343_100 - 722_252,
      incomeTax: 186_000,
      residenceTax: 343_100,
      socialInsurance: 722_252,
      furusatoNozeiLimit: 99_000,
      totalIncome: 4_560_000,
    });
  });

  it('omits the withheld-only plan from consideration only when there is no optional unit', () => {
    expect(hasOptionalUnit(units)).toBe(true);
    expect(hasOptionalUnit(deriveReportingUnits([outsideSale('g')]))).toBe(false);
  });
});

describe('a mixed plan can beat every uniform plan', () => {
  // Salary 1,000,000, income year 2026, 協会けんぽ, Tokyo, age 20-39, no dependents or other
  // deductions. Two withholding accounts, each a gain only (no dividends, so the
  // 申告分離課税/総合課税 election never applies — nothing here is ever a reported dividend):
  // account A a modest 800,000 gain, account B a large 10,000,000 gain. Every figure below is
  // derived from the statute and the app's own data tables; the engine is used only to confirm
  // them, never as the source of the expectation.
  //
  // 給与所得: for 2026 the 給与所得控除 is a flat 740,000 for gross salary up to 2,190,999
  // (netEmploymentIncome.ts's 2026 period: the 690,000 floor of 所法28条③ plus the 50,000 of
  // 措法29条の4); 1,000,000 − 740,000 = 260,000. Call this E.
  //
  // Social insurance (identical in every plan below: calculateHealthInsuranceBreakdown and
  // calculatePensionBreakdown key on salaryIncome alone, never on investment income):
  //  - health: monthly income 1,000,000/12 ≈ 83,333 falls in the ¥83,000–93,000 SMR bracket
  //    (grade 4, SMR 88,000 — employeesHealthInsurance/smrBrackets.ts). Tokyo's 協会けんぽ
  //    employee rate (providerRateData.ts, periods keyed by paycheck month) is 4.955% for the
  //    January–March 2026 paychecks (the period from April 2025), 4.925% for April 2026, and
  //    5.04% from May 2026. Monthly premiums (roundSocialInsurancePremium, halfTrunc):
  //    round(88,000 × 0.04955 = 4,360.4) = 4,360 × 3 = 13,080; round(88,000 × 0.04925 =
  //    4,334.0) = 4,334 × 1; round(88,000 × 0.0504 = 4,435.2) = 4,435 × 8 = 35,480; annual =
  //    13,080 + 4,334 + 35,480 = 52,894. Age 20–39 adds no 介護保険 rate.
  //  - pension: the same 88,000 SMR is Employees' Pension's bottom bracket (0–93,000,
  //    pensionCalculator.ts). Employee half of the flat 18.3% is 9.15%; 88,000 × 0.0915 = 8,052.0
  //    exactly; annual = 8,052 × 12 = 96,624.
  //  - employment insurance (employmentInsurance.ts): 0.55% for the January–March 2026
  //    paychecks and 0.5% from April 2026. round((1,000,000/12) × 0.0055 = 458.33) = 458 × 3 =
  //    1,374; round((1,000,000/12) × 0.005 = 416.67) = 417 × 9 = 3,753; annual = 5,127.
  //  - total S = 52,894 + 96,624 + 5,127 = 154,645.
  //
  // National basic deduction (2026 period, nationalBasicDeduction.ts), by 合計所得金額 (=E+
  // reported gains): ≤1,320,000 → 1,040,000; … ≤6,550,000 → 670,000; ≤23,500,000 → 620,000.
  // Residence basic deduction is a flat 430,000 regardless of year
  // (residenceTaxBasicDeduction.ts); the 0-dependent non-taxable limit is 450,000
  // (residenceTax.ts's getResidenceTaxExemptionLimits, both the 均等割 and 所得割 limits
  // coincide there).
  //
  // Deduction spillover (applyDeductionSpillover) always absorbs E=260,000 out of the aggregate
  // class first, since even the smallest pool at play (S + 620,000 = 774,645) exceeds it; what
  // is left of the pool then reduces the reported gain class. National: pool = S + basicTier;
  // residence: pool = S + 430,000 = 584,645, so residence always carries forward
  // 584,645 − 260,000 = 324,645 into the gain class.
  //
  // `kept` (TakeHomeResults.annualIncome, and so `kept`'s cash-received side) is the GROSS salary
  // received plus any reported gain, not E: 給与所得控除 is a notional deduction for the tax base,
  // not a real cost, so the money actually received and kept is gross. E is used only for the
  // deductions/tax computations above, never for the cash-flow side below.
  //
  // Withheld tax (calculateWithheldInvestmentTax, one truncation on the summed base): on 800,000,
  // floor(800,000 × 0.15315) = 122,520 and floor(800,000 × 0.05) = 40,000; on 10,000,000,
  // 1,531,500 and 500,000; on 10,800,000, floor(10,800,000 × 0.15315) = 1,654,020 and 540,000
  // (every product here is exact, and the data module's header confirms the rate needs no
  // integer-scaled arithmetic up to ¥50,000,000).
  //
  // Withheld (both accounts unreported): 合計所得金額 = E = 260,000 ≤ 450,000, so residence tax
  // is zero altogether (the isResidenceTaxExempt gate in residenceTax.ts) and the national
  // pool (S + 1,040,000) trivially absorbs E, so national tax is zero too.
  //   kept = (1,000,000 − 0 − 0 − 154,645) + 10,800,000 − (1,654,020 + 540,000)
  //        = 845,355 + 10,800,000 − 2,194,020 = 9,451,335.
  //
  // Reporting only account A (800,000): 合計所得金額 = 1,060,000, still in the first tier
  // (1,040,000 deduction). National: pool 154,645 + 1,040,000 = 1,194,645 exceeds E + 800,000 =
  // 1,060,000, so the reported gain is fully absorbed — national tax 0. Residence: gain class
  // after the 324,645 carried forward is 800,000 − 324,645 = 475,355, floored to 475,000;
  // 3%/2% gives 14,250/9,500, each floored to the nearest 100 → 14,200/9,500; + 5,000 per-capita =
  // 28,700. Withheld tax on the remaining 10,000,000 (account B): 1,531,500 and 500,000.
  //   kept = (1,000,000 + 800,000 − 0 − 28,700 − 154,645) + 10,000,000 − (1,531,500 + 500,000)
  //        = 1,616,655 + 10,000,000 − 2,031,500 = 9,585,155.
  //
  // Reporting only account B (10,000,000): 合計所得金額 = 10,260,000, in the ≤23,500,000 tier
  // (620,000 deduction). National: pool 154,645 + 620,000 = 774,645; gain class after
  // subtracting E = 10,000,000 − 514,645 = 9,485,355, floored to 9,485,000; × 15% = 1,422,750;
  // × 1.021 (復興税) = 1,452,627.75, floored to the nearest 100 → 1,452,600. Residence: gain
  // class 10,000,000 − 324,645 = 9,675,355, floored to 9,675,000; 3%/2% → 290,250/193,500, each
  // floored to 100 → 290,200/193,500; + 5,000 → 488,700. Withheld tax on the remaining 800,000
  // (account A): 122,520 and 40,000.
  //   kept = (1,000,000 + 10,000,000 − 1,452,600 − 488,700 − 154,645) + 800,000 − (122,520 + 40,000)
  //        = 8,904,055 + 800,000 − 162,520 = 9,541,535.
  //
  // Reporting both: 合計所得金額 = 11,060,000, the same ≤23,500,000 tier (620,000 — reporting
  // the modest gain on top of the large one does not move the tier again). National: gain class
  // 10,800,000 − 514,645 = 10,285,355, floored to 10,285,000; × 15% = 1,542,750; × 1.021 =
  // 1,575,147.75, floored to 1,575,100. Residence: gain class 10,800,000 − 324,645 = 10,475,355,
  // floored to 10,475,000; 3%/2% → 314,250/209,500, floored to 100 → 314,200/209,500; + 5,000 →
  // 528,700. Nothing withheld.
  //   kept = (1,000,000 + 10,800,000) − 1,575,100 − 528,700 − 154,645 = 9,541,555.
  //
  // So reporting only the modest gain (9,585,155) beats withholding both (9,451,335), reporting
  // only the large gain (9,541,535), and reporting both (9,541,555): at 合計所得金額 1,060,000 the
  // modest gain is absorbed whole by the unused deductions, whereas reporting the large gain
  // drops the basic deduction from 1,040,000 to 620,000 and leaves the rest taxed at 15.315% +
  // 5%, no better than the 20.315% withheld; adding the modest gain on top is then a net loss —
  // the 7.3 guidance's mechanism, landing on "report the modest gain, leave the large one
  // withheld" as the unique best of the four. (The modest gain has to exceed the 514,645 the
  // large gain's plan carries into its gain class; at 500,000 the large gain absorbs more of the
  // unused deductions than the modest one can, and reporting the large gain alone wins instead.)
  const accountA = account({ id: 'a', capitalGains: 800_000 });
  const accountB = account({ id: 'b', capitalGains: 10_000_000 });
  const inputs = salaryInputs([accountA, accountB], { salary: 1_000_000 });
  const salaryStream = inputs.incomeStreams[0]!;

  const planWith = (reportsA: boolean, reportsB: boolean): ReportingPlan => ({
    streams: [
      salaryStream,
      { ...accountA, reportsCapitalGains: reportsA },
      { ...accountB, reportsCapitalGains: reportsB },
    ],
    // Neither account ever has a dividend, so the election is inert in every plan here.
    election: 'separate',
  });

  const withheldBoth = evaluatePlan(inputs, planWith(false, false));
  const reportedAOnly = evaluatePlan(inputs, planWith(true, false));
  const reportedBOnly = evaluatePlan(inputs, planWith(false, true));
  const reportedBoth = evaluatePlan(inputs, planWith(true, true));

  it('matches the hand-derived figures', () => {
    expect(withheldBoth.figures.kept).toBe(9_451_335);
    expect(withheldBoth.figures.incomeTax).toBe(1_654_020);
    expect(withheldBoth.figures.residenceTax).toBe(540_000);
    expect(withheldBoth.figures.totalIncome).toBe(260_000);
    // S, identical in every plan: the employee premiums key on the salary alone.
    expect(withheldBoth.figures.socialInsurance).toBe(154_645);
    // Nothing is reported nationally, so the furusato base is zero (calculateFurusatoNozeiDetails
    // early-returns before any division).
    expect(withheldBoth.figures.furusatoNozeiLimit).toBe(0);

    expect(reportedAOnly.figures.kept).toBe(9_585_155);
    expect(reportedAOnly.figures.incomeTax).toBe(1_531_500);
    expect(reportedAOnly.figures.residenceTax).toBe(528_700);
    expect(reportedAOnly.figures.totalIncome).toBe(1_060_000);
    // The reported gain is fully absorbed nationally (taxable 0), so this is also an exact
    // early return, not a rounded division.
    expect(reportedAOnly.figures.furusatoNozeiLimit).toBe(0);

    expect(reportedBOnly.figures.kept).toBe(9_541_535);
    expect(reportedBOnly.figures.incomeTax).toBe(1_575_120);
    expect(reportedBOnly.figures.residenceTax).toBe(528_700);
    expect(reportedBOnly.figures.totalIncome).toBe(10_260_000);

    expect(reportedBoth.figures.kept).toBe(9_541_555);
    expect(reportedBoth.figures.incomeTax).toBe(1_575_100);
    expect(reportedBoth.figures.residenceTax).toBe(528_700);
    expect(reportedBoth.figures.totalIncome).toBe(11_060_000);
    expect(reportedBoth.figures.socialInsurance).toBe(154_645);
  });

  it('reporting only the modest gain beats every uniform plan', () => {
    expect(reportedAOnly.figures.kept).toBeGreaterThan(withheldBoth.figures.kept);
    expect(reportedAOnly.figures.kept).toBeGreaterThan(reportedBoth.figures.kept);
    // Also beats the other mixed plan, confirming it is the unique best of all four.
    expect(reportedAOnly.figures.kept).toBeGreaterThan(reportedBOnly.figures.kept);
  });

  it('descent finds this plan starting from the best uniform plan', () => {
    const units = deriveReportingUnits(inputs.incomeStreams);
    const uniform: PlanEvaluation[] = [
      { plan: withheldOnlyPlan(inputs, units), evaluated: withheldBoth },
      { plan: allReportedPlan(inputs, units, 'separate'), evaluated: reportedBoth },
      { plan: allReportedPlan(inputs, units, 'aggregate'), evaluated: reportedBoth },
    ];
    const bestUniform = uniform.reduce((best, candidate) =>
      isBetterPlan(candidate, best, inputs, units) ? candidate : best,
    );
    expect(bestUniform.evaluated.figures.kept).toBe(reportedBoth.figures.kept);

    const result = descend(inputs, units, bestUniform);
    expect(result.evaluated.figures.kept).toBeGreaterThanOrEqual(
      bestUniform.evaluated.figures.kept,
    );
    expect(result.evaluated.figures.kept).toBe(9_585_155);
  });
});

describe('isBetterPlan ties', () => {
  it('prefers fewer reported units, then whichever matches Current, when kept is tied', () => {
    const accountA = account({ id: 'a', capitalGains: 500_000, reportsCapitalGains: true });
    const accountB = account({ id: 'b', capitalGains: 500_000 });
    const inputs = salaryInputs([accountA, accountB]);
    const units = deriveReportingUnits(inputs.incomeStreams);
    const salaryStream = inputs.incomeStreams[0]!;

    const fake = (kept: number): EvaluatedPlan => ({
      streams: [],
      election: 'separate',
      figures: {
        kept,
        incomeTax: 0,
        residenceTax: 0,
        socialInsurance: 0,
        furusatoNozeiLimit: 0,
        totalIncome: 0,
      },
    });
    const planWith = (reportsA: boolean, reportsB: boolean): ReportingPlan => ({
      streams: [
        salaryStream,
        { ...accountA, reportsCapitalGains: reportsA },
        { ...accountB, reportsCapitalGains: reportsB },
      ],
      election: 'separate',
    });

    const bothReported: PlanEvaluation = { plan: planWith(true, true), evaluated: fake(1_000) };
    // Matches the entries as they stand (A reported, B withheld).
    const onlyAReported: PlanEvaluation = { plan: planWith(true, false), evaluated: fake(1_000) };
    const onlyBReported: PlanEvaluation = { plan: planWith(false, true), evaluated: fake(1_000) };

    // Fewer reported units wins outright at the same kept.
    expect(isBetterPlan(onlyAReported, bothReported, inputs, units)).toBe(true);
    expect(isBetterPlan(bothReported, onlyAReported, inputs, units)).toBe(false);

    // Between the two single-reported-unit plans, the one matching Current wins.
    expect(isBetterPlan(onlyAReported, onlyBReported, inputs, units)).toBe(true);
    expect(isBetterPlan(onlyBReported, onlyAReported, inputs, units)).toBe(false);
  });
});

describe('neighbourPlans', () => {
  it('offers every other state of each unit, plus the other election only when a dividend is reported', () => {
    const streams: IncomeStream[] = [dividend({ id: 'd', amount: 100_000, isReported: true })];
    const inputs = salaryInputs(streams);
    const units = deriveReportingUnits(inputs.incomeStreams);
    const plan = currentPlan(inputs);

    // The dividend's other state (withheld), plus the other election since one is reported.
    expect(neighbourPlans(units, plan)).toHaveLength(2);
  });

  it('offers no election neighbour when nothing reports a dividend', () => {
    const streams: IncomeStream[] = [account({ id: 'a', capitalGains: 500_000 })];
    const inputs = salaryInputs(streams);
    const units = deriveReportingUnits(inputs.incomeStreams);

    expect(neighbourPlans(units, currentPlan(inputs))).toHaveLength(1);
  });
});

describe('currentPlan', () => {
  it('defaults the election when the inputs omit it', () => {
    expect(currentPlan(salaryInputs([])).election).toBe(DEFAULT_REPORTED_DIVIDENDS_TAXATION);
  });
});

describe('evaluatePlan', () => {
  it('fixes an invalid plan through withRequiredReporting before running the engine', () => {
    const invalid = account({
      id: 'a',
      capitalGains: -500_000,
      dividends: 800_000,
      reportsCapitalGains: true,
      reportsDividends: false,
    });
    const inputs = salaryInputs([invalid]);
    const plan: ReportingPlan = { streams: inputs.incomeStreams, election: 'separate' };

    expect(() => evaluatePlan(inputs, plan)).not.toThrow();
    expect(evaluatePlan(inputs, plan).streams[1]).toMatchObject({
      reportsCapitalGains: true,
      reportsDividends: true,
    });
  });
});

describe('describePlan', () => {
  it('names each optional unit by position and amount, stating the election only for dividends', () => {
    const accountStream = account({
      id: 'a',
      capitalGains: -500_000,
      dividends: 800_000,
      reportsCapitalGains: true,
      reportsDividends: true,
    });
    const dividendStream = dividend({ id: 'd', amount: 300_000, isReported: false });
    const inputs = salaryInputs([accountStream, dividendStream]);
    const units = deriveReportingUnits(inputs.incomeStreams);
    const plan: ReportingPlan = { streams: inputs.incomeStreams, election: 'separate' };

    const text = describePlan(plan, units);
    expect(text).toContain('Account 1');
    expect(text).toContain('sales -¥500,000');
    expect(text).toContain('dividends ¥800,000');
    expect(text).toContain('report both');
    expect(text).toContain('申告分離課税');
    expect(text).toContain('Dividends 1');
    expect(text).toContain('leave to withholding');
  });

  it('is empty when no unit is optional', () => {
    const inputs = salaryInputs([outsideSale('g')]);
    const units = deriveReportingUnits(inputs.incomeStreams);
    expect(describePlan(currentPlan(inputs), units)).toBe('');
  });
});

describe('mandatoryReportingNote', () => {
  it('names sales outside an account and dividends paid abroad together when both exist', () => {
    const streams: IncomeStream[] = [
      outsideSale('g'),
      dividend({ id: 'd', paymentChannel: 'abroad', isReported: true, amount: 100_000 }),
    ];
    expect(mandatoryReportingNote(streams)).toBe(
      'Sales outside a withholding designated account and dividends paid abroad are always reported.',
    );
  });

  it('names only the one that exists', () => {
    expect(mandatoryReportingNote([outsideSale('g')])).toBe(
      'Sales outside a withholding designated account are always reported.',
    );
    expect(
      mandatoryReportingNote([
        dividend({ id: 'd', paymentChannel: 'abroad', isReported: true, amount: 1 }),
      ]),
    ).toBe('Dividends paid abroad are always reported.');
  });

  it('is undefined without either', () => {
    expect(mandatoryReportingNote([account({ id: 'a', capitalGains: 500_000 })])).toBeUndefined();
  });
});
