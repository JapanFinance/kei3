// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The age intervals the calculator's rules are written on, shared by every set of age choices it
 * collects: the taxpayer's age range and the dependents' spouse and non-spouse age categories.
 * Each of those enumerations maps its values to an {@link AgeInterval}, so one predicate
 * ({@link intervalCoversAgeBand}) answers whether a chosen value falls inside a rule's
 * {@link AgeBand}.
 */

/** A range of ages, as the half-open interval the statutes are written in. */
export interface AgeBand {
  /** 以上: the youngest age in the band. Omitted where the rule has no lower bound. */
  minAgeInclusive?: number;
  /** 未満: the first age outside the band. Omitted where the rule has no upper bound. */
  maxAgeExclusive?: number;
}

/** The ages one value of an age enumeration spans, with both ends stated. */
export type AgeInterval = Required<AgeBand>;

/**
 * Whether every age in {@link ages} falls inside {@link band}. An interval that only partly
 * overlaps the band is not covered, so a rule is never answered for a range of ages on the
 * strength of its youngest or oldest member alone.
 */
export function intervalCoversAgeBand(ages: AgeInterval, band: AgeBand): boolean {
  return (
    ages.minAgeInclusive >= (band.minAgeInclusive ?? 0) &&
    ages.maxAgeExclusive <= (band.maxAgeExclusive ?? Infinity)
  );
}

/**
 * Reject any age choice that crosses a band boundary, which would leave the rule with no single
 * answer for the people who choose it. Called from DEV-only blocks in the modules that declare the
 * intervals and the bands.
 *
 * @param intervalsName Name of the enumeration being checked, for the error message
 * @param intervals     Every value of that enumeration and the ages it spans
 * @param bands         The bands whose boundaries the enumeration has to align with
 */
export function assertIntervalsDoNotCrossBands(
  intervalsName: string,
  intervals: Readonly<Record<string, AgeInterval>>,
  bands: Readonly<Record<string, AgeBand>>,
): void {
  for (const [bandName, band] of Object.entries(bands)) {
    const bandMin = band.minAgeInclusive ?? 0;
    const bandMax = band.maxAgeExclusive ?? Infinity;
    for (const [valueName, ages] of Object.entries(intervals)) {
      const { minAgeInclusive, maxAgeExclusive } = ages;
      const overlapsBand = minAgeInclusive < bandMax && bandMin < maxAgeExclusive;
      if (overlapsBand && !intervalCoversAgeBand(ages, band)) {
        throw new Error(
          `${intervalsName} ${valueName} (${minAgeInclusive}-${maxAgeExclusive}) crosses the ${bandName} band (${bandMin}-${bandMax}), so the rule has no single answer for it. Split it at the boundary.`,
        );
      }
    }
  }
}
