// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Self-hosted bundle-size tooling — replaces size-limit with Node's built-in
// zlib. Used by CI (.github/workflows/deploy.yml) and locally via `npm run size`
// after `npm run build`.
//
// Modes (first CLI arg):
//   measure
//     Read dist/assets, compute per-file Brotli sizes, group the assets into
//     load waves (see computeWaves), write size-report.json, append the tables
//     to the job summary ($GITHUB_STEP_SUMMARY), and exit non-zero if the total
//     exceeds the budget — this is the CI gate.
//   comment <headReport> [baseReport]
//     Upsert the sticky PR comment from a report JSON. Given a base report (the
//     PR's base commit, restored from the Actions cache) it also shows the
//     per-chunk and per-wave deltas.
//
// The per-file table answers how many bytes exist; the wave table answers when
// they are fetched, which is where moving code off the path that gates the app
// render shows up. A base report written before waves existed still renders,
// without the wave deltas.
//
// Brotli approximates what Cloudflare serves modern browsers; it is a relative
// regression tripwire, not the exact transfer size (Cloudflare compresses at a
// lower quality). Node's default (max-quality) Brotli matches size-limit's
// figure to the byte.

import { appendFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

const ASSETS_DIR = 'dist/assets';
const INDEX_HTML = 'dist/index.html';
const REPORT_PATH = 'size-report.json';
const MARKER = '<!-- size-limit-report -->';
// Adjust this in the same change that expectedly changes the size.
const BUDGET_BYTES = 279_200;

const kb = bytes => `${(bytes / 1000).toFixed(1)} kB`;
// Drop Vite's "-<8-char hash>" so a chunk is comparable across commits.
const chunkName = file => file.replace(/-[\w-]{8}(\.\w+)$/, '$1');

// The module entry index.html executes, and the assets it has the browser fetch
// alongside it: modulepreloaded chunks and the render-blocking stylesheet.
const HTML_ENTRY = /<script[^>]*\btype="module"[^>]*\bsrc="\/assets\/([^"]+)"/g;
const HTML_ASSET_LINK =
  /<link[^>]*\brel="(?:modulepreload|stylesheet)"[^>]*\bhref="\/assets\/([^"]+)"/g;

// Chunk-to-chunk references in the emitted JS. `import(...)` is a call, so the
// optional "(" distinguishes a dynamic import from a static one without relying
// on the quote style rolldown happens to emit (backticks for dynamic, double
// quotes for static).
const CHUNK_IMPORT = /\b(?:from|import)\s*(\()?\s*(["'`])\.\/([^"'`]+)\2/g;

function importsOf(source) {
  const staticImports = new Set();
  const dynamicImports = [];
  for (const [, call, , file] of source.matchAll(CHUNK_IMPORT)) {
    const name = chunkName(file);
    if (!call) staticImports.add(name);
    else if (!dynamicImports.includes(name)) dynamicImports.push(name);
  }
  return { staticImports, dynamicImports };
}

/**
 * Groups the built assets into the waves the browser fetches them in.
 *
 * A wave is the set of assets requested concurrently at one stage of startup:
 * an entry point plus everything it statically imports, transitively. A static
 * import is a hard barrier — a chunk cannot finish evaluating until its static
 * imports have been fetched and evaluated — whereas a dynamic import is what
 * opens the *next* wave, so the closure follows static edges only. Wave 1
 * starts at index.html (its module script, modulepreloads and render-blocking
 * stylesheet) and gates first paint; every later wave starts at one dynamic
 * import found in an earlier wave. Assets an earlier wave already fetched are
 * excluded, so each wave counts only the bytes that stage newly costs and the
 * waves partition the measured total.
 *
 * Waves are ordered by discovery, which is the order the chunks emit their
 * dynamic imports rather than an observed request order.
 *
 * Chunks are keyed by {@link chunkName}, both so wave membership is comparable
 * across commits and because that is what makes the graph independent of
 * `build.chunkImportMap`: with it enabled a chunk imports a stable id that an
 * import map resolves to the hashed filename, and only the hash differs.
 *
 * @param files - Asset filenames in {@link ASSETS_DIR}, still hashed
 * @param sizes - Brotli size by chunk name; also the set of known chunks, so a
 *   string literal that looks like a specifier cannot enter the graph
 * @returns Waves in load order, and any assets no wave reaches
 */
function computeWaves(files, sizes) {
  const html = readFileSync(INDEX_HTML, 'utf8');
  const graph = new Map(
    files
      .filter(f => f.endsWith('.js'))
      .map(f => [chunkName(f), importsOf(readFileSync(join(ASSETS_DIR, f), 'utf8'))]),
  );

  const known = name => sizes.has(name);
  const seen = new Set();
  const waves = [];
  const queue = [
    {
      entry: 'index.html',
      seeds: [...html.matchAll(HTML_ENTRY), ...html.matchAll(HTML_ASSET_LINK)]
        .map(match => chunkName(match[1]))
        .filter(known),
    },
  ];

  for (const { entry, seeds } of queue) {
    const chunks = [];
    const opened = [];
    for (const name of seeds) {
      if (seen.has(name)) continue;
      seen.add(name);
      chunks.push(name);
      const edges = graph.get(name);
      if (!edges) continue;
      // Both loops append to the array they iterate, which walks breadth-first:
      // `seeds` through this wave's static closure, `queue` through the waves
      // the dynamic imports found along the way open.
      seeds.push(...[...edges.staticImports].filter(known));
      opened.push(...edges.dynamicImports.filter(known));
    }
    for (const name of opened) {
      if (!seen.has(name) && !queue.some(wave => wave.entry === name)) {
        queue.push({ entry: name, seeds: [name] });
      }
    }
    // A dynamic import of a chunk an earlier wave already fetched opens no wave.
    if (chunks.length > 0) {
      const size = chunks.reduce((sum, name) => sum + sizes.get(name), 0);
      waves.push({ entry, size, requests: chunks.length, chunks });
    }
  }

  return { waves, unreached: [...sizes.keys()].filter(name => !seen.has(name)) };
}

function measure() {
  const files = readdirSync(ASSETS_DIR).filter(f => /\.(js|css)$/.test(f));
  const entries = files
    .map(f => ({
      name: chunkName(f),
      size: brotliCompressSync(readFileSync(join(ASSETS_DIR, f))).length,
    }))
    .sort((a, b) => b.size - a.size);
  const total = entries.reduce((sum, e) => sum + e.size, 0);
  const sizes = new Map(entries.map(e => [e.name, e.size]));

  let waves;
  try {
    waves = computeWaves(files, sizes);
  } catch (error) {
    // The budget gate reads the total, so a broken wave walk must not fail the
    // build; the report simply omits the section.
    console.warn(`Skipped load-wave breakdown: ${error.message}`);
  }
  return { total, budget: BUDGET_BYTES, files: entries, ...waves };
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

// Chunks a wave gained or lost relative to the base, so a chunk moving between
// waves — the reason this breakdown exists — is visible without diffing lists.
function renderChunks(chunks, baseChunks) {
  const marked = chunks.map(name =>
    baseChunks && !baseChunks.includes(name) ? `**\`${name}\`**` : `\`${name}\``,
  );
  const dropped = (baseChunks ?? []).filter(name => !chunks.includes(name));
  return [...marked, ...dropped.map(name => `~~\`${name}\`~~`)].join(', ');
}

function renderWaves(report, base) {
  const baseWaves = new Map((base?.waves ?? []).map(w => [w.entry, w]));
  const withDelta = baseWaves.size > 0;

  const rows = report.waves.map((wave, index) => {
    const previous = baseWaves.get(wave.entry);
    const cells = [`**${index + 1}** \`${wave.entry}\``, kb(wave.size)];
    if (withDelta) cells.push(deltaText(previous?.size, wave.size));
    const requestDelta = wave.requests - (previous?.requests ?? wave.requests);
    const requestSign = requestDelta > 0 ? '+' : '';
    cells.push(
      requestDelta === 0 ? `${wave.requests}` : `${wave.requests} (${requestSign}${requestDelta})`,
    );
    cells.push(renderChunks(wave.chunks, previous?.chunks));
    return `| ${cells.join(' | ')} |`;
  });
  const headEntries = new Set(report.waves.map(w => w.entry));
  for (const wave of baseWaves.values()) {
    if (!headEntries.has(wave.entry)) {
      rows.push(`| \`${wave.entry}\` | — | -${kb(wave.size)} (removed) | — | — |`);
    }
  }

  // Rendered in the collapsed summary, where a wave that moved is the one thing
  // worth seeing without expanding.
  const chain = report.waves
    .map(wave => {
      const delta = withDelta ? deltaText(baseWaves.get(wave.entry)?.size, wave.size) : '—';
      const magnitude = (wave.size / 1000).toFixed(1);
      return delta === '—' ? magnitude : `${magnitude} (${delta.replace(' kB', '')})`;
    })
    .join(' → ');

  return [
    `<details><summary>Load waves — ${chain} kB</summary>`,
    '',
    withDelta
      ? '| Wave | Brotli | Δ vs base | Requests | Chunks |'
      : '| Wave | Brotli | Requests | Chunks |',
    withDelta ? '| --- | --: | --: | --: | --- |' : '| --- | --: | --: | --- |',
    ...rows,
    ...(report.unreached?.length
      ? ['', `⚠️ Reached by no wave: ${report.unreached.map(n => `\`${n}\``).join(', ')}`]
      : []),
    '',
    '</details>',
    '',
    `<sub>A wave is the set of assets fetched concurrently at one stage of startup: an entry point plus its transitive <em>static</em> imports, minus what an earlier wave already fetched. Wave 1 gates first paint, wave 2 gates the app render, and each later one is a lazy boundary. Derived from \`dist\`, so it is emission order rather than observed request timing.${withDelta ? ' Bold chunks are new to a wave, struck-through ones left it.' : ''}</sub>`,
  ].join('\n');
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
      if (!headNames.has(f.name)) rows.push(`| \`${f.name}\` | — | -${kb(f.size)} (removed) |`);
    }
  }

  const totalDelta = withDelta ? deltaText(base.total, report.total) : undefined;
  const totalRow = withDelta
    ? `| **Total** | **${kb(report.total)}** | **${totalDelta}** |`
    : `| **Total** | **${kb(report.total)}** |`;
  const status = report.total <= report.budget ? '✅' : '❌ over budget';
  const deltaSuffix = withDelta
    ? ` (${totalDelta === '—' ? 'no change' : `${totalDelta} vs base`})`
    : '';

  return [
    `### 📦 Bundle size — ${kb(report.total)} Brotli${deltaSuffix} / ${kb(report.budget)} budget ${status}`,
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
    ...(report.waves?.length ? [renderWaves(report, base), ''] : []),
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
