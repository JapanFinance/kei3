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
import FormHelperText from '@mui/material/FormHelperText';
import { SpinnerNumberField } from '../../ui/SpinnerNumberField';
import type { IncomeStream, IncomeStreamType } from '../../../types/tax';

import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { formatJPY } from '../../../utils/formatters';
import { InfoTooltip } from '../../ui/InfoTooltip';

interface IncomeStreamFormProps {
  initialData?: IncomeStream;
  onSave: (stream: IncomeStream) => void;
  onCancel: () => void;
  disabledTypes?: string[];
}

export const IncomeStreamForm: React.FC<IncomeStreamFormProps> = ({
  initialData,
  onSave,
  onCancel,
  disabledTypes = [],
}) => {
  const [type, setType] = useState<IncomeStreamType>(initialData?.type || 'salary');
  const [amount, setAmount] = useState<number>(initialData?.amount || 0);
  const [frequency, setFrequency] = useState<'monthly' | 'annual'>((initialData?.type === 'salary' && initialData.frequency) || 'annual');
  const [month, setMonth] = useState<number>((initialData?.type === 'bonus' && initialData.month) || 0); // 0 = Jan
  const [blueFilerDeduction, setBlueFilerDeduction] = useState<number>((initialData?.type === 'business' && initialData.blueFilerDeduction) || 0);

  const handleSave = () => {
    const id = initialData?.id || Date.now().toString(36) + Math.random().toString(36).substring(2);
    let stream: IncomeStream;

    if (type === 'salary') {
      stream = { id, type: 'salary', amount, frequency };
    } else if (type === 'bonus') {
      stream = { id, type: 'bonus', amount, month };
    } else if (type === 'business') {
      stream = { id, type: 'business', amount, blueFilerDeduction };
    } else {
      stream = { id, type: 'miscellaneous', amount };
    }

    onSave(stream);
  };

  const getAmountLabel = () => {
    switch (type) {
      case 'business':
      case 'miscellaneous':
        return 'Annual Net Income';
      default:
        return 'Gross Income';
    }
  };

  const getAmountHelperText = () => {
    switch (type) {
      case 'business':
        return 'Business income minus business expenses. If you operate multiple businesses, combine for all businesses.';
      case 'miscellaneous':
        return 'Income minus necessary expenses';
      case 'salary':
        return 'Gross income before taxes and deductions';
      case 'bonus':
        return 'Gross bonus amount before taxes and deductions';
      default:
        return undefined;
    }
  };

  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, mb: 2 }}>
      <Stack spacing={2}>
        <FormControl fullWidth>
          <InputLabel id="income-type-label">Income Type</InputLabel>
          <Select
            labelId="income-type-label"
            value={type}
            label="Income Type"
            onChange={(e) => setType(e.target.value as IncomeStreamType)}
          >
            <MenuItem value="salary" disabled={disabledTypes.includes('salary')}>Salary</MenuItem>
            <MenuItem value="bonus" disabled={disabledTypes.includes('bonus')}>Bonus</MenuItem>
            <MenuItem value="business" disabled={disabledTypes.includes('business')}>Business</MenuItem>
            <MenuItem value="miscellaneous" disabled={disabledTypes.includes('miscellaneous')}>Miscellaneous</MenuItem>
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

        <Box>
          {type === 'business' && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="blue-filer-label">Blue-Filer Special Deduction</InputLabel>
              <Select
                labelId="blue-filer-label"
                value={blueFilerDeduction}
                label="Blue-Filer Special Deduction"
                onChange={(e) => setBlueFilerDeduction(Number(e.target.value))}
              >
                <MenuItem value={0}>None</MenuItem>
                <MenuItem value={100000}>¥100,000</MenuItem>
                <MenuItem value={550000}>¥550,000</MenuItem>
                <MenuItem value={650000}>¥650,000</MenuItem>
              </Select>
              <FormHelperText component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>
                  See{' '}
                  <a
                    href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    No.2072 青色申告特別控除 (NTA)
                  </a>.
                </span>
                <InfoTooltip
                  title="Blue-Filer Requirements"
                  icon={<InfoOutlinedIcon fontSize="small" />}
                  iconAriaLabel="requirements"
                >
                  <Typography variant="subtitle2" gutterBottom>Blue-Filer Requirements:</Typography>
                  <Typography variant="caption" display="block" sx={{ mb: 1, lineHeight: 1.2 }}>
                    Requires prior tax office approval (see{' '}
                    <a
                      href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      Blue-Form Approval Application
                    </a>).
                  </Typography>

                  <Box
                    component="table"
                    sx={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.75rem',
                      '& th': {
                        textAlign: 'center',
                        p: 0.5,
                        fontWeight: 600,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        verticalAlign: 'middle'
                      },
                      '& td': {
                        textAlign: 'center',
                        p: 0.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        verticalAlign: 'middle'
                      },
                      '& td:first-of-type': {
                        textAlign: 'left',
                        fontWeight: 500,
                        color: 'text.secondary'
                      }
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ width: '30%', textAlign: 'left' }}>Requirement</th>
                        <th style={{ color: '#1976d2' }}>¥650k</th>
                        <th style={{ color: '#424242' }}>¥550k</th>
                        <th style={{ color: '#757575' }}>¥100k</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Bookkeeping</td>
                        <td style={{ color: '#2e7d32' }}>Double Entry</td>
                        <td style={{ color: '#2e7d32' }}>Double Entry</td>
                        <td style={{ color: '#757575' }}>Simple</td>
                      </tr>
                      <tr>
                        <td>Balance Sheet, Profit & Loss Statement</td>
                        <td style={{ color: '#2e7d32', fontSize: '1rem' }}>○</td>
                        <td style={{ color: '#2e7d32', fontSize: '1rem' }}>○</td>
                        <td style={{ color: '#bdbdbd' }}>—</td>
                      </tr>
                      <tr>
                        <td>On-time Filing</td>
                        <td style={{ color: '#2e7d32', fontSize: '1rem' }}>○</td>
                        <td style={{ color: '#2e7d32', fontSize: '1rem' }}>○</td>
                        <td style={{ color: '#bdbdbd' }}>—</td>
                      </tr>
                      <tr>
                        <td>e-Tax or Electronic Books</td>
                        <td style={{ color: '#2e7d32', fontSize: '1rem' }}>○</td>
                        <td style={{ color: '#bdbdbd' }}>—</td>
                        <td style={{ color: '#bdbdbd' }}>—</td>
                      </tr>
                    </tbody>
                  </Box>
                </InfoTooltip>
              </FormHelperText>
            </FormControl>
          )}


          <SpinnerNumberField
            label={getAmountLabel()}
            value={amount}
            onChange={(val) => setAmount(val)}
            sx={{ width: '100%' }}
            helperText={getAmountHelperText()}
          />
          {type === 'salary' && frequency === 'monthly' && amount > 0 && (
            <Typography variant="body2" color="text.secondary" align="right" sx={{ mt: 0.5 }}>
              Annual: {formatJPY(amount * 12)}
            </Typography>
          )}
        </Box>

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
