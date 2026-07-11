// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useTheme, alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { TakeHomeResults } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import InsuranceIcon from '@mui/icons-material/HealthAndSafety';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import WarningIcon from '@mui/icons-material/Warning';
import { ResultRow } from '../ResultRow';
import { DetailedTooltip } from '../../ui/Tooltips';

interface SummaryTabProps {
  results: TakeHomeResults;
}

/**
 * Formats an amount as "¥X (Y.Y%)" of the total, or bare "¥X" when the share is hidden.
 * The summary hides the share on mobile, where horizontal space is tight.
 *
 * @param decimals Fraction digits for the share. Defaults to 1.
 */
const formatAmountWithShare = (
  amount: number,
  total: number,
  showShare: boolean,
  decimals = 1,
): string =>
  showShare
    ? `${formatJPY(amount)} (${((amount / total) * 100).toFixed(decimals)}%)`
    : formatJPY(amount);

const SummaryTab: React.FC<SummaryTabProps> = ({ results }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const totalSocialInsurance =
    results.socialInsuranceOverride ??
    results.healthInsurance + results.pensionPayments + (results.employmentInsurance ?? 0);
  const totalTaxes = results.nationalIncomeTax + results.residenceTax.totalResidenceTax;
  const totalDeductions = totalSocialInsurance + totalTaxes;
  const takeHomePercentage =
    results.annualIncome > 0
      ? `${((results.takeHomeIncome / results.annualIncome) * 100).toFixed(1)}%`
      : '100%';

  return (
    <Box>
      <ResultRow label="Annual Income" value={formatJPY(results.annualIncome)} type="header" />
      <Divider sx={{ my: { xs: 1, sm: 1.5 } }} />

      {/* Social Insurance Section */}
      <Box
        sx={{
          bgcolor: theme => alpha(theme.palette.primary.main, 0.03),
          borderRadius: 2,
          px: 1,
          py: 1,
          mb: { xs: 0.5, sm: 1 },
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            mt: { xs: 0.5, sm: 1 },
            mb: { xs: 0.5, sm: 1 },
            color: 'primary.main',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            fontSize: isMobile ? '1rem' : '1.1rem',
          }}
        >
          <InsuranceIcon sx={{ mr: 1, fontSize: isMobile ? 18 : 20 }} />
          Social Insurance
        </Typography>
        {results.socialInsuranceOverride !== undefined ? (
          <ResultRow
            label="Total Social Insurance (Manual)"
            value={formatAmountWithShare(totalSocialInsurance, results.annualIncome, !isMobile)}
            type="subtotal"
          />
        ) : (
          <>
            <ResultRow
              label="Health Insurance"
              value={formatAmountWithShare(
                results.healthInsurance,
                results.annualIncome,
                !isMobile,
              )}
              type="indented"
            />
            <ResultRow
              label="Pension Payments"
              value={formatAmountWithShare(
                results.pensionPayments,
                results.annualIncome,
                !isMobile,
              )}
              type="indented"
            />
            {results.hasEmploymentIncome && (
              <ResultRow
                label="Employment Insurance"
                value={formatAmountWithShare(
                  results.employmentInsurance ?? 0,
                  results.annualIncome,
                  !isMobile,
                  2,
                )}
                type="indented"
              />
            )}
            <ResultRow
              label="Total Social Insurance"
              value={formatAmountWithShare(totalSocialInsurance, results.annualIncome, !isMobile)}
              type="subtotal"
            />
          </>
        )}
      </Box>

      {/* Taxes Section */}
      <Box
        sx={{
          bgcolor: theme => alpha(theme.palette.warning.main, 0.03),
          borderRadius: 2,
          px: 1,
          py: 1,
          mb: { xs: 0.5, sm: 1 },
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            mt: { xs: 0.5, sm: 1 },
            mb: { xs: 0.5, sm: 1 },
            color: 'warning.main',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            fontSize: isMobile ? '1rem' : '1.1rem',
          }}
        >
          <AccountBalanceIcon sx={{ mr: 1, fontSize: isMobile ? 18 : 20, color: 'warning.main' }} />
          Taxes
        </Typography>
        <ResultRow
          label="Income Tax"
          value={formatAmountWithShare(results.nationalIncomeTax, results.annualIncome, !isMobile)}
          type="indented"
        />
        <ResultRow
          label="Residence Tax"
          value={formatAmountWithShare(
            results.residenceTax.totalResidenceTax,
            results.annualIncome,
            !isMobile,
          )}
          type="indented"
        />
        <ResultRow
          label="Total Taxes"
          value={formatAmountWithShare(totalTaxes, results.annualIncome, !isMobile)}
          type="subtotal"
        />
      </Box>

      {/* Total Deductions */}
      <Box>
        {/*
          Stays inline rather than using formatAmountWithShare: this row shows the amount as a
          negative (a reduction) while its share of income is the positive magnitude, so the shown
          amount and the share basis differ in sign.
        */}
        <ResultRow
          label="Total Deductions"
          value={
            !isMobile
              ? `${formatJPY(-totalDeductions)} (${((totalDeductions / results.annualIncome) * 100).toFixed(1)}%)`
              : formatJPY(-totalDeductions)
          }
          type="total"
        />
      </Box>

      <Divider sx={{ borderBottomWidth: 2 }} />

      {/* Net Take-Home Pay */}
      <ResultRow
        label="Take-Home Pay"
        value={
          <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>
            {formatJPY(results.takeHomeIncome)}
            <Box
              component="span"
              sx={{
                color: 'success.dark',
                fontWeight: 600,
                ml: 1,
                whiteSpace: 'nowrap',
              }}
            >
              ({takeHomePercentage})
            </Box>
          </Box>
        }
        type="final"
      />

      {/* Furusato Nozei Summary */}
      {results.furusatoNozei.limit > 0 && (
        <Box
          sx={{
            bgcolor: theme => alpha(theme.palette.secondary.main, 0.07),
            borderRadius: 2,
            px: 1,
            py: 1,
            mt: { xs: 0.5, sm: 1 },
            mb: { xs: 0.5, sm: 1 },
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              mt: { xs: 0.5, sm: 1 },
              mb: { xs: 0.5, sm: 1 },
              color: 'secondary.main',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              fontSize: isMobile ? '1rem' : '1.1rem',
            }}
          >
            <VolunteerActivismIcon
              sx={{ mr: 1, fontSize: isMobile ? 18 : 20, color: 'secondary.main' }}
            />
            Furusato Nozei
          </Typography>
          <ResultRow
            label={
              <span>
                Furusato Nozei Limit
                {results.furusatoNozei.outOfPocketCost > 2200 && (
                  <DetailedTooltip
                    title="Warning: High Out-of-Pocket Cost"
                    icon={<WarningIcon fontSize="small" />}
                    iconSx={{ color: 'error.main' }}
                    iconAriaLabel="Warning: High out-of-pocket cost"
                  >
                    <Box>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        The out-of-pocket cost ({formatJPY(results.furusatoNozei.outOfPocketCost)})
                        is higher than the expected ≈2,000 yen.
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        See the Furusato Nozei tab for details.
                      </Typography>
                    </Box>
                  </DetailedTooltip>
                )}
              </span>
            }
            value={
              <Box
                component="span"
                sx={{
                  color: results.furusatoNozei.outOfPocketCost > 2200 ? 'error.main' : 'inherit',
                  fontWeight: results.furusatoNozei.outOfPocketCost > 2200 ? 700 : 500,
                }}
              >
                {formatJPY(results.furusatoNozei.limit)}
              </Box>
            }
            type="subtotal"
          />
        </Box>
      )}
    </Box>
  );
};

export default SummaryTab;
