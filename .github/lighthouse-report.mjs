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
// Usage: node .github/lighthouse-report.mjs [summary|comment] [this-run.json] [base.json]
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

// The metrics the performance score is built from, in presentation order.
const METRIC_LABELS = {
  'first-contentful-paint': 'First Contentful Paint',
  'largest-contentful-paint': 'Largest Contentful Paint',
  'total-blocking-time': 'Total Blocking Time',
  'cumulative-layout-shift': 'Cumulative Layout Shift',
  'speed-index': 'Speed Index',
};

const formatMetric = (value, unit) => {
  if (unit === 'unitless') return value.toFixed(3);
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
};

// Signed movement, lower being better. Sub-10 ms (or sub-0.001 CLS) reads as
// unchanged rather than as noise, the way the size report ignores sub-0.05 kB.
function metricDelta(previous, current, unit) {
  if (previous == null || current == null) return '—';
  const diff = current - previous;
  if (unit === 'unitless') {
    return Math.abs(diff) < 0.001 ? '—' : `${diff > 0 ? '+' : '-'}${Math.abs(diff).toFixed(3)}`;
  }
  if (Math.abs(diff) < 10) return '—';
  return `${diff > 0 ? '+' : '-'}${formatMetric(Math.abs(diff), unit)}`;
}

// min–max across the runs; "—" when the runs agreed.
function rangeText(metric) {
  if (metric.min == null || metric.max == null || metric.min === metric.max) return '—';
  return `${formatMetric(metric.min, metric.unit)} – ${formatMetric(metric.max, metric.unit)}`;
}

function renderMetrics(metrics, baseMetrics) {
  const ids = Object.keys(METRIC_LABELS).filter(id => metrics?.[id]);
  if (!ids.length) return [];
  const withDelta = Boolean(baseMetrics);
  const rows = ids.map(id => {
    const metric = metrics[id];
    const cells = [METRIC_LABELS[id], formatMetric(metric.value, metric.unit), rangeText(metric)];
    if (withDelta) cells.push(metricDelta(baseMetrics[id]?.value, metric.value, metric.unit));
    return `| ${cells.join(' | ')} |`;
  });
  return [
    '',
    '<details><summary>Performance metrics — the sharper signal for performance work</summary>',
    '',
    withDelta ? '| Metric | Median | Range | Δ vs main |' : '| Metric | Median | Range |',
    withDelta ? '| --- | --: | --: | --: |' : '| --- | --: | --: |',
    ...rows,
    '',
    '<sub>Lower is better. Judge a performance change here rather than on the score: the score maps each metric through a log-normal curve and weights it (LCP 25%, TBT 30%, CLS 25%, FCP 10%, SI 10%), so a genuine win can be worth a fraction of a point and round away above while showing clearly here. A wide range means the shared runner was contended — re-run the job for a cleaner sample before concluding anything. Δ compares against main audited in the same workers.dev environment. CLS flipping between 0.000 and 0.023 is one small real shift at the detection threshold, not a regression.</sub>',
    '',
    '</details>',
  ];
}

// The app's own load milestones — performance.mark entries fired one frame
// after each component's first commit paints (src/utils/loadMilestones.ts owns
// the names). Display labels in presentation order.
const MILESTONE_LABELS = {
  'app-rendered': 'App rendered',
  'results-rendered': 'Results rendered',
  'chart-rendered': 'Chart rendered',
};

// `withDelta` follows the presence of a baseline summary, not of baseline
// milestones: a baseline from before the marks existed still gets a Δ column,
// with "new" in place of a number, so the column appears the moment it can.
function renderMilestones(milestones, baseMilestones, withDelta) {
  const ids = Object.keys(MILESTONE_LABELS).filter(id => milestones?.[id]);
  if (!ids.length) return [];
  const rows = ids.map(id => {
    const milestone = milestones[id];
    const cells = [
      MILESTONE_LABELS[id],
      formatMetric(milestone.value, milestone.unit),
      rangeText(milestone),
    ];
    if (withDelta) {
      const base = baseMilestones?.[id];
      cells.push(base ? metricDelta(base.value, milestone.value, milestone.unit) : 'new');
    }
    return `| ${cells.join(' | ')} |`;
  });
  return [
    '',
    "<details><summary>App milestones — when the app's content actually renders</summary>",
    '',
    withDelta ? '| Milestone | Median | Range | Δ vs main |' : '| Milestone | Median | Range |',
    withDelta ? '| --- | --: | --: | --: |' : '| --- | --: | --: |',
    ...rows,
    '',
    `<sub>Lower is better. User Timing marks fired by the app one frame after each component's first commit paints: the app replacing the loading shell, then the lazy results panel, then the chart (a canvas, which Largest Contentful Paint never considers). The headline FCP/LCP are simulated (Lantern) values, but these marks are observed times on the unthrottled shared runner — absolute values are small and contention-sensitive, so judge the Δ against main in the same environment, not the absolute number. Identical times across milestones are real, not broken instrumentation: when the lazy chunks arrive close together — as they do on this runner's fast connection — React reveals them in a single commit and they paint in one frame, collapsing the cascade a slower real-world connection spreads apart (measured locally under devtools slow-4G throttling: the same build separates to roughly +0.5 s results, +1.6 s chart after app-rendered).${withDelta ? ' "new" means the main baseline predates these marks.' : ''}</sub>`,
    '',
    '</details>',
  ];
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
  const app = summary.app ?? {};
  const scores = app.categories ?? {};
  const budgets = summary.budgets ?? {};
  const baseScores = base?.app?.categories;
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
    `${runLabel} · ${app.env ?? 'app'} (${summary.formFactor ?? 'mobile'})` +
      `${withDelta ? ' · Δ vs main in the same environment' : ''}.`,
    '',
    withDelta
      ? '| Category | Score | Δ vs main | Floor | Status |'
      : '| Category | Score | Floor | Status |',
    withDelta ? '| --- | --: | --: | --: | --- |' : '| --- | --: | --: | --- |',
    ...rows,
  ];

  if (summary.production?.categories) {
    const production = summary.production;
    // Production's non-performance categories are gated at its own floors
    // (renormalization differs — see lighthouse-budget.js); mark a breach
    // inline so the summary explains a failed check at a glance.
    const prodBudgets = production.budgets ?? budgets;
    const scoreLine = CATEGORIES.map(([id, label]) => {
      const score = production.categories[id];
      const gated = id !== 'performance';
      const breach = gated && prodBudgets[id]?.minScore != null && score < prodBudgets[id].minScore;
      return `${label} **${pct(score)}**${breach ? ' ❌' : ''}`;
    }).join(' · ');
    const staleNote = production.deployedMatch
      ? ''
      : ' (the deploy had not caught up to this commit; scores are for the previously live build and were not gated)';
    lines.push(
      '',
      `**Production** (<a href="${production.url}">${new URL(production.url).hostname}</a>, Cloudflare zone layer included): ${scoreLine} · non-performance categories gated, performance tracked${staleNote}.`,
    );
  }

  lines.push(...renderMetrics(app.metrics, base?.app?.metrics));
  lines.push(...renderMilestones(app.milestones, base?.app?.milestones, Boolean(base?.app)));

  // What concretely holds each score below 100 — usually enough to diagnose a
  // drop without downloading the full report.
  const details = [
    ...auditLines(app.imperfectAudits),
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
    lines.push('', `📄 [Full Lighthouse HTML report](${artifactUrl})`);
  }

  lines.push(
    '',
    `<sub>Accessibility, Best Practices, and SEO are gated at floors equal to their current scores — they are deterministic, so any drop is a real regression; CI fails below the floor. Performance is tracked, not gated. The table audits this change's own Cloudflare deployment; Δ compares against main audited in the same workers.dev environment class (no zone layer on either side), so a Δ is caused by the change, not the environment. Audits that can only fail as environment artifacts are skipped and the scores renormalized: is-crawlable on workers.dev hosts (served noindex by design), deprecations and inspector-issues on production (Cloudflare's injected bot-detection script) — see lighthouse-budget.js.</sub>`,
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
