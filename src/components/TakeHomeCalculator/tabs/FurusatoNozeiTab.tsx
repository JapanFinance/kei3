// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useState } from 'react';

import {
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
} from '../../../data/furusatoNozei';
import type { TakeHomeResults } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import {
  estimateFurusatoTemporaryIncome,
  getFurusatoDonationOutOfPocketCost,
  getFurusatoOutOfPocketCost,
  getOneStopIneligibilityReasons,
  hasHighDonationOutOfPocketCost,
  hasHighOutOfPocketCost,
  type OneStopIneligibilityReason,
} from '../../../utils/furusatoNozei';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks, { type Source } from '../../ui/SourceLinks';
import { DetailedTooltip } from '../../ui/Tooltips';
import { ResultRow } from '../ResultRow';
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

const RESIDENCE_TAX_DETAILS_ID = 'furusato-residence-tax-details';
const TEMPORARY_INCOME_DETAILS_ID = 'furusato-temporary-income-details';

const ONE_STOP_INELIGIBILITY_LABELS: Record<OneStopIneligibilityReason, string> = {
  taxableTemporaryIncome: 'taxable temporary income from Furusato Nozei return gifts',
  employmentIncomeOverThreshold: 'gross employment income exceeding ¥20,000,000',
  publicPensionOverThreshold: 'gross public pension income exceeding ¥4,000,000',
  businessOrMiscIncome: 'business or miscellaneous income',
  realEstateIncome: 'real estate income',
  reportedInvestmentIncome: 'reported investment income',
  medicalExpensesDeduction: 'medical expenses deduction',
};

/** Formats a tax reduction as a negative amount, keeping zero as ¥0 rather than -¥0. */
const formatReduction = (amount: number): string => formatJPY(amount > 0 ? -amount : 0);

const FurusatoNozeiTab: React.FC<FurusatoNozeiTabProps> = ({ results }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tempIncome = estimateFurusatoTemporaryIncome(results.furusatoNozei);
  const [showResidenceTaxDetails, setShowResidenceTaxDetails] = useState(false);
  const [showTemporaryIncomeDetails, setShowTemporaryIncomeDetails] = useState(false);

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
  const donationOutOfPocketCost = getFurusatoDonationOutOfPocketCost(results.furusatoNozei);
  const totalOutOfPocketCost = getFurusatoOutOfPocketCost(results.furusatoNozei);
  const hasTemporaryIncomeCost = tempIncome.additionalTotalCost !== 0;
  const hasPositiveTemporaryIncomeCost = tempIncome.additionalTotalCost > 0;
  const hasEffectBreakdown =
    tempIncome.additionalNationalIncomeTax !== 0 ||
    tempIncome.additionalResidenceTax !== 0 ||
    tempIncome.additionalSocialInsurance !== 0;
  const tempIncomeCostLabel =
    tempIncome.additionalSocialInsurance !== 0
      ? 'additional tax and social insurance'
      : 'income and residence tax';
  const hasHighDonationCost = hasHighDonationOutOfPocketCost(results.furusatoNozei);
  const hasHighTotalOutOfPocket = hasHighOutOfPocketCost(results.furusatoNozei);
  const netEstimatedBenefit = tempIncome.estimatedGiftsValue - totalOutOfPocketCost;
  const netBenefitTone = netEstimatedBenefit < 0 ? ('warning' as const) : ('success' as const);

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

  const formattedOutOfPocketTotal = `${hasTemporaryIncomeCost ? '≈ ' : ''}${formatJPY(totalOutOfPocketCost)}`;
  const formattedOutOfPocketDeduction = `${hasTemporaryIncomeCost ? '≈ ' : ''}${formatJPY(-totalOutOfPocketCost)}`;

  return (
    <Box>
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

      {/* Cost Breakdown */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ mb: 1, fontSize: '1.1rem', fontWeight: 600 }}>
          Cost Breakdown (at limit)
        </Typography>

        <ResultRow
          label="Donation Amount"
          value={formatJPY(results.furusatoNozei.limit)}
          type="indented"
        />

        <ResultRow
          label={
            <span>
              Income Tax Reduction
              <DetailedTooltip title="Income Tax Reduction" icon={SIMPLE_TOOLTIP_ICON}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    This reduction is received when filing a tax return (確定申告) including the
                    Furusato Nozei donations. It is applied in the form of a donation deduction that
                    reduces taxable income.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Donation Deduction (寄付金控除):</strong>{' '}
                    {formatJPY(Math.max(results.furusatoNozei.limit - 2000, 0))} (donation amount
                    minus 2,000 yen)
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    The income tax reduction is calculated as the difference in income tax with and
                    without this donation deduction.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    With the One-Stop Exception system (ワンストップ特例制度), this reduction is
                    applied to residence tax instead of income tax.
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
            </span>
          }
          value={formatReduction(results.furusatoNozei.incomeTaxReduction)}
          type="indented"
        />

        <ResultRow
          label="Residence Tax Reduction"
          disclosure={{
            expanded: showResidenceTaxDetails,
            onToggle: () => setShowResidenceTaxDetails(open => !open),
            controlsId: RESIDENCE_TAX_DETAILS_ID,
          }}
          labelSuffix={
            <DetailedTooltip title="Residence Tax Reduction" icon={SIMPLE_TOOLTIP_ICON}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Tax Credits vs. Realized Reduction
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  The total tax credits shown on the residence tax notice may differ slightly from
                  the effective tax reduction due to rounding in the calculation process.
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Basic Deduction (基本控除):</strong>{' '}
                  {formatJPY(results.furusatoNozei.residenceTaxDonationBasicDeduction)} (10% of
                  donation amount minus 2,000 yen)
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Special Deduction (特例控除):</strong>{' '}
                  {formatJPY(results.furusatoNozei.residenceTaxSpecialDeduction)} (remaining amount
                  to keep out-of-pocket cost at 2,000 yen, up to a limit)
                </Typography>
                <Typography variant="body2">
                  The residence tax reduction is calculated as the difference in residence tax with
                  and without the above tax credits.
                </Typography>
              </Box>
            </DetailedTooltip>
          }
          value={formatReduction(results.furusatoNozei.residenceTaxReduction)}
          type="indented"
        />

        <Box id={RESIDENCE_TAX_DETAILS_ID}>
          <Collapse in={showResidenceTaxDetails} unmountOnExit>
            <ResultRow
              label="Municipal tax credit"
              value={formatReduction(municipalTaxCredit)}
              type="detail"
            />
            <ResultRow
              label="Prefectural tax credit"
              value={formatReduction(prefecturalTaxCredit)}
              type="detail"
            />
          </Collapse>
        </Box>

        <ResultRow
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
          labelSuffix={<FurusatoTemporaryIncomeTooltip estimate={tempIncome} />}
          value={
            hasPositiveTemporaryIncomeCost ? (
              <Box component="span" sx={{ color: 'warning.main', fontWeight: 700 }}>
                ≈ {formatJPY(tempIncome.additionalTotalCost)}
              </Box>
            ) : hasTemporaryIncomeCost ? (
              `≈ ${formatJPY(tempIncome.additionalTotalCost)}`
            ) : (
              formatJPY(0)
            )
          }
          type="indented"
        />

        {hasEffectBreakdown && (
          <Box id={TEMPORARY_INCOME_DETAILS_ID}>
            <Collapse in={showTemporaryIncomeDetails} unmountOnExit>
              <ResultRow
                label="Income tax & surtax"
                value={formatJPY(tempIncome.additionalNationalIncomeTax)}
                type="detail"
              />
              <ResultRow
                label="Residence tax"
                value={formatJPY(tempIncome.additionalResidenceTax)}
                type="detail"
              />
              {tempIncome.additionalSocialInsurance !== 0 && (
                <ResultRow
                  label="Social insurance"
                  value={formatJPY(tempIncome.additionalSocialInsurance)}
                  type="detail"
                />
              )}
            </Collapse>
          </Box>
        )}

        <ResultRow
          label={
            <span>
              Out-of-Pocket Cost
              {hasHighTotalOutOfPocket && (
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
                          The estimated out-of-pocket cost is higher than the expected ≈2,000 yen
                          because the return gifts are estimated to create taxable temporary income
                          (一時所得) exceeding the ¥500,000 annual special deduction, adding ≈{' '}
                          {formatJPY(tempIncome.additionalTotalCost)} in {tempIncomeCostLabel} (on
                          top of the {formatJPY(donationOutOfPocketCost)} base donation cost).
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Filing a tax return is required when taxable temporary income arises, so
                          the One-Stop system (ワンストップ特例制度) cannot be used.
                        </Typography>
                      </>
                    ) : (
                      <>
                        {hasForeignTaxCredit ? (
                          results.furusatoNozei.incomeTaxReduction === 0 ? (
                            <>
                              <Typography variant="body2">
                                The out-of-pocket cost is higher than the expected ≈2,000 yen
                                because the Foreign Tax Credit already reduces Japanese national
                                income tax to ¥0. As a result, the donation deduction cannot reduce
                                it further.
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                Any unused foreign tax credit can be carried forward for up to 3
                                years. Note that the One-Stop system (ワンストップ特例制度) cannot
                                be used when claiming the Foreign Tax Credit, as filing a tax return
                                is required.
                              </Typography>
                            </>
                          ) : (
                            <>
                              <Typography variant="body2">
                                The out-of-pocket cost is higher than the expected ≈2,000 yen.
                                Applying the donation deduction lowers the Japanese income tax base,
                                which reduces the allowable Foreign Tax Credit limit.
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                Any unused foreign tax credit can be carried forward for up to 3
                                years. Note that the One-Stop system (ワンストップ特例制度) cannot
                                be used when claiming the Foreign Tax Credit, as filing a tax return
                                is required.
                              </Typography>
                            </>
                          )
                        ) : results.homeLoanTaxCredit &&
                          results.furusatoNozei.incomeTaxReduction === 0 ? (
                          <>
                            <Typography variant="body2">
                              The out-of-pocket cost is higher than the expected ≈2,000 yen because
                              the Home Loan Tax Credit already reduces Japanese national income tax
                              to ¥0, and any spillover into residence tax has reached its statutory
                              cap.
                            </Typography>
                            {oneStopIneligibleNotice ?? (
                              <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                                If eligible (e.g. year 2+ of mortgage with salary income only), this
                                issue is avoided by using the One-Stop system
                                (ワンストップ特例制度).
                              </Typography>
                            )}
                          </>
                        ) : results.highIncomeMinimumTax ? (
                          <>
                            <Typography variant="body2">
                              The out-of-pocket cost is higher than the expected ≈2,000 yen because
                              the Minimum Tax on High Income Taxpayers
                              (特定の基準所得金額の課税の特例) sets a statutory tax floor on
                              baseline income. Because baseline income does not subtract donation
                              deductions, any reduction in baseline income tax is offset yen-for-yen
                              by an increase in the minimum tax addition.
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Note that filing a tax return is required when this minimum tax
                              applies, so the One-Stop system (ワンストップ特例制度) cannot be used.
                            </Typography>
                          </>
                        ) : (
                          <>
                            <Typography variant="body2">
                              The out-of-pocket cost is higher than the expected ≈2,000 yen. This
                              happens when filing a tax return if taxable income changes income tax
                              brackets after applying the Furusato Nozei donation deduction.
                            </Typography>
                            {oneStopIneligibleNotice ?? (
                              <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                                This issue is avoided by using the One-Stop system
                                (ワンストップ特例制度).
                              </Typography>
                            )}
                          </>
                        )}
                        {hasPositiveTemporaryIncomeCost && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            In addition, estimated taxable temporary income from the return gifts
                            adds ≈ {formatJPY(tempIncome.additionalTotalCost)} in{' '}
                            {tempIncomeCostLabel} ({formatJPY(donationOutOfPocketCost)} base
                            donation cost + ≈ {formatJPY(tempIncome.additionalTotalCost)} gift
                            temporary income effect = ≈ {formatJPY(totalOutOfPocketCost)} total).
                          </Typography>
                        )}
                      </>
                    )}
                  </Box>
                </DetailedTooltip>
              )}
            </span>
          }
          value={
            <Box
              component="span"
              sx={{
                color: hasHighTotalOutOfPocket ? 'warning.main' : 'inherit',
                fontWeight: hasHighTotalOutOfPocket ? 700 : 500,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {formattedOutOfPocketTotal}
            </Box>
          }
          type="subtotal"
        />
      </Box>

      {/* Effective Return */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ mb: 1, fontSize: '1.1rem', fontWeight: 600 }}>
          Effective Return Analysis
        </Typography>

        <ResultRow
          label={
            <span>
              Value of Gifts Received
              <DetailedTooltip title="Estimated Value of Gifts Received" icon={SIMPLE_TOOLTIP_ICON}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Estimated at {giftsPct} of the donation amount based on the MIC Furusato Nozei
                    status survey. Actual return value depends on the municipality and selected
                    items, up to the statutory 30% procurement ceiling.
                  </Typography>
                  <Typography variant="body2">
                    Delivery and shipping costs ({shippingPct} nationwide average) are excluded from
                    the usable gift value shown here, though bundled shipping can count toward
                    temporary income (see Gift Temporary Income Effect above).
                  </Typography>
                  <SourceLinks sources={GIFT_VALUE_SOURCES} />
                </Box>
              </DetailedTooltip>
            </span>
          }
          value={`≈ ${formatJPY(tempIncome.estimatedGiftsValue)}`}
          type="indented"
        />

        <ResultRow
          label="Out-of-Pocket Cost"
          value={formattedOutOfPocketDeduction}
          type="indented"
        />

        <Divider sx={{ borderBottomWidth: 2, mt: 0.5 }} />

        <ResultRow
          label="Net Estimated Benefit"
          value={`≈ ${formatJPY(netEstimatedBenefit)}`}
          type="final"
          tone={netBenefitTone}
        />
      </Box>
    </Box>
  );
};

export default FurusatoNozeiTab;
