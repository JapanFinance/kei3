// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes a CPU profile of the tax calculation for each engine benchmark scenario
// (src/__tests__/fixtures/engineScenarios.ts) to profiles/<scenario>.cpuprofile, to open in
// Chrome DevTools (Performance panel, "Load profile") or VS Code. Each scenario runs in a plain
// loop, warmed up first, so that the profile shows the optimized code the benchmark measures.
//
// Usage: npm run profile [-- <scenario>...]

import './source-hooks.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';

const WARM_UP_MS = 500;
const PROFILE_MS = 2000;
const SAMPLING_INTERVAL_US = 100;

const { ENGINE_SCENARIOS, runScenario } =
  await import('../src/__tests__/fixtures/engineScenarios.ts');

const names = process.argv.slice(2);
for (const name of names) {
  if (!(name in ENGINE_SCENARIOS)) {
    throw new Error(
      `Unknown scenario "${name}". Known: ${Object.keys(ENGINE_SCENARIOS).join(', ')}`,
    );
  }
}

let takeHome = 0;
const runFor = (ms, inputs) => {
  let runs = 0;
  const end = performance.now() + ms;
  while (performance.now() < end) {
    takeHome += runScenario(inputs);
    runs++;
  }
  return runs;
};

const session = new Session();
session.connect();
await session.post('Profiler.enable');
await session.post('Profiler.setSamplingInterval', { interval: SAMPLING_INTERVAL_US });
mkdirSync('profiles', { recursive: true });

const profileScenario = async name => {
  const inputs = ENGINE_SCENARIOS[name];
  runFor(WARM_UP_MS, inputs);
  await session.post('Profiler.start');
  const runs = runFor(PROFILE_MS, inputs);
  const { profile } = await session.post('Profiler.stop');
  const path = `profiles/${name}.cpuprofile`;
  writeFileSync(path, JSON.stringify(profile));
  console.log(`${path}: ${runs} runs, ${(PROFILE_MS / runs).toFixed(4)} ms each`);
};

for (const name of names.length > 0 ? names : Object.keys(ENGINE_SCENARIOS)) {
  // eslint-disable-next-line no-await-in-loop -- the profiler samples the whole process, so the scenarios run one after another
  await profileScenario(name);
}

session.disconnect();
if (!(takeHome > 0)) throw new Error('The scenarios computed no take-home income.');
