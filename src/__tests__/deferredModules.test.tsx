// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type ComponentModule = { default: () => ReactNode };
type InputModalsModule = {
  AdditionalDeductionsModal: () => ReactNode;
  DependentsModal: () => ReactNode;
  IncomeDetailsModal: () => ReactNode;
};

// Dynamic imports in Vitest settle on macrotask ticks; flush via an un-faked MessageChannel task.
const flushImports = () =>
  new Promise<void>(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(undefined);
  });

describe('deferredModules', () => {
  let resultsGate: ReturnType<typeof deferred<ComponentModule>>;
  let chartGate: ReturnType<typeof deferred<ComponentModule>>;
  let inputModalsGate: ReturnType<typeof deferred<InputModalsModule>>;
  let changelogGate: ReturnType<typeof deferred<ComponentModule>>;

  let resultsLoader: Mock<() => Promise<ComponentModule>>;
  let chartLoader: Mock<() => Promise<ComponentModule>>;
  let inputModalsLoader: Mock<() => Promise<InputModalsModule>>;
  let changelogLoader: Mock<() => Promise<ComponentModule>>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    window.location.hash = '';

    resultsGate = deferred();
    chartGate = deferred();
    inputModalsGate = deferred();
    changelogGate = deferred();

    resultsLoader = vi.fn(() => resultsGate.promise);
    chartLoader = vi.fn(() => chartGate.promise);
    inputModalsLoader = vi.fn(() => inputModalsGate.promise);
    changelogLoader = vi.fn(() => changelogGate.promise);

    vi.doMock('../components/TakeHomeCalculator/TakeHomeResults', () => resultsLoader());
    vi.doMock('../components/TakeHomeCalculator/TakeHomeChart', () => chartLoader());
    vi.doMock('../components/TakeHomeCalculator/inputModals', () => inputModalsLoader());
    vi.doMock('../components/ChangelogModal', () => changelogLoader());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  it('loads results, then chart, then input modals in one chunk, then changelog after idle', async () => {
    const mod = await import('../utils/deferredModules');

    mod.startDeferredLoads();
    await flushImports();

    expect(resultsLoader).toHaveBeenCalledTimes(1);
    expect(chartLoader).not.toHaveBeenCalled();
    expect(inputModalsLoader).not.toHaveBeenCalled();
    expect(changelogLoader).not.toHaveBeenCalled();

    resultsGate.resolve({ default: () => null });
    await flushImports();

    expect(chartLoader).toHaveBeenCalledTimes(1);
    expect(inputModalsLoader).not.toHaveBeenCalled();
    expect(changelogLoader).not.toHaveBeenCalled();

    chartGate.resolve({ default: () => null });
    await flushImports();

    expect(inputModalsLoader).toHaveBeenCalledTimes(1);
    expect(changelogLoader).not.toHaveBeenCalled();

    inputModalsGate.resolve({
      AdditionalDeductionsModal: () => null,
      DependentsModal: () => null,
      IncomeDetailsModal: () => null,
    });
    await flushImports();
    expect(changelogLoader).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    await flushImports();

    expect(changelogLoader).toHaveBeenCalledTimes(1);
  });

  it('continues loading later waves even if earlier waves reject', async () => {
    const mod = await import('../utils/deferredModules');

    mod.startDeferredLoads();
    await flushImports();

    resultsGate.reject(new Error('results failed'));
    await flushImports();
    expect(chartLoader).toHaveBeenCalledTimes(1);

    chartGate.reject(new Error('chart failed'));
    await flushImports();
    expect(inputModalsLoader).toHaveBeenCalledTimes(1);
  });

  it('starts input modals immediately on request even before results or chart settle', async () => {
    const mod = await import('../utils/deferredModules');

    mod.startDeferredLoads();
    await flushImports();
    expect(inputModalsLoader).not.toHaveBeenCalled();

    mod.requestInputModals();
    await flushImports();

    expect(inputModalsLoader).toHaveBeenCalledTimes(1);
    expect(chartLoader).not.toHaveBeenCalled();
  });

  it('loads input modals on demand without starting results or chart', async () => {
    const mod = await import('../utils/deferredModules');
    const modals = await import('../components/deferredModals');
    inputModalsGate.resolve({
      AdditionalDeductionsModal: () => null,
      DependentsModal: () => <div data-testid="dependents-loaded" />,
      IncomeDetailsModal: () => null,
    });

    mod.requestInputModals();
    render(
      <modals.DependentsModal
        open
        onClose={() => {}}
        dependents={[]}
        onDependentsChange={() => {}}
        taxpayerNetIncome={0}
        incomeYear={2026}
        healthInsuranceProvider="KyokaiKenpo"
        taxpayerAgeRange="age20to39"
        onNHIPaymentAttributionChange={() => {}}
        region="Tokyo"
        onNHIHouseholdRegionChange={() => {}}
      />,
    );
    await act(async () => {
      await flushImports();
    });

    expect(inputModalsLoader).toHaveBeenCalledTimes(1);
    expect(resultsLoader).not.toHaveBeenCalled();
    expect(chartLoader).not.toHaveBeenCalled();
    expect(screen.getByTestId('dependents-loaded')).toBeInTheDocument();
  });

  it('renders an already-loaded modal synchronously without flashing a loading dialog', async () => {
    const mod = await import('../utils/deferredModules');
    const modals = await import('../components/deferredModals');
    mod.requestInputModals();
    inputModalsGate.resolve({
      AdditionalDeductionsModal: () => null,
      DependentsModal: () => <div data-testid="dependents-loaded" />,
      IncomeDetailsModal: () => null,
    });
    await flushImports();

    render(
      <modals.DependentsModal
        open
        onClose={() => {}}
        dependents={[]}
        onDependentsChange={() => {}}
        taxpayerNetIncome={0}
        incomeYear={2026}
        healthInsuranceProvider="KyokaiKenpo"
        taxpayerAgeRange="age20to39"
        onNHIPaymentAttributionChange={() => {}}
        region="Tokyo"
        onNHIHouseholdRegionChange={() => {}}
      />,
    );

    expect(screen.getByTestId('dependents-loaded')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading dependents dialog')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.queryByLabelText('Loading dependents dialog')).not.toBeInTheDocument();
  });

  it('swaps in fast-arriving modals before the 150 ms spinner delay without showing the spinner', async () => {
    const mod = await import('../utils/deferredModules');
    const modals = await import('../components/deferredModals');
    mod.requestInputModals();

    render(
      <modals.DependentsModal
        open
        onClose={() => {}}
        dependents={[]}
        onDependentsChange={() => {}}
        taxpayerNetIncome={0}
        incomeYear={2026}
        healthInsuranceProvider="KyokaiKenpo"
        taxpayerAgeRange="age20to39"
        onNHIPaymentAttributionChange={() => {}}
        region="Tokyo"
        onNHIHouseholdRegionChange={() => {}}
      />,
    );

    expect(screen.queryByLabelText('Loading dependents dialog')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.queryByLabelText('Loading dependents dialog')).not.toBeInTheDocument();

    inputModalsGate.resolve({
      AdditionalDeductionsModal: () => null,
      DependentsModal: () => <div data-testid="dependents-loaded" />,
      IncomeDetailsModal: () => null,
    });
    await act(async () => {
      await flushImports();
    });

    expect(screen.getByTestId('dependents-loaded')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading dependents dialog')).not.toBeInTheDocument();
  });

  it('shows the spinner at 150 ms while waiting and swaps cleanly once the modal resolves', async () => {
    const mod = await import('../utils/deferredModules');
    const modals = await import('../components/deferredModals');
    mod.requestInputModals();

    render(
      <modals.DependentsModal
        open
        onClose={() => {}}
        dependents={[]}
        onDependentsChange={() => {}}
        taxpayerNetIncome={0}
        incomeYear={2026}
        healthInsuranceProvider="KyokaiKenpo"
        taxpayerAgeRange="age20to39"
        onNHIPaymentAttributionChange={() => {}}
        region="Tokyo"
        onNHIHouseholdRegionChange={() => {}}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(screen.getByLabelText('Loading dependents dialog')).toBeInTheDocument();

    inputModalsGate.resolve({
      AdditionalDeductionsModal: () => null,
      DependentsModal: () => <div data-testid="dependents-loaded" />,
      IncomeDetailsModal: () => null,
    });
    await act(async () => {
      await flushImports();
    });

    expect(screen.queryByLabelText('Loading dependents dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('dependents-loaded')).toBeInTheDocument();
  });

  it('retries loading input modals on a subsequent open after a fetch failure', async () => {
    const mod = await import('../utils/deferredModules');
    const modals = await import('../components/deferredModals');

    mod.requestInputModals();
    await flushImports();
    expect(inputModalsLoader).toHaveBeenCalledTimes(1);

    inputModalsGate.reject(new Error('network error'));
    await flushImports();

    const retryGate = deferred<InputModalsModule>();
    inputModalsLoader.mockImplementationOnce(() => retryGate.promise);

    render(
      <modals.DependentsModal
        open
        onClose={() => {}}
        dependents={[]}
        onDependentsChange={() => {}}
        taxpayerNetIncome={0}
        incomeYear={2026}
        healthInsuranceProvider="KyokaiKenpo"
        taxpayerAgeRange="age20to39"
        onNHIPaymentAttributionChange={() => {}}
        region="Tokyo"
        onNHIHouseholdRegionChange={() => {}}
      />,
    );
    await flushImports();
    expect(inputModalsLoader).toHaveBeenCalledTimes(2);

    retryGate.resolve({
      AdditionalDeductionsModal: () => null,
      DependentsModal: () => <div data-testid="dependents-loaded" />,
      IncomeDetailsModal: () => null,
    });
    await act(async () => {
      await flushImports();
    });

    expect(screen.getByTestId('dependents-loaded')).toBeInTheDocument();
  });

  it('renders an already-loaded ChangelogModal synchronously without loading UI', async () => {
    const mod = await import('../utils/deferredModules');
    const modals = await import('../components/deferredModals');
    mod.requestChangelogModal();
    changelogGate.resolve({ default: () => <div data-testid="changelog-loaded" /> });
    await flushImports();

    render(<modals.ChangelogModal open onClose={() => {}} onViewed={() => {}} />);

    expect(screen.getByTestId('changelog-loaded')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading changelog')).not.toBeInTheDocument();
  });
});
