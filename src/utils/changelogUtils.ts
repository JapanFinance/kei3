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

export interface ChangelogParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface ChangelogListItem {
  text: string;
  children?: ChangelogListItem[];
}

export interface ChangelogListBlock {
  type: 'list';
  items: ChangelogListItem[];
}

export type ChangelogTableAlignment = 'left' | 'center' | 'right';

export interface ChangelogTableBlock {
  type: 'table';
  headers: string[];
  alignments: ChangelogTableAlignment[];
  rows: string[][];
}

export type ChangelogBlock = ChangelogParagraphBlock | ChangelogListBlock | ChangelogTableBlock;

export interface ChangelogEntry {
  date: string; // ISO format (yyyy-mm-dd) for parsing, display format handled in UI
  title?: string; // Optional concise headline from `## YYYY-MM-DD: Title`
  sections: Partial<Record<ChangelogCategory, ChangelogBlock[]>>;
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

const DATE_HEADER_REGEX = /^## (\d{4}-\d{2}-\d{2})(?::\s+(.+))?$/;
const SECTION_HEADER_REGEX = /^### (New|Updated|Fixed|Deprecated|Removed|Security)$/i;
const LIST_ITEM_REGEX = /^([ \t]*)- (.+)$/;
const TABLE_SEPARATOR_CELL_REGEX = /^:?-+:?$/;

function splitTableRow(trimmedLine: string): string[] {
  const withoutLeadingPipe = trimmedLine.startsWith('|') ? trimmedLine.slice(1) : trimmedLine;
  const cells: string[] = [];
  let current = '';
  let endedWithUnescapedPipe = false;

  for (let i = 0; i < withoutLeadingPipe.length; i++) {
    const ch = withoutLeadingPipe[i]!;
    if (ch === '\\' && i + 1 < withoutLeadingPipe.length) {
      const next = withoutLeadingPipe[i + 1]!;
      if (next === '|' || next === '\\') {
        current += next;
        endedWithUnescapedPipe = false;
        i += 1;
        continue;
      }
    }

    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      endedWithUnescapedPipe = true;
      continue;
    }

    current += ch;
    endedWithUnescapedPipe = false;
  }

  if (!endedWithUnescapedPipe) {
    cells.push(current.trim());
  }

  return cells;
}

function parseTableAlignment(separatorCell: string): ChangelogTableAlignment {
  if (/^:-+:$/.test(separatorCell)) return 'center';
  if (/^-+:$/.test(separatorCell)) return 'right';
  return 'left';
}

function normalizeTableRow(cells: string[], columnCount: number): string[] {
  if (cells.length === columnCount) return cells;
  if (cells.length > columnCount) return cells.slice(0, columnCount);
  return [...cells, ...Array<string>(columnCount - cells.length).fill('')];
}

/**
 * Simple markdown changelog parser.
 * Parses a changelog with ISO date headers (`## yyyy-mm-dd` or `## yyyy-mm-dd: Title`),
 * plain paragraphs, nested `- ` bullet lists, and GFM pipe tables.
 */
export function parseChangelog(markdownContent: string): ParsedChangelog {
  const lines = markdownContent.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let currentEntry: ChangelogEntry | null = null;
  let currentSection: ChangelogCategory | null = null;
  let listStack: Array<{ indent: number; item: ChangelogListItem }> = [];
  let currentParagraph: ChangelogParagraphBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();

    if (!trimmed) {
      currentParagraph = null;
      continue;
    }

    // Check for date header (`## 2025-01-15` or `## 2025-01-15: Release title`)
    const dateMatch = trimmed.match(DATE_HEADER_REGEX);
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
        listStack = [];
        currentParagraph = null;
      }
      continue;
    }

    // Check for section headers (### New, ### Updated, etc.)
    const sectionMatch = trimmed.match(SECTION_HEADER_REGEX);
    if (sectionMatch && currentEntry && sectionMatch[1]) {
      currentSection = sectionMatch[1].toLowerCase() as ChangelogCategory;
      currentEntry.sections[currentSection] ??= [];
      listStack = [];
      currentParagraph = null;
      continue;
    }

    if (!currentEntry || !currentSection) {
      continue;
    }

    const blocks = currentEntry.sections[currentSection]!;

    // Check for list items (preserving indentation for nested bullets)
    const listMatch = rawLine.match(LIST_ITEM_REGEX);
    if (listMatch && listMatch[2]) {
      currentParagraph = null;
      const indent = listMatch[1]!.replace(/\t/g, '  ').length;
      const text = listMatch[2].trim();

      let listBlock: ChangelogListBlock;
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock?.type === 'list') {
        listBlock = lastBlock;
      } else {
        listBlock = { type: 'list', items: [] };
        blocks.push(listBlock);
        listStack = [];
      }

      while (listStack.length > 0 && listStack[listStack.length - 1]!.indent >= indent) {
        listStack.pop();
      }

      const newItem: ChangelogListItem = { text };
      const parent = listStack[listStack.length - 1]?.item;
      if (parent) {
        parent.children ??= [];
        parent.children.push(newItem);
      } else {
        listBlock.items.push(newItem);
      }

      listStack.push({ indent, item: newItem });
      continue;
    }

    // Check for GFM pipe table (header row + separator row)
    if (trimmed.includes('|') && i + 1 < lines.length) {
      const headers = splitTableRow(trimmed);
      const separatorCells = splitTableRow(lines[i + 1]!.trim());

      if (
        headers.length > 0 &&
        separatorCells.length === headers.length &&
        separatorCells.every(cell => TABLE_SEPARATOR_CELL_REGEX.test(cell))
      ) {
        const alignments = separatorCells.map(parseTableAlignment);
        const rows: string[][] = [];
        i += 1;

        while (i + 1 < lines.length) {
          const nextRaw = lines[i + 1]!;
          const nextTrimmed = nextRaw.trim();
          if (
            !nextTrimmed ||
            !nextTrimmed.includes('|') ||
            DATE_HEADER_REGEX.test(nextTrimmed) ||
            SECTION_HEADER_REGEX.test(nextTrimmed) ||
            LIST_ITEM_REGEX.test(nextRaw)
          ) {
            break;
          }

          rows.push(normalizeTableRow(splitTableRow(nextTrimmed), headers.length));
          i += 1;
        }

        blocks.push({
          type: 'table',
          headers,
          alignments,
          rows,
        });
        listStack = [];
        currentParagraph = null;
        continue;
      }
    }

    // Plain paragraph text (join consecutive wrapped lines with a space)
    listStack = [];
    if (currentParagraph) {
      currentParagraph.text = `${currentParagraph.text} ${trimmed}`;
    } else {
      currentParagraph = { type: 'paragraph', text: trimmed };
      blocks.push(currentParagraph);
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
    const blocks = entry.sections[category];
    if (!blocks) continue;

    for (const block of blocks) {
      const firstText =
        block.type === 'paragraph'
          ? block.text
          : block.type === 'list'
            ? block.items[0]?.text
            : undefined;
      if (!firstText) continue;

      const plain = stripInlineMarkdown(firstText).trim();
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

function extractListItemSearchTexts(items: readonly ChangelogListItem[]): string[] {
  const texts: string[] = [];
  for (const item of items) {
    texts.push(stripInlineMarkdown(item.text));
    if (item.children?.length) {
      texts.push(...extractListItemSearchTexts(item.children));
    }
  }
  return texts;
}

function extractBlockSearchTexts(blocks: readonly ChangelogBlock[]): string[] {
  return blocks.flatMap(block => {
    switch (block.type) {
      case 'paragraph':
        return [stripInlineMarkdown(block.text)];
      case 'list':
        return extractListItemSearchTexts(block.items);
      case 'table':
        return [...block.headers, ...block.rows.flat()].map(stripInlineMarkdown);
    }
  });
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
    ...applicableCategories.flatMap(cat => extractBlockSearchTexts(entry.sections[cat] ?? [])),
  ];

  return searchableParts.some(part => part.toLowerCase().includes(normalizedQuery));
}
