// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Readers that turn a premium rate, written the way its source publishes it, into whole units of
 * 1/`scale`. Rates are held as integers so that a premium, a whole-yen amount times a rate, is an
 * exact integer product rather than a binary fraction.
 *
 * The decimal in the source is only used to pick the integer: `5.075` is the double
 * 5.0749999999999998, and 5.075 × 10,000 lands within 1e-10 of 50,750, which is nearer that
 * integer than any other by a wide margin. Development builds reject a rate whose decimals the
 * scale cannot hold, where that distance approaches half a unit.
 */
const rateReader =
  (unitsPerWritten: number, writtenUnit: string) =>
  (value: number): number => {
    const units = value * unitsPerWritten;
    const rounded = Math.round(units);
    if (import.meta.env.DEV && Math.abs(units - rounded) > 1e-6) {
      throw new Error(
        `The rate ${value}${writtenUnit} has more decimal places than its scale holds`,
      );
    }
    return rounded;
  };

/** Reads a rate written as a percentage: with a scale of 1,000,000, 5.075 is 50_750 units. */
export const percentOf = (scale: number) => rateReader(scale / 100, '%');

/** Reads a rate written per 1,000 (1000分の): with a scale of 10,000, 5.5 is 55 units. */
export const perMilleOf = (scale: number) => rateReader(scale / 1000, '/1,000');
