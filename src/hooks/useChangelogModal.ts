// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback, useRef } from 'react';

export const CHANGELOG_HASH = '#changelog';

export interface UseChangelogModalReturn {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  /** True when the changelog has entries newer than the last viewed date. */
  hasNewFeatures: boolean;
}

/**
 * Hook for managing changelog modal state with URL hash support
 * Enables deep linking to the changelog via #changelog
 *
 * @param hasUnreadEntries Result of the unread-entries check, resolving once
 *   the deferred changelog chunk has loaded (see the load sequencing in
 *   {@link import('../App')}). The badge starts hidden and lights up on a true
 *   resolution, so this hook needs no changelog-data imports of its own.
 */
export function useChangelogModal(hasUnreadEntries: Promise<boolean>): UseChangelogModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewFeatures, setHasNewFeatures] = useState(false);
  // A late resolution must not light the badge for entries the user has
  // already seen by opening the modal before the check completed.
  const viewedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void hasUnreadEntries.then(hasUnread => {
      if (!cancelled && !viewedRef.current) {
        setHasNewFeatures(hasUnread);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hasUnreadEntries]);

  // Check if the page loads with the changelog hash
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === CHANGELOG_HASH) {
        setIsOpen(true);
      }
    };

    // Check initial hash
    checkHash();

    // Listen for hash changes (back/forward buttons)
    const handleHashChange = () => {
      checkHash();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openModal = useCallback(() => {
    setIsOpen(true);
    viewedRef.current = true;
    setHasNewFeatures(false); // Remove the unread dot once viewed
    // Update URL hash when opening modal
    if (window.location.hash !== CHANGELOG_HASH) {
      window.history.pushState(null, '', CHANGELOG_HASH);
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Remove hash when closing modal
    if (window.location.hash === CHANGELOG_HASH) {
      // Use replaceState to avoid creating unnecessary history entries
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  return {
    isOpen,
    openModal,
    closeModal,
    hasNewFeatures,
  };
}
