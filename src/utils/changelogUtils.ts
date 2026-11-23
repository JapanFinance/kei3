// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The build imports this module from Node to bake in the latest entry date, so
// it must stay free of browser APIs; localStorage access lives in
// {@link import('./changelogStorage')}.

export const CHANGELOG_CATEGORIES = [
  'new',
  'updated',
  'fixed',
  'deprecated',
  'removed',
  'security',
] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

export interface ChangelogEntry {
  date: string; // ISO format (yyyy-mm-dd) for parsing, display format handled in UI
  title?: string; // Optional concise headline from `## YYYY-MM-DD — Title`
  sections: Partial<Record<ChangelogCategory, string[]>>;
}

export interface ParsedChangelog {
  entries: ChangelogEntry[];
  latestDate?: string;
}

export type InlineMarkdownToken =
  | { type: 'text'; value: string }
  | { type: 'link'; label: string; href: string; isPdf: boolean }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string };

const SAFE_LINK_HREF = /^(?:https?:\/\/|\/)/i;
const PDF_HREF = /\.pdf($|[?#])/i;

/**
 * Simple markdown changelog parser.
 * Parses a changelog with ISO date headers (`## yyyy-mm-dd` or `## yyyy-mm-dd — Title`).
 */
export function parseChangelog(markdownContent: string): ParsedChangelog {
  const lines = markdownContent.split('\n').map(line => line.trim());
  const entries: ChangelogEntry[] = [];
  let currentEntry: ChangelogEntry | null = null;
  let currentSection: ChangelogCategory | null = null;

  for (const line of lines) {
    // Check for date header (`## 2025-01-15` or `## 2025-01-15 — Release title`)
    const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})(?:\s+[—–-]\s+(.+))?$/);
    if (dateMatch) {
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const date = dateMatch[1];
      const title = dateMatch[2]?.trim();

      if (date) {
        currentEntry = {
          date,
          ...(title ? { title } : {}),
          sections: {},
        };
        currentSection = null;
      }
      continue;
    }

    // Check for section headers (### New, ### Updated, etc.)
    const sectionMatch = line.match(/^### (New|Updated|Fixed|Deprecated|Removed|Security)$/i);
    if (sectionMatch && currentEntry && sectionMatch[1]) {
      currentSection = sectionMatch[1].toLowerCase() as ChangelogCategory;
      currentEntry.sections[currentSection] ??= [];
      continue;
    }

    // Check for list items
    const listMatch = line.match(/^- (.+)/);
    if (listMatch && currentEntry && currentSection && listMatch[1]) {
      const items = currentEntry.sections[currentSection] ?? [];
      items.push(listMatch[1]);
      currentEntry.sections[currentSection] = items;
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  // Entries are in reverse chronological order, so first is latest.
  const latestDate = entries[0]?.date;

  return {
    entries,
    ...(latestDate ? { latestDate } : {}),
  };
}

function formatIsoDate(isoDate: string, monthStyle: 'long' | 'short'): string {
  try {
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return isoDate;
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: monthStyle,
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Format ISO date (yyyy-mm-dd) to long human-readable format (e.g. "November 23, 2026").
 */
export function formatChangelogDate(isoDate: string): string {
  return formatIsoDate(isoDate, 'long');
}

/**
 * Format ISO date (yyyy-mm-dd) to compact format (e.g. "Nov 23, 2026").
 */
export function formatChangelogDateShort(isoDate: string): string {
  return formatIsoDate(isoDate, 'short');
}

/**
 * Return present categories for a changelog entry in canonical display order.
 */
export function getChangelogEntryCategories(entry: ChangelogEntry): ChangelogCategory[] {
  return CHANGELOG_CATEGORIES.filter(category => (entry.sections[category]?.length ?? 0) > 0);
}

/**
 * Tokenize inline markdown (`[label](href)`, `**bold**`, `` `code` ``) into a pure AST.
 * Only `http://`, `https://`, and root-relative `/` URLs become link tokens; anything else
 * stays plain text.
 */
export function parseInlineMarkdown(text: string): InlineMarkdownToken[] {
  const tokenRegex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  const tokens: InlineMarkdownToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(tokenRegex)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    const [, linkLabel, linkHref, boldText, codeText] = match;
    if (linkLabel !== undefined && linkHref !== undefined) {
      const trimmedHref = linkHref.trim();
      if (SAFE_LINK_HREF.test(trimmedHref)) {
        tokens.push({
          type: 'link',
          label: linkLabel,
          href: trimmedHref,
          isPdf: PDF_HREF.test(trimmedHref),
        });
      } else {
        tokens.push({ type: 'text', value: match[0] });
      }
    } else if (boldText !== undefined) {
      tokens.push({ type: 'bold', value: boldText });
    } else if (codeText !== undefined) {
      tokens.push({ type: 'code', value: codeText });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Strip inline markdown syntax to plain readable text for search indexing and fallback titles.
 */
export function stripInlineMarkdown(text: string): string {
  return parseInlineMarkdown(text)
    .map(token => (token.type === 'link' ? token.label : token.value))
    .join('');
}

const MAX_FALLBACK_TITLE_LENGTH = 90;

/**
 * Return the release headline (`entry.title`), or derive a concise fallback from the first item.
 */
export function getChangelogEntryTitle(entry: ChangelogEntry): string {
  const explicitTitle = entry.title?.trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  for (const category of CHANGELOG_CATEGORIES) {
    const firstItem = entry.sections[category]?.[0];
    if (!firstItem) continue;

    const plain = stripInlineMarkdown(firstItem).trim();
    if (!plain) continue;

    const sentenceMatch = plain.match(/^(.+?[.!?])(?:\s|$)/);
    const candidate = sentenceMatch?.[1] ? sentenceMatch[1].replace(/\.$/, '') : plain;
    if (candidate.length <= MAX_FALLBACK_TITLE_LENGTH) {
      return candidate;
    }

    const sliced = candidate.slice(0, MAX_FALLBACK_TITLE_LENGTH - 1);
    const lastSpace = sliced.lastIndexOf(' ');
    const truncated = lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced;
    return `${truncated.trimEnd()}…`;
  }

  return formatChangelogDate(entry.date);
}

/**
 * Split entries into a prominent top digest (`recent`) and a collapsible archive (`earlier`).
 * Returning visitors with unread releases see only those unread releases in `recent`; first-time
 * or already-caught-up visitors see the latest `fallbackRecentCount` releases.
 */
export function splitChangelogEntries(
  entries: readonly ChangelogEntry[],
  previousLastViewedDate: string | null,
  fallbackRecentCount = 2,
): { recent: ChangelogEntry[]; earlier: ChangelogEntry[]; hasUnread: boolean } {
  if (previousLastViewedDate !== null && previousLastViewedDate !== '') {
    const unread = entries.filter(entry => entry.date > previousLastViewedDate);
    if (unread.length > 0) {
      return {
        recent: unread,
        earlier: entries.filter(entry => entry.date <= previousLastViewedDate),
        hasUnread: true,
      };
    }
  }

  return {
    recent: entries.slice(0, fallbackRecentCount),
    earlier: entries.slice(fallbackRecentCount),
    hasUnread: false,
  };
}

/**
 * Determine whether an entry matches a category filter and free-text query.
 */
export function matchesChangelogFilter(
  entry: ChangelogEntry,
  category: ChangelogCategory | 'all',
  query: string,
): boolean {
  if (category !== 'all' && (entry.sections[category]?.length ?? 0) === 0) {
    return false;
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const applicableCategories = category === 'all' ? CHANGELOG_CATEGORIES : [category];
  const searchableParts = [
    entry.date,
    formatChangelogDate(entry.date),
    formatChangelogDateShort(entry.date),
    getChangelogEntryTitle(entry),
    ...applicableCategories.flatMap(cat => (entry.sections[cat] ?? []).map(stripInlineMarkdown)),
  ];

  return searchableParts.some(part => part.toLowerCase().includes(normalizedQuery));
}
