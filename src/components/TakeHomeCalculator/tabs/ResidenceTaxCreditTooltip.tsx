// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { ForeignTaxCreditResult } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';
import { ResidenceSideCreditContent } from './ForeignTaxCreditTooltips';

interface ForeignTaxCreditForSide {
  /** The full foreign tax credit result, used to render this side's limit and calculation. */
  credit: ForeignTaxCreditResult;
  /** What this side's income-based portion (所得割) actually absorbed, after its own cap. */
  applied: number;
}

interface ResidenceTaxCreditTooltipProps {
  /** Which half of the income-based residence tax this row totals. */
  level: 'municipal' | 'prefectural';
  /** The adjustment credit (調整控除) allotted to this level: 60% municipal / 40% prefectural. */
  adjustmentCredit: number;
  /** 人的控除額の差 — the statutory personal deduction difference feeding the adjustment credit. */
  personalDeductionDifference: number;
  /** This side's foreign tax credit, present only when an amount was applied to it. */
  foreignTaxCredit?: ForeignTaxCreditForSide | undefined;
}

/**
 * Tooltip for the "Tax credit (municipal)" / "Tax credit (prefectural)" residence-tax rows: these
 * rows total every credit applied directly to that side's income-based portion (所得割) — the
 * adjustment credit (調整控除) and, when applicable, the foreign tax credit (外国税額控除) — so the
 * tooltip explains each component in turn and the combined total the row shows. The home loan tax
 * credit is not part of this row; it keeps its own row since it isn't naturally split the same
 * way and carries its own cap/warning display. Renders its own DetailedTooltip trigger, so callers
 * place it after the label.
 */
const ResidenceTaxCreditTooltip: React.FC<ResidenceTaxCreditTooltipProps> = ({
  level,
  adjustmentCredit,
  personalDeductionDifference,
  foreignTaxCredit,
}) => {
  const isMunicipal = level === 'municipal';
  const levelLabel = isMunicipal ? 'Municipal' : 'Prefectural';
  const levelLower = isMunicipal ? 'municipal' : 'prefectural';
  const portionLabel = isMunicipal ? 'Municipal portion (60%)' : 'Prefectural portion (40%)';
  const total = adjustmentCredit + (foreignTaxCredit?.applied ?? 0);

  return (
    <DetailedTooltip title={`${levelLabel} Tax Credit`}>
      <Box>
        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.9em' }}>
          The credits below come off the {levelLower} portion of residence tax.
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

        {foreignTaxCredit && (
          <ResidenceSideCreditContent
            credit={foreignTaxCredit.credit}
            side={isMunicipal ? 'city' : 'prefecture'}
            applied={foreignTaxCredit.applied}
          />
        )}

        <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
          {levelLabel} tax credit: {formatJPY(total)}
        </Typography>

        <SourceLinks
          sources={[
            {
              href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1240.htm',
              label: 'Foreign tax credit (外国税額控除) - NTA',
            },
          ]}
        />
      </Box>
    </DetailedTooltip>
  );
};

export default ResidenceTaxCreditTooltip;
