// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { NHIPortionTooltip } from '../components/TakeHomeCalculator/tabs/HealthInsurancePremiumTooltip';
import { NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import type {
  TakeHomeResults,
  TakeHomeInputs,
  ResidenceTaxDetails,
  FurusatoNozeiDetails,
} from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { formatJPY } from '../utils/formatters';
import {
  calculateNationalHealthInsurancePremiumWithBreakdown,
  type NationalHealthInsurancePortionKey,
} from '../utils/healthInsuranceCalculator';

/**
 * Build minimal TakeHomeResults and TakeHomeInputs for a given NHI scenario,
 * using the real calculator to produce authoritative portion values.
 */
function buildNHIScenario(annualIncome: number, region: string, includeLTC: boolean) {
  const breakdown = calculateNationalHealthInsurancePremiumWithBreakdown(
    annualIncome,
    includeLTC,
    2026,
    region,
  );

  const results: TakeHomeResults = {
    annualIncome,
    hasEmploymentIncome: false,
    nationalIncomeTax: 0,
    residenceTax: {
      totalResidenceTax: 0,
      city: { cityIncomeTax: 0, cityPerCapitaTax: 0 },
      prefecture: { prefectureIncomeTax: 0, prefecturePerCapitaTax: 0 },
    } as unknown as ResidenceTaxDetails,
    healthInsurance: breakdown.total,
    pensionPayments: 0,
    employmentInsurance: 0,
    takeHomeIncome: 0,
    furusatoNozei: {} as unknown as FurusatoNozeiDetails,
    dcPlanContributions: 0,
    healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    region,
    ageRange: includeLTC ? ('age40to59' as const) : ('age20to39' as const),
    residenceTaxBasicDeduction: 430_000,
    netBusinessAndMiscIncome: annualIncome,
    totalNetIncome: annualIncome,
    nhiMedicalPortion: breakdown.medicalPortion,
    nhiElderlySupportPortion: breakdown.elderlySupportPortion,
    nhiLongTermCarePortion: breakdown.longTermCarePortion,
    nhiChildSupportPortion: breakdown.childSupportPortion,
    nhiReductionRatios: breakdown.reductionRatios,
    nhiMedicalCapped: breakdown.medicalCapped,
    nhiElderlySupportCapped: breakdown.elderlySupportCapped,
    nhiLongTermCareCapped: breakdown.longTermCareCapped,
    nhiChildSupportCapped: breakdown.childSupportCapped,
    salaryIncome: 0,
    bonusIncome: 0,
    grossEmploymentIncome: 0,
    additionalDeductions: { national: 0, residence: 0, items: [] },
  };

  const inputs: TakeHomeInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [{ id: '1', type: 'business', amount: annualIncome }],
    ageRange: includeLTC ? ('age40to59' as const) : ('age20to39' as const),
    region,
    healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2026,
  };

  return { results, inputs, breakdown };
}

describe('NHIPortionTooltip consistency with calculator', () => {
  // Nakano has both FY2025 and FY2026 data with different rates, triggering blending.
  // FY2025 has no child support; FY2026 introduces it.
  const region = 'Tokyo-Nakano';

  describe('blended year (2026) — tooltip totals match calculator breakdown', () => {
    const { results, inputs, breakdown } = buildNHIScenario(5_000_000, region, false);

    const portionsToTest: { portion: NationalHealthInsurancePortionKey; expected: number }[] = [
      { portion: 'medical', expected: breakdown.medicalPortion },
      { portion: 'elderlySupport', expected: breakdown.elderlySupportPortion },
      { portion: 'childSupport', expected: breakdown.childSupportPortion },
    ];

    it.each(portionsToTest)(
      '$portion tooltip total matches calculator ($expected)',
      ({ portion, expected }) => {
        const { container } = render(
          <NHIPortionTooltip portion={portion} results={results} inputs={inputs} />,
        );
        // The blended total is rendered in a <strong> element.
        const values = Array.from(container.querySelectorAll('strong')).map(el => el.textContent);
        expect(values).toContain(formatJPY(expected));
      },
    );

    it('child support is 7/10 of FY2026 annual (not 100%)', () => {
      expect(breakdown.childSupportPortion).toBeGreaterThan(0);
      // If it were 100%, it would be the full FY2026 amount.
      // The blended amount should be roughly 70% of the full amount.
      // Verify it's less than the full FY2026 calculation by checking the ratio.
      // Full FY2026 child support for 5M income in Nakano: 14,212 (from test comments above)
      // Blended: round(0 * 0.3 + 14212 * 0.7) = 9,948
      expect(breakdown.childSupportPortion).toBe(9_948);
    });
  });

  describe('blended year with LTC', () => {
    const { results, inputs, breakdown } = buildNHIScenario(5_000_000, region, true);

    it('LTC tooltip total matches calculator', () => {
      const { container } = render(
        <NHIPortionTooltip portion="longTermCare" results={results} inputs={inputs} />,
      );
      const values = Array.from(container.querySelectorAll('strong')).map(el => el.textContent);
      expect(values).toContain(formatJPY(breakdown.longTermCarePortion));
    });
  });

  describe('blended year at high income (caps apply)', () => {
    const { results, inputs, breakdown } = buildNHIScenario(20_000_000, region, false);

    const portionsToTest: { portion: NationalHealthInsurancePortionKey; expected: number }[] = [
      { portion: 'medical', expected: breakdown.medicalPortion },
      { portion: 'elderlySupport', expected: breakdown.elderlySupportPortion },
      { portion: 'childSupport', expected: breakdown.childSupportPortion },
    ];

    it.each(portionsToTest)(
      '$portion tooltip total matches calculator at high income ($expected)',
      ({ portion, expected }) => {
        const { container } = render(
          <NHIPortionTooltip portion={portion} results={results} inputs={inputs} />,
        );
        const values = Array.from(container.querySelectorAll('strong')).map(el => el.textContent);
        expect(values).toContain(formatJPY(expected));
      },
    );
  });

  describe("blended year: each fiscal year's amount is rounded before it is weighted", () => {
    // The calculation rounds each fiscal year's portion to the yen and then weights the rounded
    // amounts. Weighting the unrounded amounts instead lands ¥1 away in these cases: Chiyoda's
    // FY2025 medical portion at ¥434,000 (with 5割軽減) is 23,958.4 and its FY2026 one 24,100.4,
    // which weight to 24,057.8 unrounded but 24,057.4 rounded.
    const cases: {
      income: number;
      portion: NationalHealthInsurancePortionKey;
      expected: number;
      total: string;
    }[] = [
      {
        income: 434_000,
        portion: 'medical',
        expected: 24_057,
        total: 'Total: ¥23,958 × 3⁄10 + ¥24,100 × 7⁄10 = ¥24,057',
      },
      {
        income: 435_000,
        portion: 'elderlySupport',
        expected: 8_819,
        total: 'Total: ¥8,535 × 3⁄10 + ¥8,940 × 7⁄10 = ¥8,819',
      },
      {
        income: 436_000,
        portion: 'medical',
        expected: 24_210,
        total: 'Total: ¥24,113 × 3⁄10 + ¥24,251 × 7⁄10 = ¥24,210',
      },
      {
        income: 438_000,
        portion: 'childSupport',
        expected: 671,
        total: 'Total: ¥0 × 3⁄10 + ¥958 × 7⁄10 = ¥671',
      },
    ];

    it.each(cases)(
      'shows the $portion portion of ¥$income in Chiyoda as $total',
      ({ income, portion, expected, total }) => {
        const { results, inputs, breakdown } = buildNHIScenario(income, 'Tokyo-Chiyoda', false);
        const portionAmounts = {
          medical: breakdown.medicalPortion,
          elderlySupport: breakdown.elderlySupportPortion,
          longTermCare: breakdown.longTermCarePortion,
          childSupport: breakdown.childSupportPortion,
        };
        expect(portionAmounts[portion]).toBe(expected);

        const { container } = render(
          <NHIPortionTooltip portion={portion} results={results} inputs={inputs} />,
        );

        expect(container.textContent).toContain(total);
      },
    );
  });

  describe('blended year at low income (均等割額の軽減 applies)', () => {
    const { results, inputs, breakdown } = buildNHIScenario(100_000, region, false);

    it('applies 7割軽減 in both fiscal years', () => {
      expect(breakdown.reductionRatios).toEqual({ prevFY: 0.7, currFY: 0.7 });
    });

    const portionsToTest: { portion: NationalHealthInsurancePortionKey; expected: number }[] = [
      { portion: 'medical', expected: breakdown.medicalPortion },
      { portion: 'elderlySupport', expected: breakdown.elderlySupportPortion },
      { portion: 'childSupport', expected: breakdown.childSupportPortion },
    ];

    it.each(portionsToTest)(
      '$portion tooltip total matches calculator with the reduction ($expected)',
      ({ portion, expected }) => {
        const { container } = render(
          <NHIPortionTooltip portion={portion} results={results} inputs={inputs} />,
        );
        const values = Array.from(container.querySelectorAll('strong')).map(el => el.textContent);
        expect(values).toContain(formatJPY(expected));
      },
    );

    it('renders the reduction math on the per-capita line with a superscript dagger pointing to the footnote', () => {
      const { container } = render(
        <NHIPortionTooltip portion="medical" results={results} inputs={inputs} />,
      );
      expect(container.textContent).toContain('× 30%†');
      const sups = Array.from(container.querySelectorAll('sup')).map(el => el.textContent);
      expect(sups).toContain('†');
      expect(container.textContent).not.toContain('× 30%*');
      expect(container.textContent).not.toContain('× 30% (7割軽減)');
    });

    it('renders the low-income reduction footnote with tier details and municipal source link', () => {
      const { container } = render(
        <NHIPortionTooltip portion="medical" results={results} inputs={inputs} />,
      );
      expect(container.textContent).toContain(
        '† Reflects the statutory 70% (7割軽減) low-income reduction',
      );
      expect(container.textContent).toContain('均等割額の軽減');
      expect(container.textContent).toContain('世田谷区');
      expect(container.textContent).not.toContain('e-Gov');
    });

    it('does not render the low-income reduction footnote when unreduced', () => {
      const { results: highIncomeResults, inputs: highIncomeInputs } = buildNHIScenario(
        2_000_000,
        region,
        false,
      );
      const { container } = render(
        <NHIPortionTooltip
          portion="medical"
          results={highIncomeResults}
          inputs={highIncomeInputs}
        />,
      );
      expect(container.textContent).not.toContain('均等割額の軽減');
    });
  });
});
