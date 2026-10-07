// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import {
  generateChartData,
  heldIncomeInSweep,
  getChartOptions,
  scaleIncomeStreamsToIncome,
  type ChartCalculationContext,
} from '../utils/chartConfig';
import { calculateTaxes } from '../utils/taxCalculations';

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
    incomeStreams: [
      {
        id: 'p',
        type: 'publicPension',
        payerDomicile: 'domestic',
        foreignTax: 0,
        amount: 2_400_000,
      },
    ],
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
  // 申告不要 investment income is money received, so it is inside the income the x-axis sweeps
  // and inside take-home. It is asset-based, so the sweep holds it at the entered amount, and the
  // tax withheld on it rides in the tax bars beside the assessed tax.
  const investmentContext: ChartCalculationContext = {
    ...context,
    incomeStreams: [
      { id: 's', type: 'salary', amount: 4_000_000, frequency: 'annual' },
      {
        id: 'c',
        type: 'withholdingAccount',
        capitalGains: 1_000_000,
        dividends: 0,
        foreignDividends: 0,
        foreignTax: 0,
        reportsCapitalGains: false,
        reportsDividends: false,
      },
      { id: 'i', type: 'interest', payerDomicile: 'domestic', amount: 100_000, foreignTax: 0 },
    ],
  };

  it('holds the amount constant, carries the withheld tax in the tax bars, and stacks to the income', () => {
    const { datasets } = generateChartData({ min: 0, max: 5_000_000 }, investmentContext);
    const bars = datasets.filter(d => d.type === 'bar');
    const takeHome = pointsOf(datasets.find(d => d.label === 'Take-Home Pay')!);
    const incomeTax = pointsOf(datasets.find(d => d.label === 'Income Tax')!);
    const residenceTax = pointsOf(datasets.find(d => d.label === 'Residence Tax')!);

    // 1,100,000 is held, so no earned income reaches the 1,000,000 point.
    expect(takeHome.map(p => p.x)).toEqual([2_000_000, 3_000_000, 4_000_000, 5_000_000]);
    takeHome.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + pointsOf(d)[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x);

      // The engine's figures for the same point: the assessed tax plus the tax withheld.
      const result = calculateTaxes({
        ...investmentContext,
        incomeStreams: scaleIncomeStreamsToIncome(investmentContext.incomeStreams, point.x),
      });
      const withheld = result.investmentIncome!.withheld!.tax;
      // 1,000,000 × 15.315% + 100,000 × 15.315%; 1,000,000 × 5% + 100,000 × 5%.
      expect(withheld).toEqual({ national: 168_465, residence: 55_000, total: 223_465 });
      expect(incomeTax[i]!.y, `income ${point.x}`).toBe(result.nationalIncomeTax + 168_465);
      expect(residenceTax[i]!.y, `income ${point.x}`).toBe(
        result.residenceTax.totalResidenceTax + 55_000,
      );
      expect(point.y).toBe(result.takeHomeIncome);
    });
  });
});

describe('generateChartData with investment income reported under 申告分離課税', () => {
  // Reported investment income is on the return and inside take-home, so the x-axis — the income
  // on the return — includes it. It is asset-based, so the sweep holds it at the entered amount
  // and scales the earned streams to the remainder.
  const dividends = {
    id: 'd',
    type: 'dividends' as const,
    shareType: 'listed' as const,
    paymentChannel: 'domestic' as const,
    isReported: true as const,
    issuerDomicile: 'domestic' as const,
    foreignTax: 0,
    amount: 1_000_000,
  };
  const reportedContext: ChartCalculationContext = {
    ...context,
    incomeStreams: [{ id: 's', type: 'salary', amount: 4_000_000, frequency: 'annual' }, dividends],
  };

  it('holds the reported amount and scales the earned income to the remainder', () => {
    expect(heldIncomeInSweep(reportedContext.incomeStreams)).toBe(1_000_000);
    expect(scaleIncomeStreamsToIncome(reportedContext.incomeStreams, 3_000_000)).toEqual([
      { id: 's', type: 'salary', amount: 2_000_000, frequency: 'annual' },
      dividends,
    ]);
    // At the entered total the ratio is exactly 1.
    expect(scaleIncomeStreamsToIncome(reportedContext.incomeStreams, 5_000_000)).toEqual(
      reportedContext.incomeStreams,
    );
  });

  it('starts the sweep at the held amount and stacks to the total income at every point', () => {
    const { datasets } = generateChartData({ min: 0, max: 5_000_000 }, reportedContext);
    const takeHome = pointsOf(datasets.find(d => d.label === 'Take-Home Pay')!);
    // No earned income could bring the total below the 1,000,000 held, so 0 is left out.
    expect(takeHome.map(p => p.x)).toEqual([1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000]);

    const bars = datasets.filter(d => d.type === 'bar');
    takeHome.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + pointsOf(d)[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x);
    });
  });

  it('taxes the held dividends under the election in force, as the results do', () => {
    // At 6,000,000 on the return — 5,000,000 of salary beside the held 1,000,000 — take-home is
    // 4,739,848 under 申告分離課税 and 4,748,648 under 総合課税 (the calculateTaxes cases, whose
    // taxpayer is 20-39).
    const takeHomeAt = (election: ChartCalculationContext['reportedDividendsTaxation']) => {
      const { datasets } = generateChartData(
        { min: 1_000_000, max: 6_000_000 },
        { ...reportedContext, ageRange: 'age20to39', reportedDividendsTaxation: election },
      );
      const takeHome = datasets.find(d => d.label === 'Take-Home Pay');
      return pointsOf(takeHome!).find(p => p.x === 6_000_000)?.y;
    };

    expect(takeHomeAt(undefined)).toBe(4_739_848);
    expect(takeHomeAt('separate')).toBe(4_739_848);
    expect(takeHomeAt('aggregate')).toBe(4_748_648);
  });

  it('labels the investment income in the breakdown at every point', () => {
    const { datasets } = generateChartData({ min: 0, max: 5_000_000 }, reportedContext);
    const bars = datasets.filter(d => d.type === 'bar');
    expect(bars.length).toBeGreaterThan(0);

    bars.forEach(dataset => {
      const points = dataset.data as (Point & {
        breakdown?: { label: string; amount: number }[];
      })[];
      points.forEach(point => {
        expect(point.breakdown, `income ${point.x}`).toEqual([
          ...(point.x > 1_000_000 ? [{ label: 'Salary', amount: point.x - 1_000_000 }] : []),
          { label: 'Investment Income', amount: 1_000_000 },
        ]);
      });
    });
  });
});

describe('generateChartData with foreign tax', () => {
  // The foreign tax cases of taxCalculations.test.ts, whose taxpayer is 20-39. The foreign tax
  // paid is a tax on the income the x-axis sweeps, so it rides in the income tax bar with the
  // assessed tax, and the bars still stack to the income.
  const stacksToIncomeWithForeignTaxInIncomeTaxBar = (
    chartContext: ChartCalculationContext,
    foreignTaxPaid: number,
    chartRange = { min: 1_000_000, max: 6_000_000 },
  ) => {
    const { datasets } = generateChartData(chartRange, chartContext);
    const bars = datasets.filter(d => d.type === 'bar');
    const takeHome = pointsOf(datasets.find(d => d.label === 'Take-Home Pay')!);
    const incomeTax = pointsOf(datasets.find(d => d.label === 'Income Tax')!);

    takeHome.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + pointsOf(d)[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x);

      const result = calculateTaxes({
        ...chartContext,
        incomeStreams: scaleIncomeStreamsToIncome(chartContext.incomeStreams, point.x),
      });
      expect(result.foreignTaxPaid, `income ${point.x}`).toBe(foreignTaxPaid);
      expect(incomeTax[i]!.y, `income ${point.x}`).toBe(result.nationalIncomeTax + foreignTaxPaid);
    });
    return incomeTax;
  };

  it('holds a foreign dividend and its foreign tax across the sweep', () => {
    // Case A: 1,000,000 from a foreign company with 100,000 of foreign tax, reported under
    // 申告分離課税.
    const incomeTax = stacksToIncomeWithForeignTaxInIncomeTaxBar(
      {
        ...context,
        ageRange: 'age20to39',
        incomeStreams: [
          { id: 's', type: 'salary', amount: 5_000_000, frequency: 'annual' },
          {
            id: 'd',
            type: 'dividends',
            shareType: 'listed',
            paymentChannel: 'domestic',
            isReported: true,
            issuerDomicile: 'foreign',
            foreignTax: 100_000,
            amount: 1_000_000,
          },
        ],
      },
      100_000,
    );
    // At 6,000,000 the salary is the 5,000,000 entered: case A's 191,100 + 100,000.
    expect(incomeTax.find(p => p.x === 6_000_000)?.y).toBe(291_100);
  });

  it('holds foreign tax paid with a return constant across the sweep', () => {
    // Case K: 20,000 paid with a foreign return, against 500,000 of interest paid outside Japan.
    const incomeTax = stacksToIncomeWithForeignTaxInIncomeTaxBar(
      {
        ...context,
        ageRange: 'age20to39',
        incomeStreams: [
          { id: 's', type: 'salary', amount: 5_000_000, frequency: 'annual' },
          { id: 'i', type: 'interest', payerDomicile: 'foreign', foreignTax: 0, amount: 500_000 },
        ],
        foreignTaxCredit: { foreignTax: 20_000 },
      },
      20_000,
      { min: 500_000, max: 5_500_000 },
    );
    // At 5,500,000 the salary is the 5,000,000 entered: case K's 118,300 + 20,000.
    expect(incomeTax.find(p => p.x === 5_500_000)?.y).toBe(138_300);
  });

  it("scales a foreign pension's foreign tax with the pension", () => {
    // A lone pension from a foreign system, 2,000,000 with 100,000 of foreign tax, is scaled to
    // each point with its tax. Up to 2,000,000 the 1,100,000 minimum deduction leaves at most
    // 900,000, under the 1,040,000 基礎控除, so the income tax bar is the foreign tax alone.
    const pensionContext: ChartCalculationContext = {
      ...context,
      incomeStreams: [
        {
          id: 'p',
          type: 'publicPension',
          payerDomicile: 'foreign',
          foreignTax: 100_000,
          amount: 2_000_000,
        },
      ],
      isEmploymentIncome: false,
      longTermCareCategory1ManualEntry: true,
    };
    const { datasets } = generateChartData(range, pensionContext);
    const bars = datasets.filter(d => d.type === 'bar');
    const incomeTax = pointsOf(datasets.find(d => d.label === 'Income Tax')!);

    incomeTax.forEach((point, i) => {
      const stacked = bars.reduce((sum, d) => sum + pointsOf(d)[i]!.y, 0);
      expect(stacked, `income ${point.x}`).toBe(point.x);
    });
    // 1,000,000 carries 50,000 of foreign tax, 2,000,000 the 100,000 entered.
    expect(incomeTax.slice(0, 2).map(p => p.y)).toEqual([50_000, 100_000]);
  });
});

describe('getChartOptions animation', () => {
  it('leaves the Chart.js animation defaults in place by default', () => {
    expect(getChartOptions(range, 3_000_000, 4_000_000)).not.toHaveProperty('animation');
  });

  it('turns every animation off when animate is false', () => {
    expect(getChartOptions(range, 3_000_000, 4_000_000, true, false).animation).toBe(false);
  });
});
