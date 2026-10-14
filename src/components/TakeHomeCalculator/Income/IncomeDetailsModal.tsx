// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
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
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useEffect, useRef, useState } from 'react';

import type { IncomeStream, IncomeStreamType, TakeHomeResults } from '../../../types/tax';
import { formatJPY, formatMonthLong } from '../../../utils/formatters';
import {
  annualIncomeStreamAmount,
  countsTowardCategorySubtotal,
  getCommutingAllowanceAnnualAmount,
  totalAnnualIncomeFromStreams,
} from '../../../utils/incomeStreams';
import {
  INCOME_CATEGORIES,
  INCOME_STREAM_CATALOG,
  incomeStreamTypesInCategory,
  isIncomeStreamTypeAtLimit,
  type IncomeCategory,
  type IncomeCategoryKey,
} from './incomeStreamCatalog';
import { IncomeStreamForm } from './IncomeStreamForm';

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
  | { kind: 'add'; type: IncomeStreamType }
  | { kind: 'edit'; stream: IncomeStream };

const addButtonId = (category: IncomeCategoryKey) => `add-${category}-income`;

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
  // The section whose add button should take focus when the list comes back.
  const returnFocusTo = useRef<IncomeCategoryKey | null>(null);

  const showList = () => {
    if (view.kind !== 'list') {
      const type = view.kind === 'add' ? view.type : view.stream.type;
      returnFocusTo.current = INCOME_STREAM_CATALOG[type].category;
    }
    setView({ kind: 'list' });
  };

  useEffect(() => {
    if (view.kind !== 'list' || returnFocusTo.current === null) return;
    document.getElementById(addButtonId(returnFocusTo.current))?.focus();
    returnFocusTo.current = null;
  }, [view.kind]);
  // The open type menu of a category that offers more than one type, and the button it hangs from.
  const [addMenu, setAddMenu] = useState<{
    category: IncomeCategoryKey;
    anchor: HTMLElement;
  } | null>(null);

  const startAdding = (type: IncomeStreamType) => {
    setAddMenu(null);
    setView({ kind: 'add', type });
  };

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

  const totalIncome = totalAnnualIncomeFromStreams(streams);

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

  // A category's subtotal is the income of that classification, so the commuting allowance —
  // which sits in the employment group but reimburses a cost rather than paying for work — is
  // left out of it. Investment income counts here even though it is not earned annual income
  // (see countsTowardCategorySubtotal in incomeStreams.ts).
  const calculateSubtotals = () => {
    const byCategory: Record<IncomeCategoryKey, number> = {
      employment: 0,
      business: 0,
      miscellaneous: 0,
      publicPension: 0,
      investment: 0,
    };

    streams.forEach(s => {
      if (!countsTowardCategorySubtotal(s)) return;
      byCategory[INCOME_STREAM_CATALOG[s.type].category] += annualIncomeStreamAmount(s);
    });

    return byCategory;
  };

  const subtotals = calculateSubtotals();
  const streamsInCategory = (category: IncomeCategoryKey) =>
    streams.filter(s => INCOME_STREAM_CATALOG[s.type].category === category);

  // The 公的年金等控除 applies to the combined gross of every pension stream, so it belongs on the
  // group subtotal rather than on any one entry.
  const publicPensionSubtotalFooter =
    netPublicPensionIncome === undefined ? null : (
      <>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Public Pension Deduction (公的年金等控除): -
          {formatJPY(subtotals.publicPension - netPublicPensionIncome)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Net Public Pension Income: {formatJPY(netPublicPensionIncome)}
        </Typography>
      </>
    );

  // Withheld at source under 申告不要 (源泉徴収あり特定口座) — see calculateWithheldInvestmentTax.
  const investmentSubtotalFooter =
    investmentIncome === undefined ? null : (
      <>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Withheld at Source (源泉徴収): -{formatJPY(investmentIncome.withheld.total)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Net Investment Income:{' '}
          {formatJPY(investmentIncome.grossTotal - investmentIncome.withheld.total)}
        </Typography>
      </>
    );

  const subtotalFooters: Partial<Record<IncomeCategoryKey, React.ReactNode>> = {
    publicPension: publicPensionSubtotalFooter,
    investment: investmentSubtotalFooter,
  };

  const renderAddButton = (category: IncomeCategory) => {
    const types = incomeStreamTypesInCategory(category.key);
    if (types.every(type => isIncomeStreamTypeAtLimit(type, streams))) return null;
    const singleType = types.length === 1 ? types[0] : undefined;
    const hasMenu = singleType === undefined;

    return (
      <Button
        id={addButtonId(category.key)}
        size={isMobile ? 'medium' : 'small'}
        startIcon={<AddIcon />}
        endIcon={hasMenu ? <ArrowDropDownIcon /> : undefined}
        aria-label={category.addLabel}
        aria-haspopup={hasMenu ? 'menu' : undefined}
        aria-expanded={hasMenu ? addMenu?.category === category.key : undefined}
        onClick={e =>
          singleType === undefined
            ? setAddMenu({ category: category.key, anchor: e.currentTarget })
            : startAdding(singleType)
        }
        sx={{ flexShrink: 0, my: -0.5 }}
      >
        Add
      </Button>
    );
  };

  const renderStreamGroup = (category: IncomeCategory) => {
    const groupStreams = streamsInCategory(category.key);

    return (
      <Box key={category.key} sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            mb: 1,
            pb: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 600 }}>
            {category.heading}
          </Typography>
          {renderAddButton(category)}
        </Box>
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
                    <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold' }}>
                      {formatJPY(stream.amount)}
                    </Typography>
                    {getStreamDescription(stream) && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {getStreamDescription(stream)}
                      </Typography>
                    )}
                  </Box>
                  {stream.type === 'salary' && stream.frequency === 'monthly' && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      (Annual: {formatJPY(annualIncomeStreamAmount(stream))})
                    </Typography>
                  )}
                  {stream.type === 'business' && !!stream.blueFilerDeduction && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      (Blue-filer Deduction: -
                      {formatJPY(Math.min(Math.max(0, stream.amount), stream.blueFilerDeduction))})
                    </Typography>
                  )}
                  {stream.type === 'commutingAllowance' && stream.frequency !== 'annual' && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      (Annual: {formatJPY(getCommutingAllowanceAnnualAmount(stream))})
                    </Typography>
                  )}
                </Box>
                <Box>
                  <IconButton
                    onClick={() => setView({ kind: 'edit', stream })}
                    color="primary"
                    size={isMobile ? 'medium' : 'small'}
                    aria-label="edit income"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDeleteStream(stream.id)}
                    color="error"
                    size={isMobile ? 'medium' : 'small'}
                    aria-label="delete income"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
          {groupStreams.length > 0 && (
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
                label={`Subtotal: ${formatJPY(subtotals[category.key])}`}
                size="small"
                color={category.chipColor}
                variant="outlined"
              />
              {subtotalFooters[category.key]}
            </Box>
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="h6" component="span">
            Income/Benefit Details
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
            <Chip
              label={`Total: ${formatJPY(totalIncome)}`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 'bold' }}
            />
            {subtotals.investment !== 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Investment: {formatJPY(subtotals.investment)}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {view.kind === 'add' ? (
          <IncomeStreamForm type={view.type} onSave={handleSaveStream} onCancel={showList} />
        ) : view.kind === 'edit' ? (
          <IncomeStreamForm
            key={view.stream.id}
            type={view.stream.type}
            initialData={view.stream}
            onSave={handleSaveStream}
            onCancel={showList}
          />
        ) : (
          <Stack spacing={0}>{INCOME_CATEGORIES.map(renderStreamGroup)}</Stack>
        )}
        <Menu
          open={addMenu !== null}
          anchorEl={addMenu?.anchor}
          onClose={() => setAddMenu(null)}
          slotProps={{
            list: { 'aria-labelledby': addMenu ? addButtonId(addMenu.category) : undefined },
          }}
        >
          {addMenu &&
            incomeStreamTypesInCategory(addMenu.category).map(type => {
              const atLimit = isIncomeStreamTypeAtLimit(type, streams);
              return (
                <MenuItem
                  key={type}
                  disabled={atLimit}
                  onClick={() => startAdding(type)}
                  sx={{ '&.Mui-disabled': { opacity: 1, color: 'text.disabled' } }}
                >
                  <ListItemText
                    primary={INCOME_STREAM_CATALOG[type].label}
                    secondary={atLimit ? 'Already added' : undefined}
                    slotProps={{ secondary: { color: 'inherit' } }}
                  />
                </MenuItem>
              );
            })}
        </Menu>
      </DialogContent>
      {view.kind === 'list' && (
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
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
