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
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useEffect, useRef, useState } from 'react';

import {
  DEFAULT_REPORTED_DIVIDENDS_TAXATION,
  type IncomeStream,
  type IncomeStreamType,
  type ReportedDividendsTaxation,
  type TakeHomeInputs,
  type TakeHomeResults,
} from '../../../types/tax';
import { formatJPY, formatMonthLong } from '../../../utils/formatters';
import {
  annualIncomeStreamAmount,
  countsTowardCategorySubtotal,
  getCommutingAllowanceAnnualAmount,
  totalAnnualIncomeFromStreams,
} from '../../../utils/incomeStreams';
import { hasInvestmentIncome } from '../../../utils/investmentIncome';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import { DetailedTooltip } from '../../ui/Tooltips';
import {
  INCOME_CATEGORIES,
  INCOME_STREAM_CATALOG,
  incomeStreamTypesInCategory,
  isIncomeStreamTypeAtLimit,
  type IncomeCategory,
  type IncomeCategoryKey,
} from './incomeStreamCatalog';
import { IncomeStreamForm } from './IncomeStreamForm';
import InvestmentTreatmentComparison from './InvestmentTreatmentComparison';
import { variantLabelSx, variantToggleGroupSx } from './variantControlStyles';

interface IncomeDetailsModalProps {
  open: boolean;
  onClose: () => void;
  streams: IncomeStream[];
  onStreamsChange: (streams: IncomeStream[]) => void;
  /**
   * The election that taxes every reported dividend among {@link streams}
   * ({@link ReportedDividendsTaxation}); the default when omitted. Changed through
   * {@link onReportedDividendsTaxationChange}, without which the control is not shown.
   */
  reportedDividendsTaxation?: ReportedDividendsTaxation | undefined;
  onReportedDividendsTaxationChange?: ((election: ReportedDividendsTaxation) => void) | undefined;
  /**
   * The full calculation inputs {@link streams} belong to, for the comparison of the listed-share
   * elections at the foot of the investment group. When omitted the comparison is not offered.
   */
  calculationInputs?: TakeHomeInputs | undefined;
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
  reportedDividendsTaxation = DEFAULT_REPORTED_DIVIDENDS_TAXATION,
  onReportedDividendsTaxationChange,
  calculationInputs,
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
      case 'capitalGains':
        return `${stream.isReported ? 'Reported' : 'Withheld only'}${
          stream.account === 'foreign'
            ? ', foreign account'
            : stream.account === 'domesticNoWithholding'
              ? ', no withholding'
              : ''
        }`;
      case 'dividends':
        return stream.isReported ? 'Reported' : 'Withheld only';
      default:
        return null;
    }
  };

  const hasReportedDividend = streams.some(s => s.type === 'dividends' && s.isReported);

  // 措法8条の4② makes the 申告分離課税 election one for every reported dividend of the year, so
  // it is made here for the group rather than on each entry.
  const reportedDividendsTaxationControl =
    hasReportedDividend && onReportedDividendsTaxationChange ? (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          columnGap: 2,
          rowGap: 0.5,
          px: 0.5,
        }}
      >
        <FormLabel sx={{ ...variantLabelSx, mb: 0 }}>
          <span id="reported-dividends-taxation-label">Reported dividends</span>
          <DetailedTooltip
            title="Reported Dividends"
            icon={SIMPLE_TOOLTIP_ICON}
            iconAriaLabel="reported dividends info"
          >
            <Typography sx={{ display: 'block', mb: 1 }}>
              One election covers every dividend reported for the year (措法8条の4②): 申告分離課税
              or 総合課税, never a mix. Dividends left to the tax withheld at source (申告不要) are
              outside it.
            </Typography>
            <Typography sx={{ display: 'block', mb: 1 }}>
              <strong>Separate (申告分離課税)</strong> taxes them at 15.315% and 5% apart from the
              brackets, after any deductions the other income could not use, with a reported capital
              loss from a qualifying sale set against them (損益通算).
            </Typography>
            <Typography sx={{ display: 'block', mb: 1 }}>
              <strong>Progressive (総合課税)</strong> counts them as 配当所得 in 総所得金額, taxed
              in the progressive brackets and at the 10% residence-tax rate with the other income.
              The 配当控除 (所法92条) is not modelled yet, so the tax is overstated for a dividend
              from a domestic company; no capital loss is set against them; 特定公社債の利子 cannot
              be taxed this way.
            </Typography>
            <Typography sx={{ display: 'block' }}>
              Either way the amount enters 合計所得金額 and every figure keyed to it, and since
              令和6年度 the residence tax follows the income-tax election (地方税法32条⑬, 313条⑬).
            </Typography>
          </DetailedTooltip>
        </FormLabel>
        <ToggleButtonGroup
          value={reportedDividendsTaxation}
          exclusive
          onChange={(_, newValue: ReportedDividendsTaxation | null) => {
            if (newValue) {
              onReportedDividendsTaxationChange(newValue);
            }
          }}
          aria-labelledby="reported-dividends-taxation-label"
          size="small"
          sx={variantToggleGroupSx}
        >
          <ToggleButton value="separate">Separate</ToggleButton>
          <ToggleButton value="aggregate">Progressive</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    ) : null;

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

  // What the final withholding under 申告不要 leaves of the withheld-only entries (see
  // calculateWithheldInvestmentTax), and the total on the return. Tax withheld on a reported
  // amount is credited at filing, so it carries no figure here.
  const reportedInvestmentTotal =
    investmentIncome === undefined
      ? 0
      : (investmentIncome.reported
          ? investmentIncome.reported.gross.capitalGains + investmentIncome.reported.gross.dividends
          : 0) + (investmentIncome.aggregateDividends ?? 0);
  const investmentSubtotalFooter =
    investmentIncome === undefined ? null : (
      <>
        {hasInvestmentIncome(investmentIncome.gross) && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Withheld only: {formatJPY(investmentIncome.grossTotal)}
            {investmentIncome.withheld.total === 0
              ? ', no tax withheld'
              : ` − ${formatJPY(investmentIncome.withheld.total)} tax = ${formatJPY(
                  investmentIncome.grossTotal - investmentIncome.withheld.total,
                )}`}
          </Typography>
        )}
        {(investmentIncome.reported || investmentIncome.aggregateDividends !== undefined) && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Reported on the return: {formatJPY(reportedInvestmentTotal)}
          </Typography>
        )}
      </>
    );

  // The comparison is offered once a capital-gains or dividends entry exists to elect on.
  const hasListedShareStream = streams.some(
    s => s.type === 'capitalGains' || s.type === 'dividends',
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
                <Box sx={{ minWidth: 0 }}>
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
                <Box sx={{ display: 'flex', flexShrink: 0, ml: 1 }}>
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
          {category.key === 'investment' && reportedDividendsTaxationControl}
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
        {category.key === 'investment' && calculationInputs && hasListedShareStream && (
          <InvestmentTreatmentComparison inputs={calculationInputs} />
        )}
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
              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                Investment: {formatJPY(subtotals.investment)}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {view.kind === 'add' ? (
          <IncomeStreamForm
            type={view.type}
            onSave={handleSaveStream}
            onCancel={showList}
            reportedDividendsTaxation={reportedDividendsTaxation}
          />
        ) : view.kind === 'edit' ? (
          <IncomeStreamForm
            key={view.stream.id}
            type={view.stream.type}
            initialData={view.stream}
            onSave={handleSaveStream}
            onCancel={showList}
            reportedDividendsTaxation={reportedDividendsTaxation}
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
