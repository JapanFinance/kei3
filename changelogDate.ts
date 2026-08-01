// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The unread-updates dot only needs to know the newest changelog date, so the
// build resolves it here and inlines it as a string literal. That keeps the
// changelog text and its parser out of the startup path entirely — they ship
// only in the lazily loaded modal — while the badge still renders correctly on
// the first paint, with no runtime parsing at all.
//
// Shared by vite.config.ts and vitest.config.ts so both define the same value.
// The date is read once when the config loads: editing CHANGELOG.md during a
// dev session needs a server restart before the dot reflects it.

import { readFileSync } from 'node:fs';

import { parseChangelog } from './src/utils/changelogUtils';

/** Empty when the changelog has no dated entries, which hides the dot. */
export function latestChangelogDate(): string {
  return parseChangelog(readFileSync('CHANGELOG.md', 'utf8')).latestDate ?? '';
}

/** Vite `define` entry; the value is embedded as source text, hence the JSON. */
export function changelogDefine(): Record<string, string> {
  return { __LATEST_CHANGELOG_DATE__: JSON.stringify(latestChangelogDate()) };
}
