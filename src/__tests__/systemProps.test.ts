// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

// MUI v9 removed system-prop handling from Box, Stack, Typography, Link, Grid and
// DialogContentText. A palette path such as `color="text.secondary"` is no longer
// resolved: Typography's own `color` prop takes only palette keys, so the dotted
// value reaches the DOM element and is dropped there. Theme colours go through `sx`.
const DOTTED_COLOR_PROP = /color="[a-z][a-zA-Z]*\.[a-zA-Z]+"/g;

const sources = import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true });

describe('MUI system props', () => {
  it('routes theme colour paths through sx rather than a color prop', () => {
    const offenders = Object.entries(sources).flatMap(([path, source]) =>
      ((source as string).match(DOTTED_COLOR_PROP) ?? []).map(match => `${path}: ${match}`),
    );

    expect(offenders).toEqual([]);
  });

  it('scans the component sources', () => {
    // Guards against a glob that silently matches nothing, which would make the
    // check above pass regardless of what the components contain.
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it('detects a dotted colour prop', () => {
    expect('<Typography color="text.secondary">'.match(DOTTED_COLOR_PROP)).toEqual([
      'color="text.secondary"',
    ]);
  });
});
