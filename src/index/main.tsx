// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { AppShell } from '../shared/Root'

// The page component is code-split so each calculator ships its own bundle.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell Page={lazy(() => import('./App'))} />
  </StrictMode>,
)
