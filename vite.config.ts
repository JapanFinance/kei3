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
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom)[\\/]/,
            },
            {
              name: 'mui',
              test: /node_modules[\\/]@mui[\\/]/,
            },
            {
              name: 'charts',
              test: /node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
            },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
}));
