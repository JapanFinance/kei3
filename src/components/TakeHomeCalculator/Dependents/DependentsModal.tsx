// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useState } from 'react';

import { NATIONAL_HEALTH_INSURANCE_REGION_OPTIONS } from '../../../data/nationalHealthInsurance/nhiParamsData';
import type {
  Dependent,
  DependentDeductionBreakdown,
  OtherDependent,
  Spouse,
} from '../../../types/dependents';
import { RELATIONSHIPS, DEPENDENT_AGE_RANGES, DEDUCTION_TYPES } from '../../../types/dependents';
import {
  NATIONAL_HEALTH_INSURANCE_ID,
  type HealthInsuranceProviderId,
  type NHIPaymentAttribution,
} from '../../../types/healthInsurance';
import {
  calculateDependentDeductions,
  calculateDependentTotalNetIncome,
} from '../../../utils/dependentDeductions';
import { formatJPY } from '../../../utils/formatters';
import { resolveDependentNHIEnrollment } from '../../../utils/nhiHousehold';
import SourceLinks from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';
import { DependentForm } from './DependentForm';
import SpouseSection from './SpouseSection';

interface DependentsModalProps {
  open: boolean;
  onClose: () => void;
  dependents: Dependent[];
  onDependentsChange: (dependents: Dependent[]) => void;
  taxpayerNetIncome: number;
  /** Income year used for the dependent-deduction eligibility/threshold lookup. */
  incomeYear: number;
  /** Taxpayer's current health insurance provider */
  healthInsuranceProvider?: HealthInsuranceProviderId | undefined;
  /** NHI payment attribution setting */
  nhiPaymentAttribution?: NHIPaymentAttribution | undefined;
  onNHIPaymentAttributionChange?: ((attribution: NHIPaymentAttribution) => void) | undefined;
  /** NHI household region setting */
  nhiHouseholdRegion?: string | undefined;
  onNHIHouseholdRegionChange?: ((region: string) => void) | undefined;
}

/**
 * Modal dialog for managing dependents
 * Provides a full interface for adding, editing, and removing dependents
 */
export const DependentsModal: React.FC<DependentsModalProps> = ({
  open,
  onClose,
  dependents,
  onDependentsChange,
  taxpayerNetIncome,
  incomeYear,
  healthInsuranceProvider,
  nhiPaymentAttribution = 'fullHousehold',
  onNHIPaymentAttributionChange,
  nhiHouseholdRegion = 'Tokyo',
  onNHIHouseholdRegionChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [editingDependent, setEditingDependent] = useState<OtherDependent | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Separate spouse from other dependents
  const spouse = dependents.find(d => d.relationship === 'spouse');
  const otherDependents = dependents.filter(d => d.relationship !== 'spouse');

  const isTaxpayerNHI = healthInsuranceProvider === NATIONAL_HEALTH_INSURANCE_ID;

  const hasNHIMembers =
    isTaxpayerNHI ||
    Boolean(
      spouse &&
      spouse.isCohabiting &&
      spouse.ageRange !== '75plus' &&
      resolveDependentNHIEnrollment(spouse, isTaxpayerNHI),
    ) ||
    otherDependents.some(
      d =>
        d.isCohabiting &&
        d.ageRange !== '75plus' &&
        resolveDependentNHIEnrollment(d, isTaxpayerNHI),
    );

  const handleSpouseChange = (newSpouse: Spouse | null) => {
    const nonSpouseDependents = dependents.filter(d => d.relationship !== 'spouse');
    if (newSpouse) {
      onDependentsChange([newSpouse, ...nonSpouseDependents]);
    } else {
      onDependentsChange(nonSpouseDependents);
    }
  };

  const handleAddDependent = (dependent: OtherDependent) => {
    onDependentsChange([...dependents, dependent]);
    setIsAddingNew(false);
  };

  const handleUpdateDependent = (updatedDependent: OtherDependent) => {
    onDependentsChange(dependents.map(d => (d.id === updatedDependent.id ? updatedDependent : d)));
    setEditingDependent(null);
  };

  const handleDeleteDependent = (id: string) => {
    onDependentsChange(dependents.filter(d => d.id !== id));
  };

  const handleStartEdit = (dependent: OtherDependent) => {
    setEditingDependent(dependent);
    setIsAddingNew(false);
  };

  const handleStartAdd = () => {
    setIsAddingNew(true);
    setEditingDependent(null);
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingDependent(null);
  };

  const getDependentSummary = (dependent: OtherDependent): string => {
    const relationship =
      RELATIONSHIPS.find(r => r.value === dependent.relationship)?.label ?? 'Unknown';
    const ageLabel =
      DEPENDENT_AGE_RANGES.find(a => a.value === dependent.ageRange)?.label ?? 'Unknown';
    const totalNetIncome = calculateDependentTotalNetIncome(dependent, incomeYear);
    const incomeLabel =
      totalNetIncome === 0 ? 'No income' : `Net income: ${formatJPY(totalNetIncome)}`;
    return `${relationship}, Age: ${ageLabel}, ${incomeLabel}`;
  };

  const getDependentChips = (dependent: OtherDependent): React.ReactNode[] => {
    const chips: React.ReactNode[] = [];

    if (dependent.isClaimedAsDependent === false) {
      chips.push(
        <Chip key="not-tax-dep" label="Not tax dependent" size="small" variant="outlined" />,
      );
    }

    if (dependent.disability !== 'none') {
      // Names the 障害者控除 bracket claimed, matching DISABILITY_LEVELS, rather than labelling
      // the dependent; the chip drops the Japanese term the dropdown carries, for width.
      let disabilityLabel =
        dependent.disability === 'regular' ? 'General disability' : 'Special disability';
      // Add cohabiting info to special disability chip
      if (dependent.disability === 'special' && dependent.isCohabiting) {
        disabilityLabel += ' (Cohabiting)';
      }

      chips.push(<Chip key="disability" label={disabilityLabel} size="small" color="secondary" />);
    }

    // Only show separate cohabiting chip if not special disability
    // (to avoid redundancy since special disability chip already shows it)
    if (dependent.isCohabiting && dependent.disability !== 'special') {
      chips.push(<Chip key="cohabiting" label="Cohabiting" size="small" variant="outlined" />);
    }

    if (dependent.ageRange === '75plus') {
      chips.push(
        <Chip key="elderly" label="75+ Elderly Medical" size="small" variant="outlined" />,
      );
    } else if (dependent.isCohabiting) {
      const isNHI = resolveDependentNHIEnrollment(dependent, isTaxpayerNHI);
      if (isNHI) {
        chips.push(
          <Chip key="insurance" label="NHI" size="small" color="primary" variant="outlined" />,
        );
      } else {
        chips.push(
          <Chip key="insurance" label="Other Insurance" size="small" variant="outlined" />,
        );
      }
    }

    if (dependent.isHouseholdHead) {
      chips.push(<Chip key="head" label="Household Head" size="small" color="info" />);
    }

    return chips;
  };

  const showingForm = isAddingNew || editingDependent !== null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            minHeight: isMobile ? '100dvh' : '500px',
            maxHeight: isMobile ? '100dvh' : '90vh',
            // Fallback for browsers that don't support dvh
            '@supports not (height: 100dvh)': {
              minHeight: isMobile ? '100vh' : '500px',
              maxHeight: isMobile ? '100vh' : '90vh',
            },
          },
        },
      }}
      sx={{
        // Ensure modal respects safe areas on iOS
        '& .MuiDialog-container': {
          paddingTop: isMobile ? 'env(safe-area-inset-top)' : 0,
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          // Add safe area padding for iOS notch
          pt: isMobile ? 'max(16px, env(safe-area-inset-top))' : 2,
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
          position: isMobile ? 'sticky' : 'relative',
          top: 0,
          zIndex: 1,
          backgroundColor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon />
          <Typography variant="h6" component="span">
            Manage Dependents & Household
          </Typography>
        </Box>
        <IconButton edge="end" onClick={onClose} aria-label="close" size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent
        sx={{
          p: { xs: 2, sm: 3 },
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
        }}
      >
        {showingForm ? (
          <DependentForm
            dependent={editingDependent}
            onSave={editingDependent ? handleUpdateDependent : handleAddDependent}
            onCancel={handleCancelForm}
            incomeYear={incomeYear}
          />
        ) : (
          <Box>
            {/* Livelihood / Shared Expenses Disclaimer */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Only add persons with whom you share living expenses (生計を一にする).
              </Typography>
              <DetailedTooltip title="Sharing Living Expenses (生計を一にする)">
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Under Japanese tax law, claiming spousal or dependent deductions
                  (配偶者控除・扶養控除) strictly requires sharing living expenses (生計を一にする).
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Family members living together are presumed to share expenses. Family members
                  living apart (e.g. for work relocation 単身赴任, university, or medical
                  convalescence) fully qualify as long as living, educational, or medical funds are
                  regularly remitted.
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Independent housemates or roommates with separate finances do not share living
                  expenses and should not be added.
                </Typography>
                <SourceLinks
                  sources={[
                    {
                      href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180_qa.htm',
                      label: 'NTA: Meaning of Sharing Livelihood (国税庁:「生計を一にする」の意義)',
                    },
                  ]}
                />
              </DetailedTooltip>
            </Box>

            {/* Spouse Section */}
            <SpouseSection
              spouse={spouse || null}
              onChange={handleSpouseChange}
              incomeYear={incomeYear}
            />

            <Divider sx={{ my: 3 }} />

            {/* Other Household Members & Dependents Section */}
            <Typography variant="h6" gutterBottom>
              Other Household Members & Dependents
            </Typography>

            {/* List of other dependents */}
            {otherDependents.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  color: 'text.secondary',
                }}
              >
                <PersonIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">No other members added yet</Typography>
              </Box>
            ) : (
              <List sx={{ width: '100%' }}>
                {otherDependents.map((dependent, index) => (
                  <React.Fragment key={dependent.id}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem
                      secondaryAction={
                        <>
                          <IconButton
                            edge="end"
                            aria-label="edit"
                            onClick={() => handleStartEdit(dependent)}
                            size="small"
                            sx={{ mr: 0.5 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            edge="end"
                            aria-label="delete"
                            onClick={() => handleDeleteDependent(dependent.id)}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      }
                      sx={{
                        py: 2,
                        px: { xs: 1, sm: 2 },
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 0.5,
                            }}
                          >
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                              Dependent {index + 1}
                            </Typography>
                            {getDependentChips(dependent)}
                          </Box>
                        }
                        secondary={getDependentSummary(dependent)}
                        slotProps={{
                          secondary: {
                            sx: { mt: 0.5 },
                          },
                        }}
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}

            {/* Add button */}
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleStartAdd}
                size="large"
                fullWidth={isMobile}
              >
                Add Other Person
              </Button>
            </Box>

            {/* Household National Health Insurance Section */}
            {hasNHIMembers && (
              <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Household National Health Insurance (国民健康保険)
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'background.default' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    {isTaxpayerNHI
                      ? 'National Health Insurance is assessed at the household level on the combined income and per-capita counts of all enrolled members.'
                      : 'Cohabiting household member(s) are enrolled in National Health Insurance under the municipal household.'}
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="nhi-modal-attribution-label">
                        Payment Attribution & Deduction
                      </InputLabel>
                      <Select
                        labelId="nhi-modal-attribution-label"
                        label="Payment Attribution & Deduction"
                        value={nhiPaymentAttribution}
                        onChange={e =>
                          onNHIPaymentAttributionChange?.(e.target.value as NHIPaymentAttribution)
                        }
                      >
                        <MenuItem value="fullHousehold">
                          Taxpayer pays full household NHI (full social insurance deduction)
                        </MenuItem>
                        <MenuItem value="taxpayerShare">
                          {isTaxpayerNHI
                            ? 'Taxpayer pays their own share only (taxpayer NHI share deducted)'
                            : 'Taxpayer pays pro-rata share (deduct pro-rata portion)'}
                        </MenuItem>
                        <MenuItem value="none">
                          Paid separately / not by taxpayer (no tax deduction for taxpayer)
                        </MenuItem>
                      </Select>
                      <FormHelperText>
                        Under Japanese tax law, when the taxpayer pays NHI premiums for cohabiting
                        family members, the full paid amount qualifies for the social insurance
                        deduction (社会保険料控除).
                      </FormHelperText>
                    </FormControl>

                    {!isTaxpayerNHI && (
                      <FormControl fullWidth size="small">
                        <InputLabel id="nhi-modal-region-label">
                          Household NHI Municipality / Region
                        </InputLabel>
                        <Select
                          labelId="nhi-modal-region-label"
                          label="Household NHI Municipality / Region"
                          value={nhiHouseholdRegion}
                          onChange={e => onNHIHouseholdRegionChange?.(e.target.value)}
                        >
                          {NATIONAL_HEALTH_INSURANCE_REGION_OPTIONS.map(opt => (
                            <MenuItem key={opt.id} value={opt.id}>
                              {opt.displayName}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          Since you are on employment or other insurance, select the municipality
                          where your cohabiting family members' NHI is registered.
                        </FormHelperText>
                      </FormControl>
                    )}
                  </Box>
                </Paper>
              </Box>
            )}

            {/* Deduction Summary */}
            {(spouse || otherDependents.length > 0) && (
              <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Total Deductions Summary
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ border: { xs: 'none', sm: '1px solid' }, borderColor: { sm: 'divider' } }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Deduction Type</TableCell>
                        <TableCell align="center">Count</TableCell>
                        <TableCell align="right">Income Tax</TableCell>
                        <TableCell align="right">Residence Tax</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const allDependents: Dependent[] = [
                          ...(spouse ? [spouse] : []),
                          ...otherDependents,
                        ];

                        if (allDependents.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={4} align="center">
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                  No dependents added
                                </Typography>
                              </TableCell>
                            </TableRow>
                          );
                        }

                        const deductionResults = calculateDependentDeductions(
                          allDependents,
                          incomeYear,
                          taxpayerNetIncome,
                        );

                        // Group deductions by type and amount
                        interface DeductionGroup {
                          type: string;
                          natAmount: number;
                          resAmount: number;
                          count: number;
                        }

                        const deductionMap = new Map<string, DeductionGroup>();

                        // Process each breakdown
                        deductionResults.breakdown.forEach(
                          (breakdown: DependentDeductionBreakdown) => {
                            // Skip if not eligible
                            if (breakdown.deductionType === DEDUCTION_TYPES.NOT_ELIGIBLE) {
                              return;
                            }

                            const key = `${breakdown.deductionType}-${breakdown.nationalTaxAmount}-${breakdown.residenceTaxAmount}`;
                            const existing = deductionMap.get(key);

                            if (existing) {
                              existing.count++;
                            } else {
                              deductionMap.set(key, {
                                type: breakdown.deductionType,
                                natAmount: breakdown.nationalTaxAmount,
                                resAmount: breakdown.residenceTaxAmount,
                                count: 1,
                              });
                            }
                          },
                        );

                        // Convert to array and sort
                        const deductionGroups = Array.from(deductionMap.values()).sort((a, b) => {
                          // Sort by total amount descending
                          return b.natAmount + b.resAmount - (a.natAmount + a.resAmount);
                        });

                        const rows: React.ReactNode[] = [];
                        let totalNat = 0;
                        let totalRes = 0;

                        // Add row for each deduction group
                        deductionGroups.forEach((group, index) => {
                          totalNat += group.natAmount * group.count;
                          totalRes += group.resAmount * group.count;

                          rows.push(
                            <TableRow key={`deduction-${index}`}>
                              <TableCell>{group.type}</TableCell>
                              <TableCell align="center">{group.count}</TableCell>
                              <TableCell align="right">
                                {formatJPY(group.natAmount)}
                                {group.count > 1 && (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'text.secondary', display: 'block' }}
                                  >
                                    = {formatJPY(group.natAmount * group.count)}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {formatJPY(group.resAmount)}
                                {group.count > 1 && (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'text.secondary', display: 'block' }}
                                  >
                                    = {formatJPY(group.resAmount * group.count)}
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>,
                          );
                        });

                        // Add total row
                        rows.push(
                          <TableRow
                            key="total"
                            sx={{ backgroundColor: 'action.hover', fontWeight: 'bold' }}
                          >
                            <TableCell colSpan={2}>
                              <strong>Total</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>{formatJPY(totalNat)}</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>{formatJPY(totalRes)}</strong>
                            </TableCell>
                          </TableRow>,
                        );

                        return rows;
                      })()}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions
        sx={{
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
          py: 2,
          pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : 2,
          position: isMobile ? 'sticky' : 'relative',
          bottom: 0,
          zIndex: 1,
          backgroundColor: 'background.paper',
        }}
      >
        {!showingForm && (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary', mr: 'auto', ml: 1 }}>
              {spouse ? '1 spouse, ' : ''}
              {otherDependents.length} other dependent{otherDependents.length !== 1 ? 's' : ''}
            </Typography>
            <Button onClick={onClose} variant="contained">
              Close
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
