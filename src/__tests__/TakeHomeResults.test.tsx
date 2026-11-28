// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import TakeHomeResultsDisplay from '../components/TakeHomeCalculator/TakeHomeResults';
import { theme } from '../theme';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import type { TakeHomeInputs, TakeHomeResults } from '../types/tax';
import { DEFAULT_INCOME_YEAR, EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { makeFurusatoNozeiDetails, makeTakeHomeResults } from './fixtures/takeHomeResults';

const baseInputs: TakeHomeInputs = {
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  incomeStreams: [{ type: 'salary', amount: 5_000_000, frequency: 'annual', id: 's1' }],
  ageRange: 'age20to39',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  region: 'Tokyo',
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: DEFAULT_INCOME_YEAR,
};

describe('TakeHomeResults Furusato tab warning icon', () => {
  it('does not render warning icon in Furusato tab label when out-of-pocket cost is nominal', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 5_800,
        residenceTaxReduction: 52_200,
      }),
    });

    render(
      <ThemeProvider theme={theme}>
        <TakeHomeResultsDisplay results={results} inputs={baseInputs} />
      </ThemeProvider>,
    );

    expect(screen.queryByTitle('High out-of-pocket cost')).not.toBeInTheDocument();
  });

  it('renders orange warning icon in Furusato tab label when out-of-pocket cost is high', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 60_000,
        incomeTaxReduction: 0,
        residenceTaxReduction: 50_000,
      }),
    });

    render(
      <ThemeProvider theme={theme}>
        <TakeHomeResultsDisplay results={results} inputs={baseInputs} />
      </ThemeProvider>,
    );

    const titleEl = screen.getByTitle('High out-of-pocket cost');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.parentElement).toHaveClass('MuiSvgIcon-colorWarning');
  });

  it('does not render warning icon in Furusato tab label when taxable temporary income causes zero additional cost', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 2_200_000,
        incomeTaxReduction: 1_009_900,
        residenceTaxReduction: 1_188_100,
        temporaryIncomeEffect: { nationalIncomeTax: 0, residenceTax: 0, total: 0 },
      }),
    });

    render(
      <ThemeProvider theme={theme}>
        <TakeHomeResultsDisplay results={results} inputs={baseInputs} />
      </ThemeProvider>,
    );

    expect(screen.queryByTitle('Estimated taxable temporary income')).not.toBeInTheDocument();
    expect(screen.queryByTitle('High out-of-pocket cost')).not.toBeInTheDocument();
  });

  it('renders orange warning icon in Furusato tab label when temporary income adds cost within ¥2,200 margin', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 1_554_000,
        incomeTaxReduction: 633_000,
        residenceTaxReduction: 919_000,
        temporaryIncomeEffect: { nationalIncomeTax: 100, residenceTax: 0, total: 100 },
      }),
    });

    render(
      <ThemeProvider theme={theme}>
        <TakeHomeResultsDisplay results={results} inputs={baseInputs} />
      </ThemeProvider>,
    );

    const titleEl = screen.getByTitle('Estimated taxable temporary income');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.parentElement).toHaveClass('MuiSvgIcon-colorWarning');
  });

  it('combines warning title when temporary income effect or donation cost raises out-of-pocket cost', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 2_200_000,
        incomeTaxReduction: 1_009_900,
        residenceTaxReduction: 1_188_100,
        temporaryIncomeEffect: {
          nationalIncomeTax: 47_800,
          residenceTax: 10_400,
          total: 58_200,
        },
      }),
    });

    render(
      <ThemeProvider theme={theme}>
        <TakeHomeResultsDisplay results={results} inputs={baseInputs} />
      </ThemeProvider>,
    );

    const titleEl = screen.getByTitle(
      'High out-of-pocket cost and estimated taxable temporary income',
    );
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.parentElement).toHaveClass('MuiSvgIcon-colorWarning');
  });

  it('uses tax-return-specific warning title when One-Stop avoids high out-of-pocket cost', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 98_000,
        incomeTaxReduction: 9_800,
        residenceTaxReduction: 76_400,
        oneStop: {
          eligible: true,
          residenceTaxDeclarationSpecialCredit: 19_605,
          municipalTaxCredit: 57_602,
          prefecturalTaxCredit: 38_401,
          residenceTaxReduction: 96_000,
        },
      }),
    });

    render(
      <ThemeProvider theme={theme}>
        <TakeHomeResultsDisplay results={results} inputs={baseInputs} />
      </ThemeProvider>,
    );

    const titleEl = screen.getByTitle('High out-of-pocket cost when filing a tax return');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.parentElement).toHaveClass('MuiSvgIcon-colorWarning');
  });

  it('uses standard high out-of-pocket warning title when One-Stop cost is also elevated', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 50_000,
        incomeTaxReduction: 0,
        residenceTaxReduction: 40_000,
        oneStop: {
          eligible: true,
          residenceTaxDeclarationSpecialCredit: 5_000,
          municipalTaxCredit: 27_000,
          prefecturalTaxCredit: 18_000,
          residenceTaxReduction: 40_000,
        },
      }),
    });

    render(
      <ThemeProvider theme={theme}>
        <TakeHomeResultsDisplay results={results} inputs={baseInputs} />
      </ThemeProvider>,
    );

    const titleEl = screen.getByTitle('High out-of-pocket cost');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.parentElement).toHaveClass('MuiSvgIcon-colorWarning');
  });

  it('uses One-Stop-specific warning title when One-Stop cost is elevated while Tax Return is nominal', () => {
    const results: TakeHomeResults = makeTakeHomeResults({
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 50_000,
        incomeTaxReduction: 8_000,
        residenceTaxReduction: 40_000,
        oneStop: {
          eligible: true,
          residenceTaxDeclarationSpecialCredit: 5_000,
          municipalTaxCredit: 27_000,
          prefecturalTaxCredit: 18_000,
          residenceTaxReduction: 40_000,
        },
      }),
    });

    render(
      <ThemeProvider theme={theme}>
        <TakeHomeResultsDisplay results={results} inputs={baseInputs} />
      </ThemeProvider>,
    );

    const titleEl = screen.getByTitle('High out-of-pocket cost when using One-Stop');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.parentElement).toHaveClass('MuiSvgIcon-colorWarning');
  });
});
