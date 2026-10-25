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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_REPORTED_DIVIDENDS_TAXATION,
  type IncomeStream,
  type IncomeStreamType,
  type ReportedDividendsTaxation,
  type TakeHomeInputs,
  type TakeHomeResults,
  type WithholdingOnlyInvestmentIncome,
} from '../../../types/tax';
import { formatJPY, formatMonthLong } from '../../../utils/formatters';
import {
  annualIncomeStreamAmount,
  countsTowardCategorySubtotal,
  getCommutingAllowanceAnnualAmount,
  totalAnnualIncomeFromStreams,
} from '../../../utils/incomeStreams';
import {
  calculateRealEstateAndBusinessAllocation,
  calculateTaxes,
} from '../../../utils/taxCalculations';
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
import { ReportingPlanner } from './ReportingPlanner';
import { variantLabelSx, variantToggleGroupSx } from './variantControlStyles';

interface IncomeDetailsModalProps {
  open: boolean;
  onClose: () => void;
  streams: IncomeStream[];
  onStreamsChange: (streams: IncomeStream[]) => void;
  /**
   * The return's blue-filer special deduction election (青色申告特別控除) shared between
   * business income and real estate income. Changed through {@link onBlueFilerDeductionChange},
   * without which the control is not shown.
   */
  blueFilerDeduction?: number | undefined;
  onBlueFilerDeductionChange?: ((deduction: number) => void) | undefined;
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

/**
 * The investment group's line for the amounts left to withholding: what was received, less the
 * foreign tax withheld abroad and the Japanese tax withheld, and what is left of it.
 */
const withheldOnlyFooter = (withheld: WithholdingOnlyInvestmentIncome): string => {
  const foreignTax = withheld.foreignTax ?? 0;
  if (withheld.tax.total === 0 && foreignTax === 0) {
    return `Withheld only: ${formatJPY(withheld.received)}, no tax withheld`;
  }
  const afterForeignTax = withheld.received - foreignTax;
  const terms = [formatJPY(withheld.received)];
  if (foreignTax > 0) terms.push(`${formatJPY(foreignTax)} foreign tax`);
  if (withheld.tax.total > 0) {
    // Accounts do not net with each other, so a loss left in one account can leave the taxed
    // amount above the net received; naming it keeps the line readable.
    const taxedOn =
      withheld.taxedAmount !== afterForeignTax ? ` on ${formatJPY(withheld.taxedAmount)}` : '';
    terms.push(`${formatJPY(withheld.tax.total)} tax${taxedOn}`);
  }
  return `Withheld only: ${terms.join(' − ')} = ${formatJPY(afterForeignTax - withheld.tax.total)}`;
};

const getStreamCardPrimaryAmount = (stream: IncomeStream): number => {
  switch (stream.type) {
    case 'withholdingAccount':
      return stream.capitalGains + stream.dividends;
    case 'salary':
    case 'bonus':
    case 'business':
    case 'realEstate':
    case 'commutingAllowance':
    case 'stockCompensation':
    case 'miscellaneous':
    case 'publicPension':
    case 'capitalGains':
    case 'dividends':
    case 'interest':
      return stream.amount;
    default: {
      const unhandled: never = stream;
      throw new Error(`Unhandled income stream: ${JSON.stringify(unhandled)}`);
    }
  }
};

export const IncomeDetailsModal: React.FC<IncomeDetailsModalProps> = ({
  open,
  onClose,
  streams,
  onStreamsChange,
  blueFilerDeduction,
  onBlueFilerDeductionChange,
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

  const minimumTaxApplies = useMemo(() => {
    return calculationInputs
      ? calculateTaxes(calculationInputs).highIncomeMinimumTax !== undefined
      : false;
  }, [calculationInputs]);

  const checkMinimumTax = useCallback(
    (draftStream: IncomeStream, excludeId?: string) => {
      if (!calculationInputs) return false;
      const baseStreams = streams.filter(s => s.id !== excludeId);
      return (
        calculateTaxes({
          ...calculationInputs,
          incomeStreams: [...baseStreams, draftStream],
        }).highIncomeMinimumTax !== undefined
      );
    },
    [calculationInputs, streams],
  );

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
      case 'withholdingAccount':
        if (minimumTaxApplies || (stream.reportsCapitalGains && stream.reportsDividends)) {
          return 'Reported';
        }
        if (stream.reportsCapitalGains) return 'Sales reported';
        if (stream.reportsDividends) return 'Dividends reported';
        return 'Withheld only';
      case 'capitalGains':
        return `Reported${
          stream.account === 'foreign'
            ? ', foreign account'
            : stream.account === 'domesticNoWithholding'
              ? ', no withholding'
              : ''
        }`;
      case 'dividends':
        return `${minimumTaxApplies || stream.isReported ? 'Reported' : 'Withheld only'}${
          stream.paymentChannel === 'abroad' ? ', received outside Japan' : ''
        }${stream.issuerDomicile === 'foreign' ? ', foreign company or fund' : ''}`;
      case 'interest':
        return stream.payerDomicile === 'foreign' ? 'Paid outside Japan' : null;
      case 'publicPension':
        return stream.payerDomicile === 'foreign' ? 'Foreign system' : null;
      case 'realEstate':
        return stream.location === 'foreign' ? 'Foreign property' : 'Domestic property';
      case 'business':
      case 'miscellaneous':
        return null;
      default: {
        const unhandled: never = stream;
        throw new Error(`Unhandled income stream: ${JSON.stringify(unhandled)}`);
      }
    }
  };

  const hasBusinessOrRealEstate = streams.some(
    s => s.type === 'business' || s.type === 'realEstate',
  );

  const effectiveBlueFilerDeduction = blueFilerDeduction ?? 0;

  const realEstateAndBusinessAllocation = React.useMemo(
    () => calculateRealEstateAndBusinessAllocation(streams, effectiveBlueFilerDeduction),
    [streams, effectiveBlueFilerDeduction],
  );

  const {
    businessBlueFilerDeduction: businessDeduction,
    totalBlueFilerDeduction: totalBlueFilerDeductionApplied,
    perStreamRealEstateBlueFilerDeduction,
  } = realEstateAndBusinessAllocation;

  // 措法25条の2② sets a single shared blue-filer special deduction pool across business and real
  // estate income, deducted first from real estate income, then from business income.
  const blueFilerDeductionControl =
    hasBusinessOrRealEstate && onBlueFilerDeductionChange ? (
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
          <span id="blue-filer-deduction-label">Blue-filer deduction</span>
          <DetailedTooltip
            title="Blue-Filer Requirements"
            icon={SIMPLE_TOOLTIP_ICON}
            iconAriaLabel="blue-filer deduction info"
          >
            <Typography sx={{ display: 'block', mb: 1 }}>
              Shared across real estate and business income. The deduction is applied first to real
              estate income, and any remaining balance is applied to business income. It cannot
              reduce either income below ¥0 or create a loss.
            </Typography>
            <Typography sx={{ display: 'block', mb: 1 }}>
              Requires prior tax office approval (see{' '}
              <a
                href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                Blue-Form Approval Application
              </a>
              ). For real estate income, the ¥550,000 and ¥650,000 deductions require the activity
              to be of a business scale (事業的規模: e.g. 5 buildings or 10 apartments). See{' '}
              <a
                href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                No.2072 青色申告特別控除 (NTA)
              </a>
              .
            </Typography>

            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.75rem',
                '& th': {
                  textAlign: 'center',
                  p: 0.5,
                  fontWeight: 600,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  verticalAlign: 'middle',
                },
                '& td': {
                  textAlign: 'center',
                  p: 0.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  verticalAlign: 'middle',
                },
                '& td:first-of-type': {
                  textAlign: 'left',
                  fontWeight: 500,
                  color: 'text.secondary',
                },
              }}
            >
              <thead>
                <tr>
                  <Box component="th" sx={{ width: '30%', textAlign: 'left' }}>
                    Requirement
                  </Box>
                  <Box component="th" sx={{ color: 'primary.main' }}>
                    ¥650k
                  </Box>
                  <Box component="th" sx={{ color: 'text.primary' }}>
                    ¥550k
                  </Box>
                  <Box component="th" sx={{ color: 'text.secondary' }}>
                    ¥100k
                  </Box>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bookkeeping</td>
                  <Box component="td" sx={{ color: 'success.main' }}>
                    Double Entry
                  </Box>
                  <Box component="td" sx={{ color: 'success.main' }}>
                    Double Entry
                  </Box>
                  <Box component="td" sx={{ color: 'text.secondary' }}>
                    Simple
                  </Box>
                </tr>
                <tr>
                  <td>Balance Sheet, Profit &amp; Loss Statement</td>
                  <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                    ○
                  </Box>
                  <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                    ○
                  </Box>
                  <Box component="td" sx={{ color: 'text.disabled' }}>
                    —
                  </Box>
                </tr>
                <tr>
                  <td>On-time Filing</td>
                  <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                    ○
                  </Box>
                  <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                    ○
                  </Box>
                  <Box component="td" sx={{ color: 'text.disabled' }}>
                    —
                  </Box>
                </tr>
                <tr>
                  <td>e-Tax or Electronic Books</td>
                  <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                    ○
                  </Box>
                  <Box component="td" sx={{ color: 'text.disabled' }}>
                    —
                  </Box>
                  <Box component="td" sx={{ color: 'text.disabled' }}>
                    —
                  </Box>
                </tr>
                <tr>
                  <td>Rental scale (if real estate only)</td>
                  <Box component="td" sx={{ color: 'text.secondary' }}>
                    Business scale (5棟10室)
                  </Box>
                  <Box component="td" sx={{ color: 'text.secondary' }}>
                    Business scale (5棟10室)
                  </Box>
                  <Box component="td" sx={{ color: 'text.secondary' }}>
                    Any scale
                  </Box>
                </tr>
              </tbody>
            </Box>
          </DetailedTooltip>
        </FormLabel>
        <ToggleButtonGroup
          value={effectiveBlueFilerDeduction}
          exclusive
          onChange={(_, newValue: number | null) => {
            if (newValue !== null) {
              onBlueFilerDeductionChange(newValue);
            }
          }}
          aria-labelledby="blue-filer-deduction-label"
          size="small"
          sx={variantToggleGroupSx}
        >
          <ToggleButton value={0}>None</ToggleButton>
          <ToggleButton value={100_000}>¥100k</ToggleButton>
          <ToggleButton value={550_000}>¥550k</ToggleButton>
          <ToggleButton value={650_000}>¥650k</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    ) : null;

  const hasReportedDividend = streams.some(
    s =>
      (s.type === 'dividends' && (minimumTaxApplies || s.isReported)) ||
      (s.type === 'withholdingAccount' &&
        (minimumTaxApplies || s.reportsDividends) &&
        s.dividends > 0),
  );

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
          <span id="reported-dividends-taxation-label">Reported dividends taxation</span>
          <DetailedTooltip
            title="Reported Dividends Taxation"
            icon={SIMPLE_TOOLTIP_ICON}
            iconAriaLabel="reported dividends taxation info"
          >
            <Typography sx={{ display: 'block', mb: 1 }}>
              This election covers all dividends reported for the year: separate taxation
              (申告分離課税) or aggregate taxation (総合課税), never a mix. Dividends left to the
              tax withheld at source (申告不要) are unaffected by it.
            </Typography>
            <Typography sx={{ display: 'block', mb: 1 }}>
              <strong>Separate (申告分離課税)</strong> taxes them at a flat 15.315% and 5%, after
              any deductions the other income could not use, and after offsetting reported capital
              losses from a qualifying sale.
            </Typography>
            <Typography sx={{ display: 'block', mb: 1 }}>
              <strong>Aggregate (総合課税)</strong> combines dividend income (配当所得) with other
              aggregate income, taxed in the progressive income tax brackets and at the 10%
              residence-tax rate. Capital losses cannot offset dividends taxed in aggregate. The
              dividend tax credit (配当控除) is not modelled yet, so the tax is overstated for a
              dividend from a Japanese company.
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
          <ToggleButton value="aggregate">Aggregate</ToggleButton>
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
  const withheldInvestment = investmentIncome?.withheld;
  const reportedInvestment = investmentIncome?.reported;
  const reportedInvestmentTotal =
    (reportedInvestment?.separate
      ? reportedInvestment.separate.gross.capitalGains + reportedInvestment.separate.gross.dividends
      : 0) +
    (reportedInvestment?.aggregate
      ? reportedInvestment.aggregate.dividends + reportedInvestment.aggregate.interest
      : 0);
  const investmentSubtotalFooter =
    investmentIncome === undefined ? null : (
      <>
        {withheldInvestment && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {withheldOnlyFooter(withheldInvestment)}
          </Typography>
        )}
        {reportedInvestment && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Reported on the return: {formatJPY(reportedInvestmentTotal)}
          </Typography>
        )}
      </>
    );

  // The comparison is offered once a withholding-account, capital-gains or dividends entry
  // exists to elect on.
  const hasListedShareStream = streams.some(
    s => s.type === 'withholdingAccount' || s.type === 'capitalGains' || s.type === 'dividends',
  );

  const businessSubtotalFooter =
    totalBlueFilerDeductionApplied > 0 ? (
      <>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Blue-Filer Deduction (青色申告特別控除): -{formatJPY(totalBlueFilerDeductionApplied)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Net Business &amp; Real Estate Income:{' '}
          {formatJPY(subtotals.business - totalBlueFilerDeductionApplied)}
        </Typography>
      </>
    ) : null;

  const subtotalFooters: Partial<Record<IncomeCategoryKey, React.ReactNode>> = {
    business: businessSubtotalFooter,
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
                      {formatJPY(getStreamCardPrimaryAmount(stream))}
                    </Typography>
                    {getStreamDescription(stream) && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {getStreamDescription(stream)}
                      </Typography>
                    )}
                  </Box>
                  {stream.type === 'withholdingAccount' && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        display: 'block',
                        // Each figure stays with its label, so a narrow card breaks at the separator.
                        '& span': { whiteSpace: 'nowrap' },
                      }}
                    >
                      <span>Sales {formatJPY(stream.capitalGains)}</span> ·{' '}
                      <span>Dividends {formatJPY(stream.dividends)}</span>
                      {(stream.foreignDividends > 0 || stream.foreignTax > 0) && (
                        <>
                          {' '}
                          · <span>
                            Foreign dividends {formatJPY(stream.foreignDividends)}
                          </span> ·{' '}
                          <span>Foreign tax {formatJPY(stream.foreignTax)}</span>
                        </>
                      )}
                    </Typography>
                  )}
                  {(stream.type === 'dividends' ||
                    stream.type === 'interest' ||
                    stream.type === 'publicPension' ||
                    stream.type === 'realEstate') &&
                    stream.foreignTax > 0 && (
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', display: 'block' }}
                      >
                        Foreign tax {formatJPY(stream.foreignTax)}
                      </Typography>
                    )}
                  {stream.type === 'salary' && stream.frequency === 'monthly' && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      (Annual: {formatJPY(annualIncomeStreamAmount(stream))})
                    </Typography>
                  )}
                  {stream.type === 'business' && businessDeduction > 0 && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      (Blue-filer Deduction: -{formatJPY(businessDeduction)})
                    </Typography>
                  )}
                  {stream.type === 'realEstate' &&
                    (perStreamRealEstateBlueFilerDeduction.get(stream.id) ?? 0) > 0 && (
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', display: 'block' }}
                      >
                        (Blue-filer Deduction: -
                        {formatJPY(perStreamRealEstateBlueFilerDeduction.get(stream.id)!)})
                      </Typography>
                    )}
                  {stream.type === 'realEstate' && (
                    <>
                      {stream.landDebtInterest !== undefined && stream.landDebtInterest > 0 && (
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', display: 'block' }}
                        >
                          Land debt interest: {formatJPY(stream.landDebtInterest)}
                        </Typography>
                      )}
                      {stream.amount < 0 &&
                        stream.foreignUsedBuildingDepreciation !== undefined &&
                        stream.foreignUsedBuildingDepreciation > 0 && (
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', display: 'block' }}
                          >
                            Shortened building depreciation:{' '}
                            {formatJPY(stream.foreignUsedBuildingDepreciation)}
                          </Typography>
                        )}
                    </>
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
          {category.key === 'business' && blueFilerDeductionControl}
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
          <ReportingPlanner
            inputs={calculationInputs}
            onStreamsChange={onStreamsChange}
            onReportedDividendsTaxationChange={onReportedDividendsTaxationChange}
          />
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="span">
            Income/Benefit Details
          </Typography>
          <Chip
            label={`Total: ${formatJPY(totalIncome)}`}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {view.kind === 'add' ? (
          <IncomeStreamForm
            type={view.type}
            onSave={handleSaveStream}
            onCancel={showList}
            isMinimumTaxTriggered={draft => checkMinimumTax(draft)}
          />
        ) : view.kind === 'edit' ? (
          <IncomeStreamForm
            key={view.stream.id}
            type={view.stream.type}
            initialData={view.stream}
            onSave={handleSaveStream}
            onCancel={showList}
            isMinimumTaxTriggered={draft => checkMinimumTax(draft, view.stream.id)}
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
                    secondary={atLimit ? 'Already added' : INCOME_STREAM_CATALOG[type].labelDetail}
                    {...(atLimit && { slotProps: { secondary: { color: 'inherit' } } })}
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
