// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import WarningIcon from '@mui/icons-material/Warning';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useState } from 'react';

import {
  FURUSATO_AVERAGE_ECONOMIC_BENEFIT_RATE,
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
  FURUSATO_SOURCES,
} from '../../../data/furusatoNozei';
import type { TakeHomeResults } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import {
  estimateFurusatoTemporaryIncome,
  hasHighOutOfPocketCost,
} from '../../../utils/furusatoNozei';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import { DetailedTooltip, SimpleTooltip } from '../../ui/Tooltips';
import { ResultRow } from '../ResultRow';
import { FurusatoTemporaryIncomeTooltip } from './FurusatoTemporaryIncomeTooltip';

interface FurusatoNozeiTabProps {
  results: TakeHomeResults;
}

const TEMPORARY_INCOME_DETAILS_ID = 'furusato-temporary-income-details';

const FurusatoNozeiTab: React.FC<FurusatoNozeiTabProps> = ({ results }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tempIncome = estimateFurusatoTemporaryIncome(results.furusatoNozei);
  const [showTemporaryIncomeDetails, setShowTemporaryIncomeDetails] = useState(false);
  const handleToggleTemporaryIncome = () => setShowTemporaryIncomeDetails(open => !open);

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

  const goodsPct = FURUSATO_AVERAGE_GIFT_COST_RATE.toPercent(1);
  const shippingPct = FURUSATO_AVERAGE_SHIPPING_COST_RATE.toPercent(1);
  const combinedPct = FURUSATO_AVERAGE_ECONOMIC_BENEFIT_RATE.toPercent(1);
  const netEstimatedBenefit =
    tempIncome.estimatedGoodsValue -
    results.furusatoNozei.outOfPocketCost -
    tempIncome.additionalTotalTax;
  const foreignTaxCredit = results.foreignTaxCredit?.credit;
  const hasForeignTaxCredit =
    foreignTaxCredit !== undefined &&
    foreignTaxCredit.incomeTax +
      foreignTaxCredit.reconstructionSurtax +
      foreignTaxCredit.prefecture +
      foreignTaxCredit.city >
      0;

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

      {/* <Box sx={{ mb: 1, p: 2, bgcolor: 'info.light', borderRadius: 2, color: 'info.contrastText' }}>
        <Typography variant="body2">
          For comprehensive information about Furusato Nozei, see{' '}
          <a
            href="https://wiki.japanfinance.org/tax/residence/furusato-nozei/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            this wiki
          </a>.
        </Typography>
      </Box> */}

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

      {/* Tax Reductions */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ mb: 1, fontSize: '1.1rem', fontWeight: 600 }}>
          Tax Reductions (at limit)
        </Typography>

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
          value={formatJPY(results.furusatoNozei.incomeTaxReduction)}
          type="indented"
        />

        <ResultRow
          label={
            <span>
              Residence Tax Reduction
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
                    {formatJPY(results.furusatoNozei.residenceTaxSpecialDeduction)} (remaining
                    amount to keep out-of-pocket cost at 2,000 yen, up to a limit)
                  </Typography>
                  <Typography variant="body2">
                    The residence tax reduction is calculated as the difference in residence tax
                    with and without the above tax credits.
                  </Typography>
                </Box>
              </DetailedTooltip>
            </span>
          }
          value={formatJPY(results.furusatoNozei.residenceTaxReduction)}
          type="indented"
        />

        {/* Municipal and Prefectural breakdown */}
        <ResultRow
          label="Municipal tax credit"
          value={formatJPY(
            Math.round(
              (results.furusatoNozei.residenceTaxDonationBasicDeduction +
                results.furusatoNozei.residenceTaxSpecialDeduction) *
                results.residenceTax.cityProportion.toDecimal(),
            ),
          )}
          type="detail"
        />

        <ResultRow
          label="Prefectural tax credit"
          value={formatJPY(
            Math.round(
              (results.furusatoNozei.residenceTaxDonationBasicDeduction +
                results.furusatoNozei.residenceTaxSpecialDeduction) *
                results.residenceTax.prefecturalProportion.toDecimal(),
            ),
          )}
          type="detail"
        />

        <ResultRow
          label="Total Tax Reduction"
          value={formatJPY(
            results.furusatoNozei.incomeTaxReduction + results.furusatoNozei.residenceTaxReduction,
          )}
          type="subtotal"
        />
        <ResultRow
          label={
            <span>
              Out-of-Pocket Cost
              {hasHighOutOfPocketCost(results.furusatoNozei) && (
                <DetailedTooltip
                  title="High Out-of-Pocket Cost"
                  icon={<WarningIcon fontSize="small" color="warning" />}
                  iconSx={{ color: 'warning.main' }}
                  iconAriaLabel="High out-of-pocket cost warning"
                >
                  <Box>
                    {hasForeignTaxCredit ? (
                      results.furusatoNozei.incomeTaxReduction === 0 ? (
                        <>
                          <Typography variant="body2">
                            The out-of-pocket cost is higher than the expected ≈2,000 yen because
                            the Foreign Tax Credit already reduces Japanese national income tax to
                            ¥0. As a result, the donation deduction cannot reduce it further.
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Any unused foreign tax credit can be carried forward for up to 3 years.
                            Note that the One-Stop system (ワンストップ特例制度) cannot be used when
                            claiming the Foreign Tax Credit, as filing a tax return is required.
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="body2">
                            The out-of-pocket cost is higher than the expected ≈2,000 yen. Applying
                            the donation deduction lowers the Japanese income tax base, which
                            reduces the allowable Foreign Tax Credit limit.
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Any unused foreign tax credit can be carried forward for up to 3 years.
                            Note that the One-Stop system (ワンストップ特例制度) cannot be used when
                            claiming the Foreign Tax Credit, as filing a tax return is required.
                          </Typography>
                        </>
                      )
                    ) : results.homeLoanTaxCredit &&
                      results.furusatoNozei.incomeTaxReduction === 0 ? (
                      <>
                        <Typography variant="body2">
                          The out-of-pocket cost is higher than the expected ≈2,000 yen because the
                          Home Loan Tax Credit already reduces Japanese national income tax to ¥0,
                          and any spillover into residence tax has reached its statutory cap.
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                          If eligible (e.g. year 2+ of mortgage with salary income only), this issue
                          is avoided by using the One-Stop system (ワンストップ特例制度).
                        </Typography>
                      </>
                    ) : results.highIncomeMinimumTax ? (
                      <>
                        <Typography variant="body2">
                          The out-of-pocket cost is higher than the expected ≈2,000 yen because the
                          Minimum Tax on High Income Taxpayers (特定の基準所得金額の課税の特例) sets
                          a statutory tax floor on baseline income. Because baseline income does not
                          subtract donation deductions, any reduction in baseline income tax is
                          offset yen-for-yen by an increase in the minimum tax addition.
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Note that filing a tax return is required when this minimum tax applies,
                          so the One-Stop system (ワンストップ特例制度) cannot be used.
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Typography variant="body2">
                          The out-of-pocket cost is higher than the expected ≈2,000 yen. This
                          happens when filing a tax return if taxable income changes income tax
                          brackets after applying the Furusato Nozei donation deduction.
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                          This issue is avoided by using the One-Stop system (ワンストップ特例制度).
                        </Typography>
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
                color: hasHighOutOfPocketCost(results.furusatoNozei) ? 'warning.main' : 'inherit',
                fontWeight: hasHighOutOfPocketCost(results.furusatoNozei) ? 700 : 500,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {formatJPY(results.furusatoNozei.outOfPocketCost)}
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
          label="Value of Goods* Received"
          value={`≈ ${formatJPY(tempIncome.estimatedGoodsValue)}`}
          type="indented"
        />

        <ResultRow
          label="Out-of-Pocket Cost"
          value={formatJPY(-results.furusatoNozei.outOfPocketCost)}
          type="indented"
        />

        {tempIncome.additionalTotalTax > 0 && (
          <ResultRow
            label="Tax on Temporary Income*"
            value={
              <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>
                ≈ {formatJPY(-tempIncome.additionalTotalTax)}
              </Box>
            }
            type="indented"
          />
        )}

        <ResultRow
          label="Net Estimated Benefit"
          value={`≈ ${formatJPY(netEstimatedBenefit)}`}
          type="subtotal"
        />

        {/* Temporary Income Progressive Disclosure */}
        <Box
          sx={
            tempIncome.isTaxable
              ? {
                  mt: 1.5,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: t => alpha(t.palette.warning.main, 0.06),
                  border: '1px solid',
                  borderColor: t => alpha(t.palette.warning.main, 0.28),
                }
              : {
                  mt: 1.5,
                  pt: 0.75,
                  borderTop: 1,
                  borderColor: 'divider',
                }
          }
        >
          <ResultRow
            label={
              tempIncome.isTaxable ? (
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Temporary Income Estimate (一時所得)
                </Box>
              ) : (
                'Temporary Income Estimate (一時所得)'
              )
            }
            sublabel={
              tempIncome.isTaxable
                ? 'Exceeds ¥500,000 deduction (assuming no other temporary income)'
                : 'Under ¥500,000 deduction (¥0 taxable alone)'
            }
            disclosure={{
              expanded: showTemporaryIncomeDetails,
              onToggle: handleToggleTemporaryIncome,
              controlsId: TEMPORARY_INCOME_DETAILS_ID,
            }}
            labelSuffix={<FurusatoTemporaryIncomeTooltip estimate={tempIncome} />}
            value={
              tempIncome.isTaxable ? (
                <Box component="span" sx={{ color: 'warning.main', fontWeight: 700 }}>
                  ≈ {formatJPY(tempIncome.estimatedEconomicBenefit)}
                </Box>
              ) : (
                `≈ ${formatJPY(tempIncome.estimatedEconomicBenefit)}`
              )
            }
            type="indented"
          />

          <Box id={TEMPORARY_INCOME_DETAILS_ID}>
            <Collapse in={showTemporaryIncomeDetails} unmountOnExit>
              <ResultRow
                label={`Goods received (${goodsPct})`}
                value={`≈ ${formatJPY(tempIncome.estimatedGoodsValue)}`}
                type="detail"
              />
              <ResultRow
                label={`Estimated shipping (${shippingPct})`}
                value={`≈ ${formatJPY(tempIncome.estimatedShippingCost)}`}
                type="detail"
              />
              <ResultRow
                label={
                  <span>
                    Special deduction (特別控除)
                    <SimpleTooltip>
                      Annual ¥500,000 deduction shared across all temporary income in the calendar
                      year.
                    </SimpleTooltip>
                  </span>
                }
                value={formatJPY(-tempIncome.specialDeduction)}
                type="detail"
              />
              {tempIncome.isTaxable ? (
                <>
                  <ResultRow
                    label="Net temporary income"
                    value={`≈ ${formatJPY(tempIncome.netTemporaryIncome)}`}
                    type="detail"
                  />
                  <ResultRow
                    label="Taxable temporary income (½)"
                    value={
                      <Box component="span" sx={{ color: 'warning.main', fontWeight: 700 }}>
                        ≈ {formatJPY(tempIncome.taxableTemporaryIncome)}
                      </Box>
                    }
                    type="detail-subtotal"
                  />
                  {tempIncome.additionalTotalTax > 0 && (
                    <ResultRow
                      label="Additional tax"
                      sublabel={`Income tax ${formatJPY(tempIncome.additionalNationalIncomeTax)} + Residence tax ${formatJPY(tempIncome.additionalResidenceTax)}`}
                      value={formatJPY(tempIncome.additionalTotalTax)}
                      type="detail"
                    />
                  )}
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', pl: 3.5, pt: 0.5, display: 'block' }}
                  >
                    Return gifts (including shipping) count as temporary income in the year
                    delivered. Assumes no other temporary income; filing a tax return is required
                    when taxable (One-Stop Exception does not apply).
                  </Typography>
                </>
              ) : (
                <>
                  <ResultRow
                    label="Remaining deduction allowance"
                    value={`≈ ${formatJPY(tempIncome.remainingDeductionAllowance)}`}
                    type="detail"
                  />
                  <ResultRow
                    label="Taxable temporary income (½)"
                    value={formatJPY(0)}
                    type="detail-subtotal"
                  />
                </>
              )}
            </Collapse>
          </Box>
        </Box>

        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontStyle: 'italic', mt: 1, display: 'block' }}
        >
          * Estimated at {goodsPct} of donation amount for goods and {shippingPct} for shipping (
          {combinedPct} combined), based on the{' '}
          <a
            href={FURUSATO_SOURCES.micArchive}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            MIC Furusato Nozei status survey
          </a>
          .
        </Typography>
      </Box>
    </Box>
  );
};

export default FurusatoNozeiTab;
