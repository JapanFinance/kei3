// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import type { Dispatch } from 'react';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
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
import TuneIcon from '@mui/icons-material/Tune';
import WarningIcon from '@mui/icons-material/Warning';
import { SimpleTooltip } from '../ui/Tooltips';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DependentsModal } from './Dependents/DependentsModal';
import { IncomeDetailsModal } from './Income/IncomeDetailsModal';
import { AdditionalDeductionsModal } from './AdditionalDeductionsModal';
import { ADDITIONAL_DEDUCTION_INFO } from './additionalDeductionInfo';
import { calculateTotalNetIncome } from '../../utils/taxCalculations';
import { countDependentsWithinEligibilityIncome } from '../../utils/dependentDeductions';
import { calculateNationalPensionFullExemptionThreshold } from '../../utils/pensionCalculator';
import { formatJPY } from '../../utils/formatters';

import type {
  TakeHomeFormState,
  IncomeMode,
  IncomeStream,
  HomeLoanTaxCreditInput,
  HomeLoanTaxCreditResult,
  LifeInsuranceInput,
  EarthquakeInsuranceInput,
  MedicalExpensesInput,
  AdditionalDeductionsResult,
} from '../../types/tax';
import {
  DEFAULT_PROVIDER_REGION,
  CUSTOM_PROVIDER_ID,
  NATIONAL_HEALTH_INSURANCE_ID,
  isDependentCoverageEligible,
  DEPENDENT_INCOME_THRESHOLD,
} from '../../types/healthInsurance';
import {
  availableProvidersFor,
  regionOptionsFor,
  type FormAction,
} from '../../state/takeHomeFormReducer';

interface TaxInputFormProps {
  inputs: TakeHomeFormState;
  dispatch: Dispatch<FormAction>;
  /** Computed home loan tax credit result, used to flag when the credit was zeroed (income over the limit). */
  homeLoanTaxCreditResult?: HomeLoanTaxCreditResult | undefined;
  /** Computed additional deductions, passed through to the modal for live readouts and the summary. */
  additionalDeductions?: AdditionalDeductionsResult | undefined;
}

export const TakeHomeInputForm: React.FC<TaxInputFormProps> = ({
  inputs,
  dispatch,
  homeLoanTaxCreditResult,
  additionalDeductions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Check if dependent coverage is eligible based on income
  const isDependentEligible = isDependentCoverageEligible(inputs.annualIncome);

  // Dependents modal state
  const [dependentsModalOpen, setDependentsModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [additionalModalOpen, setAdditionalModalOpen] = useState(false);

  const handleOpenDependentsModal = () => {
    setDependentsModalOpen(true);
  };

  const handleCloseDependentsModal = () => {
    setDependentsModalOpen(false);
  };

  const handleDependentsChange = (newDependents: typeof inputs.dependents) => {
    dispatch({ type: 'setField', field: 'dependents', value: newDependents });
  };

  const handleHomeLoanTaxCreditChange = (newInput: HomeLoanTaxCreditInput | undefined) => {
    dispatch({ type: 'setField', field: 'homeLoanTaxCredit', value: newInput });
  };

  const handleDcPlanContributionsChange = (value: number) => {
    dispatch({ type: 'setField', field: 'dcPlanContributions', value });
  };

  const handleLifeInsuranceChange = (newInput: LifeInsuranceInput) => {
    dispatch({ type: 'setField', field: 'lifeInsurance', value: newInput });
  };

  const handleEarthquakeInsuranceChange = (newInput: EarthquakeInsuranceInput) => {
    dispatch({ type: 'setField', field: 'earthquakeInsurance', value: newInput });
  };

  const handleMedicalExpensesChange = (newInput: MedicalExpensesInput) => {
    dispatch({ type: 'setField', field: 'medicalExpenses', value: newInput });
  };

  const handleIncomeStreamsChange = (newStreams: IncomeStream[]) => {
    dispatch({ type: 'incomeStreamsChanged', streams: newStreams });
  };

  const handleIncomeModeChange = (_: React.MouseEvent<HTMLElement>, newMode: IncomeMode | null) => {
    if (newMode === null) return;

    dispatch({ type: 'incomeModeChanged', mode: newMode });
  };

  const updateCustomEHIRate = (
    field: 'healthInsuranceRate' | 'longTermCareRate',
    rateValue: number,
  ) => {
    const currentRates = inputs.customEHIRates || { healthInsuranceRate: 0, longTermCareRate: 0 };
    dispatch({
      type: 'setField',
      field: 'customEHIRates',
      value: { ...currentRates, [field]: rateValue },
    });
  };

  const handleAnnualIncomeChange = (newIncome: number) => {
    dispatch({ type: 'annualIncomeChanged', value: newIncome });
  };

  const handleSliderChange = (_: Event, value: number) => {
    handleAnnualIncomeChange(value);
  };

  // Available health insurance providers for the current income type and eligibility. The
  // reducer keeps `healthInsuranceProvider` within this list (see availableProvidersFor and
  // its provider-validity cascade), so no correcting effect is needed here.
  const availableProviders = React.useMemo(() => availableProvidersFor(inputs), [inputs]);

  const isHealthInsuranceProviderDropdownDisabled = availableProviders.length <= 1;

  // Regions selectable for the currently selected provider. The reducer keeps `region` within
  // this list (see regionOptionsFor and the regionChanged cascade), so the dropdown and the
  // stored value share one definition of "valid region".
  const derivedProviderRegions = React.useMemo(
    () => regionOptionsFor(inputs.healthInsuranceProvider),
    [inputs.healthInsuranceProvider],
  );

  // True if the only derived region is the DEFAULT_PROVIDER_REGION
  const isEffectivelySingleDefaultRegion =
    derivedProviderRegions.length === 1 &&
    derivedProviderRegions[0]?.id === DEFAULT_PROVIDER_REGION;

  // Region dropdown is disabled if:
  // 1. No health insurance providers are available at all.
  // 2. The selected provider has no regions listed in its data.
  // 3. The selected provider has only one region (this includes the case where it's DEFAULT_PROVIDER_REGION).
  const isRegionDropdownEffectivelyDisabled =
    availableProviders.length === 0 ||
    derivedProviderRegions.length === 0 || // Covers case where provider has no regions in data
    derivedProviderRegions.length === 1; // Covers case where provider has only one region (e.g., only Tokyo, or only DEFAULT)

  // Menu items to display in the region dropdown.
  const regionMenuItemsToDisplay = React.useMemo(() => {
    if (isEffectivelySingleDefaultRegion) {
      return []; // Don't show "DEFAULT" as a selectable option if it's the only one
    }
    return derivedProviderRegions; // This is an array of region options
  }, [derivedProviderRegions, isEffectivelySingleDefaultRegion]);

  const sharedInputSx = {
    '& .MuiInputBase-root': {
      fontSize: { xs: '1rem', sm: '1.05rem' },
      py: { xs: 0.3, sm: 0.5 },
      minHeight: 36, // consistent height
    },
    '& .MuiInputBase-input': {
      fontSize: { xs: '0.97rem', sm: '1rem' },
      py: { xs: 0.3, sm: 0.5 },
    },
  };

  // We only need the total net income for the dependents modal. Pass dependents so the
  // 所得金額調整控除 is reflected, keeping the modal's eligibility hints consistent with the results.
  const taxpayerNetIncome = React.useMemo(
    () => calculateTotalNetIncome(inputs.incomeStreams, inputs.incomeYear, inputs.dependents),
    [inputs.incomeStreams, inputs.incomeYear, inputs.dependents],
  );

  // The National Pension full exemption toggle is rendered only while the income test
  // passes; the engine re-checks eligibility, so a stale `true` above the threshold is a
  // no-op rather than an error state.
  const pensionExemptionThreshold = React.useMemo(
    () =>
      calculateNationalPensionFullExemptionThreshold(
        countDependentsWithinEligibilityIncome(inputs.dependents, inputs.incomeYear),
      ),
    [inputs.dependents, inputs.incomeYear],
  );
  const isPensionExemptionEligible = taxpayerNetIncome <= pensionExemptionThreshold;

  return (
    <Box
      className="form-container"
      sx={{ p: { xs: 1.2, sm: 2 }, bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}
    >
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
        Taxpayer Information
      </Typography>
      <Box className="form-group">
        <Card variant="outlined">
          <CardContent sx={{ p: 2, pt: 1, '&:last-child': { pb: 2 } }}>
            <Typography
              sx={{
                fontSize: '0.97rem',
                fontWeight: 500,
                textAlign: 'center',
                mb: 1,
              }}
            >
              Income
            </Typography>

            {/* Income Mode Toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <ToggleButtonGroup
                value={inputs.incomeMode}
                exclusive
                onChange={handleIncomeModeChange}
                aria-label="income mode"
                size="small"
                fullWidth
              >
                <ToggleButton value="salary">Salary</ToggleButton>
                <ToggleButton value="miscellaneous">
                  {isMobile ? 'Misc' : 'Miscellaneous'}
                </ToggleButton>
                <ToggleButton value="advanced">Advanced</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Income Input or Advanced Details */}
            {inputs.incomeMode === 'advanced' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 1,
                    }}
                  >
                    <Typography variant="body1">Total Annual Income</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatJPY(inputs.annualIncome)}
                    </Typography>
                  </Box>

                  {(() => {
                    const totalNontaxableBenefits = inputs.incomeStreams.reduce((sum, s) => {
                      if (s.type === 'commutingAllowance') {
                        if (s.frequency === 'monthly') return sum + s.amount * 12;
                        if (s.frequency === '3-months') return sum + s.amount * 4;
                        if (s.frequency === '6-months') return sum + s.amount * 2;
                        return sum + s.amount;
                      }
                      return sum;
                    }, 0);

                    return totalNontaxableBenefits > 0 ? (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          px: 1,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Total Nontaxable Benefits
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          color="text.secondary"
                          sx={{ fontWeight: 'medium' }}
                        >
                          {formatJPY(totalNontaxableBenefits)}
                        </Typography>
                      </Box>
                    ) : null;
                  })()}
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
                  >
                    Edit Income/Benefits
                  </Button>
                </Badge>
              </Box>
            ) : (
              <Box
                sx={{
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
                  },
                }}
              >
                <SpinnerNumberField
                  id="annualIncome"
                  name="annualIncome"
                  value={inputs.annualIncome}
                  onChange={handleAnnualIncomeChange}
                  label={
                    inputs.incomeMode === 'salary' ? 'Gross Annual Salary' : 'Net Annual Income'
                  }
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
              <Box sx={{ px: 1, mb: { xs: 0.3, sm: 0.5 }, mt: 0.5 }}>
                <Slider
                  className="income-slider"
                  value={inputs.annualIncome}
                  onChange={handleSliderChange}
                  aria-label="Annual income"
                  getAriaValueText={value => formatJPY(value)}
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
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2, sm: 3 },
            mb: { xs: 0.2, sm: 0.5 },
            width: '100%',
            flexWrap: 'wrap',
          }}
        >
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
              }}
            >
              Age Range
              <SimpleTooltip>
                People aged 40-64 are required to pay long-term care insurance premiums as part of
                their health insurance.
              </SimpleTooltip>
            </Typography>
            <ToggleButtonGroup
              value={inputs.isSubjectToLongTermCarePremium}
              exclusive
              onChange={(_, newValue: boolean | null) => {
                if (newValue !== null) {
                  dispatch({
                    type: 'setField',
                    field: 'isSubjectToLongTermCarePremium',
                    value: newValue,
                  });
                }
              }}
              aria-label="age range"
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 0.5,
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  },
                },
              }}
            >
              <ToggleButton value={false}>&lt;40 or 65+</ToggleButton>
              <ToggleButton value={true}>40-64</ToggleButton>
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
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              Dependents
              <SimpleTooltip>
                Add spouse and dependents to calculate applicable tax deductions.
              </SimpleTooltip>
            </Typography>
            <Badge
              badgeContent={inputs.dependents.length}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  right: -3,
                  top: 3,
                },
              }}
            >
              <Button
                variant="outlined"
                startIcon={<PeopleIcon />}
                onClick={handleOpenDependentsModal}
                size="medium"
                sx={{
                  minWidth: 140,
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
                  onChange={e =>
                    dispatch({
                      type: 'setField',
                      field: 'manualSocialInsuranceEntry',
                      value: e.target.checked,
                    })
                  }
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
                  <SimpleTooltip>
                    Manually enter the total social insurance amount paid in the year (e.g. Health
                    Insurance + Pension + Employment Insurance). This option should be used only
                    when the automatic calculation does not reflect the taxpayer's actual payments.
                    Employees generally can find this amount on their annual withholding statement
                    (源泉徴収票) as the item labelled 社会保険料等の金額.
                  </SimpleTooltip>
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
                onChange={value =>
                  dispatch({ type: 'setField', field: 'manualSocialInsuranceAmount', value })
                }
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
                  }}
                >
                  <span id="healthInsuranceProvider-label">Health Insurance Provider</span>
                  <SimpleTooltip>
                    The health insurance provider affects premium calculations. Employment income
                    workers are usually enrolled in employee health insurance, but some may be
                    enrolled in National Health Insurance depending on factors such as employer
                    size, work hours, and income thresholds.
                  </SimpleTooltip>
                </Typography>
                <Select
                  id="healthInsuranceProvider"
                  name="healthInsuranceProvider"
                  labelId="healthInsuranceProvider-label"
                  value={inputs.healthInsuranceProvider}
                  onChange={e => dispatch({ type: 'providerChanged', provider: e.target.value })}
                  disabled={isHealthInsuranceProviderDropdownDisabled}
                  fullWidth
                  sx={sharedInputSx}
                >
                  {availableProviders.map(provider => (
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
                    {availableProviders.length > 0
                      ? `Only ${availableProviders[0]!.displayName} available for this configuration.`
                      : 'No health insurance providers available.'}
                  </FormHelperText>
                )}
                {!isHealthInsuranceProviderDropdownDisabled && isDependentEligible && (
                  <FormHelperText>
                    {`If covered as a dependent under employee health insurance, select "None". This is only available if income is below ${formatJPY(DEPENDENT_INCOME_THRESHOLD)}.`}
                  </FormHelperText>
                )}
              </FormControl>

              {inputs.healthInsuranceProvider === CUSTOM_PROVIDER_ID ? (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl fullWidth>
                    <Typography
                      gutterBottom
                      sx={{
                        fontSize: '0.97rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      Health Insurance
                      <SimpleTooltip>
                        Enter the employee's share of the health insurance premium rate (usually
                        half of the total rate). Look for 健康保険料率 or 一般保険料率 on the
                        provider's website. This should include the 調整保険料率 and the Childcare
                        Support Contribution (子ども・子育て支援金率).
                      </SimpleTooltip>
                    </Typography>
                    <SpinnerNumberField
                      id="customHealthInsuranceRate"
                      name="customHealthInsuranceRate"
                      value={inputs.customEHIRates?.healthInsuranceRate ?? 0}
                      onChange={value => updateCustomEHIRate('healthInsuranceRate', value)}
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
                    <Typography
                      gutterBottom
                      sx={{
                        fontSize: '0.97rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      Long-term Care
                      <SimpleTooltip>
                        Enter the employee's share of the Long-term Care premium rate (usually half
                        of the total rate). This only applies to ages 40-64. Look for 介護保険料率
                        on the provider's website.
                      </SimpleTooltip>
                    </Typography>
                    <SpinnerNumberField
                      id="customLongTermCareRate"
                      name="customLongTermCareRate"
                      value={inputs.customEHIRates?.longTermCareRate ?? 0}
                      onChange={value => updateCustomEHIRate('longTermCareRate', value)}
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
                      // Empty-option fallback for when the dropdown is disabled and
                      // `regionMenuItemsToDisplay` is empty (single-default or region-less provider).
                      regionMenuItemsToDisplay.find(option => option.id === inputs.region) ||
                      regionMenuItemsToDisplay[0] || { id: '', displayName: '' }
                    }
                    onChange={(_, newValue) => {
                      dispatch({ type: 'regionChanged', region: newValue.id });
                    }}
                    getOptionLabel={option => option.displayName}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    disabled={isRegionDropdownEffectivelyDisabled}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label="Local Region (Municipality/Prefecture)"
                        helperText={
                          isRegionDropdownEffectivelyDisabled
                            ? 'This provider does not have different rates for different regions'
                            : 'Premium rates depend on the region'
                        }
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

              {inputs.healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID &&
                isPensionExemptionEligible && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={inputs.nationalPensionExemption}
                          onChange={e =>
                            dispatch({
                              type: 'setField',
                              field: 'nationalPensionExemption',
                              value: e.target.checked,
                            })
                          }
                          name="nationalPensionExemption"
                          color="primary"
                          size="small"
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
                            National Pension Full Exemption (全額免除)
                          </Typography>
                          <SimpleTooltip>
                            The National Pension system offers income-based contribution
                            exemptions (国民年金保険料免除制度). Full exemption (全額免除) applies
                            when the previous year's income is at or below (number of dependents +
                            1) × ¥350,000 + ¥320,000. An application to the municipal office or
                            pension office is required — the exemption is not applied
                            automatically. Fully exempted periods accrue one half of the normal
                            basic pension amount. This calculator assumes income is the same as
                            the previous year.
                          </SimpleTooltip>
                        </Box>
                      }
                    />
                    <FormHelperText sx={{ mt: -0.5 }}>
                      {`Income is within the full exemption threshold (${formatJPY(pensionExemptionThreshold)}).`}
                    </FormHelperText>
                  </Box>
                )}
            </Box>
          )}
        </Box>

        {/* Additional Deductions & Credits */}
        <Box
          sx={{
            mt: { xs: 1, sm: 1.5 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <Typography
            sx={{
              mb: 0.5,
              fontSize: '0.97rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            Additional Deductions &amp; Credits
            <SimpleTooltip>
              Income deductions (所得控除, e.g. iDeCo) and tax credits (税額控除, e.g. home loan tax
              credit). These affect income tax, residence tax, and the furusato nozei limit.
            </SimpleTooltip>
          </Typography>
          <Button
            variant="outlined"
            startIcon={<TuneIcon />}
            onClick={() => setAdditionalModalOpen(true)}
            size="medium"
            fullWidth
            sx={{ justifyContent: 'flex-start' }}
          >
            {(() => {
              const parts: string[] = [];
              if (inputs.dcPlanContributions > 0)
                parts.push(`DC ${formatJPY(inputs.dcPlanContributions)}`);
              if (inputs.homeLoanTaxCredit && inputs.homeLoanTaxCredit.creditAmount > 0)
                parts.push(
                  `Home loan tax credit ${formatJPY(inputs.homeLoanTaxCredit.creditAmount)}`,
                );
              additionalDeductions?.items.forEach(item => {
                const name = ADDITIONAL_DEDUCTION_INFO[item.key].name;
                parts.push(`${name} ${formatJPY(item.national)}`);
              });
              // Via the UI the move-in dropdown only offers eligible years, so a credit entered
              // but zeroed (availableCredit 0) means income exceeded the cohort's eligibility limit.
              const homeLoanNotApplied = !!(
                inputs.homeLoanTaxCredit &&
                inputs.homeLoanTaxCredit.creditAmount > 0 &&
                homeLoanTaxCreditResult &&
                homeLoanTaxCreditResult.availableCredit === 0
              );
              return parts.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography component="span" sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
                    Configured
                  </Typography>
                  <Typography component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                    {parts.join(' · ')}
                  </Typography>
                  {homeLoanNotApplied && (
                    <Typography
                      component="span"
                      sx={{
                        fontSize: '0.8rem',
                        color: 'warning.main',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                        mt: 0.25,
                      }}
                    >
                      <WarningIcon sx={{ fontSize: '0.95rem' }} />
                      Home loan tax credit not applied (income above the eligibility limit)
                    </Typography>
                  )}
                </Box>
              ) : (
                'Add iDeCo, home loan tax credit, etc.'
              );
            })()}
          </Button>
        </Box>
      </Box>

      <DependentsModal
        open={dependentsModalOpen}
        onClose={handleCloseDependentsModal}
        dependents={inputs.dependents}
        onDependentsChange={handleDependentsChange}
        taxpayerNetIncome={taxpayerNetIncome}
        incomeYear={inputs.incomeYear}
      />

      <IncomeDetailsModal
        open={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        streams={inputs.incomeStreams}
        onStreamsChange={handleIncomeStreamsChange}
      />

      <AdditionalDeductionsModal
        open={additionalModalOpen}
        onClose={() => setAdditionalModalOpen(false)}
        dcPlanContributions={inputs.dcPlanContributions}
        onDcPlanContributionsChange={handleDcPlanContributionsChange}
        homeLoanTaxCredit={inputs.homeLoanTaxCredit}
        onHomeLoanTaxCreditChange={handleHomeLoanTaxCreditChange}
        homeLoanTaxCreditResult={homeLoanTaxCreditResult}
        lifeInsurance={inputs.lifeInsurance}
        onLifeInsuranceChange={handleLifeInsuranceChange}
        earthquakeInsurance={inputs.earthquakeInsurance}
        onEarthquakeInsuranceChange={handleEarthquakeInsuranceChange}
        medicalExpenses={inputs.medicalExpenses}
        onMedicalExpensesChange={handleMedicalExpensesChange}
        additionalDeductions={additionalDeductions}
        incomeYear={inputs.incomeYear}
      />
    </Box>
  );
};
