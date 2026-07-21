// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';
import Sitemap from 'vite-plugin-sitemap';

// Vite does not minify index.html, so HTML comments (e.g. the documentation
// block for the inline stale-build probe) would ship to every visitor.
// Removal is repeated until the output stabilizes because deleting a comment
// can join surrounding text into a new "<!--" (CodeQL js/incomplete-multi-
// character-sanitization); a single pass could leave such a comment in place.
const stripHtmlComments = (): PluginOption => ({
  name: 'strip-html-comments',
  apply: 'build',
  transformIndexHtml: html => {
    let previous;
    do {
      previous = html;
      html = html.replace(/[ \t]*<!--[\s\S]*?-->\n?/g, '');
    } while (html !== previous);
    return html;
  },
});

// Content Security Policy, written into the deployed _headers at build time.
//
// index.html carries two inline scripts — the pre-paint theme setter and the
// stale-build probe — both inlined on purpose so they run before first paint,
// and the probe even when every bundled asset fails to load. script-src can
// therefore not be 'self' alone; each inline script needs an sha256 source
// expression. Deriving those hashes from the emitted HTML on every build,
// rather than pinning them in the static _headers, means editing either inline
// script can never leave behind a stale hash that would silently break the
// live site (the theme flash returns, or the stale-build recovery stops).
//
// style-src keeps 'unsafe-inline': emotion (MUI) inserts <style> rules whose
// content varies per render, so they cannot be hashed, and a per-request nonce
// is impossible on pure static-asset serving with no Worker in front of the
// HTML. Inline-style injection is a low risk and still earns a top grade from
// the header scanners. A JSON-LD block is data, not executed, so script-src
// does not apply to it and it needs no hash.
const inlineScriptHashes = (html: string): string[] => {
  const scriptTag = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  const hashes: string[] = [];
  for (let match = scriptTag.exec(html); match; match = scriptTag.exec(html)) {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(match[1] ?? '')) continue;
    const digest = createHash('sha256')
      .update(match[2] ?? '', 'utf8')
      .digest('base64');
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
};

// Sentry CSP report collector (the DSN's public ingest URL, safe to commit —
// it appears in the response header to every visitor). Empty disables all
// report directives. sentry_environment is appended per environment below so
// reports are filterable in Sentry.
const CSP_REPORT_ENDPOINT =
  'https://o4511773324738560.ingest.us.sentry.io/api/4511773344661504/security/?sentry_key=4126ad22f0024108b9020384ab4b71fc';

// CSP is emitted once per deployed environment, host-scoped, so each carries a
// distinct Sentry environment tag and a request matches exactly one rule (two
// matching rules would combine into two enforced policies). The workers.dev
// pattern mirrors public/_headers; localhost preview matches neither and so
// carries no CSP — the production zone layer it cannot reproduce is the only
// environment worth validating a policy against anyway.
const CSP_ENVIRONMENTS = [
  { host: 'https://kei3.japanfinance.org/*', sentryEnvironment: 'production' },
  { host: 'https://:version.:subdomain.workers.dev/*', sentryEnvironment: 'staging' },
];

const securityHeaders = (options: {
  cspReportOnly: boolean;
  reportEndpoint: string;
}): PluginOption => ({
  name: 'security-headers',
  apply: 'build',
  writeBundle(outputOptions) {
    const outDir = resolve(outputOptions.dir ?? 'dist');
    const headersPath = resolve(outDir, '_headers');
    const indexPath = resolve(outDir, 'index.html');
    // The Cloudflare Worker build (once one exists) emits a separate bundle
    // with neither file; only the static-asset output carries index.html and
    // the _headers copied from public/.
    if (!existsSync(headersPath) || !existsSync(indexPath)) return;

    const scriptSrc = ["'self'", ...inlineScriptHashes(readFileSync(indexPath, 'utf8'))].join(' ');
    const cspField = options.cspReportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    // Sentry documents that its ingest host must be in connect-src (or
    // default-src), otherwise the browser blocks the report submission and the
    // collector silently receives nothing.
    const reportOrigin = options.reportEndpoint ? new URL(options.reportEndpoint).origin : '';
    const connectSrc = reportOrigin ? `connect-src 'self' ${reportOrigin}` : "connect-src 'self'";

    const cspFor = (reportUrl: string): string =>
      [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        `script-src ${scriptSrc}`,
        connectSrc,
        'upgrade-insecure-requests',
        // report-to is the current Reporting API; report-uri is the legacy
        // mechanism still needed by browsers that have not implemented report-to.
        reportUrl ? 'report-to csp-endpoint' : null,
        reportUrl ? `report-uri ${reportUrl}` : null,
      ]
        .filter(Boolean)
        .join('; ');

    const reportUrlFor = (env: string): string =>
      options.reportEndpoint ? `${options.reportEndpoint}&sentry_environment=${env}` : '';

    // Opt out of browser features the calculator never uses, so a future
    // injected script cannot silently reach for them. Environment-independent,
    // so it applies everywhere via /*.
    const permissionsPolicy = [
      'accelerometer',
      'autoplay',
      'browsing-topics',
      'camera',
      'display-capture',
      'encrypted-media',
      'geolocation',
      'gyroscope',
      'magnetometer',
      'microphone',
      'midi',
      'payment',
      'picture-in-picture',
      'usb',
      'xr-spatial-tracking',
    ]
      .map(feature => `${feature}=()`)
      .join(', ');

    // Sentry recommends sending both the legacy Report-To JSON header and the
    // modern Reporting-Endpoints header; report-to's group name resolves in
    // either, covering browsers that implement one but not the other.
    const envBlocks = CSP_ENVIRONMENTS.map(({ host, sentryEnvironment }) => {
      const reportUrl = reportUrlFor(sentryEnvironment);
      return [
        host,
        `  ${cspField}: ${cspFor(reportUrl)}`,
        reportUrl
          ? `  Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"${reportUrl}"}],"include_subdomains":true}`
          : null,
        reportUrl ? `  Reporting-Endpoints: csp-endpoint="${reportUrl}"` : null,
      ]
        .filter(Boolean)
        .join('\n');
    });

    const permissionsBlock = [
      '# Security headers. The Content-Security-Policy script-src hashes are',
      '# regenerated from the emitted index.html on every build by the',
      '# security-headers plugin in vite.config, so editing an inline script',
      '# can never leave a stale hash behind. HSTS, Referrer-Policy,',
      '# X-Content-Type-Options and X-Frame-Options are set at the Cloudflare',
      '# edge and are intentionally not duplicated here. CSP is emitted per',
      '# environment below (host-scoped) so its reports carry a distinct Sentry',
      '# tag; Permissions-Policy is environment-independent.',
      '/*',
      `  Permissions-Policy: ${permissionsPolicy}`,
    ].join('\n');

    const block = [permissionsBlock, ...envBlocks].join('\n\n');
    writeFileSync(headersPath, `${readFileSync(headersPath, 'utf8').trimEnd()}\n\n${block}\n`);
  },
});

// Vendor chunk strategy, chosen by measuring builds (Brotli bytes per load
// wave, re-download cost after a deploy, and throttled Lighthouse traces)
// against rolldown's automatic splitting and several alternatives. Manual
// grouping keeps vendor code out of app chunks, so the large, rarely-changing
// vendor chunks keep their hashes (and stay immutable-cached) across app-code
// deploys; automatic splitting instead places react-dom in the entry chunk
// and MUI inside app chunks, making a typical deploy re-download most of the
// bundle. react and charts get dedicated groups so their bytes have cache
// lifetimes independent of the more frequently updated MUI-dominated rest.
//
// The remaining vendor modules are split by when they are first needed:
// - vendor-eager: statically reachable from the entry, so downloaded and
//   evaluated before the loading screen (Root's Suspense fallback) can paint.
// - vendor-deferred: reachable only through a dynamic import; it loads with
//   the first lazy chunk that needs it, fetched in parallel via that chunk's
//   preload list, and can never delay first paint — the entry cannot
//   statically import it, so index.html can never modulepreload it.
// The classification walks static importer edges up to an entry, deriving the
// split from the module graph rather than a hand-maintained list of package
// paths: a vendor upgrade that moves files around cannot break it, and a new
// eagerly-imported component moves only the modules it actually needs into
// vendor-eager instead of dragging the whole library forward.
type ChunkGraph = {
  getModuleInfo(id: string): { isEntry: boolean; importers: string[] } | null;
};

// A dynamic import edge appears in dynamicImporters, not importers, so the
// walk stops at lazy boundaries by construction. Within one walk the visiting
// set both breaks import cycles and memoizes exhausted subtrees; results are
// not cached across walks because a cross-walk cache would need cycle-aware
// invalidation to stay correct.
const eagerlyReachable = (id: string, graph: ChunkGraph, visiting = new Set<string>()): boolean => {
  if (visiting.has(id)) return false;
  visiting.add(id);
  const info = graph.getModuleInfo(id);
  if (!info) return false;
  return (
    info.isEntry || info.importers.some(importer => eagerlyReachable(importer, graph, visiting))
  );
};

// Groups are matched in order; a module claimed by an earlier group is
// excluded from later ones.
const codeSplitting = {
  groups: [
    {
      name: 'react',
      test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
    },
    {
      name: 'charts',
      test: /node_modules[\\/](chart\.js|react-chartjs-2|@kurkle)[\\/]/,
    },
    {
      name: (id: string, ctx: ChunkGraph) =>
        id.includes('node_modules')
          ? eagerlyReachable(id, ctx)
            ? 'vendor-eager'
            : 'vendor-deferred'
          : null,
      // Every vendor module is classified individually above; recursive
      // dependency capture would let one group claim modules the walk
      // assigned to the other.
      includeDependenciesRecursively: false,
    },
  ],
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    cloudflare(),
    stripHtmlComments(),
    // Report-Only during rollout: deliver the policy and collect violations
    // without blocking, so the production custom domain can be observed before
    // enforcing. Flip cspReportOnly to false once the collector shows no
    // legitimate resource is caught (and Cloudflare JS Detections is off, since
    // its injected inline script has no hash and would be blocked).
    securityHeaders({ cspReportOnly: true, reportEndpoint: CSP_REPORT_ENDPOINT }),
    react(),
    Sitemap({
      hostname: 'https://kei3.japanfinance.org/',
      generateRobotsTxt: true,
      robots: [], // Only include the sitemap in robots.txt
    }),
    mode === 'analyze'
      ? (visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
        }) as PluginOption)
      : null,
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting,
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
}));
