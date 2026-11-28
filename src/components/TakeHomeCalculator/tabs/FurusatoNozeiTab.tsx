// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useState } from 'react';

import {
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
  ONE_STOP_MAX_MUNICIPALITIES,
} from '../../../data/furusatoNozei';
import type { TakeHomeResults } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import {
  estimateFurusatoTemporaryIncome,
  getFurusatoOneStopOutOfPocketCost,
  getFurusatoOutOfPocketCost,
  getOneStopIneligibilityReasons,
  isHighOutOfPocketCost,
  OUT_OF_POCKET_ROUNDING_MARGIN,
} from '../../../utils/furusatoNozei';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks, { type Source } from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';
import { ResultRow } from '../ResultRow';
import { FurusatoOneStopTooltip, ONE_STOP_INELIGIBILITY_LABELS } from './FurusatoOneStopTooltip';
import {
  FurusatoTemporaryIncomeTooltip,
  MIC_FY2025_SURVEY_SOURCE,
} from './FurusatoTemporaryIncomeTooltip';

const GIFT_VALUE_SOURCES: Source[] = [
  MIC_FY2025_SURVEY_SOURCE,
  {
    href: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/archive/#ac03',
    label: 'MIC Furusato Nozei status survey',
  },
];

interface FurusatoNozeiTabProps {
  results: TakeHomeResults;
}

type FilingMethod = 'oneStop' | 'taxReturn';

const RESIDENCE_TAX_DETAILS_ID = 'furusato-residence-tax-details';
const TEMPORARY_INCOME_DETAILS_ID = 'furusato-temporary-income-details';

/** Formats a tax reduction as a negative amount, keeping zero as ¥0 rather than -¥0. */
const formatReduction = (amount: number): string => formatJPY(amount > 0 ? -amount : 0);

const CELL_PADDING_SX = { py: 0.75, px: 1, verticalAlign: 'middle' } as const;

type SxObject = Exclude<SxProps<Theme>, readonly unknown[] | ((theme: Theme) => unknown)>;

interface ComparisonRowProps {
  label: React.ReactNode;
  labelSuffix?: React.ReactNode;
  disclosure?: {
    expanded: boolean;
    onToggle: () => void;
    controlsId: string;
  };
  oneStopValue: React.ReactNode;
  taxReturnValue: React.ReactNode;
  oneStopDisabled?: boolean;
  oneStopTint?: string | undefined;
  variant?: 'default' | 'subtotal' | 'final';
  oneStopSx?: SxObject;
  taxReturnSx?: SxObject;
  labelSx?: SxObject;
  rowSx?: SxObject;
}

const DISABLED_CELL_VALUE = (
  <Box component="span" aria-label="Unavailable">
    —
  </Box>
);

const ComparisonRow: React.FC<ComparisonRowProps> = ({
  label,
  labelSuffix,
  disclosure,
  oneStopValue,
  taxReturnValue,
  oneStopDisabled = false,
  oneStopTint,
  variant = 'default',
  oneStopSx,
  taxReturnSx,
  labelSx,
  rowSx,
}) => {
  const theme = useTheme();

  const baseRowSx: SxObject | undefined =
    variant === 'subtotal'
      ? { borderTop: 1, borderColor: 'divider' }
      : variant === 'final'
        ? { borderTop: 2, borderColor: 'divider' }
        : undefined;

  const baseLabelSx: SxObject =
    variant === 'final'
      ? {
          px: 1,
          pl: 1,
          py: 1.25,
          verticalAlign: 'middle',
          textAlign: 'left',
          fontSize: '1.1rem',
          fontWeight: 700,
        }
      : variant === 'subtotal'
        ? {
            ...CELL_PADDING_SX,
            textAlign: 'left',
            pl: 2.5,
            fontSize: '1rem',
            fontWeight: 500,
            color: 'primary.main',
          }
        : {
            ...CELL_PADDING_SX,
            textAlign: 'left',
            pl: 2.5,
            fontSize: '0.95rem',
            fontWeight: 400,
            color: 'text.secondary',
          };

  const baseValueSx: SxObject =
    variant === 'final'
      ? {
          px: 1,
          py: 1.25,
          verticalAlign: 'middle',
          textAlign: 'right',
          fontSize: '1.1rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }
      : variant === 'subtotal'
        ? {
            ...CELL_PADDING_SX,
            textAlign: 'right',
            fontSize: '1rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }
        : {
            ...CELL_PADDING_SX,
            textAlign: 'right',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
          };

  const oneStopBg = variant === 'final' ? undefined : oneStopTint;

  const labelContent =
    disclosure || labelSuffix ? (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        {disclosure ? (
          <ButtonBase
            onClick={disclosure.onToggle}
            aria-expanded={disclosure.expanded}
            aria-controls={disclosure.expanded ? disclosure.controlsId : undefined}
            sx={{
              font: 'inherit',
              color: 'inherit',
              textAlign: 'left',
              borderRadius: 1,
              ml: '-1.5em',
              pl: '1.5em',
              position: 'relative',
              '@media (hover: hover)': { '&:hover': { color: 'text.primary' } },
            }}
          >
            <ExpandMoreIcon
              aria-hidden
              fontSize="inherit"
              sx={{
                position: 'absolute',
                left: 0,
                transition: theme.transitions.create('transform', {
                  duration: theme.transitions.duration.shortest,
                }),
                transform: disclosure.expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              }}
            />
            {label}
          </ButtonBase>
        ) : (
          label
        )}
        {labelSuffix}
      </Box>
    ) : (
      label
    );

  const rowCells = (
    <>
      <Box component="th" scope="row" sx={{ ...baseLabelSx, ...labelSx }}>
        {labelContent}
      </Box>
      <Box
        component="td"
        data-col="oneStop"
        sx={{
          ...baseValueSx,
          ...(oneStopBg ? { bgcolor: oneStopBg } : {}),
          ...(oneStopDisabled ? { color: 'text.disabled' } : oneStopSx),
        }}
      >
        {oneStopDisabled ? DISABLED_CELL_VALUE : oneStopValue}
      </Box>
      <Box component="td" data-col="taxReturn" sx={{ ...baseValueSx, ...taxReturnSx }}>
        {taxReturnValue}
      </Box>
    </>
  );

  if (baseRowSx || rowSx) {
    return (
      <Box component="tr" sx={{ ...baseRowSx, ...rowSx }}>
        {rowCells}
      </Box>
    );
  }

  return <tr>{rowCells}</tr>;
};

interface ComparisonDetailRowProps {
  label: React.ReactNode;
  oneStopValue: React.ReactNode;
  taxReturnValue: React.ReactNode;
  oneStopDisabled?: boolean;
  oneStopTint?: string | undefined;
  isSubtotal?: boolean;
}

const ComparisonDetailRow: React.FC<ComparisonDetailRowProps> = ({
  label,
  oneStopValue,
  taxReturnValue,
  oneStopDisabled = false,
  oneStopTint,
  isSubtotal = false,
}) => {
  const valueSx = {
    ...CELL_PADDING_SX,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
    color: 'text.secondary',
    fontWeight: isSubtotal ? 600 : 500,
  } as const;

  return (
    <tr>
      <Box
        component="th"
        scope="row"
        sx={{
          ...CELL_PADDING_SX,
          textAlign: 'left',
          pl: 3.5,
          fontSize: '0.8rem',
          color: 'text.secondary',
          fontWeight: isSubtotal ? 500 : 400,
        }}
      >
        {label}
      </Box>
      <Box
        component="td"
        data-col="oneStop"
        sx={{
          ...valueSx,
          ...(oneStopTint ? { bgcolor: oneStopTint } : {}),
          ...(oneStopDisabled ? { color: 'text.disabled' } : {}),
        }}
      >
        {oneStopDisabled ? DISABLED_CELL_VALUE : oneStopValue}
      </Box>
      <Box component="td" data-col="taxReturn" sx={valueSx}>
        {taxReturnValue}
      </Box>
    </tr>
  );
};

const FurusatoNozeiTab: React.FC<FurusatoNozeiTabProps> = ({ results }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Assumes existingTemporaryIncome === 0 because inputs.temporaryIncome is engine-only for now;
  // once exposed in the UI, pass it through from results and update FurusatoTemporaryIncomeTooltip.
  const tempIncome = estimateFurusatoTemporaryIncome(results.furusatoNozei.limit);
  const [showResidenceTaxDetails, setShowResidenceTaxDetails] = useState(false);
  const [showTemporaryIncomeDetails, setShowTemporaryIncomeDetails] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<FilingMethod | null>(null);

  // If no Furusato Nozei data, show a message
  if (results.furusatoNozei.limit <= 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <VolunteerActivismIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" sx={{ color: 'text.disabled', mb: 1 }}>
          No Furusato Nozei Data Available
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Furusato Nozei calculations are not available for this income level or configuration.
        </Typography>
      </Box>
    );
  }

  const giftsPct = FURUSATO_AVERAGE_GIFT_COST_RATE.toPercent(1);
  const shippingPct = FURUSATO_AVERAGE_SHIPPING_COST_RATE.toPercent(1);
  const effect = results.furusatoNozei.temporaryIncomeEffect;
  const tempIncomeNationalTax = effect?.nationalIncomeTax ?? 0;
  const tempIncomeResidenceTax = effect?.residenceTax ?? 0;
  const tempIncomeSocialInsurance = effect?.socialInsurance ?? 0;
  const tempIncomeTotalCost = effect?.total ?? 0;
  const totalOutOfPocketCost = getFurusatoOutOfPocketCost(results.furusatoNozei);
  const donationOutOfPocketCost = totalOutOfPocketCost - tempIncomeTotalCost;
  const hasTemporaryIncomeCost = tempIncomeTotalCost !== 0;
  const hasPositiveTemporaryIncomeCost = tempIncomeTotalCost > 0;
  const hasEffectBreakdown =
    tempIncomeNationalTax !== 0 || tempIncomeResidenceTax !== 0 || tempIncomeSocialInsurance !== 0;
  const tempIncomeCostLabel =
    tempIncomeSocialInsurance !== 0
      ? 'additional tax and social insurance'
      : 'income and residence tax';
  const hasHighDonationCost = isHighOutOfPocketCost(donationOutOfPocketCost);
  const hasHighTotalOutOfPocket = isHighOutOfPocketCost(totalOutOfPocketCost);
  const netEstimatedBenefit = tempIncome.estimatedGiftsValue - totalOutOfPocketCost;

  const oneStop = results.furusatoNozei.oneStop;
  const isOneStopEligible = oneStop?.eligible === true;
  const maybeOneStopOutOfPocketCost = getFurusatoOneStopOutOfPocketCost(results.furusatoNozei);
  const oneStopOutOfPocketCost = maybeOneStopOutOfPocketCost ?? 0;
  const hasHighOneStopCost =
    maybeOneStopOutOfPocketCost !== undefined && isHighOutOfPocketCost(maybeOneStopOutOfPocketCost);
  const oneStopNetBenefit = tempIncome.estimatedGiftsValue - oneStopOutOfPocketCost;
  const oneStopSavesCost =
    isOneStopEligible &&
    oneStopOutOfPocketCost + OUT_OF_POCKET_ROUNDING_MARGIN < totalOutOfPocketCost;
  const defaultMobileMethod: FilingMethod =
    oneStopOutOfPocketCost <= totalOutOfPocketCost ? 'oneStop' : 'taxReturn';
  const mobileMethod: FilingMethod = isOneStopEligible
    ? (selectedMethod ?? defaultMobileMethod)
    : 'taxReturn';

  const residenceTaxCreditBase =
    results.furusatoNozei.residenceTaxDonationBasicDeduction +
    results.furusatoNozei.residenceTaxSpecialDeduction;
  const municipalTaxCredit = Math.round(
    residenceTaxCreditBase * results.residenceTax.cityProportion.toDecimal(),
  );
  const prefecturalTaxCredit = Math.round(
    residenceTaxCreditBase * results.residenceTax.prefecturalProportion.toDecimal(),
  );

  const foreignTaxCredit = results.foreignTaxCredit?.credit;
  const hasForeignTaxCredit =
    foreignTaxCredit !== undefined &&
    foreignTaxCredit.incomeTax +
      foreignTaxCredit.reconstructionSurtax +
      foreignTaxCredit.prefecture +
      foreignTaxCredit.city >
      0;
  const oneStopIneligibilityReasons = getOneStopIneligibilityReasons(results);
  const oneStopReasonsText = oneStopIneligibilityReasons
    .map(reason => ONE_STOP_INELIGIBILITY_LABELS[reason])
    .join('; ');
  const oneStopIneligibleNotice =
    oneStopIneligibilityReasons.length > 0 ? (
      <Typography variant="body2" sx={{ mt: 1 }}>
        The One-Stop system (ワンストップ特例制度) cannot be used to avoid this here because filing
        a tax return is required ({oneStopReasonsText}).
      </Typography>
    ) : null;
  const oneStopFallbackNotice =
    oneStopIneligibleNotice ??
    (hasHighOneStopCost ? (
      <Typography variant="body2" sx={{ mt: 1 }}>
        Even under the One-Stop system (ワンストップ特例制度), the Home Loan Tax Credit spillover
        leaves insufficient remaining residence tax (所得割) to absorb the full Furusato Nozei
        credit.
      </Typography>
    ) : (
      <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
        This issue is avoided by using the One-Stop system (ワンストップ特例制度).
      </Typography>
    ));

  const formattedOutOfPocketTotal = `${hasTemporaryIncomeCost ? '≈ ' : ''}${formatJPY(totalOutOfPocketCost)}`;
  const formattedOutOfPocketDeduction = `${hasTemporaryIncomeCost ? '≈ ' : ''}${formatJPY(-totalOutOfPocketCost)}`;

  const incomeTaxTooltip = (
    <DetailedTooltip title="Income Tax Reduction" icon={SIMPLE_TOOLTIP_ICON}>
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          This reduction is received when filing a tax return including the Furusato Nozei
          donations. It is applied in the form of a donation deduction that reduces taxable income.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Donation Deduction (寄付金控除):</strong>{' '}
          {formatJPY(Math.max(results.furusatoNozei.limit - 2000, 0))} (donation amount minus 2,000
          yen)
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          The income tax reduction is calculated as the difference in income tax with and without
          this donation deduction.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          With the One-Stop Exception system (ワンストップ特例制度), this reduction is applied to
          residence tax instead of income tax.
        </Typography>
        <Box sx={{ mt: 1 }}>
          <a
            href="https://wiki.japanfinance.org/tax/residence/furusato-nozei/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--mui-palette-primary-main)',
              textDecoration: 'underline',
              fontSize: '0.95em',
            }}
          >
            More about Furusato Nozei
          </a>
        </Box>
      </Box>
    </DetailedTooltip>
  );

  const residenceTaxTooltip = (
    <DetailedTooltip title="Residence Tax Reduction" icon={SIMPLE_TOOLTIP_ICON}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Tax Credits vs. Realized Reduction
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          The total tax credits shown on the residence tax notice may differ slightly from the
          effective tax reduction due to rounding in the calculation process.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Basic Deduction (基本控除):</strong>{' '}
          {formatJPY(results.furusatoNozei.residenceTaxDonationBasicDeduction)} (10% of donation
          amount minus 2,000 yen)
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Special Deduction (特例控除):</strong>{' '}
          {formatJPY(results.furusatoNozei.residenceTaxSpecialDeduction)} (remaining amount to keep
          out-of-pocket cost at 2,000 yen, up to a limit)
        </Typography>
        {isOneStopEligible && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Declaration Special Credit (申告特例控除 — One-Stop only):</strong>{' '}
            {formatJPY(oneStop.residenceTaxDeclarationSpecialCredit)} (shifts the income tax portion
            into residence tax)
          </Typography>
        )}
        <Typography variant="body2">
          The residence tax reduction is calculated as the difference in residence tax with and
          without the above tax credits.
        </Typography>
      </Box>
    </DetailedTooltip>
  );

  const taxReturnOutOfPocketTooltip = (
    <DetailedTooltip
      title="High Out-of-Pocket Cost"
      icon={<WarningIcon fontSize="small" color="warning" />}
      iconSx={{ color: 'warning.main' }}
      iconAriaLabel="High out-of-pocket cost warning"
    >
      <Box>
        {!hasHighDonationCost && hasPositiveTemporaryIncomeCost ? (
          <>
            <Typography variant="body2">
              The estimated out-of-pocket cost is higher than the expected ≈2,000 yen because the
              return gifts are estimated to create taxable temporary income (一時所得) exceeding the
              ¥500,000 annual special deduction, adding ≈ {formatJPY(tempIncomeTotalCost)} in{' '}
              {tempIncomeCostLabel} (on top of the {formatJPY(donationOutOfPocketCost)} base
              donation cost).
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Filing a tax return is required when taxable temporary income arises, so the One-Stop
              system (ワンストップ特例制度) cannot be used.
            </Typography>
          </>
        ) : (
          <>
            {hasForeignTaxCredit ? (
              results.furusatoNozei.incomeTaxReduction === 0 ? (
                <>
                  <Typography variant="body2">
                    The out-of-pocket cost is higher than the expected ≈2,000 yen because the
                    Foreign Tax Credit already reduces Japanese national income tax to ¥0. As a
                    result, the donation deduction cannot reduce it further.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Any unused foreign tax credit can be carried forward for up to 3 years. Note
                    that the One-Stop system (ワンストップ特例制度) cannot be used when claiming the
                    Foreign Tax Credit, as filing a tax return is required.
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="body2">
                    The out-of-pocket cost is higher than the expected ≈2,000 yen. Applying the
                    donation deduction lowers the Japanese income tax base, which reduces the
                    allowable Foreign Tax Credit limit.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Any unused foreign tax credit can be carried forward for up to 3 years. Note
                    that the One-Stop system (ワンストップ特例制度) cannot be used when claiming the
                    Foreign Tax Credit, as filing a tax return is required.
                  </Typography>
                </>
              )
            ) : results.homeLoanTaxCredit && results.furusatoNozei.incomeTaxReduction === 0 ? (
              <>
                <Typography variant="body2">
                  The out-of-pocket cost is higher than the expected ≈2,000 yen because the Home
                  Loan Tax Credit already reduces Japanese national income tax to ¥0, and any
                  spillover into residence tax has reached its statutory cap.
                </Typography>
                {oneStopFallbackNotice}
              </>
            ) : results.highIncomeMinimumTax ? (
              <>
                <Typography variant="body2">
                  The out-of-pocket cost is higher than the expected ≈2,000 yen because the Minimum
                  Tax on High Income Taxpayers (特定の基準所得金額の課税の特例) sets a statutory tax
                  floor on baseline income. Because baseline income does not subtract donation
                  deductions, any reduction in baseline income tax is offset yen-for-yen by an
                  increase in the minimum tax addition.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Note that filing a tax return is required when this minimum tax applies, so the
                  One-Stop system (ワンストップ特例制度) cannot be used.
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body2">
                  The out-of-pocket cost is higher than the expected ≈2,000 yen. This happens when
                  filing a tax return if taxable income changes income tax brackets after applying
                  the Furusato Nozei donation deduction.
                </Typography>
                {oneStopFallbackNotice}
              </>
            )}
            {hasPositiveTemporaryIncomeCost && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                In addition, estimated taxable temporary income from the return gifts adds ≈{' '}
                {formatJPY(tempIncomeTotalCost)} in {tempIncomeCostLabel} (
                {formatJPY(donationOutOfPocketCost)} base donation cost + ≈{' '}
                {formatJPY(tempIncomeTotalCost)} gift temporary income effect = ≈{' '}
                {formatJPY(totalOutOfPocketCost)} total).
              </Typography>
            )}
          </>
        )}
      </Box>
    </DetailedTooltip>
  );

  const oneStopOutOfPocketTooltip = (
    <DetailedTooltip
      title="High One-Stop Out-of-Pocket Cost"
      icon={<WarningIcon fontSize="small" color="warning" />}
      iconSx={{ color: 'warning.main' }}
      iconAriaLabel="High One-Stop out-of-pocket cost warning"
    >
      <Typography variant="body2">
        The One-Stop out-of-pocket cost is higher than the expected ≈2,000 yen because the Home Loan
        Tax Credit spillover leaves insufficient remaining residence tax (所得割) to absorb the full
        Furusato Nozei credit (Basic, Special, and Declaration Special credits).
      </Typography>
    </DetailedTooltip>
  );

  const valueOfGiftsTooltip = (
    <DetailedTooltip title="Estimated Value of Gifts Received" icon={SIMPLE_TOOLTIP_ICON}>
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Estimated at {giftsPct} of the donation amount based on the MIC Furusato Nozei status
          survey. Actual return value depends on the municipality and selected items, up to the
          statutory 30% procurement ceiling.
        </Typography>
        <Typography variant="body2">
          Delivery and shipping costs ({shippingPct} nationwide average) are excluded from the
          usable gift value shown here, though bundled shipping can count toward temporary income
          (see Gift Temporary Income Effect above).
        </Typography>
        <SourceLinks sources={GIFT_VALUE_SOURCES} />
      </Box>
    </DetailedTooltip>
  );

  const oneStopTint = oneStopSavesCost ? alpha(theme.palette.primary.main, 0.04) : undefined;
  const oneStopColumnBg = isOneStopEligible ? oneStopTint : theme.palette.action.hover;
  const desktopNetBenefitWarning = isOneStopEligible
    ? oneStopNetBenefit < 0 && netEstimatedBenefit < 0
    : netEstimatedBenefit < 0;
  const mobileNetBenefitWarning = isOneStopEligible
    ? (mobileMethod === 'oneStop' ? oneStopNetBenefit : netEstimatedBenefit) < 0
    : netEstimatedBenefit < 0;
  const netBenefitBg = (warning: boolean) =>
    alpha(warning ? theme.palette.warning.main : theme.palette.success.main, 0.07);
  const netBenefitLabelColor = (warning: boolean) => (warning ? 'warning.dark' : 'success.dark');

  return (
    <Box sx={{ containerType: 'inline-size' }}>
      <Typography
        variant="h6"
        sx={{
          mb: 1,
          color: 'secondary.main',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          fontSize: isMobile ? '1.1rem' : '1.25rem',
        }}
      >
        <VolunteerActivismIcon
          sx={{ mr: 1, fontSize: isMobile ? 20 : 24, color: 'secondary.main' }}
        />
        Furusato Nozei Details
      </Typography>

      {/* Limit */}
      <Box sx={{ mb: 1 }}>
        <ResultRow
          label={
            <span>
              Furusato Nozei Limit
              <DetailedTooltip title="Donation Limit Explanation" icon={SIMPLE_TOOLTIP_ICON}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    This limit is the maximum donation for which the out-of-pocket cost is only
                    2,000 yen, based on the input income and other options.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Actual limits may vary depending on the applicable deductions and municipality.
                  </Typography>
                  {results.investmentIncome?.reported?.separate && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Investment income reported under separate taxation (申告分離課税) raises the
                      limit through the residence tax it adds; with no other taxable income the
                      limit is set from its own 15% rate.
                    </Typography>
                  )}
                  <Typography variant="body2">
                    If deductions or tax credits not supported by this calculator are claimed, this
                    limit will not be accurate (it will likely be too high).
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    Use{' '}
                    <a
                      href="https://kaikei7.com/furusato_nouzei_keisan/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--mui-palette-primary-main)' }}
                    >
                      kaikei7
                    </a>{' '}
                    for calculations that support virtually all deductions and credits.
                  </Box>
                </Box>
              </DetailedTooltip>
            </span>
          }
          value={formatJPY(results.furusatoNozei.limit)}
          type="header"
        />
      </Box>

      {/* Responsive One-Stop vs. Tax Return Comparison */}
      <Box sx={{ mb: 1.5, display: 'none', '@container (max-width: 459px)': { display: 'block' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Filing Method
          </Typography>
          <FurusatoOneStopTooltip oneStop={oneStop} />
        </Box>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mobileMethod}
          onChange={(_event, next: FilingMethod | null) => {
            if (next && (isOneStopEligible || next === 'taxReturn')) {
              setSelectedMethod(next);
            }
          }}
          aria-label="Furusato Nozei filing method"
          sx={{
            '& .MuiToggleButton-root': {
              py: 0.75,
              px: 1,
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.25,
            },
            '& .MuiToggleButton-root.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
            },
          }}
        >
          <ToggleButton value="oneStop" disabled={!isOneStopEligible}>
            <Box component="span" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              One-Stop
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: '0.72rem',
                fontVariantNumeric: 'tabular-nums',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                color: !isOneStopEligible
                  ? 'text.disabled'
                  : mobileMethod === 'oneStop'
                    ? 'inherit'
                    : hasHighOneStopCost
                      ? 'warning.main'
                      : 'text.secondary',
              }}
            >
              {isOneStopEligible ? (
                <>
                  {hasHighOneStopCost && (
                    <WarningIcon
                      aria-hidden
                      sx={{
                        fontSize: '0.85rem',
                        color: mobileMethod === 'oneStop' ? 'inherit' : 'warning.main',
                      }}
                    />
                  )}
                  Cost: {formatJPY(oneStopOutOfPocketCost)}
                </>
              ) : (
                'Unavailable'
              )}
            </Box>
          </ToggleButton>
          <ToggleButton value="taxReturn">
            <Box component="span" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Tax Return
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: '0.72rem',
                fontVariantNumeric: 'tabular-nums',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                color:
                  mobileMethod === 'taxReturn'
                    ? 'inherit'
                    : hasHighTotalOutOfPocket
                      ? 'warning.main'
                      : 'text.secondary',
              }}
            >
              {hasHighTotalOutOfPocket && (
                <WarningIcon
                  aria-hidden
                  sx={{
                    fontSize: '0.85rem',
                    color: mobileMethod === 'taxReturn' ? 'inherit' : 'warning.main',
                  }}
                />
              )}
              Cost: {formattedOutOfPocketTotal}
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 0.5, fontSize: '1.1rem', fontWeight: 600 }}>
          Cost Breakdown (at limit)
        </Typography>
        <Box
          component="table"
          data-mobile-method={mobileMethod}
          sx={{
            borderCollapse: 'collapse',
            width: '100%',
            fontVariantNumeric: 'tabular-nums',
            '@container (max-width: 459px)': {
              '& thead': { display: 'none' },
              '& col[data-col]': { width: 'auto' },
              '& [data-col="oneStop"]': { bgcolor: 'transparent' },
              ...(mobileMethod === 'oneStop'
                ? { '& [data-col="taxReturn"]': { display: 'none' } }
                : { '& [data-col="oneStop"]': { display: 'none' } }),
            },
          }}
        >
          <colgroup>
            <col />
            <Box component="col" data-col="oneStop" sx={{ width: '25%' }} />
            <Box component="col" data-col="taxReturn" sx={{ width: '25%' }} />
          </colgroup>
          <thead>
            <Box component="tr" sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <th scope="col" aria-label="Item" />
              <Box
                component="th"
                scope="col"
                data-col="oneStop"
                sx={{
                  ...CELL_PADDING_SX,
                  verticalAlign: 'top',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: isOneStopEligible ? 'primary.main' : 'text.disabled',
                  bgcolor: oneStopColumnBg,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                }}
              >
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                  One-Stop
                  <FurusatoOneStopTooltip oneStop={oneStop} />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isOneStopEligible ? 'text.secondary' : 'text.disabled',
                    fontWeight: 400,
                  }}
                >
                  {isOneStopEligible
                    ? `≤ ${ONE_STOP_MAX_MUNICIPALITIES} municipalities`
                    : 'Unavailable'}
                </Typography>
              </Box>
              <Box
                component="th"
                scope="col"
                data-col="taxReturn"
                sx={{
                  ...CELL_PADDING_SX,
                  verticalAlign: 'top',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Tax Return
              </Box>
            </Box>
          </thead>
          <tbody>
            <ComparisonRow
              label="Donation Amount"
              oneStopDisabled={!isOneStopEligible}
              oneStopValue={formatJPY(results.furusatoNozei.limit)}
              taxReturnValue={formatJPY(results.furusatoNozei.limit)}
              oneStopTint={oneStopColumnBg}
            />
            <ComparisonRow
              label="Income Tax Reduction"
              labelSuffix={incomeTaxTooltip}
              oneStopDisabled={!isOneStopEligible}
              oneStopValue={formatReduction(0)}
              oneStopSx={{ color: 'text.secondary' }}
              taxReturnValue={formatReduction(results.furusatoNozei.incomeTaxReduction)}
              oneStopTint={oneStopColumnBg}
            />
            <ComparisonRow
              label="Residence Tax Reduction"
              disclosure={{
                expanded: showResidenceTaxDetails,
                onToggle: () => setShowResidenceTaxDetails(open => !open),
                controlsId: RESIDENCE_TAX_DETAILS_ID,
              }}
              labelSuffix={residenceTaxTooltip}
              oneStopDisabled={!isOneStopEligible}
              oneStopValue={formatReduction(isOneStopEligible ? oneStop.residenceTaxReduction : 0)}
              taxReturnValue={formatReduction(results.furusatoNozei.residenceTaxReduction)}
              oneStopTint={oneStopColumnBg}
            />
          </tbody>
          {showResidenceTaxDetails && (
            <tbody id={RESIDENCE_TAX_DETAILS_ID}>
              <ComparisonDetailRow
                label="Municipal tax credit"
                oneStopDisabled={!isOneStopEligible}
                oneStopValue={formatReduction(isOneStopEligible ? oneStop.municipalTaxCredit : 0)}
                taxReturnValue={formatReduction(municipalTaxCredit)}
                oneStopTint={oneStopColumnBg}
              />
              <ComparisonDetailRow
                label="Prefectural tax credit"
                oneStopDisabled={!isOneStopEligible}
                oneStopValue={formatReduction(isOneStopEligible ? oneStop.prefecturalTaxCredit : 0)}
                taxReturnValue={formatReduction(prefecturalTaxCredit)}
                oneStopTint={oneStopColumnBg}
              />
            </tbody>
          )}
          <tbody>
            <ComparisonRow
              label={
                hasPositiveTemporaryIncomeCost ? (
                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Gift Temporary Income Effect
                  </Box>
                ) : (
                  'Gift Temporary Income Effect'
                )
              }
              {...(hasEffectBreakdown && {
                disclosure: {
                  expanded: showTemporaryIncomeDetails,
                  onToggle: () => setShowTemporaryIncomeDetails(open => !open),
                  controlsId: TEMPORARY_INCOME_DETAILS_ID,
                },
              })}
              labelSuffix={
                <FurusatoTemporaryIncomeTooltip
                  estimate={tempIncome}
                  hasCost={hasPositiveTemporaryIncomeCost}
                />
              }
              oneStopDisabled={!isOneStopEligible}
              oneStopValue={formatJPY(0)}
              taxReturnValue={
                hasPositiveTemporaryIncomeCost ? (
                  <Box component="span" sx={{ color: 'warning.main', fontWeight: 700 }}>
                    ≈ {formatJPY(tempIncomeTotalCost)}
                  </Box>
                ) : hasTemporaryIncomeCost ? (
                  `≈ ${formatJPY(tempIncomeTotalCost)}`
                ) : (
                  formatJPY(0)
                )
              }
              oneStopTint={oneStopColumnBg}
            />
          </tbody>
          {hasEffectBreakdown && showTemporaryIncomeDetails && (
            <tbody id={TEMPORARY_INCOME_DETAILS_ID}>
              <ComparisonDetailRow
                label="Income tax & surtax"
                oneStopDisabled={!isOneStopEligible}
                oneStopValue={formatJPY(0)}
                taxReturnValue={formatJPY(tempIncomeNationalTax)}
                oneStopTint={oneStopColumnBg}
              />
              <ComparisonDetailRow
                label="Residence tax"
                oneStopDisabled={!isOneStopEligible}
                oneStopValue={formatJPY(0)}
                taxReturnValue={formatJPY(tempIncomeResidenceTax)}
                oneStopTint={oneStopColumnBg}
              />
              {tempIncomeSocialInsurance !== 0 && (
                <ComparisonDetailRow
                  label="Social insurance"
                  oneStopDisabled={!isOneStopEligible}
                  oneStopValue={formatJPY(0)}
                  taxReturnValue={formatJPY(tempIncomeSocialInsurance)}
                  oneStopTint={oneStopColumnBg}
                />
              )}
            </tbody>
          )}
          <tbody>
            <ComparisonRow
              variant="subtotal"
              label="Out-of-Pocket Cost"
              oneStopDisabled={!isOneStopEligible}
              oneStopValue={
                <Box
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  {hasHighOneStopCost && oneStopOutOfPocketTooltip}
                  {formatJPY(oneStopOutOfPocketCost)}
                </Box>
              }
              oneStopSx={{ color: hasHighOneStopCost ? 'warning.main' : 'primary.main' }}
              taxReturnValue={
                <Box
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  {hasHighTotalOutOfPocket && taxReturnOutOfPocketTooltip}
                  {formattedOutOfPocketTotal}
                </Box>
              }
              taxReturnSx={{ color: hasHighTotalOutOfPocket ? 'warning.main' : 'primary.main' }}
              oneStopTint={oneStopColumnBg}
            />
          </tbody>

          {/* Effective Return Analysis sharing exact column alignment */}
          <tbody aria-label="Effective Return Analysis">
            <tr>
              <Box
                component="th"
                colSpan={3}
                scope="colgroup"
                sx={{
                  textAlign: 'left',
                  pt: 2,
                  pb: 0.5,
                  px: 0,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'text.primary',
                }}
              >
                Effective Return Analysis
              </Box>
            </tr>
            <ComparisonRow
              label="Value of Gifts Received"
              labelSuffix={valueOfGiftsTooltip}
              oneStopDisabled={!isOneStopEligible}
              oneStopValue={`≈ ${formatJPY(tempIncome.estimatedGiftsValue)}`}
              taxReturnValue={`≈ ${formatJPY(tempIncome.estimatedGiftsValue)}`}
              oneStopTint={oneStopColumnBg}
            />
            <ComparisonRow
              label="Out-of-Pocket Cost"
              oneStopDisabled={!isOneStopEligible}
              oneStopValue={formatJPY(-oneStopOutOfPocketCost)}
              taxReturnValue={formattedOutOfPocketDeduction}
              oneStopTint={oneStopColumnBg}
            />
            <ComparisonRow
              variant="final"
              label="Net Estimated Benefit"
              oneStopDisabled={!isOneStopEligible}
              oneStopValue={`≈ ${formatJPY(oneStopNetBenefit)}`}
              oneStopSx={{ color: oneStopNetBenefit < 0 ? 'warning.main' : 'success.main' }}
              taxReturnValue={`≈ ${formatJPY(netEstimatedBenefit)}`}
              taxReturnSx={{ color: netEstimatedBenefit < 0 ? 'warning.main' : 'success.main' }}
              rowSx={{
                bgcolor: netBenefitBg(desktopNetBenefitWarning),
                '@container (max-width: 459px)': {
                  bgcolor: netBenefitBg(mobileNetBenefitWarning),
                },
              }}
              labelSx={{
                color: netBenefitLabelColor(desktopNetBenefitWarning),
                '@container (max-width: 459px)': {
                  color: netBenefitLabelColor(mobileNetBenefitWarning),
                },
              }}
            />
          </tbody>
        </Box>
      </Box>
    </Box>
  );
};

export default FurusatoNozeiTab;
