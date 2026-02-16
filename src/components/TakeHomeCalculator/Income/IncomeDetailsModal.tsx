// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { IncomeStream } from '../../../types/tax';
import { IncomeStreamForm } from './IncomeStreamForm';
import { formatJPY } from '../../../utils/formatters';

interface IncomeDetailsModalProps {
  open: boolean;
  onClose: () => void;
  streams: IncomeStream[];
  onStreamsChange: (streams: IncomeStream[]) => void;
}

export const IncomeDetailsModal: React.FC<IncomeDetailsModalProps> = ({
  open,
  onClose,
  streams,
  onStreamsChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [editingStream, setEditingStream] = useState<IncomeStream | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleSaveStream = (stream: IncomeStream) => {
    if (editingStream) {
      onStreamsChange(streams.map((s) => (s.id === stream.id ? stream : s)));
      setEditingStream(null);
    } else {
      onStreamsChange([...streams, stream]);
      setIsAddingNew(false);
    }
  };

  const handleDeleteStream = (id: string) => {
    onStreamsChange(streams.filter((s) => s.id !== id));
  };

  const totalIncome = streams.reduce((sum, s) => {
    // Exclude commuting allowance from total income
    if (s.type === 'commutingAllowance') return sum;

    if (s.type === 'salary' && s.frequency === 'monthly') {
      return sum + s.amount * 12;
    }
    return sum + s.amount;
  }, 0);

  const getStreamDescription = (stream: IncomeStream) => {
    switch (stream.type) {
      case 'salary':
        return stream.frequency === 'monthly' ? 'Monthly' : 'Annual';
      case 'commutingAllowance':
        if (stream.frequency === 'monthly') return 'Monthly';
        if (stream.frequency === '3-months') return '3 Months';
        if (stream.frequency === '6-months') return '6 Months';
        return 'Annual';
      case 'bonus':
        return new Date(0, stream.month).toLocaleString('default', { month: 'long' });
      default:
        return null;
    }
  };

  const getStreamColor = (type: string): 'primary' | 'secondary' | 'success' | 'warning' | 'default' => {
    switch (type) {
      case 'salary':
      case 'bonus':
      case 'commutingAllowance':
        return 'primary';
      case 'business':
        return 'success';
      case 'miscellaneous':
        return 'warning';
      default:
        return 'default';
    }
  };

  const calculateSubtotals = () => {
    let employmentIncome = 0;
    let businessIncome = 0;
    let miscellaneousIncome = 0;
    let commutingAllowance = 0;

    streams.forEach(s => {
      let annualAmount = 0;
      if (s.type === 'salary' && s.frequency === 'monthly') {
        annualAmount = s.amount * 12;
      } else {
        annualAmount = s.amount;
      }

      if (s.type === 'salary' || s.type === 'bonus') {
        employmentIncome += annualAmount;
      } else if (s.type === 'business') {
        businessIncome += annualAmount;
      } else if (s.type === 'miscellaneous') {
        miscellaneousIncome += annualAmount;
      } else if (s.type === 'commutingAllowance') {
        // Calculate annual amount based on frequency
        if (s.frequency === 'monthly') {
          commutingAllowance += s.amount * 12;
        } else if (s.frequency === '3-months') {
          commutingAllowance += s.amount * 4;
        } else if (s.frequency === '6-months') {
          commutingAllowance += s.amount * 2;
        } else {
          commutingAllowance += s.amount;
        }
      }
    });

    return { employmentIncome, businessIncome, miscellaneousIncome, commutingAllowance };
  };

  const groupStreams = () => {
    const employment = streams.filter(s => s.type === 'salary' || s.type === 'bonus' || s.type === 'commutingAllowance');
    const business = streams.filter(s => s.type === 'business');
    const miscellaneous = streams.filter(s => s.type === 'miscellaneous');

    return { employment, business, miscellaneous };
  };

  const subtotals = calculateSubtotals();
  const groupedStreams = groupStreams();

  const renderStreamGroup = (
    title: string,
    groupStreams: IncomeStream[],
    subtotal: number,
    chipColor: 'primary' | 'success' | 'warning'
  ) => {
    if (groupStreams.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, ml: 0.5 }}>
          {title}
        </Typography>
        <Stack spacing={1}>
          {groupStreams.map((stream) => (
            <Card key={stream.id} variant="outlined">
              <CardContent sx={{
                paddingX: 2,
                paddingY: { xs: 1, sm: 2 },
                '&:last-child': { pb: { xs: 1, sm: 2 } },
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={stream.type === 'commutingAllowance' ? 'COMMUTING' : stream.type.toUpperCase()}
                      size="small"
                      color={getStreamColor(stream.type)}
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                    <Typography variant="subtitle1" fontWeight="bold">
                      {formatJPY(stream.amount)}
                    </Typography>
                    {getStreamDescription(stream) && (
                      <Typography variant="body2" color="text.secondary">
                        {getStreamDescription(stream)}
                      </Typography>
                    )}
                  </Box>
                  {stream.type === 'salary' && stream.frequency === 'monthly' && (
                    <Typography variant="caption" color="text.secondary" display="block" align="right">
                      (Annual: {formatJPY(stream.amount * 12)})
                    </Typography>
                  )}
                  {stream.type === 'business' && !!stream.blueFilerDeduction && (
                    <Typography variant="caption" color="text.secondary" display="block" align="right">
                      (Blue-filer Deduction: -{formatJPY(Math.min(Math.max(0, stream.amount), stream.blueFilerDeduction))})
                    </Typography>
                  )}
                  {stream.type === 'commutingAllowance' && stream.frequency !== 'annual' && (
                    <Typography variant="caption" color="text.secondary" display="block" align="right">
                      (Annual: {formatJPY(
                        stream.frequency === 'monthly' ? stream.amount * 12 :
                          stream.frequency === '3-months' ? stream.amount * 4 :
                            stream.frequency === '6-months' ? stream.amount * 2 :
                              stream.amount
                      )})
                    </Typography>
                  )}
                </Box>
                <Box>
                  <IconButton onClick={() => setEditingStream(stream)} color="primary" size="small" aria-label="edit income">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteStream(stream.id)} color="error" size="small" aria-label="delete income">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, mr: 1 }}>
            <Chip
              label={`Subtotal: ${formatJPY(subtotal)}`}
              size="small"
              color={chipColor}
              variant="outlined"
            />
          </Box>
        </Stack>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Income/Benefit Details</Typography>
          <Chip
            label={`Total: ${formatJPY(totalIncome)}`}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {isAddingNew ? (
          <IncomeStreamForm
            onSave={handleSaveStream}
            onCancel={() => setIsAddingNew(false)}
            disabledTypes={[
              ...(streams.some(s => s.type === 'business') ? ['business'] : []),
              ...(streams.some(s => s.type === 'commutingAllowance') ? ['commutingAllowance'] : [])
            ]}
          />
        ) : editingStream ? (
          <IncomeStreamForm
            key={editingStream.id}
            initialData={editingStream}
            onSave={handleSaveStream}
            onCancel={() => setEditingStream(null)}
          />
        ) : (
          <Stack spacing={0}>
            {streams.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No income added yet.
              </Typography>
            )}

            {renderStreamGroup(
              "Employment Income (給与所得)",
              groupedStreams.employment,
              subtotals.employmentIncome,
              "primary"
            )}

            {renderStreamGroup(
              "Business Income (事業所得)",
              groupedStreams.business,
              subtotals.businessIncome,
              "success"
            )}

            {renderStreamGroup(
              "Miscellaneous Income (雑所得)",
              groupedStreams.miscellaneous,
              subtotals.miscellaneousIncome,
              "warning"
            )}

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setIsAddingNew(true)}
              fullWidth
              sx={{
                borderStyle: 'dashed',
                borderColor: 'divider',
                py: 1.5,
                color: 'text.secondary',
                mt: 2
              }}
            >
              Add Income/Benefit
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
        py: 2,
        pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : 2,
        position: isMobile ? 'sticky' : 'relative',
        bottom: 0,
        zIndex: 1,
        backgroundColor: 'background.paper',
      }}>
        {!(isAddingNew || editingStream) && (
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
