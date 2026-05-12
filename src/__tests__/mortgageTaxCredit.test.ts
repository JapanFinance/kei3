// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { applyMortgageTaxCredit } from '../utils/mortgageTaxCredit';
import { getMortgageTaxCreditCohort } from '../data/mortgageTaxCredit';
import type { MortgageTaxCreditInput } from '../types/tax';

const MANUAL_BASE: Omit<MortgageTaxCreditInput, 'manualAnnualCredit'> = {
    moveInYear: 2024,
    isExistingHome: false,
    mode: 'manual',
};

const AUTO_BASE: Omit<MortgageTaxCreditInput, 'yearEndLoanBalance' | 'housingTier'> = {
    moveInYear: 2024,
    isExistingHome: false,
    mode: 'autoCalculate',
};

describe('getMortgageTaxCreditCohort', () => {
    it('returns the 2024+ current cohort for a 2024 move-in', () => {
        const cohort = getMortgageTaxCreditCohort(2024);
        expect(cohort?.moveInYearFrom).toBe(2024);
        expect(cohort?.creditRate).toBe(0.007);
        expect(cohort?.incomeLimit).toBe(20_000_000);
    });

    it('returns the 2024+ cohort for a 2026 move-in (open-ended upper bound)', () => {
        const cohort = getMortgageTaxCreditCohort(2026);
        expect(cohort?.moveInYearFrom).toBe(2024);
    });

    it('returns the 2022-2023 cohort for a 2022 move-in (boundary)', () => {
        const cohort = getMortgageTaxCreditCohort(2022);
        expect(cohort?.moveInYearFrom).toBe(2022);
        expect(cohort?.moveInYearTo).toBe(2023);
        expect(cohort?.creditRate).toBe(0.007);
    });

    it('returns the 2014-2021 cohort for a 2014 move-in (boundary)', () => {
        const cohort = getMortgageTaxCreditCohort(2014);
        expect(cohort?.moveInYearFrom).toBe(2014);
        expect(cohort?.creditRate).toBe(0.01);
        expect(cohort?.incomeLimit).toBe(30_000_000);
        expect(cohort?.spillover.flatCap).toBe(136_500);
        expect(cohort?.spillover.taxableIncomeRate).toBe(0.07);
    });

    it('returns the 2009-2013 catch-all cohort', () => {
        const cohort = getMortgageTaxCreditCohort(2010);
        expect(cohort?.moveInYearFrom).toBe(2009);
    });

    it('returns undefined for an unsupported move-in year (pre-2009)', () => {
        expect(getMortgageTaxCreditCohort(2008)).toBeUndefined();
        expect(getMortgageTaxCreditCohort(1999)).toBeUndefined();
    });
});

describe('applyMortgageTaxCredit - manual mode', () => {
    it('applies the full manual amount to income tax when income tax is sufficient', () => {
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(200_000);
        expect(result.appliedToIncomeTax).toBe(200_000);
        expect(result.appliedToResidenceTax).toBe(0);
        expect(result.unusedCredit).toBe(0);
        expect(result.warnings).toEqual([]);
    });

    it('spills over to residence tax when income tax is insufficient, capped by flatCap', () => {
        // 2024 cohort: flatCap = 97,500, taxableIncomeRate = 0.05
        // taxableTotalIncome = 5,000,000 → 5,000,000 × 0.05 = 250,000 → min(97,500, 250,000) = 97,500
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 50_000, // Very small income tax
            taxableTotalIncome: 5_000_000,
            calculationYear: 2026,
        });
        expect(result.appliedToIncomeTax).toBe(50_000);
        // Spillover requested: 150,000. Cap: 97,500. Applied: 97,500.
        expect(result.appliedToResidenceTax).toBe(97_500);
        expect(result.unusedCredit).toBe(52_500); // 200,000 - 50,000 - 97,500
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('uses the taxable-income-rate cap when it is smaller than the flat cap', () => {
        // taxableTotalIncome = 1,000,000 → 1,000,000 × 0.05 = 50,000 < 97,500 (flat cap)
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 0,
            taxableTotalIncome: 1_000_000,
            calculationYear: 2026,
        });
        expect(result.appliedToIncomeTax).toBe(0);
        expect(result.appliedToResidenceTax).toBe(50_000);
        expect(result.unusedCredit).toBe(150_000);
    });

    it('uses the older 7%/¥136,500 spillover cap for the 2014-2021 cohort', () => {
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, moveInYear: 2018, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 0,
            taxableTotalIncome: 5_000_000, // × 0.07 = 350,000 > 136,500 flat cap
            calculationYear: 2024, // within 10-year window (2018-2027)
        });
        expect(result.appliedToResidenceTax).toBe(136_500);
    });

    it('treats negative manual amounts as zero', () => {
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, manualAnnualCredit: -1000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.appliedToIncomeTax).toBe(0);
        expect(result.appliedToResidenceTax).toBe(0);
    });
});

describe('applyMortgageTaxCredit - eligibility', () => {
    it('rejects when net income exceeds the cohort limit', () => {
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, manualAnnualCredit: 200_000 },
            netIncome: 20_000_001, // Just over the ¥20M limit for 2024+ cohort
            nationalIncomeTax: 1_000_000,
            taxableTotalIncome: 18_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.appliedToIncomeTax).toBe(0);
        expect(result.warnings[0]).toContain('eligibility limit');
    });

    it('accepts at-limit income', () => {
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, manualAnnualCredit: 200_000 },
            netIncome: 20_000_000,
            nationalIncomeTax: 1_000_000,
            taxableTotalIncome: 18_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(200_000);
        expect(result.appliedToIncomeTax).toBe(200_000);
    });

    it('rejects calculation year outside the new-build 13-year window', () => {
        // 2024 move-in + 13y = applies for calculation years 2024..2036
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, moveInYear: 2024, isExistingHome: false, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2037,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.warnings[0]).toContain('credit period ended');
    });

    it('rejects calculation year outside the existing-home 10-year window', () => {
        // 2024 move-in + 10y = applies for calculation years 2024..2033
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, moveInYear: 2024, isExistingHome: true, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2034,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.warnings[0]).toContain('credit period ended');
    });

    it('accepts at the final year of the credit window', () => {
        // 2024 move-in, new build, 13-year window: last applicable year is 2036
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, moveInYear: 2024, isExistingHome: false, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2036,
        });
        expect(result.annualCredit).toBe(200_000);
    });

    it('rejects calculation years before move-in', () => {
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, moveInYear: 2026, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2024,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.warnings[0]).toContain('later than');
    });

    it('rejects unrecognised move-in years (pre-2009)', () => {
        const result = applyMortgageTaxCredit({
            input: { ...MANUAL_BASE, moveInYear: 2005, manualAnnualCredit: 200_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.warnings[0]).toContain('No mortgage tax credit rules');
    });
});

describe('applyMortgageTaxCredit - auto-calculate mode', () => {
    it('computes credit as balance × 0.7% for the 2024+ cohort, energy-saving tier new build', () => {
        // energySaving cap for new build (2024 cohort): 30,000,000
        // Balance 25M < cap → eligible balance 25M; credit = 25M × 0.007 = 175,000
        const result = applyMortgageTaxCredit({
            input: { ...AUTO_BASE, yearEndLoanBalance: 25_000_000, housingTier: 'energySaving' },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(175_000);
    });

    it('caps eligible balance at the housing-tier cap', () => {
        // longTermExcellent newBuilds cap (2024 cohort): 45,000,000
        // Balance 60M > cap → eligible balance 45M; credit = 45M × 0.007 = 315,000
        const result = applyMortgageTaxCredit({
            input: { ...AUTO_BASE, yearEndLoanBalance: 60_000_000, housingTier: 'longTermExcellent' },
            netIncome: 8_000_000,
            nationalIncomeTax: 1_000_000,
            taxableTotalIncome: 6_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(315_000);
    });

    it('rejects standard new-build tier in the 2024+ cohort (no qualifying cap)', () => {
        // standard.newBuilds = 0 for 2024+ cohort
        const result = applyMortgageTaxCredit({
            input: { ...AUTO_BASE, yearEndLoanBalance: 30_000_000, housingTier: 'standard' },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.warnings[0]).toContain('no qualifying loan-balance cap');
    });

    it('accepts standard existing-home tier (uses ¥20M cap)', () => {
        // standard.existingHomes = 20,000,000 for 2024+ cohort
        // Balance 15M < cap → eligible 15M; credit = 15M × 0.007 = 105,000
        const result = applyMortgageTaxCredit({
            input: { ...AUTO_BASE, isExistingHome: true, yearEndLoanBalance: 15_000_000, housingTier: 'standard' },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(105_000);
    });

    it('uses 1% rate for the 2014-2021 cohort', () => {
        // standard.newBuilds = 40M for 2014-2021 cohort; balance 30M < cap
        // Credit = 30M × 0.01 = 300,000
        const result = applyMortgageTaxCredit({
            input: { ...AUTO_BASE, moveInYear: 2018, yearEndLoanBalance: 30_000_000, housingTier: 'standard' },
            netIncome: 8_000_000,
            nationalIncomeTax: 1_000_000,
            taxableTotalIncome: 6_000_000,
            calculationYear: 2024,
        });
        expect(result.annualCredit).toBe(300_000);
    });

    it('warns when housing tier is missing in auto mode', () => {
        const result = applyMortgageTaxCredit({
            input: { ...AUTO_BASE, yearEndLoanBalance: 30_000_000 },
            netIncome: 8_000_000,
            nationalIncomeTax: 500_000,
            taxableTotalIncome: 5_000_000,
            calculationYear: 2026,
        });
        expect(result.annualCredit).toBe(0);
        expect(result.warnings[0]).toContain('housing tier');
    });
});
