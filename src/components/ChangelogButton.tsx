// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AnnouncementIcon from '@mui/icons-material/Announcement';

interface ChangelogButtonProps {
  /** Absent while the app is still loading; the button renders disabled. */
  onClick?: () => void;
  /** Shows the unread-updates dot. */
  showBadge?: boolean;
}

/**
 * Presentational only — no changelog-data imports, so the loading fallback in
 * {@link import('../Root').Root} can render the identical (disabled) button
 * before the app and the changelog content have loaded. The unread-dot state
 * lives in {@link import('../hooks/useChangelogModal').useChangelogModal}.
 *
 * The hover hint is a native title attribute rather than a MUI Tooltip:
 * Tooltip pulls the popper positioning engine, which nothing else needs
 * before first paint.
 */
export default function ChangelogButton({ onClick, showBadge = false }: ChangelogButtonProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const icon = (
    <Badge color="error" variant="dot" invisible={!showBadge}>
      <AnnouncementIcon />
    </Badge>
  );

  if (isMobile) {
    // Mobile: Icon button only
    return (
      <IconButton
        onClick={onClick}
        disabled={!onClick}
        color="inherit"
        size="small"
        aria-label="View changelog"
        title="What's New"
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: 'text.primary',
          },
        }}
      >
        {icon}
      </IconButton>
    );
  }

  // Desktop: Text button
  return (
    <Button
      onClick={onClick}
      disabled={!onClick}
      color="inherit"
      size="small"
      startIcon={icon}
      sx={{
        color: 'text.secondary',
        '&:hover': {
          color: 'text.primary',
          backgroundColor: 'action.hover',
        },
      }}
    >
      What's New
    </Button>
  );
}
