// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_PROVIDER } from '../../types/healthInsurance';
import type { FurusatoNozeiDetails, ResidenceTaxDetails, TakeHomeResults } from '../../types/tax';

/**
 * Builds a complete {@link ResidenceTaxDetails} with every amount zeroed, so a test can
 * name only the figures it asserts on.
 */
export const makeResidenceTaxDetails = (
  overrides: Partial<ResidenceTaxDetails> = {},
): ResidenceTaxDetails => ({
  taxableIncome: 0,
  cityProportion: 0,
  prefecturalProportion: 0,
  residenceTaxRate: 0,
  basicDeduction: 0,
  personalDeductionDifference: 0,
  city: { cityTaxableIncome: 0, cityAdjustmentCredit: 0, cityIncomeTax: 0, cityPerCapitaTax: 0 },
  prefecture: {
    prefecturalTaxableIncome: 0,
    prefecturalAdjustmentCredit: 0,
    prefecturalIncomeTax: 0,
    prefecturalPerCapitaTax: 0,
  },
  perCapitaTax: 0,
  forestEnvironmentTax: 0,
  totalResidenceTax: 0,
  ...overrides,
});

/** Builds a complete {@link FurusatoNozeiDetails} with every amount zeroed. */
export const makeFurusatoNozeiDetails = (
  overrides: Partial<FurusatoNozeiDetails> = {},
): FurusatoNozeiDetails => ({
  limit: 0,
  incomeTaxReduction: 0,
  residenceTaxDonationBasicDeduction: 0,
  residenceTaxSpecialDeduction: 0,
  outOfPocketCost: 0,
  residenceTaxReduction: 0,
  ...overrides,
});

/**
 * Builds a complete {@link TakeHomeResults} for component and cap-detection tests, with
 * every required field present and zeroed. Overrides replace whole fields, so pass a
 * {@link makeResidenceTaxDetails} or {@link makeFurusatoNozeiDetails} result to vary the
 * nested details.
 */
export const makeTakeHomeResults = (overrides: Partial<TakeHomeResults> = {}): TakeHomeResults => ({
  annualIncome: 0,
  hasEmploymentIncome: false,
  nationalIncomeTax: 0,
  residenceTax: makeResidenceTaxDetails(),
  healthInsurance: 0,
  pensionPayments: 0,
  takeHomeIncome: 0,
  grossEmploymentIncome: 0,
  totalNetIncome: 0,
  furusatoNozei: makeFurusatoNozeiDetails(),
  additionalDeductions: { national: 0, residence: 0, items: [] },
  dcPlanContributions: 0,
  salaryIncome: 0,
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  ageRange: 'age20to39',
  ...overrides,
});
