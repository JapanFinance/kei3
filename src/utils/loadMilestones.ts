// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from 'react';

// User Timing marks for when the app's own content becomes visible. The
// loading shell paints before the app loads, so Lighthouse's FCP/LCP report
// the shell; these marks carry the signal those metrics no longer do. CI reads
// them from each Lighthouse run's user-timings audit and reports them on the
// pull request (.github/lighthouse-run.mjs), so the names are tracked
// identifiers — renaming one breaks its history and its Δ against main.
export type LoadMilestone = 'app-rendered' | 'results-rendered' | 'chart-rendered';

// Marks already recorded (or scheduled) this page load. Each milestone is a
// first-time-only event; the guard also absorbs StrictMode's doubled dev
// effects.
const marked = new Set<LoadMilestone>();

/**
 * Records {@link name} once, as a performance.mark, after the calling
 * component's first commit is on screen. The first requestAnimationFrame
 * callback runs just before the next frame — the one containing the commit —
 * paints; nesting a second one defers the mark to just after that paint.
 * jsdom can lack requestAnimationFrame, so tests fall back to marking
 * immediately.
 */
export function useLoadMilestone(name: LoadMilestone): void {
  useEffect(() => {
    if (marked.has(name)) return;
    marked.add(name);
    if (typeof requestAnimationFrame !== 'function') {
      performance.mark(name);
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => performance.mark(name));
    });
  }, [name]);
}
