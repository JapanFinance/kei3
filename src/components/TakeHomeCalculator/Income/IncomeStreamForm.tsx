// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import { SpinnerNumberField } from '../../ui/SpinnerNumberField';
import type { IncomeStream, IncomeStreamType } from '../../../types/tax';

interface IncomeStreamFormProps {
  initialData?: IncomeStream;
  onSave: (stream: IncomeStream) => void;
  onCancel: () => void;
}

export const IncomeStreamForm: React.FC<IncomeStreamFormProps> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [type, setType] = useState<IncomeStreamType>(initialData?.type || 'salary');
  const [amount, setAmount] = useState<number>(initialData?.amount || 0);
  const [frequency, setFrequency] = useState<'monthly' | 'annual'>((initialData?.type === 'salary' && initialData.frequency) || 'annual');
  const [month, setMonth] = useState<number>((initialData?.type === 'bonus' && initialData.month) || 0); // 0 = Jan

  const handleSave = () => {
    const id = initialData?.id || Date.now().toString(36) + Math.random().toString(36).substring(2);
    let stream: IncomeStream;

    if (type === 'salary') {
      stream = { id, type: 'salary', amount, frequency };
    } else if (type === 'bonus') {
      stream = { id, type: 'bonus', amount, month };
    } else {
      stream = { id, type: 'business', amount };
    }

    onSave(stream);
  };

  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, mb: 2 }}>
      <Stack spacing={2}>
        <FormControl fullWidth>
          <InputLabel>Income Type</InputLabel>
          <Select
            value={type}
            label="Income Type"
            onChange={(e) => setType(e.target.value as IncomeStreamType)}
          >
            <MenuItem value="salary">Salary</MenuItem>
            <MenuItem value="bonus">Bonus</MenuItem>
            <MenuItem value="business">Business / Other</MenuItem>
          </Select>
        </FormControl>

        {type === 'salary' && (
          <FormControl fullWidth>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={frequency}
              label="Frequency"
              onChange={(e) => setFrequency(e.target.value as 'monthly' | 'annual')}
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="annual">Annual</MenuItem>
            </Select>
          </FormControl>
        )}

        {type === 'bonus' && (
          <FormControl fullWidth>
            <InputLabel>Month Paid</InputLabel>
            <Select
              value={month}
              label="Month Paid"
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <MenuItem key={i} value={i}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <SpinnerNumberField
          label="Amount"
          value={amount}
          onChange={(val) => setAmount(val)}
          sx={{ width: '100%' }}
        />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {initialData ? 'Update' : 'Add'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
