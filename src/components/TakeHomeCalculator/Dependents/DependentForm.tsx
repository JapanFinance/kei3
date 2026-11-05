// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import React, { useState } from 'react';

import type {
  OtherDependent,
  DependentRelationship,
  DependentAgeRange,
  DisabilityLevel,
  DependentIncome,
  HouseholdMemberHealthInsurance,
} from '../../../types/dependents';
import { RELATIONSHIPS, DISABILITY_LEVELS, DEPENDENT_AGE_RANGES } from '../../../types/dependents';
import type { HealthInsuranceProviderId } from '../../../types/healthInsurance';
import {
  calculateDependentDeductions,
  calculateDependentNetIncomeComponents,
  calculateDependentNetPublicPensionIncome,
  calculateDependentTotalNetIncome,
} from '../../../utils/dependentDeductions';
import { formatJPY } from '../../../utils/formatters';
import { getAutoHealthInsuranceLabel } from '../../../utils/nhiHousehold';
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

interface DependentFormProps {
  dependent: OtherDependent | null;
  onSave: (dependent: OtherDependent) => void;
  onCancel: () => void;
  /** Income year for the net-income and deduction preview calculations. */
  incomeYear: number;
  /** Whether the taxpayer is enrolled in National Health Insurance */
  isTaxpayerNHI?: boolean | undefined;
  /** Taxpayer's current health insurance provider */
  taxpayerHealthInsuranceProvider?: HealthInsuranceProviderId | undefined;
}

/**
 * Form for adding or editing a dependent
 */
export const DependentForm: React.FC<DependentFormProps> = ({
  dependent,
  onSave,
  onCancel,
  incomeYear,
  isTaxpayerNHI = false,
  taxpayerHealthInsuranceProvider,
}) => {
  const isEditing = dependent !== null;

  // Form state
  const [relationship, setRelationship] = useState<Exclude<DependentRelationship, 'spouse'>>(
    dependent?.relationship ?? 'child',
  );
  const [ageRange, setAgeRange] = useState<DependentAgeRange>(dependent?.ageRange ?? '16to18');
  const [income, setIncome] = useState<DependentIncome>(
    dependent?.income ?? {
      grossEmploymentIncome: 0,
      grossPublicPensionIncome: 0,
      otherNetIncome: 0,
    },
  );
  const [disability, setDisability] = useState<DisabilityLevel>(dependent?.disability ?? 'none');
  const [isSameHousehold, setIsSameHousehold] = useState(dependent?.isSameHousehold ?? true);
  const [isClaimedAsDependent, setIsClaimedAsDependent] = useState<boolean>(
    dependent?.isClaimedAsDependent ?? true,
  );
  const [healthInsurance, setHealthInsurance] = useState<HouseholdMemberHealthInsurance>(
    dependent?.healthInsurance ?? 'auto',
  );
  const [isHouseholdHead, setIsHouseholdHead] = useState<boolean>(
    dependent?.isHouseholdHead ?? false,
  );

  const handleSubmit = () => {
    const newDependent: OtherDependent = {
      id: dependent?.id ?? `dep-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      relationship,
      ageRange,
      income,
      disability,
      isSameHousehold,
      isClaimedAsDependent,
      healthInsurance,
      isHouseholdHead,
    };

    onSave(newDependent);
  };

  const hasAnyImpact = isClaimedAsDependent || isSameHousehold;

  const canSubmit = true; // All fields have defaults, always submittable

  const incomeProfile = { income, ageRange, disability };
  const { netEmploymentIncome, incomeAdjustmentDeduction, pensionIncomeAdjustmentDeduction } =
    calculateDependentNetIncomeComponents(incomeProfile, incomeYear);
  const incomeAdjustmentNote = describeIncomeAdjustmentDeduction(
    incomeAdjustmentDeduction,
    pensionIncomeAdjustmentDeduction,
  );

  return (
    <Box
      component="form"
      onSubmit={e => {
        e.preventDefault();
        handleSubmit();
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, sm: 2.5 },
        width: '100%',
      }}
    >
      <Typography variant="h6">{isEditing ? 'Edit Dependent' : 'Add New Dependent'}</Typography>

      {/* Relationship and Age on the same row */}
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1.5, sm: 2 },
          width: '100%',
        }}
      >
        <FormControl
          fullWidth
          size="small"
          sx={{
            flex: { xs: '1.45 1 0', sm: 1 },
            '& .MuiSelect-select': {
              pr: { xs: '28px !important', sm: undefined },
              pl: { xs: 1.25, sm: 1.75 },
              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            },
          }}
        >
          <InputLabel id="relationship-label">Relationship</InputLabel>
          <Select
            labelId="relationship-label"
            label="Relationship"
            value={relationship}
            onChange={e =>
              setRelationship(e.target.value as Exclude<DependentRelationship, 'spouse'>)
            }
          >
            {RELATIONSHIPS.filter(rel => rel.value !== 'spouse').map(rel => (
              <MenuItem key={rel.value} value={rel.value}>
                {rel.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl
          fullWidth
          size="small"
          sx={{
            flex: { xs: '0.95 1 0', sm: 1 },
            '& .MuiSelect-select': {
              fontSize: { xs: '0.8125rem', sm: '0.875rem' },
            },
          }}
        >
          <InputLabel id="age-label">Age on Dec 31</InputLabel>
          <Select
            labelId="age-label"
            label="Age on Dec 31"
            value={ageRange}
            onChange={e => setAgeRange(e.target.value as DependentAgeRange)}
          >
            {DEPENDENT_AGE_RANGES.map(cat => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Status Switches on same line on desktop, clean column on mobile */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          flexWrap: 'wrap',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: { xs: 0.5, sm: 2.5 },
          my: { xs: -0.75, sm: 0 },
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={isClaimedAsDependent}
              onChange={e => setIsClaimedAsDependent(e.target.checked)}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              Claim as tax dependent
              <SimpleTooltip>
                Leave checked to claim tax deductions for this dependent. Uncheck if this person is
                not claimed on the tax return or year-end adjustment (e.g. child claimed by the
                other parent).
              </SimpleTooltip>
            </Box>
          }
          sx={{ m: 0 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={isSameHousehold}
              onChange={e => setIsSameHousehold(e.target.checked)}
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
                  Determines whether National Health Insurance calculations can include this person
                  and their income.
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Also qualifies elderly dependent relatives (70+) for the cohabiting elderly
                  relative deduction (同居老親等) and disabled persons for the cohabiting special
                  disability deduction (同居特別障害者).
                </Typography>
                <SourceLinks
                  sources={[
                    {
                      href: 'https://www.hokeniryo.metro.tokyo.lg.jp/kenkou/kokuho/aramashi/index.html',
                      label:
                        'Tokyo Bureau of Public Health: National Health Insurance Guide (東京都保健医療局: 国民健康保険のあらまし)',
                    },
                    {
                      href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm',
                      label: 'NTA: Dependent Deductions (国税庁: 扶養控除)',
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
            This person is neither claimed as a dependent nor registered at the same address for
            National Health Insurance. As a result, they will have no effect on taxes or health
            insurance premiums.
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
                  md: isSameHousehold || isClaimedAsDependent ? '1 1 56%' : 1,
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
                  Enter income amounts to calculate total net income (合計所得金額) and determine
                  deduction eligibility. Survivor and disability pensions (遺族年金・障害年金) are
                  non-taxable and are not included.
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
                          value={income.grossEmploymentIncome}
                          onChange={(value: number) =>
                            setIncome({
                              ...income,
                              grossEmploymentIncome: value,
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
                          value={income.grossPublicPensionIncome}
                          onChange={(value: number) =>
                            setIncome({
                              ...income,
                              grossPublicPensionIncome: value,
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
                            calculateDependentNetPublicPensionIncome(incomeProfile, incomeYear),
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
                          value={income.otherNetIncome}
                          onChange={(value: number) =>
                            setIncome({
                              ...income,
                              otherNetIncome: value,
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
                          {formatJPY(calculateDependentTotalNetIncome(incomeProfile, incomeYear))}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Box>

            {/* Right Column: Household & Health Insurance and/or Disability Status */}
            {(isSameHousehold || isClaimedAsDependent) && (
              <Box
                sx={{
                  flex: { md: '1 1 44%' },
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {/* Household & Health Insurance Status */}
                {isSameHousehold && (
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
                      {ageRange === '75plus' ? (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Aged 75+: Enrolled in Medical System for the Elderly (後期高齢者医療制度);
                          not enrolled in National Health Insurance.
                        </Typography>
                      ) : (
                        <FormControl fullWidth size="small">
                          <InputLabel id="dep-hi-label">Health Insurance</InputLabel>
                          <Select
                            labelId="dep-hi-label"
                            label="Health Insurance"
                            value={healthInsurance}
                            onChange={e =>
                              setHealthInsurance(e.target.value as HouseholdMemberHealthInsurance)
                            }
                          >
                            <MenuItem value="auto">
                              {getAutoHealthInsuranceLabel(
                                taxpayerHealthInsuranceProvider,
                                isTaxpayerNHI,
                              )}
                            </MenuItem>
                            <MenuItem value="nhi">
                              National Health Insurance (国民健康保険)
                            </MenuItem>
                            <MenuItem value="non_nhi">
                              Employees' Health Insurance (社会保険等)
                            </MenuItem>
                          </Select>
                          <FormHelperText>
                            Health insurance system covering this member.
                          </FormHelperText>
                        </FormControl>
                      )}

                      <FormControlLabel
                        control={
                          <Switch
                            checked={isHouseholdHead}
                            onChange={e => setIsHouseholdHead(e.target.checked)}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            Household head (世帯主)
                            <SimpleTooltip>
                              Check if this person is registered as the household head (世帯主) on
                              the municipal resident record (住民票). By default, the taxpayer is
                              assumed to be the household head. Under National Health Insurance, a
                              non-enrolled head acts as a deemed head (擬制世帯主) whose income is
                              included for low-income premium reductions.
                            </SimpleTooltip>
                          </Box>
                        }
                        sx={{ m: 0 }}
                      />
                    </Paper>
                  </Box>
                )}

                {/* Disability Status */}
                {isClaimedAsDependent && (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography
                      id="dep-disability-label"
                      variant="subtitle2"
                      component="label"
                      htmlFor="dep-disability-select"
                      sx={{
                        display: 'block',
                        mb: 0.5,
                      }}
                    >
                      Disability Status
                    </Typography>
                    <FormControl fullWidth size="small">
                      <Select
                        id="dep-disability-select"
                        labelId="dep-disability-label"
                        value={disability}
                        onChange={e => setDisability(e.target.value as DisabilityLevel)}
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

          {/* Eligible Deductions Table */}
          {isClaimedAsDependent && (
            <Box sx={{ mt: 1 }}>
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
                      const tempDependent: OtherDependent = {
                        id: 'temp',
                        relationship,
                        ageRange,
                        income,
                        disability,
                        isSameHousehold,
                        isClaimedAsDependent,
                        healthInsurance,
                        isHouseholdHead,
                      };

                      // Calculate all deductions for this dependent
                      const results = calculateDependentDeductions([tempDependent], incomeYear);
                      const rows: React.ReactNode[] = [];

                      // Dependent Deduction
                      if (
                        results.nationalTax.dependentDeduction > 0 ||
                        results.residenceTax.dependentDeduction > 0
                      ) {
                        rows.push(
                          <TableRow key="dependent">
                            <TableCell>Dependent Deduction (扶養控除)</TableCell>
                            <TableCell align="right">
                              {formatJPY(results.nationalTax.dependentDeduction)}
                            </TableCell>
                            <TableCell align="right">
                              {formatJPY(results.residenceTax.dependentDeduction)}
                            </TableCell>
                          </TableRow>,
                        );
                      }

                      // Specific Relative Special Deduction
                      if (
                        results.nationalTax.specificRelativeDeduction > 0 ||
                        results.residenceTax.specificRelativeDeduction > 0
                      ) {
                        rows.push(
                          <TableRow key="specific-relative">
                            <TableCell>
                              Specific Relative Special Deduction (特定親族特別控除)
                            </TableCell>
                            <TableCell align="right">
                              {formatJPY(results.nationalTax.specificRelativeDeduction)}
                            </TableCell>
                            <TableCell align="right">
                              {formatJPY(results.residenceTax.specificRelativeDeduction)}
                            </TableCell>
                          </TableRow>,
                        );
                      }

                      // Disability Deduction
                      if (
                        results.nationalTax.disabilityDeduction > 0 ||
                        results.residenceTax.disabilityDeduction > 0
                      ) {
                        rows.push(
                          <TableRow key="disability">
                            <TableCell>Disability Deduction (障害者控除)</TableCell>
                            <TableCell align="right">
                              {formatJPY(results.nationalTax.disabilityDeduction)}
                            </TableCell>
                            <TableCell align="right">
                              {formatJPY(results.residenceTax.disabilityDeduction)}
                            </TableCell>
                          </TableRow>,
                        );
                      }

                      // No deductions message
                      if (rows.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={3} align="center">
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
          )}
        </>
      )}

      {/* Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          justifyContent: 'flex-end',
          mt: 2,
        }}
      >
        <Button onClick={onCancel} variant="outlined" sx={{ flex: { xs: 1, sm: '0 0 auto' } }}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!canSubmit}
          sx={{ flex: { xs: 1, sm: '0 0 auto' } }}
        >
          {isEditing ? 'Update' : 'Add'} Dependent
        </Button>
      </Box>
    </Box>
  );
};
