// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { extractEntryScriptSrc } from '../utils/appVersion';

describe('extractEntryScriptSrc', () => {
  it('finds the hashed entry script in built index.html markup', () => {
    const html = `<!doctype html><html><head>
      <link rel="modulepreload" crossorigin href="/assets/react-CepXLKLB.js">
      <script type="module" crossorigin src="/assets/index-B_YvE-v6.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/index-t8n3YE5v.css">
      </head><body><div id="root"></div></body></html>`;
    expect(extractEntryScriptSrc(html)).toBe('/assets/index-B_YvE-v6.js');
  });

  it('finds the dev entry script served by the dev server', () => {
    const html = `<!doctype html><html><body>
      <script type="module" src="/src/main.tsx"></script>
      </body></html>`;
    expect(extractEntryScriptSrc(html)).toBe('/src/main.tsx');
  });

  it('returns null when no module script is present', () => {
    expect(extractEntryScriptSrc('<!doctype html><html><body>Not Found</body></html>')).toBeNull();
    expect(extractEntryScriptSrc('')).toBeNull();
  });

  it('ignores non-module scripts', () => {
    const html = `<script src="/legacy.js"></script>`;
    expect(extractEntryScriptSrc(html)).toBeNull();
  });
});
