// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * True when this boot may be running an index.html that skipped server
 * revalidation. Fresh navigations and reloads always revalidate it (it is
 * served `max-age=0, must-revalidate`), so they boot the latest deploy and
 * need no version probe. History-style loads — tab/session restores and
 * back/forward, reported as `back_forward`, plus Chrome's discarded-tab
 * reloads flagged by `document.wasDiscarded` — are exempt from revalidation
 * (RFC 9111) and can boot a stale build. When the navigation type is
 * unavailable, err on probing; it is cheap.
 */
export function isHistoryStyleBoot(navType: string | undefined, wasDiscarded: boolean): boolean {
  return wasDiscarded || navType === undefined || navType === 'back_forward';
}

const RELOADED_FOR_VERSION_KEY = 'reloaded-for-app-version';

/**
 * Reloads the page when a restored tab is running a build that is no longer
 * deployed.
 *
 * Browsers may restore a suspended tab from a cached index.html without
 * revalidating it, so a tab restored after a deploy would otherwise keep
 * running the old app indefinitely. SvelteKit's `version.pollInterval`/
 * `updated` and Nuxt's outdated-build check ship the same pattern built in;
 * this is the minimal equivalent for a static Vite app: on history-style
 * boots only — the sole moment a stale build can start running and, by
 * definition, before any user input exists — HEAD-probe this build's own
 * content-hashed entry script. 404 means a newer deploy replaced it; reload
 * once to pick it up. A live page that is merely resumed never re-runs this,
 * so it can never interrupt anyone mid-session, and the reload it triggers
 * boots with navigation type "reload", which never probes — so a loop is
 * impossible by construction. When offline, the fetch rejects and the cached
 * app keeps working.
 */
export async function reloadIfNewVersionAvailable(): Promise<void> {
  const navType = (
    performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  )?.type;
  const wasDiscarded = (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
  if (!isHistoryStyleBoot(navType, wasDiscarded)) return;

  const entrySrc = document.querySelector('script[type="module"]')?.getAttribute('src');
  if (!entrySrc) return;
  try {
    const response = await fetch(entrySrc, { method: 'HEAD', cache: 'no-store' });
    if (response.status !== 404) return;
    // Belt and braces alongside the reload-never-probes property above.
    if (sessionStorage.getItem(RELOADED_FOR_VERSION_KEY) === entrySrc) return;
    sessionStorage.setItem(RELOADED_FOR_VERSION_KEY, entrySrc);
    window.location.reload();
  } catch {
    // Network unavailable; a restored tab keeps working from cache.
  }
}
