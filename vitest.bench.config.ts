// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { configDefaults, defineConfig } from 'vitest/config';

import { ENGINE_SCENARIO_NAMES } from './src/__tests__/fixtures/engineScenarioNames.ts';

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
    // Vitest runs each project in its own worker process, so a project per scenario keeps the
    // type feedback and optimized code that V8 collects in one scenario out of the next.
    projects: ENGINE_SCENARIO_NAMES.map(scenario => ({
      test: { name: scenario, provide: { scenario } },
    })),
  },
}));
