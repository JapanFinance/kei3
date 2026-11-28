// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback, useRef } from 'react';

import { getLastViewedDate, setLastViewedDate } from '../utils/changelogStorage';

export const CHANGELOG_HASH = '#changelog';
const CHANGELOG_ENTRY_HASH_REGEX = /^#changelog-(\d{4}-\d{2}-\d{2})$/;

export function changelogEntryHash(date: string): string {
  return `#changelog-${date}`;
}

export function parseChangelogHash(hash: string): { isOpen: boolean; targetDate: string | null } {
  if (hash === CHANGELOG_HASH) {
    return { isOpen: true, targetDate: null };
  }
  const match = hash.match(CHANGELOG_ENTRY_HASH_REGEX);
  if (match?.[1]) {
    return { isOpen: true, targetDate: match[1] };
  }
  return { isOpen: false, targetDate: null };
}

export function isChangelogHash(hash: string): boolean {
  return parseChangelogHash(hash).isOpen;
}

export interface UseChangelogModalReturn {
  isOpen: boolean;
  /** True once the modal has been opened at least once, keeping exit transitions mounted. */
  hasOpened: boolean;
  /** Target ISO date from `#changelog-YYYY-MM-DD`, or null when opened generically. */
  targetDate: string | null;
  /** Last viewed date captured before this open session, for highlighting unread entries. */
  previousLastViewedDate: string | null;
  openModal: () => void;
  closeModal: () => void;
  /**
   * Records the newest entry as read. The modal calls this once it is on
   * screen, so a visitor who opens the changelog and leaves before its module
   * arrives still sees the dot next time.
   */
  markViewed: () => void;
  /** True when the changelog has entries newer than the last viewed date. */
  hasNewFeatures: boolean;
}

/**
 * Hook for managing changelog modal state with URL hash support.
 * Enables deep linking to `#changelog` or a specific release `#changelog-YYYY-MM-DD`.
 *
 * Comparing the build-time changelog date against the stored one decides the
 * unread dot without loading the changelog itself, which ships only with the
 * lazily loaded modal.
 */
export function useChangelogModal(): UseChangelogModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [previousLastViewedDate, setPreviousLastViewedDate] = useState<string | null>(() =>
    getLastViewedDate(),
  );
  const [hasNewFeatures, setHasNewFeatures] = useState(
    () => __LATEST_CHANGELOG_DATE__ !== '' && getLastViewedDate() !== __LATEST_CHANGELOG_DATE__,
  );
  // Mirrors `isOpen` for the `[]`-dep hash listener and `openModal` callback so they read live
  // open state without stale closures or re-subscribing on every open/close.
  const isOpenRef = useRef(false);

  const markViewed = useCallback(() => {
    if (__LATEST_CHANGELOG_DATE__ !== '') {
      setLastViewedDate(__LATEST_CHANGELOG_DATE__);
    }
    setHasNewFeatures(false);
  }, []);

  // Check if the page loads with a changelog hash and track back/forward navigation.
  useEffect(() => {
    const checkHash = () => {
      const parsed = parseChangelogHash(window.location.hash);
      if (parsed.isOpen) {
        // Snapshot the prior viewed date only on a closed -> open transition; once open,
        // `markViewed()` overwrites localStorage, so changing hashes mid-session must not clear
        // the "New since last visit" highlight.
        if (!isOpenRef.current) {
          setPreviousLastViewedDate(getLastViewedDate());
        }
        isOpenRef.current = true;
        setHasOpened(true);
        setIsOpen(true);
        setTargetDate(parsed.targetDate);
      } else if (isOpenRef.current) {
        // Only reset when leaving a changelog hash while the modal is actually open.
        isOpenRef.current = false;
        setIsOpen(false);
        setTargetDate(null);
      }
    };

    checkHash();

    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const openModal = useCallback(() => {
    if (!isOpenRef.current) {
      setPreviousLastViewedDate(getLastViewedDate());
    }
    isOpenRef.current = true;
    setHasOpened(true);
    setIsOpen(true);
    setTargetDate(null);
    // Hide the dot on the click itself so the button responds immediately.
    // Only markViewed writes it down, so this is forgotten on a reload if the
    // changelog never actually appeared.
    setHasNewFeatures(false);
    // Update URL hash when opening modal
    if (!isChangelogHash(window.location.hash)) {
      window.history.pushState(null, '', CHANGELOG_HASH);
    }
  }, []);

  const closeModal = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    setTargetDate(null);
    // Remove hash when closing modal
    if (isChangelogHash(window.location.hash)) {
      // Use replaceState to avoid creating unnecessary history entries
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  return {
    isOpen,
    hasOpened,
    targetDate,
    previousLastViewedDate,
    openModal,
    closeModal,
    markViewed,
    hasNewFeatures,
  };
}
