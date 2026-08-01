// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import { keyframes } from '@mui/material/styles';
import { useState, useEffect } from 'react';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/**
 * How long to wait before admitting the changelog is still loading. Measured
 * click-to-rendered times were 80 ms with no network latency and 575 ms with
 * 500 ms of it, so this stays clear of the fast case — where appearing and
 * being replaced within ~50 ms would only read as a flicker — while still
 * responding well before the slow case starts to feel unanswered.
 */
const SPINNER_DELAY_MS = 150;

/**
 * Stands in for {@link import('./ChangelogModal')} while its module is still
 * loading, so opening the changelog has a visible effect when the wait is long
 * enough to notice.
 *
 * Deliberately plain rather than a copy of the real dialog's heading and
 * layout: reproducing those here would duplicate them into the startup chunk,
 * and this is on screen only until the module arrives.
 */
export default function ChangelogLoadingDialog({ onClose }: { onClose: () => void }) {
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaitedLongEnough(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!waitedLongEnough) return null;

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
