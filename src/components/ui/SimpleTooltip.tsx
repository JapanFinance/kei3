// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { SIMPLE_TOOLTIP_ICON } from './constants';

interface SimpleTooltipProps {
  children: string;           // Required: brief explanation
  icon?: React.ReactNode;     // Optional: custom icon (default: HelpOutlineIcon)
  iconSx?: object;            // Optional: icon/button styling
  iconAriaLabel?: string;     // Optional: aria-label for icon button
}

/**
 * SimpleTooltip displays brief, single-line explanations with minimal UI overhead.
 *
 * **Desktop behavior:** Shows as a standard hover tooltip.
 *
 * **Mobile behavior:** Opens a compact dialog with the content only—no separate header
 * to conserve screen space on constrained devices.
 *
 * @example
 * ```tsx
 * <SimpleTooltip>People aged 40-64 are required to pay long-term care insurance.</SimpleTooltip>
 * ```
 */
export const SimpleTooltip: React.FC<SimpleTooltipProps> = ({
  children,
  icon,
  iconSx,
  iconAriaLabel
}) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const showDialog = isMobile;

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const tooltipContent = (
    <Box sx={{ maxWidth: 420, p: 1, fontSize: isMobile ? '0.85rem' : '1rem' }}>
      {children}
    </Box>
  );

  if (showDialog) {
    return (
      <>
        <IconButton
          onClick={handleOpen}
          size="small"
          sx={{
            p: 0.5,
            ml: 0.5,
            color: 'text.secondary',
            ...(iconSx || {})
          }}
          aria-label={iconAriaLabel || 'More information'}
        >
          {icon || SIMPLE_TOOLTIP_ICON}
        </IconButton>

        <Dialog
          open={open}
          onClose={handleClose}
          maxWidth="sm"
          fullWidth
          slotProps={{
            paper: {
              sx: {
                m: 2,
                width: '100%',
                maxWidth: 'calc(100% - 32px)',
                borderRadius: 2
              }
            }
          }}
        >
          <DialogContent dividers sx={{ p: 2 }}>
            {children}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleClose} variant="contained" color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <Tooltip
      title={tooltipContent}
      arrow
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 420,
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 1,
            '& .MuiTooltip-arrow': {
              color: 'background.paper',
              '&:before': {
                border: '1px solid',
                borderColor: 'divider'
              }
            }
          }
        }
      }}
    >
      <IconButton
        size="small"
        sx={{
          p: 0.5,
          ml: 0.5,
          color: 'text.secondary',
          verticalAlign: 'middle',
          ...(iconSx || {})
        }}
        aria-label={iconAriaLabel || 'More information'}
      >
        {icon || SIMPLE_TOOLTIP_ICON}
      </IconButton>
    </Tooltip>
  );
};

export default SimpleTooltip;
