// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders the Lighthouse results written by .github/lighthouse-run.mjs
// (lighthouse-results/summary.json) and publishes them, selected by the first
// argument ('summary' | 'comment', or both when omitted):
//   - summary: append the table to the GitHub Actions job summary
//     ($GITHUB_STEP_SUMMARY) — used on every push and pull request.
//   - comment: upsert a single "sticky" comment on the pull request (when
//     PR_NUMBER and GITHUB_TOKEN are set), created once then updated in place.
//
// Usage: node .github/lighthouse-report.mjs [summary|comment] [summary.json]
//
// Like .github/size-report.mjs, the PR comment uses only Node's built-in fetch
// against the GitHub REST API and the Actions-provided GITHUB_TOKEN — no
// third-party GitHub Action. Comment failures (e.g. the read-only token on
// pull requests from forks) are logged and ignored so they never fail the
// build; the Lighthouse gate is the `lighthouse-run.mjs gate` step itself.

import { appendFileSync, readFileSync } from 'node:fs';

// Marks our comment so later runs find and update it instead of adding a new one.
const MARKER = '<!-- lighthouse-report -->';

// Category id -> display label, in presentation order.
const CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best Practices'],
  ['seo', 'SEO'],
];

const pct = score => (score == null ? '—' : String(Math.round(score * 100)));

function floorLabel(budget) {
  if (!budget || budget.minScore == null) return '—';
  return `${pct(budget.minScore)}${budget.level === 'warn' ? ' (warn)' : ''}`;
}

function statusFor(score, budget) {
  if (!budget || budget.minScore == null || score == null) return '—';
  if (score >= budget.minScore) return '✅ pass';
  return budget.level === 'error' ? '❌ fail' : '⚠️ warn';
}

function renderMarkdown(summary) {
  const scores = summary.local?.categories ?? {};
  const budgets = summary.budgets ?? {};
  const rows = CATEGORIES.map(([id, label]) => {
    const score = scores[id];
    return `| ${label} | ${pct(score)} | ${floorLabel(budgets[id])} | ${statusFor(score, budgets[id])} |`;
  });

  const runLabel = summary.runs ? `median of ${summary.runs} runs` : 'median run';
  const lines = [
    '### 🔦 Lighthouse',
    '',
    `${runLabel} · production build (\`dist/\`) served locally (${summary.formFactor ?? 'mobile'}).`,
    '',
    '| Category | Score | Floor | Status |',
    '| --- | --- | --- | --- |',
    ...rows,
  ];

  if (summary.preview?.performance != null) {
    lines.push(
      '',
      `**Performance on the Cloudflare preview** (real CDN): **${pct(summary.preview.performance)}** — ` +
        `<a href="${summary.preview.url}">preview</a> · tracked, not gated.`,
    );
  }

  lines.push(
    '',
    '<sub>Accessibility, Best Practices, and SEO are gated — CI fails below the floor. Performance is tracked, not gated: it is noisy on shared runners and bounded by the bundle. The local score is measured against the built <code>dist/</code> over a Brotli-compressing static server; the Cloudflare-preview score (pull requests only, best-effort) reflects the real CDN. Full HTML report is attached to the workflow run as the <code>lighthouse-report</code> artifact.</sub>',
  );
  return lines.join('\n');
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
    console.log(`${existing ? 'Updated' : 'Created'} Lighthouse PR comment.`);
  } catch (error) {
    console.warn(`Skipped PR comment: ${error.message}`);
  }
}

const mode = process.argv[2] ?? 'both'; // 'summary' | 'comment' | 'both'
const summaryPath = process.argv[3] ?? 'lighthouse-results/summary.json';
let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
} catch (error) {
  console.warn(`No Lighthouse summary at ${summaryPath}: ${error.message}`);
  process.exit(0);
}
const markdown = renderMarkdown(summary);
console.log(markdown);

if (mode !== 'comment' && process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
if (mode !== 'summary') {
  await upsertComment(markdown);
}
