// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { perMilleTo, percentTo, Rate } from '../data/rate';

describe('Rate', () => {
  const percent0 = percentTo(0);
  const percent1 = percentTo(1);
  const percent3 = percentTo(3);

  describe('Rate.ZERO', () => {
    it('represents a zero rate', () => {
      expect(Rate.ZERO.toDecimal()).toBe(0);
      expect(Rate.ZERO.toPercent()).toBe('0.0%');
      expect(Rate.ZERO.taxOn(100_000)).toBe(0);
      expect(Rate.ZERO.premiumOn(100_000)).toBe(0);
    });
  });

  describe('equals', () => {
    it('compares equality across same and different scales', () => {
      const r1 = percent0(10);
      const r2 = percent1(10);
      const r3 = percent3(10);
      const r4 = percent1(10.5);

      expect(r1.equals(r2)).toBe(true);
      expect(r2.equals(r3)).toBe(true);
      expect(r1.equals(r3)).toBe(true);
      expect(r1.equals(r4)).toBe(false);
      expect(Rate.ZERO.equals(percent0(0))).toBe(true);
    });
  });

  describe('plus', () => {
    it('adds rates of the same scale', () => {
      const municipal = percent0(6);
      const prefectural = percent0(4);
      const total = municipal.plus(prefectural);

      expect(total.equals(percent0(10))).toBe(true);
      expect(total.toDecimal()).toBe(0.1);
      expect(total.toPercent()).toBe('10.0%');
    });

    it('adds rates of different scales via common denominator', () => {
      const municipal = percent0(6); // scale 100
      const surtax = percent1(2.1); // scale 1,000
      const sum = municipal.plus(surtax);

      expect(sum.toDecimal()).toBe(0.081);
      expect(sum.equals(percent1(8.1))).toBe(true);
    });

    it('adds national and residence withholding rates correctly', () => {
      const national = percent3(15.315); // scale 100,000
      const residence = percent0(5); // scale 100
      const combined = national.plus(residence);

      expect(combined.toDecimal()).toBe(0.20315);
      expect(combined.equals(percent3(20.315))).toBe(true);
      expect(combined.toPercent(3)).toBe('20.315%');
    });
  });

  describe('Rate.sum', () => {
    it('returns Rate.ZERO when called with no arguments', () => {
      expect(Rate.sum().equals(Rate.ZERO)).toBe(true);
    });

    it('returns the single rate when called with one argument', () => {
      const r = percent1(15);
      expect(Rate.sum(r).equals(r)).toBe(true);
    });

    it('sums multiple rates across different scales', () => {
      const r1 = percent0(6); // 6%
      const r2 = percent1(4); // 4%
      const r3 = percent3(0.315); // 0.315%
      const sum = Rate.sum(r1, r2, r3);

      expect(sum.toDecimal()).toBe(0.10315);
      expect(sum.equals(percent3(10.315))).toBe(true);
    });
  });

  describe('minus', () => {
    it('subtracts rates of the same scale', () => {
      const r1 = percent0(10);
      const r2 = percent0(4);
      const diff = r1.minus(r2);

      expect(diff.equals(percent0(6))).toBe(true);
      expect(diff.toDecimal()).toBe(0.06);
    });

    it('subtracts rates across different scales', () => {
      const r1 = percent0(90); // 90%, scale 100
      const r2 = percent3(5.105); // 5.105%, scale 100,000
      const diff = r1.minus(r2);

      expect(diff.equals(percent3(84.895))).toBe(true);
      expect(diff.toDecimal()).toBe(0.84895);
      expect(diff.toPercent(3)).toBe('84.895%');
    });

    it('throws in development when subtraction would result in negative units', () => {
      const r1 = percent0(5);
      const r2 = percent0(10);
      expect(() => r1.minus(r2)).toThrow('Rate subtraction resulted in negative units');
    });
  });

  describe('times', () => {
    it('multiplies a rate by another rate exactly', () => {
      const base = percent1(5); // 5%, scale 1,000
      const surtaxRate = percent1(2.1); // 2.1%, scale 1,000
      const surtax = base.times(surtaxRate);

      // 5% * 2.1% = 0.105%
      expect(surtax.toDecimal()).toBe(0.00105);
      expect(surtax.equals(percent3(0.105))).toBe(true);
    });

    it('multiplies a rate by a whole integer factor', () => {
      const r = percent1(5.5);
      const doubled = r.times(2);

      expect(doubled.equals(percent1(11))).toBe(true);
      expect(doubled.toDecimal()).toBe(0.11);
    });

    it('throws in development for negative scalar multipliers', () => {
      const r = percent0(10);
      expect(() => r.times(-1)).toThrow('Multiplier must be a non-negative whole number');
    });
  });

  describe('dividedBy', () => {
    it('divides a rate into equal parts', () => {
      const totalPension = perMilleTo(0)(183); // 18.3%
      const employeePart = totalPension.dividedBy(2);

      expect(employeePart.toDecimal()).toBe(0.0915);
      expect(employeePart.equals(percentTo(2)(9.15))).toBe(true);
    });
  });

  describe('toDecimal', () => {
    it('returns exact floating-point decimal value', () => {
      expect(percent1(22.5).toDecimal()).toBe(0.225);
      expect(percent0(10).toDecimal()).toBe(0.1);
      expect(percent3(15.315).toDecimal()).toBe(0.15315);
    });
  });

  describe('toPercent', () => {
    it('formats percentages with optional decimal precision', () => {
      expect(percent3(84.895).toPercent(3)).toBe('84.895%');
      expect(percent1(22.5).toPercent(1)).toBe('22.5%');
      expect(percent0(10).toPercent()).toBe('10.0%');
    });
  });
});
