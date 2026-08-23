// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';

import { DEFAULT_PROVIDER, NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import { detectCaps } from '../utils/capDetection';
import {
  calculateLatterStageElderlyPremium,
  calculateNationalHealthInsurancePremiumWithBreakdown,
} from '../utils/healthInsuranceCalculator';
import type { EmployeesHealthInsuranceBonusBreakdownItem } from '../utils/healthInsuranceCalculator';
import { makeTakeHomeResults } from './fixtures/takeHomeResults';

const TEST_INCOME_YEAR = 2026;

// Tokyo-Chiyoda FY2026 caps: medical 670,000, support 260,000, LTC 170,000, child support 30,000

describe('detectCaps', () => {
  it('should explicitly fail or return false positive currently when high business income is present', () => {
    // Scenario: Low salary (should NOT be capped), High Business Income (makes total high)
    // Salary: 3,600,000 (300k/month) -> Not capped (Cap is ~1.39M/month for Health, ~650k for Pension)
    // Business: 100,000,000 -> Total 103.6M

    const results = makeTakeHomeResults({
      annualIncome: 103600000, // 103.6M
      salaryIncome: 3600000, // 3.6M
      healthInsuranceProvider: DEFAULT_PROVIDER,
    });

    const caps = detectCaps(results, TEST_INCOME_YEAR);

    expect(caps.healthInsuranceCapped).toBe(false);
    expect(caps.pensionCapped).toBe(false);
  });

  it('should correctly detect caps when salary is high', () => {
    // Scenario: High salary (should be capped)
    // Salary: 24,000,000 (2M/month) -> Capped

    const results = makeTakeHomeResults({
      annualIncome: 24000000,
      salaryIncome: 24000000,
      healthInsuranceProvider: DEFAULT_PROVIDER,
    });

    const caps = detectCaps(results, TEST_INCOME_YEAR);

    expect(caps.healthInsuranceCapped).toBe(true);
    expect(caps.pensionCapped).toBe(true);
  });

  it('should correctly handle NHI caps (uncapped case)', () => {
    const results = makeTakeHomeResults({
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo-Chiyoda',
      nhiMedicalPortion: 500000,
      nhiElderlySupportPortion: 200000,
      nhiChildSupportPortion: 10000,
      ageRange: 'age20to39' as const,
    });

    const caps = detectCaps(results, TEST_INCOME_YEAR);

    expect(caps.healthInsuranceCapped).toBe(false);
    expect(caps.healthInsuranceCapDetails?.childSupportCapped).toBe(false);
    expect(caps.pensionCapped).toBe(false);
  });

  it('should NOT trigger pension cap when only bonus is high (salary is normal)', () => {
    // Scenario:
    // Salary: 3,600,000 (300k/month) -> Normal, Not Capped
    // Bonus: 10,000,000 (10M) -> High
    // Resulting Annual Income: 13.6M

    const results = makeTakeHomeResults({
      annualIncome: 13600000,
      salaryIncome: 3600000,
      healthInsuranceProvider: DEFAULT_PROVIDER,
    });

    const caps = detectCaps(results, TEST_INCOME_YEAR);

    expect(caps.pensionCapped).toBe(false);
    expect(caps.healthInsuranceCapped).toBe(false);
  });

  it('should correctly detect health insurance bonus cap', () => {
    const results = makeTakeHomeResults({
      healthInsuranceProvider: DEFAULT_PROVIDER,
    });

    // Mock a breakdown where the bonus is capped
    // Bonus amount 6,000,000 -> Rounded 6,000,000 -> Standard 5,730,000 (Cap)
    const breakdown: EmployeesHealthInsuranceBonusBreakdownItem[] = [
      {
        month: 6,
        bonusAmount: 6000000,
        standardBonusAmount: 5730000, // Capped
        cumulativeStandardBonus: 5730000,
        premium: 10000,
        includesLongTermCare: false,
      },
    ];

    const caps = detectCaps(results, TEST_INCOME_YEAR, breakdown);

    expect(caps.healthInsuranceBonusCapped).toBe(true);
  });

  it('should NOT detect health insurance bonus cap when under limit', () => {
    const results = makeTakeHomeResults({
      healthInsuranceProvider: DEFAULT_PROVIDER,
    });

    // Bonus amount 1,000,000 -> Standard 1,000,000 (Not capped)
    const breakdown: EmployeesHealthInsuranceBonusBreakdownItem[] = [
      {
        month: 6,
        bonusAmount: 1000000,
        standardBonusAmount: 1000000,
        cumulativeStandardBonus: 1000000,
        premium: 1000,
        includesLongTermCare: false,
      },
    ];

    const caps = detectCaps(results, TEST_INCOME_YEAR, breakdown);

    expect(caps.healthInsuranceBonusCapped).toBe(false);
  });
});

describe('NHI cap detection with real calculator output', () => {
  // Integration tests: feed real income into the calculator, then verify detectCaps
  // correctly identifies capped portions. This catches drift between calculator and
  // cap detection that unit tests with hardcoded values would miss.

  it('detects all NHI portion caps at very high income (Chiyoda, no LTC)', () => {
    const region = 'Tokyo-Chiyoda';
    const breakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
      50_000_000,
      false,
      2026,
      region,
    );

    const results = makeTakeHomeResults({
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region,
      nhiMedicalPortion: breakdown.medicalPortion,
      nhiElderlySupportPortion: breakdown.elderlySupportPortion,
      nhiLongTermCarePortion: breakdown.longTermCarePortion,
      nhiChildSupportPortion: breakdown.childSupportPortion,
      ageRange: 'age20to39' as const,
    });

    const caps = detectCaps(results, TEST_INCOME_YEAR);

    expect(caps.healthInsuranceCapped).toBe(true);
    expect(caps.healthInsuranceCapDetails?.medicalCapped).toBe(true);
    expect(caps.healthInsuranceCapDetails?.supportCapped).toBe(true);
    expect(caps.healthInsuranceCapDetails?.childSupportCapped).toBe(true);
  });

  it('detects all NHI portion caps at very high income (Chiyoda, with LTC)', () => {
    const region = 'Tokyo-Chiyoda';
    const breakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
      50_000_000,
      true,
      2026,
      region,
    );

    const results = makeTakeHomeResults({
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region,
      nhiMedicalPortion: breakdown.medicalPortion,
      nhiElderlySupportPortion: breakdown.elderlySupportPortion,
      nhiLongTermCarePortion: breakdown.longTermCarePortion,
      nhiChildSupportPortion: breakdown.childSupportPortion,
      ageRange: 'age40to59' as const,
    });

    const caps = detectCaps(results, TEST_INCOME_YEAR);

    expect(caps.healthInsuranceCapped).toBe(true);
    expect(caps.healthInsuranceCapDetails?.medicalCapped).toBe(true);
    expect(caps.healthInsuranceCapDetails?.supportCapped).toBe(true);
    expect(caps.healthInsuranceCapDetails?.ltcCapped).toBe(true);
    expect(caps.healthInsuranceCapDetails?.childSupportCapped).toBe(true);
  });

  it('does not flag caps at moderate income (Chiyoda)', () => {
    const region = 'Tokyo-Chiyoda';
    const breakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
      5_000_000,
      false,
      2026,
      region,
    );

    const results = makeTakeHomeResults({
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region,
      nhiMedicalPortion: breakdown.medicalPortion,
      nhiElderlySupportPortion: breakdown.elderlySupportPortion,
      nhiLongTermCarePortion: breakdown.longTermCarePortion,
      nhiChildSupportPortion: breakdown.childSupportPortion,
      ageRange: 'age20to39' as const,
    });

    const caps = detectCaps(results, TEST_INCOME_YEAR);

    expect(caps.healthInsuranceCapped).toBe(false);
    expect(caps.healthInsuranceCapDetails?.medicalCapped).toBe(false);
    expect(caps.healthInsuranceCapDetails?.supportCapped).toBe(false);
    expect(caps.healthInsuranceCapDetails?.childSupportCapped).toBe(false);
  });
});

describe('detectCaps age-range gating', () => {
  it('does not report the fixed-amount pension badge when National Pension is not due', () => {
    const base = {
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo-Chiyoda',
      nhiMedicalPortion: 500_000,
      nhiElderlySupportPortion: 200_000,
    };

    const at20to39 = detectCaps(
      makeTakeHomeResults({ ...base, ageRange: 'age20to39' as const }),
      TEST_INCOME_YEAR,
    );
    const at60to64 = detectCaps(
      makeTakeHomeResults({ ...base, ageRange: 'age60to64' as const }),
      TEST_INCOME_YEAR,
    );

    expect(at20to39.pensionFixed).toBe(true);
    expect(at60to64.pensionFixed).toBe(false);
  });
});

describe('detectCaps for the 後期高齢者医療制度', () => {
  const latterStageBase = {
    healthInsuranceProvider: 'LatterStageElderly' as const,
    region: 'Tokyo',
    ageRange: 'age75plus' as const,
  };

  it('reports capped from the flag the premium calculation set', () => {
    // Calendar 2026 blends FY2025 (cap 800,000) and FY2026 (cap 850,000), so the medical
    // portion tops out at round(800,000/3 + 850,000×2/3) = 833,333 and both fiscal years
    // are at their cap.
    const results = makeTakeHomeResults({
      ...latterStageBase,
      latterStageMedicalPortion: 833_333,
      latterStageChildSupportPortion: 14_000,
      latterStageMedicalCapped: true,
    });

    const caps = detectCaps(results, TEST_INCOME_YEAR);
    expect(caps.healthInsuranceCapped).toBe(true);
    expect(caps.pensionCapped).toBe(false);
  });

  it('reports uncapped below the 賦課限度額', () => {
    const results = makeTakeHomeResults({
      ...latterStageBase,
      latterStageMedicalPortion: 401_500,
      latterStageChildSupportPortion: 7_000,
      latterStageMedicalCapped: false,
    });

    expect(detectCaps(results, TEST_INCOME_YEAR).healthInsuranceCapped).toBe(false);
  });

  it('reports uncapped when no medical portion is present', () => {
    const results = makeTakeHomeResults(latterStageBase);
    expect(detectCaps(results, TEST_INCOME_YEAR).healthInsuranceCapped).toBe(false);
  });

  it('takes the flag from the premium calculation, blended and single-period alike', () => {
    // Blended calendar 2026: capped only at the blended 833,333, not at the current fiscal
    // year's own 850,000 cap. Single-period calendar 2025: capped at the 令和6・7年度 800,000.
    const cappedIn2026 = calculateLatterStageElderlyPremium(20_000_000, 2026, 'Tokyo');
    expect(cappedIn2026.medicalPortion).toBe(833_333);
    expect(cappedIn2026.medicalCapped).toBe(true);

    const cappedIn2025 = calculateLatterStageElderlyPremium(20_000_000, 2025, 'Tokyo');
    expect(cappedIn2025.medicalPortion).toBe(800_000);
    expect(cappedIn2025.medicalCapped).toBe(true);

    for (const breakdown of [cappedIn2026, cappedIn2025]) {
      expect(
        detectCaps(
          makeTakeHomeResults({
            ...latterStageBase,
            latterStageMedicalPortion: breakdown.medicalPortion,
            latterStageMedicalCapped: breakdown.medicalCapped,
          }),
          TEST_INCOME_YEAR,
        ).healthInsuranceCapped,
      ).toBe(true);
    }

    // Just below the 令和6・7年度 cap, so the 2025 premium still rises with income.
    const belowCap = calculateLatterStageElderlyPremium(4_000_000, 2025, 'Tokyo');
    expect(belowCap.medicalCapped).toBe(false);
  });
});

describe("detectCaps pension badge around the Employees' Pension age limit", () => {
  it('reports the pension cap at 65-69 but not at 70-74, where no premium is due', () => {
    // 24,000,000 salary → 2,000,000 per month, above both the health insurance and the
    // pension SMR caps.
    const base = {
      healthInsuranceProvider: DEFAULT_PROVIDER,
      annualIncome: 24_000_000,
      salaryIncome: 24_000_000,
    };
    const at65to69 = detectCaps(
      makeTakeHomeResults({ ...base, ageRange: 'age65to69' as const }),
      TEST_INCOME_YEAR,
    );
    const at70to74 = detectCaps(
      makeTakeHomeResults({ ...base, ageRange: 'age70to74' as const }),
      TEST_INCOME_YEAR,
    );

    expect(at65to69.pensionCapped).toBe(true);
    expect(at70to74.pensionCapped).toBe(false);
    expect(at65to69.healthInsuranceCapped).toBe(true);
    expect(at70to74.healthInsuranceCapped).toBe(true);
  });
});
