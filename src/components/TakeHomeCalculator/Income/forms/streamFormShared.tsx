// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { IncomeStream, IncomeStreamType } from '../../../../types/tax';
import { SpinnerNumberField } from '../../../ui/SpinnerNumberField';
import { getIncomeCategory, INCOME_STREAM_CATALOG } from '../incomeStreamCatalog';

export interface StreamTypeFormProps<T extends IncomeStreamType = IncomeStreamType> {
  initialData?: Extract<IncomeStream, { type: T }> | undefined;
  onSave: (stream: Extract<IncomeStream, { type: T }>) => void;
  onCancel: () => void;
  isMinimumTaxTriggered?: ((draft: IncomeStream) => boolean) | undefined;
}

export const createStreamId = (initialData?: { id: string }): string =>
  initialData?.id ?? Date.now().toString(36) + Math.random().toString(36).substring(2);

export const MINIMUM_TAX_REPORTING_NOTE =
  'Due to the Minimum Tax on High Income, this must be reported on the tax return.';

// Two-column grid on desktop (sm), stacking into a single column on mobile.
export const figureGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
  columnGap: 2,
  rowGap: { xs: 1.25, sm: 2 },
  alignItems: 'start',
};

export const guidanceBoxSx = {
  p: 1.5,
  backgroundColor: 'background.default',
  borderRadius: 1,
  mt: 2,
  border: '1px solid',
  borderColor: 'divider',
};

export const minimumTaxWarningSx = { color: 'warning.main' };

export const NTA_TAX_ANSWERS = {
  saleOfShares: {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm',
    label: 'Tax on the sale of shares (株式等を譲渡したときの課税) - NTA',
  },
  dividendIncome: {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1330.htm',
    label: 'Dividend income (配当所得) - NTA',
  },
  separateTaxationOfDividends: {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1331.htm',
    label:
      'Separate taxation of listed-share dividends (上場株式等の配当等に係る申告分離課税制度) - NTA',
  },
  lossOffset: {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1474.htm',
    label: 'Offsetting and carrying forward listed-share losses (損益通算・繰越控除) - NTA',
  },
  designatedAccounts: {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1476.htm',
    label: 'The designated account system (特定口座制度) - NTA',
  },
  foreignTaxCredit: {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1240.htm',
    label: 'Foreign tax credit (外国税額控除) - NTA',
  },
  realEstateIncome: {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1370.htm',
    label: 'Real estate income (不動産所得) - NTA',
  },
  realEstateLossOffset: {
    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1391.htm',
    label:
      'Offsetting real estate losses against other income (不動産所得が赤字のときの通算) - NTA',
  },
};

interface IncomeStreamFormShellProps {
  type: IncomeStreamType;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export const IncomeStreamFormShell: React.FC<IncomeStreamFormShellProps> = ({
  type,
  isEditing,
  onSave,
  onCancel,
  children,
}) => {
  const info = INCOME_STREAM_CATALOG[type];
  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={info.chipLabel}
            size="small"
            color={getIncomeCategory(info.category).chipColor}
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
            {isEditing ? 'Edit' : 'Add'} {info.label}
          </Typography>
          {info.labelDetail && (
            <Typography variant="caption" sx={{ color: 'text.secondary', flexBasis: '100%' }}>
              {info.labelDetail}
            </Typography>
          )}
        </Box>

        {children}

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" onClick={onSave}>
            {isEditing ? 'Update' : 'Add'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

interface StreamAmountFieldProps {
  type: IncomeStreamType;
  value: number;
  onChange: (val: number) => void;
  error?: string | null | undefined;
  helperText?: React.ReactNode;
  autoFocus?: boolean;
}

export const StreamAmountField: React.FC<StreamAmountFieldProps> = ({
  type,
  value,
  onChange,
  error,
  helperText,
  autoFocus = true,
}) => {
  const info = INCOME_STREAM_CATALOG[type];
  return (
    <SpinnerNumberField
      inputProps={{ autoFocus }}
      label={info.amountLabel}
      value={value}
      onChange={onChange}
      sx={{ width: '100%' }}
      helperText={error || helperText || info.amountHelperText}
      error={!!error}
      {...(info.min !== undefined && { min: info.min })}
    />
  );
};
