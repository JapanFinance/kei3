// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useReportingPlans,
  type UseReportingPlansOptions,
} from '../components/TakeHomeCalculator/Income/useReportingPlans';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import {
  EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  type IncomeStream,
  type TakeHomeInputs,
  type WithholdingAccountIncomeStream,
} from '../types/tax';
import { countPlans, deriveReportingUnits, samePlan } from '../utils/reportingPlanner';

const account = (
  overrides: Partial<WithholdingAccountIncomeStream> & Pick<WithholdingAccountIncomeStream, 'id'>,
): WithholdingAccountIncomeStream => ({
  type: 'withholdingAccount',
  capitalGains: 0,
  dividends: 0,
  reportsCapitalGains: false,
  reportsDividends: false,
  ...overrides,
});

const salaryInputs = (streams: IncomeStream[]): TakeHomeInputs => ({
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [
    { id: 'salary', type: 'salary', amount: 5_000_000, frequency: 'annual' },
    ...streams,
  ],
  ageRange: 'age20to39',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2026,
});

// One domestic dividend: 2 states, doubled only when reported → 3 total plans (7.3.1).
const smallInputs = salaryInputs([
  {
    id: 'd',
    type: 'dividends',
    shareType: 'listed',
    paymentChannel: 'domestic',
    isReported: false,
    amount: 300_000,
  },
]);

// Three independent gain-only accounts (no dividends, so the election never applies): 2 states
// each → 8 total plans, giving several yield points to interrupt with `chunkMs: 0`.
const severalUnitsInputs = salaryInputs([
  account({ id: 'a', capitalGains: 200_000 }),
  account({ id: 'b', capitalGains: 300_000 }),
  account({ id: 'c', capitalGains: 400_000 }),
]);

// A single account, structurally different from severalUnitsInputs (fewer units, different
// amount), so its best plan is easy to tell apart from a mixed-up computation.
const otherInputs = salaryInputs([account({ id: 'x', capitalGains: 900_000 })]);

const renderPlans = (
  inputs: TakeHomeInputs,
  expanded: boolean,
  options?: UseReportingPlansOptions,
) =>
  renderHook(
    (props: { inputs: TakeHomeInputs; expanded: boolean }) =>
      useReportingPlans(props.inputs, props.expanded, options),
    { initialProps: { inputs, expanded } },
  );

describe('useReportingPlans', () => {
  beforeEach(() => {
    // Only setTimeout/clearTimeout are faked: the hook's chunk timing reads performance.now(),
    // which vitest's default fake-timer set otherwise freezes at 0, making every predicted
    // duration compute as zero regardless of the fixture's actual size.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows each distinct plan once, naming it for the uniform plan it equals and tagging its roles', async () => {
    // Three gain-only accounts, all withheld: Current is the withheld-only plan, so the two share
    // one row, and whichever plan is best is tagged rather than repeated.
    const { result } = renderPlans(severalUnitsInputs, true, { chunkMs: 0 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    const rows = result.current.rows!;
    const units = deriveReportingUnits(severalUnitsInputs.incomeStreams);

    rows.forEach((row, i) =>
      rows.slice(i + 1).forEach(other => {
        expect(samePlan(units, row.evaluated, other.evaluated)).toBe(false);
      }),
    );
    expect(rows.filter(row => row.roles.includes('current'))).toHaveLength(1);
    expect(rows.filter(row => row.roles.includes('best'))).toHaveLength(1);
    const currentRow = rows.find(row => row.roles.includes('current'))!;
    expect(currentRow.key).toBe('withheldOnly');
    expect(currentRow.label).toBe('All withheld only');
    expect(currentRow.canApply).toBe(false);
    expect(rows.filter(row => row.canApply)).toHaveLength(rows.length - 1);
  });

  it('does nothing until expanded', () => {
    const { result } = renderPlans(smallInputs, false);
    expect(result.current.rows).toBeUndefined();
    expect(result.current.bestPlan).toBeUndefined();
  });

  it('runs the exhaustive search to completion and then drops the progress bar', async () => {
    const { result } = renderPlans(smallInputs, true, { chunkMs: 0, progressThresholdMs: -1 });
    // With chunkMs 0 the search yields after its first plan, so the first render already shows
    // that one step of three.
    expect(result.current.showProgress).toBe(true);
    expect(result.current.progress).toEqual({ done: 1, count: 3 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(result.current.bounded).toBe(false);
    expect(result.current.rows).toBeDefined();
    // The Best row is final, so nothing is left to show progress for.
    expect(result.current.showProgress).toBe(false);
    expect(result.current.progress).toBeUndefined();
  });

  it('falls back to a bounded search once the first chunk predicts an overrun', async () => {
    const { result } = renderPlans(severalUnitsInputs, true, {
      budgetMs: -1,
      chunkMs: 0,
      predictAfterMs: 0,
    });

    // Nothing is decided before the first chunk has run.
    expect(result.current.bounded).toBe(false);
    expect(result.current.rows?.some(row => row.roles.includes('best'))).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current.bounded).toBe(true);
    expect(result.current.boundedEstimate?.count).toBe(
      result.current.rows ? countPlans(deriveReportingUnits(severalUnitsInputs.incomeStreams)) : 0,
    );
    expect(result.current.rows?.some(row => row.roles.includes('best'))).toBe(true);
    // The search still only ever shows exact engine results.
    expect(result.current.rows).toBeDefined();
  });

  it('shows progress only once the search has run longer than the threshold', async () => {
    const forced = renderPlans(smallInputs, true, { chunkMs: 0, progressThresholdMs: -1 });
    expect(forced.result.current.showProgress).toBe(true);
    expect(forced.result.current.progress).toBeDefined();

    const suppressed = renderPlans(smallInputs, true, {
      chunkMs: 0,
      progressThresholdMs: 1_000_000_000,
    });
    expect(suppressed.result.current.showProgress).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(suppressed.result.current.showProgress).toBe(false);
    expect(suppressed.result.current.progress).toBeUndefined();
  });

  it('never writes a stale Best after the inputs change mid-search', async () => {
    const { result, rerender } = renderPlans(severalUnitsInputs, true, {
      chunkMs: 0,
      progressThresholdMs: -1,
    });

    // Let the first search take exactly one step, confirming it is genuinely mid-flight.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.progress?.done).toBeGreaterThan(0);
    expect(result.current.progress?.done ?? 0).toBeLessThan(result.current.progress?.count ?? 0);

    // Switch to a structurally different input before that search would have finished.
    rerender({ inputs: otherInputs, expanded: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100_000);
    });

    // A hook computing otherInputs from a clean start must reach exactly the same answer;
    // any contamination from the abandoned search would show up as a mismatch here.
    const fresh = renderPlans(otherInputs, true, { chunkMs: 0, progressThresholdMs: -1 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100_000);
    });

    expect(result.current.progress).toEqual(fresh.result.current.progress);
    expect(result.current.bestPlan?.figures).toEqual(fresh.result.current.bestPlan?.figures);
    expect(result.current.rows?.map(row => row.label)).toEqual(
      fresh.result.current.rows?.map(row => row.label),
    );
  });

  it('aborts the search when the panel collapses, never finishing it in the background', async () => {
    const { result, rerender } = renderPlans(severalUnitsInputs, true, {
      chunkMs: 0,
      progressThresholdMs: -1,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.progress?.done ?? 0).toBeLessThan(result.current.progress?.count ?? 0);

    rerender({ inputs: severalUnitsInputs, expanded: false });
    expect(result.current.rows).toBeUndefined();

    // Whatever was in flight must not keep running: advancing time as far as a completed
    // search would need must not silently finish it in the background.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100_000);
    });
    expect(result.current.rows).toBeUndefined();

    // Re-expanding must recompute from scratch and reach the same answer as a clean render,
    // rather than resuming (or being corrupted by) whatever the aborted search left behind.
    rerender({ inputs: severalUnitsInputs, expanded: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100_000);
    });
    const fresh = renderPlans(severalUnitsInputs, true, { chunkMs: 0, progressThresholdMs: -1 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100_000);
    });

    expect(result.current.progress).toEqual(fresh.result.current.progress);
    expect(result.current.bestPlan?.figures).toEqual(fresh.result.current.bestPlan?.figures);
  });
});
