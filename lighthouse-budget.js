// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lighthouse budget and run settings for the CI gate. Consumed by
// .github/lighthouse-run.mjs (which audits and enforces it) and surfaced on the
// pull request by .github/lighthouse-report.mjs.
//
// This runs the pinned `lighthouse` package directly, not @lhci/cli — installed on
// demand (`npm run lighthouse:install`) rather than tracked as a dependency, so
// `npm ci` for the app stays lean. @lhci/cli's newest release lags the engine by
// about a year (it bundles 12.6 while the engine is on 13.x), so calling Lighthouse
// ourselves keeps the audit on the current engine, and keeps the whole toolchain
// self-hosted (no third-party GitHub Action, matching the bundle-size report).
//
// WHAT IS AUDITED
//   - The production build in dist/, served locally by a small static server
//     that negotiates Brotli/gzip the way Cloudflare does, so the
//     transfer-size-sensitive performance metrics are realistic. This gate is
//     deterministic and does not wait on a Cloudflare deploy.
//   - On pull requests, PERFORMANCE is also measured against the Cloudflare
//     preview deployment (real CDN, HTTP/2, edge caching, real latency). That
//     pass is best-effort and never gates — see below.
//   - Only the initial load is measured. The results panel and chart are lazy
//     and are not exercised (see KNOBS).
//
// WHY PERFORMANCE IS NOT GATED
// Performance is noisy on shared CI runners (CPU-bound scripting/TBT), and the
// MUI-dominated bundle sets a floor no config change can move. It is tracked
// (warn) so a regression is surfaced, not turned into a hard failure — the same
// stance the bundle-size budget takes on execution time. The three
// content/checklist categories are deterministic across environments and gated.
//
// THRESHOLDS — median of RUNS runs. Baseline measured on Lighthouse 13.4 against
// dist/ built from main (2026-07), served locally with Brotli:
//   Performance     warn  ≥ 0.75   ~0.89 on the CI runner (noisy: individual
//                                   runs 75–89), ~0.82 on the real CDN. Tracked.
//   Accessibility   error ≥ 0.90   currently 0.95. Held below 1.0 by
//                                   color-contrast on muted text and a subtitle2
//                                   rendered as <h6> (heading-order).
//   Best Practices  error ≥ 0.90   currently 0.96. Held below 1.0 by a console
//                                   404 for /favicon.ico (no favicon is shipped).
//   SEO             error ≥ 0.95   currently 1.00.
//
// The gated floors sit a little below today's scores: enough headroom for
// Lighthouse's minor run-to-run variance, tight enough that a real regression
// fails CI. As with the bundle-size budget, an intentional, justified drop
// should lower the floor in the same change; an improvement is a reason to raise
// it.
//
// KNOBS
//   - RUNS: more runs give steadier medians at the cost of CI time.
//   - FORM_FACTOR: 'mobile' (Lighthouse's throttled default) or 'desktop'.
//   - PREVIEW_PERF: set false to skip the best-effort Cloudflare-preview
//     performance pass and report only the local number.
//   - Deeper states: point the runner at a Puppeteer script to drive the
//     calculator into its results + chart state before auditing.

export const RUNS = 3;
export const FORM_FACTOR = 'mobile';
export const PREVIEW_PERF = true;

// [category]: { level, minScore }. level 'error' fails CI when the median score
// is below minScore; 'warn' is reported but never fails. Object order is the
// order shown in the PR comment and job summary.
export const BUDGETS = {
  performance: { level: 'warn', minScore: 0.75 },
  accessibility: { level: 'error', minScore: 0.9 },
  'best-practices': { level: 'error', minScore: 0.9 },
  seo: { level: 'error', minScore: 0.95 },
};

// Category id -> display label, in presentation order.
export const CATEGORY_LABELS = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best Practices',
  seo: 'SEO',
};
