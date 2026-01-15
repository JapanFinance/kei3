// Copyright the original author or authors
import { useState, useEffect, type ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import CloseIcon from '@mui/icons-material/Close';
import { parseChangelog, setLastViewedDate, formatChangelogDate, type ChangelogEntry, type ParsedChangelog } from '../utils/changelogUtils';
import changelogContent from '../../CHANGELOG.md?raw';

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

const SectionIcon = ({ type }: { type: string }) => {
  const getColor = (sectionType: string): 'success' | 'info' | 'warning' | 'secondary' | 'error' | 'default' => {
    switch (sectionType.toLowerCase()) {
      case 'new': return 'success';
      case 'updated': return 'info';
      case 'fixed': return 'warning';
      case 'deprecated': return 'secondary';
      case 'removed': return 'error';
      case 'security': return 'error';
      default: return 'default';
    }
  };

  return (
    <Chip 
      label={type} 
      size="small" 
      color={getColor(type)}
      variant="outlined"
      sx={{ 
        textTransform: 'capitalize',
        fontSize: { xs: '0.7rem', sm: '0.75rem' },
        height: { xs: '22px', sm: '24px' },
        '& .MuiChip-label': {
          px: { xs: 1, sm: 1.5 }
        }
      }}
    />
  );
};

const ChangelogSection = ({ type, items }: { type: string; items: string[] }) => {
  if (!items || items.length === 0) return null;

  // Simple markdown link parser for [text](url) format
  const parseMarkdownLinks = (text: string) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | ReactNode)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      // Add the link
      parts.push(
        <Link
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: 'primary.main', textDecoration: 'underline' }}
        >
          {match[1]}
        </Link>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : [text];
  };

  return (
    <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 0.5, sm: 1 } }}>
        <SectionIcon type={type} />
      </Box>
      <List dense sx={{ pl: { xs: 1.5, sm: 2 } }}>
        {items.map((item, index) => (
          <ListItem key={index} sx={{ py: { xs: 0.125, sm: 0.25 }, px: 0 }}>
            <ListItemText 
              primary={
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}
                >
                  • {parseMarkdownLinks(item)}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

const ChangelogEntryComponent = ({ entry }: { entry: ChangelogEntry }) => {
  return (
    <Box sx={{ mb: { xs: 1, sm: 1.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1, sm: 2 }, gap: 2 }}>
        <Typography 
          variant="h6" 
          component="h3"
          sx={{ 
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            fontWeight: { xs: 600, sm: 600 }
          }}
        >
          {formatChangelogDate(entry.date)}
        </Typography>
      </Box>
      
      {entry.sections.new && (
        <ChangelogSection type="New" items={entry.sections.new} />
      )}
      {entry.sections.updated && (
        <ChangelogSection type="Updated" items={entry.sections.updated} />
      )}
      {entry.sections.fixed && (
        <ChangelogSection type="Fixed" items={entry.sections.fixed} />
      )}
      {entry.sections.deprecated && (
        <ChangelogSection type="Deprecated" items={entry.sections.deprecated} />
      )}
      {entry.sections.removed && (
        <ChangelogSection type="Removed" items={entry.sections.removed} />
      )}
      {entry.sections.security && (
        <ChangelogSection type="Security" items={entry.sections.security} />
      )}
    </Box>
  );
};

export default function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  // Parse changelog once using lazy initialization - it's static content
  const [{ changelog, error }] = useState<{ changelog: ParsedChangelog | null; error: string | null }>(() => {
    try {
      return { changelog: parseChangelog(changelogContent), error: null };
    } catch (err) {
      return { 
        changelog: null, 
        error: err instanceof Error ? err.message : 'Failed to parse changelog' 
      };
    }
  });

  useEffect(() => {
    if (open && changelog?.latestDate) {
      // Mark the latest date as viewed when the modal is opened
      setLastViewedDate(changelog.latestDate);
    }
  }, [open, changelog?.latestDate]);

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            minHeight: { xs: '70vh', sm: '60vh' },
            maxHeight: { xs: '95vh', sm: '90vh' },
            m: { xs: 1, sm: 2 },
            maxWidth: { xs: 'calc(100vw - 16px)', sm: 'md' }
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: { xs: 1, sm: 2 },
        pt: { xs: 2, sm: 3 },
        px: { xs: 2, sm: 3 }
      }}>
        <Typography 
          variant="h5" 
          component="div"
          sx={{ fontSize: { xs: '1.3rem', sm: '1.5rem' } }}
        >
          What's New
        </Typography>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{ 
            color: 'text.secondary',
            p: { xs: 1, sm: 1 }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent 
        dividers
        sx={{ 
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 }
        }}
      >
        {error && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error">
              {error}
            </Typography>
          </Box>
        )}
        
        {changelog && !error && (
          <Box>
            {changelog.entries.map((entry, index) => (
              <Box key={entry.date}>
                <ChangelogEntryComponent entry={entry} />
                {index < changelog.entries.length - 1 && (
                  <Divider sx={{ mb: { xs: 2.5, sm: 3 } }} />
                )}
              </Box>
            ))}
            
            {changelog.entries.length === 0 && (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No changelog entries found.
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
