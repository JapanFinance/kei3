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
// WHAT IS AUDITED — lab for the gate, reality for tracking
//   - GATE (pull requests and pushes): the production build in dist/, served
//     locally by a small static server that negotiates Brotli/gzip the way
//     Cloudflare does. Deterministic and isolated from everything a PR cannot
//     change, so a regression here is attributable to the change under review.
//     On pull requests the scores are also diffed against the PR's base commit
//     (restored from the Actions cache, like the bundle-size report).
//   - TRACKED (pull requests): PERFORMANCE against the Cloudflare preview
//     deployment (real CDN, HTTP/2, edge latency). Perf only: workers.dev
//     previews do not get the zone-level Cloudflare layer (e.g. the injected
//     bot-detection script), so their other categories match the local build.
//   - TRACKED (pushes to main): all four categories against PROD_URL — what
//     users actually experience, including the Cloudflare layer. Prod scores
//     include things no PR causes (injected scripts, managed robots.txt), so
//     they are recorded, never gated. Reality baseline on Lighthouse 13.4
//     (2026-07): perf ~82, a11y 95, best-practices 77 (Cloudflare bot-script
//     deprecations + favicon 404), seo 100.
//   - Only the initial load is measured. The results panel and chart are lazy
//     and are not exercised (see KNOBS).
//
// WHY PERFORMANCE IS NOT GATED, AND WHAT TO READ INSTEAD
// Lighthouse's own variability guidance warns against measuring performance on
// "burstable"/"shared-core" instances, which is what GitHub-hosted runners are.
// Measured here across three identical runs of one commit (after discarding a
// warmup run, and taking the median of RUNS):
//   FCP ±10 ms, LCP ±30 ms, Speed Index ±10 ms — trustworthy.
//   TBT ±50 ms (±25%) — CPU-bound, the metric the shared runner does distort.
//   performance score ±1 point; accessibility/best-practices/SEO: zero variance.
// So the four category scores are a coarse tripwire, not an instrument: a real
// win (say 250 ms of LCP) is worth about a point, indistinguishable from that
// ±1. Judge a performance change on the METRICS the report prints instead —
// 250 ms against ±30 ms of noise is unmistakable. Performance is therefore
// tracked (warn), never gated, as the bundle-size budget treats execution time.
// The three content/checklist categories carry no timing and are gated.
//
// These are lab numbers: a model of a mobile visitor computed by simulated
// throttling from the resource graph, not a recording of one. Absolute values do
// not match production (LCP ~3.0 s here vs ~3.8 s live, which also carries
// Cloudflare's injected script). Their value is that both sides of a diff are
// measured identically, so a delta is attributable to the change — and the same
// bytes and request waterfall drive the real page, so improvements move the same
// direction, if not the same magnitude. For changes that are purely about bytes,
// .github/size-report.mjs is a sharper instrument still: exact, and noiseless.
//
// THRESHOLDS — median of RUNS runs. Baseline measured on Lighthouse 13.4 against
// dist/ built from main (2026-07), served locally with Brotli:
//   Performance     warn  ≥ 0.75   ~0.90 on the CI runner (noisy: individual
//                                   runs 75–91), ~0.82 on the real CDN. Tracked.
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
//     Only performance differs by form factor — the other three categories are
//     DOM/checklist-based — so auditing desktop too would only add a second,
//     higher performance number.
//   - PREVIEW_PERF: set false to skip the best-effort Cloudflare-preview
//     performance pass and report only the local number.
//   - PROD_URL: the deployed site audited on pushes to main.
//   - Deeper states: point the runner at a Puppeteer script to drive the
//     calculator into its results + chart state before auditing.

export const RUNS = 3;
export const FORM_FACTOR = 'mobile';
export const PREVIEW_PERF = true;
export const PROD_URL = 'https://kei3.japanfinance.org/';

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
