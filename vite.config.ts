// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { defineConfig } from 'vite'
import { cloudflare } from "@cloudflare/vite-plugin";
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      cloudflare(),
      react(),
      visualizer({
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      })
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
})
