// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders the `size-limit --json` report as a GitHub Actions job-summary table.
//
// Usage: node scripts/size-summary.mjs [report.json]
//   Reads the JSON report (default: size-limit.json) and writes GitHub-flavored
//   Markdown to stdout, which the CI step appends to $GITHUB_STEP_SUMMARY. This
//   script always exits 0; the size-limit step itself is what fails the build
//   when a budget is exceeded, so the summary renders on both pass and failure.

import { readFileSync } from 'node:fs';

const reportPath = process.argv[2] ?? 'size-limit.json';
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const kb = bytes => `${(bytes / 1000).toFixed(1)} kB`;
const seconds = value => (value == null ? '—' : `${value.toFixed(2)} s`);

const rows = report.map(check => {
  const budget = check.sizeLimit == null ? '—' : kb(check.sizeLimit);
  const hasTime = check.loading != null || check.running != null;
  const total = hasTime ? seconds((check.loading ?? 0) + (check.running ?? 0)) : '—';
  const result = check.passed ? '✅ pass' : '❌ over budget';
  return `| ${check.name} | ${kb(check.size)} | ${budget} | ${seconds(check.loading)} | ${seconds(check.running)} | ${total} | ${result} |`;
});

const summary = [
  '### 📦 Bundle size',
  '',
  '| Check | Gzip | Size budget | Load¹ | Exec² | Total | Result |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  '<sub>Only gzipped size is gated. Load¹ / Exec² / Total are shown for tracking, not enforced — ¹ download on size-limit’s default slow-3G profile, ² execution on a throttled Snapdragon 410 CPU. Both are intentionally pessimistic, so totals run higher than real desktop or 4G load.</sub>',
  '',
].join('\n');

process.stdout.write(`${summary}\n`);
