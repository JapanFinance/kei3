import { useState } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
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
} from '../../types/dependents';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import { InfoTooltip } from '../ui/InfoTooltip';
import { formatJPY } from '../../utils/formatters';
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
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
      </Box>

      {hasSpouse && spouse && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
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

          {/* Age Category and Living Together on same row */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl sx={{ flex: 1 }} size="small">
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
              sx={{ flex: 1 }}
            />
          </Box>

          {/* Disability Status */}
          <FormControl fullWidth size="small">
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
            <FormHelperText>
              See{' '}
              <Link
                href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm"
                target="_blank"
                rel="noopener noreferrer"
              >
                NTA disability deduction guide
              </Link>
            </FormHelperText>
          </FormControl>
        </Box>
      )}
    </Box>
  );
}
