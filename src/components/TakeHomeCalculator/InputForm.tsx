// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormHelperText from '@mui/material/FormHelperText';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { useTheme } from '@mui/material/styles';
import FormControlLabel from '@mui/material/FormControlLabel';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import PeopleIcon from '@mui/icons-material/People';
import EditIcon from '@mui/icons-material/Edit';
import { InfoTooltip } from '../ui/InfoTooltip';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DependentsModal } from './Dependents/DependentsModal';
import { IncomeDetailsModal } from './Income/IncomeDetailsModal';
import { calculateTotalNetIncome } from '../../utils/taxCalculations';
import { formatJPY } from '../../utils/formatters';

import type { TakeHomeFormState, IncomeMode, IncomeStream } from '../../types/tax';
import {
  getProviderDisplayName,
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
  DEPENDENT_COVERAGE_ID,
  CUSTOM_PROVIDER_ID,
  isDependentCoverageEligible,
  DEPENDENT_INCOME_THRESHOLD,
} from '../../types/healthInsurance';
import { NATIONAL_HEALTH_INSURANCE_REGION_OPTIONS } from '../../data/nationalHealthInsurance/nhiParamsData';
import { PROVIDER_DEFINITIONS } from '../../data/employeesHealthInsurance/providerRateData';

interface TaxInputFormProps {
  inputs: TakeHomeFormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string; value: unknown; type?: string; checked?: boolean } }) => void;
}

// National Health Insurance provider (used in both employment and non-employment scenarios)
const nhiProvider = {
  id: NATIONAL_HEALTH_INSURANCE_ID,
  displayName: getProviderDisplayName(NATIONAL_HEALTH_INSURANCE_ID)
};

// Dependent coverage provider (only for employment income under threshold)
const dependentProvider = {
  id: DEPENDENT_COVERAGE_ID,
  displayName: getProviderDisplayName(DEPENDENT_COVERAGE_ID)
};

// Custom provider
const customProvider = {
  id: CUSTOM_PROVIDER_ID,
  displayName: getProviderDisplayName(CUSTOM_PROVIDER_ID)
};

export const TakeHomeInputForm: React.FC<TaxInputFormProps> = ({ inputs, onInputChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Check if dependent coverage is eligible based on income
  const isDependentEligible = isDependentCoverageEligible(inputs.annualIncome);

  // Dependents modal state
  const [dependentsModalOpen, setDependentsModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);

  const handleOpenDependentsModal = () => {
    setDependentsModalOpen(true);
  };

  const handleCloseDependentsModal = () => {
    setDependentsModalOpen(false);
  };

  const handleDependentsChange = (newDependents: typeof inputs.dependents) => {
    onInputChange({
      target: {
        name: 'dependents',
        value: newDependents,
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const handleIncomeStreamsChange = (newStreams: IncomeStream[]) => {
    // Calculate total annual income from streams
    const totalIncome = newStreams.reduce((sum, s) => {
      if (s.type === 'salary' && s.frequency === 'monthly') {
        return sum + s.amount * 12;
      }
      return sum + s.amount;
    }, 0);

    onInputChange({
      target: {
        name: 'incomeStreams',
        value: newStreams,
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    onInputChange({
      target: {
        name: 'annualIncome',
        value: totalIncome,
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>);

  };

  const hasEmploymentIncome = inputs.incomeMode === 'salary' ||
    (inputs.incomeMode === 'advanced' && inputs.incomeStreams.some(s => s.type === 'salary' || s.type === 'bonus'));

  const handleIncomeModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: IncomeMode | null,
  ) => {
    if (newMode !== null) {
      onInputChange({
        target: {
          name: 'incomeMode',
          value: newMode,
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>);

      // If we are LEAVING advanced mode, save the current streams
      if (inputs.incomeMode === 'advanced') {
        onInputChange({
          target: {
            name: 'savedIncomeStreams',
            value: inputs.incomeStreams,
          }
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      }

      if (newMode === 'salary') {
        // Sync streams to strictly match the simple mode
        onInputChange({
          target: {
            name: 'incomeStreams',
            value: [{
              id: 'simple-salary',
              type: 'salary',
              amount: inputs.annualIncome,
              frequency: 'annual'
            }],
          }
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      } else if (newMode === 'business') {
        // Sync streams to strictly match the simple mode
        onInputChange({
          target: {
            name: 'incomeStreams',
            value: [{
              id: 'simple-business',
              type: 'business',
              amount: inputs.annualIncome,
              blueFilerDeduction: 0 // Always 0 for simple business mode
            }],
          }
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      } else if (newMode === 'advanced') {
        // Try to restore saved streams if they match the current total

        let streamsToUse = inputs.incomeStreams;
        // If we have saved streams, try to use them
        if (inputs.savedIncomeStreams && inputs.savedIncomeStreams.length > 0) {
          streamsToUse = inputs.savedIncomeStreams;
        }

        // Calculate total of candidate streams
        const streamTotal = streamsToUse.reduce((sum, s) => {
          if (s.type === 'salary' && s.frequency === 'monthly') {
            return sum + s.amount * 12;
          }
          return sum + s.amount;
        }, 0);

        // If the saved streams match the current annual income, use them!
        if (streamTotal === inputs.annualIncome) {
          onInputChange({
            target: {
              name: 'incomeStreams',
              value: streamsToUse,
            }
          } as unknown as React.ChangeEvent<HTMLInputElement>);
        } else {
          // Mismatch or empty: Reset to single stream matching Total
          const initialStream: IncomeStream = hasEmploymentIncome
            ? { id: Date.now().toString(36) + Math.random().toString(36).substring(2), type: 'salary', frequency: 'annual', amount: inputs.annualIncome }
            : { id: Date.now().toString(36) + Math.random().toString(36).substring(2), type: 'business', amount: inputs.annualIncome };

          onInputChange({
            target: {
              name: 'incomeStreams',
              value: [initialStream],
            }
          } as unknown as React.ChangeEvent<HTMLInputElement>);
        }
      }
    }
  };

  const handleCustomRateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target as { name: string; value: unknown };
    const numValue = typeof value === 'number' ? value : parseFloat(value as string) || 0;

    const currentRates = inputs.customEHIRates || { healthInsuranceRate: 0, longTermCareRate: 0 };

    const newRates = {
      ...currentRates,
      [name === 'customHealthInsuranceRate' ? 'healthInsuranceRate' : 'longTermCareRate']: numValue
    };

    onInputChange({
      target: {
        name: 'customEHIRates',
        value: newRates
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const handleAnnualIncomeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { target: { name: string; value: unknown; type?: string; checked?: boolean } }) => {
    onInputChange(e);

    // If in simple mode, also update the income streams to match new income
    if (inputs.incomeMode === 'salary') {
      onInputChange({
        target: {
          name: 'incomeStreams',
          value: [{
            id: 'simple-salary',
            type: 'salary',
            amount: Number(e.target.value),
            frequency: 'annual'
          }],
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    } else if (inputs.incomeMode === 'business') {
      onInputChange({
        target: {
          name: 'incomeStreams',
          value: [{
            id: 'simple-business',
            type: 'business',
            amount: Number(e.target.value),
            blueFilerDeduction: 0
          }],
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleSliderChange = (_: Event, value: number | number[]) => {
    const newValue = Array.isArray(value) ? value[0] : value;
    const event = {
      target: {
        name: 'annualIncome',
        value: newValue,
        type: 'range'
      },
      currentTarget: {
        name: 'annualIncome',
        value: newValue,
        type: 'range'
      },
      preventDefault: () => { },
      stopPropagation: () => { },
      nativeEvent: new Event('change'),
      bubbles: true,
      cancelable: true,
      defaultPrevented: false,
      eventPhase: 0,
      isTrusted: false,
      timeStamp: Date.now(),
      type: 'change',
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      persist: () => { }
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    handleAnnualIncomeChange(event);
  };

  // Determine available health insurance providers based on income type and eligibility
  const availableProviders = React.useMemo(() => {
    if (hasEmploymentIncome) {
      // Employment income can use either employee health insurance or NHI
      // (e.g., small employers, part-time workers, low income thresholds)
      const employeeProviders = Object.entries(PROVIDER_DEFINITIONS).map(([id, { providerName }]) => ({
        id,
        displayName: providerName
      }));

      // Include dependent coverage option only if income is below threshold
      if (isDependentEligible) {
        return [...employeeProviders, dependentProvider, nhiProvider, customProvider];
      } else {
        return [...employeeProviders, nhiProvider, customProvider];
      }
    } else {
      // Non-employment income: NHI or dependent coverage (if eligible)
      if (isDependentEligible) {
        return [dependentProvider, nhiProvider];
      } else {
        return [nhiProvider];
      }
    }
  }, [hasEmploymentIncome, isDependentEligible]);

  const isHealthInsuranceProviderDropdownDisabled = availableProviders.length <= 1;

  // Derive regions for the currently selected health insurance provider
  const derivedProviderRegions = React.useMemo(() => {
    const provider = inputs.healthInsuranceProvider;
    if (!provider) return [];

    // Dependent coverage doesn't have regions
    if (provider === DEPENDENT_COVERAGE_ID || provider === CUSTOM_PROVIDER_ID) {
      return [];
    }

    if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
      return NATIONAL_HEALTH_INSURANCE_REGION_OPTIONS;
    } else {
      // Employee health insurance provider
      const providerDefinition = PROVIDER_DEFINITIONS[provider];
      if (providerDefinition) {
        // Convert region keys to region options for consistency
        return Object.keys(providerDefinition.regions).map(regionKey => ({
          id: regionKey,
          displayName: regionKey // For employee health insurance, use the key as display name for now
        }));
      }
    }

    return [];
  }, [inputs.healthInsuranceProvider]);

  // True if the only derived region is the DEFAULT_PROVIDER_REGION
  const isEffectivelySingleDefaultRegion =
    derivedProviderRegions.length === 1 && derivedProviderRegions[0]?.id === DEFAULT_PROVIDER_REGION;

  // Region dropdown is disabled if:
  // 1. No health insurance providers are available at all.
  // 2. The selected provider has no regions listed in its data.
  // 3. The selected provider has only one region (this includes the case where it's DEFAULT_PROVIDER_REGION).
  const isRegionDropdownEffectivelyDisabled =
    availableProviders.length === 0 ||
    derivedProviderRegions.length === 0 || // Covers case where provider has no regions in data
    derivedProviderRegions.length === 1;   // Covers case where provider has only one region (e.g., only Tokyo, or only DEFAULT)

  // Menu items to display in the region dropdown.
  const regionMenuItemsToDisplay = React.useMemo(() => {
    if (isEffectivelySingleDefaultRegion) {
      return []; // Don't show "DEFAULT" as a selectable option if it's the only one
    }
    return derivedProviderRegions; // This is an array of region options
  }, [derivedProviderRegions, isEffectivelySingleDefaultRegion]);

  const handleSelectChange = (e: { target: { name: string; value: unknown } }) => {
    // The parent component's onInputChange handler is responsible for
    // managing cascading state updates (e.g., setting a default region).
    const event = {
      target: {
        ...e.target,
        type: 'select'
      }
    } as React.ChangeEvent<HTMLInputElement>;
    onInputChange(event);
  };

  const sharedInputSx = {
    '& .MuiInputBase-root': {
      fontSize: { xs: '1rem', sm: '1.05rem' },
      py: { xs: 0.3, sm: 0.5 },
      minHeight: 36, // consistent height
    },
    '& .MuiInputBase-input': {
      fontSize: { xs: '0.97rem', sm: '1rem' },
      py: { xs: 0.3, sm: 0.5 },
    }
  };

  // We only need the total net income for the dependents modal.
  const taxpayerNetIncome = React.useMemo(() => calculateTotalNetIncome(inputs.incomeStreams), [inputs.incomeStreams]);

  return (
    <Box className="form-container" sx={{ p: { xs: 1.2, sm: 2 }, bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
      <Typography
        variant="h5"
        component="h2"
        gutterBottom
        sx={{
          fontSize: { xs: '1.08rem', sm: '1.3rem' },
          mb: { xs: 0.7, sm: 1.2 },
          fontWeight: 700,
        }}
      >
        Your Information
      </Typography>
      <Box className="form-group">
        <Card variant="outlined">
          <CardContent sx={{ p: 2, pt: 1, '&:last-child': { pb: 2 } }}>
            <Typography
              sx={{
                fontSize: '0.97rem',
                fontWeight: 500,
                color: 'text.primary',
                textAlign: 'center',
                mb: 1
              }}
            >
              Income
            </Typography>

            {/* Income Mode Toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <ToggleButtonGroup
                value={inputs.incomeMode || 'salary'}
                exclusive
                onChange={handleIncomeModeChange}
                aria-label="income mode"
                size="small"
                fullWidth
              >
                <ToggleButton value="salary">Salary</ToggleButton>
                <ToggleButton value="business">Business</ToggleButton>
                <ToggleButton value="advanced">Advanced</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Income Input or Advanced Details */}
            {inputs.incomeMode === 'advanced' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                  <Typography variant="body1">Total Annual Income</Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {formatJPY(inputs.annualIncome)}
                  </Typography>
                </Box>

                <Badge
                  badgeContent={inputs.incomeStreams.length}
                  color="primary"
                  sx={{
                    width: '100%',
                    '& .MuiBadge-badge': {
                      right: -3,
                      top: 3,
                      border: `2px solid ${theme.palette.background.paper}`,
                      padding: '0 4px',
                    },
                  }}
                >
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => setIncomeModalOpen(true)}
                    fullWidth
                    sx={{ height: 48 }}
                  >
                    Edit Income
                  </Button>
                </Badge>
              </Box>
            ) : (
              <Box sx={{
                flex: '1 1 0',
                width: '100%',
                minWidth: 180, // Prevents shrinking too much
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                '& .MuiInputBase-root': {
                  fontSize: { xs: '0.97rem', sm: '1.05rem' },
                  py: { xs: 0.2, sm: 0.4 },
                },
                '& .MuiInputBase-input': {
                  fontSize: { xs: '0.95rem', sm: '1rem' },
                  py: { xs: 0.2, sm: 0.4 },
                }
              }}>
                <SpinnerNumberField
                  id="annualIncome"
                  name="annualIncome"
                  value={inputs.annualIncome}
                  onInputChange={handleAnnualIncomeChange}
                  label={inputs.incomeMode === 'salary' ? 'Gross Annual Salary' : 'Net Annual Income'}
                  step={10_000}
                  shiftStep={100_000}
                  helperText={
                    isMobile
                      ? 'Input amount directly for ¥20M+ incomes.'
                      : 'For incomes over 20 million yen, input the amount directly.'
                  }
                  sx={sharedInputSx}
                />
              </Box>
            )}

            {/* Annual Income Slider - Only show for simple modes */}
            {inputs.incomeMode !== 'advanced' && (
              <Box sx={{ px: 1, mb: { xs: 0.3, sm: 0.5 }, mt: 1 }}>
                <Slider
                  className="income-slider"
                  value={inputs.annualIncome}
                  onChange={handleSliderChange}
                  min={0}
                  max={20000000}
                  step={10000}
                  valueLabelDisplay="off"
                  marks={[
                    { value: 0, label: '¥0' },
                    { value: 5000000, label: '¥5M' },
                    { value: 10000000, label: '¥10M' },
                    { value: 15000000, label: '¥15M' },
                    { value: 20000000, label: '¥20M' },
                  ]}
                  sx={{
                    mt: 0,
                    mb: { xs: 0.3, sm: 0.7 },
                  }}
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Age + Dependents Row */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 2, sm: 3 },
          mb: { xs: 0.2, sm: 0.5 },
          width: '100%',
          flexWrap: 'wrap',
        }}>
          {/* Age Switch */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              pr: { sm: 2 },
              mb: { xs: 1, sm: 0 },
            }}
          >
            <Typography
              sx={{
                mb: 0.2,
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.97rem',
                fontWeight: 500,
                color: 'text.primary',
              }}
            >
              Age Range
              <InfoTooltip title="People aged 40-64 are required to pay long-term care insurance premiums as part of their health insurance." />
            </Typography>
            <ToggleButtonGroup
              value={inputs.isSubjectToLongTermCarePremium}
              exclusive
              onChange={(_, newValue) => {
                if (newValue !== null) {
                  onInputChange({
                    target: {
                      name: 'isSubjectToLongTermCarePremium',
                      checked: newValue,
                      type: 'checkbox'
                    }
                  } as React.ChangeEvent<HTMLInputElement>);
                }
              }}
              aria-label="age range"
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 0.5,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    }
                  }
                }
              }}
            >
              <ToggleButton value={false}>
                &lt;40 or 65+
              </ToggleButton>
              <ToggleButton value={true}>
                40-64
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {/* Dependents Button */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              maxWidth: 200,
            }}
          >
            <Typography
              sx={{
                mb: 0.5,
                fontSize: '0.97rem',
                fontWeight: 500,
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              Dependents
              <InfoTooltip title="Add spouse and dependents to calculate applicable tax deductions." />
            </Typography>
            <Badge
              badgeContent={inputs.dependents.length}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  right: -3,
                  top: 3,
                }
              }}
            >
              <Button
                variant="outlined"
                startIcon={<PeopleIcon />}
                onClick={handleOpenDependentsModal}
                size="medium"
                sx={{
                  minWidth: 140,
                  textTransform: 'none',
                }}
              >
                Manage
              </Button>
            </Badge>
          </Box>
        </Box>

        {/* Social Insurance Configuration */}
        <Box sx={{ mt: { xs: 0.5, sm: 1 }, mb: { xs: 0.2, sm: 0.5 } }}>
          {/* Manual Social Insurance Entry Switch */}
          <Box sx={{ mb: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={inputs.manualSocialInsuranceEntry}
                  onChange={onInputChange}
                  name="manualSocialInsuranceEntry"
                  color="primary"
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    Enter Social Insurance Manually
                  </Typography>
                  <InfoTooltip title="Manually enter the total social insurance amount paid in the year (e.g. Health Insurance + Pension + Employment Insurance). This option should be used only if you have a situation where the automatic calculation does not reflect your actual payments. Employees generally can find this amount on their annual withholding statement (源泉徴収票) as the item labelled 社会保険料等の金額." />
                </Box>
              }
            />
          </Box>

          {inputs.manualSocialInsuranceEntry ? (
            <Box sx={{ mt: 1 }}>
              <SpinnerNumberField
                id="manualSocialInsuranceAmount"
                name="manualSocialInsuranceAmount"
                value={inputs.manualSocialInsuranceAmount}
                onInputChange={onInputChange}
                label="Total Social Insurance Amount"
                step={1000}
                shiftStep={10000}
                min={0}
                sx={{ ...sharedInputSx, width: '100%' }}
              />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 1.5 }, mt: 1 }}>
              <FormControl fullWidth>
                <Typography
                  gutterBottom
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.97rem',
                    fontWeight: 500,
                    mb: 0.2,
                    color: 'text.primary',
                  }}
                >
                  Health Insurance Provider
                  <InfoTooltip title="Your health insurance provider affects your premium calculations. Employment income workers are usually enrolled in employee health insurance, but some may be enrolled in National Health Insurance depending on factors such as employer size, work hours, and income thresholds." />
                </Typography>
                <InputLabel
                  id="healthInsuranceProvider-label"
                  sx={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                >
                  Health Insurance Provider
                </InputLabel>
                <Select
                  id="healthInsuranceProvider"
                  name="healthInsuranceProvider"
                  labelId="healthInsuranceProvider-label"
                  value={inputs.healthInsuranceProvider}
                  onChange={handleSelectChange}
                  disabled={isHealthInsuranceProviderDropdownDisabled}
                  fullWidth
                  sx={sharedInputSx}
                >
                  {availableProviders.map((provider) => (
                    <MenuItem
                      key={provider.id}
                      value={provider.id}
                      sx={provider.id === CUSTOM_PROVIDER_ID ? { fontStyle: 'italic' } : {}}
                    >
                      {provider.displayName}
                    </MenuItem>
                  ))}
                </Select>
                {isHealthInsuranceProviderDropdownDisabled && (
                  <FormHelperText>
                    {availableProviders.length > 0 ? `Only ${availableProviders[0]!.displayName} available for this configuration.` : 'No health insurance providers available.'}
                  </FormHelperText>
                )}
                {!isHealthInsuranceProviderDropdownDisabled && isDependentEligible && (
                  <FormHelperText>
                    {`If you are covered as a dependent under employee health insurance, select "None". This is only available if your income is below ¥${DEPENDENT_INCOME_THRESHOLD.toLocaleString()}.`}
                  </FormHelperText>
                )}
              </FormControl>

              {inputs.healthInsuranceProvider === CUSTOM_PROVIDER_ID ? (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl fullWidth>
                    <Typography gutterBottom sx={{ fontSize: '0.97rem', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                      Health Insurance
                      <InfoTooltip title="Enter the employee's share of the health insurance premium rate (usually half of the total rate). Look for 健康保険料率 or 一般保険料率 on the provider's website. This should include the 調整保険料率." />
                    </Typography>
                    <SpinnerNumberField
                      id="customHealthInsuranceRate"
                      name="customHealthInsuranceRate"
                      value={inputs.customEHIRates?.healthInsuranceRate ?? 0}
                      onInputChange={handleCustomRateChange}
                      label="Rate (%)"
                      step={0.1}
                      shiftStep={1.0}
                      prefix=""
                      suffix="%"
                      max={100}
                      sx={sharedInputSx}
                    />
                  </FormControl>
                  <FormControl fullWidth>
                    <Typography gutterBottom sx={{ fontSize: '0.97rem', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                      Long-term Care
                      <InfoTooltip title="Enter the employee's share of the Long-term Care premium rate (usually half of the total rate). This only applies if you are aged 40-64. Look for 介護保険料率 on the provider's website." />
                    </Typography>
                    <SpinnerNumberField
                      id="customLongTermCareRate"
                      name="customLongTermCareRate"
                      value={inputs.customEHIRates?.longTermCareRate ?? 0}
                      onInputChange={handleCustomRateChange}
                      label="Rate (%)"
                      step={0.1}
                      shiftStep={1.0}
                      prefix=""
                      suffix="%"
                      max={100}
                      sx={sharedInputSx}
                    />
                  </FormControl>
                </Box>
              ) : (
                <FormControl>
                  <Autocomplete
                    id="region"
                    options={regionMenuItemsToDisplay}
                    value={
                      regionMenuItemsToDisplay.find(option => option.id === inputs.region) ||
                      regionMenuItemsToDisplay[0] ||
                      { id: '', displayName: '' }
                    }
                    onChange={(_, newValue) => {
                      handleSelectChange({
                        target: {
                          name: 'region',
                          value: newValue?.id || ''
                        }
                      });
                    }}
                    getOptionLabel={(option) => option.displayName}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    disabled={isRegionDropdownEffectivelyDisabled}
                    renderInput={(params) => (
                      <TextField
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        {...(params as any)}
                        label="Local Region (Municipality/Prefecture)"
                        helperText={isRegionDropdownEffectivelyDisabled ? 'This provider does not have different rates for different regions' : 'Premium rates depend on the region'}
                      />
                    )}
                    noOptionsText="No matching regions"
                    clearOnBlur
                    disableClearable
                    selectOnFocus
                    handleHomeEndKeys
                    sx={sharedInputSx}
                  />
                </FormControl>
              )}
            </Box>
          )}
        </Box>

        {/* iDeCo/Corporate DC Contributions */}
        <Box sx={{ mt: { xs: 0.5, sm: 1 } }}>
          <FormControl fullWidth>
            <Typography
              gutterBottom
              sx={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.97rem',
                fontWeight: 500,
                mb: 0.2,
                color: 'text.primary',
              }}
            >
              <a
                href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/kyoshutsu/gaiyou.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', fontWeight: 500 }}
              >iDeCo/Corporate DC</a>{'\u00A0'}Contributions
              <InfoTooltip title="Annual contributions to iDeCo (individual defined contribution pension) and corporate DC plans. Do not include employer contributions in this amount. The max allowed contribution will vary depending on your situation." />
            </Typography>
            <SpinnerNumberField
              id="dcPlanContributions"
              name="dcPlanContributions"
              value={inputs.dcPlanContributions}
              onInputChange={onInputChange}
              label="Annual Contributions"
              step={1_000}
              shiftStep={10_000}
              sx={sharedInputSx}
            />
          </FormControl>
        </Box>
      </Box>

      <DependentsModal
        open={dependentsModalOpen}
        onClose={handleCloseDependentsModal}
        dependents={inputs.dependents}
        onDependentsChange={handleDependentsChange}
        taxpayerNetIncome={taxpayerNetIncome}
      />

      <IncomeDetailsModal
        open={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        streams={inputs.incomeStreams}
        onStreamsChange={handleIncomeStreamsChange}
      />
    </Box>
  );
}
