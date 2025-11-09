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
} from '../../types/dependents';
import {
  DISABILITY_LEVELS,
  SPOUSE_AGE_CATEGORIES,
  calculateDependentTotalNetIncome,
  calculateNetEmploymentIncome,
  isEligibleForSpouseDeduction,
  isEligibleForSpouseSpecialDeduction,
} from '../../types/dependents';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import { InfoTooltip } from '../ui/InfoTooltip';
import { formatJPY } from '../../utils/formatters';
import { 
  getSpouseDeduction, 
  getSpouseSpecialDeduction,
  getDisabilityDeduction
} from '../../utils/dependentDeductions';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Divider from '@mui/material/Divider';

interface SpouseSectionProps {
  spouse: Spouse | null;
  onChange: (spouse: Spouse | null) => void;
}

export default function SpouseSection({ spouse, onChange }: SpouseSectionProps) {
  const [hasSpouse, setHasSpouse] = useState(spouse !== null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleToggleSpouse = (checked: boolean) => {
    setHasSpouse(checked);
    if (checked) {
      // Create new spouse with default values
      const newSpouse: Spouse = {
        id: crypto.randomUUID(),
        relationship: 'spouse',
        ageCategory: 'under70',
        income: {
          grossEmploymentIncome: 0,
          otherNetIncome: 0,
        },
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

          {/* Income Information */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Income Information{' '}
              <InfoTooltip title="Enter income amounts to calculate total net income (合計所得金額) and determine deduction eligibility." />
            </Typography>
            
            {isMobile ? (
              /* Mobile: Stacked Layout */
              <Paper variant="outlined" sx={{ mt: 1, p: 2 }}>
                {/* Employment Income */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    Employment Income (給与)
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">Gross (収入)</Typography>
                    <SpinnerNumberField
                      value={spouse.income.grossEmploymentIncome}
                      onChange={(value: number) =>
                        handleSpouseChange({
                          income: {
                            ...spouse.income,
                            grossEmploymentIncome: value,
                          },
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
                      {formatJPY(calculateNetEmploymentIncome(spouse.income.grossEmploymentIncome))}
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
                      value={spouse.income.otherNetIncome}
                      onChange={(value: number) =>
                        handleSpouseChange({
                          income: {
                            ...spouse.income,
                            otherNetIncome: value,
                          },
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
                      {formatJPY(calculateDependentTotalNetIncome(spouse.income))}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            ) : (
              /* Desktop: Table Layout */
              <Paper variant="outlined" sx={{ mt: 1 }}>
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
                          value={spouse.income.grossEmploymentIncome}
                          onChange={(value: number) =>
                            handleSpouseChange({
                              income: {
                                ...spouse.income,
                                grossEmploymentIncome: value,
                              },
                            })
                          }
                          step={10_000}
                          shiftStep={100_000}
                          sx={{ maxWidth: 150 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatJPY(calculateNetEmploymentIncome(spouse.income.grossEmploymentIncome))}
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
                          value={spouse.income.otherNetIncome}
                          onChange={(value: number) =>
                            handleSpouseChange({
                              income: {
                                ...spouse.income,
                                otherNetIncome: value,
                              },
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
                          {formatJPY(calculateDependentTotalNetIncome(spouse.income))}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Box>

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
                  {level.label}
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
                    const totalNetIncome = calculateDependentTotalNetIncome(spouse.income);
                    const isElderly = spouse.ageCategory === '70plus';
                    const rows: React.ReactNode[] = [];
                    
                    // Spouse or Spouse Special Deduction
                    if (isEligibleForSpouseDeduction({ ...spouse, relationship: 'spouse' as const })) {
                      const natDeduction = getSpouseDeduction(isElderly, false);
                      const resDeduction = getSpouseDeduction(isElderly, true);
                      rows.push(
                        <TableRow key="spouse">
                          <TableCell>Spouse Deduction (配偶者控除)</TableCell>
                          <TableCell align="right">{formatJPY(natDeduction)}</TableCell>
                          <TableCell align="right">{formatJPY(resDeduction)}</TableCell>
                        </TableRow>
                      );
                    } else if (isEligibleForSpouseSpecialDeduction({ ...spouse, relationship: 'spouse' as const })) {
                      const natDeduction = getSpouseSpecialDeduction(totalNetIncome, false);
                      const resDeduction = getSpouseSpecialDeduction(totalNetIncome, true);
                      rows.push(
                        <TableRow key="spouse-special">
                          <TableCell>Spouse Special Deduction (配偶者特別控除)</TableCell>
                          <TableCell align="right">{formatJPY(natDeduction)}</TableCell>
                          <TableCell align="right">{formatJPY(resDeduction)}</TableCell>
                        </TableRow>
                      );
                    }
                    
                    // Disability Deduction
                    if (spouse.disability !== 'none') {
                      const natDeduction = getDisabilityDeduction(spouse.disability, spouse.isCohabiting, false);
                      const resDeduction = getDisabilityDeduction(spouse.disability, spouse.isCohabiting, true);
                      rows.push(
                        <TableRow key="disability">
                          <TableCell>Disability Deduction (障害者控除)</TableCell>
                          <TableCell align="right">{formatJPY(natDeduction)}</TableCell>
                          <TableCell align="right">{formatJPY(resDeduction)}</TableCell>
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
        </Box>
      )}
    </Box>
  );
}
