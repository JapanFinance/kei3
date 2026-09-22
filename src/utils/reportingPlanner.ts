// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  DEFAULT_REPORTED_DIVIDENDS_TAXATION,
  type DividendsIncomeStream,
  type IncomeStream,
  type ReportedDividendsTaxation,
  type TakeHomeInputs,
  type TakeHomeResults,
  type WithholdingAccountIncomeStream,
} from '../types/tax';
import { formatJPY } from './formatters';
import { withRequiredReporting } from './investmentReporting';
import { calculateTaxes } from './taxCalculations';

/**
 * One reporting choice a {@link ReportingUnit} could be set to.
 */
export interface ReportingUnitState {
  /**
   * Whether choosing this state reports a nonzero dividend amount — what drives the election
   * doubling in {@link countPlans} and {@link generatePlans} (7.3.1).
   */
  reportsDividend: boolean;
  /** `stream` (assumed to be this unit's own entry) with this state's reporting flags applied. */
  apply: (stream: IncomeStream) => IncomeStream;
}

/**
 * One entry among {@link TakeHomeInputs.incomeStreams} whose reporting the planner can vary — a
 * withholding account or a domestic dividend. A sale outside a withholding account (always
 * reported, 措法37条の11の5①) and interest (never reported) carry no unit, since neither ever
 * varies; see {@link deriveReportingUnits}.
 */
export interface ReportingUnit {
  /** Index into the plan's `streams` array this unit patches. */
  streamIndex: number;
  /**
   * The states worth evaluating for this unit (7.3.1), ordered least-reported first: index 0
   * always leaves the unit fully withheld, and the last index always reports everything the unit
   * can report. Length 1 when the unit's reporting can't change the result.
   */
  states: readonly ReportingUnitState[];
}

/** A complete set of income streams and the election that would tax them. */
export interface ReportingPlan {
  streams: readonly IncomeStream[];
  election: ReportedDividendsTaxation;
}

/**
 * The figures a plan is compared on: take-home kept, each tax, social insurance and the furusato
 * limit, the same definition the reporting comparison this module replaces used, plus 合計所得金額,
 * which every side effect of reporting is keyed to.
 */
export interface PlanFigures {
  /** Take-home pay plus the withheld-only investment income net of the tax withheld on it. */
  kept: number;
  /** 所得税 the return assesses plus the 所得税 withheld at source. */
  incomeTax: number;
  /** 住民税 the return assesses plus the 住民税 withheld at source. */
  residenceTax: number;
  socialInsurance: number;
  furusatoNozeiLimit: number;
  /** 合計所得金額 under this plan. */
  totalIncome: number;
}

/** A plan's streams and election together with what they come out to. */
export interface EvaluatedPlan {
  streams: IncomeStream[];
  election: ReportedDividendsTaxation;
  figures: PlanFigures;
}

/** A plan paired with its {@link EvaluatedPlan}, for the search to carry both around at once. */
export interface PlanEvaluation {
  plan: ReportingPlan;
  evaluated: EvaluatedPlan;
}

const withholdingAccountState = (
  reportsCapitalGains: boolean,
  reportsDividends: boolean,
  reportsDividend: boolean,
): ReportingUnitState => ({
  reportsDividend,
  apply: stream => ({
    ...(stream as WithholdingAccountIncomeStream),
    reportsCapitalGains,
    reportsDividends,
  }),
});

const dividendsState = (isReported: boolean, reportsDividend: boolean): ReportingUnitState => ({
  reportsDividend,
  apply: stream => ({ ...(stream as DividendsIncomeStream), isReported }),
});

/**
 * The reporting states worth evaluating for one withholding account (7.3.1). A gain with
 * dividends has all four combinations of the two flags. A loss with dividends drops two: "sales
 * only" (report the loss, leave the dividends withheld) is forbidden outright — a reported loss
 * that reduced the account's dividend withholding drags the dividends onto the return
 * (措法37条の11の6⑩) — and "dividends only" is dominated by reporting both, which never keeps
 * less (verified on 96 engine cases, plan 7.3.2), so only "nothing" and "both" remain. An account
 * with one nonzero figure varies only that figure's flag; the other flag can't change the result,
 * so it is left withheld. An account with both figures at zero has one state, for the same
 * reason. Ordered least-reported first, so index 0 is always "everything withheld" and the last
 * index is always "everything reported" — see {@link withheldOnlyPlan}, {@link allReportedPlan}.
 */
const withholdingAccountStates = (
  account: WithholdingAccountIncomeStream,
): ReportingUnitState[] => {
  const hasGain = account.capitalGains > 0;
  const hasLoss = account.capitalGains < 0;
  const hasDividends = account.dividends > 0;

  if (hasGain && hasDividends) {
    return [
      withholdingAccountState(false, false, false),
      withholdingAccountState(false, true, true),
      withholdingAccountState(true, false, false),
      withholdingAccountState(true, true, true),
    ];
  }
  if (hasLoss && hasDividends) {
    return [
      withholdingAccountState(false, false, false),
      withholdingAccountState(true, true, true),
    ];
  }
  if (account.capitalGains !== 0) {
    return [
      withholdingAccountState(false, false, false),
      withholdingAccountState(true, false, false),
    ];
  }
  if (hasDividends) {
    return [
      withholdingAccountState(false, false, false),
      withholdingAccountState(false, true, true),
    ];
  }
  return [withholdingAccountState(false, false, false)];
};

/**
 * The reporting states worth evaluating for one domestic dividend entry: two when there is an
 * amount to move between them. A zero amount can't change the result, so it has one state; a
 * dividend paid abroad has to be reported (措令4条の3②五・六), so it is fixed to that state too.
 */
const dividendsStates = (dividend: DividendsIncomeStream): ReportingUnitState[] => {
  if (dividend.paymentChannel === 'abroad') {
    return [dividendsState(true, dividend.amount > 0)];
  }
  if (dividend.amount === 0) {
    return [dividendsState(dividend.isReported, false)];
  }
  return [dividendsState(false, false), dividendsState(true, true)];
};

/**
 * One {@link ReportingUnit} per withholding account or dividend entry among `streams`. A sale
 * outside a withholding account and interest carry no unit: neither entry's reporting ever
 * varies, so the search never branches on them.
 */
export const deriveReportingUnits = (streams: readonly IncomeStream[]): ReportingUnit[] => {
  const units: ReportingUnit[] = [];
  streams.forEach((stream, streamIndex) => {
    if (stream.type === 'withholdingAccount') {
      units.push({ streamIndex, states: withholdingAccountStates(stream) });
    } else if (stream.type === 'dividends') {
      units.push({ streamIndex, states: dividendsStates(stream) });
    }
  });
  return units;
};

/**
 * The number of feasible plans over `units`, without running the engine (7.3.1): the election
 * doubles a combination of unit states only when it reports a nonzero dividend, so the total is
 * `2P − N₀`, where `P` is the product of the state counts and `N₀` the number of combinations that
 * report no dividend at all — itself a product, over each unit, of how many of its states report
 * none.
 */
export const countPlans = (units: readonly ReportingUnit[]): number => {
  let planCount = 1;
  let noDividendCount = 1;
  for (const unit of units) {
    planCount *= unit.states.length;
    noDividendCount *= unit.states.filter(state => !state.reportsDividend).length;
  }
  return 2 * planCount - noDividendCount;
};

/** Whether `streams[unit.streamIndex]` reports a nonzero dividend, read from its own flags. */
const streamReportsDividend = (stream: IncomeStream): boolean => {
  if (stream.type === 'withholdingAccount') return stream.reportsDividends && stream.dividends > 0;
  if (stream.type === 'dividends') return stream.isReported && stream.amount > 0;
  return false;
};

const planReportsDividend = (
  units: readonly ReportingUnit[],
  streams: readonly IncomeStream[],
): boolean => units.some(unit => streamReportsDividend(streams[unit.streamIndex]!));

/**
 * Every feasible plan over `units`, applied to `streams` (never the 措法37条の11の6⑩ state, which
 * is excluded from every unit's states to begin with). {@link countPlans} counts this generator's
 * length without running it.
 */
export function* generatePlans(
  streams: readonly IncomeStream[],
  units: readonly ReportingUnit[],
): Generator<ReportingPlan> {
  function* combinations(index: number, acc: IncomeStream[]): Generator<readonly IncomeStream[]> {
    if (index === units.length) {
      yield acc;
      return;
    }
    const unit = units[index]!;
    for (const state of unit.states) {
      const next = acc.slice();
      next[unit.streamIndex] = state.apply(streams[unit.streamIndex]!);
      yield* combinations(index + 1, next);
    }
  }

  for (const patchedStreams of combinations(0, streams.slice())) {
    if (planReportsDividend(units, patchedStreams)) {
      yield { streams: patchedStreams, election: 'separate' };
      yield { streams: patchedStreams, election: 'aggregate' };
    } else {
      yield { streams: patchedStreams, election: DEFAULT_REPORTED_DIVIDENDS_TAXATION };
    }
  }
}

/** The plan the entries and the election already stand as. */
export const currentPlan = (inputs: TakeHomeInputs): ReportingPlan => ({
  streams: inputs.incomeStreams,
  election: inputs.reportedDividendsTaxation ?? DEFAULT_REPORTED_DIVIDENDS_TAXATION,
});

/** Whether any unit's reporting can actually be chosen — see {@link withheldOnlyPlan}. */
export const hasOptionalUnit = (units: readonly ReportingUnit[]): boolean =>
  units.some(unit => unit.states.length > 1);

const applyUniformState = (
  streams: readonly IncomeStream[],
  units: readonly ReportingUnit[],
  pickState: (unit: ReportingUnit) => ReportingUnitState,
): IncomeStream[] => {
  const patched = streams.slice();
  units.forEach(unit => {
    patched[unit.streamIndex] = pickState(unit).apply(streams[unit.streamIndex]!);
  });
  return patched;
};

/**
 * Every optional unit left withheld, everything else as entered, under the election in force
 * (it still taxes any dividend that has to be reported). Meaningless when
 * {@link hasOptionalUnit} is false — the caller omits the row in that case.
 */
export const withheldOnlyPlan = (
  inputs: TakeHomeInputs,
  units: readonly ReportingUnit[],
): ReportingPlan => ({
  streams: applyUniformState(inputs.incomeStreams, units, unit => unit.states[0]!),
  election: inputs.reportedDividendsTaxation ?? DEFAULT_REPORTED_DIVIDENDS_TAXATION,
});

/** Every optional unit reporting everything it can, taxed under `election`. */
export const allReportedPlan = (
  inputs: TakeHomeInputs,
  units: readonly ReportingUnit[],
  election: ReportedDividendsTaxation,
): ReportingPlan => ({
  streams: applyUniformState(
    inputs.incomeStreams,
    units,
    unit => unit.states[unit.states.length - 1]!,
  ),
  election,
});

const unitFlagsEqual = (a: IncomeStream, b: IncomeStream): boolean => {
  if (a.type === 'withholdingAccount' && b.type === 'withholdingAccount') {
    return (
      a.reportsCapitalGains === b.reportsCapitalGains && a.reportsDividends === b.reportsDividends
    );
  }
  if (a.type === 'dividends' && b.type === 'dividends') {
    return a.isReported === b.isReported;
  }
  return true;
};

const otherElection = (election: ReportedDividendsTaxation): ReportedDividendsTaxation =>
  election === 'separate' ? 'aggregate' : 'separate';

/**
 * The neighbours of `plan` one coordinate-descent step away (7.3.3): every other state of one
 * unit at a time, plus, only when `plan` reports at least one dividend, the other election with
 * every unit left as it is. Flipping the election when nothing is reported would just repeat
 * `plan`, so that neighbour is left out rather than wasting an engine run on it.
 */
export const neighbourPlans = (
  units: readonly ReportingUnit[],
  plan: ReportingPlan,
): ReportingPlan[] => {
  const neighbours: ReportingPlan[] = [];
  for (const unit of units) {
    const currentStream = plan.streams[unit.streamIndex]!;
    for (const state of unit.states) {
      const candidateStream = state.apply(currentStream);
      if (unitFlagsEqual(candidateStream, currentStream)) continue;
      const patched = plan.streams.slice();
      patched[unit.streamIndex] = candidateStream;
      neighbours.push({ streams: patched, election: plan.election });
    }
  }
  if (planReportsDividend(units, plan.streams)) {
    neighbours.push({ streams: plan.streams, election: otherElection(plan.election) });
  }
  return neighbours;
};

/** How many units `plan` reports something on — the tie-break's "fewer reported units" (7.3.3). */
export const reportedUnitCount = (
  units: readonly ReportingUnit[],
  streams: readonly IncomeStream[],
): number =>
  units.filter(unit => {
    const stream = streams[unit.streamIndex]!;
    if (stream.type === 'withholdingAccount')
      return stream.reportsCapitalGains || stream.reportsDividends;
    if (stream.type === 'dividends') return stream.isReported;
    return false;
  }).length;

/**
 * Whether two plans are the same choice: every optional unit set the same way and, when a
 * dividend is reported, the same election (with none reported the election has no effect).
 * Compares flags directly rather than through a unit's `states` index, so it still answers
 * correctly when an entry is in a state {@link deriveReportingUnits} prunes from the search
 * (dominated, but not invalid).
 */
export const samePlan = (
  units: readonly ReportingUnit[],
  a: ReportingPlan,
  b: ReportingPlan,
): boolean => {
  const sameFlags = units.every(unit =>
    unitFlagsEqual(a.streams[unit.streamIndex]!, b.streams[unit.streamIndex]!),
  );
  if (!sameFlags) return false;
  if (!planReportsDividend(units, a.streams)) return true;
  return a.election === b.election;
};

/**
 * Whether `plan` sets every unit exactly as the entries and the election already stand — the
 * tie-break's "then Current" (7.3.3), and what decides whether Apply is offered.
 */
export const planMatchesCurrent = (
  units: readonly ReportingUnit[],
  plan: ReportingPlan,
  inputs: TakeHomeInputs,
): boolean => samePlan(units, plan, currentPlan(inputs));

/** The comparison figures for one engine result — see {@link PlanFigures}. */
const figuresOf = (results: TakeHomeResults): PlanFigures => {
  const withheld = results.investmentIncome?.withheld ?? { national: 0, residence: 0, total: 0 };
  return {
    kept: results.takeHomeIncome,
    incomeTax: results.nationalIncomeTax + withheld.national,
    residenceTax: results.residenceTax.totalResidenceTax + withheld.residence,
    socialInsurance:
      results.socialInsuranceOverride ??
      results.healthInsurance +
        results.pensionPayments +
        (results.employmentInsurance ?? 0) +
        (results.longTermCareCategory1Premium ?? 0),
    furusatoNozeiLimit: results.furusatoNozei.limit,
    totalIncome: results.totalNetIncome,
  };
};

/**
 * Runs `plan` through the engine: applies {@link withRequiredReporting} to every stream (a
 * safety net — the search never produces an invalid combination itself), calls
 * {@link calculateTaxes}, and returns the resulting streams, election and figures so a caller
 * (Apply) can dispatch them.
 */
export const evaluatePlan = (inputs: TakeHomeInputs, plan: ReportingPlan): EvaluatedPlan => {
  const streams = plan.streams.map(withRequiredReporting);
  const results = calculateTaxes({
    ...inputs,
    incomeStreams: streams,
    reportedDividendsTaxation: plan.election,
  });
  return { streams, election: plan.election, figures: figuresOf(results) };
};

/**
 * Whether `candidate` should replace `best` as the best plan found so far (7.3.3): a strictly
 * higher `kept` wins outright; a tie prefers fewer reported units, then whichever of the two
 * already matches the current entries.
 */
export const isBetterPlan = (
  candidate: PlanEvaluation,
  best: PlanEvaluation,
  inputs: TakeHomeInputs,
  units: readonly ReportingUnit[],
): boolean => {
  if (candidate.evaluated.figures.kept !== best.evaluated.figures.kept) {
    return candidate.evaluated.figures.kept > best.evaluated.figures.kept;
  }
  const candidateReported = reportedUnitCount(units, candidate.plan.streams);
  const bestReported = reportedUnitCount(units, best.plan.streams);
  if (candidateReported !== bestReported) return candidateReported < bestReported;
  const candidateIsCurrent = planMatchesCurrent(units, candidate.plan, inputs);
  const bestIsCurrent = planMatchesCurrent(units, best.plan, inputs);
  return candidateIsCurrent && !bestIsCurrent;
};

/**
 * Coordinate descent from `start` (7.3.3): evaluates every neighbour of the current plan
 * ({@link neighbourPlans}), yielding each one as it is tried, moves to the best one that improves
 * on the current plan ({@link isBetterPlan}), and repeats from there; returns the current plan
 * once none of its neighbours improve on it. A caller that only wants the final plan can drain
 * this generator without reading the yielded values.
 */
export function* descendFromPlan(
  inputs: TakeHomeInputs,
  units: readonly ReportingUnit[],
  start: PlanEvaluation,
): Generator<PlanEvaluation, PlanEvaluation> {
  let current = start;
  for (;;) {
    let best = current;
    let improved = false;
    for (const neighbour of neighbourPlans(units, current.plan)) {
      const candidate: PlanEvaluation = {
        plan: neighbour,
        evaluated: evaluatePlan(inputs, neighbour),
      };
      yield candidate;
      if (isBetterPlan(candidate, best, inputs, units)) {
        best = candidate;
        improved = true;
      }
    }
    if (!improved) return current;
    current = best;
  }
}

/**
 * Coordinate descent from every start in turn ({@link descendFromPlan}), each start also tried
 * under the other election when it reports a dividend. A single-step descent never flips the
 * election together with an entry, and the optima it misses mostly need both: on 1,500 random
 * scenarios small enough to enumerate, descent from the best uniform plan alone missed the
 * optimum in 15% of them and from every uniform plan and Current under both elections in 3.7%,
 * with the mean shortfall falling from ¥9,644 to ¥1,533. Yields every candidate it evaluates,
 * for a caller that chunks the work; returns the best plan found.
 */
export function* multiStartDescent(
  inputs: TakeHomeInputs,
  units: readonly ReportingUnit[],
  starts: readonly PlanEvaluation[],
): Generator<PlanEvaluation, PlanEvaluation> {
  let best = starts[0]!;
  for (const start of starts) {
    if (isBetterPlan(start, best, inputs, units)) best = start;
    const variants = [start];
    if (planReportsDividend(units, start.plan.streams)) {
      const plan: ReportingPlan = {
        streams: start.plan.streams,
        election: otherElection(start.plan.election),
      };
      const flipped: PlanEvaluation = { plan, evaluated: evaluatePlan(inputs, plan) };
      yield flipped;
      if (isBetterPlan(flipped, best, inputs, units)) best = flipped;
      variants.push(flipped);
    }
    for (const variant of variants) {
      const result = yield* descendFromPlan(inputs, units, variant);
      if (isBetterPlan(result, best, inputs, units)) best = result;
    }
  }
  return best;
}

/** Drains a descent generator synchronously, for a caller that has no need to chunk it. */
export const drainDescent = (search: Generator<PlanEvaluation, PlanEvaluation>): PlanEvaluation => {
  let step = search.next();
  while (!step.done) {
    step = search.next();
  }
  return step.value;
};

/** Drains {@link descendFromPlan} synchronously, for a caller that has no need to chunk it. */
export const descend = (
  inputs: TakeHomeInputs,
  units: readonly ReportingUnit[],
  start: PlanEvaluation,
): PlanEvaluation => drainDescent(descendFromPlan(inputs, units, start));

// English names matching the election toggle in IncomeDetailsModal.tsx ("Separate"/"Aggregate"),
// paired with the statutory terms.
const ELECTION_LABEL: Record<ReportedDividendsTaxation, string> = {
  separate: 'Separate taxation (申告分離課税)',
  aggregate: 'Aggregate taxation (総合課税)',
};

/** One-based position of `streams[streamIndex]` among the entries sharing its type. */
const positionAmongSameType = (streams: readonly IncomeStream[], streamIndex: number): number => {
  const type = streams[streamIndex]!.type;
  let position = 0;
  for (let i = 0; i <= streamIndex; i++) {
    if (streams[i]!.type === type) position++;
  }
  return position;
};

/** The entry's name for an instruction: its position among same-type entries and its amounts. */
const unitName = (streams: readonly IncomeStream[], streamIndex: number): string => {
  const stream = streams[streamIndex]!;
  const position = positionAmongSameType(streams, streamIndex);
  if (stream.type === 'withholdingAccount') {
    return `Account ${position} (sales ${formatJPY(stream.capitalGains)}, dividends ${formatJPY(stream.dividends)})`;
  }
  // 'dividends' — the only other stream type deriveReportingUnits gives a unit to.
  return `Dividends ${position} (${formatJPY((stream as DividendsIncomeStream).amount)})`;
};

/** What the entry is set to under a plan, as an instruction. */
const unitTarget = (stream: IncomeStream): string => {
  if (stream.type === 'withholdingAccount') {
    return stream.reportsCapitalGains && stream.reportsDividends
      ? 'report both the sales and the dividends'
      : stream.reportsCapitalGains
        ? 'report the sales only'
        : stream.reportsDividends
          ? 'report the dividends only'
          : 'leave both to withholding';
  }
  return (stream as DividendsIncomeStream).isReported ? 'report' : 'leave to withholding';
};

/**
 * What applying `plan` would change about the entries as they stand in `current` (7.3.4): one
 * line per optional entry whose reporting differs, naming the entry and what it is set to, and
 * one line for the election when the plan reports a dividend and either the election differs
 * or no dividend was reported before (when the election had no effect). Entries that stay as
 * they are get no line; empty when the plan is the current one.
 */
export const planChanges = (
  plan: ReportingPlan,
  current: ReportingPlan,
  units: readonly ReportingUnit[],
): string[] => {
  const changes = units
    .filter(unit => unit.states.length > 1)
    .filter(
      unit => !unitFlagsEqual(plan.streams[unit.streamIndex]!, current.streams[unit.streamIndex]!),
    )
    .map(
      unit =>
        `${unitName(plan.streams, unit.streamIndex)}: ${unitTarget(plan.streams[unit.streamIndex]!)}.`,
    );
  const electionMatters = planReportsDividend(units, plan.streams);
  const electionMattered = planReportsDividend(units, current.streams);
  if (electionMatters && (!electionMattered || plan.election !== current.election)) {
    changes.push(`Reported dividends taxed under ${ELECTION_LABEL[plan.election]}.`);
  }
  return changes;
};

/**
 * The once-stated note for entries that have to be reported in every plan (7.3.4): a sale outside
 * a withholding account (措法37条の11の5①) and a dividend paid abroad (措令4条の3②). Undefined
 * when `streams` has neither, so nothing is shown.
 */
export const mandatoryReportingNote = (streams: readonly IncomeStream[]): string | undefined => {
  const hasOutsideSale = streams.some(s => s.type === 'capitalGains');
  const hasAbroadDividend = streams.some(
    s => s.type === 'dividends' && s.paymentChannel === 'abroad',
  );
  if (hasOutsideSale && hasAbroadDividend) {
    return 'Sales outside a withholding designated account and dividends paid abroad are always reported.';
  }
  if (hasOutsideSale) return 'Sales outside a withholding designated account are always reported.';
  if (hasAbroadDividend) return 'Dividends paid abroad are always reported.';
  return undefined;
};
