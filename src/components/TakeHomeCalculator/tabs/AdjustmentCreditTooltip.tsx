// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { formatJPY } from '../../../utils/formatters';
import { DetailedTooltip } from '../../ui/Tooltips';

interface AdjustmentCreditTooltipProps {
  /** Which half of the income-based residence tax this credit applies to. */
  level: 'municipal' | 'prefectural';
  /** The adjustment credit (調整控除) allotted to this level: 60% municipal / 40% prefectural. */
  adjustmentCredit: number;
  /** 人的控除額の差 — the statutory personal deduction difference feeding the credit. */
  personalDeductionDifference: number;
}

/**
 * Tooltip for the "Tax credit (municipal)" / "Tax credit (prefectural)" residence-tax rows: explains
 * the adjustment credit (調整控除), its formula, and the amount applied to this level. The municipal
 * and prefectural variants differ only in wording and the 60%/40% split, so both are rendered from
 * this one component. Renders its own DetailedTooltip trigger, so callers place it after the label.
 */
const AdjustmentCreditTooltip: React.FC<AdjustmentCreditTooltipProps> = ({
  level,
  adjustmentCredit,
  personalDeductionDifference,
}) => {
  const isMunicipal = level === 'municipal';
  const levelLabel = isMunicipal ? 'Municipal' : 'Prefectural';
  const levelLower = isMunicipal ? 'municipal' : 'prefectural';
  const portionLabel = isMunicipal ? 'Municipal portion (60%)' : 'Prefectural portion (40%)';

  return (
    <DetailedTooltip title={`${levelLabel} Tax Credits`}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Tax Credits Applied to {levelLabel} Portion
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.9em' }}>
          The following tax credits (税額控除) reduce the {levelLower} portion of residence tax:
        </Typography>

        {/* Adjustment Credit */}
        <Box sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Adjustment Credit (調整控除)
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85em', mb: 0.5 }}>
            Personal deduction difference: {formatJPY(personalDeductionDifference)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8em', color: 'text.secondary', mb: 0.5 }}>
            The statutory personal deduction difference (defined in{' '}
            <a
              href="https://laws.e-gov.go.jp/law/325AC0000000226#Mp-At_314_6"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              Local Tax Act Article 314-6
            </a>
            ) accounts for differences between national and residence tax deduction amounts.
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8em', color: 'text.secondary', mb: 1 }}>
            The adjustment credit is calculated:
          </Typography>

          <Box sx={{ pl: 1, borderLeft: 2, borderColor: 'divider', mb: 1 }}>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
              If Taxable Income ≤ 2,000,000 JPY:
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              Min(Difference, Taxable Income) × 5%
            </Typography>

            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
              If Taxable Income &gt; 2,000,000 JPY:
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              (Difference - (Taxable Income - 2,000,000)) × 5%
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.secondary',
                fontStyle: 'italic',
                mb: 0.5,
              }}
            >
              (Minimum credit: 2,500 JPY)
            </Typography>

            <Typography
              variant="caption"
              sx={{ display: 'block', fontWeight: 600, color: 'error.main' }}
            >
              If Net Income &gt; 25,000,000 JPY, no credit.
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ fontSize: '0.85em', mb: 0.5 }}>
            {portionLabel}: {formatJPY(adjustmentCredit)}
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
          Total {levelLabel} Tax Credit: {formatJPY(adjustmentCredit)}
        </Typography>
      </Box>
    </DetailedTooltip>
  );
};

export default AdjustmentCreditTooltip;
