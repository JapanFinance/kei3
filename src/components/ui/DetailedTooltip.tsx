// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DETAILED_TOOLTIP_ICON } from './constants';

interface DetailedTooltipProps {
  title: string;              // Required: dialog header / tooltip title
  children: React.ReactNode;  // Required: rich content (tables, links, etc.)
  icon?: React.ReactNode;     // Optional: custom icon (default: CalculateIcon)
  iconSx?: object;            // Optional: icon/button styling
  iconAriaLabel?: string;     // Optional: aria-label for icon button
}

/**
 * DetailedTooltip displays complex explanations with rich content (tables, links, etc.).
 *
 * **Desktop behavior:** Shows as a standard hover tooltip with children displayed.
 *
 * **Mobile behavior:** Opens a full dialog with `title` as a meaningful header and
 * children as the body. This makes better use of mobile space and provides context.
 *
 * Defaults to `CalculateIcon` to visually indicate calculation/detailed information.
 *
 * @example
 * ```tsx
 * <DetailedTooltip title="Donation List">
 *   <Typography>Detailed explanation with <strong>rich content</strong></Typography>
 * </DetailedTooltip>
 * ```
 * @see DETAILED_TOOLTIP_ICON for the default icon used when `icon` prop is not provided.
 */
export const DetailedTooltip: React.FC<DetailedTooltipProps> = ({
  title,
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
          {icon || DETAILED_TOOLTIP_ICON}
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
          <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
          <DialogContent dividers>{children}</DialogContent>
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
        {icon || DETAILED_TOOLTIP_ICON}
      </IconButton>
    </Tooltip>
  );
};

export default DetailedTooltip;
