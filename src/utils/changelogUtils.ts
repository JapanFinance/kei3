export interface ChangelogEntry {
  date: string; // ISO format (yyyy-mm-dd) for parsing, display format handled in UI
  sections: {
    new?: string[];
    updated?: string[];
    fixed?: string[];
    deprecated?: string[];
    removed?: string[];
    security?: string[];
  };
}

export interface ParsedChangelog {
  entries: ChangelogEntry[];
  latestDate?: string;
}

/**
 * Simple markdown changelog parser
 * Parses a changelog with ISO date headers (yyyy-mm-dd)
 */
export function parseChangelog(markdownContent: string): ParsedChangelog {
  const lines = markdownContent.split('\n').map(line => line.trim());
  const entries: ChangelogEntry[] = [];
  let currentEntry: ChangelogEntry | null = null;
  let currentSection: keyof ChangelogEntry['sections'] | null = null;

  for (const line of lines) {
    // Check for date header (## 2025-01-15)
    const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      // Save previous entry
      if (currentEntry) {
        entries.push(currentEntry);
      }
      
      const date = dateMatch[1];
      
      if (date) {
        currentEntry = {
          date,
          sections: {}
        };
        currentSection = null;
      }
      continue;
    }

    // Check for section headers (### New, ### Updated, etc.)
    const sectionMatch = line.match(/^### (New|Updated|Fixed|Deprecated|Removed|Security)/i);
    if (sectionMatch && currentEntry && sectionMatch[1]) {
      currentSection = sectionMatch[1].toLowerCase() as keyof ChangelogEntry['sections'];
      currentEntry.sections[currentSection] = [];
      continue;
    }

    // Check for list items
    const listMatch = line.match(/^- (.+)/);
    if (listMatch && currentEntry && currentSection && listMatch[1]) {
      const items = currentEntry.sections[currentSection] || [];
      items.push(listMatch[1]);
      currentEntry.sections[currentSection] = items;
      continue;
    }
  }

  // Add the last entry
  if (currentEntry) {
    entries.push(currentEntry);
  }

  // Find latest date (entries are in reverse chronological order, so first is latest)
  const latestDate = entries[0]?.date;

  return {
    entries,
    ...(latestDate ? { latestDate } : {})
  };
}

/**
 * Get the date that should be considered "new" for notification purposes
 */
export function getLatestReleaseDate(changelog: ParsedChangelog): string | undefined {
  return changelog.latestDate;
}

/**
 * Check if there are new updates since the last viewed date
 */
export function hasNewUpdates(changelog: ParsedChangelog, lastViewedDate?: string): boolean {
  if (!lastViewedDate) return true;
  
  const latestDate = getLatestReleaseDate(changelog);
  if (!latestDate) return false;
  
  return latestDate !== lastViewedDate;
}

/**
 * Format ISO date (yyyy-mm-dd) to human readable format
 */
export function formatChangelogDate(isoDate: string): string {
  try {
    const date = new Date(isoDate + 'T00:00:00'); // Add time to avoid timezone issues
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return isoDate; // Fallback to ISO format if parsing fails
  }
}

/**
 * Local storage keys for changelog functionality
 */
export const CHANGELOG_STORAGE_KEYS = {
  LAST_VIEWED_DATE: 'changelog-last-viewed-date'
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
