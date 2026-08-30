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

const LTC_CATEGORY1_SOURCES: Source[] = [
  {
    label:
      '第９期計画期間における介護保険の第１号保険料について (average base amount by prefecture)',
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
  {
    label: '介護保険料の納め方 (billing and collection)',
    href: 'https://www.city.shinjuku.lg.jp/fukushi/file07_02_00005.html',
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
  /**
   * Absent when the entered amount is in use, which leaves the general explanation without the
   * derivation. Both the input form and the results tab render this component, so the wording
   * has to read from either.
   */
  estimate?: LongTermCareCategory1Estimate | undefined;
}

const LongTermCareCategory1PremiumTooltip: React.FC<LongTermCareCategory1PremiumTooltipProps> = ({
  estimate,
}) => (
  <Box sx={{ minWidth: { xs: 0, sm: 300 }, maxWidth: { xs: '100vw', sm: 440 } }}>
    <Typography variant="body2" sx={{ mb: 1 }}>
      From age 65, long-term care premiums (介護保険料, 第1号被保険者) are billed by the
      municipality through income tiers assessed on the previous year's income, usually deducted
      from pension payments (特別徴収), and are added to the social insurance deduction.
    </Typography>

    {estimate && <LongTermCareCategory1EstimateBreakdown estimate={estimate} />}

    <Typography variant="body2" sx={{ mb: 1 }}>
      {estimate
        ? 'The exact amount appears on the June-July notice (介護保険料決定通知書); switching the estimate off replaces it with that amount.'
        : 'The figure shown was entered rather than estimated. The exact amount appears on the June-July notice (介護保険料決定通知書).'}
    </Typography>
    <SourceLinks sources={LTC_CATEGORY1_SOURCES} />
  </Box>
);

const LongTermCareCategory1EstimateBreakdown: React.FC<{
  estimate: LongTermCareCategory1Estimate;
}> = ({ estimate }) => {
  const { currentFiscalYear, previousFiscalYear } = estimate;

  return (
    <>
      <Typography variant="body2" sx={{ mb: 1 }}>
        The premium is the municipality's base amount (基準額) times a multiplier set by the income
        tier the insured person falls in. This estimate uses{' '}
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
            A calendar year spans two fiscal years, which can differ because the income boundary
            between the lower tiers is revised each April and the base amount is reset each plan
            period. The 1&#8260;3 : 2&#8260;3 split is what the year's six pension deductions
            (特別徴収) come to: April, June and August are provisional at the previous February's
            level, then October and December true the fiscal year up to its own total, taking back
            most of what those provisional deductions carried over.
          </Typography>
        </>
      ) : (
        <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <FiscalYearBreakdown fiscalYear={currentFiscalYear} />
        </Box>
      )}

      <Typography variant="body2" sx={{ mt: 1, mb: 1 }}>
        Each municipality sets its own base amount (基準額) and may modify the tier schedule, so the
        billed amount can differ substantially. The tier judgment treats the household (世帯) as the
        taxpayer plus the entered dependents and applies the Tokyo-standard (級地1) non-taxation
        limits. Municipal reductions for special circumstances (減免) are not applied.
      </Typography>
    </>
  );
};

export default LongTermCareCategory1PremiumTooltip;
