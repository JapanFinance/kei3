// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type {
  BonusIncomeStream,
  CommutingAllowanceIncomeStream,
  SalaryIncomeStream,
  StockCompensationIncomeStream,
} from '../../../../types/tax';
import { formatJPY, formatMonthLong } from '../../../../utils/formatters';
import {
  getFrequencyAnnualMultiplier,
  validateIncomeStream,
} from '../../../../utils/incomeStreams';
import { SIMPLE_TOOLTIP_ICON } from '../../../ui/constants';
import { DetailedTooltip } from '../../../ui/Tooltips';
import { variantLabelSx, variantToggleGroupSx } from '../variantControlStyles';
import {
  createStreamId,
  guidanceBoxSx,
  IncomeStreamFormShell,
  StreamAmountField,
  type StreamTypeFormProps,
} from './streamFormShared';

export const SalaryStreamForm: React.FC<StreamTypeFormProps<'salary'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [frequency, setFrequency] = useState<'monthly' | 'annual'>(
    initialData?.frequency ?? 'annual',
  );

  const handleSave = () => {
    const stream: SalaryIncomeStream = {
      id: createStreamId(initialData),
      type: 'salary',
      amount,
      frequency,
    };
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="salary"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <FormControl fullWidth>
        <InputLabel id="salary-frequency-label">Frequency</InputLabel>
        <Select
          labelId="salary-frequency-label"
          value={frequency}
          label="Frequency"
          onChange={e => setFrequency(e.target.value as 'monthly' | 'annual')}
        >
          <MenuItem value="monthly">Monthly</MenuItem>
          <MenuItem value="annual">Annual</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <StreamAmountField type="salary" value={amount} onChange={setAmount} />
        {frequency === 'monthly' && amount > 0 && (
          <Typography variant="body2" align="right" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Annual: {formatJPY(amount * 12)}
          </Typography>
        )}
      </Box>
    </IncomeStreamFormShell>
  );
};

export const BonusStreamForm: React.FC<StreamTypeFormProps<'bonus'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [month, setMonth] = useState<number>(initialData?.month ?? 0); // 0 = Jan

  const handleSave = () => {
    const stream: BonusIncomeStream = {
      id: createStreamId(initialData),
      type: 'bonus',
      amount,
      month,
    };
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="bonus"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <FormControl fullWidth>
        <InputLabel id="bonus-month-label">Month Paid</InputLabel>
        <Select
          labelId="bonus-month-label"
          value={month}
          label="Month Paid"
          onChange={e => setMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <MenuItem key={i} value={i}>
              {formatMonthLong(i)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <StreamAmountField type="bonus" value={amount} onChange={setAmount} />
      </Box>
    </IncomeStreamFormShell>
  );
};

export const CommutingAllowanceStreamForm: React.FC<StreamTypeFormProps<'commutingAllowance'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [frequency, setFrequency] = useState<CommutingAllowanceIncomeStream['frequency']>(
    initialData?.frequency ?? 'monthly',
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const stream: CommutingAllowanceIncomeStream = {
      id: createStreamId(initialData),
      type: 'commutingAllowance',
      amount,
      frequency,
    };
    const validationError = validateIncomeStream(stream);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="commutingAllowance"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <FormControl fullWidth>
        <InputLabel id="commuting-allowance-frequency-label">Frequency</InputLabel>
        <Select
          labelId="commuting-allowance-frequency-label"
          value={frequency}
          label="Frequency"
          onChange={e =>
            setFrequency(e.target.value as CommutingAllowanceIncomeStream['frequency'])
          }
        >
          <MenuItem value="monthly">1 Month</MenuItem>
          <MenuItem value="3-months">3 Months</MenuItem>
          <MenuItem value="6-months">6 Months</MenuItem>
          <MenuItem value="annual">Annual</MenuItem>
        </Select>
      </FormControl>

      <Box>
        <StreamAmountField
          type="commutingAllowance"
          value={amount}
          onChange={val => {
            setAmount(val);
            setError(null);
          }}
          error={error}
        />
        {amount > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Monthly: {formatJPY((amount * getFrequencyAnnualMultiplier(frequency)) / 12)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Annual: {formatJPY(amount * getFrequencyAnnualMultiplier(frequency))}
            </Typography>
          </Box>
        )}
      </Box>
    </IncomeStreamFormShell>
  );
};

export const StockCompensationStreamForm: React.FC<StreamTypeFormProps<'stockCompensation'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [issuerDomicile, setIssuerDomicile] = useState<'foreign' | 'domestic'>(
    initialData?.issuerDomicile ?? 'foreign',
  );

  const handleSave = () => {
    const stream: StockCompensationIncomeStream = {
      id: createStreamId(initialData),
      type: 'stockCompensation',
      amount,
      issuerDomicile,
    };
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="stockCompensation"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <FormControl fullWidth>
        <FormLabel id="stock-issuer-label" sx={variantLabelSx}>
          <span>Stock Issuer</span>
          <DetailedTooltip
            title="Stock Issuer"
            icon={SIMPLE_TOOLTIP_ICON}
            iconAriaLabel="issuance info"
          >
            <Typography sx={{ display: 'block', mb: 1 }}>
              <strong>Foreign-issued stock compensation</strong> means grants from a non-Japanese
              company, such as the foreign parent company of a Japanese subsidiary. It is not
              subject to social insurance premiums (社会保険料).
            </Typography>
            <Typography sx={{ display: 'block' }}>
              <strong>Domestic-issued stock compensation</strong> is not currently supported. It is
              subject to social insurance premiums.
            </Typography>
          </DetailedTooltip>
        </FormLabel>
        <ToggleButtonGroup
          value={issuerDomicile}
          exclusive
          onChange={(_, newValue: 'domestic' | 'foreign' | null) => {
            if (newValue) {
              setIssuerDomicile(newValue);
            }
          }}
          aria-labelledby="stock-issuer-label"
          aria-label="stock compensation issuance"
          size="small"
          sx={variantToggleGroupSx}
        >
          <ToggleButton value="domestic" disabled>
            Domestic
          </ToggleButton>
          <ToggleButton value="foreign">Foreign</ToggleButton>
        </ToggleButtonGroup>
      </FormControl>

      <Box>
        <StreamAmountField type="stockCompensation" value={amount} onChange={setAmount} />

        <Box sx={guidanceBoxSx}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            How to Calculate Stock-Based Compensation Income
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
            See the notes below for more specific information. In general, calculate the JPY amount
            of financial benefit realized.
          </Typography>

          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Exchange Rate
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Use the TTM (Telegraphic Transfer Middle) exchange rate on the day of the taxable
                event for converting foreign currency denominated share value to JPY. If that
                date&apos;s exchange rate is not available, use the closest available prior
                date&apos;s TTM rate.
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', mt: 1, display: 'block' }}
              >
                Example conversion: $15,000 × 150 JPY/USD = ¥2,250,000.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                RS / RSU / PS / PSU{' '}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Restricted Stock (Units) / Performance Shares (Units)
              </Typography>
              <Typography variant="body2">
                Use the fair market value on the vesting date of the vested shares.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Stock Options
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Use (share price at exercise − strike price) × exercised shares.
              </Typography>
              <Typography variant="body2">
                Only{' '}
                <a
                  href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1543.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  non-qualified stock options
                </a>{' '}
                income should be entered here.{' '}
                <a
                  href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1540.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Qualified stock options
                </a>{' '}
                are not currently supported.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ESPP (Employee Stock Purchase Plan)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Use the discount amount when shares are purchased. For example, for shares purchased
                with a fair market value of $10,000 at a 15% discount (i.e. for $8,500), the taxable
                amount is $1,500.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Foreign-Source Income &amp; Non-Permanent Tax Residents
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                If work was performed outside Japan for a period of time between grant and
                vest/exercise, the proportion of the income realized equal to the proportion of time
                worked outside Japan would be foreign-source income. For a{' '}
                <a
                  href="https://wiki.japanfinance.org/tax/income/#non-permanent-tax-residents"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  non-permanent tax resident
                </a>{' '}
                at the time that income is realized, the foreign-source income will not be taxable
                in Japan unless{' '}
                <a
                  href="https://wiki.japanfinance.org/tax/income/#income-that-is-neither-japan-source-nor-foreign-source"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  remittances to Japan
                </a>{' '}
                were made in the same year that make some or all of it taxable. Taxpayers who are
                not non-permanent tax residents would have to use foreign tax credits to alleviate
                Japanese taxation on the foreign-source income that will be taxable in the foreign
                country.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                Only input the amount of stock-based compensation income that is taxable in Japan.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>
    </IncomeStreamFormShell>
  );
};
