import { useState } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import type {
  DisabilityLevel,
  Spouse,
  SpouseAgeCategory,
  SpouseIncomeLevel,
} from '../../types/dependents';
import {
  DISABILITY_LEVELS,
  SPOUSE_INCOME_LEVELS,
  SPOUSE_AGE_CATEGORIES,
} from '../../types/dependents';

interface SpouseSectionProps {
  spouse: Spouse | null;
  onChange: (spouse: Spouse | null) => void;
}

export default function SpouseSection({ spouse, onChange }: SpouseSectionProps) {
  const [hasSpouse, setHasSpouse] = useState(spouse !== null);

  const handleToggleSpouse = (checked: boolean) => {
    setHasSpouse(checked);
    if (checked) {
      // Create new spouse with default values
      const newSpouse: Spouse = {
        id: crypto.randomUUID(),
        relationship: 'spouse',
        ageCategory: 'under70',
        incomeLevel: 'under95',
        disability: 'none',
        isCohabiting: true,
      };
      onChange(newSpouse);
    } else {
      // Remove spouse
      onChange(null);
    }
  };

  const handleSpouseChange = (updates: Partial<Spouse>) => {
    if (!spouse) return;
    onChange({ ...spouse, ...updates });
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Spouse
      </Typography>
      
      <FormControlLabel
        control={
          <Switch
            checked={hasSpouse}
            onChange={(e) => handleToggleSpouse(e.target.checked)}
          />
        }
        label="Do you have a spouse?"
      />

      {hasSpouse && spouse && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Age Category */}
          <FormControl fullWidth>
            <InputLabel>Age</InputLabel>
            <Select
              value={spouse.ageCategory}
              label="Age"
              onChange={(e) =>
                handleSpouseChange({
                  ageCategory: e.target.value as SpouseAgeCategory,
                })
              }
            >
              {SPOUSE_AGE_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Income Level */}
          <FormControl fullWidth>
            <InputLabel>Annual Income</InputLabel>
            <Select
              value={spouse.incomeLevel}
              label="Annual Income"
              onChange={(e) =>
                handleSpouseChange({
                  incomeLevel: e.target.value as SpouseIncomeLevel,
                })
              }
            >
              {SPOUSE_INCOME_LEVELS.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  <Box>
                    <Typography variant="body2">{level.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {level.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Disability Level */}
          <FormControl fullWidth>
            <InputLabel>Disability Status</InputLabel>
            <Select
              value={spouse.disability}
              label="Disability Status"
              onChange={(e) =>
                handleSpouseChange({
                  disability: e.target.value as DisabilityLevel,
                })
              }
            >
              {DISABILITY_LEVELS.map((level) => (
                <MenuItem key={level.value} value={level.value}>
                  <Box>
                    <Typography variant="body2">{level.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {level.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Cohabiting Status */}
          <FormControlLabel
            control={
              <Switch
                checked={spouse.isCohabiting}
                onChange={(e) =>
                  handleSpouseChange({ isCohabiting: e.target.checked })
                }
              />
            }
            label="Living together"
          />
        </Box>
      )}
    </Box>
  );
}
