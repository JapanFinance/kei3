// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ThemeToggle from './components/ThemeToggle'
import ChangelogButton from './components/ChangelogButton'
import { TakeHomeInputForm } from './components/TakeHomeCalculator/InputForm'
import type { TakeHomeFormState, TakeHomeInputs, TakeHomeResults, IncomeStream } from './types/tax'
import { calculateTaxes, normalizeIncomeStreams } from './utils/taxCalculations'
import { DEFAULT_PROVIDER_REGION, NATIONAL_HEALTH_INSURANCE_ID, DEFAULT_PROVIDER, DEPENDENT_COVERAGE_ID, isDependentCoverageEligible } from './types/healthInsurance'
import { NATIONAL_HEALTH_INSURANCE_REGIONS } from './data/nationalHealthInsurance/nhiParamsData'
import { PROVIDER_DEFINITIONS } from './data/employeesHealthInsurance/providerRateData'
import { useChangelogModal } from './hooks/useChangelogModal'

// Lazy load components that aren't immediately needed
const TakeHomeResultsDisplay = lazy(() => import('./components/TakeHomeCalculator/TakeHomeResults'))
const TakeHomeChart = lazy(() => import('./components/TakeHomeCalculator/TakeHomeChart'))
const ChangelogModal = lazy(() => import('./components/ChangelogModal'))

interface AppProps {
  mode: 'light' | 'dark';
  toggleColorMode: () => void;
}

function App({ mode, toggleColorMode }: AppProps) {
  // Changelog modal management
  const { isOpen: isChangelogOpen, openModal: openChangelog, closeModal: closeChangelog } = useChangelogModal();

  // Default values for the form
  const defaultInputs: TakeHomeFormState = {
    annualIncome: 5_000_000, // 5 million yen
    incomeMode: 'salary',
    incomeStreams: [],
    isSubjectToLongTermCarePremium: false,
    region: "Tokyo",
    healthInsuranceProvider: DEFAULT_PROVIDER,
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  }

  // State for form inputs
  const [inputs, setInputs] = useState<TakeHomeFormState>(defaultInputs)

  // State for calculation results
  const [results, setResults] = useState<TakeHomeResults | null>(null)

  // Normalize inputs for calculation (memoized for use in both calculation and validation/charts)
  const normalizedIncomeStreams = useMemo<IncomeStream[]>(() => {
    return normalizeIncomeStreams(inputs.incomeMode, inputs.annualIncome, inputs.incomeStreams);
  }, [inputs.incomeMode, inputs.incomeStreams, inputs.annualIncome]);

  // Debounce the tax calculation to prevent excessive updates from rapid slider changes
  useEffect(() => {
    const calculateAndSetResults = () => {
      const calculationInputs: TakeHomeInputs = {
        incomeStreams: normalizedIncomeStreams,
        isSubjectToLongTermCarePremium: inputs.isSubjectToLongTermCarePremium,
        region: inputs.region,
        healthInsuranceProvider: inputs.healthInsuranceProvider,
        dependents: inputs.dependents,
        dcPlanContributions: inputs.dcPlanContributions,
        manualSocialInsuranceEntry: inputs.manualSocialInsuranceEntry,
        manualSocialInsuranceAmount: inputs.manualSocialInsuranceAmount,
        customEHIRates: inputs.customEHIRates,
      };

      const takeHomePayResults = calculateTaxes(calculationInputs);
      setResults(takeHomePayResults);
    };

    const handler = setTimeout(() => {
      calculateAndSetResults();
    }, 50);

    // Cleanup function: clear the timeout if the effect re-runs before the timeout completes
    return () => clearTimeout(handler);
  }, [inputs, normalizedIncomeStreams]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string; value: unknown; type?: string; checked?: boolean } }) => {
    const target = e.target;
    const name = target.name || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (target as any).value;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const type = (target as any).type;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checked = (target as any).checked;

    const isCheckbox = type === 'checkbox';
    const isNumber = type === 'number' || type === 'range';

    setInputs(prev => {
      let processedInputValue: unknown;

      if (isCheckbox) {
        processedInputValue = checked;
      } else if (isNumber) {
        processedInputValue = parseFloat(value as string) || 0;
      } else {
        // For select and other text-based inputs, as well as complex objects
        processedInputValue = value;
      }

      const newInputs = {
        ...prev,
        [name]: processedInputValue
      };

      // Cascading updates for health insurance provider and region
      if (name === 'incomeMode') {
        const newMode = processedInputValue as string;
        if (newMode === 'salary') {
          newInputs.healthInsuranceProvider = 'KyokaiKenpo';
          const providerDefinition = PROVIDER_DEFINITIONS['KyokaiKenpo'];
          const providerRegions = providerDefinition ? Object.keys(providerDefinition.regions) : [];
          newInputs.region = providerRegions.includes('Tokyo') ? 'Tokyo' :
            (providerRegions.length > 0 ? providerRegions[0]! : DEFAULT_PROVIDER_REGION);
        } else if (newMode === 'business') {
          newInputs.healthInsuranceProvider = NATIONAL_HEALTH_INSURANCE_ID;
          newInputs.region = NATIONAL_HEALTH_INSURANCE_REGIONS.includes('Tokyo') ? 'Tokyo' :
            (NATIONAL_HEALTH_INSURANCE_REGIONS.length > 0 ? NATIONAL_HEALTH_INSURANCE_REGIONS[0]! : DEFAULT_PROVIDER_REGION);
        }
      } else if (name === 'healthInsuranceProvider') {
        newInputs.healthInsuranceProvider = processedInputValue as string;
        if (processedInputValue === NATIONAL_HEALTH_INSURANCE_ID) {
          // Default to Tokyo if available, otherwise fall back to first region or DEFAULT_PROVIDER_REGION
          newInputs.region = NATIONAL_HEALTH_INSURANCE_REGIONS.includes('Tokyo') ? 'Tokyo' :
            (NATIONAL_HEALTH_INSURANCE_REGIONS.length > 0 ? NATIONAL_HEALTH_INSURANCE_REGIONS[0]! : DEFAULT_PROVIDER_REGION);
        } else if (processedInputValue === DEPENDENT_COVERAGE_ID) {
          // Dependent coverage doesn't need a region
          newInputs.region = DEFAULT_PROVIDER_REGION;
        } else {
          // For employee providers (Kyokai Kenpo, ITS Kenpo, etc.)
          const providerDefinition = PROVIDER_DEFINITIONS[processedInputValue as string];
          if (providerDefinition) {
            const providerRegions = Object.keys(providerDefinition.regions);
            // Default to Tokyo if available, otherwise fall back to first region or DEFAULT_PROVIDER_REGION
            newInputs.region = providerRegions.includes('Tokyo') ? 'Tokyo' :
              (providerRegions.length > 0 ? providerRegions[0]! : DEFAULT_PROVIDER_REGION);
          } else {
            newInputs.region = DEFAULT_PROVIDER_REGION;
            console.warn(`Data for ID ${processedInputValue} not found in Employees Health Insurance Provider data.Defaulting region.`);
          }
        }
      } else if (name === 'annualIncome') {
        // If income changes and user has dependent coverage selected, check eligibility
        const newIncome = processedInputValue as number;
        if (prev.healthInsuranceProvider === DEPENDENT_COVERAGE_ID && !isDependentCoverageEligible(newIncome)) {
          // Income exceeded threshold, automatically switch to NHI
          newInputs.healthInsuranceProvider = NATIONAL_HEALTH_INSURANCE_ID;
          newInputs.region = NATIONAL_HEALTH_INSURANCE_REGIONS.includes('Tokyo') ? 'Tokyo' :
            (NATIONAL_HEALTH_INSURANCE_REGIONS.length > 0 ? NATIONAL_HEALTH_INSURANCE_REGIONS[0]! : DEFAULT_PROVIDER_REGION);
        }
      }
      return newInputs;
    });
  }

  return (
    <Box sx={{
      maxWidth: 1536, // max-w-6xl equivalent
      mx: 'auto',
      px: { xs: 2, sm: 3, md: 4 },
      py: { xs: 4, sm: 6, md: 8 },
      minHeight: '100vh',
      bgcolor: 'background.default',
      color: 'text.primary',
      overflowX: 'hidden',
    }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: { xs: 4, sm: 6, md: 8 },
        flexDirection: 'row',
        gap: { xs: 1, sm: 2 },
        '& h1': {
          fontSize: { xs: '1.75rem', sm: '2rem' },
          lineHeight: 1.2
        }
      }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 'bold',
            textAlign: { xs: 'center', sm: 'left' },
            flex: 1,
            maxWidth: { xs: '80vw', sm: 'none' },
          }}
        >
          Japan Take-Home Pay Calculator
        </Typography>
        <Box sx={{
          flexShrink: 0,
          ml: { xs: 1, sm: 2 },
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <ChangelogButton onClick={openChangelog} />
          <ThemeToggle mode={mode} toggleColorMode={toggleColorMode} />
        </Box>
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: { xs: 3, md: 4 },
        width: '100%',
        '& > *': {
          minWidth: 0, // Prevent overflow issues
        }
      }}>
        <TakeHomeInputForm inputs={inputs} onInputChange={handleInputChange} />
        {results && (
          <Suspense fallback={
            <Box sx={{
              height: 256,
              borderRadius: 1,
              bgcolor: 'action.hover',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }} />
          }>
            <TakeHomeResultsDisplay
              results={results}
              inputs={inputs}
            />
          </Suspense>
        )}
      </Box>

      <Suspense fallback={
        <Box sx={{
          height: 384,
          mt: 4,
          borderRadius: 1,
          bgcolor: 'action.hover',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }} />
      }>
        <TakeHomeChart
          currentIncome={inputs.annualIncome}
          isEmploymentIncome={normalizedIncomeStreams.some(s => s.type === 'salary' || s.type === 'bonus')}
          isSubjectToLongTermCarePremium={inputs.isSubjectToLongTermCarePremium}
          healthInsuranceProvider={inputs.healthInsuranceProvider}
          region={inputs.region}
          dcPlanContributions={inputs.dcPlanContributions}
          dependents={inputs.dependents}
          customEHIRates={inputs.customEHIRates}
          manualSocialInsuranceEntry={inputs.manualSocialInsuranceEntry}
          manualSocialInsuranceAmount={inputs.manualSocialInsuranceAmount}
          incomeStreams={normalizedIncomeStreams}
        />
      </Suspense>

      <Box sx={{
        mt: 10,
        mb: 6,
        textAlign: 'center',
        color: 'text.secondary'
      }}>
        <p>This calculator offers no guarantee of accuracy or completeness. Not all situations are covered.</p>
        <p className="mt-1">Consult with a tax professional for specific tax advice.</p>
      </Box>

      {/* Changelog Modal */}
      <Suspense fallback={null}>
        <ChangelogModal open={isChangelogOpen} onClose={closeChangelog} />
      </Suspense>
    </Box>
  )
}

export default App
