// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy } from 'react';

import { CHANGELOG_HASH } from '../hooks/useChangelogModal';

type ResultsModule = typeof import('../components/TakeHomeCalculator/TakeHomeResults');
type ChartModule = typeof import('../components/TakeHomeCalculator/TakeHomeChart');
type InputModalsModule = typeof import('../components/TakeHomeCalculator/inputModals');
type ChangelogModule = typeof import('../components/ChangelogModal');

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

let resolveChartSettled = () => {};
const chartSettled = new Promise<void>(resolve => {
  resolveChartSettled = resolve;
});

let resolveInputModalsSettled = () => {};
const inputModalsSettled = new Promise<void>(resolve => {
  resolveInputModalsSettled = resolve;
});

let resolveInputModalsRequested = () => {};
const inputModalsRequest = new Promise<void>(resolve => {
  resolveInputModalsRequested = resolve;
});

let resolveChangelogRequested = () => {};
const changelogRequest = new Promise<void>(resolve => {
  resolveChangelogRequested = resolve;
});

let resultsModulePromise: Promise<ResultsModule> | undefined;
let chartModulePromise: Promise<ChartModule> | undefined;
let inputModalsModulePromise: Promise<InputModalsModule> | undefined;
let changelogModulePromise: Promise<ChangelogModule> | undefined;

const loadResultsModule = () => {
  resultsModulePromise ??= import('../components/TakeHomeCalculator/TakeHomeResults');
  return resultsModulePromise;
};

// The chart (which pulls in chart.js) loads after the results module so the
// visible numbers come first; settling rather than chaining only on resolve
// keeps a results load failure from blocking later waves.
const loadChartModule = () => {
  if (!chartModulePromise) {
    chartModulePromise = loadResultsModule()
      .catch(() => undefined)
      .then(() => import('../components/TakeHomeCalculator/TakeHomeChart'));
    void chartModulePromise.then(resolveChartSettled, resolveChartSettled);
  }
  return chartModulePromise;
};

// All three input modals load together in one chunk after the visible chart
// module settles (or immediately on first click) so opening any modal does not
// wait on separate waves or compete with visible startup content.
const loadInputModalsModule = () => {
  if (!inputModalsModulePromise) {
    inputModalsModulePromise = Promise.race([chartSettled, inputModalsRequest]).then(
      () => import('../components/TakeHomeCalculator/inputModals'),
    );
    void inputModalsModulePromise.then(resolveInputModalsSettled, resolveInputModalsSettled);
  }
  return inputModalsModulePromise;
};

// The changelog is invisible until opened, so it waits until the browser is
// idle after the input modals — ready before anyone clicks the button without
// competing with interactive or visible content. Deep links to #changelog need
// the modal immediately and skip the deferral.
const loadChangelogModule = () => {
  changelogModulePromise ??=
    window.location.hash === CHANGELOG_HASH
      ? import('../components/ChangelogModal')
      : Promise.race([inputModalsSettled.then(whenBrowserIdle), changelogRequest]).then(
          () => import('../components/ChangelogModal'),
        );
  return changelogModulePromise;
};

/**
 * Starts background loading of deferred modules in priority order: results,
 * chart, input modals, then changelog.
 */
export function startDeferredLoads(): void {
  void loadResultsModule().catch(() => undefined);
  void loadChartModule().catch(() => undefined);
  void loadInputModalsModule().catch(() => undefined);
  void loadChangelogModule().catch(() => undefined);
}

/** Starts loading the input modals immediately if not already in flight. */
export function requestInputModals(): void {
  resolveInputModalsRequested();
  void loadInputModalsModule().catch(() => undefined);
}

/** Starts loading the changelog modal immediately if not already in flight. */
export function requestChangelogModal(): void {
  resolveChangelogRequested();
  void loadChangelogModule().catch(() => undefined);
}

export const TakeHomeResultsDisplay = lazy(loadResultsModule);
export const TakeHomeChart = lazy(loadChartModule);
export const ChangelogModal = lazy(loadChangelogModule);

export const AdditionalDeductionsModal = lazy(() =>
  loadInputModalsModule().then(m => ({ default: m.AdditionalDeductionsModal })),
);
export const DependentsModal = lazy(() =>
  loadInputModalsModule().then(m => ({ default: m.DependentsModal })),
);
export const IncomeDetailsModal = lazy(() =>
  loadInputModalsModule().then(m => ({ default: m.IncomeDetailsModal })),
);
