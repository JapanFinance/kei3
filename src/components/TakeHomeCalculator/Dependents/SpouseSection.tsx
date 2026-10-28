// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useState } from 'react';

import type { HouseholdMemberHealthInsurance, Spouse } from '../../../types/dependents';
import { DISABILITY_LEVELS, SPOUSE_AGE_RANGES } from '../../../types/dependents';
import {
  calculateDependentNetIncomeComponents,
  calculateDependentNetPublicPensionIncome,
  calculateDependentTotalNetIncome,
} from '../../../utils/dependentDeductions';
import { formatJPY } from '../../../utils/formatters';
import { SpinnerNumberField } from '../../ui/SpinnerNumberField';
import { SimpleTooltip } from '../../ui/Tooltips';
import { describeIncomeAdjustmentDeduction } from './incomeAdjustmentNote';

interface SpouseSectionProps {
  spouse: Spouse | null;
  onChange: (spouse: Spouse | null) => void;
  /** Income year for the net-income preview calculations. */
  incomeYear: number;
}

export default function SpouseSection({ spouse, onChange, incomeYear }: SpouseSectionProps) {
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
        ageRange: 'under40',
        income: {
          grossEmploymentIncome: 0,
          grossPublicPensionIncome: 0,
          otherNetIncome: 0,
        },
        disability: 'none',
        isCohabiting: true,
        isClaimedAsDependent: true,
        healthInsurance: 'auto',
        isHouseholdHead: false,
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

  const { netEmploymentIncome, incomeAdjustmentDeduction, pensionIncomeAdjustmentDeduction } =
    spouse
      ? calculateDependentNetIncomeComponents(spouse, incomeYear)
      : {
          netEmploymentIncome: 0,
          incomeAdjustmentDeduction: 0,
          pensionIncomeAdjustmentDeduction: 0,
        };
  const incomeAdjustmentNote = describeIncomeAdjustmentDeduction(
    incomeAdjustmentDeduction,
    pensionIncomeAdjustmentDeduction,
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Spouse</Typography>
        <FormControlLabel
          control={
            <Switch checked={hasSpouse} onChange={e => handleToggleSpouse(e.target.checked)} />
          }
          label="Include a spouse?"
        />
      </Box>

      {hasSpouse && spouse && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Income Information */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Income Information{' '}
              <SimpleTooltip>
                Enter income amounts to calculate total net income (合計所得金額) and determine
                deduction eligibility. Survivor and disability pensions (遺族年金・障害年金) are
                non-taxable and are not included.
              </SimpleTooltip>
            </Typography>

            {isMobile ? (
              /* Mobile: Stacked Layout */
              <Paper variant="outlined" sx={{ mt: 1, p: 2 }}>
                {/* Employment Income */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Employment Income (給与)
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Gross (収入)
                    </Typography>
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
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Net (所得)
                    </Typography>
                    <Typography variant="body2">
                      {formatJPY(netEmploymentIncome)}
                      {incomeAdjustmentNote && (
                        <SimpleTooltip>{incomeAdjustmentNote}</SimpleTooltip>
                      )}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Public Pension Income */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Public Pension (公的年金等)
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Gross (収入)
                    </Typography>
                    <SpinnerNumberField
                      value={spouse.income.grossPublicPensionIncome}
                      onChange={(value: number) =>
                        handleSpouseChange({
                          income: {
                            ...spouse.income,
                            grossPublicPensionIncome: value,
                          },
                        })
                      }
                      step={10_000}
                      shiftStep={100_000}
                      sx={{ maxWidth: 180 }}
                      inputProps={{ style: { textAlign: 'right' } }}
                    />
                  </Box>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Net (所得)
                    </Typography>
                    <Typography variant="body2">
                      {formatJPY(calculateDependentNetPublicPensionIncome(spouse, incomeYear))}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Other Income */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom sx={{ fontWeight: 'medium' }}>
                    Other Income (その他)
                  </Typography>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Net (所得)
                    </Typography>
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
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      Total (合計所得金額)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {formatJPY(calculateDependentTotalNetIncome(spouse, incomeYear))}
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
                      <TableCell>
                        Employment
                        <br />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          給与
                        </Typography>
                      </TableCell>
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
                          {formatJPY(netEmploymentIncome)}
                          {incomeAdjustmentNote && (
                            <SimpleTooltip>{incomeAdjustmentNote}</SimpleTooltip>
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* Public Pension Income Row */}
                    <TableRow>
                      <TableCell>
                        Public Pension
                        <br />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          公的年金等
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <SpinnerNumberField
                          value={spouse.income.grossPublicPensionIncome}
                          onChange={(value: number) =>
                            handleSpouseChange({
                              income: {
                                ...spouse.income,
                                grossPublicPensionIncome: value,
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
                          {formatJPY(calculateDependentNetPublicPensionIncome(spouse, incomeYear))}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* Other Income Row */}
                    <TableRow>
                      <TableCell>
                        Other
                        <br />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          その他
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          —
                        </Typography>
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
                      <TableCell>
                        <strong>Total (合計所得金額)</strong>
                      </TableCell>
                      <TableCell align="right"></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {formatJPY(calculateDependentTotalNetIncome(spouse, incomeYear))}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Box>

          {/* Age Range and Living Together on same row */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl sx={{ flex: 1 }}>
              <InputLabel>Age</InputLabel>
              <Select
                value={spouse.ageRange}
                label="Age"
                onChange={e =>
                  handleSpouseChange({
                    ageRange: e.target.value,
                  })
                }
              >
                {SPOUSE_AGE_RANGES.map(cat => (
                  <MenuItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>On December 31</FormHelperText>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={spouse.isCohabiting}
                  onChange={e => handleSpouseChange({ isCohabiting: e.target.checked })}
                />
              }
              label="Living together"
              sx={{ flex: 1 }}
            />
          </Box>

          {/* Tax dependent claim & Household Insurance Controls */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={spouse.isClaimedAsDependent !== false}
                  onChange={e => handleSpouseChange({ isClaimedAsDependent: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Claim as tax dependent
                  <SimpleTooltip>
                    Leave checked to claim 配偶者控除 / 配偶者特別控除 / 障害者控除. Uncheck if your
                    spouse files independently or is not claimed on your tax return, while still
                    including them in the household for National Health Insurance.
                  </SimpleTooltip>
                </Box>
              }
            />
          </Box>

          {spouse.isCohabiting && (
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'background.default' }}>
              <Typography variant="subtitle2" gutterBottom>
                Household & Health Insurance Status
              </Typography>

              {spouse.ageRange === '75plus' ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Aged 75+: Enrolled in Medical System for the Elderly (後期高齢者医療制度); not
                  enrolled in National Health Insurance.
                </Typography>
              ) : (
                <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                  <InputLabel id="spouse-hi-label">Health Insurance</InputLabel>
                  <Select
                    labelId="spouse-hi-label"
                    label="Health Insurance"
                    value={spouse.healthInsurance ?? 'auto'}
                    onChange={e =>
                      handleSpouseChange({
                        healthInsurance: e.target.value as HouseholdMemberHealthInsurance,
                      })
                    }
                  >
                    <MenuItem value="auto">Follow taxpayer's insurance (default)</MenuItem>
                    <MenuItem value="nhi">National Health Insurance (国民健康保険)</MenuItem>
                    <MenuItem value="other">
                      Employees' Health Insurance / Other (社会保険等)
                    </MenuItem>
                  </Select>
                  <FormHelperText>
                    Determines whether your spouse is covered under household National Health
                    Insurance.
                  </FormHelperText>
                </FormControl>
              )}

              {(spouse.healthInsurance === 'other' || spouse.ageRange === '75plus') && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={spouse.isHouseholdHead === true}
                      onChange={e => handleSpouseChange({ isHouseholdHead: e.target.checked })}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      Designate as household head (擬制世帯主)
                      <SimpleTooltip>
                        Check if your spouse is the official household head (世帯主) on the 住民票.
                        Under NHI law, a non-NHI household head's income is counted toward the
                        7/5/2割 low-income premium reduction test.
                      </SimpleTooltip>
                    </Box>
                  }
                />
              )}
            </Paper>
          )}

          {/* Disability Status */}
          <FormControl fullWidth>
            <InputLabel>Disability Status</InputLabel>
            <Select
              value={spouse.disability}
              label="Disability Status"
              onChange={e =>
                handleSpouseChange({
                  disability: e.target.value,
                })
              }
            >
              {DISABILITY_LEVELS.map(level => (
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
