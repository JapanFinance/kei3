// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Brightness4 from '@mui/icons-material/Brightness4';
import Brightness7 from '@mui/icons-material/Brightness7';
import IconButton from '@mui/material/IconButton';
import { useColorScheme, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

const ThemeToggle = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { mode, systemMode, setMode } = useColorScheme();
  const isDark = (mode === 'system' ? systemMode : mode) === 'dark';

  return (
    <IconButton
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      color="inherit"
      size={isMobile ? 'small' : 'medium'}
      sx={{
        ml: 1,
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Brightness7 /> : <Brightness4 />}
    </IconButton>
  );
};

export default ThemeToggle;
