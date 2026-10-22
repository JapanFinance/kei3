// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React from 'react';

import { SIMPLE_TOOLTIP_ICON } from '../../../ui/constants';
import SourceLinks from '../../../ui/SourceLinks';
import { DetailedTooltip } from '../../../ui/Tooltips';
import { variantLabelSx, variantToggleGroupSx } from '../variantControlStyles';
import { guidanceBoxSx, NTA_TAX_ANSWERS } from './streamFormShared';

// What happens to foreign tax on a dividend, for the reporting tooltip and the guidance box (措法9条の2③, 措令4条の5⑫).
export const FOREIGN_DIVIDEND_TAX_NOTE =
  'For a dividend from a foreign company or fund that is not reported on a tax return, the Japanese tax is charged on the dividend after the foreign tax, and the foreign tax is not credited. Reported, the foreign tax is credited against Japanese tax, up to limits set by the Foreign Tax Credit rules.';

export const WITHHOLDING_ACCOUNT_REPORTING_TOOLTIP = (
  <DetailedTooltip title="Reporting" icon={SIMPLE_TOOLTIP_ICON} iconAriaLabel="reporting info">
    <Typography sx={{ display: 'block', mb: 1 }}>
      Whether a withholding designated account&apos;s sales and dividends go on a tax return is
      chosen per such account, separate from every other account.
    </Typography>
    <Typography sx={{ display: 'block', mb: 1 }}>
      Reporting includes the figure on the tax return, where it counts toward total net income. A
      reported loss offsets the year&apos;s other reported gains and, under separate taxation, the
      reported dividends. All reported dividends follow the one election for separate or aggregate
      taxation, made in the income list.
    </Typography>
    <Typography sx={{ display: 'block' }}>
      Tax withheld on a reported amount is credited at filing.
    </Typography>
  </DetailedTooltip>
);

// Each listed-share form links only the pages behind the choices it offers.
export const LISTED_SHARE_SOURCES = {
  withholdingAccount: [
    NTA_TAX_ANSWERS.designatedAccounts,
    NTA_TAX_ANSWERS.saleOfShares,
    NTA_TAX_ANSWERS.dividendIncome,
    NTA_TAX_ANSWERS.lossOffset,
    NTA_TAX_ANSWERS.foreignTaxCredit,
  ],
  capitalGains: [NTA_TAX_ANSWERS.saleOfShares, NTA_TAX_ANSWERS.lossOffset],
  dividends: [
    NTA_TAX_ANSWERS.dividendIncome,
    NTA_TAX_ANSWERS.separateTaxationOfDividends,
    NTA_TAX_ANSWERS.foreignTaxCredit,
  ],
};

interface ListedShareTypeControlProps {
  value: 'listed' | 'other';
  onChange: (value: 'listed' | 'other') => void;
}

export const ListedShareTypeControl: React.FC<ListedShareTypeControlProps> = ({
  value,
  onChange,
}) => (
  <FormControl fullWidth>
    <FormLabel id="share-type-label" sx={variantLabelSx}>
      <span>Share Type</span>
      <DetailedTooltip
        title="Share Type"
        icon={SIMPLE_TOOLTIP_ICON}
        iconAriaLabel="share type info"
      >
        <Typography sx={{ display: 'block', mb: 1 }}>
          <strong>Listed (上場株式等)</strong> covers shares traded on an exchange, along with
          publicly offered stock investment trusts (公募株式投資信託) and specified bonds
          (特定公社債) such as government bonds and listed corporate bonds. Gains and dividends on
          them are separately taxed at a flat rate.
        </Typography>
        <Typography sx={{ display: 'block' }}>
          <strong>Other (一般株式等)</strong> is every other share or fund, mostly unlisted shares.
          It is not supported yet: it is a separate income class whose losses and gains cannot be
          combined with listed amounts, and its dividends are always taxed in aggregate.
        </Typography>
      </DetailedTooltip>
    </FormLabel>
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, newValue: 'listed' | 'other' | null) => {
        if (newValue) {
          onChange(newValue);
        }
      }}
      aria-labelledby="share-type-label"
      aria-label="share type"
      size="small"
      sx={variantToggleGroupSx}
    >
      <ToggleButton value="listed">Listed</ToggleButton>
      <ToggleButton value="other" disabled>
        Other
      </ToggleButton>
    </ToggleButtonGroup>
  </FormControl>
);

interface ListedShareGuidanceBoxProps {
  type: 'withholdingAccount' | 'capitalGains' | 'dividends';
  showForeignDividendTaxNote?: boolean;
}

export const ListedShareGuidanceBox: React.FC<ListedShareGuidanceBoxProps> = ({
  type,
  showForeignDividendTaxNote,
}) => (
  <Box sx={guidanceBoxSx}>
    <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
      Do not include tax-free NISA dividends or capital gains.
    </Typography>
    {type === 'withholdingAccount' && (
      <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
        In a withholding designated account the broker withholds Japanese tax. Capital losses
        automatically offset dividends paid into the account, so tax is withheld only on the net
        amount.
      </Typography>
    )}
    {type === 'capitalGains' && (
      <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
        No tax is withheld on a sale outside a withholding designated account, so it is reported and
        taxed separately from other income at flat rates via a tax return.
      </Typography>
    )}
    {(type === 'withholdingAccount' || (type === 'dividends' && showForeignDividendTaxNote)) && (
      <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
        {FOREIGN_DIVIDEND_TAX_NOTE}
      </Typography>
    )}
    <SourceLinks sources={LISTED_SHARE_SOURCES[type]} />
  </Box>
);
