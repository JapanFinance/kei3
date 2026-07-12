// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders the Lighthouse CI results and publishes them to two places:
//   1. The GitHub Actions job summary (when $GITHUB_STEP_SUMMARY is set).
//   2. A single "sticky" comment on the pull request (when PR_NUMBER and
//      GITHUB_TOKEN are set), created once and updated in place on later runs.
//
// It reads the representative (median) run from LHCI's filesystem manifest
// (.lighthouseci/manifest.json) and compares each category score against the
// budget in lighthouserc.cjs, so the comment and the `lhci assert` gate always
// report the same numbers.
//
// Usage: node scripts/lighthouse-report.mjs [manifest.json]
//
// Like scripts/size-report.mjs, the PR comment uses only Node's built-in fetch
// against the GitHub REST API and the Actions-provided GITHUB_TOKEN — no
// third-party GitHub Action. Comment failures (e.g. the read-only token on
// pull requests from forks) are logged and ignored so they never fail the
// build; the Lighthouse gate is the `lhci assert` step itself.

import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Marks our comment so later runs find and update it instead of adding a new one.
const MARKER = '<!-- lighthouse-report -->';

// Category id -> display label, in the order Lighthouse presents them.
const CATEGORIES = [
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['best-practices', 'Best Practices'],
  ['seo', 'SEO'],
];

const pct = score => (score == null ? '—' : String(Math.round(score * 100)));

// Load the LHCI config so the report's budgets and run count come from the same
// source as the gate. Best-effort: if it can't be read, scores are still
// reported, just without budget columns.
async function loadConfig() {
  try {
    const rc = await import(pathToFileURL(resolve('lighthouserc.cjs')).href);
    return rc.default?.ci ?? null;
  } catch (error) {
    console.warn(`Could not read lighthouserc.cjs: ${error.message}`);
    return null;
  }
}

// Pull per-category { level, minScore } out of the assert config.
function budgetsFromConfig(ci) {
  const assertions = ci?.assert?.assertions ?? {};
  const budgets = {};
  for (const [key, value] of Object.entries(assertions)) {
    if (!key.startsWith('categories:') || !Array.isArray(value)) continue;
    budgets[key.slice('categories:'.length)] = { level: value[0], minScore: value[1]?.minScore };
  }
  return budgets;
}

function floorLabel(budget) {
  if (!budget || budget.minScore == null) return '—';
  return `${Math.round(budget.minScore * 100)}${budget.level === 'warn' ? ' (warn)' : ''}`;
}

function statusFor(score, budget) {
  if (!budget || budget.minScore == null || score == null) return '—';
  if (score >= budget.minScore) return '✅ pass';
  return budget.level === 'error' ? '❌ fail' : '⚠️ warn';
}

function renderMarkdown(run, budgets, numberOfRuns) {
  const rows = CATEGORIES.map(([id, label]) => {
    const score = run.summary?.[id];
    return `| ${label} | ${pct(score)} | ${floorLabel(budgets[id])} | ${statusFor(score, budgets[id])} |`;
  });
  const runLabel = numberOfRuns ? `median of ${numberOfRuns} runs` : 'median run';
  return [
    '### 🔦 Lighthouse',
    '',
    `Representative ${runLabel} · production build (\`dist/\`) served locally.`,
    '',
    '| Category | Score | Floor | Status |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '<sub>Accessibility, Best Practices, and SEO are gated — CI fails below the floor. Performance is measured against a local static build and is sensitive to the runner and to the absence of production CDN compression/caching/HTTP-2, so it is tracked, not gated. Full HTML reports are attached to the workflow run as the <code>lighthouse-reports</code> artifact.</sub>',
  ].join('\n');
}

async function listCommentsPage(base, prNumber, headers, page) {
  const res = await fetch(`${base}/issues/${prNumber}/comments?per_page=100&page=${page}`, {
    headers,
  });
  if (!res.ok) throw new Error(`list comments returned ${res.status}`);
  return res.json();
}

// Walk comment pages until the sticky comment turns up or the pages run out.
// Recursion (rather than a loop) keeps the awaits out of a loop body.
async function findStickyComment(base, prNumber, headers, page = 1) {
  const batch = await listCommentsPage(base, prNumber, headers, page);
  const found = batch.find(comment => comment.body?.includes(MARKER));
  if (found) return found;
  if (batch.length < 100) return null;
  return findStickyComment(base, prNumber, headers, page + 1);
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
    const existing = await findStickyComment(base, prNumber, headers);
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

const manifestPath = process.argv[2] ?? '.lighthouseci/manifest.json';
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.warn(`No Lighthouse manifest at ${manifestPath}: ${error.message}`);
  process.exit(0);
}

const runs = Array.isArray(manifest) ? manifest : [];
const representative = runs.find(entry => entry.isRepresentativeRun) ?? runs[0];
if (!representative) {
  console.warn('Lighthouse manifest had no runs; nothing to report.');
  process.exit(0);
}

const ci = await loadConfig();
const markdown = renderMarkdown(representative, budgetsFromConfig(ci), ci?.collect?.numberOfRuns);
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
await upsertComment(markdown);
