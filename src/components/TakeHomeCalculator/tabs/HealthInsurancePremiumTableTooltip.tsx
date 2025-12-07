import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import { DEFAULT_PROVIDER_REGION, NATIONAL_HEALTH_INSURANCE_ID, CUSTOM_PROVIDER_ID } from '../../../types/healthInsurance';
import { generateHealthInsurancePremiumTable, generatePremiumTableFromRates } from '../../../data/employeesHealthInsurance/providerRates';
import { getNationalHealthInsuranceParams } from '../../../data/nationalHealthInsurance/nhiParamsData';
import PremiumTableTooltip from './PremiumTableTooltip';
import { PROVIDER_DEFINITIONS } from '../../../data/employeesHealthInsurance/providerRateData';

// TODO: Refactor this to use a more specific type. Clearly this was made to ignore typescript errors rather than define a proper type.
type PremiumTableRow = Record<string, unknown>;

interface HealthInsurancePremiumTableTooltipProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

const HealthInsurancePremiumTableTooltip: React.FC<HealthInsurancePremiumTableTooltipProps> = ({ results, inputs }) => {
  const provider = inputs.healthInsuranceProvider;
  const region = inputs.region;
  const monthlyIncome = results.annualIncome / 12;

  if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
    // National Health Insurance - show region parameters
    const regionData = getNationalHealthInsuranceParams(region);
    if (!regionData) {
      const fallbackContent = (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            National Health Insurance Parameters
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Premium calculation parameters for {region} are not available in the current data.
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 1 }}>
            💡 National Health Insurance premiums vary by municipality. Please check with your local city/ward office for specific rates.
          </Typography>
        </Box>
      );

      return (
        <PremiumTableTooltip
          title=""
          description=""
          tableData={[]}
          columns={[]}
          currentRow={null}
          monthlyIncome={monthlyIncome}
          tableContainerDataAttr="data-table-container"
          currentRowId="current-income-row"
          getIncomeRange={() => ''}
          getCurrentRowSummary={() => ''}
          fallbackContent={fallbackContent}
        />
      );
    }

    // Return National Health Insurance parameters display
    // Use the same income base that the actual calculation uses:
    // - For employment income: use net employment income (after employment income deduction)
    // - For non-employment income: use gross annual income
    const incomeForNHICalculation = results.isEmploymentIncome && results.netEmploymentIncome 
      ? results.netEmploymentIncome 
      : results.annualIncome;
    const includeNursingCareInsurance = inputs.isSubjectToLongTermCarePremium;
    
    // Calculate step-by-step breakdown like the actual calculation
    // Note: NHI premiums are based on previous year's income, but we're using current year as assumption
    const nhiTaxableIncome = Math.max(0, incomeForNHICalculation - regionData.nhiStandardDeduction);
    
    // 1. Medical Portion (医療分)
    const incomeBasedMedical = nhiTaxableIncome * regionData.medicalRate;
    const perCapitaMedical = regionData.medicalPerCapita;
    const householdFlatMedical = regionData.medicalHouseholdFlat || 0;
    const uncappedMedical = incomeBasedMedical + perCapitaMedical + householdFlatMedical;
    const totalMedicalPremium = Math.min(uncappedMedical, regionData.medicalCap);
    
    // 2. Elderly Support Portion (後期高齢者支援金分)
    const incomeBasedSupport = nhiTaxableIncome * regionData.supportRate;
    const perCapitaSupport = regionData.supportPerCapita;
    const householdFlatSupport = regionData.supportHouseholdFlat || 0;
    const uncappedSupport = incomeBasedSupport + perCapitaSupport + householdFlatSupport;
    const totalSupportPremium = Math.min(uncappedSupport, regionData.supportCap);
    
    // 3. Long-Term Care Portion (介護納付金分) - only for those aged 40-64
    let incomeBasedLtc = 0;
    let perCapitaLtc = 0;
    let householdFlatLtc = 0;
    let uncappedLtc = 0;
    let totalLtcPremium = 0;
    if (includeNursingCareInsurance && regionData.ltcRateForEligible && regionData.ltcPerCapitaForEligible && regionData.ltcCapForEligible) {
      incomeBasedLtc = nhiTaxableIncome * regionData.ltcRateForEligible;
      perCapitaLtc = regionData.ltcPerCapitaForEligible;
      householdFlatLtc = regionData.ltcHouseholdFlatForEligible || 0;
      uncappedLtc = incomeBasedLtc + perCapitaLtc + householdFlatLtc;
      totalLtcPremium = Math.min(uncappedLtc, regionData.ltcCapForEligible);
    }
    
    const totalCalculatedPremium = totalMedicalPremium + totalSupportPremium + totalLtcPremium;

    const fallbackContent = (
      <Box sx={{ minWidth: { xs: 0, sm: 400 }, maxWidth: { xs: '100vw', sm: 460 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          National Health Insurance - {regionData.regionName}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
          NHI premiums are calculated using income-based rates plus per-capita amounts, with annual caps applied to each portion.
          NHI premiums are based on last year's reported income.
          These calculations assume your income is the same as the previous year.
        </Typography>

        {/* Medical Portion */}
        <Box sx={{ mb: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem', color: 'primary.main' }}>
            🏥 Medical Portion (医療分)
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Income-based (所得割): <strong>{(regionData.medicalRate * 100).toFixed(2)}%</strong> × {formatJPY(nhiTaxableIncome)} = {formatJPY(incomeBasedMedical)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Per-capita (均等割): {formatJPY(perCapitaMedical)}
          </Typography>
          {householdFlatMedical > 0 && (
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Household flat rate (平等割): {formatJPY(householdFlatMedical)}
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Subtotal: {formatJPY(uncappedMedical)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Annual Cap: {formatJPY(regionData.medicalCap)}
          </Typography>
          <Typography variant="body2" sx={{ 
            fontSize: '0.85rem', 
            fontWeight: 600, 
            color: uncappedMedical > regionData.medicalCap ? 'warning.main' : 'success.main',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}>
            = Final: {formatJPY(totalMedicalPremium)} 
            {uncappedMedical > regionData.medicalCap && (
              <Box component="span" sx={{ 
                px: 0.5, 
                py: 0.2, 
                borderRadius: 0.5, 
                bgcolor: 'warning.light', 
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'warning.contrastText'
              }}>
                🔒 CAPPED
              </Box>
            )}
          </Typography>
        </Box>

        {/* Support Portion */}
        <Box sx={{ mb: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem', color: 'primary.main' }}>
            👥 Elderly Support Portion (後期高齢者支援金分)
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Income-based (所得割): <strong>{(regionData.supportRate * 100).toFixed(2)}%</strong> × {formatJPY(nhiTaxableIncome)} = {formatJPY(incomeBasedSupport)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Per-capita (均等割): {formatJPY(perCapitaSupport)}
          </Typography>
          {householdFlatSupport > 0 && (
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Household flat rate (平等割): {formatJPY(householdFlatSupport)}
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Subtotal: {formatJPY(uncappedSupport)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
            Annual Cap: {formatJPY(regionData.supportCap)}
          </Typography>
          <Typography variant="body2" sx={{ 
            fontSize: '0.85rem', 
            fontWeight: 600, 
            color: uncappedSupport > regionData.supportCap ? 'warning.main' : 'success.main',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}>
            = Final: {formatJPY(totalSupportPremium)} 
            {uncappedSupport > regionData.supportCap && (
              <Box component="span" sx={{ 
                px: 0.5, 
                py: 0.2, 
                borderRadius: 0.5, 
                bgcolor: 'warning.light', 
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'warning.contrastText'
              }}>
                🔒 CAPPED
              </Box>
            )}
          </Typography>
        </Box>

        {/* LTC Portion (if applicable) */}
        {includeNursingCareInsurance && regionData.ltcRateForEligible && (
          <Box sx={{ mb: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.9rem', color: 'primary.main' }}>
              🏠 Long-Term Care Portion (介護納付金分) - Ages 40-64
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Income-based (所得割): <strong>{(regionData.ltcRateForEligible * 100).toFixed(2)}%</strong> × {formatJPY(nhiTaxableIncome)} = {formatJPY(incomeBasedLtc)}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Per-capita (均等割): {formatJPY(perCapitaLtc)}
            </Typography>
            {householdFlatLtc > 0 && (
              <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
                Household flat rate (平等割): {formatJPY(householdFlatLtc)}
              </Typography>
            )}
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Subtotal: {formatJPY(uncappedLtc)}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 0.3 }}>
              Annual Cap: {formatJPY(regionData.ltcCapForEligible!)}
            </Typography>
            <Typography variant="body2" sx={{ 
              fontSize: '0.85rem', 
              fontWeight: 600, 
              color: uncappedLtc > regionData.ltcCapForEligible! ? 'warning.main' : 'success.main',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}>
              = Final: {formatJPY(totalLtcPremium)} 
              {uncappedLtc > regionData.ltcCapForEligible! && (
                <Box component="span" sx={{ 
                  px: 0.5, 
                  py: 0.2, 
                  borderRadius: 0.5, 
                  bgcolor: 'warning.light', 
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'warning.contrastText'
                }}>
                  🔒 CAPPED
                </Box>
              )}
            </Typography>
          </Box>
        )}

        {!includeNursingCareInsurance && (
          <Box sx={{ mb: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'text.secondary' }}>
              🏠 Long-Term Care Portion: Not applicable (under 40 or over 64 years old)
            </Typography>
          </Box>
        )}

        {/* Verification note */}
        {Math.abs(totalCalculatedPremium - results.healthInsurance) > 1 && (
          <Box sx={{ mt: 1, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'warning.contrastText' }}>
              ⚠️ Note: Calculated total ({formatJPY(totalCalculatedPremium)}) differs from system calculation ({formatJPY(results.healthInsurance)}). This may be due to rounding or different calculation methods.
            </Typography>
          </Box>
        )}

        {/* Source link */}
        {regionData.source && (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              <strong>Source:</strong>{' '}
              <a 
                href={regionData.source} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                Official NHI Premium Information
              </a>
            </Typography>
          </Box>
        )}
      </Box>
    );

    return (
      <PremiumTableTooltip
        title=""
        description=""
        tableData={[]}
        columns={[]}
        currentRow={null}
        monthlyIncome={monthlyIncome}
        tableContainerDataAttr="data-table-container"
        currentRowId="current-income-row"
        getIncomeRange={() => ''}
        getCurrentRowSummary={() => ''}
        fallbackContent={fallbackContent}
      />
    );
  } else {
    // Employee Health Insurance - show premium table
    let premiumTableAsRows;
    let sourceUrl;
    let providerLabel;

    if (provider === CUSTOM_PROVIDER_ID) {
      // Generate table for custom provider using input rates
      const customRates = {
        employeeHealthInsuranceRate: inputs.customHealthInsuranceRate / 100,
        employeeLongTermCareRate: inputs.customLongTermCareRate / 100,
        // Employer rates not needed for this table as we only show employee portion
      };
      
      premiumTableAsRows = generatePremiumTableFromRates(customRates);
      
      providerLabel = "Custom Provider";
    } else {
      premiumTableAsRows = generateHealthInsurancePremiumTable(provider, region);
      const providerDef = PROVIDER_DEFINITIONS[provider];
      const regionalRates = providerDef?.regions[region] || providerDef?.regions['DEFAULT'];
      sourceUrl = regionalRates?.source || providerDef?.defaultSource;
      providerLabel = `${PROVIDER_DEFINITIONS[provider]!.providerName}${region === DEFAULT_PROVIDER_REGION ? '' : ` (${region})`}`;
    }
    
    if (!premiumTableAsRows) {
      const fallbackContent = (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Premium Table
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Premium table for {provider} in {region} is not available in the current data.
          </Typography>
          {sourceUrl && (
            <Typography variant="body2" sx={{ fontSize: '0.8rem', mt: 1 }}>
              <strong>Source:</strong>{' '}
              <a 
                href={sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                {sourceUrl}
              </a>
            </Typography>
          )}
        </Box>
      );

      return (
        <PremiumTableTooltip
          title=""
          description=""
          tableData={[]}
          columns={[]}
          currentRow={null}
          monthlyIncome={monthlyIncome}
          tableContainerDataAttr="data-table-container"
          currentRowId="current-income-row"
          getIncomeRange={() => ''}
          getCurrentRowSummary={() => ''}
          fallbackContent={fallbackContent}
        />
      );
    }

    
    // Find the current row for the user's income
    const currentRow = premiumTableAsRows.find((row) => 
      monthlyIncome >= row.minIncomeInclusive && 
      monthlyIncome < row.maxIncomeExclusive
    );

    const columns = [
      { header: 'Monthly Salary', getValue: () => 0, align: 'left' as const },
      { header: 'Employee', getValue: (row: PremiumTableRow) => (row as unknown as { employeePremiumNoLTC: number }).employeePremiumNoLTC },
      { header: 'With LTC', getValue: (row: PremiumTableRow) => (row as unknown as { employeePremiumWithLTC: number }).employeePremiumWithLTC },
    ];

    const getIncomeRange = (row: PremiumTableRow) => {
      const healthRow = row as unknown as { minIncomeInclusive: number; maxIncomeExclusive: number };
      return `${formatJPY(healthRow.minIncomeInclusive)} - ${
        healthRow.maxIncomeExclusive === Infinity ? '∞' : formatJPY(healthRow.maxIncomeExclusive)
      }`;
    };

    const getCurrentRowSummary = (row: PremiumTableRow) => {
      const healthRow = row as unknown as { employeePremiumNoLTC: number; employeePremiumWithLTC: number };
      return `Your premium: ${formatJPY(inputs.isSubjectToLongTermCarePremium ? healthRow.employeePremiumWithLTC : healthRow.employeePremiumNoLTC)}/month`;
    };

    const premiumTableAsTypedRows = premiumTableAsRows as unknown as PremiumTableRow[];

    const baseProps = {
      title: `Health Insurance Premium Table - ${providerLabel}`,
      description: "Monthly premiums by income bracket. Your income: {monthlyIncome}/month",
      hint: "💡 LTC stands for Long-Term Care, which is an additional premium insured people ages 40-64 need to pay.",
      tableData: premiumTableAsTypedRows,
      columns,
      currentRow: currentRow || null,
      monthlyIncome,
      tableContainerDataAttr: "data-table-container",
      currentRowId: "current-income-row",
      getIncomeRange,
      getCurrentRowSummary,
    };

    return (
      <PremiumTableTooltip
        {...baseProps}
        {...(sourceUrl ? { officialSourceLink: { url: sourceUrl, text: `${providerLabel} Premium Rates` } } : {})}
      />
    );
  }
};

export default HealthInsurancePremiumTableTooltip;
