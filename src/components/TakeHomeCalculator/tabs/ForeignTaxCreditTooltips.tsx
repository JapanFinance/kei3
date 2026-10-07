// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { ForeignTaxCreditResult } from '../../../types/tax';
import {
  MUNICIPAL_LIMIT_PERCENT,
  PREFECTURAL_LIMIT_PERCENT,
} from '../../../utils/foreignTaxCredit';
import { formatJPY } from '../../../utils/formatters';
import SourceLinks, { type Source } from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

const NTA_SOURCE: Source = {
  href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1240.htm',
  label: 'Foreign tax credit (外国税額控除) - NTA',
};

const SOURCES: Source[] = [
  NTA_SOURCE,
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

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="body2" sx={{ mb: 1 }}>
    {children}
  </Typography>
);

const Formula: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
    {children}
  </Typography>
);

/** Why foreign tax on dividends left to withholding is not credited, and what would change that. */
const WithheldForeignTaxNote: React.FC<{ withheldForeignTax: number; isAll: boolean }> = ({
  withheldForeignTax,
  isAll,
}) => (
  <Note>
    {isAll
      ? `All the foreign tax paid, ${formatJPY(withheldForeignTax)}, is on dividends left to withholding.`
      : `The ${formatJPY(withheldForeignTax)} of foreign tax on dividends left to withholding is not eligible.`}{' '}
    Foreign tax on dividends left to withholding is not credited (措令4条の5⑫); instead, the
    Japanese withholding is charged on the dividends after it (措法9条の2③). Reporting the dividends
    would let the foreign tax be credited, within the limits.
  </Note>
);

/**
 * Whether the credit has figures to break down: false when all the foreign tax paid is on
 * dividends left to withholding, which leaves no result or a result with no foreign tax.
 */
export const hasForeignTaxCreditDetails = (
  credit: ForeignTaxCreditResult | undefined,
): credit is ForeignTaxCreditResult => credit !== undefined && credit.foreignTax > 0;

interface ForeignTaxCreditTooltipProps {
  credit?: ForeignTaxCreditResult | undefined;
  /** Foreign tax on dividends left to withholding, which is never credited. */
  withheldForeignTax?: number | undefined;
}

/**
 * Tooltip for the Taxes tab's "Foreign Tax Credit" row (income tax side): what the credit is and
 * what the row shows, with the figures left to the two rows below it — "Income tax credit" and
 * "Surtax credit". The residence-tax side folds its foreign tax credit into the "Tax credit
 * (municipal/prefectural)" rows instead ({@link import("./ResidenceTaxCreditTooltip").default}),
 * since it, like the adjustment credit, only ever reduces the income-based portion (所得割), not a
 * fixed amount like income tax. The row is shown whenever foreign tax was paid, so when all of it
 * is on dividends left to withholding the tooltip says why nothing is credited instead. Renders
 * its own DetailedTooltip trigger.
 */
export const ForeignTaxCreditTooltip: React.FC<ForeignTaxCreditTooltipProps> = ({
  credit,
  withheldForeignTax = 0,
}) => (
  <DetailedTooltip title="Foreign Tax Credit — Income Tax">
    <Box>
      {!hasForeignTaxCreditDetails(credit) ? (
        <WithheldForeignTaxNote withheldForeignTax={withheldForeignTax} isAll />
      ) : (
        <>
          <Note>
            Foreign tax (外国所得税) on income from outside Japan comes off Japanese tax, up to
            limits, so the same income is not taxed twice. It comes off in this order: income tax,
            reconstruction surtax, prefectural tax, municipal tax.
          </Note>
          <Note>This row is what came off the income tax and the surtax.</Note>
        </>
      )}
      <SourceLinks sources={SOURCES} />
    </Box>
  </DetailedTooltip>
);

interface CreditFiguresProps {
  credit: ForeignTaxCreditResult;
}

/**
 * Tooltip for the "Income tax credit" row: what foreign tax is eligible (F), what counts as
 * foreign-source income (A) and its cap, the income tax limit formula (L = ⌊B × A / T⌋), and the
 * amount actually credited — the smaller of F and L. This is the first of the two rows under the
 * Foreign Tax Credit collapse, and it and the surtax credit row below it sum to the header value.
 */
export const IncomeTaxCreditTooltip: React.FC<
  CreditFiguresProps & { withheldForeignTax?: number | undefined }
> = ({ credit, withheldForeignTax = 0 }) => (
  <DetailedTooltip title="Income Tax Credit">
    <Box>
      <Note>
        Foreign tax on income reported on the tax return and on pensions from a foreign system is
        eligible, and so is foreign tax paid with a foreign tax return.
      </Note>
      {credit.manualForeignTax !== undefined && (
        <AmountTable
          rows={[
            ...(credit.foreignTax > credit.manualForeignTax
              ? [
                  {
                    label: 'Entered with income entries',
                    amount: credit.foreignTax - credit.manualForeignTax,
                  },
                ]
              : []),
            { label: 'Paid with a foreign tax return', amount: credit.manualForeignTax },
            { label: 'Eligible for the credit', amount: credit.foreignTax, isResult: true },
          ]}
        />
      )}
      {withheldForeignTax > 0 && (
        <WithheldForeignTaxNote withheldForeignTax={withheldForeignTax} isAll={false} />
      )}
      <Note>
        Income from outside Japan (国外所得) — dividends from a foreign company or fund that are
        reported on the tax return, interest paid outside Japan, and a pension from a foreign system
        — is capped at the total net income (所得総額) to get the foreign-source income used below.
        A foreign pension counts as its net income calculated as if there were no domestic public
        pension income, applying the public pension deduction to the foreign pension alone.
      </Note>
      {credit.foreignSourceIncome > credit.adjustedForeignSourceIncome && (
        <AmountTable
          rows={[
            { label: 'Foreign-source income', amount: credit.foreignSourceIncome },
            { label: 'Total net income', amount: credit.totalIncome },
            {
              label: 'Capped foreign-source income',
              amount: credit.adjustedForeignSourceIncome,
              isResult: true,
            },
          ]}
        />
      )}
      <Formula>
        Income tax after the home loan tax credit × foreign-source income ÷ total net income,
        rounded down to the yen
      </Formula>
      <AmountTable
        rows={[
          { label: 'Income tax, after the home loan tax credit', amount: credit.incomeTax },
          { label: 'Foreign-source income', amount: credit.adjustedForeignSourceIncome },
          { label: 'Total net income', amount: credit.totalIncome },
          { label: 'Income tax limit', amount: credit.limit.incomeTax, isResult: true },
          { label: 'Credited against income tax', amount: credit.credit.incomeTax, isResult: true },
        ]}
      />
      <Note>
        The credit cannot be more than the part of the income tax that falls on the foreign-source
        income. The amount credited is the smaller of the eligible foreign tax and this limit.
        {credit.limit.incomeTax === 0 &&
          ' With no income tax or no foreign-source income the limit is ¥0, so nothing is credited.'}
      </Note>
      <SourceLinks sources={[NTA_SOURCE]} />
    </Box>
  </DetailedTooltip>
);

/**
 * Tooltip for the "Surtax credit" row: the reconstruction surtax limit (L_R = ⌊R × A / T⌋) and
 * the credit taken within it, against whatever the income tax credit left of the eligible foreign
 * tax. Sums with the income tax credit row above it to the Foreign Tax Credit header value.
 */
export const SurtaxCreditTooltip: React.FC<
  CreditFiguresProps & { reconstructionSurtax: number }
> = ({ credit, reconstructionSurtax }) => (
  <DetailedTooltip title="Surtax Credit">
    <Box>
      <Formula>Reconstruction surtax × the same ratio, rounded down to the yen</Formula>
      <AmountTable
        rows={[
          { label: 'Reconstruction surtax', amount: reconstructionSurtax },
          { label: 'Surtax limit', amount: credit.limit.reconstructionSurtax, isResult: true },
          {
            label: 'Left after the income tax credit',
            amount: credit.foreignTax - credit.credit.incomeTax,
          },
          {
            label: 'Credited against the surtax',
            amount: credit.credit.reconstructionSurtax,
            isResult: true,
          },
        ]}
      />
      <Note>
        The surtax takes the foreign tax the income tax credit left, up to this limit. What is still
        left goes to residence tax.
      </Note>
      <SourceLinks sources={[NTA_SOURCE]} />
    </Box>
  </DetailedTooltip>
);

export interface ResidenceSideCreditContentProps extends CreditFiguresProps {
  side: 'prefecture' | 'city';
  /** The credit that side's income-based portion (所得割) absorbed. */
  applied: number;
}

/**
 * Content explaining one side's foreign tax credit: what is left for it, its limit, and the cap
 * at that side's income-based portion. No {@link DetailedTooltip} wrapper of its own — used as
 * one section of the combined "Tax credit" tooltip
 * ({@link import("./ResidenceTaxCreditTooltip").default}), alongside the 調整控除 section.
 */
export const ResidenceSideCreditContent: React.FC<ResidenceSideCreditContentProps> = ({
  credit,
  side,
  applied,
}) => {
  const isPrefecture = side === 'prefecture';
  const sideName = isPrefecture ? 'prefectural' : 'municipal';
  const leftAfterNational =
    credit.foreignTax - credit.credit.incomeTax - credit.credit.reconstructionSurtax;
  const left = isPrefecture ? leftAfterNational : leftAfterNational - credit.credit.prefecture;
  const percent = isPrefecture ? PREFECTURAL_LIMIT_PERCENT : MUNICIPAL_LIMIT_PERCENT;
  const credited = credit.credit[side];
  const isCapped = applied < credited;

  return (
    <Box sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Foreign Tax Credit (外国税額控除)
      </Typography>
      <Note>
        {isPrefecture
          ? 'The foreign tax left after income tax and the surtax comes off the prefectural tax first'
          : 'The foreign tax left after the prefectural credit comes off the municipal tax'}
        , up to {percent}% of the income tax limit, rounded down to the yen.
      </Note>
      <AmountTable
        rows={[
          {
            label: isPrefecture
              ? 'Left after income tax and the surtax'
              : 'Left after the prefectural credit',
            amount: left,
          },
          {
            label: `Limit (${percent}% of ${formatJPY(credit.limit.incomeTax)})`,
            amount: credit.limit[side],
          },
          { label: 'Credit, the smaller of the two', amount: credited, isResult: true },
          ...(isCapped
            ? [{ label: `Capped at the ${sideName} income-based portion`, amount: applied }]
            : []),
        ]}
      />
      {isCapped && (
        <Note>
          The {sideName} income-based portion (所得割) is less than the credit, so only{' '}
          {formatJPY(applied)} comes off it; the rest does not move to the{' '}
          {isPrefecture ? 'municipal' : 'prefectural'} tax.
        </Note>
      )}
      <Note>
        In a designated city (政令指定都市) the limit is {isPrefecture ? 6 : 24}% instead, which is
        not supported.
      </Note>
    </Box>
  );
};

interface ForeignTaxPaidTooltipProps {
  foreignTaxPaid: number;
  /**
   * The creditable part: foreign tax on reported income and foreign pensions, and paid with a
   * foreign tax return.
   */
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
}) => {
  const excess = credit?.excess ?? 0;
  return (
    <DetailedTooltip title="Foreign Tax Paid">
      <Box>
        <Note>
          Foreign tax (外国所得税) is a tax on the income like any other, so it comes off take-home
          pay. It is counted in the income tax total, beside the Japanese income tax.
        </Note>
        <AmountTable
          rows={[
            ...(hasForeignTaxCreditDetails(credit)
              ? [
                  {
                    label: 'Eligible for the credit',
                    amount: credit.foreignTax,
                  },
                  ...(credit.manualForeignTax
                    ? [
                        {
                          label: 'Paid with a foreign tax return',
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
            ...(excess > 0 ? [{ label: 'Not credited this year', amount: excess }] : []),
          ]}
        />
        {hasForeignTaxCreditDetails(credit) && (
          <Note>
            Foreign tax on reported income and on pensions from a foreign system, and tax paid with
            a foreign tax return, is credited against the Japanese income tax and residence tax up
            to the limits shown under the Foreign Tax Credit rows.
          </Note>
        )}
        {excess > 0 && (
          <Note>
            The {formatJPY(excess)} above every limit (控除限度超過額) is not credited this year. It
            can be carried forward for up to three years by attaching the foreign tax credit
            statement (外国税額控除に関する明細書) to the tax return each year.
          </Note>
        )}
        {withheldForeignTax > 0 && (
          <Note>
            Foreign tax on dividends left to withholding is not credited (措令4条の5⑫); instead, the
            Japanese withholding is charged on the dividends after it (措法9条の2③).
          </Note>
        )}
        {credit?.manualForeignTax !== undefined && (
          <Note>Tax paid with a foreign tax return counts in the year the return is filed.</Note>
        )}
        {credit !== undefined && (
          <Note>
            Foreign tax and unused limits carried forward from earlier years are not supported.
          </Note>
        )}
        <SourceLinks sources={SOURCES} />
      </Box>
    </DetailedTooltip>
  );
};
