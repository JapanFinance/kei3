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
// Uses only Node built-ins plus the pinned `lighthouse` and `chrome-launcher`.

import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { BUDGETS, CATEGORY_LABELS, FORM_FACTOR, PREVIEW_PERF, RUNS } from '../lighthouse-budget.js';

/* eslint-disable no-await-in-loop -- The audit runs and the Cloudflare-deploy
   poll are intentionally sequential: running Chrome audits in parallel would
   make them contend and skew the timing metrics, and the poll must pause
   between checks. */

const DIST_DIR = 'dist';
const OUT_DIR = 'lighthouse-results';
const SUMMARY_PATH = join(OUT_DIR, 'summary.json');
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

// Audit `url` RUNS times; return the per-category median scores and the HTML
// report of the run whose performance is the median (the representative run).
async function auditAllCategories(url) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const rc = await runOnce(url);
    const scores = Object.fromEntries(CATEGORIES.map(c => [c, rc.lhr.categories[c].score]));
    runs.push({ scores, report: rc.report });
    console.log(
      `  run ${i + 1}/${RUNS}: ${CATEGORIES.map(c => `${c}=${pct(scores[c])}`).join('  ')}`,
    );
  }
  const categories = Object.fromEntries(
    CATEGORIES.map(c => [c, median(runs.map(r => r.scores[c]))]),
  );
  const repPerf = median(runs.map(r => r.scores.performance));
  const representative = runs.find(r => r.scores.performance === repPerf) ?? runs.at(-1);
  return { categories, report: representative.report };
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
    local: { categories: result.categories },
  };
  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(join(OUT_DIR, 'report.html'), result.report);
  console.log('\nMedian category scores:');
  for (const c of CATEGORIES) {
    console.log(`  ${CATEGORY_LABELS[c].padEnd(16)} ${pct(result.categories[c])}`);
  }
  console.log(`\nWrote ${SUMMARY_PATH} and ${join(OUT_DIR, 'report.html')}`);
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
  const sleep = ms => new Promise(done => setTimeout(done, ms));

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

const command = process.argv[2] ?? 'local';
if (command === 'local') await cmdLocal();
else if (command === 'gate') cmdGate();
else if (command === 'preview') await cmdPreview();
else {
  console.error(`Unknown command "${command}". Use: local | gate | preview`);
  process.exit(1);
}
