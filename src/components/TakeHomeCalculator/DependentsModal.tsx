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
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { Dependent, OtherDependent, Spouse } from '../../types/dependents';
import { INCOME_LEVELS, RELATIONSHIPS, DEPENDENT_AGE_CATEGORIES } from '../../types/dependents';
import { DependentForm } from './DependentForm';
import SpouseSection from './SpouseSection';

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
    const incomeLabel = INCOME_LEVELS.find(l => l.value === dependent.incomeLevel)?.label || 'Unknown';
    return `${relationship}, Age: ${ageLabel}, Income: ${incomeLabel}`;
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
          sx={{ mr: 0.5, mt: 0.5 }}
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
          sx={{ mr: 0.5, mt: 0.5 }}
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
      PaperProps={{
        sx: {
          minHeight: isMobile ? '100vh' : '500px',
          maxHeight: isMobile ? '100vh' : '90vh',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1,
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

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {showingForm ? (
          <DependentForm
            dependent={editingDependent}
            onSave={editingDependent ? handleUpdateDependent : handleAddDependent}
            onCancel={handleCancelForm}
          />
        ) : (
          <Box>
            {/* Info box explaining dependents */}
            <Box 
              sx={{ 
                mb: 3, 
                p: 2, 
                bgcolor: 'action.hover', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>About Dependent Deductions:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add your spouse and dependents to calculate applicable tax deductions. 
                Japanese tax law provides various deductions based on relationship, age, 
                income level, and disability status. The calculator will automatically 
                determine which deductions apply.
              </Typography>
            </Box>

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
                      sx={{
                        py: 2,
                        px: { xs: 1, sm: 2 },
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1, minWidth: 0, mr: 2 }}>
                          <ListItemText
                            primary={
                              <Typography variant="subtitle1" fontWeight={500}>
                                Dependent {index + 1}
                              </Typography>
                            }
                            secondary={getDependentSummary(dependent)}
                            secondaryTypographyProps={{
                              sx: { mt: 0.5 }
                            }}
                          />
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', mt: 0.5 }}>
                            {getDependentChips(dependent)}
                          </Box>
                        </Box>
                        <ListItemSecondaryAction sx={{ position: 'relative', transform: 'none', top: 'auto', right: 'auto' }}>
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
                        </ListItemSecondaryAction>
                      </Box>
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
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
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
