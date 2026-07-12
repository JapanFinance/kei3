// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lighthouse CI configuration. Enforced in CI (.github/workflows/deploy.yml) by
// `lhci assert`; the four category scores are also posted to the pull request by
// scripts/lighthouse-report.mjs.
//
// WHAT IS AUDITED
// LHCI serves the production build in dist/ from its own static server over
// http://localhost and audits the single page. This is deterministic and does
// not depend on a Cloudflare deploy having finished. The PERFORMANCE score is
// sensitive to the runner and to the absence of production's CDN compression,
// caching, and HTTP/2 — the same build scores ~87 on the CI runner but ~63 on a
// local static server — so it is tracked (warn), not gated (see below). The
// three content/checklist categories are stable across environments and gated.
//
// AGGREGATION
// Each run is noisy, so we take numberOfRuns and assert against the median
// ("representative") run. scripts/lighthouse-report.mjs reports that same run,
// so the PR comment and the CI gate always show the same numbers.
//
// THRESHOLDS (median of 3 runs; category scores confirmed on the CI runner 2026-07)
//   Performance     ~87   warn  ≥ 50   environment-sensitive (~63 on a local
//                                       static server); a regression is
//                                       surfaced, not a hard failure.
//   Accessibility    91   error ≥ 90   deterministic; 3 known imperfect audits
//                                       (color-contrast, unlabeled Slider input,
//                                       heading-order) hold it below 100.
//   Best Practices   96   error ≥ 90   deterministic; held below 100 by a
//                                       browser console 404 for /favicon.ico
//                                       (no favicon is shipped).
//   SEO             100   error ≥ 95   deterministic; sitemap, canonical, meta,
//                                       and robots.txt all pass.
//
// The gated floors (a11y / best-practices / SEO) sit a little below today's
// scores: enough headroom to absorb Lighthouse's minor run-to-run variance,
// tight enough that a real regression fails CI. As with the bundle-size budget,
// an intentional, justified drop should lower the floor in the same change —
// and an improvement is a good reason to raise it.
//
// KNOBS
//   - Hosted, clickable reports: set upload.target to 'temporary-public-storage'
//     to publish each full HTML report to Google's temporary storage and link it
//     from the PR (sends the public report off-box). The filesystem target below
//     keeps everything in-repo as a CI artifact instead.
//   - Deeper states: collect.url / a puppeteerScript can drive the calculator
//     into its results+chart state before auditing; today only the initial load
//     is measured.
//   - Real-world numbers: point collect.url at the Cloudflare preview URL to
//     audit the deployed site (real CDN/headers) at the cost of a deploy
//     dependency and more noise.

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
      settings: {
        // CI runners run headless Chrome without a sandbox; --disable-dev-shm-usage
        // avoids crashes from a small /dev/shm.
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.5, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
      },
    },
    upload: {
      // Write reports + manifest.json to disk; the CI job uploads that directory
      // as an artifact. No external upload target (keeps reports in-repo).
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
