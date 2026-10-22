// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The two ways the calculator talks about ages, and the predicate that relates them.
 *
 * A rule applies to an {@link AgeBand}, the 以上/未満 interval its source is written in. A person
 * is described instead by an {@link AgeRange}: the ages spanned by one of the choices the form
 * offers, whether for the taxpayer or for a dependent. Answering any age-keyed rule for any
 * person is therefore the same question, asked by {@link ageRangeCoversBand} — does the range
 * fall inside the band?
 *
 * One convention follows from that, and every age-keyed rule in the calculator keeps it: the
 * module that owns a rule owns the rule's band and applies it itself. Such a rule takes the
 * person's age, never a decision a caller has already made about that age, so no call site can
 * answer a rule on a band that is not the rule's own. How the age is spelled follows from who
 * the rule is asked about — the owning module's own union of age choices where a rule concerns
 * only the taxpayer or only a dependent, and an {@link AgeRange} where one rule serves both,
 * which the age-choice modules produce from their choices for that purpose.
 *
 * A boolean parameter is still the right shape for a fact about a household rather than about
 * one person's age, such as whether any dependent at all is 23歳未満; the band there has already
 * been applied, per dependent, by the module that owns it.
 */

/**
 * The ages a rule applies to. A band belongs to a rule, never to a person; for the ages a
 * person's choice spans see {@link AgeRange}.
 */
export interface AgeBand {
  /** 以上: the youngest age in the band. Omitted where the rule has no lower bound. */
  minAgeInclusive?: number;
  /** 未満: the first age outside the band. Omitted where the rule has no upper bound. */
  maxAgeExclusive?: number;
}

/**
 * The ages one of the form's age choices spans, both ends stated — a choice offered to a person
 * always has a youngest and an oldest age, while a rule's band may be open at either end.
 */
export type AgeRange = Required<AgeBand>;

/**
 * Whether every age in {@link ageRange} falls inside {@link band}. A range that only partly
 * overlaps the band is not covered, so a rule is never answered for a range on the strength of
 * its youngest or oldest member alone.
 */
export function ageRangeCoversBand(ageRange: AgeRange, band: AgeBand): boolean {
  return (
    ageRange.minAgeInclusive >= (band.minAgeInclusive ?? 0) &&
    ageRange.maxAgeExclusive <= (band.maxAgeExclusive ?? Infinity)
  );
}

/**
 * Reject any age choice that crosses a band boundary, which would leave the rule with no single
 * answer for the people who choose it. Called from DEV-only blocks in the modules that declare
 * the ranges and the bands.
 *
 * @param choiceName Name of the set of choices being checked, for the error message
 * @param ageRanges  Every choice in that set and the ages it spans
 * @param bands      The bands whose boundaries those choices have to align with
 */
export function assertAgeRangesDoNotCrossBands(
  choiceName: string,
  ageRanges: Readonly<Record<string, AgeRange>>,
  bands: Readonly<Record<string, AgeBand>>,
): void {
  for (const [bandName, band] of Object.entries(bands)) {
    const bandMin = band.minAgeInclusive ?? 0;
    const bandMax = band.maxAgeExclusive ?? Infinity;
    for (const [choice, ageRange] of Object.entries(ageRanges)) {
      const { minAgeInclusive, maxAgeExclusive } = ageRange;
      const overlapsBand = minAgeInclusive < bandMax && bandMin < maxAgeExclusive;
      if (overlapsBand && !ageRangeCoversBand(ageRange, band)) {
        throw new Error(
          `${choiceName} ${choice} (${minAgeInclusive}-${maxAgeExclusive}) crosses the ${bandName} band (${bandMin}-${bandMax}), so the rule has no single answer for it. Split it at the boundary.`,
        );
      }
    }
  }
}
