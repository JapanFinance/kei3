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

import type {
  DisabilityLevel,
  HouseholdMemberHealthInsurance,
  Spouse,
  SpouseAgeRange,
} from '../../../types/dependents';
import { DISABILITY_LEVELS, SPOUSE_AGE_RANGES } from '../../../types/dependents';
import {
  calculateDependentNetIncomeComponents,
  calculateDependentNetPublicPensionIncome,
  calculateDependentTotalNetIncome,
} from '../../../utils/dependentDeductions';
import { formatJPY } from '../../../utils/formatters';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks from '../../ui/SourceLinks';
import { SpinnerNumberField } from '../../ui/SpinnerNumberField';
import { DetailedTooltip, SimpleTooltip } from '../../ui/Tooltips';
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
        isSameHousehold: true,
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

  const hasAnyImpact = spouse
    ? spouse.isClaimedAsDependent !== false || spouse.isSameHousehold
    : false;

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
          {/* Age */}
          <FormControl fullWidth>
            <InputLabel>Age</InputLabel>
            <Select
              value={spouse.ageRange}
              label="Age"
              onChange={e =>
                handleSpouseChange({
                  ageRange: e.target.value as SpouseAgeRange,
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

          {/* Tax dependent claim & Household Insurance Controls */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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

            <FormControlLabel
              control={
                <Switch
                  checked={spouse.isSameHousehold}
                  onChange={e => handleSpouseChange({ isSameHousehold: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  In the same household
                  <DetailedTooltip
                    title="Same Municipal Household (同一世帯)"
                    icon={SIMPLE_TOOLTIP_ICON}
                  >
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Registered under the same municipal resident record (住民票上の同一世帯).
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      National Health Insurance (国民健康保険) pools premiums and calculates 7/5/2割
                      reductions across all enrolled members registered in the same household.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Uncheck if registered at a separate address (e.g. for work relocation
                      単身赴任). Spousal tax deductions (配偶者控除・配偶者特別控除) are not
                      affected as long as you share living expenses.
                    </Typography>
                    <SourceLinks
                      sources={[
                        {
                          href: 'https://laws.e-gov.go.jp/law/333AC0000000192#Mp-At_76',
                          label:
                            'e-Gov: National Health Insurance Act Art. 76 (国民健康保険法第76条: 世帯主の納付義務)',
                        },
                        {
                          href: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/koukikourei/index_00002.html',
                          label:
                            'MHLW: National Health Insurance System (厚生労働省: 国民健康保険制度)',
                        },
                        {
                          href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180_qa.htm',
                          label: 'NTA: Spouses living apart (国税庁:「生計を一にする」の意義)',
                        },
                      ]}
                    />
                  </DetailedTooltip>
                </Box>
              }
            />
          </Box>

          {!hasAnyImpact ? (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Your spouse is neither claimed on your tax return nor enrolled in your municipal
                household for National Health Insurance. As a result, they will have no effect on
                your taxes or health insurance premiums.
              </Typography>
            </Paper>
          ) : (
            <>
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
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
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
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
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
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
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
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
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
                              {formatJPY(
                                calculateDependentNetPublicPensionIncome(spouse, incomeYear),
                              )}
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

              {spouse.isSameHousehold && (
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
                            Check if your spouse is the official household head (世帯主) on the
                            住民票. Under NHI law, a non-NHI household head's income is counted
                            toward the 7/5/2割 low-income premium reduction test.
                          </SimpleTooltip>
                        </Box>
                      }
                    />
                  )}
                </Paper>
              )}

              {/* Disability Status */}
              {spouse.isClaimedAsDependent !== false && (
                <FormControl fullWidth>
                  <InputLabel>Disability Status</InputLabel>
                  <Select
                    value={spouse.disability}
                    label="Disability Status"
                    onChange={e =>
                      handleSpouseChange({
                        disability: e.target.value as DisabilityLevel,
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
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
