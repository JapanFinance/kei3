// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, test } from 'vitest';

import { ENGINE_SCENARIOS, runScenario } from './fixtures/engineScenarios';

// `npm run bench:baseline` saves each result, and `npm run bench:compare` shows the saved result
// beside the new one.
const mode = import.meta.env.MODE;

test.for(Object.entries(ENGINE_SCENARIOS))('%s', async ([name, inputs], { bench }) => {
  let takeHome = 0;
  const run = () => {
    takeHome += runScenario(inputs);
  };
  const baselinePath = `bench-baseline/${name}.json`;
  const current =
    mode === 'baseline' ? bench(name, { writeResult: baselinePath }, run) : bench(name, run);

  if (mode === 'compare') await bench.compare(current, bench.from('baseline', baselinePath));
  else await current.run();

  expect(takeHome).toBeGreaterThan(0);
});
