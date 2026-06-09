// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Brightness4 from '@mui/icons-material/Brightness4';
import Brightness7 from '@mui/icons-material/Brightness7';

interface ThemeToggleProps {
  toggleColorMode: () => void;
  mode: 'light' | 'dark';
}

const ThemeToggle = ({ toggleColorMode, mode }: ThemeToggleProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <IconButton
      onClick={toggleColorMode}
      color="inherit"
      size={isMobile ? 'small' : 'medium'}
      sx={{
        ml: 1,
        '&:hover': {
          backgroundColor: theme.palette.action.hover
        }
      }}
      aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
    >
      {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
    </IconButton>
  );
};

export default ThemeToggle;