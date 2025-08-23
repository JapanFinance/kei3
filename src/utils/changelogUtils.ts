export interface ChangelogEntry {
  version: string;
  date?: string;
  sections: {
    added?: string[];
    changed?: string[];
    fixed?: string[];
    deprecated?: string[];
    removed?: string[];
    security?: string[];
  };
  isUnreleased?: boolean;
}

export interface ParsedChangelog {
  entries: ChangelogEntry[];
  latestVersion?: string;
}

/**
 * Simple markdown changelog parser
 * Parses a changelog following the Keep a Changelog format
 */
export function parseChangelog(markdownContent: string): ParsedChangelog {
  const lines = markdownContent.split('\n').map(line => line.trim());
  const entries: ChangelogEntry[] = [];
  let currentEntry: ChangelogEntry | null = null;
  let currentSection: keyof ChangelogEntry['sections'] | null = null;

  for (const line of lines) {
    // Check for version header (## [version] - date or ## [Unreleased])
    const versionMatch = line.match(/^## \[([^\]]+)\](?:\s*-\s*(.+))?/);
    if (versionMatch) {
      // Save previous entry
      if (currentEntry) {
        entries.push(currentEntry);
      }
      
      const version = versionMatch[1];
      const date = versionMatch[2];
      
      if (version) {
        currentEntry = {
          version,
          ...(date ? { date } : {}),
          sections: {},
          isUnreleased: version.toLowerCase() === 'unreleased'
        };
        currentSection = null;
      }
      continue;
    }

    // Check for section headers (### Added, ### Changed, etc.)
    const sectionMatch = line.match(/^### (Added|Changed|Fixed|Deprecated|Removed|Security)/i);
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

  // Find latest version (excluding unreleased)
  const latestVersion = entries.find(entry => !entry.isUnreleased)?.version;

  return {
    entries,
    ...(latestVersion ? { latestVersion } : {})
  };
}

/**
 * Get the version that should be considered "new" for notification purposes
 */
export function getLatestReleaseVersion(changelog: ParsedChangelog): string | undefined {
  return changelog.entries.find(entry => !entry.isUnreleased)?.version;
}

/**
 * Check if there are new updates since the last viewed version
 */
export function hasNewUpdates(changelog: ParsedChangelog, lastViewedVersion?: string): boolean {
  if (!lastViewedVersion) return true;
  
  const latestVersion = getLatestReleaseVersion(changelog);
  if (!latestVersion) return false;
  
  return latestVersion !== lastViewedVersion;
}

/**
 * Local storage keys for changelog functionality
 */
export const CHANGELOG_STORAGE_KEYS = {
  LAST_VIEWED_VERSION: 'changelog-last-viewed-version',
  LAST_VIEWED_DATE: 'changelog-last-viewed-date'
} as const;

/**
 * Get the last viewed version from localStorage
 */
export function getLastViewedVersion(): string | null {
  try {
    return localStorage.getItem(CHANGELOG_STORAGE_KEYS.LAST_VIEWED_VERSION);
  } catch {
    return null;
  }
}

/**
 * Set the last viewed version in localStorage
 */
export function setLastViewedVersion(version: string): void {
  try {
    localStorage.setItem(CHANGELOG_STORAGE_KEYS.LAST_VIEWED_VERSION, version);
    localStorage.setItem(CHANGELOG_STORAGE_KEYS.LAST_VIEWED_DATE, new Date().toISOString());
  } catch {
    // Silently fail if localStorage is not available
  }
}
