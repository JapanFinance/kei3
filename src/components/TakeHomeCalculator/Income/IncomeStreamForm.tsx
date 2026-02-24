// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';
import { SpinnerNumberField } from '../../ui/SpinnerNumberField';
import type { IncomeStream, IncomeStreamType } from '../../../types/tax';

import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { formatJPY } from '../../../utils/formatters';
import { DetailedTooltip } from '../../ui/Tooltips';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';

interface IncomeStreamFormProps {
  initialData?: IncomeStream;
  onSave: (stream: IncomeStream) => void;
  onCancel: () => void;
  disabledTypes?: string[];
}

const validSalaryFrequencies = ['monthly', 'annual'];

export const IncomeStreamForm: React.FC<IncomeStreamFormProps> = ({
  initialData,
  onSave,
  onCancel,
  disabledTypes = [],
}) => {

  const [type, setType] = useState<IncomeStreamType>(initialData?.type || 'salary');
  const [amount, setAmount] = useState<number>(initialData?.amount || 0);
  const [frequency, setFrequency] = useState<'monthly' | '3-months' | '6-months' | 'annual'>(((initialData?.type === 'salary' || initialData?.type === 'commutingAllowance') && initialData.frequency) || 'annual');
  const [month, setMonth] = useState<number>((initialData?.type === 'bonus' && initialData.month) || 0); // 0 = Jan
  const [blueFilerDeduction, setBlueFilerDeduction] = useState<number>((initialData?.type === 'business' && initialData.blueFilerDeduction) || 0);
  const [issuerDomicile, setIssuerDomicile] = useState<'foreign' | 'domestic'>((initialData?.type === 'stockCompensation' && initialData.issuerDomicile) || 'foreign');
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (type === 'commutingAllowance') {
      let monthlyAmount = amount;
      if (frequency === '3-months') monthlyAmount = amount / 3;
      if (frequency === '6-months') monthlyAmount = amount / 6;
      if (frequency === 'annual') monthlyAmount = amount / 12;

      if (monthlyAmount > 150000) {
        setError('Commuting allowance cannot exceed 150,000 JPY/month (non-taxable limit). For amounts exceeding this, please include the excess as part of your salary.');
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const id = initialData?.id || Date.now().toString(36) + Math.random().toString(36).substring(2);
    let stream: IncomeStream;

    if (type === 'salary') {
      stream = { id, type: 'salary', amount, frequency: frequency as 'monthly' | 'annual' };
    } else if (type === 'bonus') {
      stream = { id, type: 'bonus', amount, month };
    } else if (type === 'business') {
      stream = { id, type: 'business', amount, blueFilerDeduction };
    } else if (type === 'commutingAllowance') {
      stream = { id, type: 'commutingAllowance', amount, frequency };
    } else if (type === 'stockCompensation') {
      stream = { id, type: 'stockCompensation', amount, issuerDomicile };
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
      case 'commutingAllowance':
        return 'Allowance Amount';
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
      case 'commutingAllowance':
        return 'Commuting allowance up to 150,000 yen per month is non-taxable for income tax, but the full amount affects social insurance premiums.';
      case 'stockCompensation':
        return undefined;
      default:
        return undefined;
    }
  };

  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
      <Stack spacing={2}>
        <FormControl fullWidth>
          <InputLabel id="income-type-label">Income/Benefit Type</InputLabel>
          <Select
            labelId="income-type-label"
            value={type}
            label="Income/Benefit Type"
            onChange={(e) => {
              const newType = e.target.value as IncomeStreamType;
              setType(newType);
              if (newType === 'commutingAllowance') {
                setFrequency('monthly');
              } else if (newType === 'salary' && !validSalaryFrequencies.includes(frequency)) {
                setFrequency('annual');
              }
            }}
          >
            <MenuItem value="salary" disabled={disabledTypes.includes('salary')}>Salary</MenuItem>
            <MenuItem value="bonus" disabled={disabledTypes.includes('bonus')}>Bonus</MenuItem>
            <MenuItem value="commutingAllowance" disabled={disabledTypes.includes('commutingAllowance')}>Commuting Allowance</MenuItem>
            <MenuItem value="stockCompensation" disabled={disabledTypes.includes('stockCompensation')}>Stock-Based Compensation</MenuItem>
            <MenuItem value="business" disabled={disabledTypes.includes('business')}>Business</MenuItem>
            <MenuItem value="miscellaneous" disabled={disabledTypes.includes('miscellaneous')}>Miscellaneous</MenuItem>
          </Select>
        </FormControl>

        {type === 'salary' && (
          <FormControl fullWidth>
            <InputLabel id="salary-frequency-label">Frequency</InputLabel>
            <Select
              labelId="salary-frequency-label"
              value={frequency}
              label="Frequency"
              onChange={(e) => setFrequency(e.target.value as 'monthly' | 'annual')}
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="annual">Annual</MenuItem>
            </Select>
          </FormControl>
        )}

        {type === 'commutingAllowance' && (
          <FormControl fullWidth>
            <InputLabel id="commuting-allowance-frequency-label">Frequency</InputLabel>
            <Select
              labelId="commuting-allowance-frequency-label"
              value={frequency}
              label="Frequency"
              onChange={(e) => setFrequency(e.target.value as 'monthly' | '3-months' | '6-months' | 'annual')}
            >
              <MenuItem value="monthly">1 Month</MenuItem>
              <MenuItem value="3-months">3 Months</MenuItem>
              <MenuItem value="6-months">6 Months</MenuItem>
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

        {type === 'stockCompensation' && (
          <FormControl fullWidth>
            <FormLabel
              id="stock-issuer-label"
              sx={{
                  mb: 0.5,
                  fontWeight: 500,
                  color: 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <span>Stock Issuer</span>
                <DetailedTooltip
                  title="Stock Issuer"
                  icon={SIMPLE_TOOLTIP_ICON}
                  iconAriaLabel="issuance info"
                >
                  <Typography display="block" sx={{ mb: 1 }}>
                    <strong>Foreign-issued stock compensation</strong> means grants from a non-Japanese company, such as the foreign parent company of a Japanese subsidiary. It is not subject to social insurance premiums (社会保険料).
                  </Typography>
                  <Typography display="block">
                    <strong>Domestic-issued stock compensation</strong> is not currently supported. It is subject to social insurance premiums.
                  </Typography>
                </DetailedTooltip>
              </FormLabel>
              <ToggleButtonGroup
                value={issuerDomicile}
                exclusive
                onChange={(_, newValue) => {
                  if (newValue) {
                    setIssuerDomicile(newValue);
                  }
                }}
                aria-labelledby="stock-issuer-label"
                aria-label="stock compensation issuance"
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 2,
                    py: 0.5,
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    fontWeight: 500,
                  },
                  '& .MuiToggleButton-root.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    }
                  }
                }}
              >
                <ToggleButton value="domestic" disabled>Domestic</ToggleButton>
                <ToggleButton value="foreign">Foreign</ToggleButton>
              </ToggleButtonGroup>
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
                <DetailedTooltip
                  title="Blue-Filer Requirements"
                  icon={<InfoOutlinedIcon fontSize="small" />}
                  iconAriaLabel="requirements"
                >
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
                        <Box component="th" sx={{ width: '30%', textAlign: 'left' }}>Requirement</Box>
                        <Box component="th" sx={{ color: 'primary.main' }}>¥650k</Box>
                        <Box component="th" sx={{ color: 'text.primary' }}>¥550k</Box>
                        <Box component="th" sx={{ color: 'text.secondary' }}>¥100k</Box>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Bookkeeping</td>
                        <Box component="td" sx={{ color: 'success.main' }}>Double Entry</Box>
                        <Box component="td" sx={{ color: 'success.main' }}>Double Entry</Box>
                        <Box component="td" sx={{ color: 'text.secondary' }}>Simple</Box>
                      </tr>
                      <tr>
                        <td>Balance Sheet, Profit & Loss Statement</td>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>○</Box>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>○</Box>
                        <Box component="td" sx={{ color: 'text.disabled' }}>—</Box>
                      </tr>
                      <tr>
                        <td>On-time Filing</td>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>○</Box>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>○</Box>
                        <Box component="td" sx={{ color: 'text.disabled' }}>—</Box>
                      </tr>
                      <tr>
                        <td>e-Tax or Electronic Books</td>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>○</Box>
                        <Box component="td" sx={{ color: 'text.disabled' }}>—</Box>
                        <Box component="td" sx={{ color: 'text.disabled' }}>—</Box>
                      </tr>
                    </tbody>
                  </Box>
                </DetailedTooltip>
              </FormHelperText>
            </FormControl>
          )}


          <SpinnerNumberField
            label={getAmountLabel()}
            value={amount}
            onChange={(val) => setAmount(val)}
            sx={{ width: '100%' }}
            helperText={error || getAmountHelperText()}
            error={!!error}
          />
          {type === 'salary' && frequency === 'monthly' && amount > 0 && (
            <Typography variant="body2" color="text.secondary" align="right" sx={{ mt: 0.5 }}>
              Annual: {formatJPY(amount * 12)}
            </Typography>
          )}
          {type === 'commutingAllowance' && amount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Monthly: {formatJPY(
                  frequency === 'monthly' ? amount :
                    frequency === '3-months' ? amount / 3 :
                      frequency === '6-months' ? amount / 6 :
                        amount / 12
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Annual: {formatJPY(
                  frequency === 'monthly' ? amount * 12 :
                    frequency === '3-months' ? amount * 4 :
                      frequency === '6-months' ? amount * 2 :
                        amount
                )}
              </Typography>
            </Box>
          )}

          {type === 'stockCompensation' && (
            <Box sx={{ p: 1.5, backgroundColor: 'background.default', borderRadius: 1, mt: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                How to Calculate Your Stock-Based Compensation Income
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
                See the notes below for more specific information. In general, calculate the JPY amount of financial benefit realized.
              </Typography>

              <Accordion disableGutters elevation={0} sx={{ mb: 1, border: '1px solid', borderColor: 'divider' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" fontWeight={600}>Exchange Rate</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">
                    Use the TTM (Telegraphic Transfer Middle) exchange rate on the day of the taxable event for converting foreign currency denominated share value to JPY.
                    If that date's exchange rate is not available, use the closest available prior date's TTM rate.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Example conversion: $15,000 × 150 JPY/USD = ¥2,250,000.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion disableGutters elevation={0} sx={{ mb: 1, border: '1px solid', borderColor: 'divider' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" fontWeight={600}>RS / RSU / PS / PSU </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" fontWeight={600} marginBottom={0.5}>
                    Restricted Stock (Units) / Performance Shares (Units)
                  </Typography>
                  <Typography variant="body2">
                    Use the fair market value on the vesting date of the vested shares.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion disableGutters elevation={0} sx={{ mb: 1, border: '1px solid', borderColor: 'divider' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" fontWeight={600}>Stock Options</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Use (share price at exercise − strike price) × exercised shares.
                  </Typography>
                  <Typography variant="body2">
                    Only <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1543.htm" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>non-qualified stock options</a> income should be entered here. <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1540.htm" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Qualified stock options</a> are not currently supported.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion disableGutters elevation={0} sx={{ mb: 1, border: '1px solid', borderColor: 'divider' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" fontWeight={600}>ESPP (Employee Stock Purchase Plan)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">
                    Use the discount amount when shares are purchased. For example, if you purchased shares with a fair market value of $10,000 at a 15% discount (i.e. for $8,500), the taxable amount is $1,500.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion disableGutters elevation={0} sx={{ mb: 1, border: '1px solid', borderColor: 'divider' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" fontWeight={600}>Foreign-Source Income & Non-Permanent Tax Residents</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">
                    If you worked outside Japan for a period of time between grant and vest/exercise, the proportion of the income realized equal to the proportion of time worked outside Japan would be foreign-source income.
                    If you are a <a href="https://wiki.japanfinance.org/tax/income/#non-permanent-tax-residents" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>non-permanent tax resident</a> when that income is realized, the foreign-source income will not be taxable in Japan unless <a href="https://wiki.japanfinance.org/tax/income/#income-that-is-neither-japan-source-nor-foreign-source" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>remittances to Japan</a> were made in the same year that make some or all of it taxable.
                    Taxpayers who are not non-permanent tax residents would have to use foreign tax credits to alleviate Japanese taxation on the foreign-source income that will be taxable in the foreign country.
                  </Typography>
                  <Typography variant="body2" marginTop={1.5}>
                    Only input the amount of stock-based compensation income that is taxable in Japan.
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </Box>
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
