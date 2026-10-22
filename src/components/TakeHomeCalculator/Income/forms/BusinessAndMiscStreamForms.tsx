// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type { BusinessIncomeStream, MiscellaneousIncomeStream } from '../../../../types/tax';
import { DetailedTooltip } from '../../../ui/Tooltips';
import {
  createStreamId,
  IncomeStreamFormShell,
  StreamAmountField,
  type StreamTypeFormProps,
} from './streamFormShared';

export const BusinessStreamForm: React.FC<StreamTypeFormProps<'business'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [blueFilerDeduction, setBlueFilerDeduction] = useState<number>(
    initialData?.blueFilerDeduction ?? 0,
  );

  const handleSave = () => {
    const stream: BusinessIncomeStream = {
      id: createStreamId(initialData),
      type: 'business',
      amount,
      blueFilerDeduction,
    };
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="business"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <Box>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="blue-filer-label">Blue-Filer Special Deduction</InputLabel>
          <Select
            labelId="blue-filer-label"
            value={blueFilerDeduction}
            label="Blue-Filer Special Deduction"
            onChange={e => setBlueFilerDeduction(Number(e.target.value))}
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
              </a>
              .
            </span>
            <DetailedTooltip
              title="Blue-Filer Requirements"
              icon={<InfoOutlinedIcon fontSize="small" />}
              iconAriaLabel="requirements"
            >
              <Typography variant="caption" sx={{ display: 'block', mb: 1, lineHeight: 1.2 }}>
                Requires prior tax office approval (see{' '}
                <a
                  href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Blue-Form Approval Application
                </a>
                ).
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
                    verticalAlign: 'middle',
                  },
                  '& td': {
                    textAlign: 'center',
                    p: 0.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    verticalAlign: 'middle',
                  },
                  '& td:first-of-type': {
                    textAlign: 'left',
                    fontWeight: 500,
                    color: 'text.secondary',
                  },
                }}
              >
                <thead>
                  <tr>
                    <Box component="th" sx={{ width: '30%', textAlign: 'left' }}>
                      Requirement
                    </Box>
                    <Box component="th" sx={{ color: 'primary.main' }}>
                      ¥650k
                    </Box>
                    <Box component="th" sx={{ color: 'text.primary' }}>
                      ¥550k
                    </Box>
                    <Box component="th" sx={{ color: 'text.secondary' }}>
                      ¥100k
                    </Box>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Bookkeeping</td>
                    <Box component="td" sx={{ color: 'success.main' }}>
                      Double Entry
                    </Box>
                    <Box component="td" sx={{ color: 'success.main' }}>
                      Double Entry
                    </Box>
                    <Box component="td" sx={{ color: 'text.secondary' }}>
                      Simple
                    </Box>
                  </tr>
                  <tr>
                    <td>Balance Sheet, Profit &amp; Loss Statement</td>
                    <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                      ○
                    </Box>
                    <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                      ○
                    </Box>
                    <Box component="td" sx={{ color: 'text.disabled' }}>
                      —
                    </Box>
                  </tr>
                  <tr>
                    <td>On-time Filing</td>
                    <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                      ○
                    </Box>
                    <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                      ○
                    </Box>
                    <Box component="td" sx={{ color: 'text.disabled' }}>
                      —
                    </Box>
                  </tr>
                  <tr>
                    <td>e-Tax or Electronic Books</td>
                    <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                      ○
                    </Box>
                    <Box component="td" sx={{ color: 'text.disabled' }}>
                      —
                    </Box>
                    <Box component="td" sx={{ color: 'text.disabled' }}>
                      —
                    </Box>
                  </tr>
                </tbody>
              </Box>
            </DetailedTooltip>
          </FormHelperText>
        </FormControl>

        <StreamAmountField type="business" value={amount} onChange={setAmount} />
      </Box>
    </IncomeStreamFormShell>
  );
};

export const MiscellaneousStreamForm: React.FC<StreamTypeFormProps<'miscellaneous'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);

  const handleSave = () => {
    const stream: MiscellaneousIncomeStream = {
      id: createStreamId(initialData),
      type: 'miscellaneous',
      amount,
    };
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="miscellaneous"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <Box>
        <StreamAmountField type="miscellaneous" value={amount} onChange={setAmount} />
      </Box>
    </IncomeStreamFormShell>
  );
};
