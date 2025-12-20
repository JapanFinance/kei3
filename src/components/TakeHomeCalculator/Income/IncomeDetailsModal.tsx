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
    if (s.type === 'salary' && s.frequency === 'monthly') {
      return sum + s.amount * 12;
    }
    return sum + s.amount;
  }, 0);

  const getStreamLabel = (stream: IncomeStream) => {
    if (stream.type === 'salary') {
      return `Salary (${stream.frequency})`;
    } else if (stream.type === 'bonus') {
      return `Bonus (${new Date(0, stream.month).toLocaleString('default', { month: 'long' })})`;
    } else {
      return 'Business Income';
    }
  };

  const getStreamColor = (type: string): 'primary' | 'secondary' | 'success' | 'default' => {
    switch (type) {
      case 'salary': return 'primary';
      case 'bonus': return 'secondary';
      case 'business': return 'success';
      default: return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Income Details</Typography>
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
          />
        ) : editingStream ? (
          <IncomeStreamForm
            key={editingStream.id}
            initialData={editingStream}
            onSave={handleSaveStream}
            onCancel={() => setEditingStream(null)}
          />
        ) : (
          <Stack spacing={2}>
            {streams.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No income streams added yet.
              </Typography>
            )}
            
            {streams.map((stream) => (
              <Card key={stream.id} variant="outlined">
                <CardContent sx={{ 
                  p: 2, 
                  '&:last-child': { pb: 2 },
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip 
                        label={stream.type.toUpperCase()} 
                        size="small" 
                        color={getStreamColor(stream.type)}
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                      <Typography variant="subtitle1" fontWeight="medium">
                        {getStreamLabel(stream)}
                      </Typography>
                    </Box>
                    <Typography variant="h6" color="text.primary">
                      {formatJPY(stream.amount)}
                    </Typography>
                  </Box>
                  <Box>
                    <IconButton onClick={() => setEditingStream(stream)} color="primary" size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDeleteStream(stream.id)} color="error" size="small">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
            
            <Button 
              variant="outlined" 
              startIcon={<AddIcon />} 
              onClick={() => setIsAddingNew(true)}
              fullWidth
              sx={{ 
                borderStyle: 'dashed', 
                borderColor: 'divider',
                py: 1.5,
                color: 'text.secondary'
              }}
            >
              Add Income Stream
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
