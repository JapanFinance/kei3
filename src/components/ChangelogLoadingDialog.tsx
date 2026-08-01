// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import { keyframes } from '@mui/material/styles';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/**
 * Stands in for {@link import('./ChangelogModal')} while its module is still
 * loading, so opening the changelog has an immediate visible effect.
 *
 * Deliberately plain rather than a copy of the real dialog's heading and
 * layout: reproducing those here would duplicate them into the startup chunk,
 * and this is on screen only until the module arrives.
 */
export default function ChangelogLoadingDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-label="Loading changelog">
      <Box
        sx={{
          minHeight: { xs: '70vh', sm: '60vh' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '4px solid',
            borderColor: 'primary.main',
            borderTopColor: 'transparent',
            animation: `${spin} 1s linear infinite`,
          }}
        />
      </Box>
    </Dialog>
  );
}
