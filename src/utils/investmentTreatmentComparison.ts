// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  DEFAULT_REPORTED_DIVIDENDS_TAXATION,
  type IncomeStream,
  type ReportedDividendsTaxation,
  type TakeHomeInputs,
  type TakeHomeResults,
} from '../types/tax';
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
  /** The figures, or absent when {@link unavailableReason} says why the election is not open. */
  figures?: InvestmentTreatmentFigures;
  unavailableReason?: string;
}

const isListedShareStream = (stream: IncomeStream) =>
  stream.type === 'capitalGains' || stream.type === 'dividends';

const applyElection = (
  streams: readonly IncomeStream[],
  election: InvestmentTreatmentElection,
): IncomeStream[] => {
  const elected: IncomeStream[] = [];
  for (const stream of streams) {
    switch (stream.type) {
      case 'capitalGains':
      case 'dividends':
        elected.push({ ...stream, isReported: election.isReported });
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
 * Runs the calculation once per election in {@link INVESTMENT_TREATMENT_COLUMNS}, with every
 * listed-share entry reported or not as the column says and the reported dividends taxed under
 * its election, so the elections can be set side by side. Interest carries no election and is
 * left as entered.
 *
 * 申告不要 is open only while every sale settles in a 特定口座（源泉徴収あり）
 * (措法37条の11の5); with a sale anywhere else the column is marked unavailable instead of
 * being computed. The 総合課税 column has no 配当控除, which is not yet modelled.
 */
export function compareInvestmentTreatments(inputs: TakeHomeInputs): InvestmentTreatmentColumn[] {
  const listedStreams = inputs.incomeStreams.filter(isListedShareStream);
  const currentElection = inputs.reportedDividendsTaxation ?? DEFAULT_REPORTED_DIVIDENDS_TAXATION;
  const saleOutsideWithholdingAccount = inputs.incomeStreams.some(
    s => s.type === 'capitalGains' && s.account !== 'specifiedWithholding',
  );

  const columns: InvestmentTreatmentColumn[] = [];
  for (const column of INVESTMENT_TREATMENT_COLUMNS) {
    const isCurrent =
      listedStreams.length > 0 &&
      listedStreams.every(s => s.isReported === column.election.isReported) &&
      (!column.election.isReported ||
        column.election.reportedDividendsTaxation === currentElection);
    if (column.key === 'withheldOnly' && saleOutsideWithholdingAccount) {
      columns.push({
        ...column,
        isCurrent,
        unavailableReason:
          'A sale outside a 特定口座（源泉徴収あり）has to be reported (措法37条の11の5).',
      });
      continue;
    }
    const results = calculateTaxes({
      ...inputs,
      incomeStreams: applyElection(inputs.incomeStreams, column.election),
      reportedDividendsTaxation: column.election.reportedDividendsTaxation,
    });
    columns.push({ ...column, isCurrent, figures: figuresOf(results) });
  }
  return columns;
}
