import { useState, useEffect } from 'react';
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
import { parseChangelog, setLastViewedVersion, type ChangelogEntry, type ParsedChangelog } from '../utils/changelogUtils';
import changelogContent from '../../CHANGELOG.md?raw';

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

const SectionIcon = ({ type }: { type: string }) => {
  const getColor = (sectionType: string): 'success' | 'info' | 'warning' | 'secondary' | 'error' | 'default' => {
    switch (sectionType.toLowerCase()) {
      case 'added': return 'success';
      case 'changed': return 'info';
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
        fontSize: '0.75rem',
        height: '24px'
      }}
    />
  );
};

const ChangelogSection = ({ type, items }: { type: string; items: string[] }) => {
  if (!items || items.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <SectionIcon type={type} />
      </Box>
      <List dense sx={{ pl: 2 }}>
        {items.map((item, index) => (
          <ListItem key={index} sx={{ py: 0.25, px: 0 }}>
            <ListItemText 
              primary={`• ${item}`}
              primaryTypographyProps={{
                variant: 'body2',
                color: 'text.secondary'
              }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

const ChangelogEntryComponent = ({ entry }: { entry: ChangelogEntry }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h6" component="h3">
          {entry.isUnreleased ? 'Unreleased' : `Version ${entry.version}`}
        </Typography>
        {entry.date && !entry.isUnreleased && (
          <Typography variant="body2" color="text.secondary">
            {entry.date}
          </Typography>
        )}
        {entry.isUnreleased && (
          <Chip label="Coming Soon" size="small" color="primary" variant="outlined" />
        )}
      </Box>
      
      {entry.sections.added && (
        <ChangelogSection type="Added" items={entry.sections.added} />
      )}
      {entry.sections.changed && (
        <ChangelogSection type="Changed" items={entry.sections.changed} />
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
  const [changelog, setChangelog] = useState<ParsedChangelog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !changelog) {
      loadChangelog();
    }
  }, [open, changelog]);

  useEffect(() => {
    if (open && changelog?.latestVersion) {
      // Mark the latest version as viewed when the modal is opened
      setLastViewedVersion(changelog.latestVersion);
    }
  }, [open, changelog?.latestVersion]);

  const loadChangelog = () => {
    setLoading(true);
    setError(null);
    
    try {
      const parsed = parseChangelog(changelogContent);
      setChangelog(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse changelog');
    } finally {
      setLoading(false);
    }
  };

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
      PaperProps={{
        sx: {
          minHeight: '60vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 2
      }}>
        <Typography variant="h5" component="h2">
          What's New
        </Typography>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: 200 
          }}>
            <Typography color="text.secondary">Loading changelog...</Typography>
          </Box>
        )}
        
        {error && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error" gutterBottom>
              {error}
            </Typography>
            <Link
              component="button"
              variant="body2"
              onClick={loadChangelog}
              sx={{ mt: 1 }}
            >
              Try again
            </Link>
          </Box>
        )}
        
        {changelog && !loading && !error && (
          <Box>
            {changelog.entries.map((entry, index) => (
              <Box key={entry.version}>
                <ChangelogEntryComponent entry={entry} />
                {index < changelog.entries.length - 1 && (
                  <Divider sx={{ my: 3 }} />
                )}
              </Box>
            ))}
            
            {changelog.entries.length === 0 && (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No changelog entries found.
              </Typography>
            )}
            
            <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Have feedback or suggestions? We'd love to hear from you!
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
