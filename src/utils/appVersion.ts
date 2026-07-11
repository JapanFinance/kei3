// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Extracts the entry module script path (e.g. "/assets/index-<hash>.js") from an
 * index.html document. Vite content-hashes the filename, so it changes with every
 * build and doubles as the deployed app version.
 */
export function extractEntryScriptSrc(html: string): string | null {
  return (
    new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('script[type="module"]')
      ?.getAttribute('src') ?? null
  );
}

const RELOADED_FOR_VERSION_KEY = 'reloaded-for-app-version';

/**
 * Reloads the page when the server has a newer build than the one this page
 * booted from.
 *
 * Browsers may restore a suspended tab from a cached index.html without
 * revalidating it (RFC 9111 exempts history-style loads), so a tab restored
 * after a deploy would otherwise keep running the old app indefinitely.
 * SvelteKit's `version.pollInterval`/`updated` and Nuxt's outdated-build check
 * ship the same pattern built in; this is the minimal equivalent for a static
 * Vite app: check once per boot, the only moment a stale build can start
 * running and — by definition — before any user input exists. A live page that
 * is merely resumed never re-runs this, so it can never interrupt someone
 * mid-session. When offline, the fetch rejects and the cached app keeps
 * working untouched.
 */
export async function reloadIfNewVersionAvailable(): Promise<void> {
  const bootedWith = document.querySelector('script[type="module"]')?.getAttribute('src');
  if (!bootedWith) return;
  try {
    const response = await fetch('/', { cache: 'no-store' });
    if (!response.ok) return;
    const latest = extractEntryScriptSrc(await response.text());
    if (!latest || latest === bootedWith) return;
    // One reload per version: if a reload somehow still boots the old build
    // (e.g. an intermediary keeps serving stale HTML), stay put rather than loop.
    if (sessionStorage.getItem(RELOADED_FOR_VERSION_KEY) === latest) return;
    sessionStorage.setItem(RELOADED_FOR_VERSION_KEY, latest);
    window.location.reload();
  } catch {
    // Network unavailable; a restored tab keeps working from cache.
  }
}
