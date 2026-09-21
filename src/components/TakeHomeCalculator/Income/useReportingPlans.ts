// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from 'react';

import type { TakeHomeInputs } from '../../../types/tax';
import {
  allReportedPlan,
  countPlans,
  currentPlan,
  deriveReportingUnits,
  descendFromPlan,
  describePlan,
  evaluatePlan,
  generatePlans,
  hasOptionalUnit,
  isBetterPlan,
  mandatoryReportingNote,
  planMatchesCurrent,
  withheldOnlyPlan,
  type EvaluatedPlan,
  type PlanEvaluation,
  type ReportingPlan,
} from '../../../utils/reportingPlanner';

export interface UseReportingPlansOptions {
  /** Predicted search time, in ms, an exhaustive search is allowed before descent takes over. */
  budgetMs?: number;
  /** Predicted search time, in ms, above which the Best row shows a progress bar. */
  progressThresholdMs?: number;
  /** How long, in ms, the search runs before yielding to the event loop. */
  chunkMs?: number;
}

const DEFAULT_BUDGET_MS = 2_000;
const DEFAULT_PROGRESS_THRESHOLD_MS = 150;
const DEFAULT_CHUNK_MS = 30;

export type UniformRowKey = 'withheldOnly' | 'separate' | 'aggregate';
export type ReportingRowKey = 'current' | 'best' | UniformRowKey;

export interface ReportingRow {
  key: ReportingRowKey;
  label: string;
  evaluated: EvaluatedPlan;
  /** One instruction line (7.3.4); empty when the plan has no unit left to choose. */
  instruction: string;
  /** Whether Apply should be offered for this row. */
  canApply: boolean;
}

export interface UseReportingPlansResult {
  /** Undefined until the panel has expanded and the first, synchronous results are ready. */
  rows: ReportingRow[] | undefined;
  bestPlan: EvaluatedPlan | undefined;
  /** The once-stated note for entries that always have to be reported (7.3.4). */
  mandatoryNote: string | undefined;
  progress: { done: number; count: number } | undefined;
  /** True only while an exhaustive search is predicted to take long enough to be worth showing. */
  showProgress: boolean;
  /** True once the search had to fall back to coordinate descent instead of running exhaustively. */
  bounded: boolean;
  /** Present only when `bounded`: the figures the caption reports (7.3.5). */
  boundedEstimate: { count: number; predictedMs: number } | undefined;
}

const EMPTY_RESULT: UseReportingPlansResult = {
  rows: undefined,
  bestPlan: undefined,
  mandatoryNote: undefined,
  progress: undefined,
  showProgress: false,
  bounded: false,
  boundedEstimate: undefined,
};

const UNIFORM_ROW_LABELS: Record<UniformRowKey, string> = {
  withheldOnly: 'All withheld only',
  separate: 'All reported, separate (申告分離課税)',
  aggregate: 'All reported, progressive (総合課税)',
};

/** `scheduler.yield()` where available (not in jsdom); a same-tick `setTimeout` otherwise. */
const yieldToEventLoop = (): Promise<void> => {
  const withScheduler = globalThis as { scheduler?: { yield?: () => Promise<void> } };
  return withScheduler.scheduler?.yield
    ? withScheduler.scheduler.yield()
    : new Promise(resolve => setTimeout(resolve, 0));
};

/**
 * Searches the reporting plans for the investment entries in `inputs` while `expanded` is true
 * (7.3.3): runs in an effect, never during render. Current and the uniform plans render at once
 * (at most a handful of engine runs); their wall time predicts how long every feasible plan would
 * take. Within `budgetMs` that runs exhaustively; otherwise a coordinate descent from the best
 * uniform plan bounds the search instead. Both are chunked by `chunkMs` and yield to the event
 * loop between chunks so the panel and the rest of the app stay responsive, and both abort — via a
 * generation counter bumped on every effect start and cleanup — the moment `inputs` changes or the
 * panel collapses, so an in-flight search never writes a stale result.
 */
export function useReportingPlans(
  inputs: TakeHomeInputs,
  expanded: boolean,
  options?: UseReportingPlansOptions,
): UseReportingPlansResult {
  const budgetMs = options?.budgetMs ?? DEFAULT_BUDGET_MS;
  const progressThresholdMs = options?.progressThresholdMs ?? DEFAULT_PROGRESS_THRESHOLD_MS;
  const chunkMs = options?.chunkMs ?? DEFAULT_CHUNK_MS;

  const generationRef = useRef(0);
  const [result, setResult] = useState<UseReportingPlansResult>(EMPTY_RESULT);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    const isCurrentGeneration = () => generationRef.current === generation;

    // Collapsed: nothing to compute. The hook returns EMPTY_RESULT directly below rather than
    // storing it, so collapsing never needs a setState call here.
    if (!expanded) {
      return () => {
        generationRef.current += 1;
      };
    }

    const units = deriveReportingUnits(inputs.incomeStreams);
    const mandatoryNote = mandatoryReportingNote(inputs.incomeStreams);

    const uniformKeys: UniformRowKey[] = hasOptionalUnit(units)
      ? ['withheldOnly', 'separate', 'aggregate']
      : ['separate', 'aggregate'];
    const uniformPlanFor = (key: UniformRowKey): ReportingPlan =>
      key === 'withheldOnly'
        ? withheldOnlyPlan(inputs, units)
        : allReportedPlan(inputs, units, key);

    // Step 1 (7.3.3): Current and the uniform plans, timed together to price one engine run on
    // this device.
    const runStart = performance.now();
    const current: PlanEvaluation = {
      plan: currentPlan(inputs),
      evaluated: evaluatePlan(inputs, currentPlan(inputs)),
    };
    const uniformEvaluations = new Map<UniformRowKey, PlanEvaluation>(
      uniformKeys.map(key => {
        const plan = uniformPlanFor(key);
        return [key, { plan, evaluated: evaluatePlan(inputs, plan) }];
      }),
    );
    const elapsedMs = performance.now() - runStart;
    const perRunMs = elapsedMs / (1 + uniformKeys.length);

    let best = [...uniformEvaluations.values()].reduce(
      (soFar, candidate) => (isBetterPlan(candidate, soFar, inputs, units) ? candidate : soFar),
      current,
    );

    // Step 2: predict the exhaustive search's cost and choose exhaustive search or descent.
    const count = countPlans(units);
    const predictedMs = count * perRunMs;
    const bounded = predictedMs > budgetMs;
    const showProgress = !bounded && predictedMs > progressThresholdMs;
    const boundedEstimate = bounded ? { count, predictedMs } : undefined;

    const buildRows = (bestSoFar: PlanEvaluation): ReportingRow[] => [
      {
        key: 'current',
        label: 'Current',
        evaluated: current.evaluated,
        instruction: describePlan(current.plan, units),
        canApply: false,
      },
      {
        key: 'best',
        label: bounded ? 'Best found' : 'Best',
        evaluated: bestSoFar.evaluated,
        instruction: describePlan(bestSoFar.plan, units),
        canApply: !planMatchesCurrent(units, bestSoFar.plan, inputs),
      },
      ...uniformKeys.map(key => {
        const evaluation = uniformEvaluations.get(key)!;
        return {
          key,
          label: UNIFORM_ROW_LABELS[key],
          evaluated: evaluation.evaluated,
          instruction: describePlan(evaluation.plan, units),
          canApply: true,
        };
      }),
    ];

    // `done` is the progress to show; undefined once the search is over or when it was never
    // worth showing, so the bar disappears when the Best row is final.
    const publish = (bestSoFar: PlanEvaluation, done: number | undefined) => {
      setResult({
        rows: buildRows(bestSoFar),
        bestPlan: bestSoFar.evaluated,
        mandatoryNote,
        progress: done === undefined ? undefined : { done, count },
        showProgress: done !== undefined,
        bounded,
        boundedEstimate,
      });
    };

    publish(best, showProgress ? 0 : undefined);

    void (async () => {
      let done = 0;
      let chunkStart = performance.now();

      // Records one evaluated candidate, advances `best`, and yields once `chunkMs` of work has
      // elapsed, publishing the progress so far. Returns false once this run is no longer current
      // (an input change or a collapse), telling the caller to stop.
      const recordAndMaybeYield = async (candidate: PlanEvaluation): Promise<boolean> => {
        if (!isCurrentGeneration()) return false;
        done++;
        if (isBetterPlan(candidate, best, inputs, units)) best = candidate;
        if (performance.now() - chunkStart < chunkMs) return true;
        publish(best, showProgress ? done : undefined);
        await yieldToEventLoop();
        chunkStart = performance.now();
        return isCurrentGeneration();
      };

      if (!bounded) {
        for (const plan of generatePlans(inputs.incomeStreams, units)) {
          if (!isCurrentGeneration()) return;
          const candidate: PlanEvaluation = { plan, evaluated: evaluatePlan(inputs, plan) };
          // eslint-disable-next-line no-await-in-loop -- deliberately sequential, chunked by a running clock
          if (!(await recordAndMaybeYield(candidate))) return;
        }
      } else {
        const search = descendFromPlan(inputs, units, best);
        for (let step = search.next(); !step.done; step = search.next()) {
          if (!isCurrentGeneration()) return;
          // eslint-disable-next-line no-await-in-loop -- the descent generator is stateful, driven one step per iteration
          if (!(await recordAndMaybeYield(step.value))) return;
        }
      }

      if (!isCurrentGeneration()) return;
      publish(best, undefined);
    })();

    return () => {
      generationRef.current += 1;
    };
  }, [inputs, expanded, budgetMs, progressThresholdMs, chunkMs]);

  return expanded ? result : EMPTY_RESULT;
}
