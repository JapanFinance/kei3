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

/**
 * Extracts the entry module script path (e.g. "/assets/index-<hash>.js") from
 * an index.html document. Vite content-hashes the filename, so it changes with
 * every build and doubles as the deployed app version.
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
 * Reloads the page when a restored tab is running a build that is no longer
 * deployed.
 *
 * Browsers may restore a suspended tab from a cached index.html without
 * revalidating it, so a tab restored after a deploy would otherwise keep
 * running the old app indefinitely. SvelteKit's `version.pollInterval`/
 * `updated` and Nuxt's outdated-build check ship the same pattern built in;
 * this is the minimal equivalent for a static Vite app: on history-style
 * boots only — the sole moment a stale build can start running and, by
 * definition, before any user input exists — fetch the current index.html
 * and compare its entry-script hash against the one this page booted from;
 * on mismatch, reload once to pick up the new build.
 *
 * The probe must be a GET of the HTML at a never-cached URL. Chromium serves
 * fetches made during a session-restore boot from the HTTP cache regardless
 * of `cache: "no-store"` — observed 2026-07: both a HEAD of the (cached)
 * entry script and a GET of "/" issued at boot returned the cached responses
 * without server contact, leaving the probe blind in exactly the scenario it
 * exists for, while requests to URLs absent from the cache reached the
 * network even mid-restore. A unique query string (ignored by Workers assets
 * path resolution) makes every probe such a URL. Comparing the fetched HTML's
 * entry hash (rather than HEAD-probing our own entry for 404) also keeps the
 * probe meaningful on hosts that retain old deploys' assets.
 *
 * A live page that is merely resumed never re-runs this, so it can never
 * interrupt anyone mid-session, and the reload it triggers boots with
 * navigation type "reload", which never probes — so a loop is impossible by
 * construction. When offline, the fetch rejects and the cached app keeps
 * working.
 */
export async function reloadIfNewVersionAvailable(): Promise<void> {
  const navType = (
    performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  )?.type;
  const wasDiscarded = (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
  if (!isHistoryStyleBoot(navType, wasDiscarded)) return;

  const bootedWith = document.querySelector('script[type="module"]')?.getAttribute('src');
  if (!bootedWith) return;
  try {
    const response = await fetch(`/?stale-probe=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const latest = extractEntryScriptSrc(await response.text());
    if (!latest || latest === bootedWith) return;
    // Belt and braces alongside the reload-never-probes property above.
    if (sessionStorage.getItem(RELOADED_FOR_VERSION_KEY) === latest) return;
    sessionStorage.setItem(RELOADED_FOR_VERSION_KEY, latest);
    window.location.reload();
  } catch {
    // Network unavailable; a restored tab keeps working from cache.
  }
}
