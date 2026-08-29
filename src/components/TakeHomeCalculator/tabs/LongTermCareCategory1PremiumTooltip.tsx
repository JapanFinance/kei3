// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Typography from '@mui/material/Typography';
import React from 'react';

import {
  LONG_TERM_CARE_BASE_SOURCES,
  LONG_TERM_CARE_TIER_SOURCES,
} from '../../../data/longTermCareCategory1Params';
import { PREFECTURE_NAMES } from '../../../data/prefectures';
import type { LongTermCareCategory1Estimate } from '../../../types/healthInsurance';
import { formatJPY } from '../../../utils/formatters';
import SourceLinks, { type Source } from '../../ui/SourceLinks';

const LTC_ESTIMATE_SOURCES: Source[] = [
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

interface LongTermCareCategory1PremiumTooltipProps {
  estimate: LongTermCareCategory1Estimate;
}

const LongTermCareCategory1PremiumTooltip: React.FC<LongTermCareCategory1PremiumTooltipProps> = ({
  estimate,
}) => (
  <>
    <Typography variant="body2" sx={{ mb: 1 }}>
      The estimate multiplies the average annual base amount (基準額) —{' '}
      {estimate.baseScope === 'national'
        ? 'the national average'
        : `the ${PREFECTURE_NAMES[estimate.baseScope]} prefecture average`}{' '}
      for FY2024-2026, {formatJPY(estimate.annualBase)} — by the national-standard multiplier for
      income tier (所得段階) {estimate.tier} of 13 (× {estimate.multiplier}), rounded down to ¥100
      per fiscal year. A calendar year spans two fiscal years, weighted 1/3 : 2/3 like the pension
      deduction schedule (特別徴収).
    </Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>
      Actual premiums are set by each municipality, whose 基準額 (¥3,374 to ¥9,249/month in
      FY2024-2026) and tier schedule both vary. The tier judgment treats the household (世帯) as the
      taxpayer plus the entered dependents and applies the Tokyo-standard (級地1) non-taxation
      limits. Entering the billed amount from the 介護保険料決定通知書 in the input form replaces
      the estimate.
    </Typography>
    <SourceLinks sources={LTC_ESTIMATE_SOURCES} />
  </>
);

export default LongTermCareCategory1PremiumTooltip;
