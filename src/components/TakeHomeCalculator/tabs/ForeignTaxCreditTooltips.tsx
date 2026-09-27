// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { ForeignTaxCreditAmounts, ForeignTaxCreditResult } from '../../../types/tax';
import {
  MUNICIPAL_LIMIT_PERCENT,
  PREFECTURAL_LIMIT_PERCENT,
} from '../../../utils/foreignTaxCredit';
import { formatJPY } from '../../../utils/formatters';
import SourceLinks, { type Source } from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

const SOURCES: Source[] = [
  {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1240.htm',
    label: 'Foreign tax credit (外国税額控除) - NTA',
  },
  {
    href: 'https://laws.e-gov.go.jp/law/340AC0000000033#Mp-Pa_2-Ch_3-Se_2-At_95',
    label: 'Income Tax Act, Article 95 (所得税法第95条) - e-Gov',
  },
];

interface AmountRow {
  label: string;
  amount: number;
  /** Drawn in bold under a rule, as the result of the rows above it. */
  isResult?: boolean;
  /** Indented and muted: a part of the row above it. */
  isPart?: boolean;
}

const AmountTable: React.FC<{ rows: AmountRow[] }> = ({ rows }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: 8 }}>
    <tbody>
      {rows.map((row, index) => (
        <Box
          component="tr"
          key={index}
          sx={{
            ...(row.isResult && { borderTop: '1px solid', borderColor: 'divider' }),
            ...(row.isPart && { color: 'text.secondary' }),
          }}
        >
          <Box
            component="td"
            sx={{
              py: row.isResult ? '4px' : '2px',
              pl: row.isPart ? 1.5 : 0,
              fontWeight: row.isResult ? 600 : 400,
            }}
          >
            {row.label}:
          </Box>
          <Box
            component="td"
            sx={{
              py: row.isResult ? '4px' : '2px',
              textAlign: 'right',
              fontWeight: row.isResult ? 600 : 500,
            }}
          >
            {formatJPY(row.amount)}
          </Box>
        </Box>
      ))}
    </tbody>
  </table>
);

/**
 * The rows for F, and for its part entered by hand. F is named for what it is when some foreign
 * tax was paid on dividends left to withholding, which F leaves out.
 */
const foreignTaxRows = (
  credit: ForeignTaxCreditResult,
  withheldForeignTax: number,
): AmountRow[] => [
  {
    label: withheldForeignTax > 0 ? 'Foreign tax eligible for the credit' : 'Foreign tax paid',
    amount: credit.foreignTax,
  },
  ...(credit.manualForeignTax
    ? [
        {
          label: 'Entered in Additional Deductions & Credits',
          amount: credit.manualForeignTax,
          isPart: true,
        },
      ]
    : []),
];

const ExcessNote: React.FC<{ excess: number }> = ({ excess }) =>
  excess > 0 ? (
    <Typography variant="body2" sx={{ mb: 1 }}>
      {formatJPY(excess)} of the foreign tax is above every limit (控除限度超過額). In law it
      carries forward for three years, which is not supported.
    </Typography>
  ) : null;

/** Why foreign tax on dividends left to withholding is not credited, and what would change that. */
const WithheldForeignTaxNote: React.FC<{ withheldForeignTax: number; isAll: boolean }> = ({
  withheldForeignTax,
  isAll,
}) => (
  <Typography variant="body2" sx={{ mb: 1 }}>
    {isAll
      ? `All the foreign tax paid, ${formatJPY(withheldForeignTax)}, is on dividends left to withholding.`
      : `The ${formatJPY(withheldForeignTax)} of foreign tax on dividends left to withholding is not included.`}{' '}
    Foreign tax on dividends left to withholding is not credited (措令4条の5⑫); instead, the
    Japanese withholding is charged on the dividends after it (措法9条の2③). Reporting the dividends
    would let the foreign tax be credited, within the limits.
  </Typography>
);

interface ForeignTaxCreditTooltipProps {
  /** Absent when all the foreign tax paid is on dividends left to withholding. */
  credit?: ForeignTaxCreditResult | undefined;
  /** Which of the Taxes tab's two Foreign Tax Credit rows the tooltip explains. */
  part: 'national' | 'residence';
  /** The residence credit each side's income-based portion absorbed; absent when none was. */
  applied?: Pick<ForeignTaxCreditAmounts, 'city' | 'prefecture'> | undefined;
  /** Foreign tax on dividends left to withholding, which is never credited. */
  withheldForeignTax?: number | undefined;
}

/**
 * Tooltip for the Taxes tab's Foreign Tax Credit rows: the limits and the credit against income
 * tax and the reconstruction surtax, or against the two residence taxes. The rows are shown
 * whenever foreign tax was paid, so when all of it is on dividends left to withholding the
 * tooltip says why nothing is credited. Renders its own DetailedTooltip trigger, so callers place
 * it directly after the row label.
 */
export const ForeignTaxCreditTooltip: React.FC<ForeignTaxCreditTooltipProps> = ({
  credit,
  part,
  applied,
  withheldForeignTax = 0,
}) => {
  if (!credit) {
    return (
      <DetailedTooltip
        title={
          part === 'national'
            ? 'Foreign Tax Credit — Income Tax'
            : 'Foreign Tax Credit — Residence Tax'
        }
      >
        <Box>
          <WithheldForeignTaxNote withheldForeignTax={withheldForeignTax} isAll />
          <SourceLinks sources={SOURCES} />
        </Box>
      </DetailedTooltip>
    );
  }

  const leftForResidenceTax =
    credit.foreignTax - credit.credit.incomeTax - credit.credit.reconstructionSurtax;
  const foreignSourceIncomeIsCapped =
    credit.foreignSourceIncome > credit.adjustedForeignSourceIncome;

  if (part === 'national') {
    return (
      <DetailedTooltip title="Foreign Tax Credit — Income Tax">
        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Foreign tax (外国所得税) on income from outside Japan is credited against the Japanese
            income tax, up to the part of the income tax that falls on the foreign-source income:
            the income tax times the foreign-source income, divided by the total net income. The
            reconstruction surtax has a limit worked out the same way and takes what the income tax
            limit leaves; the rest goes to residence tax.
          </Typography>
          <AmountTable
            rows={[
              ...foreignTaxRows(credit, withheldForeignTax),
              { label: 'Income tax, after the home loan tax credit', amount: credit.incomeTax },
              { label: 'Foreign-source income', amount: credit.foreignSourceIncome },
              ...(credit.manualForeignSourceIncome
                ? [
                    {
                      label: 'Entered in Additional Deductions & Credits',
                      amount: credit.manualForeignSourceIncome,
                      isPart: true,
                    },
                  ]
                : []),
              ...(foreignSourceIncomeIsCapped
                ? [
                    {
                      label: 'Capped at the total net income',
                      amount: credit.adjustedForeignSourceIncome,
                      isPart: true,
                    },
                  ]
                : []),
              { label: 'Total net income', amount: credit.totalIncome },
              { label: 'Income tax limit', amount: credit.limit.incomeTax, isResult: true },
              { label: 'Reconstruction surtax limit', amount: credit.limit.reconstructionSurtax },
              {
                label: 'Credited against income tax',
                amount: credit.credit.incomeTax,
                isResult: true,
              },
              {
                label: 'Credited against the reconstruction surtax',
                amount: credit.credit.reconstructionSurtax,
              },
              { label: 'Left for residence tax', amount: leftForResidenceTax },
            ]}
          />
          {credit.limit.incomeTax === 0 && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              With no income tax or no foreign-source income there is no limit, so nothing is
              credited.
            </Typography>
          )}
          <Typography variant="body2" sx={{ mb: 1 }}>
            The credit is applied in this order: income tax, reconstruction surtax, prefectural tax,
            municipal tax. Each limit is rounded down to the yen.
          </Typography>
          {withheldForeignTax > 0 && (
            <WithheldForeignTaxNote withheldForeignTax={withheldForeignTax} isAll={false} />
          )}
          <SourceLinks sources={SOURCES} />
        </Box>
      </DetailedTooltip>
    );
  }

  const appliedPrefecture = applied?.prefecture ?? 0;
  const appliedCity = applied?.city ?? 0;
  const cappedAtIncomeBasedPortion =
    appliedPrefecture < credit.credit.prefecture || appliedCity < credit.credit.city;

  return (
    <DetailedTooltip title="Foreign Tax Credit — Residence Tax">
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Foreign tax the income tax limits leave is credited against residence tax: first the
          prefectural tax, up to {PREFECTURAL_LIMIT_PERCENT}% of the income tax limit, then the
          municipal tax, up to {MUNICIPAL_LIMIT_PERCENT}%. In a designated city (政令指定都市) the
          limits are 6% and 24% instead, which is not supported; the total is the same.
        </Typography>
        <AmountTable
          rows={[
            ...foreignTaxRows(credit, withheldForeignTax),
            { label: 'Left after income tax and the surtax', amount: leftForResidenceTax },
            {
              label: `Prefectural limit (${PREFECTURAL_LIMIT_PERCENT}%)`,
              amount: credit.limit.prefecture,
            },
            { label: `Municipal limit (${MUNICIPAL_LIMIT_PERCENT}%)`, amount: credit.limit.city },
            {
              label: 'Credited against prefectural tax',
              amount: appliedPrefecture,
              isResult: true,
            },
            { label: 'Credited against municipal tax', amount: appliedCity },
          ]}
        />
        <Typography variant="body2" sx={{ mb: 1 }}>
          Each side's credit is capped at that side's income-based portion (所得割), and a credit
          one side cannot use does not move to the other.
          {cappedAtIncomeBasedPortion &&
            ` Here the income-based portion capped the credit, which was ${formatJPY(credit.credit.prefecture)} prefectural and ${formatJPY(credit.credit.city)} municipal.`}{' '}
          The income-based portion is rounded down to ¥100 after the credit.
        </Typography>
        <ExcessNote excess={credit.excess} />
        {withheldForeignTax > 0 && (
          <WithheldForeignTaxNote withheldForeignTax={withheldForeignTax} isAll={false} />
        )}
        <SourceLinks sources={SOURCES} />
      </Box>
    </DetailedTooltip>
  );
};

interface ForeignTaxPaidTooltipProps {
  foreignTaxPaid: number;
  /** The creditable part: foreign tax on reported income and entered by hand. */
  credit?: ForeignTaxCreditResult | undefined;
  /** Foreign tax on dividends left to withholding. */
  withheldForeignTax?: number | undefined;
}

/**
 * Tooltip for the Taxes tab's Foreign Tax Paid row: the foreign tax counted as paid for the year,
 * which part of it the foreign tax credit can credit, and which part it cannot. Renders its own
 * DetailedTooltip trigger.
 */
export const ForeignTaxPaidTooltip: React.FC<ForeignTaxPaidTooltipProps> = ({
  foreignTaxPaid,
  credit,
  withheldForeignTax = 0,
}) => (
  <DetailedTooltip title="Foreign Tax Paid">
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Foreign tax (外国所得税) is a tax on the income like any other, so it comes off take-home
        pay. It is counted in the income tax total, beside the Japanese income tax.
      </Typography>
      <AmountTable
        rows={[
          ...(credit
            ? [
                {
                  label: 'On reported income, credited within the limits',
                  amount: credit.foreignTax,
                },
                ...(credit.manualForeignTax
                  ? [
                      {
                        label: 'Entered in Additional Deductions & Credits',
                        amount: credit.manualForeignTax,
                        isPart: true,
                      },
                    ]
                  : []),
              ]
            : []),
          ...(withheldForeignTax > 0
            ? [
                {
                  label: 'On dividends left to withholding, not credited',
                  amount: withheldForeignTax,
                },
              ]
            : []),
          { label: 'Foreign tax paid', amount: foreignTaxPaid, isResult: true },
        ]}
      />
      {credit && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          Foreign tax on reported income is credited against the Japanese income tax and residence
          tax up to the limits shown on the Foreign Tax Credit rows.
        </Typography>
      )}
      {withheldForeignTax > 0 && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          Foreign tax on dividends left to withholding is not credited (措令4条の5⑫); instead, the
          Japanese withholding is charged on the dividends after it (措法9条の2③).
        </Typography>
      )}
      {credit?.manualForeignTax !== undefined && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          The amount entered in Additional Deductions & Credits is taken as paid in this year.
        </Typography>
      )}
      <SourceLinks sources={SOURCES} />
    </Box>
  </DetailedTooltip>
);
