// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useMemo, useRef, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController,
} from 'chart.js';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type {
  ChartRange,
  CustomEmployeesHealthInsuranceRates,
  IncomeStream,
  LifeInsuranceInput,
  EarthquakeInsuranceInput,
  MedicalExpensesInput,
  HomeLoanTaxCreditInput,
} from '../../types/tax';
import { formatJPY } from '../../utils/formatters';
import {
  generateChartData,
  getChartOptions,
  scaleIncomeStreamsToIncome,
  currentAndMedianIncomeChartPlugin,
} from '../../utils/chartConfig';
import type { HealthInsuranceProviderId } from '../../types/healthInsurance';
import type { Dependent } from '../../types/dependents';
import {
  QUINTILE_DATA,
  HOUSEHOLD_INCOME_DISTRIBUTIONS,
  HOUSEHOLD_TYPE_ORDER,
  DEFAULT_HOUSEHOLD_TYPE,
  type HouseholdType,
} from '../../data/income';
import {
  estimateIncomePercentile,
  estimateIncomeAtPercentile,
} from '../../utils/incomeDistribution';
import { DetailedTooltip } from '../ui/Tooltips';
import SourceLinks, { type Source } from '../ui/SourceLinks';
import { detectCaps } from '../../utils/capDetection';
import { calculateTaxes } from '../../utils/taxCalculations';
import { SIMPLE_TOOLTIP_ICON } from '../ui/constants';

// Quintile band styling; the boundary incomes between bands follow the selected household type.
const QUINTILE_BAND_STYLES = [
  { label: '0-20th percentile', color: 'rgba(255, 99, 132, 0.1)' }, // Light red
  { label: '20-40th percentile', color: 'rgba(255, 159, 64, 0.1)' }, // Light orange
  { label: '40-60th percentile', color: 'rgba(153, 102, 255, 0.1)' }, // Light purple
  { label: '60-80th percentile', color: 'rgba(46, 125, 50, 0.1)' }, // Light green
  { label: '80-100th percentile', color: 'rgba(54, 162, 235, 0.1)' }, // Light blue
];

/** The five band edges implied by the four quintile boundaries: 0, Q20, Q40, Q60, Q80, ∞. */
const toBandEdges = (boundaries: readonly number[]): number[] => [0, ...boundaries, Infinity];

// Chart.js plugin for the quintile background bands. Reads the selected household type's quintile
// boundaries from the chart options, the same channel the median line uses.
const quintileBandsPlugin = {
  id: 'quintileBands',
  beforeDraw: (chart: ChartJS<'bar' | 'line'>) => {
    // Chart.js types plugin options as DeepPartial, so narrow the elements back to numbers.
    const boundaries = chart.options.plugins?.quintileBands?.boundaries?.filter(
      (b): b is number => typeof b === 'number',
    );
    if (!boundaries || boundaries.length !== 4) return;

    const { ctx, scales } = chart;
    const { x: xScale, y: yScale } = scales;

    if (!xScale || !yScale) return;

    ctx.save();

    // Draw each percentile band
    const edges = toBandEdges(boundaries);
    QUINTILE_BAND_STYLES.forEach((style, i) => {
      const xMin = Math.max(xScale.getPixelForValue(edges[i]!), xScale.left);
      const xMax = Math.min(xScale.getPixelForValue(edges[i + 1]!), xScale.right);

      if (xMax > xMin) {
        ctx.fillStyle = style.color;
        ctx.fillRect(xMin, yScale.top, xMax - xMin, yScale.height);
      }
    });

    // Draw dotted lines between bands
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); // Create dotted line pattern

    // Draw vertical lines at each percentile boundary
    boundaries.forEach(value => {
      const x = xScale.getPixelForValue(value);
      if (x >= xScale.left && x <= xScale.right) {
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
      }
    });

    ctx.restore();
  },
};

// Register only the Chart.js components we need
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController,
  currentAndMedianIncomeChartPlugin,
  quintileBandsPlugin,
);

interface TakeHomeChartProps {
  currentIncome: number;
  incomeYear: number;
  isEmploymentIncome: boolean;
  isSubjectToLongTermCarePremium: boolean;
  healthInsuranceProvider: HealthInsuranceProviderId;
  region: string;
  dcPlanContributions: number;
  dependents: Dependent[];
  customEHIRates?: CustomEmployeesHealthInsuranceRates | undefined;
  className?: string;
  manualSocialInsuranceEntry?: boolean;
  manualSocialInsuranceAmount?: number;
  incomeStreams?: IncomeStream[];
  lifeInsurance: LifeInsuranceInput;
  earthquakeInsurance: EarthquakeInsuranceInput;
  medicalExpenses: MedicalExpensesInput;
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
}

// Define a type for the mark objects
type ChartMark = {
  value: number;
  label: string;
};

// Define static marks outside the component
const MAJOR_MARKS: ChartMark[] = [
  { value: 0, label: '¥0' },
  { value: 20000000, label: '¥20M' },
  { value: 40000000, label: '¥40M' },
  { value: 60000000, label: '¥60M' },
  { value: 80000000, label: '¥80M' },
  { value: 100000000, label: '¥100M' },
];

const MINOR_MARKS: ChartMark[] = [
  { value: 10000000, label: '' },
  { value: 30000000, label: '' },
  { value: 50000000, label: '' },
  { value: 70000000, label: '' },
  { value: 90000000, label: '' },
];

const STEP_SIZE = 1000000; // 1M steps

// Constants for custom legend
const YOUR_INCOME_COLOR = 'rgba(255, 99, 132, 1)';
const MEDIAN_INCOME_COLOR = 'rgba(255, 206, 86, 1)';

const INCOME_SURVEY_SOURCES: Source[] = [
  {
    label: '2025（令和７）年 国民生活基礎調査の概況 (Comprehensive Survey of Living Conditions)',
    href: 'https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/index.html',
  },
  {
    label:
      '所得票 第０２１表 世帯数の相対度数分布・世帯類型別 (income distribution by household type)',
    href: 'https://www.e-stat.go.jp/stat-search/files?toukei=00450061&tstat=000001244376&cycle=7&tclass1=000001244380',
  },
  {
    label: '用語の説明 (definitions of each household type)',
    href: 'https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa25/dl/07.pdf',
  },
];

/** Lowercases a household-type label's first letter so it can sit mid-sentence. The dropdown's
 * open menu keeps the capitalized labels; only sentence positions use this. */
const lowercaseFirst = (label: string): string => label.charAt(0).toLowerCase() + label.slice(1);

// Utility function to get the quintile band an income falls in, given the quintile boundaries
const getQuintileBand = (income: number, boundaries: readonly number[]): { label: string } => {
  const edges = toBandEdges(boundaries);
  const index = QUINTILE_BAND_STYLES.findIndex(
    (_, i) => income >= edges[i]! && income < edges[i + 1]!,
  );
  return QUINTILE_BAND_STYLES[index === -1 ? QUINTILE_BAND_STYLES.length - 1 : index]!;
};

const TakeHomeChart: React.FC<TakeHomeChartProps> = ({
  currentIncome,
  incomeYear,
  isEmploymentIncome,
  isSubjectToLongTermCarePremium,
  healthInsuranceProvider,
  region,
  dcPlanContributions,
  dependents,
  customEHIRates,
  className = '',
  manualSocialInsuranceEntry,
  manualSocialInsuranceAmount = 0,
  incomeStreams = [],
  lifeInsurance,
  earthquakeInsurance,
  medicalExpenses,
  homeLoanTaxCredit,
}) => {
  const theme = useTheme();

  // Track whether the user has manually adjusted the range
  const [hasManuallyAdjustedRange, setHasManuallyAdjustedRange] = useState(false);
  const [manualChartRange, setManualChartRange] = useState<ChartRange | null>(null);

  // Which 世帯類型 the median line, the percentile estimate, and the quintile bands are measured
  // against.
  const [householdType, setHouseholdType] = useState<HouseholdType>(DEFAULT_HOUSEHOLD_TYPE);
  const distribution = HOUSEHOLD_INCOME_DISTRIBUTIONS[householdType];

  // The survey publishes exact 五分位値 for 全世帯 only; every other type's quintile boundaries
  // are estimated by inverting its bucketed distribution
  const quintilesAreEstimated = householdType !== 'all';
  const quintileBoundaries = useMemo<number[]>(
    () =>
      quintilesAreEstimated
        ? [20, 40, 60, 80].map(p => estimateIncomeAtPercentile(p, distribution.ranges))
        : [QUINTILE_DATA[20], QUINTILE_DATA[40], QUINTILE_DATA[60], QUINTILE_DATA[80]],
    [quintilesAreEstimated, distribution],
  );

  // Estimated boundaries display rounded down to the nearest ¥10,000 and marked "~", so the
  // tooltip does not imply more precision than the estimate carries. Down, not to nearest: the
  // interpolation runs measurably high against the published 全世帯 boundaries, so rounding down
  // moves the display toward the true value. Published boundaries show exact.
  const formatQuintileBoundary = (value: number): string =>
    quintilesAreEstimated ? `~${formatJPY(Math.floor(value / 10_000) * 10_000)}` : formatJPY(value);

  // Function to calculate auto-centered range based on income
  const calculateAutoCenteredRange = (income: number): ChartRange => {
    // Round down to the nearest million
    const roundedDownIncome = Math.floor(income / 1000000) * 1000000;

    // Set range to be from that number plus or minus 5 million yen
    let min = roundedDownIncome - 5000000;
    let max = roundedDownIncome + 5000000;

    // Ensure range is never less than 0 or more than 100 million
    min = Math.max(0, min);
    max = Math.min(100000000, max);

    // If max would be less than min after the constraint, adjust accordingly
    if (max - min < 10000000) {
      if (min === 0) {
        max = 10000000;
      } else if (max === 100000000) {
        min = 90000000;
      }
    }

    return { min, max };
  };

  // Calculate chart range - use manual range if set, otherwise auto-calculate
  const chartRange = useMemo(() => {
    if (hasManuallyAdjustedRange && manualChartRange) {
      return manualChartRange;
    }
    if (currentIncome > 0) {
      return calculateAutoCenteredRange(currentIncome);
    }
    return { min: 0, max: 10000000 }; // Default range
  }, [currentIncome, hasManuallyAdjustedRange, manualChartRange]);

  const handleManualRangeChange = (_: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue) && newValue.length >= 2) {
      setManualChartRange({ min: newValue[0]!, max: newValue[1]! });
      // Mark that the user has manually adjusted the range
      setHasManuallyAdjustedRange(true);
    }
  };

  const useCompactLabelFormat = useMediaQuery(theme.breakpoints.down('md'));

  const chartRef = useRef<ChartJS<'bar' | 'line'>>(null);

  // Generate chart data using the utility function
  const chartData = useMemo<ChartData<'bar' | 'line'>>(
    () =>
      generateChartData(chartRange, {
        isEmploymentIncome,
        incomeYear,
        isSubjectToLongTermCarePremium,
        healthInsuranceProvider,
        region,
        dcPlanContributions,
        dependents,
        customEHIRates,
        manualSocialInsuranceEntry: manualSocialInsuranceEntry ?? false,
        manualSocialInsuranceAmount,
        incomeStreams,
        lifeInsurance,
        earthquakeInsurance,
        medicalExpenses,
        homeLoanTaxCredit,
      }),
    [
      chartRange,
      isEmploymentIncome,
      incomeYear,
      isSubjectToLongTermCarePremium,
      healthInsuranceProvider,
      region,
      dcPlanContributions,
      dependents,
      customEHIRates,
      manualSocialInsuranceEntry,
      manualSocialInsuranceAmount,
      incomeStreams,
      lifeInsurance,
      earthquakeInsurance,
      medicalExpenses,
      homeLoanTaxCredit,
    ],
  );

  // Get chart options using the utility function
  const chartOptions = useMemo<ChartOptions<'bar' | 'line'>>(() => {
    const baseOptions = getChartOptions(
      chartRange,
      currentIncome,
      distribution.median,
      useCompactLabelFormat,
    );

    // Enhance tooltips to include percentile and cap information
    return {
      ...baseOptions,
      plugins: {
        ...baseOptions.plugins,
        quintileBands: { boundaries: quintileBoundaries },
        tooltip: {
          ...baseOptions.plugins?.tooltip,
          callbacks: {
            ...baseOptions.plugins?.tooltip?.callbacks,
            afterTitle: (tooltipItems: TooltipItem<'bar' | 'line'>[]) => {
              if (tooltipItems.length > 0 && tooltipItems[0]?.parsed.x != null) {
                const income = tooltipItems[0].parsed.x;
                const estimate = estimateIncomePercentile(income, distribution.ranges);
                // Above the open-ended top bracket the survey supports only a bound, so the band
                // label is dropped there.
                const groupLabel = lowercaseFirst(distribution.label);
                let info = estimate.isTopBracket
                  ? `top ~${estimate.topBracketPercent.toFixed(1)}% of ${groupLabel}`
                  : `~${estimate.percentile.toFixed(1)} percentile of ${groupLabel}`;
                if (!estimate.isTopBracket) {
                  info += ` (${getQuintileBand(income, quintileBoundaries).label})`;
                }

                // Calculate full tax results for this income level to get cap status.
                // Scale the user's actual streams to the hovered income the same way
                // generateChartData does, so the cap badge matches the bars exactly.
                const taxInputs = {
                  incomeYear,
                  isEmploymentIncome,
                  isSubjectToLongTermCarePremium,
                  healthInsuranceProvider,
                  region,
                  dcPlanContributions,
                  dependents,
                  customEHIRates,
                  manualSocialInsuranceEntry: manualSocialInsuranceEntry ?? false,
                  manualSocialInsuranceAmount,
                  incomeStreams: scaleIncomeStreamsToIncome(incomeStreams, income),
                  lifeInsurance,
                  earthquakeInsurance,
                  medicalExpenses,
                  homeLoanTaxCredit,
                };

                const taxResults = calculateTaxes(taxInputs);

                // Use the calculated results for cap detection
                const capStatus = detectCaps(taxResults, incomeYear);

                if (capStatus.healthInsuranceCapped || capStatus.pensionCapped) {
                  const cappedItems: string[] = [];
                  if (capStatus.pensionCapped) cappedItems.push('Pension');
                  if (capStatus.healthInsuranceCapped) cappedItems.push('Health Insurance');
                  info += `\n🔒 Max reached: ${cappedItems.join(', ')}`;
                }

                return info;
              }
              return '';
            },
          },
        },
      },
    };
  }, [
    chartRange,
    currentIncome,
    incomeYear,
    useCompactLabelFormat,
    isEmploymentIncome,
    isSubjectToLongTermCarePremium,
    healthInsuranceProvider,
    region,
    dcPlanContributions,
    dependents,
    customEHIRates,
    manualSocialInsuranceEntry,
    manualSocialInsuranceAmount,
    lifeInsurance,
    earthquakeInsurance,
    medicalExpenses,
    homeLoanTaxCredit,
    incomeStreams,
    distribution,
    quintileBoundaries,
  ]);

  // Use media query to determine if we should show minor marks
  const showMinorMarks = useMediaQuery(theme.breakpoints.up('md'));

  // Combine marks based on screen size
  const visibleMarks = useMemo(() => {
    const marks = [...MAJOR_MARKS];
    if (showMinorMarks) {
      marks.push(...MINOR_MARKS);
    }
    // Sort marks by value to ensure consistent rendering
    return marks.sort((a, b) => a.value - b.value);
  }, [showMinorMarks]);

  // Determine if legend items should be visible
  const yourIncomeIsVisibleInChart =
    currentIncome > 0 && currentIncome >= chartRange.min && currentIncome <= chartRange.max;
  const medianIncomeIsVisibleInChart =
    distribution.median >= chartRange.min && distribution.median <= chartRange.max;

  const percentileEstimate = useMemo(
    () => estimateIncomePercentile(currentIncome, distribution.ranges),
    [currentIncome, distribution],
  );

  return (
    <Paper
      elevation={0}
      className={className}
      sx={{
        p: { xs: 1.2, sm: 3 },
        mt: { xs: 2, sm: 3 },
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 2,
      }}
    >
      <Box sx={{ mb: { xs: 1, sm: 2 } }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            fontSize: { xs: '1.08rem', sm: '1.3rem' },
            fontWeight: 700,
            mb: 0,
          }}
        >
          Take-Home Pay Chart
        </Typography>
      </Box>

      <Box className="chart-container" sx={{ mb: { xs: 1.2, sm: 2 }, position: 'relative' }}>
        <Chart
          ref={chartRef}
          type="bar"
          data={chartData}
          options={chartOptions}
          style={{ height: '100%', width: '100%' }}
        />
        {manualSocialInsuranceEntry && (
          <Paper
            elevation={2}
            sx={{
              position: 'absolute',
              top: '15%',
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'background.paper',
              opacity: 0.95,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'warning.main',
              textAlign: 'center',
              maxWidth: '90%',
              zIndex: 10,
            }}
          >
            <Typography
              variant="subtitle2"
              color="warning.main"
              sx={{ fontWeight: 600, fontSize: '0.9rem' }}
            >
              Comparative Data Unavailable
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', lineHeight: 1.3, mt: 0.5 }}
            >
              Data for other income levels cannot be calculated
              <br />
              when using manual social insurance entry.
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Custom Legend for Income Lines */}
      <Box
        className="chart-legend"
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: { xs: 0.7, sm: 2 },
          mb: { xs: 1.2, sm: 2 },
          mt: 0,
        }}
      >
        {currentIncome > 0 && (
          <Box
            className="legend-item"
            sx={{
              display: 'flex',
              alignItems: 'center',
              opacity: yourIncomeIsVisibleInChart ? 1 : 0.5,
              gap: 1,
            }}
          >
            <Box
              className="legend-marker"
              sx={{
                width: 2, // vertical line: narrow width
                height: 24, // vertical line: tall height
                borderRadius: 1,
                backgroundColor: YOUR_INCOME_COLOR,
                display: 'inline-block',
                mr: 1,
              }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: { xs: '0.97rem', sm: '1rem' },
                fontWeight: 500,
              }}
            >
              Input Income: {formatJPY(currentIncome)}
            </Typography>
          </Box>
        )}
        <Box
          className="legend-item"
          sx={{
            display: 'flex',
            alignItems: 'center',
            opacity: medianIncomeIsVisibleInChart ? 1 : 0.5,
            gap: 1,
          }}
        >
          <Box
            className="legend-marker"
            sx={{
              width: 2, // vertical line: narrow width
              height: 24, // vertical line: tall height
              borderRadius: 1,
              backgroundColor: MEDIAN_INCOME_COLOR,
              display: 'inline-block',
              mr: 1,
            }}
          />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontSize: { xs: '0.97rem', sm: '1rem' },
              fontWeight: 500,
            }}
          >
            Median Income: {formatJPY(distribution.median)}
          </Typography>
        </Box>
        {/* The comparison group reads inline within the percentile sentence. Always rendered
            (not gated on income): the selection also drives the median line, which is meaningful
            before any income is entered. */}
        <Box className="legend-item" sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography
            component="div"
            variant="body2"
            sx={{
              fontSize: { xs: '0.95rem', sm: '0.98rem' },
              fontWeight: 500,
              color: 'primary.main',
            }}
          >
            {currentIncome > 0
              ? percentileEstimate.isTopBracket
                ? `This income is in the top ~${percentileEstimate.topBracketPercent.toFixed(1)}% of `
                : `This income is higher than ~${percentileEstimate.percentile.toFixed(1)}% of `
              : 'Comparison group: '}
            <Select
              id="household-type"
              name="household-type"
              variant="standard"
              value={householdType}
              onChange={event => setHouseholdType(event.target.value as HouseholdType)}
              renderValue={value => lowercaseFirst(HOUSEHOLD_INCOME_DISTRIBUTIONS[value].label)}
              inputProps={{ 'aria-label': 'Comparison household type' }}
              sx={{
                verticalAlign: 'baseline',
                color: 'primary.main',
                fontSize: 'inherit',
                fontWeight: 600,
                '& .MuiSelect-select': { py: 0 },
                '& .MuiSelect-select:focus': { backgroundColor: 'transparent' },
                '& .MuiSelect-icon': { color: 'primary.main' },
              }}
            >
              {HOUSEHOLD_TYPE_ORDER.map(type => (
                <MenuItem key={type} value={type}>
                  {HOUSEHOLD_INCOME_DISTRIBUTIONS[type].label}
                </MenuItem>
              ))}
            </Select>
            {currentIncome > 0 && ' in Japan.'}
            <DetailedTooltip
              title="Household types (世帯類型)"
              icon={SIMPLE_TOOLTIP_ICON}
              iconAriaLabel="Learn more about the household types"
            >
              <Box>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  The survey reports the income distribution separately for each household type
                  (世帯類型) below. Picking one changes the income distribution compared with the
                  input income.
                </Typography>
                <Box component="dl" sx={{ m: 0 }}>
                  {HOUSEHOLD_TYPE_ORDER.map(type => (
                    <Box key={type} sx={{ mb: 1 }}>
                      <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>
                        {HOUSEHOLD_INCOME_DISTRIBUTIONS[type].label} (
                        {HOUSEHOLD_INCOME_DISTRIBUTIONS[type].labelJa})
                      </Typography>
                      <Typography
                        component="dd"
                        variant="body2"
                        sx={{ m: 0, fontSize: '0.85rem', color: 'text.secondary' }}
                      >
                        {HOUSEHOLD_INCOME_DISTRIBUTIONS[type].definition} Median{' '}
                        {formatJPY(HOUSEHOLD_INCOME_DISTRIBUTIONS[type].median)}.
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Typography variant="body2" sx={{ mt: 1.5, fontSize: '0.85rem' }}>
                  Some groups overlap — a household can be counted in more than one — so the six do
                  not add up to all households.
                </Typography>
                <SourceLinks sources={INCOME_SURVEY_SOURCES} />
              </Box>
            </DetailedTooltip>
          </Typography>
        </Box>

        {/* Quintile bands for the selected 世帯類型: published 五分位値 for 全世帯, estimated by
            inverting the bucketed distribution for every other type. */}
        <Box
          className="legend-item"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontSize: { xs: '0.92rem', sm: '0.95rem' },
              fontWeight: 500,
            }}
          >
            Background colors show income quintiles
          </Typography>
          <DetailedTooltip
            title="Income Distribution Quintiles"
            icon={SIMPLE_TOOLTIP_ICON}
            iconAriaLabel="Learn more about income distribution quintiles"
          >
            <Box>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                The colored background bands divide the selected household type into five equal
                groups (quintiles) by household income:
              </Typography>

              {/* Quintile Data Table */}
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  mb: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  // Shared styles for table cells
                  '& th, & td': {
                    p: 1,
                    fontSize: '0.85rem',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                  '& th': {
                    fontWeight: 600,
                  },
                  '& td:last-child, & th:last-child': {
                    textAlign: 'right',
                  },
                  '& tr:last-child td': {
                    borderBottom: 'none',
                  },
                }}
              >
                <Box component="thead" sx={{ bgcolor: 'action.hover' }}>
                  <Box component="tr">
                    <Box component="th">Percentile</Box>
                    <Box component="th">Income Range</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {QUINTILE_BAND_STYLES.map((style, i) => (
                    <Box component="tr" key={style.label}>
                      <Box component="td">{style.label.replace(' percentile', '')}</Box>
                      <Box component="td">
                        {i === 0 && <>¥0 - {formatQuintileBoundary(quintileBoundaries[0]!)}</>}
                        {i > 0 && i < QUINTILE_BAND_STYLES.length - 1 && (
                          <>
                            {formatQuintileBoundary(quintileBoundaries[i - 1]!)} -{' '}
                            {formatQuintileBoundary(quintileBoundaries[i]!)}
                          </>
                        )}
                        {i === QUINTILE_BAND_STYLES.length - 1 && (
                          <>{formatQuintileBoundary(quintileBoundaries[3]!)} and above</>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Explanation of quintiles and percentiles */}
              <Box
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 0.5 }}>
                  What are percentiles and quintiles?
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem', mb: 0.5 }}>
                  <strong>Percentiles:</strong> An income in the 70th percentile is higher than 70%
                  of all households.
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem', mb: 0.5 }}>
                  <strong>Quintiles:</strong> The population divided into 5 equal groups (20% each),
                  from lowest to highest income.
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                  The survey publishes exact quintile boundaries only for all households. For other
                  household types, boundaries are estimated from income distribution data.
                </Typography>
              </Box>
              <SourceLinks sources={INCOME_SURVEY_SOURCES} />
            </Box>
          </DetailedTooltip>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          mt: { xs: 1.2, sm: 2 },
          p: { xs: 1.2, sm: 2 },
          bgcolor: 'action.hover',
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden', // keep for rounded corners
          width: '100%',
          boxShadow: 'none',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            pb: 3,
          }}
        >
          <Typography
            id="range-slider"
            variant="subtitle2"
            gutterBottom
            sx={{
              fontSize: { xs: '1rem', sm: '1.1rem' },
              fontWeight: 600,
              mb: { xs: 0.5, sm: 1 },
            }}
          >
            Chart Income Range: {formatJPY(chartRange.min)} - {formatJPY(chartRange.max)}
          </Typography>
          <Box
            sx={{
              width: '100%',
              maxWidth: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 48px)' }, // leave space for labels
              mx: 'auto',
            }}
          >
            <Slider
              value={[chartRange.min, chartRange.max]}
              onChange={handleManualRangeChange}
              valueLabelDisplay="off"
              min={0}
              max={100000000}
              step={STEP_SIZE}
              marks={visibleMarks}
              aria-labelledby="range-slider"
              getAriaLabel={index => (index === 0 ? 'Minimum income' : 'Maximum income')}
              getAriaValueText={value => formatJPY(value)}
              className="range-slider"
              sx={{
                mt: 0,
                mb: 0,
                '& .MuiSlider-thumb': {
                  width: 18,
                  height: 18,
                },
                '& .MuiSlider-markLabel': {
                  fontSize: { xs: '0.92rem', sm: '1rem' },
                  whiteSpace: 'nowrap',
                },
              }}
            />
          </Box>
        </Box>
      </Paper>
    </Paper>
  );
};

export default TakeHomeChart;
