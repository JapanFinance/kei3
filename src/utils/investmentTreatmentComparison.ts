// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  DEFAULT_REPORTED_DIVIDENDS_TAXATION,
  type IncomeStream,
  type ReportedDividendsTaxation,
  type TakeHomeInputs,
  type TakeHomeResults,
} from '../types/tax';
import { withRequiredReporting } from './investmentReporting';
import { calculateTaxes } from './taxCalculations';

export type InvestmentTreatmentColumnKey = 'withheldOnly' | 'separate' | 'aggregate';

/**
 * What a comparison column sets: whether every listed-share entry goes on the return, and the
 * election that then taxes the reported dividends ({@link ReportedDividendsTaxation}). A share
 * sale has no election of its own — reported, it is 申告分離課税 (措法37条の11) in every column.
 */
export interface InvestmentTreatmentElection {
  isReported: boolean;
  reportedDividendsTaxation: ReportedDividendsTaxation;
}

export interface InvestmentTreatmentColumnDefinition {
  key: InvestmentTreatmentColumnKey;
  label: string;
  election: InvestmentTreatmentElection;
}

/** The three elections compared, in display order. */
export const INVESTMENT_TREATMENT_COLUMNS: readonly InvestmentTreatmentColumnDefinition[] = [
  {
    key: 'withheldOnly',
    label: '申告不要',
    election: {
      isReported: false,
      reportedDividendsTaxation: DEFAULT_REPORTED_DIVIDENDS_TAXATION,
    },
  },
  {
    key: 'separate',
    label: '申告分離課税',
    election: { isReported: true, reportedDividendsTaxation: 'separate' },
  },
  {
    key: 'aggregate',
    label: '総合課税',
    election: { isReported: true, reportedDividendsTaxation: 'aggregate' },
  },
];

/**
 * The figures compared across the elections. Each is the same money under every column: tax
 * withheld at source on 申告不要 amounts is counted with the tax the return assesses, and the
 * 申告不要 amounts net of that withholding are counted with take-home pay — the summary keeps
 * them apart (see TakeHomeResults.annualIncome), but a comparison of elections has to put the
 * same income on both sides.
 */
export interface InvestmentTreatmentFigures {
  /** Take-home pay plus the 申告不要 investment income net of the tax withheld on it. */
  kept: number;
  /** 所得税 the return assesses plus the 所得税 withheld at source. */
  incomeTax: number;
  /** 住民税 the return assesses plus the 住民税 withheld at source. */
  residenceTax: number;
  socialInsurance: number;
  furusatoNozeiLimit: number;
}

export interface InvestmentTreatmentColumn extends InvestmentTreatmentColumnDefinition {
  /** Whether the entries and the election already stand as this column would set them. */
  isCurrent: boolean;
  figures: InvestmentTreatmentFigures;
}

const isListedShareStream = (stream: IncomeStream) =>
  stream.type === 'withholdingAccount' ||
  stream.type === 'capitalGains' ||
  stream.type === 'dividends';

/**
 * `streams` with the election applied to every unit that can carry it: a withholding account's
 * two flags, and a domestic dividend's `isReported`. A capital-gains sale outside an account and
 * a dividend paid abroad are always reported, so they are left as they are.
 * {@link withRequiredReporting} re-applies the rules that can force a flag back to reported.
 */
const applyElection = (
  streams: readonly IncomeStream[],
  election: InvestmentTreatmentElection,
): IncomeStream[] => {
  const elected: IncomeStream[] = [];
  for (const stream of streams) {
    switch (stream.type) {
      case 'withholdingAccount':
        elected.push(
          withRequiredReporting({
            ...stream,
            reportsCapitalGains: election.isReported,
            reportsDividends: election.isReported,
          }),
        );
        break;
      case 'dividends':
        elected.push(
          stream.paymentChannel === 'domestic'
            ? withRequiredReporting({ ...stream, isReported: election.isReported })
            : stream,
        );
        break;
      default:
        elected.push(stream);
    }
  }
  return elected;
};

const figuresOf = (results: TakeHomeResults): InvestmentTreatmentFigures => {
  const withheld = results.investmentIncome?.withheld ?? { national: 0, residence: 0, total: 0 };
  const withheldGross = results.investmentIncome?.grossTotal ?? 0;
  return {
    kept: results.takeHomeIncome + withheldGross - withheld.total,
    incomeTax: results.nationalIncomeTax + withheld.national,
    residenceTax: results.residenceTax.totalResidenceTax + withheld.residence,
    socialInsurance:
      results.socialInsuranceOverride ??
      results.healthInsurance +
        results.pensionPayments +
        (results.employmentInsurance ?? 0) +
        (results.longTermCareCategory1Premium ?? 0),
    furusatoNozeiLimit: results.furusatoNozei.limit,
  };
};

/**
 * Runs the calculation once per election in {@link INVESTMENT_TREATMENT_COLUMNS}, applying it to
 * every unit that can carry it — a withholding account's two flags, and a domestic dividend's —
 * so the elections can be set side by side. A capital-gains sale outside a withholding account
 * and a dividend paid abroad are always reported, so they stay reported in every column; interest
 * carries no election and is left as entered. The 総合課税 column has no 配当控除, which is not
 * yet modelled.
 */
export function compareInvestmentTreatments(inputs: TakeHomeInputs): InvestmentTreatmentColumn[] {
  const listedStreams = inputs.incomeStreams.filter(isListedShareStream);
  const currentElection = inputs.reportedDividendsTaxation ?? DEFAULT_REPORTED_DIVIDENDS_TAXATION;

  // Whether every optional reporting choice among listedStreams already matches `election`: each
  // withholding account's two flags, and each domestic dividend's `isReported`. A capital-gains
  // sale outside an account and a dividend paid abroad are fixed rather than optional, so they
  // take no part in this; with no optional choice to compare, no column is current.
  const isCurrent = (election: InvestmentTreatmentElection): boolean => {
    let hasOptionalUnit = false;
    for (const stream of listedStreams) {
      if (stream.type === 'withholdingAccount') {
        hasOptionalUnit = true;
        if (
          stream.reportsCapitalGains !== election.isReported ||
          stream.reportsDividends !== election.isReported
        ) {
          return false;
        }
      } else if (stream.type === 'dividends' && stream.paymentChannel === 'domestic') {
        hasOptionalUnit = true;
        if (stream.isReported !== election.isReported) {
          return false;
        }
      }
    }
    return (
      hasOptionalUnit &&
      (!election.isReported || election.reportedDividendsTaxation === currentElection)
    );
  };

  const columns: InvestmentTreatmentColumn[] = [];
  for (const column of INVESTMENT_TREATMENT_COLUMNS) {
    const results = calculateTaxes({
      ...inputs,
      incomeStreams: applyElection(inputs.incomeStreams, column.election),
      reportedDividendsTaxation: column.election.reportedDividendsTaxation,
    });
    columns.push({
      ...column,
      isCurrent: isCurrent(column.election),
      figures: figuresOf(results),
    });
  }
  return columns;
}
