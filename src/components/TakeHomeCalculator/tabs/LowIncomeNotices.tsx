// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { TakeHomeResults } from '../../../types/tax';
import {
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
} from '../../../types/healthInsurance';
import SourceLinks from '../../ui/SourceLinks';

/**
 * Monthly wage at the lowest employees'-pension grade boundary. Below this, employee
 * social insurance enrollment as a short-time worker is generally not possible (所定内賃金
 * 月額8.8万円以上 is one of the statutory criteria, alongside 週20時間以上 scheduled hours).
 * Source: https://www.nenkin.go.jp/service/kounen/tekiyo/jigyosho/tanjikan.html
 */
const SHORT_TIME_ENROLLMENT_MONTHLY_WAGE = 88_000;

/**
 * Explains a negative take-home figure: which fixed charges cause it and what relief
 * exists. Rendered under the Take-Home Pay row when the result is negative.
 */
const LowIncomeNotices: React.FC<{ results: TakeHomeResults }> = ({ results }) => {
  if (results.takeHomeIncome >= 0) {
    return null;
  }

  if (results.socialInsuranceOverride !== undefined) {
    return (
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        Take-home pay is negative because the manually entered social insurance amount exceeds
        income after taxes.
      </Alert>
    );
  }

  const isNHI = results.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID;
  const isDependentCoverage = results.healthInsuranceProvider === DEPENDENT_COVERAGE_ID;
  const isEmployeeProvider = !isNHI && !isDependentCoverage;
  const monthlyWage = (results.salaryIncome + (results.commutingAllowanceIncome ?? 0)) / 12;
  const showEmployeeNote = isEmployeeProvider && monthlyWage < SHORT_TIME_ENROLLMENT_MONTHLY_WAGE;

  return (
    <Alert severity="warning" sx={{ mt: 1.5 }}>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        Take-home pay is negative at this income: fixed social insurance charges exceed the income,
        because they do not scale down to zero.
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {isNHI && (
          <li>
            <Typography variant="body2">
              National Health Insurance charges per-person amounts (均等割) even at very low income.
              The statutory low-income reduction (均等割額の軽減) is already applied.
            </Typography>
          </li>
        )}
        {isNHI && !results.nationalPensionExemption?.applied && (
          <li>
            <Typography variant="body2">
              The National Pension contribution (国民年金保険料) is a fixed amount regardless of
              income.
              {results.nationalPensionExemption?.eligible
                ? ' This income is within the full exemption (全額免除) threshold — see the toggle under the social insurance settings.'
                : ' An income-based full exemption (全額免除) exists for lower incomes.'}
            </Typography>
          </li>
        )}
        {showEmployeeNote && (
          <li>
            <Typography variant="body2">
              Employee health insurance and employees&apos; pension premiums are based on the
              standard monthly remuneration (標準報酬月額) table, which has a lowest grade with a
              minimum premium. Enrollment as a short-time worker has statutory criteria (at least 20
              scheduled working hours per week and, currently, monthly wages of at least ¥88,000),
              so at salaries below those levels National Health Insurance and the National Pension
              usually apply instead — selectable under Health Insurance Provider.
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
    </Alert>
  );
};

export default LowIncomeNotices;
