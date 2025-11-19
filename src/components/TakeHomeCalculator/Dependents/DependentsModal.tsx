import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { Dependent, OtherDependent, Spouse } from '../../../types/dependents';
import { RELATIONSHIPS, DEPENDENT_AGE_CATEGORIES, calculateDependentTotalNetIncome } from '../../../types/dependents';
import { DependentForm } from './DependentForm';
import SpouseSection from './SpouseSection';
import { formatJPY } from '../../../utils/formatters';
import { calculateDependentDeductions, getDisabilityDeduction, type DependentDeductionBreakdown } from '../../../utils/dependentDeductions';

interface DependentsModalProps {
  open: boolean;
  onClose: () => void;
  dependents: Dependent[];
  onDependentsChange: (dependents: Dependent[]) => void;
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
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [editingDependent, setEditingDependent] = useState<OtherDependent | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Separate spouse from other dependents
  const spouse = dependents.find(d => d.relationship === 'spouse') as Spouse | undefined;
  const otherDependents = dependents.filter(d => d.relationship !== 'spouse') as OtherDependent[];

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
    onDependentsChange(
      dependents.map(d => d.id === updatedDependent.id ? updatedDependent : d)
    );
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
    const relationship = RELATIONSHIPS.find(r => r.value === dependent.relationship)?.label || 'Unknown';
    const ageLabel = DEPENDENT_AGE_CATEGORIES.find(a => a.value === dependent.ageCategory)?.label || 'Unknown';
    const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
    const incomeLabel = totalNetIncome === 0 ? 'No income' : `Net income: ¥${totalNetIncome.toLocaleString()}`;
    return `${relationship}, Age: ${ageLabel}, ${incomeLabel}`;
  };

  const getDependentChips = (dependent: OtherDependent): React.ReactNode[] => {
    const chips: React.ReactNode[] = [];
    
    if (dependent.disability !== 'none') {
      let disabilityLabel = dependent.disability === 'regular' ? 'Disabled' : 'Special Disability';
      // Add cohabiting info to special disability chip
      if (dependent.disability === 'special' && dependent.isCohabiting) {
        disabilityLabel += ' (Cohabiting)';
      }
      
      chips.push(
        <Chip 
          key="disability" 
          label={disabilityLabel}
          size="small" 
          color="secondary"
        />
      );
    }
    
    // Only show separate cohabiting chip if not special disability
    // (to avoid redundancy since special disability chip already shows it)
    if (dependent.isCohabiting && dependent.disability !== 'special') {
      chips.push(
        <Chip 
          key="cohabiting" 
          label="Cohabiting" 
          size="small" 
          variant="outlined"
        />
      );
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
          }
        }
      }}
      sx={{
        // Ensure modal respects safe areas on iOS
        '& .MuiDialog-container': {
          paddingTop: isMobile ? 'env(safe-area-inset-top)' : 0,
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0,
        }
      }}
    >
      <DialogTitle sx={{ 
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
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon />
          <Typography variant="h6" component="span">
            Manage Dependents
          </Typography>
        </Box>
        <IconButton
          edge="end"
          onClick={onClose}
          aria-label="close"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ 
        p: { xs: 2, sm: 3 },
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
      }}>
        {showingForm ? (
          <DependentForm
            dependent={editingDependent}
            onSave={editingDependent ? handleUpdateDependent : handleAddDependent}
            onCancel={handleCancelForm}
          />
        ) : (
          <Box>

            {/* Spouse Section */}
            <SpouseSection 
              spouse={spouse || null}
              onChange={handleSpouseChange}
            />

            <Divider sx={{ my: 3 }} />

            {/* Other Dependents Section */}
            <Typography variant="h6" gutterBottom>
              Other Dependents
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
                <Typography variant="body2">
                  No other dependents added yet
                </Typography>
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
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                            <Typography variant="subtitle1" fontWeight={500}>
                              Dependent {index + 1}
                            </Typography>
                            {getDependentChips(dependent)}
                          </Box>
                        }
                        secondary={getDependentSummary(dependent)}
                        slotProps={{
                          secondary: {
                            sx: { mt: 0.5 }
                          }
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
                Add Other Dependent
              </Button>
            </Box>

            {/* Deduction Summary */}
            {(spouse || otherDependents.length > 0) && (
              <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Total Deductions Summary
                </Typography>
                <Paper variant="outlined" sx={{ border: { xs: 'none', sm: '1px solid' }, borderColor: { sm: 'divider' } }}>
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
                        const allDependents: Dependent[] = [...(spouse ? [spouse] : []), ...otherDependents];
                        
                        if (allDependents.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={4} align="center">
                                <Typography variant="body2" color="text.secondary">
                                  No dependents added
                                </Typography>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        const deductionResults = calculateDependentDeductions(allDependents);
                        
                        // Group deductions by type and amount
                        interface DeductionGroup {
                          type: string;
                          natAmount: number;
                          resAmount: number;
                          count: number;
                        }
                        
                        const deductionMap = new Map<string, DeductionGroup>();
                        
                        // Process each breakdown - split combined deductions into separate entries
                        deductionResults.breakdown.forEach((breakdown: DependentDeductionBreakdown) => {
                          const dep = breakdown.dependent;
                          
                          // Handle main deduction type (spouse, dependent, etc.)
                          if (breakdown.deductionType && breakdown.deductionType !== 'Not Eligible') {
                            // Calculate amounts for main deduction and disability separately
                            let mainNatAmount = 0;
                            let mainResAmount = 0;
                            let disabilityNatAmount = 0;
                            let disabilityResAmount = 0;
                            
                            // Calculate disability deduction if applicable
                            if (dep.disability !== 'none') {
                              disabilityNatAmount = getDisabilityDeduction(dep.disability, dep.isCohabiting, false);
                              disabilityResAmount = getDisabilityDeduction(dep.disability, dep.isCohabiting, true);
                            }
                            
                            // Main deduction is the total minus disability
                            mainNatAmount = breakdown.nationalTaxAmount - disabilityNatAmount;
                            mainResAmount = breakdown.residenceTaxAmount - disabilityResAmount;
                            
                            // Add main deduction if non-zero
                            if (mainNatAmount > 0 || mainResAmount > 0) {
                              const key = `${breakdown.deductionType}-${mainNatAmount}-${mainResAmount}`;
                              const existing = deductionMap.get(key);
                              
                              if (existing) {
                                existing.count++;
                              } else {
                                deductionMap.set(key, {
                                  type: breakdown.deductionType,
                                  natAmount: mainNatAmount,
                                  resAmount: mainResAmount,
                                  count: 1,
                                });
                              }
                            }
                            
                            // Add disability deduction separately if applicable
                            if (dep.disability !== 'none') {
                              let disabilityType = 'Disability';
                              if (dep.disability === 'special' && dep.isCohabiting) {
                                disabilityType = 'Special Disability (Cohabiting)';
                              } else if (dep.disability === 'special') {
                                disabilityType = 'Special Disability';
                              } else if (dep.disability === 'regular') {
                                disabilityType = 'Regular Disability';
                              }
                              
                              const disKey = `${disabilityType}-${disabilityNatAmount}-${disabilityResAmount}`;
                              const existingDis = deductionMap.get(disKey);
                              
                              if (existingDis) {
                                existingDis.count++;
                              } else {
                                deductionMap.set(disKey, {
                                  type: disabilityType,
                                  natAmount: disabilityNatAmount,
                                  resAmount: disabilityResAmount,
                                  count: 1,
                                });
                              }
                            }
                          } else if (dep.disability !== 'none') {
                            // Only disability deduction, no other deduction
                            const disabilityNatAmount = getDisabilityDeduction(dep.disability, dep.isCohabiting, false);
                            const disabilityResAmount = getDisabilityDeduction(dep.disability, dep.isCohabiting, true);
                            
                            let disabilityType = 'Disability';
                            if (dep.disability === 'special' && dep.isCohabiting) {
                              disabilityType = 'Special Disability (Cohabiting)';
                            } else if (dep.disability === 'special') {
                              disabilityType = 'Special Disability';
                            } else if (dep.disability === 'regular') {
                              disabilityType = 'Regular Disability';
                            }
                            
                            const disKey = `${disabilityType}-${disabilityNatAmount}-${disabilityResAmount}`;
                            const existingDis = deductionMap.get(disKey);
                            
                            if (existingDis) {
                              existingDis.count++;
                            } else {
                              deductionMap.set(disKey, {
                                type: disabilityType,
                                natAmount: disabilityNatAmount,
                                resAmount: disabilityResAmount,
                                count: 1,
                              });
                            }
                          }
                        });
                        
                        // Convert to array and sort
                        const deductionGroups = Array.from(deductionMap.values()).sort((a, b) => {
                          // Sort by total amount descending
                          return (b.natAmount + b.resAmount) - (a.natAmount + a.resAmount);
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
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    = {formatJPY(group.natAmount * group.count)}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {formatJPY(group.resAmount)}
                                {group.count > 1 && (
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    = {formatJPY(group.resAmount * group.count)}
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        });
                        
                        // Add total row
                        rows.push(
                          <TableRow key="total" sx={{ backgroundColor: 'action.hover', fontWeight: 'bold' }}>
                            <TableCell colSpan={2}><strong>Total</strong></TableCell>
                            <TableCell align="right"><strong>{formatJPY(totalNat)}</strong></TableCell>
                            <TableCell align="right"><strong>{formatJPY(totalRes)}</strong></TableCell>
                          </TableRow>
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

      <DialogActions sx={{ 
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
        py: 2,
        pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : 2,
        position: isMobile ? 'sticky' : 'relative',
        bottom: 0,
        zIndex: 1,
        backgroundColor: 'background.paper',
      }}>
        {!showingForm && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto', ml: 1 }}>
              {spouse ? '1 spouse, ' : ''}{otherDependents.length} other dependent{otherDependents.length !== 1 ? 's' : ''}
            </Typography>
            <Button onClick={onClose} variant="contained">
              Done
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
