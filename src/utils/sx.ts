// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Merges a component's base `sx` styles with an optional caller-provided `sx`, following MUI's
 * recommended array-merge pattern so both object and array `sx` overrides compose correctly.
 *
 * The two assertions are unavoidable here: `Array.isArray` widens the narrowed branch to `any`
 * under type-aware linting, and the resulting `SxProps[]` isn't structurally an `SxProps` until
 * asserted. Centralizing them keeps the call sites clean.
 */
export const mergeSx = (base: SxProps<Theme>, sx?: SxProps<Theme>): SxProps<Theme> => {
  const extra = (Array.isArray(sx) ? sx : [sx]) as readonly SxProps<Theme>[];
  return [base, ...extra] as SxProps<Theme>;
};
