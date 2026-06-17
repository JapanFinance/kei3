// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { applyHomeLoanTaxCredit, earliestEligibleMoveInYear } from '../utils/homeLoanTaxCredit';
import { getHomeLoanTaxCreditCohort } from '../data/homeLoanTaxCredit';

describe('getHomeLoanTaxCreditCohort', () => {
    it('returns the 2022+ band for 2022 and later move-ins', () => {
        expect(getHomeLoanTaxCreditCohort(2022)?.moveInYearFrom).toBe(2022);
        expect(getHomeLoanTaxCreditCohort(2024)?.moveInYearFrom).toBe(2022);
        expect(getHomeLoanTaxCreditCohort(2026)?.moveInYearFrom).toBe(2022);
        const band = getHomeLoanTaxCreditCohort(2024)!;
        expect(band.incomeLimit).toBe(20_000_000);
        expect(band.spillover).toEqual({ flatCap: 97_500, taxableIncomeRate: 0.05 });
    });

    it('returns the 2014-2021 band with the 7% / ¥136,500 spillover cap', () => {
        // The 7% / ¥136,500 cap assumes 特定取得 (home acquired under the 8%/10% consumption tax).
        // A pre-owned home bought from a private individual would use 5% / ¥97,500, which kei3 does
        // not model — see the band's note in src/data/homeLoanTaxCredit.ts.
        expect(getHomeLoanTaxCreditCohort(2014)?.moveInYearFrom).toBe(2014);
        expect(getHomeLoanTaxCreditCohort(2021)?.moveInYearFrom).toBe(2014);
        const band = getHomeLoanTaxCreditCohort(2018)!;
        expect(band.incomeLimit).toBe(30_000_000);
        expect(band.spillover).toEqual({ flatCap: 136_500, taxableIncomeRate: 0.07 });
    });

    it('returns undefined for unsupported (pre-2014) move-ins', () => {
        // The UI only offers move-ins from ~10 years ago (2017 for a 2026 calc), and pre-2014
        // credits have all expired, so kei3 no longer carries a band for them.
        expect(getHomeLoanTaxCreditCohort(2013)).toBeUndefined();
        expect(getHomeLoanTaxCreditCohort(2008)).toBeUndefined();
    });
});

describe('applyHomeLoanTaxCredit', () => {
    it('applies the full credit to the base income tax when it is sufficient', () => {
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2024, creditAmount: 200_000 },
            8_000_000,
            500_000,
            5_000_000,
        );
        expect(result.annualCredit).toBe(200_000);
        expect(result.appliedToIncomeTax).toBe(200_000);
        expect(result.appliedToResidenceTax).toBe(0);
        expect(result.unusedCredit).toBe(0);
        expect(result.warnings).toEqual([]);
    });

    it('spills over to residence tax when the credit exceeds income tax, capped by the flat cap', () => {
        // 2022+ band: flatCap 97,500, rate 5%. taxableTotalIncome 3M → 5% × 3M = 150,000 > the
        // ¥97,500 flat cap, so the flat cap binds. Income tax on ¥3,000,000 taxable is 202,500.
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2024, creditAmount: 350_000 },
            4_000_000,
            202_500,
            3_000_000,
        );
        expect(result.appliedToIncomeTax).toBe(202_500);
        expect(result.appliedToResidenceTax).toBe(97_500); // capped at the flat cap
        expect(result.unusedCredit).toBe(50_000); // 350,000 - 202,500 - 97,500
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('caps the spillover at 課税総所得金額 × rate when that is smaller than the flat cap', () => {
        // taxableTotalIncome 1M → 5% × 1M = 50,000 < the ¥97,500 flat cap, so the rate cap binds.
        // Income tax on ¥1,000,000 taxable is 50,000 (5% bracket).
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2024, creditAmount: 200_000 },
            1_500_000,
            50_000,
            1_000_000,
        );
        expect(result.appliedToIncomeTax).toBe(50_000);
        expect(result.appliedToResidenceTax).toBe(50_000); // capped at 5% × 1,000,000
        expect(result.unusedCredit).toBe(100_000); // 200,000 - 50,000 - 50,000
    });

    it('uses the 7% / ¥136,500 spillover cap for the 2014-2021 band', () => {
        // taxableTotalIncome 3M → 7% × 3M = 210,000 > the ¥136,500 flat cap, so the flat cap binds.
        // Income tax on ¥3,000,000 taxable is 202,500 (10% bracket).
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2018, creditAmount: 400_000 },
            4_000_000,
            202_500,
            3_000_000,
        );
        expect(result.appliedToIncomeTax).toBe(202_500);
        expect(result.appliedToResidenceTax).toBe(136_500); // capped at the ¥136,500 flat cap
        expect(result.unusedCredit).toBe(61_000); // 400,000 - 202,500 - 136,500
    });

    it('caps the 2014-2021 spillover at 課税総所得金額 × 7% when below the ¥136,500 flat cap', () => {
        // taxableTotalIncome 1M → 7% × 1M = 70,000 < the ¥136,500 flat cap, so the rate cap binds.
        // Income tax on ¥1,000,000 taxable is 50,000 (5% bracket).
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2018, creditAmount: 200_000 },
            1_500_000,
            50_000,
            1_000_000,
        );
        expect(result.appliedToIncomeTax).toBe(50_000);
        expect(result.appliedToResidenceTax).toBe(70_000); // capped at 7% × 1,000,000
        expect(result.unusedCredit).toBe(80_000); // 200,000 - 50,000 - 70,000
        expect(result.residenceTaxSpilloverCap).toEqual({ applied: 70_000, flatCap: 136_500, incomeRateCap: 70_000 });
    });

    it('rejects when net income exceeds the band eligibility limit', () => {
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2024, creditAmount: 200_000 },
            20_000_001, // over the ¥20M limit for 2022+ band
            1_000_000,
            18_000_000,
        );
        expect(result.annualCredit).toBe(0);
        expect(result.appliedToIncomeTax).toBe(0);
        expect(result.warnings[0]).toContain('eligibility limit');
    });

    it('accepts at-limit income', () => {
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2024, creditAmount: 200_000 },
            20_000_000,
            1_000_000,
            18_000_000,
        );
        expect(result.appliedToIncomeTax).toBe(200_000);
    });

    it('uses the higher ¥30M limit for the 2014-2021 band', () => {
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2018, creditAmount: 100_000 },
            25_000_000, // over 20M but under the 30M limit for this band
            2_000_000,
            22_000_000,
        );
        expect(result.appliedToIncomeTax).toBe(100_000);
    });

    it('rejects unsupported (pre-2014) move-ins with a warning', () => {
        const result = applyHomeLoanTaxCredit(
            { moveInYear: 2013, creditAmount: 200_000 },
            8_000_000,
            572_500,
            5_000_000,
        );
        expect(result.annualCredit).toBe(0);
        expect(result.warnings[0]).toContain('No home loan tax credit rules');
    });

    it('treats zero or negative credit amounts as no credit', () => {
        for (const creditAmount of [0, -1000]) {
            const result = applyHomeLoanTaxCredit(
                { moveInYear: 2024, creditAmount },
                8_000_000,
                500_000,
                5_000_000,
            );
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

    it('never returns a year before the cohort data starts (2014)', () => {
        // Far-past tax years would compute a floor below 2014; clamp to the earliest band.
        expect(earliestEligibleMoveInYear(2015)).toBe(2014);
    });
});
