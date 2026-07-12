// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bundle-size budget for the production assets users download. Enforced in CI
// (.github/workflows/deploy.yml) and runnable locally with `npm run size`
// after `npm run build`.
//
// One check over the built JS and CSS (dist/assets/*.{js,css}), gated on the
// combined gzipped size. The budget is deliberately tight — a couple of kB
// above the current total — so any real size increase fails CI. An intentional,
// justified increase should raise this limit in the same change that adds the
// weight. (Sourcemaps, dist/assets/*.map, are dev-only and excluded.)
//
// Size only: measuring the shipped bytes is fast and deterministic. Real-world
// performance (render, interactivity) is covered separately by Lighthouse, not
// by size-limit's synthetic in-browser timing.
//
// Baseline when added (2026-07): ~310 kB gzip combined (309,555 B = 307,904 JS
// + 1,651 CSS).
export default [
  {
    name: 'Total JS + CSS',
    path: 'dist/assets/*.{js,css}',
    gzip: true,
    limit: '312 kB',
  },
];
