// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { vi } from 'vitest';

class StubMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media: string;
  readonly matches: boolean;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null = null;

  constructor(media: string, matches: boolean) {
    super();
    this.media = media;
    this.matches = matches;
  }

  addListener(): void {
    // Deprecated MediaQueryList method required by the DOM interface.
  }

  removeListener(): void {
    // Deprecated MediaQueryList method required by the DOM interface.
  }
}

/** Evaluates `(min-width: Npx)` / `(max-width: Npx)` media query clauses against `widthPx`. */
const matchesWidth = (query: string, widthPx: number): boolean => {
  const clauses = [...query.matchAll(/\(\s*(min|max)-width\s*:\s*([0-9.]+)px\s*\)/g)];
  return (
    clauses.length > 0 &&
    clauses.every(([, bound, px]) => {
      const limit = Number(px);
      return bound === 'min' ? widthPx >= limit : widthPx <= limit;
    })
  );
};

/**
 * Stubs `window.matchMedia` so MUI's real `useMediaQuery` hook evaluates width breakpoints
 * against `widthPx` (e.g. `375` for a phone screen below MUI's 600px `sm` breakpoint).
 * Call `vi.unstubAllGlobals()` in `afterEach` to restore jsdom's default.
 */
export const stubViewportWidth = (widthPx: number): void => {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList => new StubMediaQueryList(query, matchesWidth(query, widthPx)),
  );
};
