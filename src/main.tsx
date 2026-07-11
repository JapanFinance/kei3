// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';
import { reloadIfNewVersionAvailable } from './utils/appVersion';
import './index.css';

void reloadIfNewVersionAvailable();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
