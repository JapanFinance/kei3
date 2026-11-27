// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import AnnouncementIcon from '@mui/icons-material/Announcement';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

import changelogContent from '../../CHANGELOG.md?raw';
import { changelogEntryHash } from '../hooks/useChangelogModal';
import {
  CHANGELOG_CATEGORIES,
  formatChangelogDate,
  formatChangelogDateShort,
  getChangelogEntryCategories,
  getChangelogEntryTitle,
  matchesChangelogFilter,
  parseChangelog,
  parseInlineMarkdown,
  splitChangelogEntries,
  type ChangelogCategory,
  type ChangelogEntry,
  type ChangelogListItem,
  type ChangelogTableBlock,
  type ParsedChangelog,
} from '../utils/changelogUtils';

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
  /** Called while open, to record the newest entry as read. */
  onViewed: () => void;
  /** Last viewed ISO date captured before opening, used to highlight unread updates. */
  previousLastViewedDate?: string | null | undefined;
  /** Optional ISO date from `#changelog-YYYY-MM-DD` to auto-expand and scroll to. */
  targetDate?: string | null | undefined;
}

type CategoryPaletteKey = 'success' | 'info' | 'warning' | 'secondary' | 'error';

const CATEGORY_META: Record<
  ChangelogCategory,
  { label: string; paletteKey: CategoryPaletteKey | null }
> = {
  new: { label: 'New', paletteKey: 'success' },
  updated: { label: 'Updated', paletteKey: 'info' },
  fixed: { label: 'Fixed', paletteKey: 'warning' },
  deprecated: { label: 'Deprecated', paletteKey: 'secondary' },
  removed: { label: 'Removed', paletteKey: null },
  security: { label: 'Security', paletteKey: 'error' },
};

function CategoryBadge({ category }: { category: ChangelogCategory }) {
  const { label, paletteKey } = CATEGORY_META[category];

  return (
    <Chip
      component="span"
      label={label}
      size="small"
      sx={(theme: Theme) => {
        const tone = paletteKey
          ? {
              bgcolor: alpha(theme.palette[paletteKey].main, 0.12),
              color: `${paletteKey}.dark`,
              ...theme.applyStyles('dark', {
                bgcolor: alpha(theme.palette[paletteKey].main, 0.22),
                color: `${paletteKey}.light`,
              }),
            }
          : {
              bgcolor: 'action.selected',
              color: 'text.primary',
            };

        return {
          ...tone,
          fontWeight: 600,
          fontSize: '0.72rem',
          height: 22,
          borderRadius: 1,
          '& .MuiChip-label': {
            px: 1,
          },
        };
      }}
    />
  );
}

function renderInlineTokens(text: string): ReactNode[] {
  return parseInlineMarkdown(text).map((token, index) => {
    switch (token.type) {
      case 'text':
        return token.value;
      case 'bold':
        return <strong key={index}>{token.value}</strong>;
      case 'code':
        return (
          <Box
            key={index}
            component="code"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.85em',
              px: 0.5,
              py: 0.1,
              borderRadius: 0.5,
              bgcolor: 'action.hover',
            }}
          >
            {token.value}
          </Box>
        );
      case 'link': {
        const needsPdfLabel = token.isPdf && !/\bpdf\b/i.test(token.label);
        return (
          <Link
            key={index}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main', textDecoration: 'underline' }}
          >
            {token.label}
            {needsPdfLabel ? ' (PDF)' : ''}
            <OpenInNewIcon
              aria-hidden="true"
              sx={{ fontSize: '0.85em', ml: 0.35, verticalAlign: '-0.12em' }}
            />
          </Link>
        );
      }
    }
  });
}

function ChangelogList({ items, depth = 0 }: { items: ChangelogListItem[]; depth?: number }) {
  const listStyleType = depth === 0 ? 'disc' : depth === 1 ? 'circle' : 'square';

  return (
    <Box
      component="ul"
      sx={{
        m: 0,
        mt: depth > 0 ? 0.5 : 0,
        pl: 2.25,
        listStyleType,
        display: 'flex',
        flexDirection: 'column',
        gap: depth > 0 ? 0.5 : 0.75,
        color: 'text.primary',
        maxWidth: '68ch',
      }}
    >
      {items.map((item, idx) => (
        <Box
          key={idx}
          component="li"
          sx={{
            color: 'text.primary',
            typography: 'body2',
            lineHeight: 1.65,
          }}
        >
          {renderInlineTokens(item.text)}
          {item.children && item.children.length > 0 && (
            <ChangelogList items={item.children} depth={depth + 1} />
          )}
        </Box>
      ))}
    </Box>
  );
}

function ChangelogTable({ block }: { block: ChangelogTableBlock }) {
  return (
    <TableContainer
      sx={{
        overflowX: 'auto',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Table
        size="small"
        sx={{
          '& th, & td': {
            py: 0.75,
            px: 1.25,
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            borderColor: 'divider',
          },
          '& th': {
            fontWeight: 600,
            bgcolor: 'action.hover',
            whiteSpace: 'nowrap',
          },
          '& td': {
            fontVariantNumeric: 'tabular-nums',
          },
          '& tbody tr:last-child td': {
            borderBottom: 0,
          },
        }}
      >
        <TableHead>
          <TableRow>
            {block.headers.map((header, colIdx) => (
              <TableCell key={colIdx} align={block.alignments[colIdx] ?? 'left'}>
                {renderInlineTokens(header)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {block.rows.map((row, rowIdx) => (
            <TableRow key={rowIdx}>
              {row.map((cell, colIdx) => (
                <TableCell key={colIdx} align={block.alignments[colIdx] ?? 'left'}>
                  {renderInlineTokens(cell)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function EntryBody({
  entry,
  filterCategory = 'all',
  hideSingleCategoryBadge = false,
}: {
  entry: ChangelogEntry;
  filterCategory?: ChangelogCategory | 'all';
  hideSingleCategoryBadge?: boolean;
}) {
  const categories =
    filterCategory !== 'all'
      ? entry.sections[filterCategory]?.length
        ? [filterCategory]
        : []
      : getChangelogEntryCategories(entry);

  if (categories.length === 0) return null;

  const showCategoryBlockChrome = categories.length > 1 || !hideSingleCategoryBadge;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {categories.map(category => {
        const blocks = entry.sections[category];
        if (!blocks || blocks.length === 0) return null;

        const { paletteKey } = CATEGORY_META[category];
        const firstBlock = blocks[0];
        const isSingleFlatBullet =
          blocks.length === 1 &&
          firstBlock?.type === 'list' &&
          firstBlock.items.length === 1 &&
          !firstBlock.items[0]?.children?.length;

        return (
          <Box
            key={category}
            sx={(theme: Theme) =>
              showCategoryBlockChrome
                ? {
                    borderLeft: '3px solid',
                    borderColor: paletteKey ? theme.palette[paletteKey].main : 'divider',
                    pl: 1.5,
                  }
                : {}
            }
          >
            {showCategoryBlockChrome && (
              <Box sx={{ mb: 0.75 }}>
                <CategoryBadge category={category} />
              </Box>
            )}

            {isSingleFlatBullet && firstBlock.items[0] ? (
              <Typography
                variant="body2"
                sx={{ color: 'text.primary', lineHeight: 1.65, maxWidth: '68ch' }}
              >
                {renderInlineTokens(firstBlock.items[0].text)}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {blocks.map((block, idx) =>
                  block.type === 'list' ? (
                    <ChangelogList key={idx} items={block.items} />
                  ) : (
                    <ChangelogTable key={idx} block={block} />
                  ),
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function CopyLinkButton({ date }: { date: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const handleCopy = () => {
    const url = `${window.location.origin}${window.location.pathname}${changelogEntryHash(date)}`;
    if (!navigator.clipboard?.writeText) return;

    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, 2000);
      })
      .catch(() => {});
  };

  return (
    <IconButton
      size="small"
      onClick={handleCopy}
      aria-label={`Copy link to ${formatChangelogDate(date)} update`}
      title={copied ? 'Copied link' : 'Copy link to this release'}
      sx={{ color: copied ? 'success.main' : 'text.secondary' }}
    >
      {copied ? <CheckIcon fontSize="small" /> : <LinkIcon fontSize="small" />}
    </IconButton>
  );
}

function ReleaseCard({
  entry,
  highlighted = false,
  targeted = false,
  filterCategory = 'all',
}: {
  entry: ChangelogEntry;
  highlighted?: boolean;
  targeted?: boolean;
  filterCategory?: ChangelogCategory | 'all';
}) {
  const categories =
    filterCategory !== 'all' ? [filterCategory] : getChangelogEntryCategories(entry);

  return (
    <Box
      component="article"
      id={`changelog-entry-${entry.date}`}
      sx={(theme: Theme) => ({
        border: '1px solid',
        borderColor: targeted
          ? 'primary.main'
          : highlighted
            ? alpha(theme.palette.primary.main, 0.45)
            : 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
        boxShadow: targeted || highlighted ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
        bgcolor: 'background.paper',
      })}
    >
      <Box
        sx={(theme: Theme) => ({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor:
            targeted || highlighted ? alpha(theme.palette.primary.main, 0.05) : 'action.hover',
          ...theme.applyStyles('dark', {
            bgcolor:
              targeted || highlighted ? alpha(theme.palette.primary.main, 0.14) : 'action.hover',
          }),
        })}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
            {formatChangelogDate(entry.date)}
          </Typography>
          {categories.map(category => (
            <CategoryBadge key={category} category={category} />
          ))}
        </Box>
        <CopyLinkButton date={entry.date} />
      </Box>

      <Box sx={{ px: 2, py: 1.75 }}>
        <Typography
          variant="subtitle1"
          component="h4"
          sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.35, mb: 1 }}
        >
          {getChangelogEntryTitle(entry)}
        </Typography>
        <EntryBody entry={entry} filterCategory={filterCategory} hideSingleCategoryBadge />
      </Box>
    </Box>
  );
}

function EarlierAccordionItem({
  entry,
  expanded,
  targeted,
  isMobile,
  onToggle,
  onSyncExpanded,
}: {
  entry: ChangelogEntry;
  expanded: boolean;
  targeted: boolean;
  isMobile: boolean;
  onToggle: (date: string) => void;
  onSyncExpanded: (date: string, isOpen: boolean) => void;
}) {
  const categories = getChangelogEntryCategories(entry);
  const title = getChangelogEntryTitle(entry);

  return (
    <Box
      component="details"
      id={`changelog-entry-${entry.date}`}
      open={expanded}
      onToggle={event => onSyncExpanded(entry.date, event.currentTarget.open)}
      sx={(theme: Theme) => ({
        border: '1px solid',
        borderColor: targeted ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        boxShadow: targeted ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
        '& summary': {
          listStyle: 'none',
          cursor: 'pointer',
          userSelect: 'none',
          '&::-webkit-details-marker': {
            display: 'none',
          },
          '&:hover': {
            bgcolor: 'action.hover',
          },
        },
      })}
    >
      <Box
        component="summary"
        onClick={event => {
          event.preventDefault();
          onToggle(entry.date);
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          px: 2,
          py: isMobile ? 1.5 : 1.25,
          minHeight: isMobile ? 56 : 48,
        }}
      >
        {isMobile ? (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}
            >
              <Typography
                component="span"
                variant="caption"
                sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatChangelogDateShort(entry.date)}
              </Typography>
              {categories.map(category => (
                <CategoryBadge key={category} category={category} />
              ))}
            </Box>
            <Typography
              component="span"
              variant="body2"
              sx={{ display: 'block', fontWeight: 600, color: 'text.primary', lineHeight: 1.4 }}
            >
              {title}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              minWidth: 0,
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
            }}
          >
            <Typography
              component="span"
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
                minWidth: 96,
                flexShrink: 0,
              }}
            >
              {formatChangelogDateShort(entry.date)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              {categories.map(category => (
                <CategoryBadge key={category} category={category} />
              ))}
            </Box>
            <Typography
              component="span"
              variant="body2"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                minWidth: 0,
                lineHeight: 1.4,
              }}
            >
              {title}
            </Typography>
          </Box>
        )}

        <ExpandMoreIcon
          aria-hidden="true"
          sx={{
            color: 'text.secondary',
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.75,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            {formatChangelogDate(entry.date)}
          </Typography>
          <CopyLinkButton date={entry.date} />
        </Box>
        <EntryBody entry={entry} hideSingleCategoryBadge />
      </Box>
    </Box>
  );
}

export default function ChangelogModal({
  open,
  onClose,
  onViewed,
  previousLastViewedDate = null,
  targetDate = null,
}: ChangelogModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const earlierHeadingId = useId();

  // Parse changelog once using lazy initialization - it's static content.
  const [{ changelog, error }] = useState<{
    changelog: ParsedChangelog | null;
    error: string | null;
  }>(() => {
    try {
      return { changelog: parseChangelog(changelogContent), error: null };
    } catch (err) {
      return {
        changelog: null,
        error: err instanceof Error ? err.message : 'Failed to parse changelog',
      };
    }
  });

  const scopeKey = open ? (targetDate ?? '__open__') : '__closed__';
  const [filterState, setFilterState] = useState<{
    scopeKey: string;
    query: string;
    category: ChangelogCategory | 'all';
  }>(() => ({ scopeKey, query: '', category: 'all' }));

  const searchQuery = filterState.scopeKey === scopeKey ? filterState.query : '';
  const selectedCategory = filterState.scopeKey === scopeKey ? filterState.category : 'all';

  const [expandedState, setExpandedState] = useState<{
    scopeKey: string;
    dates: Set<string>;
  }>(() => ({
    scopeKey,
    dates: targetDate ? new Set([targetDate]) : new Set(),
  }));

  const expandedDates = useMemo(() => {
    if (expandedState.scopeKey === scopeKey) {
      return expandedState.dates;
    }
    return targetDate ? new Set([targetDate]) : new Set<string>();
  }, [expandedState, scopeKey, targetDate]);

  // Reporting from here rather than from the click keeps "read" tied to the
  // entries having been rendered, and still covers #changelog deep links.
  useEffect(() => {
    if (open) {
      onViewed();
    }
  }, [open, onViewed]);

  useEffect(() => {
    if (!open || !targetDate) return;

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(`changelog-entry-${targetDate}`);
      if (!element) return;
      const prefersReducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      element.scrollIntoView?.({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, targetDate]);

  const entries = useMemo(() => changelog?.entries ?? [], [changelog]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ChangelogCategory, number>> = {};
    for (const entry of entries) {
      for (const category of getChangelogEntryCategories(entry)) {
        counts[category] = (counts[category] ?? 0) + 1;
      }
    }
    return counts;
  }, [entries]);

  const availableCategories = useMemo(
    () => CHANGELOG_CATEGORIES.filter(category => (categoryCounts[category] ?? 0) > 0),
    [categoryCounts],
  );

  const { recent, earlier, hasUnread } = useMemo(
    () => splitChangelogEntries(entries, previousLastViewedDate),
    [entries, previousLastViewedDate],
  );

  const isFiltered = selectedCategory !== 'all' || searchQuery.trim() !== '';

  const filteredEntries = useMemo(() => {
    if (!isFiltered) return [];
    return entries.filter(entry => matchesChangelogFilter(entry, selectedCategory, searchQuery));
  }, [entries, isFiltered, selectedCategory, searchQuery]);

  const allEarlierExpanded =
    earlier.length > 0 && earlier.every(entry => expandedDates.has(entry.date));

  const toggleExpanded = (date: string) => {
    setExpandedState(prev => {
      const base =
        prev.scopeKey === scopeKey
          ? prev.dates
          : targetDate
            ? new Set([targetDate])
            : new Set<string>();
      const next = new Set(base);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return { scopeKey, dates: next };
    });
  };

  const syncExpanded = (date: string, isExpanded: boolean) => {
    setExpandedState(prev => {
      const base =
        prev.scopeKey === scopeKey
          ? prev.dates
          : targetDate
            ? new Set([targetDate])
            : new Set<string>();
      if (base.has(date) === isExpanded) return prev;
      const next = new Set(base);
      if (isExpanded) {
        next.add(date);
      } else {
        next.delete(date);
      }
      return { scopeKey, dates: next };
    });
  };

  const handleToggleAllEarlier = () => {
    setExpandedState({
      scopeKey,
      dates: allEarlierExpanded ? new Set() : new Set(earlier.map(entry => entry.date)),
    });
  };

  const setSearchQuery = (query: string) => {
    setFilterState(prev => ({
      scopeKey,
      query,
      category: prev.scopeKey === scopeKey ? prev.category : 'all',
    }));
  };

  const setSelectedCategory = (category: ChangelogCategory | 'all') => {
    setFilterState(prev => ({
      scopeKey,
      query: prev.scopeKey === scopeKey ? prev.query : '',
      category,
    }));
  };

  const handleClearFilters = () => {
    setFilterState({ scopeKey, query: '', category: 'all' });
  };

  const footerSummary = changelog?.latestDate
    ? `${entries.length} update${entries.length === 1 ? '' : 's'} · Last updated ${formatChangelogDateShort(changelog.latestDate)}`
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            maxWidth: isMobile ? '100%' : 720,
            minHeight: isMobile ? '100dvh' : '60vh',
            maxHeight: isMobile ? '100dvh' : '90vh',
            ...(isMobile && {
              '@supports not (height: 100dvh)': {
                minHeight: '100vh',
                maxHeight: '100vh',
              },
            }),
          },
        },
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          pt: isMobile ? 'max(14px, env(safe-area-inset-top))' : 2,
          pb: 1.5,
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
          pr: isMobile ? 'max(16px, env(safe-area-inset-right))' : 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={(theme: Theme) => ({
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
              ...theme.applyStyles('dark', {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
                color: 'primary.light',
              }),
            })}
          >
            <AnnouncementIcon fontSize="small" />
          </Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
            What's New
          </Typography>
        </Box>

        <IconButton
          edge="end"
          size="small"
          aria-label="Close"
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {changelog && !error && entries.length > 0 && (
        <Box
          sx={{
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
            px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
            pr: isMobile ? 'max(16px, env(safe-area-inset-right))' : 3,
            py: 1.25,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.25,
          }}
        >
          <TextField
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search updates..."
            type="search"
            size="small"
            sx={{
              flex: { sm: '1 1 220px' },
              maxWidth: { sm: 280 },
              bgcolor: 'background.paper',
              borderRadius: 1,
            }}
            slotProps={{
              htmlInput: { 'aria-label': 'Search updates' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                ...(searchQuery && {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label="Clear search"
                        onClick={() => setSearchQuery('')}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }),
              },
            }}
          />

          <Box
            role="group"
            aria-label="Filter by category"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              overflowX: 'auto',
              pb: { xs: 0.25, sm: 0 },
              flexShrink: 0,
            }}
          >
            <Chip
              label={`All (${entries.length})`}
              size="small"
              clickable
              color={selectedCategory === 'all' ? 'primary' : 'default'}
              variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
              aria-pressed={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              sx={selectedCategory === 'all' ? undefined : { bgcolor: 'background.paper' }}
            />
            {availableCategories.map(category => {
              const selected = selectedCategory === category;
              const { label } = CATEGORY_META[category];
              return (
                <Chip
                  key={category}
                  label={`${label} (${categoryCounts[category] ?? 0})`}
                  size="small"
                  clickable
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  aria-pressed={selected}
                  onClick={() => setSelectedCategory(category)}
                  sx={selected ? undefined : { bgcolor: 'background.paper' }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      <DialogContent
        sx={{
          overscrollBehavior: 'contain',
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
          pr: isMobile ? 'max(16px, env(safe-area-inset-right))' : 3,
          py: { xs: 2, sm: 2.5 },
        }}
      >
        {error && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {changelog && !error && entries.length === 0 && (
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
            No changelog entries found.
          </Typography>
        )}

        {changelog && !error && entries.length > 0 && isFiltered && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography
                component="h3"
                variant="overline"
                sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.06em' }}
              >
                Matching updates ({filteredEntries.length})
              </Typography>
              {filteredEntries.length > 0 && (
                <Button size="small" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              )}
            </Box>

            {filteredEntries.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 5,
                  px: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                  No updates match the current filter.
                </Typography>
                <Button size="small" variant="outlined" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              </Box>
            ) : (
              filteredEntries.map(entry => (
                <ReleaseCard
                  key={entry.date}
                  entry={entry}
                  targeted={targetDate === entry.date}
                  filterCategory={selectedCategory}
                />
              ))
            )}
          </Box>
        )}

        {changelog && !error && entries.length > 0 && !isFiltered && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box component="section">
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  mb: 1.25,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {hasUnread && (
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <Typography
                    component="h3"
                    variant="overline"
                    sx={{
                      color: hasUnread ? 'primary.main' : 'text.secondary',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      lineHeight: 1.4,
                    }}
                  >
                    {hasUnread ? `New since last visit (${recent.length})` : 'Latest updates'}
                  </Typography>
                </Box>
                {hasUnread && previousLastViewedDate && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Since {formatChangelogDateShort(previousLastViewedDate)}
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {recent.map(entry => (
                  <ReleaseCard
                    key={entry.date}
                    entry={entry}
                    highlighted={hasUnread}
                    targeted={targetDate === entry.date}
                  />
                ))}
              </Box>
            </Box>

            {earlier.length > 0 && (
              <Box component="section" aria-labelledby={earlierHeadingId}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Typography
                    id={earlierHeadingId}
                    component="h3"
                    variant="overline"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      lineHeight: 1.4,
                    }}
                  >
                    Earlier updates ({earlier.length})
                  </Typography>
                  <Button
                    size="small"
                    aria-expanded={allEarlierExpanded}
                    onClick={handleToggleAllEarlier}
                    sx={{ color: 'text.secondary', minWidth: 'auto', px: 1 }}
                  >
                    {allEarlierExpanded ? 'Collapse all' : 'Expand all'}
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {earlier.map(entry => (
                    <EarlierAccordionItem
                      key={entry.date}
                      entry={entry}
                      expanded={expandedDates.has(entry.date)}
                      targeted={targetDate === entry.date}
                      isMobile={isMobile}
                      onToggle={toggleExpanded}
                      onSyncExpanded={syncExpanded}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
          pr: isMobile ? 'max(16px, env(safe-area-inset-right))' : 3,
          py: 1.5,
          pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : 1.5,
          gap: 2,
        }}
      >
        {footerSummary && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 'auto' }}>
            {footerSummary}
          </Typography>
        )}
        <Button onClick={onClose} variant="contained" sx={{ flexShrink: 0 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
