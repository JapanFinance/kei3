// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bundle-size budget for the production JS. Enforced in CI
// (.github/workflows/deploy.yml) and runnable locally with `npm run size`
// after `npm run build`.
//
// size-limit enforces one limit per check (the unit of `limit` selects size or
// time), so this single check over the built chunks (dist/assets/*.js) gates on
// the gzipped size. The budget sits just above the current total; crossing it
// fails the build.
//
// Because @size-limit/time is installed, the same check also reports loading
// time (size-limit's default "slow 3G" profile) and JavaScript execution time
// (a throttled "Snapdragon 410" CPU). Those figures are informational, not
// gated, and read higher than real desktop or 4G load. Size is the reliable
// gate: loading time is a linear function of size, and the execution
// measurement varies from run to run.
//
// Baseline when added (2026-07): ~308 kB gzip, ~0.7 s exec, ~6.8 s total.
export default [
  {
    name: 'Total JS',
    path: 'dist/assets/*.js',
    gzip: true,
    limit: '320 kB',
  },
];
