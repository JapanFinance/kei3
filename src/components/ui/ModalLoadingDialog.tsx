// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import { keyframes, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useState } from 'react';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/**
 * How long to wait before admitting the modal is still loading. Measured
 * click-to-rendered times were 80 ms with no network latency and 575 ms with
 * 500 ms of it, so this stays clear of the fast case — where appearing and
 * being replaced within ~50 ms would only read as a flicker — while still
 * responding well before the slow case starts to feel unanswered.
 */
const SPINNER_DELAY_MS = 150;

interface ModalLoadingDialogProps {
  onClose: () => void;
  ariaLabel: string;
  /** Matches the target dialog's desktop max width (`'sm'`, `'md'`, or px number). */
  maxWidth?: 'sm' | 'md' | number;
}

/**
 * Stands in for a lazily loaded modal while its module is still downloading,
 * so opening it has a visible effect when the wait is long enough to notice.
 *
 * Deliberately plain rather than a copy of the real dialog's heading and
 * layout: reproducing those here would duplicate them into the startup chunk,
 * and this is on screen only until the module arrives.
 */
export default function ModalLoadingDialog({
  onClose,
  ariaLabel,
  maxWidth = 'md',
}: ModalLoadingDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaitedLongEnough(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!waitedLongEnough) return null;

  const isPixelMaxWidth = typeof maxWidth === 'number';

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth={isPixelMaxWidth ? false : maxWidth}
      fullWidth
      fullScreen={isMobile}
      aria-label={ariaLabel}
      slotProps={
        isPixelMaxWidth
          ? {
              paper: {
                sx: {
                  maxWidth: isMobile ? '100%' : maxWidth,
                },
              },
            }
          : undefined
      }
    >
      <Box
        sx={{
          minHeight: isMobile ? '100dvh' : '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          role="status"
          aria-label="Loading"
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '4px solid',
            borderColor: 'primary.main',
            borderTopColor: 'transparent',
            animation: `${spin} 1s linear infinite`,
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              borderTopColor: 'primary.main',
              opacity: 0.4,
            },
          }}
        />
      </Box>
    </Dialog>
  );
}
