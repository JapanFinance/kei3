// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import { useReducer, useDeferredValue, useMemo, useCallback, Suspense, lazy } from 'react';

import ChangelogButton from './components/ChangelogButton';
import ChangelogLoadingDialog from './components/ChangelogLoadingDialog';
import SiteHeader, { SITE_TITLE } from './components/SiteHeader';
import { TakeHomeInputForm } from './components/TakeHomeCalculator/InputForm';
import { useChangelogModal, CHANGELOG_HASH } from './hooks/useChangelogModal';
import { takeHomeFormReducer, normalizeInitialFormState } from './state/takeHomeFormReducer';
import { DEFAULT_PROVIDER } from './types/healthInsurance';
import type { TakeHomeFormState } from './types/tax';
import { DEFAULT_INCOME_YEAR, EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from './types/tax';
import { DEFAULT_TAXPAYER_AGE_RANGE } from './types/taxpayerAge';
import { useLoadMilestone } from './utils/loadMilestones';
import { calculateTaxes } from './utils/taxCalculations';

// Deferred modules load in priority order: results, then chart, then changelog.
const resultsModulePromise = import('./components/TakeHomeCalculator/TakeHomeResults');
const TakeHomeResultsDisplay = lazy(() => resultsModulePromise);

// The chart (which pulls in chart.js) loads after the results module so the
// visible numbers come first; the catch keeps a results load failure from
// also blocking the chart.
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

// Resolved by the first click on the changelog button. Racing it against the
// wait below means an early click starts the download straight away instead of
// leaving the visitor waiting out the idle timeout first.
let changelogRequested = () => {};
const changelogRequest = new Promise<void>(resolve => {
  changelogRequested = resolve;
});

// The changelog is invisible until opened, so it loads once the browser is
// idle after the chart module — ready before anyone clicks the button without
// competing with visible content at startup. Deep links to #changelog need the
// modal immediately and skip the deferral.
const ChangelogModal = lazy(() =>
  window.location.hash === CHANGELOG_HASH
    ? import('./components/ChangelogModal')
    : Promise.race([
        chartModulePromise.catch(() => undefined).then(whenBrowserIdle),
        changelogRequest,
      ]).then(() => import('./components/ChangelogModal')),
);

function App() {
  useLoadMilestone('app-rendered');

  // Changelog modal management
  const {
    isOpen: isChangelogOpen,
    openModal: openChangelog,
    closeModal: closeChangelog,
    markViewed: markChangelogViewed,
    hasNewFeatures,
  } = useChangelogModal();

  const handleOpenChangelog = useCallback(() => {
    changelogRequested();
    openChangelog();
  }, [openChangelog]);

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
    ageRange: DEFAULT_TAXPAYER_AGE_RANGE,
    longTermCareCategory1ManualEntry: false,
    longTermCareCategory1Premium: 0,
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

  // Recalculating on the deferred value keeps rapid input changes (e.g. slider
  // drags) responsive: the urgent render reuses the previous results and the
  // recalculation runs in an interruptible background render. The results panel
  // and the chart receive only deferred values and are memoized, so the urgent
  // render skips both. memo compares props by identity, so passing either one an
  // object or function created during render would make it render every time.
  const deferredInputs = useDeferredValue(inputs);
  const results = useMemo(() => calculateTaxes(deferredInputs), [deferredInputs]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        overflowX: 'hidden',
      }}
    >
      <SiteHeader
        title={SITE_TITLE}
        actions={<ChangelogButton onClick={handleOpenChangelog} showBadge={hasNewFeatures} />}
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
            personalDeductions={results.personalDeductions}
            longTermCareCategory1Estimate={results.longTermCareCategory1Estimate}
          />
          <Suspense
            fallback={
              <Box
                sx={{
                  // Sized without reference to the results' content. In the single column, a
                  // viewport of height keeps everything after it below the fold until the results
                  // replace it, so the swap moves nothing on screen. In two columns the box
                  // stretches to the grid row that the input form sets, as the results Paper does.
                  minHeight: { xs: '100svh', md: 0 },
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
                // Matches TakeHomeChart's rendered height at default inputs
                height: { xs: 720, md: 724 },
                mt: { xs: 2, md: 3 },
                borderRadius: 1,
                bgcolor: 'action.hover',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
          }
        >
          <TakeHomeChart
            currentIncome={deferredInputs.annualIncome}
            incomeYear={deferredInputs.incomeYear}
            ageRange={deferredInputs.ageRange}
            longTermCareCategory1ManualEntry={deferredInputs.longTermCareCategory1ManualEntry}
            longTermCareCategory1Premium={deferredInputs.longTermCareCategory1Premium}
            healthInsuranceProvider={deferredInputs.healthInsuranceProvider}
            region={deferredInputs.region}
            dcPlanContributions={deferredInputs.dcPlanContributions}
            dependents={deferredInputs.dependents}
            customEHIRates={deferredInputs.customEHIRates}
            manualSocialInsuranceEntry={deferredInputs.manualSocialInsuranceEntry}
            manualSocialInsuranceAmount={deferredInputs.manualSocialInsuranceAmount}
            incomeStreams={deferredInputs.incomeStreams}
            lifeInsurance={deferredInputs.lifeInsurance}
            earthquakeInsurance={deferredInputs.earthquakeInsurance}
            medicalExpenses={deferredInputs.medicalExpenses}
            personalCircumstances={deferredInputs.personalCircumstances}
            homeLoanTaxCredit={deferredInputs.homeLoanTaxCredit}
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
        <Suspense
          fallback={isChangelogOpen ? <ChangelogLoadingDialog onClose={closeChangelog} /> : null}
        >
          <ChangelogModal
            open={isChangelogOpen}
            onClose={closeChangelog}
            onViewed={markChangelogViewed}
          />
        </Suspense>
      </Box>
    </Box>
  );
}

export default App;
