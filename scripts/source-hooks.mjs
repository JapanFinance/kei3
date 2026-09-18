// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Module hooks that let Node run the app's TypeScript sources without Vite, using Node's own
// type stripping. Relative imports are written without an extension, so they are resolved to
// the .ts file here. `import.meta.env` does not exist, so it is defined here: DEV and PROD as in
// a production build, and MODE as the mode Vitest was started with (`--mode`), which Vitest
// passes to its workers as process.env.MODE. Loaded into the benchmark workers by
// vitest.bench.config.ts.

import { registerHooks } from 'node:module';
import { extname } from 'node:path';

const IMPORT_META_ENV =
  "import.meta.env = { DEV: false, PROD: true, MODE: process.env.MODE ?? 'production' };";

// Vitest appends a query string to the URL of each test file it imports.
const isTypeScript = url => url !== undefined && new URL(url).pathname.endsWith('.ts');

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (isTypeScript(context.parentURL) && specifier.startsWith('.') && !extname(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!isTypeScript(url)) return result;
    const source =
      typeof result.source === 'string' ? result.source : new TextDecoder().decode(result.source);
    if (!source.includes('import.meta.env')) return result;
    // Line 1 of every source file is the license header, so prepending there keeps the line
    // numbers in stack traces and CPU profiles matching the file.
    return { ...result, source: IMPORT_META_ENV + source };
  },
});
