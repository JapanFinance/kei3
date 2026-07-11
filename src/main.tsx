// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';
import './index.css';

// A page loaded before a deploy references lazy chunks that no longer exist
// afterwards; reload to pick up the new index.html instead of a blank page.
// Reload at most once per minute: if the fresh page still can't load its
// chunks (broken deploy, offline), let the error surface rather than loop.
window.addEventListener('vite:preloadError', event => {
  const RELOADED_AT_KEY = 'vite-preload-error-reloaded-at';
  const reloadedAt = Number(sessionStorage.getItem(RELOADED_AT_KEY));
  if (Date.now() - reloadedAt < 60_000) return;
  sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
