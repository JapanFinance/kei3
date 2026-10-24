// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type { RealEstateIncomeStream } from '../../../../types/tax';
import { foreignTaxEntryError } from '../../../../utils/incomeStreams';
import { SpinnerNumberField } from '../../../ui/SpinnerNumberField';
import {
  createStreamId,
  figureGridSx,
  guidanceBoxSx,
  IncomeStreamFormShell,
  NTA_TAX_ANSWERS,
  StreamAmountField,
  type StreamTypeFormProps,
} from './streamFormShared';

export const RealEstateStreamForm: React.FC<StreamTypeFormProps<'realEstate'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [location, setLocation] = useState<'domestic' | 'foreign'>(
    initialData?.location ?? 'domestic',
  );
  const [foreignTax, setForeignTax] = useState<number>(initialData?.foreignTax ?? 0);
  const [landDebtInterest, setLandDebtInterest] = useState<number>(
    initialData?.landDebtInterest ?? 0,
  );
  const [foreignUsedBuildingDisallowedLoss, setForeignUsedBuildingDisallowedLoss] =
    useState<number>(initialData?.foreignUsedBuildingDisallowedLoss ?? 0);

  const draftStream: RealEstateIncomeStream = {
    id: createStreamId(initialData),
    type: 'realEstate',
    amount,
    location,
    foreignTax: location === 'foreign' ? foreignTax : 0,
    ...(amount < 0 && landDebtInterest > 0 && { landDebtInterest }),
    ...(amount < 0 &&
      location === 'foreign' &&
      foreignUsedBuildingDisallowedLoss > 0 && {
        foreignUsedBuildingDisallowedLoss,
      }),
  };

  const foreignTaxError = foreignTaxEntryError(draftStream);

  const handleSave = () => {
    if (foreignTaxError) return;
    onSave(draftStream);
  };

  return (
    <IncomeStreamFormShell
      type="realEstate"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <Stack spacing={2}>
        <Box sx={figureGridSx}>
          <FormControl fullWidth>
            <InputLabel id="real-estate-location-label">Property Location</InputLabel>
            <Select
              labelId="real-estate-location-label"
              value={location}
              label="Property Location"
              onChange={e => {
                const newLocation = e.target.value as 'domestic' | 'foreign';
                setLocation(newLocation);
                if (newLocation === 'domestic') {
                  setForeignTax(0);
                  setForeignUsedBuildingDisallowedLoss(0);
                }
              }}
            >
              <MenuItem value="domestic">Domestic (Japan / 国内)</MenuItem>
              <MenuItem value="foreign">Foreign (Outside Japan / 国外)</MenuItem>
            </Select>
          </FormControl>

          {location === 'foreign' && (
            <SpinnerNumberField
              label="Foreign Income Tax Paid"
              value={foreignTax}
              onChange={setForeignTax}
              error={!!foreignTaxError}
              helperText={
                foreignTaxError || (
                  <span>
                    Income tax paid abroad on this property (外国所得税). See{' '}
                    <a
                      href={NTA_TAX_ANSWERS.foreignTaxCredit.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      {NTA_TAX_ANSWERS.foreignTaxCredit.label}
                    </a>
                    .
                  </span>
                )
              }
            />
          )}
        </Box>

        <StreamAmountField type="realEstate" value={amount} onChange={setAmount} />

        {amount < 0 && (
          <Box sx={guidanceBoxSx}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Loss Netting Adjustments (損益通算の制限)
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Under Japanese tax law, certain losses are disallowed from offsetting salary or other
              income.
            </Typography>
            <Stack spacing={2}>
              <SpinnerNumberField
                label="Interest on Debt to Acquire Land"
                value={landDebtInterest}
                onChange={setLandDebtInterest}
                helperText={
                  <span>
                    土地等を取得するために要した負債の利子の額 (措法41条の4). When real estate
                    income is in deficit, interest paid on loans to purchase land cannot offset
                    other income.
                  </span>
                }
              />

              {location === 'foreign' && (
                <SpinnerNumberField
                  label="Disallowed Foreign Used Building Depreciation Loss"
                  value={foreignUsedBuildingDisallowedLoss}
                  onChange={setForeignUsedBuildingDisallowedLoss}
                  helperText={
                    <span>
                      国外中古建物の減価償却費等の特例 (措法41条の4の3). Losses from foreign used
                      buildings attributable to shortened-life depreciation cannot offset other
                      income.
                    </span>
                  }
                />
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </IncomeStreamFormShell>
  );
};
