// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bundle-size budget for the production JS. Enforced in CI
// (.github/workflows/deploy.yml) and runnable locally with `npm run size`
// after `npm run build`.
//
// size-limit enforces one limit per check (the unit of `limit` selects size or
// time), so this single check over the built chunks (dist/assets/*.js) gates on
// the gzipped size. The budget is deliberately tight — a couple of kB above the
// current total — so any real size increase fails CI. An intentional, justified
// increase should raise this limit in the same change that adds the weight.
//
// Because @size-limit/time is installed, the same check also reports loading
// time (size-limit's default "slow 3G" profile) and JavaScript execution time
// (a throttled "Snapdragon 410" CPU). Those figures are informational, not
// gated, and read higher than real desktop or 4G load.
//
// Baseline when added (2026-07): ~308 kB gzip (307,904 B), ~6.8 s total.
export default [
  {
    name: 'Total JS',
    path: 'dist/assets/*.js',
    gzip: true,
    limit: '310 kB',
  },
];
