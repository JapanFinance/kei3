// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ChartData, ChartOptions, Chart, TooltipItem, Scale, Plugin } from 'chart.js';

import type { TakeHomeInputs, ChartRange, IncomeStream } from '../types/tax';
import { detectCaps } from './capDetection';
import { formatJPY, formatYenCompact } from './formatters';
import {
  annualIncomeStreamAmount,
  countsTowardAnnualIncome,
  totalAnnualIncomeFromStreams,
} from './incomeStreams';
import { calculateTaxes } from './taxCalculations';

// Create custom plugin for vertical lines
export const currentAndMedianIncomeChartPlugin: Plugin<'bar' | 'line'> = {
  id: 'currentAndMedianIncomeChartPlugin',
  beforeDraw: (chart: Chart) => {
    if (!chart.data.datasets.length) return;

    const { ctx, chartArea } = chart;

    const { left, right, top, bottom } = chartArea;
    const width = right - left;

    const pluginData = chart.options.plugins?.customPlugin?.data;

    if (!pluginData) {
      console.error('Custom plugin data not found in chart options');
      return;
    }

    // Draw Your Income line if it exists and is within the chart range
    if (
      typeof pluginData.currentIncomePosition === 'number' &&
      pluginData.currentIncomePosition >= 0 &&
      pluginData.currentIncomePosition <= 1
    ) {
      const yourIncomeX = left + width * pluginData.currentIncomePosition;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(yourIncomeX, top);
      ctx.lineTo(yourIncomeX, bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 99, 132, 1)';
      ctx.stroke();

      ctx.restore();
    }

    // Draw Median Income line if it exists and is within the chart range
    if (
      typeof pluginData.medianIncomePosition === 'number' &&
      pluginData.medianIncomePosition >= 0 &&
      pluginData.medianIncomePosition <= 1
    ) {
      const medianIncomeX = left + width * pluginData.medianIncomePosition;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(medianIncomeX, top);
      ctx.lineTo(medianIncomeX, bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 206, 86, 1)';
      ctx.stroke();

      ctx.restore();
    }
  },
};

export interface ChartCalculationContext extends TakeHomeInputs {
  isEmploymentIncome: boolean;
}

/**
 * Stream types carried through the chart sweep at their entered amount instead of being
 * scaled with the swept income. The sweep scales exactly what the swept total is made of,
 * so this is the complement of {@link countsTowardAnnualIncome}: a commuting allowance
 * (通勤手当) is not income, does not grow with it, and scaling it can push it past the
 * non-taxable cap, which the calculation rejects.
 */
const isPassThroughStream = (stream: IncomeStream): boolean => !countsTowardAnnualIncome(stream);

/**
 * Scale a set of income streams so their annualized total matches `targetIncome`,
 * preserving the original composition (salary/bonus/business mix). Pass-through streams
 * (see {@link isPassThroughStream}) keep their entered amount and are excluded from the
 * base total, so the ratio is exactly 1 at the taxpayer's own income.
 * When the scaled streams sum to 0 (or none are provided), fall back to a single annual
 * salary stream at `targetIncome` so downstream calculations still see income.
 *
 * Shared by the chart's per-income bars and the tooltip's cap-detection probe so
 * the "🔒 Max reached" badge matches the bars exactly.
 */
export const scaleIncomeStreamsToIncome = (
  streams: IncomeStream[],
  targetIncome: number,
): IncomeStream[] => {
  const baseTotal = totalAnnualIncomeFromStreams(streams);

  if (baseTotal > 0) {
    const ratio = targetIncome / baseTotal;
    return streams.map(s =>
      isPassThroughStream(s)
        ? s
        : {
            ...s,
            amount: s.amount * ratio,
          },
    );
  }

  // Fallback if the scaled streams are 0
  return [
    {
      id: 'chart-salary-fallback',
      type: 'salary',
      amount: targetIncome,
      frequency: 'annual',
    },
    ...streams.filter(isPassThroughStream),
  ];
};

export const generateChartData = (
  chartRange: ChartRange,
  currentInputs: ChartCalculationContext,
): ChartData<'bar' | 'line'> => {
  // Create income points based on the current range
  const step = 1000000; // 1 million yen
  const numPoints = Math.floor((chartRange.max - chartRange.min) / step) + 1;
  const incomePoints = Array.from({ length: numPoints }, (_, i) => chartRange.min + i * step);

  // If manual social insurance is entered, we cannot accurately calculate the breakdown for other income levels.
  // We return a dummy dataset to ensure the chart renders (axes, background bands, vertical lines) but without misleading bars.
  if (currentInputs.manualSocialInsuranceEntry) {
    return {
      datasets: [
        {
          label: 'Data Unavailable',
          data: incomePoints.map(x => ({ x, y: 0 })),
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          yAxisID: 'y',
          type: 'bar' as const,
        },
      ],
    };
  }

  // Precompute results and cap status for each income point
  const resultsAndCaps = incomePoints.map(income => {
    // Scale each income stream to match the 'income' for this chart point
    const calcStreams = scaleIncomeStreamsToIncome(currentInputs.incomeStreams, income);

    // Prepare inputs
    const inputsForCalc: TakeHomeInputs = {
      ...currentInputs,
      incomeStreams: calcStreams,
    };

    // Calculate breakdown for display
    let breakdown: { label: string; amount: number }[] | undefined;
    if (calcStreams.length > 0) {
      const groups = {
        salary: 0,
        bonus: 0,
        business: 0,
        miscellaneous: 0,
        publicPension: 0,
        capitalGains: 0,
        dividends: 0,
        interest: 0,
      };
      calcStreams.forEach(s => {
        const val = annualIncomeStreamAmount(s);
        switch (s.type) {
          case 'salary':
            groups.salary += val;
            break;
          case 'bonus':
            groups.bonus += val;
            break;
          case 'business':
            groups.business += val;
            break;
          case 'miscellaneous':
            groups.miscellaneous += val;
            break;
          case 'publicPension':
            groups.publicPension += val;
            break;
          case 'capitalGains':
            // Kept unscaled by scaleIncomeStreamsToIncome, so this is the same at every point.
            groups.capitalGains += val;
            break;
          case 'dividends':
            groups.dividends += val;
            break;
          case 'interest':
            groups.interest += val;
            break;
          // Not shown as breakdown rows: commuting allowance is excluded from income, and
          // stock compensation has no row of its own.
          case 'commutingAllowance':
          case 'stockCompensation':
            break;
          default: {
            const unhandled: never = s;
            throw new Error(`Unhandled income stream type: ${JSON.stringify(unhandled)}`);
          }
        }
      });

      breakdown = [];
      if (groups.salary > 0) breakdown.push({ label: 'Salary', amount: groups.salary });
      if (groups.bonus > 0) breakdown.push({ label: 'Bonus', amount: groups.bonus });
      if (groups.business > 0) breakdown.push({ label: 'Business', amount: groups.business });
      if (groups.miscellaneous > 0)
        breakdown.push({ label: 'Miscellaneous', amount: groups.miscellaneous });
      if (groups.publicPension > 0)
        breakdown.push({ label: 'Public Pension Income', amount: groups.publicPension });
      // Capital gains may be a loss (negative), unlike every other breakdown row.
      if (groups.capitalGains !== 0)
        breakdown.push({ label: 'Capital Gains', amount: groups.capitalGains });
      if (groups.dividends > 0) breakdown.push({ label: 'Dividends', amount: groups.dividends });
      if (groups.interest > 0) breakdown.push({ label: 'Interest', amount: groups.interest });
    }

    const result = calculateTaxes(inputsForCalc);
    const caps = detectCaps(result, currentInputs.incomeYear);
    const investmentGrossTotal = result.investmentIncome?.grossTotal ?? 0;
    return { result, caps, breakdown, investmentGrossTotal };
  });

  const socialInsuranceDatasets = [
    {
      label: 'Health Insurance',
      data: resultsAndCaps.map(({ result, breakdown, investmentGrossTotal }, i) => ({
        x: incomePoints[i]!,
        y: result.healthInsurance,
        breakdown,
        investmentGrossTotal,
      })),
      borderColor: 'var(--mui-palette-text-primary)',
      backgroundColor: 'rgba(255, 140, 0, 0.7)',
      borderWidth: resultsAndCaps.map(({ caps }) => (caps.healthInsuranceCapped ? 2 : 0)),
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    {
      label: 'Pension',
      data: resultsAndCaps.map(({ result, breakdown, investmentGrossTotal }, i) => ({
        x: incomePoints[i]!,
        y: result.pensionPayments,
        breakdown,
        investmentGrossTotal,
      })),
      borderColor: 'var(--mui-palette-text-primary)',
      backgroundColor: 'rgba(138, 43, 226, 0.7)',
      borderWidth: resultsAndCaps.map(({ caps }) =>
        caps.pensionCapped || caps.pensionFixed ? 2 : 0,
      ),
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    ...(currentInputs.isEmploymentIncome
      ? [
          {
            label: 'Employment Insurance',
            data: resultsAndCaps.map(({ result, breakdown, investmentGrossTotal }, i) => ({
              x: incomePoints[i]!,
              y: result.employmentInsurance ?? 0,
              breakdown,
              investmentGrossTotal,
            })),
            backgroundColor: 'rgba(255, 20, 147, 0.7)',
            yAxisID: 'y',
            type: 'bar' as const,
            stack: 'stack0',
          },
        ]
      : []),
    // Without this bar the stack would fall short of the income by the 介護保険第1号 amount.
    ...(resultsAndCaps.some(({ result }) => result.longTermCareCategory1Premium !== undefined)
      ? [
          {
            label: 'Long-term Care Insurance',
            data: resultsAndCaps.map(({ result, breakdown, investmentGrossTotal }, i) => ({
              x: incomePoints[i]!,
              y: result.longTermCareCategory1Premium ?? 0,
              breakdown,
              investmentGrossTotal,
            })),
            backgroundColor: 'rgba(0, 139, 139, 0.7)',
            yAxisID: 'y',
            type: 'bar' as const,
            stack: 'stack0',
          },
        ]
      : []),
  ];

  const datasets = [
    {
      label: 'Take-Home Pay',
      data: resultsAndCaps.map(({ result, breakdown, investmentGrossTotal }, i) => ({
        x: incomePoints[i]!,
        y: result.takeHomeIncome,
        breakdown,
        investmentGrossTotal,
      })),
      backgroundColor: 'rgba(34, 139, 34, 0.7)',
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    {
      label: 'Income Tax',
      data: resultsAndCaps.map(({ result, breakdown, investmentGrossTotal }, i) => ({
        x: incomePoints[i]!,
        // Includes 上場株式等 withholding folded in — see calculateWithheldInvestmentTax.
        y: result.nationalIncomeTax + (result.investmentIncome?.withheld.national ?? 0),
        breakdown,
        investmentGrossTotal,
      })),
      backgroundColor: 'rgba(220, 20, 60, 0.7)',
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    {
      label: 'Residence Tax',
      data: resultsAndCaps.map(({ result, breakdown, investmentGrossTotal }, i) => ({
        x: incomePoints[i]!,
        y:
          result.residenceTax.totalResidenceTax +
          (result.investmentIncome?.withheld.residence ?? 0),
        breakdown,
        investmentGrossTotal,
      })),
      backgroundColor: 'rgba(30, 144, 255, 0.7)',
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    ...socialInsuranceDatasets,
    {
      label: 'Take-Home %',
      data: resultsAndCaps.map(({ result, investmentGrossTotal }, i) => {
        const totalGross = incomePoints[i]! + investmentGrossTotal;
        return {
          x: incomePoints[i]!,
          y: (result.takeHomeIncome / totalGross) * 100,
        };
      }),
      borderColor: 'rgb(105, 105, 105)',
      backgroundColor: 'rgba(105, 105, 105, 0.7)',
      yAxisID: 'y1',
      borderDash: [5, 5],
      type: 'line' as const,
    },
  ];

  return {
    labels: incomePoints.map(income => formatJPY(income)),
    datasets,
  };
};

export const getChartOptions = (
  chartRange: ChartRange,
  currentIncome: number,
  medianIncome: number,
  useCompactLabelFormat: boolean = false,
): ChartOptions<'bar' | 'line'> => {
  const maxIncome = chartRange.max;
  const minIncome = chartRange.min;
  const currentIncomePosition = Math.max(
    0,
    Math.min(1, (currentIncome - minIncome) / (maxIncome - minIncome)),
  );
  const medianIncomePosition = Math.max(
    0,
    Math.min(1, (medianIncome - minIncome) / (maxIncome - minIncome)),
  );

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        filter: function (tooltipItem: TooltipItem<'bar' | 'line'>) {
          // Don't show tooltip for Take-Home % line (redundant with percentages on other items)
          return tooltipItem.dataset.yAxisID !== 'y1';
        },
        callbacks: {
          title: function (context: TooltipItem<'bar' | 'line'>[]) {
            if (context.length > 0 && context[0]?.parsed.x != null) {
              const income = context[0].parsed.x;
              const raw = context[0].raw as { investmentGrossTotal?: number } | undefined;
              const investmentGrossTotal = raw?.investmentGrossTotal ?? 0;
              const lines = [`Income: ${formatJPY(income)}`];
              if (investmentGrossTotal !== 0) {
                lines.push(`Investment income: ${formatJPY(investmentGrossTotal)} (held constant)`);
              }
              return lines;
            }
            return '';
          },
          label: function (context: TooltipItem<'bar' | 'line'>) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y != null) {
              const income = context.parsed.x;
              const raw = context.raw as { investmentGrossTotal?: number } | undefined;
              const totalGross = (income ?? 0) + (raw?.investmentGrossTotal ?? 0);
              const fractionDigits = context.dataset.label === 'Employment Insurance' ? 2 : 1;
              const percentage =
                totalGross > 0
                  ? ((context.parsed.y / totalGross) * 100).toFixed(fractionDigits)
                  : '0.0';
              label += `${formatJPY(context.parsed.y)} (${percentage}%)`;
            }
            return label;
          },
          footer: function (tooltipItems: TooltipItem<'bar' | 'line'>[]) {
            const item = tooltipItems[0];
            const raw = item?.raw as
              | { breakdown?: { label: string; amount: number }[] }
              | undefined;

            if (raw?.breakdown && raw.breakdown.length > 0) {
              return (
                '\nIncome Breakdown:\n' +
                raw.breakdown.map(b => `• ${b.label}: ${formatYenCompact(b.amount)}`).join('\n')
              );
            }
            return '';
          },
        },
      },
      customPlugin: {
        data: {
          currentIncomePosition,
          medianIncomePosition,
          currentIncome,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        grid: {
          offset: false,
        },
        ticks: {
          align: 'center',
          callback: function (this: Scale, tickValue: number | string) {
            const value = Number(tickValue);
            return useCompactLabelFormat ? formatYenCompact(value) : formatJPY(value);
          },
        },
        min: chartRange.min,
        max: chartRange.max,
        offset: false,
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ticks: {
          callback: function (this: Scale, tickValue: number | string) {
            const value = Number(tickValue);
            return useCompactLabelFormat ? formatYenCompact(value) : formatJPY(value);
          },
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: function (this: Scale, tickValue: number | string) {
            const value = Number(tickValue);
            return value.toFixed(0) + '%';
          },
        },
      },
    },
    elements: {
      point: {
        radius: 3,
      },
      bar: {
        borderWidth: 0,
      },
    },
  };
};
