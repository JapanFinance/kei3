// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
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

const incomeInputSx = {
  maxWidth: { xs: 125, sm: 160 },
  '& .MuiInputBase-input': {
    fontSize: { xs: '0.8125rem', sm: '0.875rem' },
    px: { xs: 0.75, sm: 1.5 },
  },
};

interface SpouseSectionProps {
  spouse: Spouse | null;
  onChange: (spouse: Spouse | null) => void;
  /** Income year for the net-income preview calculations. */
  incomeYear: number;
  /** Whether the taxpayer is enrolled in National Health Insurance */
  isTaxpayerNHI?: boolean | undefined;
}

export default function SpouseSection({
  spouse,
  onChange,
  incomeYear,
  isTaxpayerNHI = false,
}: SpouseSectionProps) {
  const [hasSpouse, setHasSpouse] = useState(spouse !== null);

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
          label="Include spouse?"
        />
      </Box>

      {hasSpouse && spouse && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Age & Status Switches on one row on desktop */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 1, sm: 2.5 },
            }}
          >
            <FormControl
              size="small"
              sx={{ minWidth: { xs: '100%', sm: 190 }, flex: { sm: '0 0 auto' } }}
            >
              <InputLabel id="spouse-age-label">Age on Dec 31</InputLabel>
              <Select
                labelId="spouse-age-label"
                value={spouse.ageRange}
                label="Age on Dec 31"
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
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={spouse.isClaimedAsDependent !== false}
                  onChange={e => handleSpouseChange({ isClaimedAsDependent: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Claim tax deduction
                  <DetailedTooltip
                    title="Spousal Tax Deductions (配偶者控除・配偶者特別控除)"
                    icon={SIMPLE_TOOLTIP_ICON}
                  >
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Leave checked to claim eligible spousal tax deductions. Uncheck if the spouse
                      is claiming the deductions instead (spouses cannot both claim each other) or
                      does not meet the legal marriage requirement.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Spousal deductions require a legally recognized marriage under the Civil Code
                      of Japan. De facto or common-law marriages (事実婚・内縁関係), municipal
                      partnerships, and same-sex marriages are not eligible.
                    </Typography>
                    <SourceLinks
                      sources={[
                        {
                          href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm',
                          label:
                            'NTA: Spousal Deduction Requirements (国税庁: 配偶者控除の要件 No.1191)',
                        },
                      ]}
                    />
                  </DetailedTooltip>
                </Box>
              }
              sx={{ m: 0 }}
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
                  Same registered address
                  <DetailedTooltip
                    title="Same Municipal Household (同一世帯)"
                    icon={SIMPLE_TOOLTIP_ICON}
                  >
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Registered under the same municipal resident record (住民票上の同一世帯).
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      National Health Insurance (国民健康保険) calculates premiums across all
                      enrolled members registered in the same household.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Uncheck if registered at a separate address (e.g. for work relocation).
                      Spousal tax deductions are not affected as long as living expenses are shared.
                    </Typography>
                    <SourceLinks
                      sources={[
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
              sx={{ m: 0 }}
            />
          </Box>

          {!hasAnyImpact ? (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                The spouse is neither claimed for tax deductions nor registered at the same address
                for National Health Insurance. As a result, they will have no effect on taxes or
                health insurance premiums.
              </Typography>
            </Paper>
          ) : (
            <>
              {/* Income & Household Health Insurance Section */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 2,
                  alignItems: 'stretch',
                }}
              >
                {/* Income Information */}
                <Box
                  sx={{
                    flex: {
                      md:
                        spouse.isSameHousehold || spouse.isClaimedAsDependent !== false
                          ? '1 1 56%'
                          : 1,
                    },
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 28,
                      mb: 1,
                    }}
                  >
                    Income Information
                    <SimpleTooltip>
                      Enter income amounts to calculate total net income (合計所得金額) to determine
                      deduction eligibility and National Health Insurance premiums (if applicable).
                      Survivor and disability pensions (遺族年金・障害年金) are non-taxable and are
                      not included.
                    </SimpleTooltip>
                  </Typography>

                  <Paper
                    variant="outlined"
                    sx={{
                      overflowX: 'auto',
                      '& .MuiTableCell-root': {
                        px: { xs: 0.75, sm: 2 },
                        fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                      },
                    }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>Category</TableCell>
                          <TableCell align="right">Gross (収入)</TableCell>
                          <TableCell align="right">Net (所得)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {/* Employment Income Row */}
                        <TableRow>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
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
                              size="small"
                              hideSpinner
                              inputProps={{ style: { textAlign: 'right' } }}
                              sx={incomeInputSx}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontSize: 'inherit' }}>
                              {formatJPY(netEmploymentIncome)}
                              {incomeAdjustmentNote && (
                                <SimpleTooltip>{incomeAdjustmentNote}</SimpleTooltip>
                              )}
                            </Typography>
                          </TableCell>
                        </TableRow>

                        {/* Public Pension Income Row */}
                        <TableRow>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
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
                              size="small"
                              hideSpinner
                              inputProps={{ style: { textAlign: 'right' } }}
                              sx={incomeInputSx}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontSize: 'inherit' }}>
                              {formatJPY(
                                calculateDependentNetPublicPensionIncome(spouse, incomeYear),
                              )}
                            </Typography>
                          </TableCell>
                        </TableRow>

                        {/* Other Income Row */}
                        <TableRow>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            Other
                            <br />
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              その他
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ color: 'text.secondary', fontSize: 'inherit' }}
                            >
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
                              size="small"
                              hideSpinner
                              inputProps={{ style: { textAlign: 'right' } }}
                              sx={incomeInputSx}
                            />
                          </TableCell>
                        </TableRow>

                        {/* Total Row */}
                        <TableRow sx={{ backgroundColor: 'action.hover' }}>
                          <TableCell colSpan={2}>
                            <strong>Total (合計所得金額)</strong>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 'bold', fontSize: 'inherit' }}
                            >
                              {formatJPY(calculateDependentTotalNetIncome(spouse, incomeYear))}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>

                {/* Right Column: Household & Health Insurance and/or Disability Status */}
                {(spouse.isSameHousehold || spouse.isClaimedAsDependent !== false) && (
                  <Box
                    sx={{
                      flex: { md: '1 1 44%' },
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {spouse.isSameHousehold && (
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            minHeight: 28,
                            mb: 1,
                          }}
                        >
                          Household & Health Insurance
                        </Typography>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            backgroundColor: 'background.default',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                          }}
                        >
                          {spouse.ageRange === '75plus' ? (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              Aged 75+: Enrolled in Medical System for the Elderly
                              (後期高齢者医療制度); not enrolled in National Health Insurance.
                            </Typography>
                          ) : (
                            <FormControl fullWidth size="small">
                              <InputLabel id="spouse-hi-label">Health Insurance</InputLabel>
                              <Select
                                labelId="spouse-hi-label"
                                label="Health Insurance"
                                value={spouse.healthInsurance ?? 'auto'}
                                onChange={e =>
                                  handleSpouseChange({
                                    healthInsurance: e.target
                                      .value as HouseholdMemberHealthInsurance,
                                  })
                                }
                              >
                                <MenuItem value="auto">
                                  Same as taxpayer ({isTaxpayerNHI ? 'NHI' : 'EHI'})
                                </MenuItem>
                                <MenuItem value="nhi">
                                  National Health Insurance (国民健康保険)
                                </MenuItem>
                                <MenuItem value="other">
                                  Employees' Health Insurance (社会保険等)
                                </MenuItem>
                              </Select>
                              <FormHelperText>
                                Health insurance system covering the spouse.
                              </FormHelperText>
                            </FormControl>
                          )}

                          <FormControlLabel
                            control={
                              <Switch
                                checked={spouse.isHouseholdHead === true}
                                onChange={e =>
                                  handleSpouseChange({ isHouseholdHead: e.target.checked })
                                }
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                Household head (世帯主)
                                <SimpleTooltip>
                                  Check if the spouse is registered as the household head (世帯主)
                                  on the municipal resident record (住民票). By default, the
                                  taxpayer is assumed to be the household head. Under National
                                  Health Insurance, a non-enrolled head acts as a deemed head
                                  (擬制世帯主) whose income is included for low-income premium
                                  reductions.
                                </SimpleTooltip>
                              </Box>
                            }
                            sx={{ m: 0 }}
                          />
                        </Paper>
                      </Box>
                    )}

                    {/* Disability Status */}
                    {spouse.isClaimedAsDependent !== false && (
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography
                          id="spouse-disability-label"
                          variant="subtitle2"
                          component="label"
                          htmlFor="spouse-disability-select"
                          sx={{ display: 'block', mb: 0.5 }}
                        >
                          Disability Status
                        </Typography>
                        <FormControl fullWidth size="small">
                          <Select
                            id="spouse-disability-select"
                            labelId="spouse-disability-label"
                            value={spouse.disability}
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
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
