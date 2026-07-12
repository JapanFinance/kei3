// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import '@testing-library/jest-dom';

// Note: useMediaQuery mock might not be needed since jsdom
// naturally returns false for media queries, but keeping it
// for explicit behavior and future-proofing
import { vi } from 'vitest';

vi.mock('@mui/material/useMediaQuery', () => ({
  default: vi.fn(() => false), // Always return desktop view by default
}));

// jsdom does not implement window.matchMedia, which MUI's useColorScheme calls
// to detect the system color scheme. Provide a minimal light-mode stub.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
