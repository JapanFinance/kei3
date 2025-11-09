import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { 
  OtherDependent, 
  DependentRelationship, 
  DependentAgeCategory,
  DisabilityLevel,
  DependentIncome,
} from '../../types/dependents';
import {
  RELATIONSHIPS,
  DISABILITY_LEVELS,
  DEPENDENT_AGE_CATEGORIES,
  calculateDependentTotalNetIncome,
  calculateNetEmploymentIncome,
  isEligibleForDependentDeduction,
  isEligibleForSpecificRelativeDeduction,
} from '../../types/dependents';
import { InfoTooltip } from '../ui/InfoTooltip';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import { formatJPY } from '../../utils/formatters';
import { getSpecificRelativeDeduction, getDependentDeduction, getDisabilityDeduction } from '../../utils/dependentDeductions';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';

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
  const [relationship, setRelationship] = useState<Exclude<DependentRelationship, 'spouse'>>(
    dependent?.relationship || 'child'
  );
  const [ageCategory, setAgeCategory] = useState<DependentAgeCategory>(
    dependent?.ageCategory || '16to18'
  );
  const [income, setIncome] = useState<DependentIncome>(
    dependent?.income || { grossEmploymentIncome: 0, otherNetIncome: 0 }
  );
  const [disability, setDisability] = useState<DisabilityLevel>(
    dependent?.disability || 'none'
  );
  const [isCohabiting, setIsCohabiting] = useState(dependent?.isCohabiting || false);

  const handleSubmit = () => {
    const newDependent: OtherDependent = {
      id: dependent?.id || `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      relationship,
      ageCategory,
      income,
      disability,
      isCohabiting,
    };

    onSave(newDependent);
  };

  const canSubmit = true; // All fields have defaults, always submittable

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

      {/* Income Information */}
      <Box>
        <Typography 
          gutterBottom 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            mb: 1,
          }}
        >
          Income Information
          <InfoTooltip title="Enter income amounts to calculate total net income (合計所得金額) and determine deduction eligibility." />
        </Typography>
        
        {isMobile ? (
          /* Mobile: Stacked Layout */
          <Paper variant="outlined" sx={{ p: 2 }}>
            {/* Employment Income */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                Employment Income (給与)
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Gross (収入)</Typography>
                <SpinnerNumberField
                  value={income.grossEmploymentIncome}
                  onChange={(value: number) =>
                    setIncome({
                      ...income,
                      grossEmploymentIncome: value,
                    })
                  }
                  step={10_000}
                  shiftStep={100_000}
                  sx={{ maxWidth: 180 }}
                  inputProps={{ style: { textAlign: 'right' } }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Net (所得)</Typography>
                <Typography variant="body2">
                  {formatJPY(calculateNetEmploymentIncome(income.grossEmploymentIncome))}
                </Typography>
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            {/* Other Income */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                Other Income (その他)
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Net (所得)</Typography>
                <SpinnerNumberField
                  value={income.otherNetIncome}
                  onChange={(value: number) =>
                    setIncome({
                      ...income,
                      otherNetIncome: value,
                    })
                  }
                  step={10_000}
                  shiftStep={100_000}
                  sx={{ maxWidth: 180 }}
                  inputProps={{ style: { textAlign: 'right' } }}
                />
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            {/* Total */}
            <Box sx={{ backgroundColor: 'action.hover', p: 1.5, borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" fontWeight="bold">
                  Total (合計所得金額)
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatJPY(calculateDependentTotalNetIncome(income))}
                </Typography>
              </Box>
            </Box>
          </Paper>
        ) : (
          /* Desktop: Table Layout */
          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Income Category</TableCell>
                  <TableCell align="right">Gross (収入)</TableCell>
                  <TableCell align="right">Net (所得)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Employment Income Row */}
                <TableRow>
                  <TableCell>Employment<br/><Typography variant="caption" color="text.secondary">給与</Typography></TableCell>
                  <TableCell align="right">
                    <SpinnerNumberField
                      value={income.grossEmploymentIncome}
                      onChange={(value: number) =>
                        setIncome({
                          ...income,
                          grossEmploymentIncome: value,
                        })
                      }
                      step={10_000}
                      shiftStep={100_000}
                      sx={{ maxWidth: 150 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {formatJPY(calculateNetEmploymentIncome(income.grossEmploymentIncome))}
                    </Typography>
                  </TableCell>
                </TableRow>
                
                {/* Other Income Row */}
                <TableRow>
                  <TableCell>Other<br/><Typography variant="caption" color="text.secondary">その他</Typography></TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">—</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <SpinnerNumberField
                      value={income.otherNetIncome}
                      onChange={(value: number) =>
                        setIncome({
                          ...income,
                          otherNetIncome: value,
                        })
                      }
                      step={10_000}
                      shiftStep={100_000}
                      sx={{ maxWidth: 150 }}
                    />
                  </TableCell>
                </TableRow>
                
                {/* Total Row */}
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell><strong>Total (合計所得金額)</strong></TableCell>
                  <TableCell align="right"></TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {formatJPY(calculateDependentTotalNetIncome(income))}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>

      {/* Age and Living Together on same row */}
      <Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <FormControl sx={{ flex: 1 }}>
            <InputLabel id="age-label">Age</InputLabel>
            <Select
              labelId="age-label"
              label="Age"
              value={ageCategory}
              onChange={(e) => setAgeCategory(e.target.value as DependentAgeCategory)}
            >
              {DEPENDENT_AGE_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={isCohabiting}
                onChange={(e) => setIsCohabiting(e.target.checked)}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Living Together
                <InfoTooltip title="Check this if the dependent lives with you. This may affect deduction amounts for elderly parents or special disability cases." />
              </Box>
            }
            sx={{ flex: 1, mt: 1 }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75, display: 'block' }}>
          Age as of December 31st of the tax year
        </Typography>
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
      </FormControl>

      {/* Eligible Deductions Table */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Eligible Deductions:
        </Typography>
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Deduction Type</TableCell>
                <TableCell align="right">Income Tax</TableCell>
                <TableCell align="right">Residence Tax</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const totalNetIncome = calculateDependentTotalNetIncome(income);
                const tempDependent: OtherDependent = {
                  id: 'temp',
                  relationship,
                  ageCategory,
                  income,
                  disability,
                  isCohabiting,
                };
                
                const eligibleForDependent = isEligibleForDependentDeduction(tempDependent);
                const eligibleForSpecificRelative = isEligibleForSpecificRelativeDeduction(tempDependent);
                const rows: React.ReactNode[] = [];
                
                // Dependent Deduction
                if (eligibleForDependent) {
                  const natDependent = getDependentDeduction(ageCategory, relationship, isCohabiting, false);
                  const resDependent = getDependentDeduction(ageCategory, relationship, isCohabiting, true);
                  rows.push(
                    <TableRow key="dependent">
                      <TableCell>Dependent Deduction (扶養控除)</TableCell>
                      <TableCell align="right">{formatJPY(natDependent)}</TableCell>
                      <TableCell align="right">{formatJPY(resDependent)}</TableCell>
                    </TableRow>
                  );
                }
                
                // Specific Relative Special Deduction
                if (eligibleForSpecificRelative) {
                  const natSpecific = getSpecificRelativeDeduction(totalNetIncome, false);
                  const resSpecific = getSpecificRelativeDeduction(totalNetIncome, true);
                  rows.push(
                    <TableRow key="specific-relative">
                      <TableCell>Specific Relative Special Deduction (特定親族特別控除)</TableCell>
                      <TableCell align="right">{formatJPY(natSpecific)}</TableCell>
                      <TableCell align="right">{formatJPY(resSpecific)}</TableCell>
                    </TableRow>
                  );
                }
                
                // Disability Deduction
                if (disability !== 'none') {
                  const natDisability = getDisabilityDeduction(disability, isCohabiting, false);
                  const resDisability = getDisabilityDeduction(disability, isCohabiting, true);
                  rows.push(
                    <TableRow key="disability">
                      <TableCell>Disability Deduction (障害者控除)</TableCell>
                      <TableCell align="right">{formatJPY(natDisability)}</TableCell>
                      <TableCell align="right">{formatJPY(resDisability)}</TableCell>
                    </TableRow>
                  );
                }
                
                // No deductions message
                if (rows.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No deductions available
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                }
                
                return rows;
              })()}
            </TableBody>
          </Table>
        </Paper>
      </Box>

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
