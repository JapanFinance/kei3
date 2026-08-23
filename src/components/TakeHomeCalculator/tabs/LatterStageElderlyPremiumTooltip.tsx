// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Typography from '@mui/material/Typography';
import React from 'react';

import { LATTER_STAGE_RATE_TABLE_URL } from '../../../data/latterStageElderlyParams';
import SourceLinks, { type Source } from '../../ui/SourceLinks';

const LATTER_STAGE_SOURCES: Source[] = [
  {
    label: '後期高齢者医療制度の保険料率について (rates for all 47 prefectures)',
    href: LATTER_STAGE_RATE_TABLE_URL,
  },
  {
    label: '保険料試算用シート (per-portion rounding and caps)',
    href: 'https://www.tokyo-ikiiki.net/seido/1001968/1002520.html',
  },
  {
    label: '高齢者の医療の確保に関する法律施行令第18条 (uniform rates, premium cap)',
    href: 'https://laws.e-gov.go.jp/law/419CO0000000318#Mp-Ch_3-Se_4-At_18',
  },
];

const LatterStageElderlyPremiumTooltip: React.FC = () => (
  <>
    <Typography variant="body2" sx={{ mb: 1 }}>
      The annual premium is a per-capita amount (均等割額) plus an income-based amount: the rate
      applied to total net income minus the basic deduction. Each portion is rounded down to ¥100
      and capped at its statutory maximum (賦課限度額), which is set nationally. Rates are uniform
      across each prefecture by law and are revised every two years.
    </Typography>
    <Typography variant="body2" sx={{ mb: 1 }}>
      The low-income per-capita reduction (均等割額の軽減) and the reduction for former dependents
      (元被扶養者) are not currently applied.
    </Typography>
    <SourceLinks sources={LATTER_STAGE_SOURCES} />
  </>
);

export default LatterStageElderlyPremiumTooltip;
