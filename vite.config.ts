// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { defineConfig, type PluginOption } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
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
