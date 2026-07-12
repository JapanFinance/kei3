// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import IconButton from '@mui/material/IconButton';
import { useColorScheme, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Brightness4 from '@mui/icons-material/Brightness4';
import Brightness7 from '@mui/icons-material/Brightness7';

const ThemeToggle = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { mode, systemMode, setMode } = useColorScheme();

  // `mode` is undefined on the first render (before MUI reads the stored
  // preference). Render a disabled placeholder of the same size so the toolbar
  // layout stays stable and there is no icon flicker.
  if (!mode) {
    return (
      <IconButton
        size={isMobile ? 'small' : 'medium'}
        disabled
        sx={{ ml: 1 }}
        aria-label="Toggle color mode"
      >
        <Brightness4 />
      </IconButton>
    );
  }

  // `mode` may be 'system'; resolve it to the concrete scheme for the icon.
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
