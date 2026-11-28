// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { ONE_STOP_MAX_MUNICIPALITIES } from '../../../data/furusatoNozei';
import type { FurusatoOneStopDetails, OneStopIneligibilityReason } from '../../../types/tax';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks, { type Source } from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

export const ONE_STOP_INELIGIBILITY_LABELS: Record<OneStopIneligibilityReason, string> = {
  taxableTemporaryIncome: 'taxable temporary income from Furusato Nozei return gifts',
  employmentIncomeOverThreshold: 'gross employment income exceeding ¥20,000,000',
  publicPensionOverThreshold: 'gross public pension income exceeding ¥4,000,000',
  businessOrMiscIncome: 'business or miscellaneous income',
  realEstateIncome: 'real estate income',
  reportedInvestmentIncome: 'reported investment income',
  medicalExpensesDeduction: 'medical expenses deduction',
  foreignTaxCredit: 'foreign tax credit',
  highIncomeMinimumTax: 'minimum tax on high-income taxpayers',
  homeLoanFirstYear: 'first-year home loan tax credit',
  foreignStockCompensation: 'foreign-issued stock compensation',
  foreignPublicPension: 'foreign public pension income',
  employmentAndPublicPension: 'combined employment and public pension net income',
  pensionerUnwithheldDeductions: 'deductions not reflected in pension withholding',
};

const ONE_STOP_SOURCES: Source[] = [
  {
    href: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/mechanism/deduction.html',
    label: '総務省 ふるさと納税のしくみ (MIC — Tax deduction mechanism)',
  },
  {
    href: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/mechanism/procedure.html',
    label: '総務省 ふるさと納税の流れ (MIC — Filing & One-Stop procedure)',
  },
];

interface FurusatoOneStopTooltipProps {
  oneStop?: FurusatoOneStopDetails | undefined;
}

export const FurusatoOneStopTooltip: React.FC<FurusatoOneStopTooltipProps> = ({ oneStop }) => (
  <DetailedTooltip
    title="One-Stop Exception System (ワンストップ特例制度)"
    icon={SIMPLE_TOOLTIP_ICON}
    iconAriaLabel="One-Stop Exception system info"
  >
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>
        The One-Stop Exception system allows eligible taxpayers to claim Furusato Nozei credits
        without filing an income tax return. Instead of an income tax deduction, the income tax
        portion is shifted entirely into the following year's residence tax as the{' '}
        <strong>Declaration Special Credit (申告特例控除)</strong>.
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        <strong>Eligibility:</strong> Furusato Nozei donations in the calendar year must be made to{' '}
        <strong>{ONE_STOP_MAX_MUNICIPALITIES} or fewer municipalities</strong>, with a One-Stop
        Exception application submitted for each donation. The taxpayer must have no obligation or
        reason to file an income or residence tax return (such as multiple salary payers or claiming
        deductions outside the year-end adjustment).
      </Typography>
      {oneStop !== undefined && !oneStop.eligible && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Detected filing triggers:</strong>{' '}
          {oneStop.ineligibleReasons
            .map(reason => ONE_STOP_INELIGIBILITY_LABELS[reason])
            .join('; ')}
          .
        </Typography>
      )}
      <Typography variant="body2">
        If a tax return is filed for any reason, previously submitted One-Stop applications are
        invalidated and all Furusato Nozei donations must be included on the return.
      </Typography>
      <SourceLinks sources={ONE_STOP_SOURCES} />
    </Box>
  </DetailedTooltip>
);
