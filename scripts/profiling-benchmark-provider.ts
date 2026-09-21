// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Vitest benchmark provider for `npm run profile`. It runs the benchmarks with Tinybench
// as Vitest's built-in provider does, and records a CPU profile of each benchmark's measured
// iterations, without its warm-up, to profiles/<benchmark>.cpuprofile.

import { mkdirSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';

// Tinybench is left out of package.json on purpose, so that this import resolves to the
// copy Vitest installs. The types below require that copy, because Vitest depends on one
// exact Tinybench version and types BenchmarkProvider against it.
import { Bench } from 'tinybench';
import type { BenchmarkProvider } from 'vitest';

const SAMPLING_INTERVAL_US = 100;

const session = new Session();
session.connect();
await session.post('Profiler.enable');
await session.post('Profiler.setSamplingInterval', { interval: SAMPLING_INTERVAL_US });
mkdirSync('profiles', { recursive: true });

export default {
  async run({ test, config, registrations, options }) {
    const bench = new Bench({
      signal: test.context.signal,
      retainSamples: config.retainSamples,
      ...options,
      setup: async (_task, mode) => {
        if (mode === 'run') await session.post('Profiler.start');
      },
      teardown: async (task, mode) => {
        if (mode !== 'run' || !task) return;
        const { profile } = await session.post('Profiler.stop');
        writeFileSync(`profiles/${task.name}.cpuprofile`, JSON.stringify(profile));
      },
    });
    for (const { name, fn, fnOpts } of registrations) bench.add(name, fn, fnOpts);
    await bench.run();

    return bench.tasks.map(task => {
      const { result } = task;
      if (result.state === 'errored') throw result.error;
      if (result.state !== 'completed') {
        throw new Error(`Benchmark "${task.name}" ended in the "${result.state}" state`);
      }
      return Object.assign(result, { name: task.name });
    });
  },
} satisfies BenchmarkProvider;
