// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders the `size-limit --json` report and publishes it, selected by the
// REPORT_MODE env var ('summary' | 'comment', or both when unset):
//   - summary: append the table to the GitHub Actions job summary
//     ($GITHUB_STEP_SUMMARY) — used on every push and pull request.
//   - comment: upsert a single "sticky" comment on the pull request (when
//     PR_NUMBER and GITHUB_TOKEN are set), created once then updated in place.
//
// Usage: node scripts/size-report.mjs [report.json]
//
// The PR comment uses only Node's built-in fetch against the GitHub REST API
// and the Actions-provided GITHUB_TOKEN — no third-party GitHub Action. Comment
// failures (e.g. the read-only token on pull requests from forks) are logged
// and ignored so they never fail the build; the size gate is the `size-limit`
// step itself.

import { appendFileSync, readFileSync } from 'node:fs';

// Marks our comment so later runs find and update it instead of adding a new one.
const MARKER = '<!-- size-limit-report -->';

const kb = bytes => `${(bytes / 1000).toFixed(1)} kB`;

function renderMarkdown(report) {
  const rows = report.map(check => {
    const budget = check.sizeLimit == null ? '—' : kb(check.sizeLimit);
    const result = check.passed ? '✅ pass' : '❌ over budget';
    return `| ${check.name} | ${kb(check.size)} | ${budget} | ${result} |`;
  });
  return [
    '### 📦 Bundle size',
    '',
    '| Check | Gzip | Budget | Result |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '<sub>Gzipped size of the built JS (`dist/assets/*.js`). CI fails on any increase; raise the budget deliberately when the growth is intended.</sub>',
  ].join('\n');
}

async function listCommentsPage(base, prNumber, headers, page) {
  const res = await fetch(`${base}/issues/${prNumber}/comments?per_page=100&page=${page}`, {
    headers,
  });
  if (!res.ok) throw new Error(`list comments returned ${res.status}`);
  return res.json();
}

// Create or update the single sticky comment on the PR. Best-effort: any failure
// is logged and swallowed so a missing/read-only token never fails the build.
async function upsertComment(markdown) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY; // "owner/name", set by Actions
  const prNumber = process.env.PR_NUMBER;
  if (!token || !repo || !prNumber) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const body = `${MARKER}\n${markdown}`;
  const base = `https://api.github.com/repos/${repo}`;

  try {
    let existing;
    for (let page = 1; !existing; page++) {
      // Pages are fetched sequentially: each result decides whether to request
      // the next, with an early exit once the sticky comment is found.
      // eslint-disable-next-line no-await-in-loop
      const batch = await listCommentsPage(base, prNumber, headers, page);
      existing = batch.find(comment => comment.body?.includes(MARKER));
      if (batch.length < 100) break;
    }

    const res = await fetch(
      existing ? `${base}/issues/comments/${existing.id}` : `${base}/issues/${prNumber}/comments`,
      { method: existing ? 'PATCH' : 'POST', headers, body: JSON.stringify({ body }) },
    );
    if (!res.ok) throw new Error(`${existing ? 'update' : 'create'} returned ${res.status}`);
    console.log(`${existing ? 'Updated' : 'Created'} bundle-size PR comment.`);
  } catch (error) {
    console.warn(`Skipped PR comment: ${error.message}`);
  }
}

const reportPath = process.argv[2] ?? 'size-limit.json';
let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (error) {
  console.warn(`No size report at ${reportPath}: ${error.message}`);
  process.exit(0);
}

const mode = process.env.REPORT_MODE ?? 'both'; // 'summary' | 'comment' | 'both'
const markdown = renderMarkdown(report);
console.log(markdown);

if (mode !== 'comment' && process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
if (mode !== 'summary') {
  await upsertComment(markdown);
}
