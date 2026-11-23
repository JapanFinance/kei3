// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from 'vitest';

import indexHtml from '../../index.html?raw';

const restorers: (() => void)[] = [];

const getVmWindow = (): Window & typeof globalThis => {
  const vmWindow = (globalThis as { jsdom?: { window?: Window & typeof globalThis } }).jsdom
    ?.window;
  if (!vmWindow) {
    throw new Error('Expected Vitest jsdom window');
  }
  return vmWindow;
};

const stubVmProperty = (target: object, key: PropertyKey, value: unknown) => {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
  restorers.push(() => {
    if (original) {
      Object.defineProperty(target, key, original);
    } else {
      Reflect.deleteProperty(target, key);
    }
  });
};

const extractStaleBuildProbeScript = (): string => {
  const doc = new DOMParser().parseFromString(indexHtml, 'text/html');
  const script = Array.from(doc.querySelectorAll('script:not([src])')).find(el =>
    el.textContent?.includes('stale-probe'),
  );
  if (!script?.textContent) {
    throw new Error('Could not locate stale-build probe inline script in index.html');
  }
  return script.textContent;
};

const runStaleBuildProbe = () => {
  const script = document.createElement('script');
  script.textContent = extractStaleBuildProbeScript();
  document.body.appendChild(script);
};

const appendBootedModuleScript = (src = '/assets/index-old.js') => {
  const moduleScript = document.createElement('script');
  moduleScript.type = 'module';
  moduleScript.src = src;
  document.body.appendChild(moduleScript);
};

describe('index.html stale-build probe', () => {
  afterEach(() => {
    while (restorers.length > 0) {
      restorers.pop()?.();
    }
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    getVmWindow().sessionStorage.clear();
  });

  it('requests the stale-build probe with low priority on history-style boots', async () => {
    const vmWindow = getVmWindow();
    appendBootedModuleScript();
    stubVmProperty(vmWindow.performance, 'getEntriesByType', () => [{ type: 'back_forward' }]);
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response('<script type="module" src="/assets/index-old.js"></script>', { status: 200 }),
      ),
    );
    stubVmProperty(vmWindow, 'fetch', fetchMock);

    runStaleBuildProbe();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/\?stale-probe=\d+$/), {
      cache: 'no-store',
      priority: 'low',
    });
  });

  it('skips the stale-build probe on normal navigations', () => {
    const vmWindow = getVmWindow();
    appendBootedModuleScript();
    stubVmProperty(vmWindow.performance, 'getEntriesByType', () => [{ type: 'navigate' }]);
    const fetchMock = vi.fn<typeof fetch>();
    stubVmProperty(vmWindow, 'fetch', fetchMock);

    runStaleBuildProbe();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
