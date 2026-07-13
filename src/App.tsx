// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useReducer, useDeferredValue, useMemo, Suspense, lazy } from 'react';
import Box from '@mui/material/Box';
import SiteHeader from './components/SiteHeader';
import ChangelogButton from './components/ChangelogButton';
import { TakeHomeInputForm } from './components/TakeHomeCalculator/InputForm';
import type { TakeHomeFormState, TakeHomeInputs } from './types/tax';
import { DEFAULT_INCOME_YEAR, EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from './types/tax';
import { calculateTaxes } from './utils/taxCalculations';
import { DEFAULT_PROVIDER } from './types/healthInsurance';
import { takeHomeFormReducer, normalizeInitialFormState } from './state/takeHomeFormReducer';
import { useChangelogModal, CHANGELOG_HASH } from './hooks/useChangelogModal';

// Deferred modules load in priority order: results, then chart, then changelog.
//
// React.lazy only starts a fetch when the component first renders, and the
// results display renders only after the first debounced calculation — so its
// import is started eagerly here, at module scope, to keep it from loading last.
const resultsModulePromise = import('./components/TakeHomeCalculator/TakeHomeResults');
const TakeHomeResultsDisplay = lazy(() => resultsModulePromise);

// The chart module (which pulls in chart.js) waits for the results module so
// the visible numbers get the network and main thread first. A results load
// failure already surfaces through its own Suspense boundary; it should not
// also block the chart, hence the catch before chaining.
const chartModulePromise = resultsModulePromise
  .catch(() => undefined)
  .then(() => import('./components/TakeHomeCalculator/TakeHomeChart'));
const TakeHomeChart = lazy(() => chartModulePromise);

// Safari does not implement requestIdleCallback; the timeout arguments bound
// the wait so the module still loads promptly on a busy page.
const whenBrowserIdle = () =>
  new Promise<void>(resolve => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(), { timeout: 2000 });
    } else {
      setTimeout(resolve, 2000);
    }
  });

// The changelog is invisible until opened, so it loads once the browser is
// idle after the chart module — ready before anyone clicks the button without
// competing with visible content at startup. Deep links to #changelog need the
// modal immediately and skip the deferral.
const ChangelogModal = lazy(() =>
  window.location.hash === CHANGELOG_HASH
    ? import('./components/ChangelogModal')
    : chartModulePromise
        .catch(() => undefined)
        .then(whenBrowserIdle)
        .then(() => import('./components/ChangelogModal')),
);

function App() {
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
    savedIncomeStreams: [],
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

  // Results are derived from the inputs: computed during the first render (the
  // default inputs are static, so no waiting on a timer) and recomputed when
  // the inputs change. useDeferredValue keeps rapid changes (e.g. slider
  // drags) responsive: the urgent render shows the new input values with the
  // previous results, and the recalculation runs in an interruptible
  // background render. TakeHomeFormState is a structural superset of
  // TakeHomeInputs, so the form state passes directly; the annotation narrows
  // the deferred value to the calculation's view of it. Recalculation keys on
  // the state object's identity, which is fine-grained enough: the only
  // reducer action that changes form-only state alone is an income-mode
  // switch — a discrete click, not a high-frequency input path.
  const deferredInputs = useDeferredValue<TakeHomeInputs>(inputs);
  const results = useMemo(() => calculateTaxes(deferredInputs), [deferredInputs]);

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
        actions={<ChangelogButton onClick={openChangelog} />}
      />

      <Box
        component="main"
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
            homeLoanTaxCreditResult={results.homeLoanTaxCredit}
            additionalDeductions={results.additionalDeductions}
          />
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
            <TakeHomeResultsDisplay results={results} inputs={deferredInputs} />
          </Suspense>
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
          <p>Consult with a tax professional for specific tax advice.</p>
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
