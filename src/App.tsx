// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useReducer, useState, useEffect, Suspense, lazy } from 'react';
import Box from '@mui/material/Box';
import SiteHeader from './components/SiteHeader';
import ChangelogButton from './components/ChangelogButton';
import { TakeHomeInputForm } from './components/TakeHomeCalculator/InputForm';
import type { TakeHomeFormState, TakeHomeInputs, TakeHomeResults } from './types/tax';
import { DEFAULT_INCOME_YEAR, EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from './types/tax';
import { calculateTaxes } from './utils/taxCalculations';
import { DEFAULT_PROVIDER } from './types/healthInsurance';
import { takeHomeFormReducer, normalizeInitialFormState } from './state/takeHomeFormReducer';
import { useChangelogModal } from './hooks/useChangelogModal';

// Lazy load components that aren't immediately needed
const TakeHomeResultsDisplay = lazy(
  () => import('./components/TakeHomeCalculator/TakeHomeResults'),
);
const TakeHomeChart = lazy(() => import('./components/TakeHomeCalculator/TakeHomeChart'));
const ChangelogModal = lazy(() => import('./components/ChangelogModal'));

interface AppProps {
  mode: 'light' | 'dark';
  toggleColorMode: () => void;
}

function App({ mode, toggleColorMode }: AppProps) {
  // Changelog modal management
  const {
    isOpen: isChangelogOpen,
    openModal: openChangelog,
    closeModal: closeChangelog,
  } = useChangelogModal();

  // Default values for the form
  const defaultInputs: TakeHomeFormState = {
    annualIncome: 5_000_000, // 5 million yen
    incomeYear: DEFAULT_INCOME_YEAR, // single source of truth; pinned, not new Date().getFullYear()
    incomeMode: 'salary',
    incomeStreams: [
      {
        id: 'default-salary',
        type: 'salary',
        amount: 5_000_000,
        frequency: 'annual',
      },
    ],
    isSubjectToLongTermCarePremium: false,
    region: 'Tokyo',
    healthInsuranceProvider: DEFAULT_PROVIDER,
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  };

  // State for form inputs
  const [inputs, dispatch] = useReducer(
    takeHomeFormReducer,
    defaultInputs,
    normalizeInitialFormState,
  );

  // State for calculation results
  const [results, setResults] = useState<TakeHomeResults | null>(null);

  // Debounce the tax calculation to prevent excessive updates from rapid slider changes
  useEffect(() => {
    const calculateAndSetResults = () => {
      const calculationInputs: TakeHomeInputs = {
        incomeStreams: inputs.incomeStreams,
        incomeYear: inputs.incomeYear,
        isSubjectToLongTermCarePremium: inputs.isSubjectToLongTermCarePremium,
        region: inputs.region,
        healthInsuranceProvider: inputs.healthInsuranceProvider,
        dependents: inputs.dependents,
        dcPlanContributions: inputs.dcPlanContributions,
        manualSocialInsuranceEntry: inputs.manualSocialInsuranceEntry,
        manualSocialInsuranceAmount: inputs.manualSocialInsuranceAmount,
        customEHIRates: inputs.customEHIRates,
        homeLoanTaxCredit: inputs.homeLoanTaxCredit,
        lifeInsurance: inputs.lifeInsurance,
        earthquakeInsurance: inputs.earthquakeInsurance,
        medicalExpenses: inputs.medicalExpenses,
      };

      const takeHomePayResults = calculateTaxes(calculationInputs);
      setResults(takeHomePayResults);
    };

    const handler = setTimeout(() => {
      calculateAndSetResults();
    }, 50);

    // Cleanup function: clear the timeout if the effect re-runs before the timeout completes
    return () => clearTimeout(handler);
  }, [
    inputs.incomeStreams,
    inputs.incomeYear,
    inputs.isSubjectToLongTermCarePremium,
    inputs.region,
    inputs.healthInsuranceProvider,
    inputs.dependents,
    inputs.dcPlanContributions,
    inputs.manualSocialInsuranceEntry,
    inputs.manualSocialInsuranceAmount,
    inputs.customEHIRates,
    inputs.homeLoanTaxCredit,
    inputs.lifeInsurance,
    inputs.earthquakeInsurance,
    inputs.medicalExpenses,
  ]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        overflowX: 'hidden',
      }}
    >
      <SiteHeader
        title="Japan Take-Home Pay Calculator"
        mode={mode}
        toggleColorMode={toggleColorMode}
        actions={<ChangelogButton onClick={openChangelog} />}
      />

      <Box
        sx={{
          maxWidth: 1536, // max-w-6xl equivalent
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          pt: { xs: 3, sm: 4 },
          pb: { xs: 4, sm: 6, md: 8 },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 3, md: 4 },
            width: '100%',
            '& > *': {
              minWidth: 0, // Prevent overflow issues
            },
          }}
        >
          <TakeHomeInputForm
            inputs={inputs}
            dispatch={dispatch}
            homeLoanTaxCreditResult={results?.homeLoanTaxCredit}
            additionalDeductions={results?.additionalDeductions}
          />
          {results && (
            <Suspense
              fallback={
                <Box
                  sx={{
                    height: 256,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                    },
                  }}
                />
              }
            >
              <TakeHomeResultsDisplay results={results} inputs={inputs} />
            </Suspense>
          )}
        </Box>

        <Suspense
          fallback={
            <Box
              sx={{
                height: 384,
                mt: 4,
                borderRadius: 1,
                bgcolor: 'action.hover',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
          }
        >
          <TakeHomeChart
            currentIncome={inputs.annualIncome}
            incomeYear={inputs.incomeYear}
            isEmploymentIncome={inputs.incomeStreams.some(
              s => s.type === 'salary' || s.type === 'bonus',
            )}
            isSubjectToLongTermCarePremium={inputs.isSubjectToLongTermCarePremium}
            healthInsuranceProvider={inputs.healthInsuranceProvider}
            region={inputs.region}
            dcPlanContributions={inputs.dcPlanContributions}
            dependents={inputs.dependents}
            customEHIRates={inputs.customEHIRates}
            manualSocialInsuranceEntry={inputs.manualSocialInsuranceEntry}
            manualSocialInsuranceAmount={inputs.manualSocialInsuranceAmount}
            incomeStreams={inputs.incomeStreams}
            lifeInsurance={inputs.lifeInsurance}
            earthquakeInsurance={inputs.earthquakeInsurance}
            medicalExpenses={inputs.medicalExpenses}
            homeLoanTaxCredit={inputs.homeLoanTaxCredit}
          />
        </Suspense>

        <Box
          sx={{
            mt: 10,
            mb: 6,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <p>
            This calculator offers no guarantee of accuracy or completeness. Not all situations are
            covered.
          </p>
          <p className="mt-1">Consult with a tax professional for specific tax advice.</p>
        </Box>

        {/* Changelog Modal */}
        <Suspense fallback={null}>
          <ChangelogModal open={isChangelogOpen} onClose={closeChangelog} />
        </Suspense>
      </Box>
    </Box>
  );
}

export default App;
