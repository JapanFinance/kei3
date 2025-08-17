import React from 'react';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import FormHelperText from '@mui/material/FormHelperText';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import { useTheme } from '@mui/material/styles';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Autocomplete from '@mui/material/Autocomplete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { InfoTooltip } from '../ui/InfoTooltip';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { TakeHomeInputs } from '../../types/tax';
import {
  getProviderDisplayName,
  DEFAULT_PROVIDER_REGION,
  NATIONAL_HEALTH_INSURANCE_ID,
} from '../../types/healthInsurance';
import { NATIONAL_HEALTH_INSURANCE_REGIONS } from '../../data/nationalHealthInsurance/nhiParamsData';
import { PROVIDER_DEFINITIONS } from '../../data/employeesHealthInsurance/providerRateData';

interface TaxInputFormProps {
  inputs: TakeHomeInputs;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>) => void;
}

interface ProviderOption {
  id: string;
  displayName: string;
}

interface AdvancedOptionsFieldsProps {
  availableProviders: ProviderOption[];
  isHealthInsuranceProviderDropdownDisabled: boolean;
  inputs: TakeHomeInputs;
  handleSelectChange: (e: { target: { name: string; value: unknown } }) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>) => void;
  sharedInputSx: object;
  prefectureSelectValueForUI: string;
  isPrefectureDropdownEffectivelyDisabled: boolean;
  prefectureMenuItemsToDisplay: string[];
}

function AdvancedOptionsFields({
  availableProviders,
  isHealthInsuranceProviderDropdownDisabled,
  inputs,
  handleSelectChange,
  onInputChange,
  sharedInputSx,
  prefectureSelectValueForUI,
  isPrefectureDropdownEffectivelyDisabled,
  prefectureMenuItemsToDisplay,
}: AdvancedOptionsFieldsProps) {
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: { xs: 1, sm: 1.5 },
      width: '100%',
    }}>
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
          <InfoTooltip title="Your health insurance provider affects your premium calculations. 
          Employment income workers are usually enrolled in employee health insurance, but some may be enrolled in National Health Insurance depending on factors such as employer size, work hours, and income thresholds." />
        </Typography>
        {/* Hidden InputLabel for accessibility and testing */}
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
          data-disabled={isHealthInsuranceProviderDropdownDisabled}
        >
          {availableProviders.map((provider) => (
            <MenuItem key={provider.id} value={provider.id}>
              {provider.displayName}
            </MenuItem>
          ))}
        </Select>
        {isHealthInsuranceProviderDropdownDisabled && (
          <FormHelperText>
            {inputs.isEmploymentIncome
              ? availableProviders.length > 0 ? `Only ${availableProviders[0]!.displayName} available for this configuration.` : 'No health insurance providers available.'
              : `Automatically set to ${getProviderDisplayName(NATIONAL_HEALTH_INSURANCE_ID)} for non-employment income.`
            }
          </FormHelperText>
        )}
      </FormControl>
      <FormControl>
        <Autocomplete
          id="prefecture"
          options={prefectureMenuItemsToDisplay}
          value={prefectureSelectValueForUI}
          onChange={(_, newValue) => {
            handleSelectChange({
              target: {
                name: 'prefecture',
                value: newValue || ''
              }
            });
          }}
          disabled={isPrefectureDropdownEffectivelyDisabled}
          renderInput={(params) =>
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - MUI Autocomplete params spreading is correct per documentation
            <TextField
              {...params}
              label="Local Region (Prefecture)"
              placeholder={isPrefectureDropdownEffectivelyDisabled ? 'No options available' : 'Select region...'}
              helperText="Premium rates depend on the region"
            />
          }
          noOptionsText="No matching regions"
          clearOnBlur
          disableClearable
          selectOnFocus
          handleHomeEndKeys
          sx={sharedInputSx}
        />
      </FormControl>
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
  );
}

// National Health Insurance provider (used in both employment and non-employment scenarios)
const nhiProvider = {
  id: NATIONAL_HEALTH_INSURANCE_ID,
  displayName: getProviderDisplayName(NATIONAL_HEALTH_INSURANCE_ID)
};

export const TakeHomeInputForm: React.FC<TaxInputFormProps> = ({ inputs, onInputChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Component-specific styles that can't be in the global CSS
  const styles = {
    slider: {
      color: 'primary.main',
      '& .MuiSlider-thumb': {
        '&:hover, &.Mui-focusVisible': {
          boxShadow: `0 0 0 8px ${theme.palette.mode === 'dark' 
            ? 'rgba(66, 165, 245, 0.16)' 
            : 'rgba(25, 118, 210, 0.16)'}`,
        },
        '&.Mui-active': {
          boxShadow: `0 0 0 14px ${theme.palette.mode === 'dark' 
            ? 'rgba(66, 165, 245, 0.16)' 
            : 'rgba(25, 118, 210, 0.16)'}`,
        },
      },
    },
    formSection: {
      display: 'flex',
      flexDirection: 'row', // Force row always
      gap: { xs: 1, sm: 1.5 },
      alignItems: 'center', // Center vertically
      mb: 0,
      width: '100%',
      '& > *': {
        flex: '1 1 0',
        minWidth: 0,
      }
    },
    incomeTypeToggle: {
      flex: '1 1 0',
      minWidth: 0,
    },
    incomeInput: {
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
    },
    // Common style for the Box containing a Switch and its labels
    sharedSwitchControlBox: {
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      bgcolor: 'action.hover',
      borderRadius: 2,
      p: 0.5,
      width: 'fit-content'
    },
    ageDependentsRow: {
      display: 'flex',
      flexDirection: 'row', // always row
      alignItems: 'center',
      justifyContent: 'center',
      gap: { xs: 2, sm: 3 },
      mt: { xs: 0.5, sm: 1 },
      mb: { xs: 0.5, sm: 1 },
      width: '100%',
      flexWrap: 'wrap', // allow wrapping if truly needed
    },
    dependentsInput: {
      width: 80,
      '& .MuiInputBase-root': {
        fontSize: { xs: '0.97rem', sm: '1.05rem' },
        py: { xs: 0.2, sm: 0.4 },
      },
      '& .MuiInputBase-input': {
        fontSize: { xs: '0.95rem', sm: '1rem' },
        py: { xs: 0.2, sm: 0.4 },
        textAlign: 'right',
      }
    },
    accordion: {
      mt: { xs: 1, sm: 2 },
      bgcolor: 'background.paper',
      boxShadow: 'none',
      '&:before': { display: 'none' },
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      overflow: 'hidden',
      display: isMobile ? 'block' : 'none', // Hide on desktop
    },
    accordionDetails: {
      p: { xs: 1, sm: 1.5 },
      pt: { xs: 1, sm: 2 },
      display: 'flex',
      flexDirection: 'column',
      gap: { xs: 1, sm: 1.5 },
    },
    advancedOptionsDesktop: {
      display: isMobile ? 'none' : 'block', // Show only on desktop
      mt: { xs: 1, sm: 2 },
    },
    advancedOptionsSection: {
      display: 'flex',
      flexDirection: 'column', // stack inputs vertically
      gap: { xs: 1, sm: 1.5 },
      mt: { xs: 1, sm: 2 },
      mb: { xs: 0, sm: 0 },
      width: '100%',
    },
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
      preventDefault: () => {},
      stopPropagation: () => {},
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
      persist: () => {}
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    onInputChange(event);
  };


  // Determine available health insurance providers based on income type
  const availableProviders = React.useMemo(() => {
    if (inputs.isEmploymentIncome) {
      // Employment income can use either employee health insurance or NHI
      // (e.g., small employers, part-time workers, low income thresholds)
      const employeeProviders = Object.entries(PROVIDER_DEFINITIONS).map(([id, { providerName }]) => ({
        id,
        displayName: providerName
      }));

      return [...employeeProviders, nhiProvider];
    } else {
      // Only National Health Insurance for non-employment income
      return [nhiProvider];
    }
  }, [inputs.isEmploymentIncome]);

  const isHealthInsuranceProviderDropdownDisabled = availableProviders.length <= 1;

  // Derive regions for the currently selected health insurance provider
  const derivedProviderRegions = React.useMemo(() => {
    const provider = inputs.healthInsuranceProvider;
    if (!provider) return [];

    let regionKeys: string[] = [];

    if (provider === NATIONAL_HEALTH_INSURANCE_ID) {
      regionKeys = NATIONAL_HEALTH_INSURANCE_REGIONS;
    } else {
      // Employee health insurance provider
      const providerDefinition = PROVIDER_DEFINITIONS[provider];
      if (providerDefinition) {
        regionKeys = Object.keys(providerDefinition.regions);
      }
    }
    
    return regionKeys;
  }, [inputs.healthInsuranceProvider]);

  // True if the only derived region is the DEFAULT_PROVIDER_REGION
  const isEffectivelySingleDefaultRegion = 
    derivedProviderRegions.length === 1 && derivedProviderRegions[0] === DEFAULT_PROVIDER_REGION;

  // Prefecture dropdown is disabled if:
  // 1. No health insurance providers are available at all.
  // 2. The selected provider has no regions listed in its data.
  // 3. The selected provider has only one region (this includes the case where it's DEFAULT_PROVIDER_REGION).
  const isPrefectureDropdownEffectivelyDisabled = 
    availableProviders.length === 0 ||
    derivedProviderRegions.length === 0 || // Covers case where provider has no regions in data
    derivedProviderRegions.length === 1;   // Covers case where provider has only one region (e.g., only Tokyo, or only DEFAULT)

  // Determine the value to pass to the Select component's value prop for UI display.
  const prefectureSelectValueForUI = React.useMemo(() => {
    // If the situation is a single default region (like Kanto ITS Kenpo)
    // AND the actual input value for prefecture IS that default region,
    // then the UI Select component should receive an empty string to appear blank and satisfy MUI.
    if (isEffectivelySingleDefaultRegion && inputs.prefecture === DEFAULT_PROVIDER_REGION) {
      return '';
    }
    // Otherwise, use the actual prefecture value from the inputs state.
    return inputs.prefecture;
  }, [inputs.prefecture, isEffectivelySingleDefaultRegion]);

  // Menu items to display in the prefecture dropdown.
  const prefectureMenuItemsToDisplay = React.useMemo(() => {
    if (isEffectivelySingleDefaultRegion) {
      return []; // Don't show "DEFAULT" as a selectable option if it's the only one
    }
    return derivedProviderRegions; // This is an array of strings (region IDs)
  }, [derivedProviderRegions, isEffectivelySingleDefaultRegion]);

  const handleSelectChange = (e: { target: { name: string; value: unknown } }) => {
    // The parent component's onInputChange handler is responsible for
    // managing cascading state updates (e.g., setting a default prefecture).
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
        {/* Income Type + Annual Income Row */}
        <Box sx={styles.formSection}>
          {/* Income Type Checkbox */}
          <Box sx={styles.incomeTypeToggle}>
            <FormControlLabel
              control={
                <Checkbox
                  id="isEmploymentIncome"
                  name="isEmploymentIncome"
                  checked={inputs.isEmploymentIncome}
                  onChange={(e) => onInputChange(e as React.ChangeEvent<HTMLInputElement>)}
                  color="primary"
                  size="small"
                />
              }
              label={
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'row',      // Row for inline, allows wrapping
                  alignItems: 'center',
                  justifyContent: 'center',  // Center contents when wrapped
                  flexWrap: 'wrap',          // Allow wrapping
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'text.primary',
                  gap: 0.1,                  // Space between label and tooltip
                  lineHeight: 1.2,
                  textAlign: 'center',
                  width: '100%',             // Ensures centering when wrapped
                }}>
                  Employment Income
                  <InfoTooltip title="Check this box if your income is from employment (salary, wages). Uncheck for business income, miscellaneous income, etc." />
                </Box>
              }
            />
          </Box>
          {/* Income Input */}
          <Box sx={styles.incomeInput}>
            <Typography
              sx={{
                mb: 1,
                fontSize: '0.97rem',
                fontWeight: 500,
                color: 'text.primary',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {inputs.isEmploymentIncome ? 'Gross Employment Income' : 'Net Income (Business etc.)'}
            </Typography>
            <SpinnerNumberField
              id="annualIncome"
              name="annualIncome"
              value={inputs.annualIncome}
              onInputChange={onInputChange}
              label="Annual Income"
              step={10_000}
              shiftStep={100_000}
              sx={sharedInputSx}
            />
          </Box>
        </Box>

        {/* Annual Income Slider */}
        <Box sx={{ px: 1, mb: { xs: 0.3, sm: 0.5 }, mt: 0 }}>
          {/* Explanatory text above the slider */}
          <Typography
            sx={{
              mb: 0.5,
              fontSize: '0.93rem',
              color: 'text.secondary',
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            {isMobile
              ? 'For 20M+ yen incomes, use the field above.'
              : 'For incomes over 20 million yen, enter the amount in the field above.'
            }
          </Typography>
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

        {/* Age + Dependents Row */}
        <Box sx={styles.ageDependentsRow}>
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
            <Box sx={styles.sharedSwitchControlBox}>
              <Typography
                color={!inputs.isSubjectToLongTermCarePremium ? 'primary' : 'text.secondary'}
                fontWeight={!inputs.isSubjectToLongTermCarePremium ? 600 : 400}
                sx={{ minWidth: 45, textAlign: 'center', fontSize: '0.9rem' }}
              >
                &lt;40 or 65+
              </Typography>
              <Switch
                checked={inputs.isSubjectToLongTermCarePremium}
                onChange={(e) => onInputChange({
                  target: {
                    name: 'isSubjectToLongTermCarePremium',
                    checked: e.target.checked,
                    type: 'checkbox'
                  }
                } as React.ChangeEvent<HTMLInputElement>)}
                color="primary"
                size="small"
                sx={{ mx: 0.5 }}
              />
              <Typography
                color={inputs.isSubjectToLongTermCarePremium ? 'primary' : 'text.secondary'}
                fontWeight={inputs.isSubjectToLongTermCarePremium ? 600 : 400}
                sx={{ minWidth: 45, textAlign: 'center', fontSize: '0.9rem' }}
              >
                40-64
              </Typography>
            </Box>
          </Box>
          {/* Dependents Input */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              maxWidth: 180, // optional: prevents them from getting too wide
            }}
          >
            <Typography
              sx={{
                mb: 0.2,
                fontSize: '0.97rem',
                fontWeight: 500,
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              Dependents
              <InfoTooltip title="This input is disabled because dependents are not yet supported in the calculator. Future updates will allow you to enter dependents." />
            </Typography>
            <TextField
              disabled
              title="Dependents input is disabled because it is not yet implemented."
              id="numberOfDependents"
              name="numberOfDependents"
              label=""
              value={inputs.numberOfDependents}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = parseInt(e.target.value) || 0;
                onInputChange({
                  target: {
                    name: 'numberOfDependents',
                    value: value,
                    type: 'number'
                  }
                } as unknown as React.ChangeEvent<HTMLInputElement>);
              }}
              type="number"
              sx={{
                ...styles.dependentsInput,
                ...sharedInputSx
              }}
              slotProps={{
                htmlInput: {
                  min: 0,
                  'aria-label': 'Number of dependents'
                }
              }}
            />
          </Box>
        </Box>

        {/* Advanced Options */}
        {isMobile ? (
          <Accordion
            elevation={0}
            sx={styles.accordion}
            defaultExpanded={false}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="advanced-options-content"
              id="advanced-options-header"
            >
              <Typography
                sx={{
                  fontSize: '1.08rem',
                  fontWeight: 700,
                  color: 'text.primary',
                }}
              >
                Advanced Options
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={styles.accordionDetails}>
              <AdvancedOptionsFields
                availableProviders={availableProviders}
                isHealthInsuranceProviderDropdownDisabled={isHealthInsuranceProviderDropdownDisabled}
                inputs={inputs}
                handleSelectChange={handleSelectChange}
                onInputChange={onInputChange}
                sharedInputSx={sharedInputSx}
                prefectureSelectValueForUI={prefectureSelectValueForUI}
                isPrefectureDropdownEffectivelyDisabled={isPrefectureDropdownEffectivelyDisabled}
                prefectureMenuItemsToDisplay={prefectureMenuItemsToDisplay}
              />
            </AccordionDetails>
          </Accordion>
        ) : (
          <Box sx={styles.advancedOptionsDesktop}>
            <Typography
              sx={{
                fontSize: { xs: '1.08rem', sm: '1.15rem' },
                fontWeight: 700,
                color: 'text.primary',
                mb: 1,
              }}
            >
              Advanced Options
            </Typography>
            <AdvancedOptionsFields
              availableProviders={availableProviders}
              isHealthInsuranceProviderDropdownDisabled={isHealthInsuranceProviderDropdownDisabled}
              inputs={inputs}
              handleSelectChange={handleSelectChange}
              onInputChange={onInputChange}
              sharedInputSx={sharedInputSx}
              prefectureSelectValueForUI={prefectureSelectValueForUI}
              isPrefectureDropdownEffectivelyDisabled={isPrefectureDropdownEffectivelyDisabled}
              prefectureMenuItemsToDisplay={prefectureMenuItemsToDisplay}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
