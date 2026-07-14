// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Runs Lighthouse for CI, driven by lighthouse-budget.js. Three subcommands:
//
//   local    Serve dist/ from a small static server (Brotli/gzip, immutable
//            asset caching — like Cloudflare) and audit it RUNS times. Write the
//            median category scores and the representative HTML report to
//            lighthouse-results/. This only MEASURES; the CI gate is `gate`, run
//            as a later step so the artifact and PR comment are produced even
//            when the gate fails. Always exits 0 (a failed audit run throws).
//
//   gate     Read lighthouse-results/summary.json and exit non-zero if any
//            error-level category is below its floor. This is the CI gate.
//
//   preview  Best-effort, pull requests only. Find the Cloudflare preview URL for
//            the PR's head commit (from the Cloudflare bot's PR comment, matched
//            by commit SHA + "Deployment successful"), audit its PERFORMANCE, and
//            merge the number into summary.json. Always exits 0.
//
//   production  Best-effort, pushes to main only. Audit PROD_URL — what users
//            actually experience, Cloudflare layer included — in all four
//            categories, after waiting for the deploy to serve this commit's
//            build. Tracked, never gated; merged into summary.json. Always
//            exits 0.
//
// Uses only Node built-ins plus the pinned `lighthouse` and `chrome-launcher`.

import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import {
  BUDGETS,
  CATEGORY_LABELS,
  FORM_FACTOR,
  PREVIEW_PERF,
  PROD_URL,
  RUNS,
} from '../lighthouse-budget.js';

/* eslint-disable no-await-in-loop -- The audit runs and the Cloudflare-deploy
   poll are intentionally sequential: running Chrome audits in parallel would
   make them contend and skew the timing metrics, and the poll must pause
   between checks. */

const DIST_DIR = 'dist';
const OUT_DIR = 'lighthouse-results';
const SUMMARY_PATH = join(OUT_DIR, 'summary.json');
// These file names become the artifact names in CI: the workflow uploads them
// with upload-artifact's `archive: false`, which skips the ZIP wrapper and names
// the artifact after the file, so the report opens directly.
const REPORT_PATH = join(OUT_DIR, 'lighthouse-report.html');
const PRODUCTION_REPORT_PATH = join(OUT_DIR, 'lighthouse-report-production.html');
const CATEGORIES = Object.keys(CATEGORY_LABELS);

// Standard headless flags for GitHub-hosted runners.
const CHROME_FLAGS = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];

// Desktop overrides; mobile (Lighthouse's throttled default) needs no config.
const DESKTOP_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const pct = score => (score == null ? '—' : String(Math.round(score * 100)));
const sleep = ms => new Promise(done => setTimeout(done, ms));

// The five metrics the performance score is computed from, reported alongside it
// because they are the sharper instrument. The score maps each metric through a
// log-normal curve and weights it (LCP 25%, TBT 30%, CLS 25%, FCP 10%, SI 10%),
// so a real win — say 200 ms of LCP — can be worth a fraction of a point and
// round away, while the metric itself moves visibly.
const METRIC_IDS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
];

// Median of each metric across the runs, with the unit Lighthouse reports it in.
function collectMetrics(runs) {
  const metrics = {};
  for (const id of METRIC_IDS) {
    const values = runs
      .map(run => run.lhr.audits[id]?.numericValue)
      .filter(value => typeof value === 'number');
    if (!values.length) continue;
    metrics[id] = {
      value: median(values),
      unit: runs[0].lhr.audits[id]?.numericUnit ?? 'millisecond',
    };
  }
  return metrics;
}

// The score-weighted audits that hold a category below 1.0 in the given run —
// the concrete "what to fix" behind each imperfect number. Weight-0 audits are
// informational and cannot move a score, so they are skipped.
function collectImperfectAudits(lhr) {
  const result = {};
  for (const category of CATEGORIES) {
    const items = lhr.categories[category].auditRefs
      .filter(ref => ref.weight > 0)
      .map(ref => lhr.audits[ref.id])
      .filter(audit => audit && audit.score !== null && audit.score < 1)
      .map(audit => ({ id: audit.id, title: audit.title, score: audit.score }));
    if (items.length) result[category] = items;
  }
  return result;
}

// Static server that pre-compresses every served file (Brotli + gzip) once at
// startup, so response latency during the audit is not skewed by compression
// work, and negotiates the encoding per request the way a CDN does. Source maps
// are skipped (never fetched during an audit). Missing files 404 — including
// /favicon.ico, which no build ships, exactly as in production.
function startServer(dir) {
  const root = normalize(dir);
  const cache = new Map(); // absolute path -> { type, raw, gzip, br }
  const brotli = buf =>
    brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } });

  const warm = directory => {
    for (const name of readdirSync(directory)) {
      const filePath = join(directory, name);
      if (statSync(filePath).isDirectory()) warm(filePath);
      else if (extname(filePath) !== '.map') {
        const raw = readFileSync(filePath);
        cache.set(filePath, {
          type: MIME[extname(filePath)] ?? 'application/octet-stream',
          raw,
          gzip: gzipSync(raw),
          br: brotli(raw),
        });
      }
    }
  };
  warm(root);

  const server = createServer((req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/' || extname(pathname) === '') pathname = '/index.html';
    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      res.statusCode = 403;
      return res.end('forbidden');
    }
    const entry = cache.get(filePath);
    if (!entry) {
      res.statusCode = 404;
      return res.end('not found');
    }
    res.setHeader('content-type', entry.type);
    // Hashed assets are immutable and long-lived; everything else (index.html)
    // is revalidated. Mirrors the repo's Cloudflare _headers so the cache audits
    // score the way production does.
    res.setHeader(
      'cache-control',
      pathname.startsWith(`/assets/`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    const accept = req.headers['accept-encoding'] ?? '';
    if (/\bbr\b/.test(accept)) {
      res.setHeader('content-encoding', 'br');
      return res.end(entry.br);
    }
    if (/\bgzip\b/.test(accept)) {
      res.setHeader('content-encoding', 'gzip');
      return res.end(entry.gzip);
    }
    return res.end(entry.raw);
  });

  return new Promise(resolve => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({
        url: `http://localhost:${port}/`,
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

// Lighthouse and chrome-launcher are installed on demand (`npm run lighthouse:install`,
// or the CI step) rather than tracked as devDependencies, so `npm ci` for the app stays
// lean and their large dependency tree is not pulled into the test/build jobs. Load them
// lazily: `gate` (which only reads the summary) needs neither, and a missing install
// yields a clear message instead of a module-resolution stack trace.
let lighthouse;
let launchChrome;

async function ensureLighthouse() {
  if (lighthouse) return;
  try {
    ({ default: lighthouse } = await import('lighthouse'));
    ({ launch: launchChrome } = await import('chrome-launcher'));
  } catch {
    console.error('Lighthouse is not installed. Run `npm run lighthouse:install` first.');
    process.exit(1);
  }
}

// Launch Chrome, run Lighthouse once, always kill Chrome (swallowing the
// Windows-only temp-dir cleanup EPERM so a local run still returns its result).
async function runOnce(url, onlyCategories) {
  const chrome = await launchChrome({
    chromeFlags: CHROME_FLAGS,
    chromePath: process.env.CHROME_PATH || undefined,
  });
  try {
    const flags = { port: chrome.port, output: 'html', logLevel: 'error' };
    if (onlyCategories) flags.onlyCategories = onlyCategories;
    const config = FORM_FACTOR === 'desktop' ? DESKTOP_CONFIG : undefined;
    return await lighthouse(url, flags, config);
  } finally {
    try {
      // kill() is synchronous in chrome-launcher; the try/catch swallows the
      // Windows-only temp-dir cleanup EPERM so a local run still returns.
      chrome.kill();
    } catch {
      /* harmless */
    }
  }
}

// Audit `url` RUNS times; return the per-category median scores plus the HTML
// report and imperfect audits of the run whose performance is the median (the
// representative run).
async function auditAllCategories(url) {
  // Discard one warmup audit. The first audit on a runner is consistently and
  // substantially pessimistic — measured on GitHub-hosted runners as performance
  // 64-69 against 88-89 for every run after it, across three identical runs of
  // the same commit — because the first Chrome launch pages in the binary and
  // warms the OS file cache. The median mostly hides it, but it still drags the
  // metrics, which are the numbers worth trusting.
  console.log('  warmup run (discarded) …');
  await runOnce(url);

  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const rc = await runOnce(url);
    const scores = Object.fromEntries(CATEGORIES.map(c => [c, rc.lhr.categories[c].score]));
    runs.push({ scores, report: rc.report, lhr: rc.lhr });
    console.log(
      `  run ${i + 1}/${RUNS}: ${CATEGORIES.map(c => `${c}=${pct(scores[c])}`).join('  ')}`,
    );
  }
  const categories = Object.fromEntries(
    CATEGORIES.map(c => [c, median(runs.map(r => r.scores[c]))]),
  );
  const repPerf = median(runs.map(r => r.scores.performance));
  const representative = runs.find(r => r.scores.performance === repPerf) ?? runs.at(-1);
  return {
    categories,
    metrics: collectMetrics(runs),
    report: representative.report,
    imperfectAudits: collectImperfectAudits(representative.lhr),
  };
}

async function cmdLocal() {
  if (!existsSync(DIST_DIR)) {
    console.error(`No ${DIST_DIR}/ found. Run \`npm run build\` first.`);
    process.exit(1);
  }
  await ensureLighthouse();
  await mkdir(OUT_DIR, { recursive: true });
  const server = await startServer(DIST_DIR);
  console.log(`Auditing ${server.url} — ${FORM_FACTOR}, ${RUNS} run(s)`);
  let result;
  try {
    result = await auditAllCategories(server.url);
  } finally {
    await server.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    formFactor: FORM_FACTOR,
    runs: RUNS,
    budgets: BUDGETS,
    local: {
      categories: result.categories,
      metrics: result.metrics,
      imperfectAudits: result.imperfectAudits,
    },
  };
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(REPORT_PATH, result.report);
  console.log('\nMedian category scores:');
  for (const c of CATEGORIES) {
    console.log(`  ${CATEGORY_LABELS[c].padEnd(16)} ${pct(result.categories[c])}`);
  }
  console.log(`\nWrote ${SUMMARY_PATH} and ${REPORT_PATH}`);
}

function cmdGate() {
  let summary;
  try {
    summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
  } catch (error) {
    console.error(`Cannot read ${SUMMARY_PATH}: ${error.message}`);
    process.exit(1);
  }
  const scores = summary.local?.categories ?? {};
  const failures = [];
  for (const [category, budget] of Object.entries(BUDGETS)) {
    if (budget.level !== 'error') continue;
    const score = scores[category];
    if (score == null) {
      console.warn(`No score for ${category}; skipping.`);
      continue;
    }
    const label = `${CATEGORY_LABELS[category]} ${pct(score)} (floor ${pct(budget.minScore)})`;
    if (score < budget.minScore) failures.push(label);
    else console.log(`  ok  ${label}`);
  }
  if (failures.length) {
    console.error('\nLighthouse gate FAILED:');
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(1);
  }
  console.log('\nLighthouse gate passed.');
}

// Pull the per-commit "Commit Preview URL" (falling back to the branch URL) out
// of the Cloudflare bot's PR comment.
function extractPreviewUrl(body) {
  const commit = body.match(/href=['"]([^'"]*workers\.dev[^'"]*)['"]>\s*Commit Preview URL/i);
  if (commit) return commit[1];
  const branch = body.match(/href=['"]([^'"]*workers\.dev[^'"]*)['"]>\s*Branch Preview URL/i);
  if (branch) return branch[1];
  const any = body.match(/https:\/\/[a-z0-9-]+\.workers\.dev\b/i);
  return any ? any[0] : null;
}

// Poll the PR's comments until Cloudflare reports a successful deployment of the
// PR's head commit, then return its preview URL. Returns null on timeout.
async function resolvePreviewUrl({ repo, prNumber, headSha, token }) {
  const base = `https://api.github.com/repos/${repo}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const shaPrefix = headSha.slice(0, 8);
  const deadline = Date.now() + 8 * 60 * 1000; // 8 min

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/issues/${prNumber}/comments?per_page=100`, { headers });
      if (res.ok) {
        const comments = await res.json();
        const cloudflare = comments.find(
          c => c.user?.login === 'cloudflare-workers-and-pages[bot]',
        );
        const body = cloudflare?.body ?? '';
        if (/Deployment successful/i.test(body) && body.includes(shaPrefix)) {
          const url = extractPreviewUrl(body);
          if (url) return url;
        }
        console.log(`  waiting for Cloudflare preview of ${shaPrefix} …`);
      }
    } catch (error) {
      console.log(`  poll error (${error.message}); retrying`);
    }
    await sleep(15 * 1000);
  }
  return null;
}

async function cmdPreview() {
  if (!PREVIEW_PERF) {
    console.log('Preview perf disabled in lighthouse-budget.js; skipping.');
    return;
  }
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const headSha = process.env.HEAD_SHA;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !prNumber || !headSha) {
    console.log('Preview perf: no pull-request context; skipping.');
    return;
  }

  const url = await resolvePreviewUrl({ repo, prNumber, headSha, token });
  if (!url) {
    console.log('Preview perf: no ready Cloudflare preview found within the timeout; skipping.');
    return;
  }

  await ensureLighthouse();
  console.log(`Preview perf: auditing ${url} — ${FORM_FACTOR}, ${RUNS} run(s)`);
  try {
    const scores = [];
    for (let i = 0; i < RUNS; i++) {
      const rc = await runOnce(url, ['performance']);
      const score = rc.lhr.categories.performance.score;
      scores.push(score);
      console.log(`  run ${i + 1}/${RUNS}: performance=${pct(score)}`);
    }
    const performance = median(scores);
    let summary = {};
    try {
      summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
    } catch {
      /* summary may not exist if the local step was skipped; start fresh */
    }
    summary.preview = { url, performance, runs: RUNS };
    await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`Preview perf: performance=${pct(performance)} (median of ${RUNS}).`);
  } catch (error) {
    console.warn(`Preview perf: audit failed (${error.message}); skipping.`);
  }
}

// Module-script srcs of an HTML document — the same build fingerprint the
// stale-build boot probe in index.html uses. Two documents with equal srcs were
// produced by the same build.
const moduleSrcs = html =>
  [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)].map(m => m[1]).join('\n');

// Wait (up to 5 min) until PROD_URL serves the same build as the local dist/,
// so the audit measures this commit's deploy rather than the previous one.
// Returns whether they matched; the audit proceeds either way.
async function waitForDeployedBuild(url) {
  let local;
  try {
    local = moduleSrcs(readFileSync(join(DIST_DIR, 'index.html'), 'utf8'));
  } catch {
    return false; // no local build to compare against; audit whatever is live
  }
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok && moduleSrcs(await res.text()) === local) return true;
    } catch {
      /* transient network error; retry until the deadline */
    }
    console.log('  waiting for the production deploy to serve this build …');
    await sleep(15 * 1000);
  }
  return false;
}

async function cmdProduction() {
  await ensureLighthouse();
  const deployedMatch = await waitForDeployedBuild(PROD_URL);
  if (!deployedMatch) {
    console.warn('Production is not serving this build yet; auditing what is live.');
  }
  console.log(`Production: auditing ${PROD_URL} — ${FORM_FACTOR}, ${RUNS} run(s)`);
  try {
    const result = await auditAllCategories(PROD_URL);
    let summary = {};
    try {
      summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
    } catch {
      /* summary may not exist if the local step was skipped; start fresh */
    }
    summary.production = {
      url: PROD_URL,
      deployedMatch,
      runs: RUNS,
      categories: result.categories,
      metrics: result.metrics,
      imperfectAudits: result.imperfectAudits,
    };
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(PRODUCTION_REPORT_PATH, result.report);
    console.log('\nProduction median category scores:');
    for (const c of CATEGORIES) {
      console.log(`  ${CATEGORY_LABELS[c].padEnd(16)} ${pct(result.categories[c])}`);
    }
  } catch (error) {
    console.warn(`Production audit failed (${error.message}); skipping.`);
  }
}

const command = process.argv[2] ?? 'local';
if (command === 'local') await cmdLocal();
else if (command === 'gate') cmdGate();
else if (command === 'preview') await cmdPreview();
else if (command === 'production') await cmdProduction();
else {
  console.error(`Unknown command "${command}". Use: local | gate | preview | production`);
  process.exit(1);
}
