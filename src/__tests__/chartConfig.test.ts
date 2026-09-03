// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { generateChartData, type ChartCalculationContext } from '../utils/chartConfig';

const context: ChartCalculationContext = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [{ id: 's', type: 'salary', amount: 4_000_000, frequency: 'annual' }],
  ageRange: 'age65to69',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
  longTermCareCategory1ManualEntry: false,
  longTermCareCategory1Premium: 0,
  isEmploymentIncome: true,
};

// Five income points: 1M, 2M, 3M, 4M, 5M.
const range = { min: 1_000_000, max: 5_000_000 };

type Point = { x: number; y: number };
const pointsOf = (dataset: { data: unknown }) => dataset.data as Point[];

describe('generateChartData with the 介護保険第1号 premium', () => {
  it('plots the estimate as a step function of income at 65+', () => {
    // Tokyo annual 基準額 75,840円; single-person 世帯; 給与所得 at each sweep point decides the
    // 所得段階 (both fiscal years of calendar 2026 give the same figure at these incomes):
    //   1M: 給与所得 350,000 → 均等割非課税, 年金収入等 350,000 → tier 1 → ×0.285 → 21,600
    //   2M: 給与所得 1,320,000 → 課税, tier 7 (120万-210万) → ×1.3 → 98,500
    //   3M: 給与所得 2,020,000 → tier 7 → 98,500
    //   4M: 給与所得 2,760,000 → tier 8 (210万-320万) → ×1.5 → 113,700
    //   5M: 給与所得 3,560,000 → tier 9 (320万-420万) → ×1.7 → 128,900
    const { datasets } = generateChartData(range, context);
    const ltc = datasets.find(d => d.label === 'Long-term Care Insurance');

    expect(ltc).toBeDefined();
    expect(pointsOf(ltc!).map(p => p.y)).toEqual([21_600, 98_500, 98_500, 113_700, 128_900]);
  });

  it('plots the entered amount as a constant bar under manual entry', () => {
    const { datasets } = generateChartData(range, {
      ...context,
      longTermCareCategory1ManualEntry: true,
      longTermCareCategory1Premium: 120_000,
    });
    const ltc = datasets.find(d => d.label === 'Long-term Care Insurance');

    expect(ltc).toBeDefined();
    expect(pointsOf(ltc!).map(p => p.y)).toEqual([120_000, 120_000, 120_000, 120_000, 120_000]);
  });

  it('stacks to the income at every point once the premium bar is included', () => {
    const { datasets } = generateChartData(range, context);
    const bars = datasets.filter(d => d.type === 'bar');
    const takeHome = pointsOf(datasets.find(d => d.label === 'Take-Home Pay')!);

    takeHome.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + pointsOf(d)[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x);
    });
  });

  it('omits the bar below age 65 and under manual entry with nothing entered', () => {
    const below65 = generateChartData(range, { ...context, ageRange: 'age60to64' });
    expect(below65.datasets.some(d => d.label === 'Long-term Care Insurance')).toBe(false);

    const nothingEntered = generateChartData(range, {
      ...context,
      longTermCareCategory1ManualEntry: true,
      longTermCareCategory1Premium: 0,
    });
    expect(nothingEntered.datasets.some(d => d.label === 'Long-term Care Insurance')).toBe(false);
  });
});

describe('generateChartData with public pension income', () => {
  const pensionContext: ChartCalculationContext = {
    ...context,
    incomeStreams: [{ id: 'p', type: 'publicPension', amount: 2_400_000 }],
    isEmploymentIncome: false,
  };

  it('labels the pension in the breakdown at every point of the sweep', () => {
    const { datasets } = generateChartData(range, pensionContext);
    const withBreakdown = datasets.filter(d => d.type === 'bar');
    expect(withBreakdown.length).toBeGreaterThan(0);

    // The sweep scales the lone pension stream to each income point, so every point's breakdown
    // is the whole income under the 'Public Pension Income' label.
    withBreakdown.forEach(dataset => {
      const points = dataset.data as (Point & {
        breakdown?: { label: string; amount: number }[];
      })[];
      expect(points).toHaveLength(5);
      points.forEach(point => {
        expect(point.breakdown).toEqual([{ label: 'Public Pension Income', amount: point.x }]);
      });
    });
  });

  it('stacks to the income at every point of a pension sweep', () => {
    const { datasets } = generateChartData(range, pensionContext);
    const bars = datasets.filter(d => d.type === 'bar');
    const takeHome = pointsOf(datasets.find(d => d.label === 'Take-Home Pay')!);

    takeHome.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + pointsOf(d)[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x);
    });
  });
});

describe('generateChartData with investment income', () => {
  // Salary-only baseline: x sweeps 1M-5M, no investment streams.
  const salaryOnlyContext: ChartCalculationContext = {
    ...context,
    ageRange: 'age20to39',
    incomeStreams: [{ id: 's', type: 'salary', amount: 4_000_000, frequency: 'annual' }],
  };

  // Gains 1,000,000 + dividends 200,000 → base 1,200,000; withheld national 183,780 (15.315%),
  // residence 60,000 (5%) — see calculateWithheldInvestmentTax.
  const investmentContext: ChartCalculationContext = {
    ...salaryOnlyContext,
    incomeStreams: [
      ...salaryOnlyContext.incomeStreams,
      { id: 'g', type: 'listedCapitalGains', amount: 1_000_000 },
      { id: 'd', type: 'listedDividends', amount: 200_000 },
    ],
  };

  it('stacks to earned income plus the constant investment total at every point', () => {
    const { datasets } = generateChartData(range, investmentContext);
    const bars = datasets.filter(d => d.type === 'bar');
    const takeHome = pointsOf(datasets.find(d => d.label === 'Take-Home Pay')!);

    takeHome.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + pointsOf(d)[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x + 1_200_000);
    });
  });

  it('lowers the stack when investment income is a net loss', () => {
    const lossContext: ChartCalculationContext = {
      ...salaryOnlyContext,
      incomeStreams: [
        ...salaryOnlyContext.incomeStreams,
        { id: 'g', type: 'listedCapitalGains', amount: -300_000 },
      ],
    };
    const { datasets } = generateChartData(range, lossContext);
    const bars = datasets.filter(d => d.type === 'bar');
    const takeHome = pointsOf(datasets.find(d => d.label === 'Take-Home Pay')!);

    takeHome.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + pointsOf(d)[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x - 300_000);
    });
  });

  it('holds investment amounts constant across the sweep and reports them in the breakdown', () => {
    const { datasets } = generateChartData(range, investmentContext);
    const withBreakdown = datasets.filter(d => d.type === 'bar');
    expect(withBreakdown.length).toBeGreaterThan(0);

    withBreakdown.forEach(dataset => {
      const points = dataset.data as (Point & {
        breakdown?: { label: string; amount: number }[];
      })[];
      expect(points).toHaveLength(5);
      points.forEach(point => {
        expect(point.breakdown).toContainEqual({
          label: 'Listed Capital Gains',
          amount: 1_000_000,
        });
        expect(point.breakdown).toContainEqual({ label: 'Listed Dividends', amount: 200_000 });
      });
    });
  });

  it('reports a capital loss in the breakdown with its sign kept', () => {
    const lossContext: ChartCalculationContext = {
      ...salaryOnlyContext,
      incomeStreams: [
        ...salaryOnlyContext.incomeStreams,
        { id: 'g', type: 'listedCapitalGains', amount: -300_000 },
      ],
    };
    const { datasets } = generateChartData(range, lossContext);
    const takeHome = datasets.find(d => d.label === 'Take-Home Pay')!;
    const points = pointsOf(takeHome) as (Point & {
      breakdown?: { label: string; amount: number }[];
    })[];

    points.forEach(point => {
      expect(point.breakdown).toContainEqual({
        label: 'Listed Capital Gains',
        amount: -300_000,
      });
    });
  });

  it('folds withheld tax into the Income Tax and Residence Tax bars by a constant amount', () => {
    const withInvestment = generateChartData(range, investmentContext);
    const withoutInvestment = generateChartData(range, salaryOnlyContext);
    const incomeTaxWith = pointsOf(withInvestment.datasets.find(d => d.label === 'Income Tax')!);
    const incomeTaxWithout = pointsOf(
      withoutInvestment.datasets.find(d => d.label === 'Income Tax')!,
    );
    const residenceTaxWith = pointsOf(
      withInvestment.datasets.find(d => d.label === 'Residence Tax')!,
    );
    const residenceTaxWithout = pointsOf(
      withoutInvestment.datasets.find(d => d.label === 'Residence Tax')!,
    );

    incomeTaxWith.forEach((point, i) => {
      expect(point.y - incomeTaxWithout[i]!.y, `income ${point.x}`).toBe(183_780);
    });
    residenceTaxWith.forEach((point, i) => {
      expect(point.y - residenceTaxWithout[i]!.y, `income ${point.x}`).toBe(60_000);
    });
  });

  it('divides the Take-Home % line by earned income plus investment income', () => {
    const { datasets } = generateChartData(range, investmentContext);
    const takeHomePercent = pointsOf(datasets.find(d => d.label === 'Take-Home %')!);
    const takeHome = pointsOf(datasets.find(d => d.label === 'Take-Home Pay')!);

    takeHomePercent.forEach((point, i) => {
      const totalGross = point.x + 1_200_000;
      expect(point.y).toBeCloseTo((takeHome[i]!.y / totalGross) * 100, 6);
    });
  });
});
