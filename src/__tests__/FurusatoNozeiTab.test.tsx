// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import FurusatoNozeiTab from '../components/TakeHomeCalculator/tabs/FurusatoNozeiTab';
import {
  makeFurusatoNozeiDetails,
  makeResidenceTaxDetails,
  makeTakeHomeResults,
} from './fixtures/takeHomeResults';

/** The text of the whole result row whose label is `label`: the label and its value. */
const resultRowText = (label: string) =>
  screen.getByText(label).closest('div')!.parentElement!.textContent;

describe('FurusatoNozeiTab', () => {
  it("shows each level's share of the residence tax credit as the calculation applied it", () => {
    // The credit is 12,337: 7,402.2 municipal and 4,934.8 prefectural before each is rounded up.
    // The rows show the rounded-up shares from the results, not shares rounded here.
    const results = makeTakeHomeResults({
      residenceTax: makeResidenceTaxDetails({ cityProportion: 0.6, prefecturalProportion: 0.4 }),
      furusatoNozei: makeFurusatoNozeiDetails({
        limit: 15_000,
        residenceTaxDonationBasicDeduction: 1_300,
        residenceTaxSpecialDeduction: 11_037,
        municipalTaxCredit: 7_403,
        prefecturalTaxCredit: 4_935,
        residenceTaxReduction: 12_300,
        incomeTaxReduction: 600,
        outOfPocketCost: 2_100,
      }),
    });

    render(<FurusatoNozeiTab results={results} />);

    expect(resultRowText('Municipal tax credit')).toContain('¥7,403');
    expect(resultRowText('Prefectural tax credit')).toContain('¥4,935');
  });

  it('shows the placeholder when there is no limit', () => {
    render(<FurusatoNozeiTab results={makeTakeHomeResults()} />);

    expect(screen.getByText('No Furusato Nozei Data Available')).toBeInTheDocument();
  });
});
