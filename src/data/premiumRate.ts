// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatPercent } from '../utils/formatters';

/**
 * Rounds a premium of `units / scale` yen to whole yen by the rule for a premium deducted from
 * pay:
 * - 0.50 yen or less rounds down
 * - more than 0.50 yen rounds up
 *
 * The premium is passed as a numerator and a denominator because a rate such as 5.075% has no
 * exact binary fraction: a whole-yen amount times a rate that is an integer over `scale` is an
 * exact integer product, so a premium of exactly x.50 yen is seen as a tie and rounded down.
 * The result is exact whenever `units` is an integer below 2^53.
 *
 * Throws if `units` is negative, NaN or infinite, since no premium can be.
 * @see https://www.nenkin.go.jp/service/kounen/hokenryo/nofu/20121026.html
 */
const roundSocialInsurancePremium = (units: number, scale: number): number => {
  // Negated so that NaN, which fails every comparison, is rejected too.
  if (!(units >= 0 && units < Infinity)) {
    throw new Error(`Premium amount must be non-negative and finite: ${units}`);
  }
  // The division rounds, but it can round up to the next integer only when the fraction is
  // above 0.50; the remainder is then not positive, and yen is still the rounded premium.
  const yen = Math.floor(units / scale);
  return 2 * (units - yen * scale) > scale ? yen + 1 : yen;
};

/**
 * A social insurance premium rate, held as a whole number of units of 1/`scale` so that a
 * premium, a whole-yen amount times a rate, is an exact integer product rather than a binary
 * fraction. Callers work with the rate itself and never see the scale.
 *
 * Read a rate with {@link percentTo} or {@link perMilleTo} in the unit its source publishes. The
 * decimal in the source only picks the integer: 5.075 is the double 5.0749999999999998, and times
 * 10,000 it lands 1.2e-10 from 50,750, far nearer that integer than any other.
 */
export class PremiumRate {
  readonly #units: number;
  readonly #scale: number;

  private constructor(units: number, scale: number) {
    this.#units = units;
    this.#scale = scale;
  }

  /** A rate of this many units of 1/`scale`, for a reader built by {@link rateReader}. */
  static ofUnits(units: number, scale: number): PremiumRate {
    if (import.meta.env.DEV && !(Number.isSafeInteger(units) && units >= 0)) {
      throw new Error(`A premium rate must be a non-negative whole number of units: ${units}`);
    }
    return new PremiumRate(units, scale);
  }

  /** This rate plus `other`, which must be read at the same scale. */
  plus(other: PremiumRate): PremiumRate {
    if (import.meta.env.DEV && other.#scale !== this.#scale) {
      throw new Error(`Cannot add rates of different scales: ${this.#scale} and ${other.#scale}`);
    }
    return new PremiumRate(this.#units + other.#units, this.#scale);
  }

  /** Whether `other` is the same rate, which two separately read rates can be. */
  equals(other: PremiumRate): boolean {
    return this.#units === other.#units && this.#scale === other.#scale;
  }

  /**
   * The premium on `amount`, rounded to whole yen by 50銭以下切り捨て、50銭超切り上げ.
   *
   * `shares` is the number of equal parts this premium is one of: 2 for the half (折半額) an
   * employee pays of a premium they share with their employer, 12 for one month of an annual
   * amount. It divides the scale, which comes to the same number as dividing the amount or the
   * premium, and leaves the numerator whole, so the rounding still sees an exact tie.
   */
  premiumOn(amount: number, shares: number = 1): number {
    return roundSocialInsurancePremium(amount * this.#units, this.#scale * shares);
  }

  /**
   * This rate divided into `parts` equal parts, exactly: the employees' pension rate of
   * 1000分の183 divided into two is the 9.15% an employee pays of what they and their employer
   * pay together.
   */
  dividedBy(parts: number): PremiumRate {
    return new PremiumRate(this.#units, this.#scale * parts);
  }

  /** The rate as a percentage, to at most `decimals` decimal places: 5.075% reads "5.075%". */
  toPercent(decimals?: number): string {
    return formatPercent(this.#units / this.#scale, decimals);
  }
}

/**
 * Reads rates written in one unit, rounding each to the decimal places the unit holds.
 *
 * Calling it reads a rate curated in this repository, and rejects in development one written
 * with more decimal places than that, since rounding a published rate away would be a
 * transcription error nobody would see. {@link RateReader.entered} reads a rate a person entered
 * instead, which has to be accepted whatever its decimals are.
 */
export interface RateReader {
  (value: number): PremiumRate;
  entered(value: number): PremiumRate;
}

const rateReader = (writtenScale: number, decimals: number, writtenUnit: string): RateReader => {
  const unitsPerWritten = 10 ** decimals;
  const scale = writtenScale * unitsPerWritten;
  const entered = (value: number): PremiumRate =>
    PremiumRate.ofUnits(Math.round(value * unitsPerWritten), scale);
  const curated = (value: number): PremiumRate => {
    const units = value * unitsPerWritten;
    if (import.meta.env.DEV && Math.abs(units - Math.round(units)) > 1e-6) {
      throw new Error(
        `The rate ${value}${writtenUnit} has more decimal places than its scale holds`,
      );
    }
    return entered(value);
  };
  return Object.assign(curated, { entered });
};

/**
 * Reads a rate written as a percentage to `decimals` decimal places: read to four, 5.075% is
 * 50,750 units of 0.0001%.
 */
export const percentTo = (decimals: number) => rateReader(100, decimals, '%');

/**
 * Reads a rate written per 1,000 (1000分の) to `decimals` decimal places: read to one, 5.5/1,000
 * is 55 units of 0.1/1,000.
 */
export const perMilleTo = (decimals: number) => rateReader(1000, decimals, '/1,000');
