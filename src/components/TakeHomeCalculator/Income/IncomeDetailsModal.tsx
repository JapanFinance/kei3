// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useState } from 'react';

import {
  isInvestmentIncomeStream,
  type IncomeStream,
  type IncomeStreamType,
  type TakeHomeResults,
} from '../../../types/tax';
import {
  formatJPY,
  formatMonthLong,
  getCommutingAllowanceAnnualAmount,
} from '../../../utils/formatters';
import {
  INCOME_CATEGORIES,
  INCOME_STREAM_CATALOG,
  type IncomeCategory,
  type IncomeCategoryKey,
} from './incomeStreamCatalog';
import { IncomeStreamForm } from './IncomeStreamForm';
import { IncomeStreamTypeChooser } from './IncomeStreamTypeChooser';

interface IncomeDetailsModalProps {
  open: boolean;
  onClose: () => void;
  streams: IncomeStream[];
  onStreamsChange: (streams: IncomeStream[]) => void;
  /**
   * Net public pension income (公的年金等に係る雑所得) for {@link streams}, so the group can show
   * what the 公的年金等控除 takes off the gross. Depends on the taxpayer's age and other income as
   * well as the pension streams, so it is computed by the caller rather than derived here. When
   * omitted, the group shows only its gross subtotal.
   */
  netPublicPensionIncome?: number | undefined;
  /**
   * Investment income for {@link streams} — gross amounts and tax withheld at source — so the
   * group can show what 申告不要 withholding takes off the gross. Computed by the caller from
   * {@link TakeHomeResults.investmentIncome} rather than derived here, matching
   * {@link netPublicPensionIncome}. Absent when every investment-income amount is 0.
   */
  investmentIncome?: TakeHomeResults['investmentIncome'];
}

type ModalView =
  | { kind: 'list' }
  | { kind: 'choose' }
  | { kind: 'add'; type: IncomeStreamType }
  | { kind: 'edit'; stream: IncomeStream };

export const IncomeDetailsModal: React.FC<IncomeDetailsModalProps> = ({
  open,
  onClose,
  streams,
  onStreamsChange,
  netPublicPensionIncome,
  investmentIncome,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [view, setView] = useState<ModalView>({ kind: 'list' });
  const showList = () => setView({ kind: 'list' });

  const handleSaveStream = (stream: IncomeStream) => {
    if (view.kind === 'edit') {
      onStreamsChange(streams.map(s => (s.id === stream.id ? stream : s)));
    } else {
      onStreamsChange([...streams, stream]);
    }
    showList();
  };

  const handleClose = () => {
    showList();
    onClose();
  };

  const handleDeleteStream = (id: string) => {
    onStreamsChange(streams.filter(s => s.id !== id));
  };

  const totalIncome = streams.reduce((sum, s) => {
    // Exclude commuting allowance and investment income (taxed separately) from total income
    if (s.type === 'commutingAllowance' || isInvestmentIncomeStream(s)) return sum;

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
        return formatMonthLong(stream.month);
      case 'stockCompensation':
        return stream.issuerDomicile === 'foreign' ? 'Foreign' : 'Domestic';
      default:
        return null;
    }
  };

  // Commuting allowance sits in the employment group but is a nontaxable benefit, so it is
  // tracked separately rather than added to that group's subtotal.
  const calculateSubtotals = () => {
    const byCategory: Record<IncomeCategoryKey, number> = {
      employment: 0,
      business: 0,
      miscellaneous: 0,
      publicPension: 0,
      investment: 0,
    };
    let commutingAllowance = 0;

    streams.forEach(s => {
      if (s.type === 'commutingAllowance') {
        commutingAllowance += getCommutingAllowanceAnnualAmount(s);
        return;
      }
      const annualAmount =
        s.type === 'salary' && s.frequency === 'monthly' ? s.amount * 12 : s.amount;
      byCategory[INCOME_STREAM_CATALOG[s.type].category] += annualAmount;
    });

    return { byCategory, commutingAllowance };
  };

  const subtotals = calculateSubtotals();
  const streamsInCategory = (category: IncomeCategoryKey) =>
    streams.filter(s => INCOME_STREAM_CATALOG[s.type].category === category);

  // The 公的年金等控除 applies to the combined gross of every pension stream, so it belongs on the
  // group subtotal rather than on any one entry.
  const publicPensionSubtotalFooter =
    netPublicPensionIncome === undefined ? null : (
      <>
        <Typography variant="caption" color="text.secondary">
          Public Pension Deduction (公的年金等控除): -
          {formatJPY(subtotals.byCategory.publicPension - netPublicPensionIncome)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Net Public Pension Income: {formatJPY(netPublicPensionIncome)}
        </Typography>
      </>
    );

  // Withheld at source under 申告不要 (源泉徴収あり特定口座) — see calculateWithheldInvestmentTax.
  const investmentSubtotalFooter =
    investmentIncome === undefined ? null : (
      <>
        <Typography variant="caption" color="text.secondary">
          Withheld at Source (源泉徴収): -{formatJPY(investmentIncome.withheld.total)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Net Investment Income:{' '}
          {formatJPY(investmentIncome.grossTotal - investmentIncome.withheld.total)}
        </Typography>
      </>
    );

  const subtotalFooters: Partial<Record<IncomeCategoryKey, React.ReactNode>> = {
    publicPension: publicPensionSubtotalFooter,
    investment: investmentSubtotalFooter,
  };

  const renderStreamGroup = (category: IncomeCategory) => {
    const groupStreams = streamsInCategory(category.key);
    if (groupStreams.length === 0) return null;

    return (
      <Box key={category.key} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, ml: 0.5 }}>
          {category.heading}
        </Typography>
        <Stack spacing={1}>
          {groupStreams.map(stream => (
            <Card key={stream.id} variant="outlined">
              <CardContent
                sx={{
                  paddingX: 2,
                  paddingY: { xs: 1, sm: 2 },
                  '&:last-child': { pb: { xs: 1, sm: 2 } },
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={INCOME_STREAM_CATALOG[stream.type].chipLabel}
                      size="small"
                      color={category.chipColor}
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {formatJPY(stream.amount)}
                    </Typography>
                    {getStreamDescription(stream) && (
                      <Typography variant="body2" color="text.secondary">
                        {getStreamDescription(stream)}
                      </Typography>
                    )}
                  </Box>
                  {stream.type === 'salary' && stream.frequency === 'monthly' && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      align="right"
                      sx={{ display: 'block' }}
                    >
                      (Annual: {formatJPY(stream.amount * 12)})
                    </Typography>
                  )}
                  {stream.type === 'business' && !!stream.blueFilerDeduction && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      align="right"
                      sx={{ display: 'block' }}
                    >
                      (Blue-filer Deduction: -
                      {formatJPY(Math.min(Math.max(0, stream.amount), stream.blueFilerDeduction))})
                    </Typography>
                  )}
                  {stream.type === 'commutingAllowance' && stream.frequency !== 'annual' && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      align="right"
                      sx={{ display: 'block' }}
                    >
                      (Annual: {formatJPY(getCommutingAllowanceAnnualAmount(stream))})
                    </Typography>
                  )}
                </Box>
                <Box>
                  <IconButton
                    onClick={() => setView({ kind: 'edit', stream })}
                    color="primary"
                    size="small"
                    aria-label="edit income"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDeleteStream(stream.id)}
                    color="error"
                    size="small"
                    aria-label="delete income"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 0.25,
              mt: 1,
              mr: 1,
            }}
          >
            <Chip
              label={`Subtotal: ${formatJPY(subtotals.byCategory[category.key])}`}
              size="small"
              color={category.chipColor}
              variant="outlined"
            />
            {subtotalFooters[category.key]}
          </Box>
        </Stack>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="h6">Income/Benefit Details</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
            <Chip
              label={`Total: ${formatJPY(totalIncome)}`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 'bold' }}
            />
            {subtotals.byCategory.investment !== 0 && (
              <Typography variant="caption" color="text.secondary">
                Investment: {formatJPY(subtotals.byCategory.investment)}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {view.kind === 'choose' ? (
          <IncomeStreamTypeChooser
            streams={streams}
            onSelect={type => setView({ kind: 'add', type })}
          />
        ) : view.kind === 'add' ? (
          <IncomeStreamForm
            type={view.type}
            onSave={handleSaveStream}
            onCancel={showList}
            onChangeType={() => setView({ kind: 'choose' })}
          />
        ) : view.kind === 'edit' ? (
          <IncomeStreamForm
            key={view.stream.id}
            type={view.stream.type}
            initialData={view.stream}
            onSave={handleSaveStream}
            onCancel={showList}
          />
        ) : (
          <Stack spacing={0}>
            {streams.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No income added yet.
              </Typography>
            )}

            {INCOME_CATEGORIES.map(renderStreamGroup)}

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setView({ kind: 'choose' })}
              fullWidth
              sx={{
                borderStyle: 'dashed',
                borderColor: 'divider',
                py: 1.5,
                color: 'text.secondary',
                mt: 2,
              }}
            >
              Add Income/Benefit
            </Button>
          </Stack>
        )}
      </DialogContent>
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
        {view.kind === 'list' && (
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        )}
        {view.kind === 'choose' && <Button onClick={showList}>Cancel</Button>}
      </DialogActions>
    </Dialog>
  );
};
