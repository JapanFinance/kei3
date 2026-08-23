// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';

import type { TakeHomeInputs, TakeHomeResults } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import { ResultRow } from '../ResultRow';
import NetBusinessAndMiscIncomeTooltip from './NetBusinessAndMiscIncomeTooltip';
import NetEmploymentIncomeTooltip from './NetEmploymentIncomeTooltip';
import NetPublicPensionIncomeTooltip from './NetPublicPensionIncomeTooltip';

interface IncomeOverviewRowsProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

/**
 * The per-category net income rows (給与所得, 事業所得・雑所得, 公的年金等に係る雑所得) that open
 * the Taxes and Social Insurance tabs, each with its calculation tooltip, followed by the
 * 合計所得金額 subtotal when more than one category is present.
 */
const IncomeOverviewRows: React.FC<IncomeOverviewRowsProps> = ({ results, inputs }) => {
  const grossBusinessAndMiscIncome = inputs.incomeStreams
    .filter(s => s.type === 'business' || s.type === 'miscellaneous')
    .reduce((sum, s) => sum + s.amount, 0);

  const hasEmploymentIncome = results.grossEmploymentIncome > 0;
  const hasBusinessOrMiscIncome = grossBusinessAndMiscIncome > 0;
  const hasPublicPensionIncome = (results.grossPublicPensionIncome ?? 0) > 0;
  const presentIncomeComponents = [
    hasEmploymentIncome,
    hasBusinessOrMiscIncome,
    hasPublicPensionIncome,
  ].filter(Boolean).length;

  return (
    <>
      {hasEmploymentIncome && results.netEmploymentIncome !== undefined && (
        <ResultRow
          label={
            <span>
              Net Employment Income
              <NetEmploymentIncomeTooltip
                grossEmploymentIncome={results.grossEmploymentIncome}
                netEmploymentIncome={results.netEmploymentIncome}
                incomeAdjustmentDeduction={results.incomeAdjustmentDeduction ?? 0}
                pensionIncomeAdjustmentDeduction={results.pensionIncomeAdjustmentDeduction ?? 0}
                year={inputs.incomeYear}
              />
            </span>
          }
          value={formatJPY(results.netEmploymentIncome)}
          type="default"
        />
      )}

      {hasBusinessOrMiscIncome && (
        <ResultRow
          label={
            <span>
              Net Business / Misc Income
              {results.blueFilerDeduction !== undefined && results.blueFilerDeduction > 0 && (
                <NetBusinessAndMiscIncomeTooltip
                  grossBusinessAndMiscIncome={grossBusinessAndMiscIncome}
                  blueFilerDeduction={results.blueFilerDeduction}
                  netBusinessAndMiscIncome={results.netBusinessAndMiscIncome}
                />
              )}
            </span>
          }
          value={formatJPY(results.netBusinessAndMiscIncome)}
          type="default"
        />
      )}

      {hasPublicPensionIncome && (
        <ResultRow
          label={
            <span>
              Net Public Pension Income
              <NetPublicPensionIncomeTooltip
                grossPublicPensionIncome={results.grossPublicPensionIncome ?? 0}
                netPublicPensionIncome={results.netPublicPensionIncome ?? 0}
              />
            </span>
          }
          value={formatJPY(results.netPublicPensionIncome ?? 0)}
          type="default"
        />
      )}

      {presentIncomeComponents >= 2 && (
        <ResultRow
          label="Total Net Income"
          value={formatJPY(results.totalNetIncome)}
          type="subtotal"
        />
      )}
    </>
  );
};

export default IncomeOverviewRows;
