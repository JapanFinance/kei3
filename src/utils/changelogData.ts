// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// This module is the only importer of the changelog markdown, and it must be
// reached only through dynamic imports ({@link import('../components/ChangelogModal')}
// statically, the deferred unread check in {@link import('../App')} dynamically)
// so the changelog text and parser bundle into the idle-loaded changelog chunk
// rather than a chunk fetched before the calculator can render.

import { getLastViewedDate, hasNewUpdates, parseChangelog } from './changelogUtils';
import changelogContent from '../../CHANGELOG.md?raw';

export { changelogContent };

/** True when the changelog has entries newer than the last viewed date. */
export function hasUnreadChangelogEntries(): boolean {
  try {
    return hasNewUpdates(parseChangelog(changelogContent), getLastViewedDate() || undefined);
  } catch (error) {
    console.warn('Failed to check for changelog updates:', error);
    return false;
  }
}
