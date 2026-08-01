// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Separate from {@link import('./changelogUtils')} so that module stays free of
// browser APIs: the build reads it from Node to bake in the latest entry date.

/**
 * Local storage keys for changelog functionality
 */
export const CHANGELOG_STORAGE_KEYS = {
  LAST_VIEWED_DATE: 'changelog-last-viewed-date',
} as const;

/**
 * Get the last viewed date from localStorage
 */
export function getLastViewedDate(): string | null {
  try {
    return localStorage.getItem(CHANGELOG_STORAGE_KEYS.LAST_VIEWED_DATE);
  } catch {
    return null;
  }
}

/**
 * Set the last viewed date in localStorage
 */
export function setLastViewedDate(date: string): void {
  try {
    localStorage.setItem(CHANGELOG_STORAGE_KEYS.LAST_VIEWED_DATE, date);
  } catch {
    // Silently fail if localStorage is not available
  }
}
