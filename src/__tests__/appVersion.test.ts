// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { isHistoryStyleBoot } from '../utils/appVersion';

describe('isHistoryStyleBoot', () => {
  it('treats back/forward and restored boots as history-style', () => {
    expect(isHistoryStyleBoot('back_forward', false)).toBe(true);
  });

  it('treats Chrome discarded-tab reloads as history-style regardless of type', () => {
    expect(isHistoryStyleBoot('reload', true)).toBe(true);
    expect(isHistoryStyleBoot('navigate', true)).toBe(true);
  });

  it('skips fresh navigations and reloads, which always revalidate index.html', () => {
    expect(isHistoryStyleBoot('navigate', false)).toBe(false);
    expect(isHistoryStyleBoot('reload', false)).toBe(false);
    expect(isHistoryStyleBoot('prerender', false)).toBe(false);
  });

  it('errs on probing when the navigation type is unavailable', () => {
    expect(isHistoryStyleBoot(undefined, false)).toBe(true);
  });
});
