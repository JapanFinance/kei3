// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lighthouse budget and run settings for the CI gate. Consumed by
// .github/lighthouse-run.mjs (which audits and enforces it) and surfaced on the
// pull request by .github/lighthouse-report.mjs.
//
// This runs the `lighthouse` package directly, not @lhci/cli, whose newest
// release lags the engine by about a year (it bundles 12.6 while the engine is
// on 13.x). Calling Lighthouse ourselves keeps the audit on the current engine
// and the whole toolchain self-hosted (no third-party GitHub Action, matching
// the bundle-size report).
//
// lighthouse and chrome-launcher are ordinary devDependencies: the lockfile
// pins their whole transitive tree (an install at CI time would re-resolve
// transitive ranges on every run, unpinned), and Dependabot proposes updates.
// lighthouse is pinned exactly because it is a scoring engine — versions
// legitimately move scores (13.4 added an accessibility audit 12.6 lacked, and
// fixed a robots.txt false negative). A Dependabot engine bump validates
// itself: its PR's own preview is audited with the new engine, so a scoring
// shift fails that PR's gate and the floors get adjusted deliberately in the
// same change.
//
// WHAT IS AUDITED — every audit runs against a deployed Cloudflare environment
//   - Pull requests GATE on the per-commit Cloudflare preview URL (all four
//     categories), found by matching the PR's head commit in the Cloudflare
//     bot's comment. workers.dev hosts carry no zone-level layer (no injected
//     bot-detection script), so these scores are the app's own.
//   - Pushes to main audit two URLs of the same deploy:
//       BASELINE — the root workers.dev subdomain (workers_dev in
//       wrangler.toml), the same environment class as PR previews. Cached by
//       commit SHA; pull requests diff their preview scores and metrics against
//       it apples-to-apples.
//       PRODUCTION — the custom domain, exactly what users experience,
//       Cloudflare zone layer included. Its non-performance categories are
//       GATED (same floors); performance is recorded as the reality trend but
//       not checked, since the zone layer prices it (measured on one build:
//       +252 ms LCP, +11 ms TBT, −71 ms FCP vs the bare workers.dev host).
//   - Only the initial load is measured. The results panel and chart are lazy
//     and are not exercised (see KNOBS).
//
// SKIPPED AUDITS — environment artifacts, not application defects. A skipped
// audit is removed from scoring and the category renormalizes over the rest.
// Throughout this tooling, "app" is the application as this repo's code
// delivers it, audited on a bare workers.dev host (or the local dev server) with
// no Cloudflare zone layer; "production" is the delivered site on the custom
// domain, zone layer included.
//   app (workers.dev hosts; also applied to the advisory local audit so its
//     scoring matches): is-crawlable — every workers.dev host serves
//     X-Robots-Tag: noindex (Cloudflare adds it to preview URLs; public/_headers
//     adds it to the root) precisely so this duplicate of the site is not
//     indexed. The audit would fail by design, not by defect; production, where
//     indexability matters, still runs it.
//   production (custom domain): deprecations and inspector-issues — both are
//     artifacts of Cloudflare Bot Fight Mode's injected challenge-platform
//     script (a zone setting, not repo code); inspector-issues additionally
//     appears only intermittently, which would make an exact gate flaky. Our own
//     code's deprecations and issues still fail the gate via the preview audit,
//     where no script is injected. Revisit if Bot Fight Mode is turned off.
//
// WHY PERFORMANCE IS NOT GATED, AND WHAT TO READ INSTEAD
// Measured run-to-run variance (5 interleaved runs per environment, one build):
//   FCP/SI ±50–130 ms (~2–5%), LCP ±70–110 ms (~2–3%), TBT ±5–25 ms (small
//   absolute, large relative), performance score ±1 point. CLS flips between
//   0.000 and 0.023 — one small real shift at the detection threshold, in every
//   environment; do not chase it as a regression.
//   Accessibility, Best Practices, and SEO: zero variance anywhere.
// A real improvement — say 250 ms of LCP — is worth about one point of score,
// indistinguishable from the ±1 noise, but unmistakable against ±100 ms in the
// metrics themselves. Judge performance work on the METRICS table in the PR
// comment (median, range, and Δ vs the main baseline in milliseconds), not the
// score. A wide range means the shared runner was contended: re-run for a
// cleaner sample. For changes that are purely about bytes,
// .github/size-report.mjs is a sharper instrument still: exact and noiseless.
// GitHub-hosted runners are the "burstable, shared-core" class Lighthouse's own
// variability guidance warns about; the first audit after Chrome install is
// also systematically cold, so the runner discards one warmup audit.
//
// THRESHOLDS — floors sit AT the current scores, because the gated categories
// are deterministic (zero variance across runs and environments once the
// environment artifacts above are skipped): any drop is a real regression. As
// with the bundle-size budget, an intentional, justified drop should lower the
// floor in the same change; an improvement should raise it.
//   Performance     warn  ≥ 0.75   preview ~0.85, production ~0.82–0.84.
//   Accessibility   error ≥ 0.95   held below 1.0 by color-contrast on muted
//                                   text and a subtitle2 rendered as <h6>
//                                   (heading-order).
//   Best Practices  error ≥ 1.00   perfect since the favicon landed (its 404
//                                   was the one failing audit).
//   SEO             error ≥ 1.00   (with is-crawlable skipped on workers.dev
//                                   hosts; production passes it outright).
//
// When a category has failing audits, the two environments can need DIFFERENT
// floors for the same defect: a skipped audit leaves the category's weight
// denominator, so one failing audit renormalizes to a lower score where more
// audits are skipped (while the favicon 404 was live, Best Practices was 0.96
// on workers.dev hosts but 0.95 on production). PRODUCTION_BUDGETS exists for
// that case; today the floors coincide.
//
// KNOBS
//   - RUNS: more runs give steadier medians at the cost of CI time.
//   - FORM_FACTOR: 'mobile' (Lighthouse's throttled default) or 'desktop'.
//     Only performance differs by form factor — the other three categories are
//     DOM/checklist-based — so auditing desktop too would only add a second,
//     higher performance number.
//   - Deeper states: point the runner at a Puppeteer script to drive the
//     calculator into its results + chart state before auditing.
//   - `npm run lighthouse` audits a locally served dist/ (dev convenience,
//     advisory only — CI gates deployed URLs).

export const RUNS = 3;
export const FORM_FACTOR = 'mobile';

// The deployed site, audited on pushes to main.
export const PROD_URL = 'https://kei3.japanfinance.org/';
// Deployed main without the zone layer — the baseline PR previews diff against.
export const WORKERS_URL = 'https://kei3.ts6081.workers.dev/';

// Environment-artifact audits removed from scoring (see SKIPPED AUDITS above).
export const SKIPPED_AUDITS = {
  app: ['is-crawlable'],
  production: ['deprecations', 'inspector-issues'],
};

// [category]: { level, minScore }. level 'error' fails CI when the median score
// is below minScore; 'warn' is reported but never fails. The gate applies all
// levels to the app audit (the PR preview, or main via workers.dev) and the
// error levels except performance to the production audit.
export const BUDGETS = {
  performance: { level: 'warn', minScore: 0.75 },
  accessibility: { level: 'error', minScore: 0.95 },
  'best-practices': { level: 'error', minScore: 1 },
  seo: { level: 'error', minScore: 1 },
};

// Production floors. The gate applies these (except performance) to the
// production audit. They currently coincide with BUDGETS, but set any
// category here when renormalization makes the same defect score differently
// per environment (see THRESHOLDS).
export const PRODUCTION_BUDGETS = {
  ...BUDGETS,
};

// Category id -> display label, in presentation order.
export const CATEGORY_LABELS = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best Practices',
  seo: 'SEO',
};
