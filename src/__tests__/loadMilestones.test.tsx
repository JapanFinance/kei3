// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadMilestone } from '../utils/loadMilestones';

// The hook keeps a module-level record of fired marks, so each test imports a
// fresh copy of the module.
async function freshHook() {
  vi.resetModules();
  return (await import('../utils/loadMilestones')).useLoadMilestone;
}

function probeFor(useLoadMilestone: (name: LoadMilestone) => void, name: LoadMilestone) {
  return function Probe() {
    useLoadMilestone(name);
    return null;
  };
}

describe('useLoadMilestone', () => {
  beforeEach(() => {
    // Run both requestAnimationFrame stages synchronously so the mark is
    // recorded by the time render() returns.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    performance.clearMarks();
  });

  it('records the mark once for a StrictMode double-mounted component', async () => {
    const Probe = probeFor(await freshHook(), 'app-rendered');
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );

    expect(performance.getEntriesByName('app-rendered', 'mark')).toHaveLength(1);
  });

  it('does not repeat the mark on re-render or for a later second instance', async () => {
    const Probe = probeFor(await freshHook(), 'results-rendered');
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    render(<Probe />);

    expect(performance.getEntriesByName('results-rendered', 'mark')).toHaveLength(1);
  });

  it('marks immediately when requestAnimationFrame is unavailable', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const Probe = probeFor(await freshHook(), 'chart-rendered');
    render(<Probe />);

    expect(performance.getEntriesByName('chart-rendered', 'mark')).toHaveLength(1);
  });
});
