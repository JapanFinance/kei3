// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';
import Sitemap from 'vite-plugin-sitemap';

import { changelogDefine } from './changelogDate';

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

/**
 * Computes a script-src source expression for each executable inline script in
 * the built HTML, so the policy can allow them without 'unsafe-inline'.
 *
 * A hash covers the exact script text, so deriving them from the emitted HTML
 * on every build means editing an inline script cannot leave a stale hash
 * behind. A JSON-LD block is data rather than code, so script-src does not
 * apply to it and it is skipped.
 *
 * @param html - The emitted index.html
 * @returns Quoted 'sha256-...' source expressions
 */
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

// Empty disables all report directives.
const CSP_REPORT_ENDPOINT =
  'https://o4511773324738560.ingest.us.sentry.io/api/4511773344661504/security/?sentry_key=4126ad22f0024108b9020384ab4b71fc';

// Cloudflare Web Analytics is injected at the edge, into browser requests only:
// a plain curl does not receive the beacon tag, so check for it with a browser
// User-Agent and Accept. The beacon reports to /cdn-cgi/rum on this origin, so
// connect-src needs no entry of its own; were a later version to post to
// cloudflareinsights.com instead, the violation reports would show it.
const CLOUDFLARE_ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com';

// CSP is emitted once per deployed environment, host-scoped, so each carries a
// distinct Sentry environment tag and a request matches exactly one rule.
const CSP_ENVIRONMENTS = [
  { host: 'https://kei3.japanfinance.org/*', sentryEnvironment: 'production' },
  { host: 'https://:version.:subdomain.workers.dev/*', sentryEnvironment: 'staging' },
];

/**
 * Appends the Content-Security-Policy and Permissions-Policy to the _headers
 * file copied from public/, hashing the built index.html for script-src.
 *
 * One CSP rule is written per entry in {@link CSP_ENVIRONMENTS}, so each
 * deployed host reports under its own Sentry environment. Permissions-Policy is
 * host-independent and applies to every path.
 *
 * @param options.cspReportOnly - Deliver as Content-Security-Policy-Report-Only,
 *   which observes violations without blocking, and drop the directives such a
 *   policy ignores
 * @param options.reportEndpoint - Violation collector URL; empty omits every
 *   reporting directive and header
 */
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

    const scriptSrc = [
      "'self'",
      CLOUDFLARE_ANALYTICS_SCRIPT,
      ...inlineScriptHashes(readFileSync(indexPath, 'utf8')),
    ].join(' ');
    const cspField = options.cspReportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    // Report ingest host must be in connect-src (or default-src), otherwise
    // the browser blocks the report submission and the collector silently
    // receives nothing.
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
        // emotion (MUI) inserts <style> rules whose content varies per render,
        // so they cannot be hashed, and a nonce would need per-request HTML
        // that static-asset serving cannot produce.
        "style-src 'self' 'unsafe-inline'",
        `script-src ${scriptSrc}`,
        connectSrc,
        // upgrade-insecure-requests is silently ignored in a report-only policy,
        // and the browser logs a console warning
        options.cspReportOnly ? null : 'upgrade-insecure-requests',
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
    // injected script cannot silently reach for them.
    const permissionsPolicy = [
      'accelerometer',
      'autoplay',
      'bluetooth',
      'browsing-topics',
      'camera',
      'display-capture',
      'encrypted-media',
      'geolocation',
      'gyroscope',
      'hid',
      'magnetometer',
      'microphone',
      'midi',
      'payment',
      'picture-in-picture',
      'serial',
      'usb',
      'xr-spatial-tracking',
    ]
      .map(feature => `${feature}=()`)
      .join(', ');

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
      '# security-headers plugin in vite.config.',
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
  define: changelogDefine(),
  plugins: [
    cloudflare(),
    stripHtmlComments(),
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
