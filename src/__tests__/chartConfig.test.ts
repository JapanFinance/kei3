// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import {
  generateChartData,
  scaleIncomeStreamsToIncome,
  type ChartCalculationContext,
} from '../utils/chartConfig';

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

describe('generateChartData with a commuting allowance', () => {
  // 100,000円/month is under the 150,000円 non-taxable cap, but scaling it with the swept
  // income would carry it past the cap and the calculation would reject it.
  const commutingContext: ChartCalculationContext = {
    ...context,
    incomeStreams: [
      { id: 's', type: 'salary', amount: 5_000_000, frequency: 'annual' },
      { id: 'c', type: 'commutingAllowance', amount: 100_000, frequency: 'monthly' },
    ],
  };
  const wideRange = { min: 0, max: 10_000_000 };

  it('sweeps past the entered income without scaling the allowance over the cap', () => {
    expect(() => generateChartData(wideRange, commutingContext)).not.toThrow();

    const points = Array.from({ length: 11 }, (_, i) => i * 1_000_000);
    points.forEach(income => {
      const streams = scaleIncomeStreamsToIncome(commutingContext.incomeStreams, income);
      const allowance = streams.filter(s => s.type === 'commutingAllowance');
      expect(allowance, `income ${income}`).toEqual([
        { id: 'c', type: 'commutingAllowance', amount: 100_000, frequency: 'monthly' },
      ]);
      expect(streams.find(s => s.type === 'salary')?.amount, `income ${income}`).toBe(income);
    });
  });

  it('keeps the allowance out of the per-point breakdown', () => {
    const { datasets } = generateChartData(wideRange, commutingContext);
    const bars = datasets.filter(d => d.type === 'bar');
    expect(bars.length).toBeGreaterThan(0);

    bars.forEach(dataset => {
      const points = dataset.data as (Point & {
        breakdown?: { label: string; amount: number }[];
      })[];
      points.forEach(point => {
        expect(point.breakdown, `income ${point.x}`).toEqual(
          point.x > 0 ? [{ label: 'Salary', amount: point.x }] : [],
        );
      });
    });
  });
});

describe('generateChartData with investment income', () => {
  // Dividends 300,000 + interest 100,000, both held constant across the sweep like the
  // commuting allowance. Withheld at source (申告不要): listed base 300,000 (no capital
  // gains to net against) → 45,945 national + 15,000 residence; interest 100,000 → 15,315
  // national + 5,000 residence.
  const investmentContext: ChartCalculationContext = {
    ...context,
    incomeStreams: [
      { id: 's', type: 'salary', amount: 4_000_000, frequency: 'annual' },
      {
        id: 'd',
        type: 'dividends',
        shareType: 'listed',
        taxTreatment: 'withheldOnly',
        amount: 300_000,
      },
      { id: 'i', type: 'interest', payerDomicile: 'domestic', amount: 100_000 },
    ],
  };

  type PointWithExtras = Point & {
    breakdown?: { label: string; amount: number }[];
    investmentGrossTotal?: number;
  };

  it('holds the investment total constant across the sweep', () => {
    const { datasets } = generateChartData(range, investmentContext);
    const takeHome = datasets.find(d => d.label === 'Take-Home Pay')!;
    const points = takeHome.data as PointWithExtras[];

    expect(points).toHaveLength(5);
    points.forEach(point => {
      expect(point.investmentGrossTotal, `income ${point.x}`).toBe(400_000);
    });
  });

  it('labels the investment rows in the breakdown, keeping the sign on a capital-gains loss', () => {
    const lossContext: ChartCalculationContext = {
      ...context,
      incomeStreams: [
        { id: 's', type: 'salary', amount: 4_000_000, frequency: 'annual' },
        {
          id: 'c',
          type: 'capitalGains',
          shareType: 'listed',
          account: 'specifiedWithholding',
          taxTreatment: 'withheldOnly',
          amount: -500_000,
        },
        {
          id: 'd',
          type: 'dividends',
          shareType: 'listed',
          taxTreatment: 'withheldOnly',
          amount: 300_000,
        },
      ],
    };
    const { datasets } = generateChartData(range, lossContext);
    const takeHome = datasets.find(d => d.label === 'Take-Home Pay')!;
    const points = takeHome.data as PointWithExtras[];

    points.forEach(point => {
      expect(point.breakdown, `income ${point.x}`).toEqual(
        expect.arrayContaining([
          { label: 'Capital Gains', amount: -500_000 },
          { label: 'Dividends', amount: 300_000 },
        ]),
      );
    });
  });

  it('stacks to income plus the investment total, with withheld tax folded into the tax bars', () => {
    const { datasets } = generateChartData(range, investmentContext);
    const bars = datasets.filter(d => d.type === 'bar');
    const takeHome = datasets.find(d => d.label === 'Take-Home Pay')!;
    const points = takeHome.data as PointWithExtras[];

    points.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + (d.data as Point[])[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x + point.investmentGrossTotal!);
    });

    // Investment income does not enter taxable income in Phase 1 (申告不要), so the
    // assessed income/residence tax at each swept point is identical to a salary-only sweep;
    // only the withheld amounts — constant, since the investment streams are held constant —
    // are added on top.
    const { datasets: baselineDatasets } = generateChartData(range, context);
    const incomeTax = datasets.find(d => d.label === 'Income Tax')!.data as Point[];
    const residenceTax = datasets.find(d => d.label === 'Residence Tax')!.data as Point[];
    const baselineIncomeTax = baselineDatasets.find(d => d.label === 'Income Tax')!.data as Point[];
    const baselineResidenceTax = baselineDatasets.find(d => d.label === 'Residence Tax')!
      .data as Point[];

    incomeTax.forEach((point, i) => {
      expect(point.y - baselineIncomeTax[i]!.y, `income ${point.x}`).toBe(61_260); // 45,945 + 15,315
    });
    residenceTax.forEach((point, i) => {
      expect(point.y - baselineResidenceTax[i]!.y, `income ${point.x}`).toBe(20_000); // 15,000 + 5,000
    });
  });

  it('divides the Take-Home % line by income plus the investment total', () => {
    const { datasets } = generateChartData(range, investmentContext);
    const takeHomePercent = datasets.find(d => d.label === 'Take-Home %')!;
    const takeHome = datasets.find(d => d.label === 'Take-Home Pay')!;
    const percentPoints = takeHomePercent.data as Point[];
    const takeHomePoints = takeHome.data as PointWithExtras[];

    percentPoints.forEach((point, i) => {
      const totalGross = takeHomePoints[i]!.x + takeHomePoints[i]!.investmentGrossTotal!;
      expect(point.y, `income ${point.x}`).toBeCloseTo((takeHomePoints[i]!.y / totalGross) * 100);
    });
  });
});
