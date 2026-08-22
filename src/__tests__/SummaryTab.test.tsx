// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import SummaryTab from '../components/TakeHomeCalculator/tabs/SummaryTab';
import type { TakeHomeResults } from '../types/tax';

const baseResults: TakeHomeResults = {
  annualIncome: 4_000_000,
  healthInsurance: 408_500,
  pensionPayments: 0,
  nationalIncomeTax: 100_000,
  residenceTax: {
    taxableIncome: 0,
    cityProportion: 0,
    prefecturalProportion: 0,
    residenceTaxRate: 0,
    basicDeduction: 0,
    personalDeductionDifference: 0,
    city: {
      cityTaxableIncome: 0,
      cityAdjustmentCredit: 0,
      cityIncomeTax: 0,
      cityPerCapitaTax: 0,
    },
    prefecture: {
      prefecturalTaxableIncome: 0,
      prefecturalAdjustmentCredit: 0,
      prefecturalIncomeTax: 0,
      prefecturalPerCapitaTax: 0,
    },
    perCapitaTax: 0,
    forestEnvironmentTax: 0,
    totalResidenceTax: 200_000,
  },
  takeHomeIncome: 3_000_000,
  healthInsuranceProvider: 'LatterStageElderly',
  region: 'Tokyo',
  ageRange: 'age75plus',
  hasEmploymentIncome: false,
  grossEmploymentIncome: 0,
  totalNetIncome: 4_000_000,
  residenceTaxBasicDeduction: 430_000,
  dcPlanContributions: 0,
  furusatoNozei: {
    limit: 0,
    incomeTaxReduction: 0,
    residenceTaxDonationBasicDeduction: 0,
    residenceTaxSpecialDeduction: 0,
    outOfPocketCost: 0,
    residenceTaxReduction: 0,
  },
  salaryIncome: 0,
  additionalDeductions: { national: 0, residence: 0, items: [] },
  latterStageMedicalPortion: 401_500,
  latterStageChildSupportPortion: 7_000,
};

describe('SummaryTab with the 介護保険第1号 premium', () => {
  it('shows the premium as its own row and includes it in the social insurance total', () => {
    render(<SummaryTab results={{ ...baseResults, longTermCareCategory1Premium: 150_000 }} />);

    expect(screen.getByText('Age 65+ Long-term Care Insurance')).toBeInTheDocument();
    expect(screen.getByText(/^¥150,000/)).toBeInTheDocument();
    // 408,500 health insurance + 0 pension + 150,000 第1号.
    expect(screen.getByText('Total Social Insurance')).toBeInTheDocument();
    expect(screen.getByText(/^¥558,500/)).toBeInTheDocument();
  });

  it('omits the row when no premium applies', () => {
    render(<SummaryTab results={baseResults} />);

    expect(screen.queryByText('Age 65+ Long-term Care Insurance')).not.toBeInTheDocument();
    // Health insurance and the total are both 408,500 with nothing else due.
    expect(screen.getAllByText(/^¥408,500/)).toHaveLength(2);
  });
});
