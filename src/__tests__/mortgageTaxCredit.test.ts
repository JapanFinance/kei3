// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { applyMortgageTaxCredit, earliestEligibleMoveInYear } from '../utils/mortgageTaxCredit';
import { getMortgageTaxCreditCohort } from '../data/mortgageTaxCredit';

describe('getMortgageTaxCreditCohort', () => {
    it('returns the 2022+ band for 2022 and later move-ins', () => {
        expect(getMortgageTaxCreditCohort(2022)?.moveInYearFrom).toBe(2022);
        expect(getMortgageTaxCreditCohort(2024)?.moveInYearFrom).toBe(2022);
        expect(getMortgageTaxCreditCohort(2026)?.moveInYearFrom).toBe(2022);
        const band = getMortgageTaxCreditCohort(2024)!;
        expect(band.incomeLimit).toBe(20_000_000);
        expect(band.spillover).toEqual({ flatCap: 97_500, taxableIncomeRate: 0.05 });
    });

    it('returns the 2014-2021 band with the 7% / ¥136,500 spillover cap', () => {
        expect(getMortgageTaxCreditCohort(2014)?.moveInYearFrom).toBe(2014);
        expect(getMortgageTaxCreditCohort(2021)?.moveInYearFrom).toBe(2014);
        const band = getMortgageTaxCreditCohort(2018)!;
        expect(band.incomeLimit).toBe(30_000_000);
        expect(band.spillover).toEqual({ flatCap: 136_500, taxableIncomeRate: 0.07 });
    });

    it('returns the 2009-2013 band', () => {
        expect(getMortgageTaxCreditCohort(2009)?.moveInYearFrom).toBe(2009);
        expect(getMortgageTaxCreditCohort(2013)?.moveInYearFrom).toBe(2009);
        const band = getMortgageTaxCreditCohort(2010)!;
        expect(band.incomeLimit).toBe(30_000_000);
        expect(band.spillover).toEqual({ flatCap: 97_500, taxableIncomeRate: 0.05 });
    });

    it('returns undefined for unsupported (pre-2009) move-ins', () => {
        expect(getMortgageTaxCreditCohort(2008)).toBeUndefined();
        expect(getMortgageTaxCreditCohort(1999)).toBeUndefined();
    });
});

describe('applyMortgageTaxCredit', () => {
    it('applies the full credit to the base income tax when it is sufficient', () => {
        const result = applyMortgageTaxCredit({
            input: { moveInYear: 2024, creditAmount: 200_000 },
            netIncome: 8_000_000,
            baseIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
        });
        expect(result.annualCredit).toBe(200_000);
        expect(result.appliedToIncomeTax).toBe(200_000);
        expect(result.appliedToResidenceTax).toBe(0);
        expect(result.unusedCredit).toBe(0);
        expect(result.warnings).toEqual([]);
    });

    it('spills over to residence tax when the credit exceeds income tax, capped by the flat cap', () => {
        // 2022+ band: flatCap 97,500, rate 5%. taxableTotalIncome 5M → 250,000 > flatCap.
        const result = applyMortgageTaxCredit({
            input: { moveInYear: 2024, creditAmount: 200_000 },
            netIncome: 8_000_000,
            baseIncomeTax: 50_000,
            taxableTotalIncome: 5_000_000,
        });
        expect(result.appliedToIncomeTax).toBe(50_000);
        expect(result.appliedToResidenceTax).toBe(97_500); // capped at flatCap
        expect(result.unusedCredit).toBe(52_500); // 200,000 − 50,000 − 97,500
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('caps the spillover at 課税総所得金額 × rate when that is smaller than the flat cap', () => {
        // taxableTotalIncome 1M → 1M × 5% = 50,000 < 97,500 flat cap.
        const result = applyMortgageTaxCredit({
            input: { moveInYear: 2024, creditAmount: 200_000 },
            netIncome: 8_000_000,
            baseIncomeTax: 0,
            taxableTotalIncome: 1_000_000,
        });
        expect(result.appliedToIncomeTax).toBe(0);
        expect(result.appliedToResidenceTax).toBe(50_000);
        expect(result.unusedCredit).toBe(150_000);
    });

    it('uses the 7% / ¥136,500 spillover cap for the 2014-2021 band', () => {
        // taxableTotalIncome 5M → 5M × 7% = 350,000 > 136,500 flat cap.
        const result = applyMortgageTaxCredit({
            input: { moveInYear: 2018, creditAmount: 200_000 },
            netIncome: 8_000_000,
            baseIncomeTax: 0,
            taxableTotalIncome: 5_000_000,
        });
        expect(result.appliedToResidenceTax).toBe(136_500);
    });

    it('rejects when net income exceeds the band eligibility limit', () => {
        const result = applyMortgageTaxCredit({
            input: { moveInYear: 2024, creditAmount: 200_000 },
            netIncome: 20_000_001, // over the ¥20M limit for 2022+ band
            baseIncomeTax: 1_000_000,
            taxableTotalIncome: 18_000_000,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.appliedToIncomeTax).toBe(0);
        expect(result.warnings[0]).toContain('eligibility limit');
    });

    it('accepts at-limit income', () => {
        const result = applyMortgageTaxCredit({
            input: { moveInYear: 2024, creditAmount: 200_000 },
            netIncome: 20_000_000,
            baseIncomeTax: 1_000_000,
            taxableTotalIncome: 18_000_000,
        });
        expect(result.appliedToIncomeTax).toBe(200_000);
    });

    it('uses the higher ¥30M limit for the 2014-2021 band', () => {
        const result = applyMortgageTaxCredit({
            input: { moveInYear: 2018, creditAmount: 100_000 },
            netIncome: 25_000_000, // over 20M but under the 30M limit for this band
            baseIncomeTax: 2_000_000,
            taxableTotalIncome: 22_000_000,
        });
        expect(result.appliedToIncomeTax).toBe(100_000);
    });

    it('rejects unsupported (pre-2009) move-ins with a warning', () => {
        const result = applyMortgageTaxCredit({
            input: { moveInYear: 2005, creditAmount: 200_000 },
            netIncome: 8_000_000,
            baseIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.warnings[0]).toContain('No mortgage tax credit rules');
    });

    it('treats zero or negative credit amounts as no credit', () => {
        for (const creditAmount of [0, -1000]) {
            const result = applyMortgageTaxCredit({
                input: { moveInYear: 2024, creditAmount },
                netIncome: 8_000_000,
                baseIncomeTax: 500_000,
                taxableTotalIncome: 5_000_000,
            });
            expect(result.annualCredit).toBe(0);
            expect(result.appliedToIncomeTax).toBe(0);
            expect(result.appliedToResidenceTax).toBe(0);
        }
    });
});

describe('earliestEligibleMoveInYear (move-in dropdown floor)', () => {
    it('returns the 10-year floor for the current era (2026 → 2017)', () => {
        // 10-year credits: 2017 move-in is in its final year (2017+9). 13-year credits
        // (2019+) are all ≥ 2017, so they don't push the floor lower.
        expect(earliestEligibleMoveInYear(2026)).toBe(2017);
        expect(earliestEligibleMoveInYear(2027)).toBe(2018);
        expect(earliestEligibleMoveInYear(2028)).toBe(2019);
    });

    it('keeps 2019-2021 move-ins eligible while their 13-year credit still runs', () => {
        // In 2029 the 10-year floor is 2020, but a 2019 13-year credit runs through 2031,
        // so the floor must stay at 2019 (not drop the still-eligible 13-year cohort).
        expect(earliestEligibleMoveInYear(2029)).toBe(2019);
        expect(earliestEligibleMoveInYear(2031)).toBe(2019); // 2019 + 12 = 2031, last year
        expect(earliestEligibleMoveInYear(2032)).toBe(2020); // 2019's credit has now ended
    });

    it('never returns a year before the cohort data starts (2009)', () => {
        // Far-past tax years would compute a floor below 2009; clamp to the known data.
        expect(earliestEligibleMoveInYear(2015)).toBe(2009);
    });
});
