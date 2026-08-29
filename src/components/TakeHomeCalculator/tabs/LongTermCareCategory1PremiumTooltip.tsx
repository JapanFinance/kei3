// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import React from 'react';

import {
  LONG_TERM_CARE_BASE_SOURCES,
  LONG_TERM_CARE_TIER_SOURCES,
} from '../../../data/longTermCareCategory1Params';
import { PREFECTURE_NAMES } from '../../../data/prefectures';
import type {
  LongTermCareCategory1Estimate,
  LongTermCareCategory1FiscalYearEstimate,
} from '../../../types/healthInsurance';
import { formatJPY } from '../../../utils/formatters';
import SourceLinks, { type Source } from '../../ui/SourceLinks';

/** Shared with the input form's tooltip, which cites the same figures. */
export const LTC_ESTIMATE_SOURCES: Source[] = [
  {
    label: '第９期計画期間における介護保険の第１号保険料について (average 基準額 by prefecture)',
    href: LONG_TERM_CARE_BASE_SOURCES.page,
  },
  {
    label: '介護保険法施行令第38条 (standard income tiers and multipliers)',
    href: LONG_TERM_CARE_TIER_SOURCES.statute,
  },
  {
    label: '介護保険料等における基準額の調整について (standard tier schedule diagram)',
    href: LONG_TERM_CARE_TIER_SOURCES.mhlwDiagram,
  },
];

const FiscalYearBreakdown: React.FC<{
  label?: string;
  fiscalYear: LongTermCareCategory1FiscalYearEstimate;
}> = ({ label, fiscalYear }) => (
  <Box>
    {label && (
      <Typography
        variant="body2"
        sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', mb: 0.3 }}
      >
        {label}
      </Typography>
    )}
    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
      Tier {fiscalYear.tier} of 13: {formatJPY(fiscalYear.annualBase)} × {fiscalYear.multiplier} ={' '}
      <strong>{formatJPY(fiscalYear.premium)}</strong>
    </Typography>
  </Box>
);

interface LongTermCareCategory1PremiumTooltipProps {
  estimate: LongTermCareCategory1Estimate;
}

const LongTermCareCategory1PremiumTooltip: React.FC<LongTermCareCategory1PremiumTooltipProps> = ({
  estimate,
}) => {
  const { currentFiscalYear, previousFiscalYear } = estimate;

  return (
    <Box sx={{ minWidth: { xs: 0, sm: 300 }, maxWidth: { xs: '100vw', sm: 440 } }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        The premium is the municipality's base amount (基準額) times a multiplier set by the income
        tier (所得段階) the insured person falls in. This estimate uses{' '}
        {estimate.baseScope === 'national'
          ? 'the national average'
          : `the ${PREFECTURE_NAMES[estimate.baseScope]} average`}{' '}
        base amount and the national-standard 13 tiers (介護保険法施行令), with each fiscal year's
        amount rounded down to ¥100.
      </Typography>

      {previousFiscalYear ? (
        <>
          <Box sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <FiscalYearBreakdown
              label={'January-March (1⁄3 of the year):'}
              fiscalYear={previousFiscalYear}
            />
          </Box>
          <Box sx={{ mb: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <FiscalYearBreakdown
              label={'April-December (2⁄3 of the year):'}
              fiscalYear={currentFiscalYear}
            />
          </Box>
          <Box
            sx={{
              p: 1,
              bgcolor: theme => alpha(theme.palette.primary.main, 0.12),
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
              Total: {formatJPY(previousFiscalYear.premium)} × 1&#8260;3
              {' + '}
              {formatJPY(currentFiscalYear.premium)} × 2&#8260;3
              {' = '}
              <strong>{formatJPY(estimate.total)}</strong>
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 1 }}>
            A calendar year spans two fiscal years, which can differ because the 年金収入等 boundary
            between the lower tiers is revised each April and the base amount is reset each plan
            period. The 1&#8260;3 : 2&#8260;3 weighting follows the pension-deduction schedule
            (特別徴収), whose April-August instalments stay at the previous February's level.
          </Typography>
        </>
      ) : (
        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <FiscalYearBreakdown fiscalYear={currentFiscalYear} />
        </Box>
      )}

      <Typography variant="body2" sx={{ mt: 1, mb: 1 }}>
        Each municipality sets its own 基準額 and may modify the tier schedule, so the billed amount
        can differ substantially. The tier judgment treats the household (世帯) as the taxpayer plus
        the entered dependents and applies the Tokyo-standard (級地1) non-taxation limits. Municipal
        reductions for special circumstances (減免) are not applied. Entering the amount from the
        介護保険料決定通知書 in the input form replaces the estimate.
      </Typography>
      <SourceLinks sources={LTC_ESTIMATE_SOURCES} />
    </Box>
  );
};

export default LongTermCareCategory1PremiumTooltip;
