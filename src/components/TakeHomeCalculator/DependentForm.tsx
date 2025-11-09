import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { 
  OtherDependent, 
  DependentRelationship, 
  DependentAgeCategory,
  IncomeLevel,
  DisabilityLevel,
} from '../../types/dependents';
import {
  INCOME_LEVELS,
  RELATIONSHIPS,
  DISABILITY_LEVELS,
  DEPENDENT_AGE_CATEGORIES,
  getIncomeLevelFromSlider,
  getSliderValueFromIncomeLevel,
} from '../../types/dependents';
import { InfoTooltip } from '../ui/InfoTooltip';

interface DependentFormProps {
  dependent: OtherDependent | null;
  onSave: (dependent: OtherDependent) => void;
  onCancel: () => void;
}

/**
 * Form for adding or editing a dependent
 */
export const DependentForm: React.FC<DependentFormProps> = ({
  dependent,
  onSave,
  onCancel,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isEditing = dependent !== null;

  // Form state
  const [name, setName] = useState(dependent?.name || '');
  const [relationship, setRelationship] = useState<Exclude<DependentRelationship, 'spouse'>>(
    dependent?.relationship || 'child'
  );
  const [ageCategory, setAgeCategory] = useState<DependentAgeCategory>(
    dependent?.ageCategory || '16to18'
  );
  const [incomeLevel, setIncomeLevel] = useState<IncomeLevel>(
    dependent?.incomeLevel || 'under48'
  );
  const [disability, setDisability] = useState<DisabilityLevel>(
    dependent?.disability || 'none'
  );
  const [isCohabiting, setIsCohabiting] = useState(dependent?.isCohabiting || false);

  // Update income level from slider
  const handleIncomeLevelSliderChange = (_event: Event, value: number | number[]) => {
    const sliderValue = Array.isArray(value) ? value[0]! : value;
    const newLevel = getIncomeLevelFromSlider(sliderValue);
    setIncomeLevel(newLevel);
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const newDependent: OtherDependent = {
      id: dependent?.id || `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      relationship,
      ageCategory,
      incomeLevel,
      disability,
      isCohabiting,
      ...(trimmedName && { name: trimmedName }),
    };

    onSave(newDependent);
  };

  const canSubmit = true; // All fields have defaults, always submittable

  const incomeLevelInfo = INCOME_LEVELS.find(l => l.value === incomeLevel);
  const sliderValue = getSliderValueFromIncomeLevel(incomeLevel);

  // Slider marks
  const sliderMarks = INCOME_LEVELS.map((level, index) => ({
    value: index,
    label: isMobile ? '' : level.label,
  }));

  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        width: '100%',
      }}
    >
      <Typography variant="h6" gutterBottom>
        {isEditing ? 'Edit Dependent' : 'Add New Dependent'}
      </Typography>

      {/* Optional Name */}
      <TextField
        label="Name (Optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
        helperText="Optional: For your reference only"
      />

      {/* Relationship */}
      <FormControl fullWidth>
        <InputLabel id="relationship-label">Relationship</InputLabel>
        <Select
          labelId="relationship-label"
          label="Relationship"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as Exclude<DependentRelationship, 'spouse'>)}
        >
          {RELATIONSHIPS.filter(rel => rel.value !== 'spouse').map((rel) => (
            <MenuItem key={rel.value} value={rel.value}>
              {rel.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Age Category */}
      <FormControl fullWidth>
        <InputLabel id="age-label">Age Category</InputLabel>
        <Select
          labelId="age-label"
          label="Age Category"
          value={ageCategory}
          onChange={(e) => setAgeCategory(e.target.value as DependentAgeCategory)}
        >
          {DEPENDENT_AGE_CATEGORIES.map((cat) => (
            <MenuItem key={cat.value} value={cat.value}>
              <Box>
                <Typography variant="body2">{cat.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {cat.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
          Age as of December 31st of the tax year
        </Typography>
      </FormControl>

      {/* Income Level Slider */}
      <Box>
        <Typography 
          gutterBottom 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            mb: 1,
          }}
        >
          Estimated Annual Income
          <InfoTooltip title="We don't need the exact income amount. Just select which income bracket applies. This determines eligibility for various deductions." />
        </Typography>
        
        <Box sx={{ px: isMobile ? 1 : 2, pt: 1 }}>
          <Slider
            value={sliderValue}
            onChange={handleIncomeLevelSliderChange}
            step={1}
            marks={sliderMarks}
            min={0}
            max={3}
            valueLabelDisplay="off"
            sx={{
              '& .MuiSlider-markLabel': {
                fontSize: '0.7rem',
                transform: isMobile ? 'translateX(-50%) rotate(-45deg)' : 'translateX(-50%)',
                transformOrigin: 'top center',
                top: isMobile ? 32 : 26,
                whiteSpace: 'nowrap',
              },
            }}
          />
        </Box>

        <Box 
          sx={{ 
            mt: isMobile ? 4 : 2,
            p: 2, 
            bgcolor: 'action.hover', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" fontWeight={500} gutterBottom>
            Selected: {incomeLevelInfo?.label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {incomeLevelInfo?.description}
          </Typography>
        </Box>
      </Box>

      {/* Disability */}
      <FormControl fullWidth>
        <Typography 
          gutterBottom 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            mb: 1,
            fontSize: '0.97rem',
          }}
        >
          Disability Status
          <InfoTooltip title="Select the disability level if applicable. Different disability levels provide different deduction amounts under Japanese tax law." />
        </Typography>
        <Select
          value={disability}
          onChange={(e) => setDisability(e.target.value as DisabilityLevel)}
          displayEmpty
        >
          {DISABILITY_LEVELS.map((level) => (
            <MenuItem key={level.value} value={level.value}>
              {level.label}
            </MenuItem>
          ))}
        </Select>
        {disability !== 'none' && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            {DISABILITY_LEVELS.find(l => l.value === disability)?.description}
          </Typography>
        )}
      </FormControl>

      {/* Cohabiting Switch */}
      <FormControlLabel
        control={
          <Switch
            checked={isCohabiting}
            onChange={(e) => setIsCohabiting(e.target.checked)}
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            Living Together (Cohabiting)
            <InfoTooltip title="Check this if the dependent lives with you. This may affect deduction amounts for elderly parents or special disability cases." />
          </Box>
        }
      />

      {/* Action Buttons */}
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 2, 
          justifyContent: 'flex-end',
          flexDirection: isMobile ? 'column-reverse' : 'row',
          mt: 2,
        }}
      >
        <Button 
          onClick={onCancel}
          variant="outlined"
          fullWidth={isMobile}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!canSubmit}
          fullWidth={isMobile}
        >
          {isEditing ? 'Update' : 'Add'} Dependent
        </Button>
      </Box>
    </Box>
  );
};
