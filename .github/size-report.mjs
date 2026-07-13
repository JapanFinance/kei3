// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Self-hosted bundle-size tooling — replaces size-limit with Node's built-in
// zlib. Used by CI (.github/workflows/deploy.yml) and locally via `npm run size`
// after `npm run build`.
//
// Modes (first CLI arg):
//   measure
//     Read dist/assets, compute per-file Brotli sizes, write size-report.json,
//     append the table to the job summary ($GITHUB_STEP_SUMMARY), and exit
//     non-zero if the total exceeds the budget — this is the CI gate.
//   comment <headReport> [baseReport]
//     Upsert the sticky PR comment from a report JSON. Given a base report (the
//     PR's base commit, restored from the Actions cache) it also shows the
//     per-chunk delta.
//
// Brotli approximates what Cloudflare serves modern browsers; it is a relative
// regression tripwire, not the exact transfer size (Cloudflare compresses at a
// lower quality). Node's default (max-quality) Brotli matches size-limit's
// figure to the byte.

import { appendFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';

const ASSETS_DIR = 'dist/assets';
const REPORT_PATH = 'size-report.json';
const MARKER = '<!-- size-limit-report -->';
// Matches main's existing size-limit budget (264 kB) — this PR is a
// behavior-preserving refactor and must not move the gate. Current total is
// ~263.3 kB. Raise this in the same change that legitimately adds weight.
const BUDGET_BYTES = 264_000;

const kb = bytes => `${(bytes / 1000).toFixed(1)} kB`;
// Drop Vite's "-<8-char hash>" so a chunk is comparable across commits.
const chunkName = file => file.replace(/-[\w-]{8}(\.\w+)$/, '$1');

function measure() {
  const files = readdirSync(ASSETS_DIR).filter(f => /\.(js|css)$/.test(f));
  const entries = files
    .map(f => ({
      name: chunkName(f),
      size: brotliCompressSync(readFileSync(join(ASSETS_DIR, f))).length,
    }))
    .sort((a, b) => b.size - a.size);
  const total = entries.reduce((sum, e) => sum + e.size, 0);
  return { total, budget: BUDGET_BYTES, files: entries };
}

function readReport(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function deltaText(prev, cur) {
  if (prev == null) return 'new';
  const diff = cur - prev;
  const magnitude = kb(Math.abs(diff));
  // Treat sub-0.05 kB moves (which round to "0.0 kB") as unchanged, so a chunk
  // that shifted by a handful of bytes shows "—" rather than a noisy "+0.0 kB".
  if (magnitude === '0.0 kB') return '—';
  return `${diff > 0 ? '+' : '-'}${magnitude}`;
}

function renderMarkdown(report, base) {
  const withDelta = Boolean(base);
  const baseSizes = new Map((base?.files ?? []).map(f => [f.name, f.size]));

  const rows = report.files.map(f => {
    const cells = [`\`${f.name}\``, kb(f.size)];
    if (withDelta) cells.push(deltaText(baseSizes.get(f.name), f.size));
    return `| ${cells.join(' | ')} |`;
  });
  if (withDelta) {
    const headNames = new Set(report.files.map(f => f.name));
    for (const f of base.files) {
      if (!headNames.has(f.name)) rows.push(`| \`${f.name}\` | — | removed |`);
    }
  }

  const totalRow = withDelta
    ? `| **Total** | **${kb(report.total)}** | **${deltaText(base.total, report.total)}** |`
    : `| **Total** | **${kb(report.total)}** |`;
  const status = report.total <= report.budget ? '✅' : '❌ over budget';

  return [
    `### 📦 Bundle size — ${kb(report.total)} Brotli / ${kb(report.budget)} budget ${status}`,
    '',
    '<details><summary>Per-file breakdown</summary>',
    '',
    withDelta ? '| Chunk | Brotli | Δ vs base |' : '| Chunk | Brotli |',
    withDelta ? '| --- | --: | --: |' : '| --- | --: |',
    ...rows,
    totalRow,
    '',
    '</details>',
    '',
    `<sub>Brotli size of the built JS + CSS (\`dist/assets/*.{js,css}\`) — a regression tripwire, close to but not exactly what Cloudflare serves.${withDelta ? ' Δ is vs the PR base commit.' : ''}</sub>`,
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

const mode = process.argv[2];

if (mode === 'measure') {
  const report = measure();
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  const markdown = renderMarkdown(report);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
  if (report.total > report.budget) {
    console.error(`Bundle size ${kb(report.total)} exceeds budget ${kb(report.budget)}.`);
    process.exit(1);
  }
} else if (mode === 'comment') {
  const report = readReport(process.argv[3] ?? REPORT_PATH);
  if (!report) {
    console.warn('No head size report; skipping comment.');
    process.exit(0);
  }
  const base = process.argv[4] ? readReport(process.argv[4]) : undefined;
  const markdown = renderMarkdown(report, base);
  console.log(markdown);
  await upsertComment(markdown);
} else {
  console.error('Usage: node .github/size-report.mjs measure | comment <head> [base]');
  process.exit(1);
}
