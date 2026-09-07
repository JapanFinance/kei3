// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Typography from '@mui/material/Typography';
import React from 'react';

import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import { DetailedTooltip } from '../../ui/Tooltips';

/**
 * Tooltip for the "Annual Income" header row: states what the figure counts, so the reader can
 * see why it is gross for some income types and after expenses for others. The definition itself
 * is documented on TakeHomeResults.annualIncome in tax.ts. Renders its own DetailedTooltip
 * trigger, so callers place it directly after the row label. Shared by the Summary and Social
 * Insurance tabs.
 */
const AnnualIncomeTooltip: React.FC = () => (
  <DetailedTooltip
    title="Annual Income"
    icon={SIMPLE_TOOLTIP_ICON}
    iconAriaLabel="About annual income"
  >
    <Typography variant="body2" sx={{ mb: 1 }}>
      The amount received over the year, before taxes and social insurance: gross salary, bonus and
      stock compensation, gross public pension income, and business and miscellaneous income less
      necessary expenses.
    </Typography>
    <Typography variant="body2">
      Deductions that reduce net income without reducing the amount received are not subtracted:
      the employment income deduction, the public pension deduction, and the blue-filer special deduction.
      A commuting allowance is not counted, as it reimburses a cost.
    </Typography>
  </DetailedTooltip>
);

export default AnnualIncomeTooltip;
