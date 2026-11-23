// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import {
  FURUSATO_AVERAGE_ECONOMIC_BENEFIT_RATE,
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
  FURUSATO_SOURCES,
  TEMPORARY_INCOME_SPECIAL_DEDUCTION,
} from '../../../data/furusatoNozei';
import { formatJPY } from '../../../utils/formatters';
import type { FurusatoTemporaryIncomeEstimate } from '../../../utils/furusatoNozei';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

interface FurusatoTemporaryIncomeTooltipProps {
  estimate: FurusatoTemporaryIncomeEstimate;
}

export const FurusatoTemporaryIncomeTooltip: React.FC<FurusatoTemporaryIncomeTooltipProps> = ({
  estimate,
}) => {
  const goodsPct = FURUSATO_AVERAGE_GIFT_COST_RATE.toPercent(1);
  const shippingPct = FURUSATO_AVERAGE_SHIPPING_COST_RATE.toPercent(1);
  const combinedPct = FURUSATO_AVERAGE_ECONOMIC_BENEFIT_RATE.toPercent(1);

  return (
    <DetailedTooltip title="Temporary Income from Furusato Nozei" icon={SIMPLE_TOOLTIP_ICON}>
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Return gifts (返礼品) received from municipalities are treated as gifts from a corporation
          (法人からの贈与) and classified as <strong>Temporary Income (一時所得)</strong>. The
          Furusato Nozei donation itself is not deductible as an expense against temporary income
          because it is claimed separately as a donation deduction/credit.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Valuation & Shipping:</strong> Fair market value (時価) is based on each
          municipality's procurement cost (返礼品調達価格). Where procurement and delivery are
          contracted together, the National Tax Tribunal held that shipping equivalents are not
          deducted from the economic benefit. This estimate uses FY2025 MIC nationwide averages (
          {goodsPct} goods + {shippingPct} shipping = {combinedPct} combined); actual amounts depend
          on each municipality's valuation.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Special Deduction (特別控除):</strong> An annual{' '}
          {formatJPY(TEMPORARY_INCOME_SPECIAL_DEDUCTION)} deduction applies across all temporary
          income combined in the calendar year (such as insurance maturity payouts or prizes). Half
          (½) of any excess is added to aggregate taxable income (総所得金額).
        </Typography>
        <Typography variant="body2" sx={{ mb: estimate.estimatedTotalTax > 0 ? 1 : 0 }}>
          <strong>Delivery Year & Filing:</strong> Return gifts are recognized in the calendar year
          delivered, not the year donated. When taxable temporary income arises, filing a tax return
          (確定申告) is required, so the One-Stop Exception (ワンストップ特例制度) does not apply to
          that year's donations.
        </Typography>
        {estimate.estimatedTotalTax > 0 && (
          <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Estimated Additional Tax Breakdown
            </Typography>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '2px 0' }}>
                    Income tax & surtax{estimate.usesMinimumTaxRate ? ' (minimum tax floor)' : ''}:
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right' }}>
                    ≈ {formatJPY(estimate.estimatedNationalIncomeTax)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '2px 0' }}>Residence tax (10%):</td>
                  <td style={{ padding: '2px 0', textAlign: 'right' }}>
                    ≈ {formatJPY(estimate.estimatedResidenceTax)}
                  </td>
                </tr>
                <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                  <td style={{ padding: '4px 0', fontWeight: 600 }}>Total estimated tax:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                    ≈ {formatJPY(estimate.estimatedTotalTax)}
                  </td>
                </Box>
              </tbody>
            </table>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              Additional tax is estimated marginally from the current tax profile assuming donations
              at the full limit, no other temporary income, and delivery in the same tax-profile
              year.
            </Typography>
          </Box>
        )}
        <SourceLinks
          sources={[
            {
              href: FURUSATO_SOURCES.ntaTemporaryIncomeQa,
              label: '「ふるさと納税」の返礼品と一時所得 (NTA Q&A — Classification)',
            },
            {
              href: FURUSATO_SOURCES.ntaTimingQa,
              label: '返礼品の収入計上時期 (NTA Q&A — Year of receipt)',
            },
            {
              href: FURUSATO_SOURCES.ntaTemporaryIncomeTaxAnswer,
              label: '一時所得 (NTA Tax Answer No. 1490)',
            },
            {
              href: FURUSATO_SOURCES.kfsDecision2022,
              label: '令和4年2月7日裁決 (National Tax Tribunal — Procurement & shipping valuation)',
            },
            {
              href: FURUSATO_SOURCES.yokohamaDistrictCourt2024Pdf,
              label: '横浜地裁 令和6年2月14日判決 (順号13940 — Procurement valuation upheld)',
            },
            {
              href: FURUSATO_SOURCES.tokyoHighCourt2024Pdf,
              label: '東京高裁 令和6年12月11日判決 (順号14061 — Appeal affirmed)',
            },
            {
              href: FURUSATO_SOURCES.micFy2025Pdf,
              label: '令和8年度調査結果 (MIC FY2025 survey — 26.5% goods, 5.7% shipping)',
            },
          ]}
        />
      </Box>
    </DetailedTooltip>
  );
};
