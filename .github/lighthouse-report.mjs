// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders the Lighthouse results written by .github/lighthouse-run.mjs
// (lighthouse-results/summary.json) and publishes them, selected by the first
// argument ('summary' | 'comment', or both when omitted):
//   - summary: append the table to the GitHub Actions job summary
//     ($GITHUB_STEP_SUMMARY) — used on every push and pull request.
//   - comment: upsert a single "sticky" comment on the pull request (when
//     PR_NUMBER and GITHUB_TOKEN are set), created once then updated in place.
//     Given a baseline summary (the PR's base commit, restored from the Actions
//     cache like the bundle-size report) it also shows per-category deltas.
//
// When LIGHTHOUSE_ARTIFACT_URL is set (the upload step's artifact-url output),
// the output links the full HTML report(s) directly.
//
// Usage: node .github/lighthouse-report.mjs [summary|comment] [head.json] [base.json]
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

// Score movement in points vs the baseline run, size-report style: signed
// integer, or "—" for no movement / no baseline.
function deltaText(prev, cur) {
  if (prev == null || cur == null) return '—';
  const diff = Math.round(cur * 100) - Math.round(prev * 100);
  if (diff === 0) return '—';
  return diff > 0 ? `+${diff}` : String(diff);
}

// One bullet per score-weighted audit that holds a category below 100.
function auditLines(imperfectAudits) {
  const lines = [];
  for (const [id, label] of CATEGORIES) {
    for (const audit of imperfectAudits?.[id] ?? []) {
      lines.push(`- ${label}: \`${audit.id}\` (${pct(audit.score)}) — ${audit.title}`);
    }
  }
  return lines;
}

function renderMarkdown(summary, base) {
  const scores = summary.local?.categories ?? {};
  const budgets = summary.budgets ?? {};
  const baseScores = base?.local?.categories;
  const withDelta = Boolean(baseScores);

  const rows = CATEGORIES.map(([id, label]) => {
    const score = scores[id];
    const cells = [label, pct(score)];
    if (withDelta) cells.push(deltaText(baseScores[id], score));
    cells.push(floorLabel(budgets[id]), statusFor(score, budgets[id]));
    return `| ${cells.join(' | ')} |`;
  });

  const runLabel = summary.runs ? `median of ${summary.runs} runs` : 'median run';
  const lines = [
    '### 🔦 Lighthouse',
    '',
    `${runLabel} · production build (\`dist/\`) served locally (${summary.formFactor ?? 'mobile'}).`,
    '',
    withDelta
      ? '| Category | Score | Δ vs base | Floor | Status |'
      : '| Category | Score | Floor | Status |',
    withDelta ? '| --- | --: | --: | --: | --- |' : '| --- | --: | --: | --- |',
    ...rows,
  ];

  if (summary.preview?.performance != null) {
    lines.push(
      '',
      `**Performance on the Cloudflare preview** (real CDN): **${pct(summary.preview.performance)}** — ` +
        `<a href="${summary.preview.url}">preview</a> · tracked, not gated.`,
    );
  }

  if (summary.production?.categories) {
    const production = summary.production;
    const scoreLine = CATEGORIES.map(
      ([id, label]) => `${label} **${pct(production.categories[id])}**`,
    ).join(' · ');
    const staleNote = production.deployedMatch
      ? ''
      : ' (the deploy had not caught up to this commit; scores are for the previously live build)';
    lines.push(
      '',
      `**Production** (<a href="${production.url}">${new URL(production.url).hostname}</a>, Cloudflare layer included): ${scoreLine} · tracked, not gated${staleNote}.`,
    );
  }

  // What concretely holds each score below 100 — usually enough to diagnose a
  // drop without downloading the full report.
  const details = [
    ...auditLines(summary.local?.imperfectAudits),
    ...(summary.production?.imperfectAudits
      ? auditLines(summary.production.imperfectAudits).map(line => `${line} *(production)*`)
      : []),
  ];
  if (details.length) {
    lines.push(
      '',
      '<details><summary>Audits holding scores below 100</summary>',
      '',
      ...details,
      '',
      '</details>',
    );
  }

  const artifactUrl = process.env.LIGHTHOUSE_ARTIFACT_URL;
  if (artifactUrl) {
    lines.push('', `Full HTML report: [\`lighthouse-report\` artifact](${artifactUrl}).`);
  }

  lines.push(
    '',
    `<sub>Accessibility, Best Practices, and SEO are gated — CI fails below the floor. Performance is tracked, not gated: it is noisy on shared runners and bounded by the bundle. The gate audits the built <code>dist/</code> over a Brotli-compressing local server, so it isolates what this change affects; the Cloudflare preview (pull requests) and production (pushes to main) rows are the delivered experience.${withDelta ? ' Δ is vs the PR base commit.' : ''}</sub>`,
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

// The PR base commit's summary (optional). Missing or unreadable — e.g. the
// Actions cache evicted it, or the base predates this feature — degrades to an
// absolute report with no Δ column.
let base;
if (process.argv[4]) {
  try {
    base = JSON.parse(readFileSync(process.argv[4], 'utf8'));
  } catch {
    console.warn(`No baseline summary at ${process.argv[4]}; reporting absolute scores.`);
  }
}

const markdown = renderMarkdown(summary, base);
console.log(markdown);

if (mode !== 'comment' && process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
if (mode !== 'summary') {
  await upsertComment(markdown);
}
