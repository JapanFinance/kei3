import type { Plugin, Chart } from 'chart.js';
import type { TakeHomeInputs } from '../types/tax';
import { EMPLOYEES_PENSION_PREMIUM } from './pensionCalculator';
import { getHealthInsurancePremiumTable } from '../data/employeesHealthInsurance';
import { getNationalHealthInsuranceParams } from '../data/nationalHealthInsurance';
import { HealthInsuranceProvider } from '../types/healthInsurance';

/**
 * Chart.js plugin to show contribution cap indicators
 */
export const capIndicatorPlugin: Plugin<'bar' | 'line'> = {
  id: 'capIndicatorPlugin',
  afterDraw: (chart: Chart) => {
    const { ctx, chartArea, scales } = chart;
    const { x: xScale, y: yScale } = scales;
    
    if (!chartArea || !xScale || !yScale) return;
    
    // Get the current inputs from chart options (using generic any type to avoid TS issues)
    const pluginData = (chart.options as any)?.plugins?.capIndicatorPlugin?.data;
    if (!pluginData) return;
    
    const { currentInputs } = pluginData;
    if (!currentInputs) return;
    
    ctx.save();
    
    // Calculate the income levels where caps start
    const capIncomes = calculateCapIncomes(currentInputs);
    
    // Draw vertical lines at cap thresholds
    capIncomes.forEach(({ income, label, color }) => {
      if (income >= xScale.min && income <= xScale.max) {
        const x = xScale.getPixelForValue(income);
        
        // Draw vertical line
        ctx.beginPath();
        ctx.moveTo(x, yScale.top);
        ctx.lineTo(x, yScale.bottom);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        
        // Draw label
        ctx.fillStyle = color;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // Position label at top of chart
        const labelY = yScale.top - 10;
        ctx.fillText(label, x, labelY);
      }
    });
    
    ctx.restore();
  }
};

interface CapIncome {
  income: number;
  label: string;
  color: string;
}

/**
 * Calculate the income levels where contribution caps start
 */
function calculateCapIncomes(inputs: Omit<TakeHomeInputs, 'annualIncome' | 'showDetailedInput'>): CapIncome[] {
  const capIncomes: CapIncome[] = [];
  
  // Calculate pension cap income
  if (inputs.isEmploymentIncome) {
    const pensionCapIncome = calculatePensionCapIncome();
    if (pensionCapIncome > 0) {
      capIncomes.push({
        income: pensionCapIncome,
        label: 'Pension Cap',
        color: 'rgb(138, 43, 226)', // Purple - matches pension color
      });
    }
  }
  
  // Calculate health insurance cap income
  const healthInsuranceCapIncome = calculateHealthInsuranceCapIncome(inputs);
  if (healthInsuranceCapIncome > 0) {
    capIncomes.push({
      income: healthInsuranceCapIncome,
      label: 'Health Insurance Cap',
      color: 'rgb(255, 140, 0)', // Orange - matches health insurance color
    });
  }
  
  return capIncomes;
}

/**
 * Calculate the annual income where pension contributions cap out
 */
function calculatePensionCapIncome(): number {
  const lastBracket = EMPLOYEES_PENSION_PREMIUM[EMPLOYEES_PENSION_PREMIUM.length - 1];
  
  // The cap starts at the minimum of the last bracket (which has max: null)
  if (lastBracket.max === null) {
    return lastBracket.min * 12; // Convert monthly to annual
  }
  
  return 0; // No cap found
}

/**
 * Calculate the annual income where health insurance contributions cap out
 */
function calculateHealthInsuranceCapIncome(inputs: Omit<TakeHomeInputs, 'annualIncome' | 'showDetailedInput'>): number {
  if (inputs.healthInsuranceProvider.id === HealthInsuranceProvider.NATIONAL_HEALTH_INSURANCE.id) {
    // For NHI, caps are complex and depend on multiple factors
    // For now, we'll estimate based on when any component starts hitting caps
    const nhiParams = getNationalHealthInsuranceParams(inputs.prefecture as string);
    if (!nhiParams) return 0;
    
    // Estimate income where medical portion starts hitting cap
    // This is a rough approximation
    const estimatedCapIncome = (nhiParams.medicalCap - nhiParams.medicalPerCapita) / nhiParams.medicalRate + nhiParams.nhiStandardDeduction;
    return Math.max(0, estimatedCapIncome);
  } else {
    // For employee health insurance, find the last bracket
    const premiumTable = getHealthInsurancePremiumTable(inputs.healthInsuranceProvider.id, inputs.prefecture);
    if (!premiumTable || premiumTable.length === 0) return 0;
    
    const lastBracket = premiumTable[premiumTable.length - 1];
    
    // The cap starts at the minimum of the last bracket (which has maxIncomeExclusive: Infinity)
    if (lastBracket.maxIncomeExclusive === Infinity) {
      return lastBracket.minIncomeInclusive * 12; // Convert monthly to annual
    }
  }
  
  return 0; // No cap found
}
