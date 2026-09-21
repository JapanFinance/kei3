// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from 'react';

import type { TakeHomeInputs } from '../../../types/tax';
import {
  allReportedPlan,
  countPlans,
  currentPlan,
  deriveReportingUnits,
  multiStartDescent,
  planChanges,
  evaluatePlan,
  generatePlans,
  hasOptionalUnit,
  isBetterPlan,
  mandatoryReportingNote,
  samePlan,
  withheldOnlyPlan,
  type EvaluatedPlan,
  type PlanEvaluation,
  type ReportingPlan,
} from '../../../utils/reportingPlanner';

export interface UseReportingPlansOptions {
  /**
   * Predicted time, in ms, an exhaustive search is allowed before descent takes over; predicted
   * from the throughput of its first chunk.
   */
  budgetMs?: number;
  /** How long, in ms, a search runs before the progress indicator appears. */
  progressThresholdMs?: number;
  /** How long, in ms, the search runs before yielding to the event loop. */
  chunkMs?: number;
}

const DEFAULT_BUDGET_MS = 5_000;
const DEFAULT_PROGRESS_THRESHOLD_MS = 150;
const DEFAULT_CHUNK_MS = 30;

export type UniformRowKey = 'withheldOnly' | 'separate' | 'aggregate';

/** Plans evaluated so far; `count` is the total while the search is exhaustive, absent in descent. */
export interface SearchProgress {
  done: number;
  count?: number;
}
export type ReportingRowKey = 'current' | 'best' | UniformRowKey;

/** A part a distinct plan plays: the entries as they stand, or the plan found to keep the most. */
export type PlanRole = 'current' | 'best';

/**
 * One distinct plan. Current, Best and the uniform plans often coincide — a new user's entries
 * are all withheld, so Current is "All withheld only", and after Apply Current is Best — and a
 * plan shown twice under two names reads as two plans, so equal plans share one row: the row
 * is named for the uniform plan when one is among them, and `roles` carries the parts it plays.
 */
export interface ReportingRow {
  /** The uniform plan's key when the row is one, else which of Current or Best it is. */
  key: ReportingRowKey;
  label: string;
  roles: PlanRole[];
  evaluated: EvaluatedPlan;
  /** What applying the plan changes about the current entries (7.3.4); empty for Current. */
  changes: string[];
  /** Whether Apply should be offered for this row: every row but the current plan's. */
  canApply: boolean;
}

export interface UseReportingPlansResult {
  /** Undefined until the panel has expanded and the first, synchronous results are ready. */
  rows: ReportingRow[] | undefined;
  bestPlan: EvaluatedPlan | undefined;
  /** The once-stated note for entries that always have to be reported (7.3.4). */
  mandatoryNote: string | undefined;
  progress: SearchProgress | undefined;
  /** True while a search has run longer than the threshold and is still running. */
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
  separate: 'All reported, separate taxation (申告分離課税)',
  aggregate: 'All reported, aggregate taxation (総合課税)',
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
 * (at most a handful of engine runs). The exhaustive search then starts, and the throughput of its
 * first chunk predicts how long every feasible plan would take: within `budgetMs` it runs on;
 * otherwise a coordinate descent from the best plan found so far bounds the search instead. Both
 * are chunked by `chunkMs` and yield to the event
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

    // Step 1 (7.3.3): Current and the uniform plans, synchronously, so their rows render at once.
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

    let best = [...uniformEvaluations.values()].reduce(
      (soFar, candidate) => (isBetterPlan(candidate, soFar, inputs, units) ? candidate : soFar),
      current,
    );

    const count = countPlans(units);
    // Decided after the first chunk of the exhaustive search, from its measured throughput: the
    // first few engine runs after the panel opens are cold and run ten times slower than warm
    // ones, so a prediction from them alone would overstate the search by as much.
    let bounded = false;
    let boundedEstimate: { count: number; predictedMs: number } | undefined;

    const buildRows = (bestSoFar: PlanEvaluation): ReportingRow[] => {
      const members: { key: ReportingRowKey; evaluation: PlanEvaluation }[] = [
        { key: 'current', evaluation: current },
        { key: 'best', evaluation: bestSoFar },
        ...uniformKeys.map(key => ({ key, evaluation: uniformEvaluations.get(key)! })),
      ];
      const rows: ReportingRow[] = [];
      for (const { key, evaluation } of members) {
        const isRole = key === 'current' || key === 'best';
        const existing = rows.find(row => samePlan(units, row.evaluated, evaluation.plan));
        if (existing) {
          if (isRole) {
            existing.roles.push(key);
            existing.canApply = existing.canApply && key !== 'current';
          } else {
            // A uniform plan names the row; Current or Best it equals becomes a tag on it.
            existing.key = key;
            existing.label = UNIFORM_ROW_LABELS[key];
          }
          continue;
        }
        rows.push({
          key,
          label: isRole
            ? key === 'current'
              ? 'Current'
              : bounded
                ? 'Best found'
                : 'Best'
            : UNIFORM_ROW_LABELS[key],
          roles: isRole ? [key] : [],
          evaluated: evaluation.evaluated,
          changes: planChanges(evaluation.plan, current.plan, units),
          canApply: key !== 'current',
        });
      }
      return rows;
    };

    // `progress` is what the indicator shows while the search runs: the plans evaluated so far,
    // with the total while the search is exhaustive; undefined once the search is over, so the
    // indicator disappears when the Best row is final.
    const publish = (bestSoFar: PlanEvaluation, progress: SearchProgress | undefined) => {
      setResult({
        rows: buildRows(bestSoFar),
        bestPlan: bestSoFar.evaluated,
        mandatoryNote,
        progress,
        showProgress: progress !== undefined,
        bounded,
        boundedEstimate,
      });
    };

    publish(best, undefined);

    void (async () => {
      const searchStart = performance.now();
      let done = 0;
      let chunkStart = searchStart;
      // The indicator appears once the search has run longer than the threshold and stays until
      // the search ends, so a short search never flickers one in.
      let showProgress = false;

      // Records one evaluated candidate, advances `best`, and yields once `chunkMs` of work has
      // elapsed, publishing the progress so far. Returns false once this run is no longer current
      // (an input change or a collapse), telling the caller to stop.
      const recordAndMaybeYield = async (candidate: PlanEvaluation): Promise<boolean> => {
        if (!isCurrentGeneration()) return false;
        done++;
        if (isBetterPlan(candidate, best, inputs, units)) best = candidate;
        const now = performance.now();
        if (now - chunkStart < chunkMs) return true;
        if (now - searchStart > progressThresholdMs) showProgress = true;
        publish(best, showProgress ? { done, ...(bounded ? {} : { count }) } : undefined);
        await yieldToEventLoop();
        chunkStart = performance.now();
        yielded = true;
        return isCurrentGeneration();
      };

      let yielded = false;
      let decided = false;
      for (const plan of generatePlans(inputs.incomeStreams, units)) {
        if (!isCurrentGeneration()) return;
        const candidate: PlanEvaluation = { plan, evaluated: evaluatePlan(inputs, plan) };
        // eslint-disable-next-line no-await-in-loop -- deliberately sequential, chunked by a running clock
        if (!(await recordAndMaybeYield(candidate))) return;
        // Once the first chunk has yielded, its throughput is known: predict the whole search
        // from it, once, and bound the search if it would overrun the budget.
        if (!decided && yielded) {
          decided = true;
          const predictedMs = ((chunkStart - searchStart) / done) * count;
          if (predictedMs > budgetMs) {
            bounded = true;
            boundedEstimate = { count, predictedMs };
            break;
          }
        }
      }

      if (bounded) {
        // From the best plan found so far, Current and each uniform plan; multiStartDescent adds
        // the other election to each start that reports a dividend.
        const search = multiStartDescent(inputs, units, [
          best,
          current,
          ...uniformEvaluations.values(),
        ]);
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
