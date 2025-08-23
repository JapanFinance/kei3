import { useState, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import { 
  getLastViewedDate, 
  hasNewUpdates, 
  parseChangelog, 
  type ParsedChangelog 
} from '../utils/changelogUtils';
// Import changelog content directly
import changelogContent from '../../CHANGELOG.md?raw';

interface ChangelogButtonProps {
  onClick: () => void;
}

export default function ChangelogButton({ onClick }: ChangelogButtonProps) {
  const [hasNewFeatures, setHasNewFeatures] = useState(false);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = () => {
    try {
      const changelog: ParsedChangelog = parseChangelog(changelogContent);
      const lastViewed = getLastViewedDate();
      const hasNew = hasNewUpdates(changelog, lastViewed || undefined);
      setHasNewFeatures(hasNew);
    } catch (error) {
      console.warn('Failed to check for changelog updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    setHasNewFeatures(false); // Remove badge when clicked
    onClick();
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (isMobile) {
    // Mobile: Icon button only
    return (
      <Tooltip title="What's New" arrow>
        <IconButton
          onClick={handleClick}
          color="inherit"
          size="small"
          aria-label="View changelog"
          sx={{ 
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary'
            }
          }}
        >
          <Badge color="error" variant="dot" invisible={!hasNewFeatures}>
            <AnnouncementIcon />
          </Badge>
        </IconButton>
      </Tooltip>
    );
  }

  // Desktop: Text button
  return (
    <Button
      onClick={handleClick}
      color="inherit"
      size="small"
      startIcon={
        <Badge color="error" variant="dot" invisible={!hasNewFeatures}>
          <AnnouncementIcon />
        </Badge>
      }
      sx={{
        color: 'text.secondary',
        textTransform: 'none',
        '&:hover': {
          color: 'text.primary',
          backgroundColor: 'action.hover'
        }
      }}
    >
      What's New
    </Button>
  );
}
