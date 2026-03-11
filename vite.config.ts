// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { defineConfig, type PluginOption } from 'vite'
import { cloudflare } from "@cloudflare/vite-plugin";
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import Sitemap from 'vite-plugin-sitemap'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    cloudflare(),
    react(),
    Sitemap({
      hostname: 'https://kei3.japanfinance.org/',
      generateRobotsTxt: true,
      robots: [] // Only include the sitemap in robots.txt
    }),
    mode === 'analyze' ? visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }) as PluginOption : null
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'react-dom-client': ['react-dom/client'],
          mui: ['@mui/material'],
          charts: ['chart.js', 'react-chartjs-2']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    target: 'es2020'
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client']
  }
}))
