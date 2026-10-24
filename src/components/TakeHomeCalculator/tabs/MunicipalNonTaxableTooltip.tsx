// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import { formatJPY } from '../../../utils/formatters';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface MunicipalNonTaxableTooltipProps {
  /** The municipal non-taxable limit (均等割・所得割非課税限度額) that applies. */
  limit: number;
  /** Number of qualified dependents that raise the threshold. */
  qualifiedDependentsCount: number;
}

/**
 * Tooltip explaining the municipal non-taxable threshold (均等割・所得割非課税限度額) for
 * residence tax when a taxpayer owes no residence tax due to their total net income
 * (合計所得金額) being at or below the municipal limit.
 */
const MunicipalNonTaxableTooltip: React.FC<MunicipalNonTaxableTooltipProps> = ({
  limit,
  qualifiedDependentsCount,
}) => {
  return (
    <DetailedTooltip
      title="Municipal Non-Taxable Threshold"
      icon={SIMPLE_TOOLTIP_ICON}
      iconAriaLabel="Municipal non-taxable threshold details"
    >
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          均等割・所得割非課税限度額
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          No residence tax is levied when total net income (合計所得金額) is at or below the
          municipal non-taxable threshold ({formatJPY(limit)}).
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
          Formula (Tokyo 1級地 standard):
        </Typography>
        {qualifiedDependentsCount === 0 ? (
          <Typography variant="body2" sx={{ mb: 1 }}>
            Single with no dependents: <strong>¥450,000</strong>
          </Typography>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              With dependents: <strong>¥350,000 × (dependents + 1) + ¥100,000 + ¥210,000</strong>
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              For {qualifiedDependentsCount} dependent{qualifiedDependentsCount > 1 ? 's' : ''}:{' '}
              ¥350,000 × {qualifiedDependentsCount + 1} + ¥100,000 + ¥210,000 ={' '}
              <strong>{formatJPY(limit)}</strong>
            </Typography>
          </>
        )}
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem', color: 'text.secondary' }}>
          The base ¥350,000 per person and ¥100,000 tax reform adjustment are standard nationwide.
          The ¥210,000 addition applies to Grade 1 areas (including Tokyo 23 wards) based on local
          living costs.
        </Typography>
        <SourceLinks
          sources={[
            {
              href: 'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju#gaiyo_06',
              label: '個人住民税の非課税 - 東京都主税局',
            },
          ]}
        />
      </Box>
    </DetailedTooltip>
  );
};

export default MunicipalNonTaxableTooltip;
