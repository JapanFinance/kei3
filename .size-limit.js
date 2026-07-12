// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bundle-size budget for the production JS. Enforced in CI
// (.github/workflows/deploy.yml) and runnable locally with `npm run size`
// after `npm run build`.
//
// One check over the built chunks (dist/assets/*.js), gated on the gzipped
// size. The budget is deliberately tight — a couple of kB above the current
// total — so any real size increase fails CI. An intentional, justified
// increase should raise this limit in the same change that adds the weight.
//
// Size only: measuring the shipped bytes is fast and deterministic. Real-world
// performance (render, interactivity) is covered separately by Lighthouse, not
// by size-limit's synthetic in-browser timing.
//
// Baseline when added (2026-07): ~308 kB gzip (307,904 B).
export default [
  {
    name: 'Total JS',
    path: 'dist/assets/*.js',
    gzip: true,
    limit: '310 kB',
  },
];
