// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    // `.claude` holds agent worktrees (full, sometimes-stale repo copies); without this,
    // `vitest run` collects their test files too. Mirrors the ignorePatterns in
    // .oxlintrc.json and .oxfmtrc.jsonc.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
