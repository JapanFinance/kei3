// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from 'react';

import changelogContent from '../../CHANGELOG.md?raw';
import { getLastViewedDate, hasNewUpdates, parseChangelog } from '../utils/changelogUtils';

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
 */
export function useChangelogModal(): UseChangelogModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewFeatures, setHasNewFeatures] = useState(() => {
    try {
      return hasNewUpdates(parseChangelog(changelogContent), getLastViewedDate() || undefined);
    } catch (error) {
      console.warn('Failed to check for changelog updates:', error);
      return false;
    }
  });

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
