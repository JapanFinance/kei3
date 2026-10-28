// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import {
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
} from '../../../types/healthInsurance';
import type { TakeHomeResults } from '../../../types/tax';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';

/**
 * Monthly wage at the lowest employees'-pension grade boundary. Below this, employee
 * social insurance enrollment as a short-time worker is generally not possible (所定内賃金
 * 月額8.8万円以上 is one of the statutory criteria, alongside 週20時間以上 scheduled hours).
 * Source: https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html
 */
const SHORT_TIME_ENROLLMENT_MONTHLY_WAGE = 88_000;

/**
 * Explains a negative take-home figure: which fixed charges cause it and what relief
 * exists. Renders as a warning-icon tooltip on the Take-Home Pay row when the result
 * is negative.
 */
const NegativeTakeHomeTooltip: React.FC<{ results: TakeHomeResults }> = ({ results }) => {
  if (results.takeHomeIncome >= 0) {
    return null;
  }

  if (results.socialInsuranceOverride !== undefined) {
    return (
      <DetailedTooltip
        title="Negative Take-Home Pay"
        icon={<WarningIcon fontSize="small" color="warning" />}
        iconSx={{ color: 'warning.main' }}
        iconAriaLabel="Negative take-home pay explanation"
      >
        <Typography variant="body2">
          Take-home pay is negative because the manually entered social insurance amount exceeds
          income after taxes.
        </Typography>
      </DetailedTooltip>
    );
  }

  const isNHI = results.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID;
  const isDependentCoverage = results.healthInsuranceProvider === DEPENDENT_COVERAGE_ID;
  const isEmployeeProvider = !isNHI && !isDependentCoverage;
  const monthlyWage = (results.salaryIncome + (results.commutingAllowance ?? 0)) / 12;
  const showEmployeeNote = isEmployeeProvider && monthlyWage < SHORT_TIME_ENROLLMENT_MONTHLY_WAGE;
  const hasNHIReduction =
    (results.nhiReductionRatios?.prevFY ?? 0) > 0 || (results.nhiReductionRatios?.currFY ?? 0) > 0;

  return (
    <DetailedTooltip
      title="Negative Take-Home Pay"
      icon={<WarningIcon fontSize="small" color="warning" />}
      iconSx={{ color: 'warning.main' }}
      iconAriaLabel="Negative take-home pay explanation"
    >
      <Typography variant="body2" sx={{ mb: 1 }}>
        Take-home pay is negative at this income: social insurance charges exceed the income,
        because they do not scale down to zero.
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {results.householdNHIPremium !== undefined && results.householdNHIPremium > 0 && !isNHI && (
          <li>
            <Typography variant="body2">
              National Health Insurance premiums for cohabiting household members are being paid by
              the taxpayer.
            </Typography>
          </li>
        )}
        {isNHI && (
          <li>
            <Typography variant="body2">
              National Health Insurance charges per-person amounts (均等割) even at very low income.
              {hasNHIReduction &&
                ' The statutory low-income reduction (均等割額の軽減) is already applied.'}
            </Typography>
          </li>
        )}
        {isNHI && !results.nationalPensionExemption?.applied && (
          <li>
            <Typography variant="body2">
              The National Pension contribution (国民年金保険料) is a fixed amount regardless of
              income.
              {results.nationalPensionExemption?.eligible
                ? ' This income is within the full exemption (全額免除) threshold — see the toggle under the social insurance input.'
                : ' An income-based full exemption (全額免除) exists for lower incomes.'}
            </Typography>
          </li>
        )}
        {showEmployeeNote && (
          <li>
            <Typography variant="body2">
              Employee health insurance and employees' pension premiums are based on the standard
              monthly remuneration (標準報酬月額) table, which has a lowest grade with a minimum
              premium. Enrollment as a short-time worker has statutory criteria (minimum scheduled
              working hours per week and minimum monthly wages), so at salaries below those levels
              National Health Insurance and the National Pension usually apply instead — selectable
              under Health Insurance Provider.
            </Typography>
          </li>
        )}
      </Box>
      {showEmployeeNote && (
        <SourceLinks
          sources={[
            {
              href: 'https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html',
              label: '短時間労働者に対する健康保険・厚生年金保険の適用の拡大 - 日本年金機構',
            },
          ]}
        />
      )}
    </DetailedTooltip>
  );
};

export default NegativeTakeHomeTooltip;
