import { useState, useEffect, useCallback } from 'react';

export const CHANGELOG_HASH = '#changelog';

export interface UseChangelogModalReturn {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

/**
 * Hook for managing changelog modal state with URL hash support
 * Enables deep linking to the changelog via #changelog
 */
export function useChangelogModal(): UseChangelogModalReturn {
  const [isOpen, setIsOpen] = useState(false);

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
    closeModal
  };
}
