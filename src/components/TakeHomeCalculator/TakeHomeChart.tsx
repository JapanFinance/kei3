import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController } from 'chart.js';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { ChartRange } from '../../types/tax';
import { formatJPY } from '../../utils/formatters';
import { generateChartData, getChartOptions, currentAndMedianIncomeChartPlugin } from '../../utils/chartConfig';
import type { HealthInsuranceProviderId } from '../../types/healthInsurance';
import { MEDIAN_INCOME_VALUE, QUINTILE_DATA, INCOME_RANGE_DISTRIBUTION } from '../../data/income';
import { InfoTooltip } from '../ui/InfoTooltip';
import { detectCaps } from '../../utils/capDetection';
import { calculateTaxes } from '../../utils/taxCalculations';

// Percentile bands configuration
const QUINTILE_BANDS = [
  { min: 0, max: QUINTILE_DATA[20], label: '0-20th percentile', color: 'rgba(255, 99, 132, 0.1)' },      // Light red
  { min: QUINTILE_DATA[20], max: QUINTILE_DATA[40], label: '20-40th percentile', color: 'rgba(255, 159, 64, 0.1)' },   // Light orange
  { min: QUINTILE_DATA[40], max: QUINTILE_DATA[60], label: '40-60th percentile', color: 'rgba(153, 102, 255, 0.1)' },  // Light purple
  { min: QUINTILE_DATA[60], max: QUINTILE_DATA[80], label: '60-80th percentile', color: 'rgba(46, 125, 50, 0.1)' },    // Light green
  { min: QUINTILE_DATA[80], max: Infinity, label: '80-100th percentile', color: 'rgba(54, 162, 235, 0.1)' },           // Light blue
];

// Chart.js plugin for percentile background bands
const percentileBandsPlugin = {
  id: 'percentileBands',
  beforeDraw: (chart: ChartJS<'bar' | 'line'>) => {
    const { ctx, scales } = chart;
    const { x: xScale, y: yScale } = scales;
    
    if (!xScale || !yScale) return;
    
    ctx.save();
    
    // Draw each percentile band
    QUINTILE_BANDS.forEach(band => {
      const xMin = Math.max(xScale.getPixelForValue(band.min), xScale.left);
      const xMax = Math.min(xScale.getPixelForValue(band.max), xScale.right);
      
      if (xMax > xMin) {
        ctx.fillStyle = band.color;
        ctx.fillRect(xMin, yScale.top, xMax - xMin, yScale.height);
      }
    });
    
    // Draw dotted lines between bands
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); // Create dotted line pattern
    
    // Draw vertical lines at each percentile boundary
    [QUINTILE_DATA[20], QUINTILE_DATA[40], QUINTILE_DATA[60], QUINTILE_DATA[80]].forEach(value => {
      const x = xScale.getPixelForValue(value);
      if (x >= xScale.left && x <= xScale.right) {
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.stroke();
      }
    });
    
    ctx.restore();
  }
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
  percentileBandsPlugin
);

interface TakeHomeChartProps {
  currentIncome: number;
  isEmploymentIncome: boolean;
  isSubjectToLongTermCarePremium: boolean;
  healthInsuranceProvider: HealthInsuranceProviderId;
  region: string;
  dcPlanContributions: number;
  className?: string;
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

// Utility function to calculate income percentile
const calculateEstimatedIncomePercentile = (income: number): number => {
  if (income <= 0) return 0;
  
  // Use detailed income range distribution data for accurate calculation
  let cumulativePercent = 0;
  
  // Find the income range and calculate cumulative percentage
  for (const [, range] of Object.entries(INCOME_RANGE_DISTRIBUTION)) {
    if (income < range.max_exclusive) {
      // Income falls within this range
      if (income >= range.min_inclusive) {
        // Calculate position within the range
        const rangeSpan = range.max_exclusive - range.min_inclusive;
        const positionInRange = income - range.min_inclusive;
        const percentWithinRange = rangeSpan > 0 ? (positionInRange / rangeSpan) * range.percent : 0;
        
        return cumulativePercent + percentWithinRange;
      } else {
        // Income is below this range, return cumulative up to previous ranges
        return cumulativePercent;
      }
    }
    cumulativePercent += range.percent;
  }
  // The distribution covers up to Infinity, so this should never be reached
  throw new Error(`Income ${formatJPY(income)} not within distribution range`);
};

// Utility function to get percentile band for income
const getPercentileBand = (income: number): { label: string; color: string } => {
  const band = QUINTILE_BANDS.find(b => income >= b.min && income < b.max) || QUINTILE_BANDS[QUINTILE_BANDS.length - 1]!;
  return { label: band.label, color: band.color };
};

const TakeHomeChart: React.FC<TakeHomeChartProps> = ({ 
  currentIncome, 
  isEmploymentIncome,
  isSubjectToLongTermCarePremium,
  healthInsuranceProvider,
  region,
  dcPlanContributions,
  className = ''
}) => {
  const [chartRange, setChartRange] = useState<ChartRange>({
    min: 0,
    max: 10000000, // 10 million yen
  });
  
  // Track whether the user has manually adjusted the range
  const [hasManuallyAdjustedRange, setHasManuallyAdjustedRange] = useState(false);
  
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
  
  // Auto-adjust range when income changes, but only if user hasn't manually adjusted it
  useEffect(() => {
    if (!hasManuallyAdjustedRange && currentIncome > 0) {
      const newRange = calculateAutoCenteredRange(currentIncome);
      setChartRange(newRange);
    }
  }, [currentIncome, hasManuallyAdjustedRange]);
  
  const handleManualRangeChange = (_: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue) && newValue.length >= 2) {
      setChartRange({ min: newValue[0]!, max: newValue[1]! });
      // Mark that the user has manually adjusted the range
      setHasManuallyAdjustedRange(true);
    }
  };
  
  const theme = useTheme();
  const useCompactLabelFormat = useMediaQuery(theme.breakpoints.down('md'));

  const chartRef = useRef<ChartJS<'bar' | 'line'>>(null);

  // Generate chart data using the utility function
  const chartData = useMemo<ChartData<'bar' | 'line'>>(
    () => generateChartData(chartRange, { 
      isEmploymentIncome, 
      isSubjectToLongTermCarePremium, 
      healthInsuranceProvider, 
      region,
      dcPlanContributions,
      numberOfDependents: 0 // TODO: Replace 0 with actual value if available
    }),
    [chartRange, isEmploymentIncome, isSubjectToLongTermCarePremium, healthInsuranceProvider, region, dcPlanContributions]
  );

  // Get chart options using the utility function
  const chartOptions = useMemo<ChartOptions<'bar' | 'line'>>(
    () => {
      const baseOptions = getChartOptions(chartRange, currentIncome, useCompactLabelFormat);
      
      // Enhance tooltips to include percentile and cap information
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins?.tooltip,
            callbacks: {
              ...baseOptions.plugins?.tooltip?.callbacks,
              afterTitle: (tooltipItems: TooltipItem<'bar' | 'line'>[]) => {
                if (tooltipItems.length > 0 && tooltipItems[0]?.parsed?.x != null) {
                  const income = tooltipItems[0].parsed.x;
                  const estimatedPercentile = calculateEstimatedIncomePercentile(income);
                  const band = getPercentileBand(income);
                  let info = `~${estimatedPercentile.toFixed(1)} percentile (${band.label})`;
                  
                  // Calculate full tax results for this income level to get cap status
                  const taxInputs = {
                    annualIncome: income,
                    isEmploymentIncome,
                    isSubjectToLongTermCarePremium,
                    healthInsuranceProvider,
                    region,
                    dcPlanContributions,
                    numberOfDependents: 0,
                    showDetailedInput: false,
                  };
                  
                  const taxResults = calculateTaxes(taxInputs);
                  
                  // Use the calculated results for cap detection
                  const capStatus = detectCaps(taxResults);
                  
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
    },
    [chartRange, currentIncome, useCompactLabelFormat, isEmploymentIncome, isSubjectToLongTermCarePremium, healthInsuranceProvider, region, dcPlanContributions]
  );

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
  const yourIncomeIsVisibleInChart = currentIncome > 0 && currentIncome >= chartRange.min && currentIncome <= chartRange.max;
  const medianIncomeIsVisibleInChart = MEDIAN_INCOME_VALUE >= chartRange.min && MEDIAN_INCOME_VALUE <= chartRange.max;

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
      
      <Box className="chart-container" sx={{ mb: { xs: 1.2, sm: 2 } }}>
        <Chart 
          ref={chartRef}
          type="bar" 
          data={chartData} 
          options={chartOptions}
          style={{ height: '100%', width: '100%' }}
        />
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
                width: 2,           // vertical line: narrow width
                height: 24,         // vertical line: tall height
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
              Your Income: {formatJPY(currentIncome)}
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
              width: 2,           // vertical line: narrow width
              height: 24,         // vertical line: tall height
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
            Median Income: {formatJPY(MEDIAN_INCOME_VALUE)}
          </Typography>
        </Box>
        {currentIncome > 0 && (
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
                fontSize: { xs: '0.95rem', sm: '0.98rem' },
                fontWeight: 500,
                color: 'primary.main',
              }}
            >
              Your income is higher than ~{calculateEstimatedIncomePercentile(currentIncome).toFixed(1)}% of households in Japan.
            </Typography>
          </Box>
        )}
        
        {/* Quintile Bands Legend Item */}
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
            Background colors show income distribution quintiles
          </Typography>
          <InfoTooltip
            title="Income Distribution Quintiles"
            iconSx={{ 
              width: 18, 
              height: 18, 
              color: 'text.secondary',
            }}
            iconAriaLabel="Learn more about income distribution quintiles"
          >
            <Box>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Income Distribution Quintiles in Japan
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                The colored background bands represent household income distribution quintiles based on official Japanese government data:
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
                    <Box component="th">
                      Percentile
                    </Box>
                    <Box component="th">
                      Income Range
                    </Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  <Box component="tr">
                    <Box component="td">
                      0-20th
                    </Box>
                    <Box component="td">
                      ¥0 - {formatJPY(QUINTILE_DATA[20])}
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box component="td">
                      20-40th
                    </Box>
                    <Box component="td">
                      {formatJPY(QUINTILE_DATA[20])} - {formatJPY(QUINTILE_DATA[40])}
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box component="td">
                      40-60th
                    </Box>
                    <Box component="td">
                      {formatJPY(QUINTILE_DATA[40])} - {formatJPY(QUINTILE_DATA[60])}
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box component="td">
                      60-80th
                    </Box>
                    <Box component="td">
                      {formatJPY(QUINTILE_DATA[60])} - {formatJPY(QUINTILE_DATA[80])}
                    </Box>
                  </Box>
                  <Box component="tr">
                    <Box component="td">
                      80-100th
                    </Box>
                    <Box component="td">
                      {formatJPY(QUINTILE_DATA[80])} and above
                    </Box>
                  </Box>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mt: 1.5, mb: 1.5, fontSize: '0.9rem', fontStyle: 'italic' }}>
                Data source: <a 
                  href="https://www.mhlw.go.jp/toukei/saikin/hw/k-tyosa/k-tyosa24/index.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Ministry of Health, Labour and Welfare's 2024 Comprehensive Survey of Living Conditions
                </a>
              </Typography>
              
              {/* Explanation of quintiles and percentiles */}
              <Box sx={{ 
                mt: 1.5, 
                p: 1.5, 
                bgcolor: 'action.hover',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 0.5 }}>
                  What are percentiles and quintiles?
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem', mb: 0.5 }}>
                  <strong>Percentiles:</strong> If you're in the 70th percentile, your income is higher than 70% of all households.
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                  <strong>Quintiles:</strong> The population divided into 5 equal groups (20% each), from lowest to highest income.
                </Typography>
              </Box>
            </Box>
          </InfoTooltip>
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
        <Box sx={{ 
          position: 'relative', 
          zIndex: 1, 
          width: '100%', 
          pb: 3,
        }}>
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
              valueLabelFormat={(value) => `¥${formatJPY(value)}`}
              aria-labelledby="range-slider"
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
