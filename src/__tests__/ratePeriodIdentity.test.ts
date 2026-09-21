// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { getRegionalRatesForMonth } from '../data/employeesHealthInsurance/providerRates';
import { getEmploymentInsuranceRate } from '../data/employmentInsurance';

/**
 * The premium loops compute a premium when the object a rate lookup returns is not the one the
 * previous month returned, which holds because a lookup returns the rate period's own object
 * rather than building one. A lookup that built its answer would leave every premium correct and
 * every other test passing, and quietly go back to rounding twelve times a year, so the identity
 * is pinned here.
 */
describe('a rate lookup returns one object per rate period', () => {
  it('gives the months of a health insurance rate period the same rates object', () => {
    // Kyokai Kenpo Kanagawa 2026: January to April, then May to December.
    const may = getRegionalRatesForMonth('KyokaiKenpo', 'Kanagawa', 2026, 4);
    expect(may).toBeDefined();
    expect(getRegionalRatesForMonth('KyokaiKenpo', 'Kanagawa', 2026, 11)).toBe(may);
    expect(getRegionalRatesForMonth('KyokaiKenpo', 'Kanagawa', 2026, 3)).not.toBe(may);
  });

  it('gives the months of an employment insurance rate period the same rate object', () => {
    // FY2026 runs from April 2026, so April and December share a rate and January does not.
    const april = getEmploymentInsuranceRate(2026, 3);
    expect(getEmploymentInsuranceRate(2026, 11)).toBe(april);
    expect(getEmploymentInsuranceRate(2026, 0)).not.toBe(april);
  });
});
