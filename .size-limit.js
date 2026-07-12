// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bundle-size budgets for the production JS. Enforced in CI
// (.github/workflows/deploy.yml) and runnable locally with `npm run size`
// after `npm run build`.
//
// Both checks measure the same built chunks (dist/assets/*.js) after gzip:
//
//   1. Size — the primary check for size regressions. `running: false` skips
//      the headless-Chrome measurement, so this check is deterministic. The
//      budget sits just above the current total; crossing it fails the build.
//
//   2. Load + exec time — a secondary check that also catches execution-cost
//      regressions: a dependency that is small in bytes but expensive to parse
//      and run. size-limit estimates loading time on its default "slow 3G"
//      network profile and JavaScript execution time on a throttled
//      "Snapdragon 410" CPU, so these seconds are larger than real desktop or
//      4G figures. The budget carries enough headroom that normal run-to-run
//      variance in the execution measurement does not fail the build.
//
// Baseline when added (2026-07): ~308 kB gzip, ~0.8 s exec, ~6.8 s total.
export default [
  {
    name: 'Total JS — size',
    path: 'dist/assets/*.js',
    gzip: true,
    running: false,
    limit: '320 kB',
  },
  {
    name: 'Total JS — load + exec time',
    path: 'dist/assets/*.js',
    gzip: true,
    limit: '9 s',
  },
];
