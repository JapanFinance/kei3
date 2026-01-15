// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { TakeHomeResults } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import WarningIcon from '@mui/icons-material/Warning';
import InfoTooltip from '../../ui/InfoTooltip';
import { ResultRow } from '../ResultRow';

interface FurusatoNozeiTabProps {
  results: TakeHomeResults;
}

/** Source: 調査結果（概要） https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/archive/#ac02 */
const FURUSATO_NOZEI_AVERAGE_GIFT_COST_PERCENTAGE = 0.252;

const FurusatoNozeiTab: React.FC<FurusatoNozeiTabProps> = ({ results }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // If no Furusato Nozei data, show a message
  if (!results.furusatoNozei || results.furusatoNozei.limit <= 0) {
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

  const estimatedValueOfGifts = Math.round(results.furusatoNozei.limit * FURUSATO_NOZEI_AVERAGE_GIFT_COST_PERCENTAGE);

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
          fontSize: isMobile ? '1.1rem' : '1.25rem'
        }}
      >
        <VolunteerActivismIcon sx={{ mr: 1, fontSize: isMobile ? 20 : 24, color: 'secondary.main' }} />
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
              <InfoTooltip
                title="Donation Limit Explanation"
                children={
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      This limit is the maximum donation for which your out-of-pocket cost is only 2,000 yen, based on the input income and other options.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Actual limits may vary depending on your deductions and municipality.
                    </Typography>
                    <Typography variant="body2">
                      If you claim deductions or tax credits not supported by this calculator, this limit will not be accurate for you (it will likely be too high).
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      You can use{' '}
                      <a href="https://kaikei7.com/furusato_nouzei_keisan/" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2' }}>
                        kaikei7
                      </a>{' '}
                      for calculations that support virtually all deductions and credits.
                    </Box>
                  </Box>
                }
              />
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
              <InfoTooltip
                title="Income Tax Reduction"
                children={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Income Tax Reduction (Furusato Nozei)
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      This reduction is received if you file a tax return (確定申告) including your Furusato Nozei donations. It is applied in the form of a donation deduction that reduces your taxable income.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Donation Deduction (寄付金控除):</strong> {formatJPY(Math.max(results.furusatoNozei.limit - 2000, 0))} (donation amount minus 2,000 yen)
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      The income tax reduction is calculated as the difference in income tax with and without this donation deduction.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      If you use the One-Stop Exception system (ワンストップ特例制度), this reduction will be applied to your residence tax instead of your income tax.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <a href="https://wiki.japanfinance.org/tax/residence/furusato-nozei/" target="_blank" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                        More about Furusato Nozei
                      </a>
                    </Box>
                  </Box>
                }
              />
            </span>
          }
          value={formatJPY(results.furusatoNozei.incomeTaxReduction)}
          type="indented" 
        />
        
        <ResultRow
          label={
            <span>
              Residence Tax Reduction
              <InfoTooltip
                title="Residence Tax Credits on Tax Notice"
                children={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Tax Credits vs. Realized Reduction
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      The total tax credits shown on your residence tax notice may differ slightly from the effective tax reduction due to rounding in the calculation process.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Basic Deduction (基本控除):</strong> {formatJPY(results.furusatoNozei.residenceTaxDonationBasicDeduction)} (10% of donation amount minus 2,000 yen)
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Special Deduction (特例控除):</strong> {formatJPY(results.furusatoNozei.residenceTaxSpecialDeduction)} (remaining amount to keep out-of-pocket cost at 2,000 yen, up to a limit)
                    </Typography>
                    <Typography variant="body2">
                      The residence tax reduction is calculated as the difference in residence tax with and without the above tax credits.
                    </Typography>
                  </Box>
                }
              />
            </span>
          }
          value={formatJPY(results.furusatoNozei.residenceTaxReduction)}
          type="indented" 
        />
        
        {/* Municipal and Prefectural breakdown */}
        <ResultRow
          label="Municipal tax credit"
          value={formatJPY(Math.round((results.furusatoNozei.residenceTaxDonationBasicDeduction + results.furusatoNozei.residenceTaxSpecialDeduction) * results.residenceTax.cityProportion))}
          type="detail" 
        />
        
        <ResultRow
          label="Prefectural tax credit"
          value={formatJPY(Math.round((results.furusatoNozei.residenceTaxDonationBasicDeduction + results.furusatoNozei.residenceTaxSpecialDeduction) * results.residenceTax.prefecturalProportion))}
          type="detail" 
        />
        
        <ResultRow
          label="Total Tax Reduction"
          value={formatJPY(results.furusatoNozei.incomeTaxReduction + results.furusatoNozei.residenceTaxReduction)}
          type="subtotal" 
        />
        <ResultRow
          label={
            <span style={{ display: 'flex', alignItems: 'center' }}>
              Out-of-Pocket Cost
              {results.furusatoNozei.outOfPocketCost > 2200 && (
                <WarningIcon 
                  fontSize="small" 
                  sx={{ 
                    ml: 0.5, 
                    color: 'error.main',
                    fontSize: '1rem'
                  }} 
                />
              )}
            </span>
          }
          value={
            <Box 
              component="span" 
              sx={{ 
                color: results.furusatoNozei.outOfPocketCost > 2200 ? 'error.main' : 'inherit', 
                fontWeight: results.furusatoNozei.outOfPocketCost > 2200 ? 700 : 500,
                display: 'inline-flex',
                alignItems: 'center'
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
          value={`≈ ${formatJPY(estimatedValueOfGifts)}`}
          type="indented" 
        />
        
        <ResultRow
          label="Out-of-Pocket Cost"
          value={formatJPY(-results.furusatoNozei.outOfPocketCost)}
          type="indented" 
        />
        
        <ResultRow
          label="Net Estimated Benefit"
          value={`≈ ${formatJPY(estimatedValueOfGifts - results.furusatoNozei.outOfPocketCost)}`}
          type="subtotal" 
        />
        
        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', mt: 1, display: 'block' }}>
          * Estimated at {FURUSATO_NOZEI_AVERAGE_GIFT_COST_PERCENTAGE * 100}% of donation amount, based on the{' '}
          <a 
            href="https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/archive/#ac02" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            average Furusato Nozei gift cost
          </a>.
        </Typography>
      </Box>

      {/* Warning for high out-of-pocket cost */}
      {results.furusatoNozei.outOfPocketCost > 2200 && (
        <Box sx={{ 
          bgcolor: 'error.light', 
          color: 'error.contrastText', 
          p: 2, 
          borderRadius: 2,
          mt: 2
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            ⚠️ Warning: High Out-of-Pocket Cost
          </Typography>
          <Typography variant="body2">
            Your out-of-pocket cost is higher than the expected ≈2,000 yen. This happens if you file a tax return (確定申告) when your taxable income changes income tax brackets after applying the Furusato Nozei donation deduction.
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
            This issue is avoided if you use the One-Stop Exception system (ワンストップ特例制度).
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default FurusatoNozeiTab;
