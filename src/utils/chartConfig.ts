// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TakeHomeInputs, ChartRange, IncomeStream } from '../types/tax';
import { formatJPY, formatYenCompact } from './formatters'
import { calculateTaxes } from './taxCalculations'
import { detectCaps } from './capDetection'
import type { ChartData, ChartOptions, Chart, TooltipItem, Scale, CoreScaleOptions, Plugin } from 'chart.js'
import { MEDIAN_INCOME_VALUE } from '../data/income'


// Create custom plugin for vertical lines
export const currentAndMedianIncomeChartPlugin: Plugin<'bar' | 'line'> = {
  id: 'currentAndMedianIncomeChartPlugin',
  beforeDraw: (chart: Chart) => {
    if (!chart.data.datasets || !chart.data.datasets.length) return;

    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const { left, right, top, bottom } = chartArea;
    const width = right - left;

    const pluginData = chart.options?.plugins?.customPlugin?.data;

    if (!pluginData) {
      console.error('Custom plugin data not found in chart options');
      return;
    }

    // Draw Your Income line if it exists and is within the chart range
    if (typeof pluginData.currentIncomePosition === 'number' && pluginData.currentIncomePosition >= 0 && pluginData.currentIncomePosition <= 1) {
      const yourIncomeX = left + (width * pluginData.currentIncomePosition);
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
    if (typeof pluginData.medianIncomePosition === 'number' && pluginData.medianIncomePosition >= 0 && pluginData.medianIncomePosition <= 1) {
      const medianIncomeX = left + (width * pluginData.medianIncomePosition);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(medianIncomeX, top);
      ctx.lineTo(medianIncomeX, bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 206, 86, 1)';
      ctx.stroke();

      ctx.restore();
    }
  }
};

// Context for chart calculation, including mode which isn't in base inputs
export interface ChartCalculationContext extends Omit<TakeHomeInputs, 'incomeStreams'> {
  // IncomeStreams are now required and normalized
  incomeStreams: IncomeStream[];
  isEmploymentIncome: boolean;
}

export const generateChartData = (
  chartRange: ChartRange,
  currentInputs: ChartCalculationContext
): ChartData<'bar' | 'line'> => {

  // Create income points based on the current range
  const step = 1000000 // 1 million yen
  const numPoints = Math.floor((chartRange.max - chartRange.min) / step) + 1
  const incomePoints = Array.from(
    { length: numPoints },
    (_, i) => chartRange.min + (i * step)
  )

  // If manual social insurance is entered, we cannot accurately calculate the breakdown for other income levels.
  // We return a dummy dataset to ensure the chart renders (axes, background bands, vertical lines) but without misleading bars.
  if (currentInputs.manualSocialInsuranceEntry) {
    return {
      datasets: [{
        label: 'Data Unavailable',
        data: incomePoints.map(x => ({ x, y: 0 })),
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        yAxisID: 'y',
        type: 'bar' as const,
      }]
    };
  }

  // Precompute results and cap status for each income point
  const resultsAndCaps = incomePoints.map(income => {
    // Scale each income stream to match the 'income' for this chart point
    let calcStreams: IncomeStream[] = [];
    const baseTotal = currentInputs.incomeStreams.reduce((sum, s) => {
      if (s.type === 'salary' && s.frequency === 'monthly') return sum + (s.amount * 12);
      return sum + s.amount;
    }, 0);

    if (baseTotal > 0) {
      const ratio = income / baseTotal;
      calcStreams = currentInputs.incomeStreams.map(s => ({
        ...s,
        amount: s.amount * ratio
      }));
    } else {
      // Fallback if base is 0
      calcStreams = [{
        id: 'chart-salary-fallback',
        type: 'salary',
        amount: income,
        frequency: 'annual'
      }];
    }

    // Prepare inputs
    const inputsForCalc: TakeHomeInputs = {
      ...currentInputs,
      incomeStreams: calcStreams,
    };

    // Calculate breakdown for display
    let breakdown: { label: string; amount: number }[] | undefined;
    if (calcStreams.length > 0) {
      const groups = { salary: 0, bonus: 0, business: 0, miscellaneous: 0 };
      calcStreams.forEach(s => {
        const val = (s.type === 'salary' && s.frequency === 'monthly') ? s.amount * 12 : s.amount;
        if (s.type === 'salary') groups.salary += val;
        else if (s.type === 'bonus') groups.bonus += val;
        else if (s.type === 'business') groups.business += val;
        else if (s.type === 'miscellaneous') groups.miscellaneous += val;
      });

      breakdown = [];
      if (groups.salary > 0) breakdown.push({ label: 'Salary', amount: groups.salary });
      if (groups.bonus > 0) breakdown.push({ label: 'Bonus', amount: groups.bonus });
      if (groups.business > 0) breakdown.push({ label: 'Business', amount: groups.business });
      if (groups.miscellaneous > 0) breakdown.push({ label: 'Miscellaneous', amount: groups.miscellaneous });
    }

    const result = calculateTaxes(inputsForCalc);
    const caps = detectCaps(result);
    return { result, caps, breakdown };
  });

  const socialInsuranceDatasets = [
    {
      label: 'Health Insurance',
      data: resultsAndCaps.map(({ result, breakdown }, i) => ({ x: incomePoints[i]!, y: result.healthInsurance, breakdown })),
      borderColor: '#222',
      backgroundColor: 'rgba(255, 140, 0, 0.7)',
      borderWidth: resultsAndCaps.map(({ caps }) => caps.healthInsuranceCapped ? 2 : 0),
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    {
      label: 'Pension',
      data: resultsAndCaps.map(({ result, breakdown }, i) => ({ x: incomePoints[i]!, y: result.pensionPayments, breakdown })),
      borderColor: '#222',
      backgroundColor: 'rgba(138, 43, 226, 0.7)',
      borderWidth: resultsAndCaps.map(({ caps }) => caps.pensionCapped || caps.pensionFixed ? 2 : 0),
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    ...(currentInputs.isEmploymentIncome ? [{
      label: 'Employment Insurance',
      data: resultsAndCaps.map(({ result, breakdown }, i) => ({ x: incomePoints[i]!, y: result.employmentInsurance ?? 0, breakdown })),
      backgroundColor: 'rgba(255, 20, 147, 0.7)',
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    }] : [])
  ];

  const datasets = [
    {
      label: 'Take-Home Pay',
      data: resultsAndCaps.map(({ result, breakdown }, i) => ({ x: incomePoints[i]!, y: result.takeHomeIncome, breakdown })),
      backgroundColor: 'rgba(34, 139, 34, 0.7)',
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    {
      label: 'Income Tax',
      data: resultsAndCaps.map(({ result, breakdown }, i) => ({ x: incomePoints[i]!, y: result.nationalIncomeTax, breakdown })),
      backgroundColor: 'rgba(220, 20, 60, 0.7)',
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    {
      label: 'Residence Tax',
      data: resultsAndCaps.map(({ result, breakdown }, i) => ({ x: incomePoints[i]!, y: result.residenceTax.totalResidenceTax, breakdown })),
      backgroundColor: 'rgba(30, 144, 255, 0.7)',
      yAxisID: 'y',
      type: 'bar' as const,
      stack: 'stack0',
    },
    ...socialInsuranceDatasets,
    {
      label: 'Take-Home %',
      data: resultsAndCaps.map(({ result }, i) => ({
        x: incomePoints[i]!,
        y: (result.takeHomeIncome / incomePoints[i]!) * 100
      })),
      borderColor: 'rgb(105, 105, 105)',
      backgroundColor: 'rgba(105, 105, 105, 0.7)',
      yAxisID: 'y1',
      borderDash: [5, 5],
      type: 'line' as const,
    }
  ];

  return {
    labels: incomePoints.map(income => formatJPY(income)),
    datasets
  }
}

export const getChartOptions = (
  chartRange: ChartRange,
  currentIncome: number,
  useCompactLabelFormat: boolean = false
): ChartOptions<'bar' | 'line'> => {
  const maxIncome = chartRange.max
  const minIncome = chartRange.min
  const currentIncomePosition = Math.max(0, Math.min(1, (currentIncome - minIncome) / (maxIncome - minIncome)))
  const medianIncomePosition = Math.max(0, Math.min(1, (MEDIAN_INCOME_VALUE - minIncome) / (maxIncome - minIncome)))

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
            if (context.length > 0 && context[0]?.parsed?.x != null) {
              const income = context[0].parsed.x;
              return `Income: ${formatJPY(income)}`;
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
              const fractionDigits = context.dataset.label === 'Employment Insurance' ? 2 : 1;
              const percentage = income != null && income > 0 ? ((context.parsed.y / income) * 100).toFixed(fractionDigits) : '0.0';
              label += `${formatJPY(context.parsed.y)} (${percentage}%)`;
            }
            return label;
          },
          footer: function (tooltipItems: TooltipItem<'bar' | 'line'>[]) {
            const item = tooltipItems[0];
            const raw = item?.raw as { breakdown?: { label: string; amount: number }[] } | undefined;

            if (raw?.breakdown && raw.breakdown.length > 0) {
              return '\nIncome Breakdown:\n' + raw.breakdown.map(b =>
                `• ${b.label}: ${formatYenCompact(b.amount)}`
              ).join('\n');
            }
            return '';
          }
        }
      },
      customPlugin: {
        data: {
          currentIncomePosition,
          medianIncomePosition,
          currentIncome,
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        grid: {
          offset: false
        },
        ticks: {
          align: 'center',
          callback: function (this: Scale<CoreScaleOptions>, tickValue: number | string) {
            const value = Number(tickValue);
            return useCompactLabelFormat
              ? formatYenCompact(value)
              : formatJPY(value);
          }
        },
        min: chartRange.min,
        max: chartRange.max,
        offset: false
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ticks: {
          callback: function (this: Scale<CoreScaleOptions>, tickValue: number | string) {
            const value = Number(tickValue);
            return useCompactLabelFormat
              ? formatYenCompact(value)
              : formatJPY(value);
          }
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: function (this: Scale<CoreScaleOptions>, tickValue: number | string) {
            const value = Number(tickValue);
            return value.toFixed(0) + '%';
          }
        }
      }
    },
    elements: {
      point: {
        radius: 3,
      },
      bar: {
        borderWidth: 0
      }
    }
  }
}
