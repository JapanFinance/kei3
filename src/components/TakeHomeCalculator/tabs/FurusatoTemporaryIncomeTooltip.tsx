// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import {
  FURUSATO_AVERAGE_ECONOMIC_BENEFIT_RATE,
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
} from '../../../data/furusatoNozei';
import { formatJPY } from '../../../utils/formatters';
import type { FurusatoTemporaryIncomeEstimate } from '../../../utils/furusatoNozei';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks, { type Source } from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

export const MIC_FY2025_SURVEY_SOURCE: Source = {
  href: 'https://www.soumu.go.jp/main_content/001085011.pdf',
  label: '令和8年度調査結果 (MIC FY2025 survey — 26.5% goods, 5.7% shipping)',
};

const TEMPORARY_INCOME_SOURCES: Source[] = [
  {
    href: 'https://www.nta.go.jp/law/shitsugi/shotoku/02/37.htm',
    label: '「ふるさと納税」の返礼品と一時所得 (NTA Q&A — Classification)',
  },
  {
    href: 'https://www.nta.go.jp/law/shitsugi/shotoku/03/08.htm',
    label: '返礼品の収入計上時期 (NTA Q&A — Year of receipt)',
  },
  {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1490.htm',
    label: '一時所得 (NTA Tax Answer No. 1490)',
  },
  {
    href: 'https://www.kfs.go.jp/service/JP/126/02/index.html',
    label: '令和4年2月7日裁決 (National Tax Tribunal — Procurement & shipping valuation)',
  },
  {
    href: 'https://www.nta.go.jp/about/organization/ntc/soshoshiryo/kazei/2024/pdf/13940.pdf',
    label: '横浜地裁 令和6年2月14日判決 (順号13940 — Procurement valuation upheld)',
  },
  {
    href: 'https://www.nta.go.jp/about/organization/ntc/soshoshiryo/kazei/2024/pdf/14061.pdf',
    label: '東京高裁 令和6年12月11日判決 (順号14061 — Appeal affirmed)',
  },
  MIC_FY2025_SURVEY_SOURCE,
];

interface FurusatoTemporaryIncomeTooltipProps {
  estimate: FurusatoTemporaryIncomeEstimate;
}

export const FurusatoTemporaryIncomeTooltip: React.FC<FurusatoTemporaryIncomeTooltipProps> = ({
  estimate,
}) => {
  const giftsPct = FURUSATO_AVERAGE_GIFT_COST_RATE.toPercent(1);
  const shippingPct = FURUSATO_AVERAGE_SHIPPING_COST_RATE.toPercent(1);
  const combinedPct = FURUSATO_AVERAGE_ECONOMIC_BENEFIT_RATE.toPercent(1);

  return (
    <DetailedTooltip
      title="Temporary Income from Furusato Nozei"
      icon={
        estimate.isTaxable ? <WarningIcon fontSize="small" color="warning" /> : SIMPLE_TOOLTIP_ICON
      }
      {...(estimate.isTaxable && {
        iconSx: { color: 'warning.main' },
        iconAriaLabel: 'Taxable temporary income warning',
      })}
    >
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
          contracted together, the National Tax Tribunal held that shipping cost is included in the
          economic benefit, whereas municipalities that contract and pay delivery separately
          typically exclude shipping from their reported procurement cost. This estimate uses the
          MIC nationwide averages ({giftsPct} gifts + {shippingPct} shipping = {combinedPct}{' '}
          combined) as a conservative estimate; actual amounts depend on each municipality's
          valuation for actual gifts received.
        </Typography>
        <Typography variant="body2" sx={{ mb: estimate.additionalTotalTax > 0 ? 1 : 0 }}>
          <strong>Delivery Year & Filing:</strong> Temporary Income from return gifts is recognized
          in the calendar year delivered, not the year donated. When taxable temporary income
          arises, filing a tax return is required, so the One-Stop Exception (ワンストップ特例制度)
          does not apply to that year's donations.
        </Typography>
        {estimate.additionalTotalTax > 0 && (
          <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Additional Tax Breakdown
            </Typography>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '2px 0' }}>Income tax & surtax:</td>
                  <td style={{ padding: '2px 0', textAlign: 'right' }}>
                    {formatJPY(estimate.additionalNationalIncomeTax)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '2px 0' }}>Residence tax:</td>
                  <td style={{ padding: '2px 0', textAlign: 'right' }}>
                    {formatJPY(estimate.additionalResidenceTax)}
                  </td>
                </tr>
                <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                  <td style={{ padding: '4px 0', fontWeight: 600 }}>Total additional tax:</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                    {formatJPY(estimate.additionalTotalTax)}
                  </td>
                </Box>
              </tbody>
            </table>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
            >
              Calculated by the tax engine on the estimated temporary income above (assuming
              donations at the limit, no other temporary income, and delivery within the same tax
              year).
            </Typography>
          </Box>
        )}
        <SourceLinks sources={TEMPORARY_INCOME_SOURCES} />
      </Box>
    </DetailedTooltip>
  );
};
