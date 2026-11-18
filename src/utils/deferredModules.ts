// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy } from 'react';

import { CHANGELOG_HASH } from '../hooks/useChangelogModal';

type ResultsModule = typeof import('../components/TakeHomeCalculator/TakeHomeResults');
type ChartModule = typeof import('../components/TakeHomeCalculator/TakeHomeChart');
export type InputModalsModule = typeof import('../components/TakeHomeCalculator/inputModals');
export type ChangelogModule = typeof import('../components/ChangelogModal');

export interface DeferredModuleStore<T> {
  /** Returns the resolved module synchronously if already loaded, otherwise `undefined`. */
  getSnapshot: () => T | undefined;
  /** Subscribes to module resolution notifications for `useSyncExternalStore`. */
  subscribe: (listener: () => void) => () => void;
  /** Bypasses any deferral wait and begins loading immediately. */
  request: () => void;
}

interface DeferredLoader<T> {
  store: DeferredModuleStore<T>;
  load: () => Promise<T>;
  settled: Promise<void>;
}

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

function createDeferredLoader<T>(
  waitForGate: (requested: Promise<void>) => Promise<void>,
  importModule: () => Promise<T>,
): DeferredLoader<T> {
  let loaded: T | undefined;
  let modulePromise: Promise<T> | undefined;
  const listeners = new Set<() => void>();

  let resolveSettled = () => {};
  const settled = new Promise<void>(resolve => {
    resolveSettled = resolve;
  });

  let resolveRequested = () => {};
  const requested = new Promise<void>(resolve => {
    resolveRequested = resolve;
  });

  const load = () => {
    if (!modulePromise) {
      modulePromise = waitForGate(requested).then(() =>
        importModule().then(
          mod => {
            loaded = mod;
            listeners.forEach(listener => listener());
            return mod;
          },
          error => {
            // Clear the failed promise so an interactive click can retry loading.
            modulePromise = undefined;
            throw error;
          },
        ),
      );
      void modulePromise.then(resolveSettled, resolveSettled);
    }
    return modulePromise;
  };

  const request = () => {
    resolveRequested();
    void load().catch(() => undefined);
  };

  const store: DeferredModuleStore<T> = {
    getSnapshot: () => loaded,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    request,
  };

  return { store, load, settled };
}

let resolveChartSettled = () => {};
const chartSettled = new Promise<void>(resolve => {
  resolveChartSettled = resolve;
});

let resultsModulePromise: Promise<ResultsModule> | undefined;
let chartModulePromise: Promise<ChartModule> | undefined;

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
const inputModalsLoader = createDeferredLoader<InputModalsModule>(
  requested => Promise.race([chartSettled, requested]),
  () => import('../components/TakeHomeCalculator/inputModals'),
);

// The changelog is invisible until opened, so it waits until the browser is
// idle after the input modals — ready before anyone clicks the button without
// competing with interactive or visible content. Deep links to #changelog need
// the modal immediately and skip the deferral.
const changelogLoader = createDeferredLoader<ChangelogModule>(
  requested =>
    window.location.hash === CHANGELOG_HASH
      ? Promise.resolve()
      : Promise.race([inputModalsLoader.settled.then(whenBrowserIdle), requested]),
  () => import('../components/ChangelogModal'),
);

export const inputModalsStore = inputModalsLoader.store;
export const changelogModalStore = changelogLoader.store;

/**
 * Starts background loading of deferred modules in priority order: results,
 * chart, input modals, then changelog.
 */
export function startDeferredLoads(): void {
  void loadResultsModule().catch(() => undefined);
  void loadChartModule().catch(() => undefined);
  void inputModalsLoader.load().catch(() => undefined);
  void changelogLoader.load().catch(() => undefined);
}

/** Starts loading the input modals immediately if not already in flight. */
export function requestInputModals(): void {
  inputModalsStore.request();
}

/** Starts loading the changelog modal immediately if not already in flight. */
export function requestChangelogModal(): void {
  changelogModalStore.request();
}

export const TakeHomeResultsDisplay = lazy(loadResultsModule);
export const TakeHomeChart = lazy(loadChartModule);
