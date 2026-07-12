// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bundle-size budget for the production assets users download. Enforced in CI
// (.github/workflows/deploy.yml) and runnable locally with `npm run size`
// after `npm run build`.
//
// One check over the built JS and CSS (dist/assets/*.{js,css}), gated on the
// combined Brotli size — what Cloudflare serves to modern browsers (gzip is
// only the fallback for old clients). The budget is deliberately tight — a
// couple of kB above the current total — so any real size increase fails CI. An
// intentional, justified increase should raise this limit in the same change
// that adds the weight. (Sourcemaps, dist/assets/*.map, are dev-only, excluded.)
//
// The Brotli figure is a stable proxy, not Cloudflare's exact bytes: size-limit
// compresses at Node's max quality while Cloudflare uses a lower level, so it
// serves a little more. That's fine — the budget tracks regressions, not the
// absolute transfer size. Real-world performance is covered by Lighthouse.
//
// Baseline when added (2026-07): ~264 kB Brotli combined (264,038 B; ~310 kB
// gzip).
export default [
  {
    name: 'Total JS + CSS',
    path: 'dist/assets/*.{js,css}',
    brotli: true,
    limit: '266 kB',
  },
];
