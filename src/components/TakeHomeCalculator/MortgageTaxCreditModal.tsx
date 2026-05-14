// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CloseIcon from '@mui/icons-material/Close';
import HomeIcon from '@mui/icons-material/Home';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { MortgageTaxCreditInput, MortgageHousingTier, MortgageInputMode } from '../../types/tax';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import { SimpleTooltip } from '../ui/Tooltips';
import { MORTGAGE_TAX_CREDIT_COHORTS } from '../../data/mortgageTaxCredit';

interface MortgageTaxCreditModalProps {
  open: boolean;
  onClose: () => void;
  input?: MortgageTaxCreditInput | undefined;
  onChange: (input: MortgageTaxCreditInput | undefined) => void;
  currentYear: number;
}

const HOUSING_TIER_OPTIONS: ReadonlyArray<{ value: MortgageHousingTier; label: string }> = [
  { value: 'longTermExcellent', label: '認定長期優良住宅 (Long-term excellent)' },
  { value: 'lowCarbon',         label: '認定低炭素住宅 (Low-carbon)' },
  { value: 'zehWaterSaving',    label: 'ZEH水準省エネ住宅 (ZEH energy-saving)' },
  { value: 'energySaving',      label: '省エネ基準適合住宅 (Energy-saving)' },
  { value: 'standard',          label: 'その他 (Standard)' },
];

const EARLIEST_MOVE_IN_YEAR =
  MORTGAGE_TAX_CREDIT_COHORTS[MORTGAGE_TAX_CREDIT_COHORTS.length - 1]?.moveInYearFrom ?? 2009;

function defaultInput(currentYear: number): MortgageTaxCreditInput {
  return {
    moveInYear: currentYear,
    isExistingHome: false,
    mode: 'manual',
    manualAnnualCredit: 0,
    yearEndLoanBalance: 0,
    housingTier: 'standard',
  };
}

export const MortgageTaxCreditModal: React.FC<MortgageTaxCreditModalProps> = ({
  open,
  onClose,
  input,
  onChange,
  currentYear,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const isEnabled = input !== undefined;
  const effectiveInput = input ?? defaultInput(currentYear);

  const handleToggleEnabled = (enabled: boolean) => {
    onChange(enabled ? defaultInput(currentYear) : undefined);
  };

  const update = (patch: Partial<MortgageTaxCreditInput>) => {
    onChange({ ...effectiveInput, ...patch });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            minHeight: isMobile ? '100dvh' : '500px',
            maxHeight: isMobile ? '100dvh' : '90vh',
            '@supports not (height: 100dvh)': {
              minHeight: isMobile ? '100vh' : '500px',
              maxHeight: isMobile ? '100vh' : '90vh',
            },
          },
        },
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pb: 1,
        pt: isMobile ? 'max(16px, env(safe-area-inset-top))' : 2,
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HomeIcon />
          <Typography variant="h6" component="span">
            Mortgage Tax Credit (住宅ローン控除)
          </Typography>
        </Box>
        <IconButton edge="end" onClick={onClose} aria-label="close" size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{
        p: { xs: 2, sm: 3 },
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}>
        <FormControlLabel
          control={
            <Switch
              checked={isEnabled}
              onChange={(_, checked) => handleToggleEnabled(checked)}
              color="primary"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
                Apply mortgage tax credit
              </Typography>
              <SimpleTooltip>
                A tax credit equal to 0.7% (or 1% for older cohorts) of the year-end mortgage balance, applied for 10–13 years from the year you first moved in. Reduces income tax first, with any remainder spilling over to residence tax up to a cohort-specific cap.
              </SimpleTooltip>
            </Box>
          }
        />

        {isEnabled && (
          <>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ flex: '1 1 180px', minWidth: 160 }}>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                  Year moved in
                  <SimpleTooltip>
                    The year you first moved into the home and began claiming the credit. Determines the cohort's residence-tax spillover cap and income-eligibility limit.
                  </SimpleTooltip>
                </Typography>
                <SpinnerNumberField
                  id="mortgageMoveInYear"
                  name="moveInYear"
                  value={effectiveInput.moveInYear}
                  onInputChange={(e) => update({ moveInYear: Number((e.target as HTMLInputElement).value) || EARLIEST_MOVE_IN_YEAR })}
                  label="Year"
                  step={1}
                  shiftStep={1}
                  prefix=""
                  min={EARLIEST_MOVE_IN_YEAR}
                  max={currentYear}
                />
              </FormControl>

              {effectiveInput.mode === 'autoCalculate' && (
                <FormControl sx={{ flex: '1 1 220px', minWidth: 200 }}>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                    Build type
                    <SimpleTooltip>
                      Existing homes (中古) typically receive a 10-year credit and a smaller qualifying-balance cap; newly built energy-compliant homes typically receive 13 years.
                    </SimpleTooltip>
                  </Typography>
                  <ToggleButtonGroup
                    value={effectiveInput.isExistingHome ? 'existing' : 'new'}
                    exclusive
                    onChange={(_, value) => {
                      if (value !== null) update({ isExistingHome: value === 'existing' });
                    }}
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="new">New build</ToggleButton>
                    <ToggleButton value="existing">Existing</ToggleButton>
                  </ToggleButtonGroup>
                </FormControl>
              )}
            </Box>

            <FormControl>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                Input mode
                <SimpleTooltip>
                  Manual: enter your annual credit amount directly (from last year's tax return). Auto-calculate: enter your year-end loan balance and housing tier and we compute the credit.
                </SimpleTooltip>
              </Typography>
              <ToggleButtonGroup
                value={effectiveInput.mode}
                exclusive
                onChange={(_, value) => {
                  if (value !== null) update({ mode: value as MortgageInputMode });
                }}
                size="small"
                fullWidth
              >
                <ToggleButton value="manual">Manual amount</ToggleButton>
                <ToggleButton value="autoCalculate">Auto-calculate</ToggleButton>
              </ToggleButtonGroup>
            </FormControl>

            {effectiveInput.mode === 'manual' ? (
              <FormControl fullWidth>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                  Annual credit amount
                  <SimpleTooltip>
                    The annual credit amount you expect to receive this year. Look for this on your most recent 確定申告 or 年末調整 paperwork (line labelled 住宅借入金等特別控除).
                  </SimpleTooltip>
                </Typography>
                <SpinnerNumberField
                  id="mortgageManualAnnualCredit"
                  name="manualAnnualCredit"
                  value={effectiveInput.manualAnnualCredit ?? 0}
                  onInputChange={(e) => update({ manualAnnualCredit: Number((e.target as HTMLInputElement).value) || 0 })}
                  label="Amount"
                  step={1_000}
                  shiftStep={10_000}
                  min={0}
                />
              </FormControl>
            ) : (
              <>
                <FormControl fullWidth>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                    Year-end loan balance
                    <SimpleTooltip>
                      The outstanding mortgage balance at the end of the year being calculated. From your annual loan statement (年末残高証明書).
                    </SimpleTooltip>
                  </Typography>
                  <SpinnerNumberField
                    id="mortgageYearEndBalance"
                    name="yearEndLoanBalance"
                    value={effectiveInput.yearEndLoanBalance ?? 0}
                    onInputChange={(e) => update({ yearEndLoanBalance: Number((e.target as HTMLInputElement).value) || 0 })}
                    label="Balance"
                    step={100_000}
                    shiftStep={1_000_000}
                    min={0}
                  />
                </FormControl>

                <FormControl fullWidth>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                    Housing tier
                    <SimpleTooltip>
                      The energy/quality classification of the home. Higher tiers receive higher qualifying-balance caps.
                    </SimpleTooltip>
                  </Typography>
                  <InputLabel
                    id="mortgageHousingTier-label"
                    sx={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                  >
                    Housing tier
                  </InputLabel>
                  <Select
                    id="mortgageHousingTier"
                    labelId="mortgageHousingTier-label"
                    value={effectiveInput.housingTier ?? 'standard'}
                    onChange={(e) => update({ housingTier: e.target.value as MortgageHousingTier })}
                    fullWidth
                  >
                    {HOUSING_TIER_OPTIONS.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}

            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                Rules vary by move-in year. See{' '}
                <a
                  href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1213.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  NTA tax answer 1213
                </a>{' '}
                and the{' '}
                <a
                  href="https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  MLIT 住宅ローン減税 page
                </a>{' '}
                for details. Child-rearing / young-couple bonus caps are not modelled — use Manual mode in that case.
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
        py: 2,
        pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : 2,
      }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
};
