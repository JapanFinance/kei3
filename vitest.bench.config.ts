// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { configDefaults, defineConfig } from 'vitest/config';

// Benchmarks import the sources natively instead of through Vite's module runner, which turns
// every access to an imported binding into a getter call and inflates the timings.
export default defineConfig(({ mode }) => ({
  test: {
    benchmark: {
      exclude: [...configDefaults.exclude, '**/.claude/**'],
      ...(mode === 'profile' && { provider: 'scripts/profiling-benchmark-provider.ts' }),
    },
    execArgv: ['--import', new URL('scripts/source-hooks.mjs', import.meta.url).href],
    experimental: { viteModuleRunner: false },
  },
}));
