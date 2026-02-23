// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Collapse from '@mui/material/Collapse';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type { TakeHomeResults, TakeHomeInputs } from '../../../types/tax';
import type { DependentDeductionResults } from '../../../types/dependents';
import { formatJPY } from '../../../utils/formatters';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { DetailedTooltip } from '../../ui/Tooltips';
import { ResultRow } from '../ResultRow';
import EmploymentIncomeDeductionTooltip from './EmploymentIncomeDeductionTooltip';

interface TaxesTabProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

interface DependentDeductionTooltipProps {
  deductions: DependentDeductionResults;
}

const NationalTaxDependentDeductionTooltip: React.FC<DependentDeductionTooltipProps> = ({ deductions }) => (
  <Box sx={{ minWidth: { xs: 0, sm: 350 }, maxWidth: { xs: '100vw', sm: 500 } }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
      Applied Deductions Breakdown
    </Typography>
    {deductions.breakdown.filter(b => b.nationalTaxAmount > 0).length > 0 ? (
      <TableContainer component={Box} sx={{ mb: 2 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '2px 6px', fontSize: '0.95em' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Dependent / Type</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deductions.breakdown.filter(b => b.nationalTaxAmount > 0).map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div style={{ fontWeight: 500 }}>{item.deductionType}</div>
                </TableCell>
                <TableCell align="right">{formatJPY(item.nationalTaxAmount)}</TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{formatJPY(deductions.nationalTax.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    ) : (
      <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
        No dependent deductions applied.
      </Typography>
    )}



    <Box sx={{ mt: 1 }}>
      Official NTA Sources:
      <ul>
        <li><a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>扶養控除 (Dependent Deduction)</a></li>
        <li><a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>特定親族特別控除 (Specific Relative Special Deduction)</a></li>
        <li><a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>配偶者控除 (Spouse Deduction)</a></li>
        <li><a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>配偶者特別控除 (Spouse Special Deduction)</a></li>
        <li><a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>障害者控除 (Disability Deduction)</a></li>
      </ul>
    </Box>
  </Box>
);

const ResidenceTaxDependentDeductionTooltip: React.FC<DependentDeductionTooltipProps> = ({ deductions }) => (
  <Box sx={{ minWidth: { xs: 0, sm: 350 }, maxWidth: { xs: '100vw', sm: 500 } }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
      Applied Deductions Breakdown
    </Typography>
    {deductions.breakdown.filter(b => b.residenceTaxAmount > 0).length > 0 ? (
      <TableContainer component={Box} sx={{ mb: 2 }}>
        <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '2px 6px', fontSize: '0.95em' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Dependent / Type</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deductions.breakdown.filter(b => b.residenceTaxAmount > 0).map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div style={{ fontWeight: 500 }}>{item.deductionType}</div>
                </TableCell>
                <TableCell align="right">{formatJPY(item.residenceTaxAmount)}</TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>{formatJPY(deductions.residenceTax.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    ) : (
      <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
        No dependent deductions applied.
      </Typography>
    )}



    <Box sx={{ mt: 1 }}>
      Official Sources:
      <ul>
        <li><a href="https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>人的控除 (Residence tax deduction amounts - Nerima City)</a></li>
        <li><a href="https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/seido/8zeiseikaisei.html" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>令和7年度税制改正 (2025 Tax Reform - Nerima City)</a></li>
      </ul>
    </Box>
  </Box>
);

const TaxesTab: React.FC<TaxesTabProps> = ({ results, inputs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const totalSocialInsurance = results.socialInsuranceOverride ?? (results.healthInsurance + results.pensionPayments + (results.employmentInsurance ?? 0));
  // Almost taxable income but before applying the basic deduction
  const subtotalIncome = (results.totalNetIncome ?? results.annualIncome) - totalSocialInsurance - (results.dcPlanContributions ?? 0);
  const totalTaxes = results.nationalIncomeTax + results.residenceTax.totalResidenceTax;

  // Calculate separated gross income
  const grossEmploymentIncome = inputs.incomeStreams
    .filter(s => s.type === 'salary' || s.type === 'bonus' || s.type === 'stockCompensation')
    .reduce((sum, s) => sum + (s.type === 'salary' && s.frequency === 'monthly' ? s.amount * 12 : s.amount), 0);

  const businessAndMiscIncome = inputs.incomeStreams
    .filter(s => s.type === 'business' || s.type === 'miscellaneous')
    .reduce((sum, s) => sum + s.amount, 0);

  const hasEmploymentIncome = grossEmploymentIncome > 0;
  const hasBusinessOrMiscIncome = businessAndMiscIncome > 0;

  return (
    <Box>
      <Typography
        variant="h6"
        sx={{
          mb: 1,
          color: 'warning.main',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          fontSize: isMobile ? '1.1rem' : '1.25rem'
        }}
      >
        <AccountBalanceIcon sx={{ mr: 1, fontSize: isMobile ? 20 : 24, color: 'warning.main' }} />
        Tax Calculation Details
      </Typography>

      {/* Income Overview */}
      <Box sx={{ mb: 1 }}>
        {hasEmploymentIncome && results.netEmploymentIncome !== undefined && (
          <ResultRow
            label={
              <span>
                Net Employment Income
                <DetailedTooltip
                  title="Employment Income Details"
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Calculation Breakdown
                    </Typography>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '8px' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '2px 0' }}>Gross Employment Income:</td>
                          <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>{formatJPY(grossEmploymentIncome)}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '2px 0' }}>Employment Income Deduction:</td>
                          <td style={{ padding: '2px 0', textAlign: 'right', color: '#d32f2f' }}>-{formatJPY(grossEmploymentIncome - results.netEmploymentIncome)}</td>
                        </tr>
                        <tr style={{ borderTop: '1px solid #ddd' }}>
                          <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Employment Income:</td>
                          <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{formatJPY(results.netEmploymentIncome)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <EmploymentIncomeDeductionTooltip />
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(results.netEmploymentIncome)}
            type="default"
          />
        )}

        {hasBusinessOrMiscIncome && (
          <ResultRow
            label={
              <span>
                Net Business / Misc Income
                {results.blueFilerDeduction !== undefined && results.blueFilerDeduction > 0 && (
                  <DetailedTooltip
                    title="Business & Miscellaneous Income"
                  >
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Calculation Breakdown
                      </Typography>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '8px' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '2px 0' }}>Business/Miscellaneous Income:</td>
                            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>{formatJPY(businessAndMiscIncome)}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0' }}>Blue-Filer Deduction:</td>
                            <td style={{ padding: '2px 0', textAlign: 'right', color: '#d32f2f' }}>-{formatJPY(results.blueFilerDeduction)}</td>
                          </tr>
                          <tr style={{ borderTop: '1px solid #ddd' }}>
                            <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Business/Misc Income:</td>
                            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                              {formatJPY(results.totalNetIncome - (results.netEmploymentIncome ?? 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Blue-Filer Special Deduction
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          A special deduction for business operators with permission to file a Blue Return. This amount is deducted from business income after expenses before calculating taxable income.
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          Official Sources:
                          <ul>
                            <li>
                              <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                                青色申告特別控除 - NTA
                              </a>
                            </li>
                          </ul>
                        </Box>
                      </Box>
                    </Box>
                  </DetailedTooltip>
                )}
              </span>
            }
            // Value is Total Net - Net Employment (effectively Taxable Business/Misc)
            value={formatJPY(results.totalNetIncome - (results.netEmploymentIncome ?? 0))}
            type="default"
          />
        )}

        {/* Total Net Income Row */}
        {hasEmploymentIncome && hasBusinessOrMiscIncome &&
          <ResultRow label="Total Net Income" value={formatJPY(results.totalNetIncome)} type="subtotal" sx={{ mt: 0.5, mb: 0.5 }} />
        }

        {results.dcPlanContributions > 0 && (
          <ResultRow
            label={
              <span>
                iDeCo/Corp DC Deduction
                <DetailedTooltip
                  title="iDeCo and Corporate DC Contributions"
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Small Enterprise Mutual Aid Contribution Deduction (小規模企業共済等掛金控除)
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Contributions to iDeCo (individual defined contribution pension) and corporate defined contribution plans reduce your taxable income for income tax and residence tax.
                      Employer contributions cannot be included in this deduction.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      Official Sources:
                      <ul>
                        <li>
                          <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1135.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', fontSize: '0.95em' }}>
                            小規模企業共済等掛金控除 (NTA)
                          </a>
                        </li>
                        <li>
                          <a href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/kyoshutsu/gaiyou.html" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', fontSize: '0.95em' }}>
                            確定拠出年金制度の概要 (MHLW)
                          </a>
                        </li>
                      </ul>
                    </Box>
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(-results.dcPlanContributions)}
            type="default"
          />
        )}

        <ResultRow label="Social Insurance Deduction" value={formatJPY(-totalSocialInsurance)} type="default" />
        <ResultRow label="Subtotal Taxable Income" value={formatJPY(subtotalIncome)} type="subtotal" sx={{ mt: 0.5 }} />
      </Box>

      {/* Income Tax Calculation */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ mb: 1, fontSize: '1.1rem', fontWeight: 600 }}>
          Income Tax Calculation
        </Typography>

        <ResultRow
          label={
            <span>
              Basic Deduction
              <DetailedTooltip
                title="National Income Tax Basic Deduction"
              >
                <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 420 } }}>
                  <Box
                    component="table"
                    sx={{
                      width: '100%',
                      fontSize: '0.95em',
                      borderCollapse: 'collapse',
                      '& td': {
                        padding: '2px 6px'
                      },
                      '& th': {
                        borderBottom: '1px solid #ccc',
                        padding: '2px 6px',
                        textAlign: 'left'
                      }
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Net Income (¥)</th>
                        <th>Deduction Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Up to 1,320,000</td>
                        <td>950,000</td>
                      </tr>
                      <tr>
                        <td>Up to 3,360,000</td>
                        <td>880,000</td>
                      </tr>
                      <tr>
                        <td>Up to 4,890,000</td>
                        <td>680,000</td>
                      </tr>
                      <tr>
                        <td>Up to 6,550,000</td>
                        <td>630,000</td>
                      </tr>
                      <tr>
                        <td>Up to 23,500,000</td>
                        <td>580,000</td>
                      </tr>
                      <tr>
                        <td>Up to 24,000,000</td>
                        <td>480,000</td>
                      </tr>
                      <tr>
                        <td>Up to 24,500,000</td>
                        <td>320,000</td>
                      </tr>
                      <tr>
                        <td>Up to 25,000,000</td>
                        <td>160,000</td>
                      </tr>
                      <tr>
                        <td>Over 25,000,000</td>
                        <td>0</td>
                      </tr>
                    </tbody>
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    Official Sources (NTA):
                    <ul>
                      <li>
                        <a href="https://www.nta.go.jp/users/gensen/2025kiso/index.htm#a-01" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                          令和７年度税制改正による所得税の基礎控除の見直し等について
                        </a>
                      </li>
                      <li>
                        <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                          基礎控除
                        </a>
                      </li>
                    </ul>
                  </Box>
                </Box>
              </DetailedTooltip>
            </span>
          }
          value={formatJPY(-(results.nationalIncomeTaxBasicDeduction ?? 0))}
          type="detail"
        />

        {results.dependentDeductions && results.dependentDeductions.nationalTax.total > 0 && (
          <ResultRow
            label={
              <span>
                Dependent Deductions
                <DetailedTooltip
                  title="Dependent-Related Deductions (National Tax)"
                >
                  <NationalTaxDependentDeductionTooltip deductions={results.dependentDeductions} />
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(-results.dependentDeductions.nationalTax.total)}
            type="detail"
          />
        )}

        {results.taxableIncomeForNationalIncomeTax !== undefined && (
          <ResultRow
            label={
              <span>
                Taxable Income
                <DetailedTooltip
                  title="Taxable Income for National Income Tax"
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Taxable Income Calculation
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Taxable income is calculated by subtracting all applicable deductions from your net income.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Formula:</strong> Net Income - Applicable Deductions = Taxable Income
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Rounding:</strong> The taxable income is rounded down to the nearest 1,000 yen before applying tax rates.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      Official Sources:
                      <ul>
                        <li>
                          <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                            所得税の税率 - NTA
                          </a>
                        </li>
                      </ul>
                    </Box>
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(results.taxableIncomeForNationalIncomeTax)} type="detail-subtotal" sx={{ mt: 0.5 }} />
        )}

        {results.nationalIncomeTaxBase !== undefined && (
          <ResultRow
            label={
              <span>
                Base Income Tax
                <DetailedTooltip
                  title="Base Income Tax"
                >
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      This is the income tax calculated using the standard progressive tax brackets, before applying the special reconstruction surtax.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Box
                        component="table"
                        sx={{
                          borderCollapse: 'collapse',
                          width: '100%',
                          fontSize: '0.95em',
                          '& td': {
                            padding: '2px 6px'
                          },
                          '& th': {
                            borderBottom: '1px solid #ccc',
                            padding: '2px 6px',
                            textAlign: 'left'
                          }
                        }}
                      >
                        <thead>
                          <tr>
                            <th>Taxable Income (¥)</th>
                            <th>Tax Rate</th>
                            <th>Deduction (¥)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Up to 1,949,000</td>
                            <td>5%</td>
                            <td>0</td>
                          </tr>
                          <tr>
                            <td>1,949,001 - 3,299,000</td>
                            <td>10%</td>
                            <td>97,500</td>
                          </tr>
                          <tr>
                            <td>3,299,001 - 6,949,000</td>
                            <td>20%</td>
                            <td>427,500</td>
                          </tr>
                          <tr>
                            <td>6,949,001 - 8,999,000</td>
                            <td>23%</td>
                            <td>636,000</td>
                          </tr>
                          <tr>
                            <td>8,999,001 - 17,999,000</td>
                            <td>33%</td>
                            <td>1,536,000</td>
                          </tr>
                          <tr>
                            <td>17,999,001 - 39,999,000</td>
                            <td>40%</td>
                            <td>2,796,000</td>
                          </tr>
                          <tr>
                            <td>40,000,000 and above</td>
                            <td>45%</td>
                            <td>4,796,000</td>
                          </tr>
                        </tbody>
                      </Box>
                      <Box sx={{ mt: 1 }}>
                        Official Sources:
                        <ul>
                          <li>
                            <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                              所得税の税率 - NTA
                            </a>
                          </li>
                        </ul>
                      </Box>
                    </Box>
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(results.nationalIncomeTaxBase)}
            type="detail"
          />
        )}

        {results.reconstructionSurtax !== undefined && (
          <ResultRow
            label={
              <span>
                Reconstruction Surtax
                <DetailedTooltip
                  title="Special Reconstruction Surtax"
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      復興特別所得税
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      A temporary surtax of 2.1% applied to the base income tax amount. Originally introduced to help fund reconstruction efforts after the 2011 Great East Japan Earthquake and tsunami.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Rate:</strong> 2.1% of base income tax
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Period:</strong> January 1, 2013 - December 31, 2037 (25 years)
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      Official Sources:
                      <ul>
                        <li>
                          <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                            所得税の税率 - NTA
                          </a>
                        </li>
                        <li>
                          <a href="https://www.nta.go.jp/publication/pamph/shotoku/fukko_tokubetsu/index.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                            個人の方に係る復興特別所得税のあらまし - NTA
                          </a>
                        </li>
                      </ul>
                    </Box>
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(results.reconstructionSurtax)}
            type="detail"
          />
        )}

        <ResultRow
          label={
            <span>
              Total Income Tax
              <DetailedTooltip
                title="Total Income Tax Calculation"
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Total Income Tax = Base Income Tax + Reconstruction Surtax
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Rounding:</strong> The sum of base income tax and surtax is rounded down to the nearest 100 yen for the final amount.
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    Official Sources:
                    <ul>
                      <li>
                        <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                          所得税の税率 - NTA
                        </a>
                      </li>
                    </ul>
                  </Box>
                </Box>
              </DetailedTooltip>
            </span>
          }
          value={formatJPY(results.nationalIncomeTax)}
          type="subtotal"
        />
      </Box>

      {/* Residence Tax Calculation */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ mb: 1, fontSize: '1.1rem', fontWeight: 600 }}>
          Residence Tax Calculation
        </Typography>

        {/* Detailed breakdown toggle */}
        <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={showDetailedBreakdown}
                onChange={(e) => setShowDetailedBreakdown(e.target.checked)}
                size="small"
                color="primary"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                Show detailed breakdown
              </Typography>
            }
            sx={{
              '& .MuiFormControlLabel-label': {
                fontSize: '0.85rem'
              }
            }}
          />
        </Box>

        <ResultRow
          label={
            <span>
              Basic Deduction
              <DetailedTooltip
                title="Residence Tax Basic Deduction"
              >
                <>
                  <Box
                    component="table"
                    sx={{
                      borderCollapse: 'collapse',
                      width: '100%',
                      fontSize: '0.95em',
                      '& td': {
                        padding: '2px 6px'
                      },
                      '& th': {
                        borderBottom: '1px solid #ccc',
                        padding: '2px 6px',
                        textAlign: 'left'
                      }
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Net Income (¥)</th>
                        <th>Deduction Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Up to 24,000,000</td>
                        <td>430,000</td>
                      </tr>
                      <tr>
                        <td>24,000,001 - 24,500,000</td>
                        <td>290,000</td>
                      </tr>
                      <tr>
                        <td>24,500,001 - 25,000,000</td>
                        <td>150,000</td>
                      </tr>
                      <tr>
                        <td>Over 25,000,000</td>
                        <td>0</td>
                      </tr>
                    </tbody>
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    <a href="https://www.city.yokohama.lg.jp/kurashi/koseki-zei-hoken/zeikin/y-shizei/kojin-shiminzei-kenminzei/kaisei/R3zeiseikaisei.html#4" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                      Official Source (Yokohama City)
                    </a>
                  </Box>
                </>
              </DetailedTooltip>
            </span>
          }
          value={formatJPY(-(results.residenceTaxBasicDeduction ?? 0))}
          type="detail"
        />

        {results.dependentDeductions && results.dependentDeductions.residenceTax.total > 0 && (
          <ResultRow
            label={
              <span>
                Dependent Deductions
                <DetailedTooltip
                  title="Dependent-Related Deductions (Residence Tax)"
                >
                  <ResidenceTaxDependentDeductionTooltip deductions={results.dependentDeductions} />
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(-results.dependentDeductions.residenceTax.total)}
            type="detail"
          />
        )}

        {results.taxableIncomeForResidenceTax !== undefined && (
          <ResultRow
            label={
              <span>
                Taxable Income
                <DetailedTooltip
                  title="Taxable Income for Residence Tax"
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Taxable Income Calculation
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Taxable income for residence tax is calculated by subtracting all applicable deductions from your net income.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Formula:</strong> Net Income - Applicable Deductions = Taxable Income
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Rounding:</strong> The taxable income is rounded down to the nearest 1,000 yen before applying tax rates.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      Official Sources:
                      <ul>
                        <li>
                          <a href="https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                            個人住民税 (Tokyo Bureau of Taxation)
                          </a>
                        </li>
                      </ul>
                    </Box>
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(results.taxableIncomeForResidenceTax)} type="detail-subtotal" sx={{ mt: 0.5 }} />
        )}

        {/* Income-based portion breakdown */}
        <ResultRow
          label={
            <span>
              Income-based Portion
              <DetailedTooltip
                title="Income-based Residence Tax"
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Income-based Portion (所得割): 10% of Taxable Income
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    This portion is calculated as a percentage of your taxable income and split between municipal and prefectural governments.
                  </Typography>
                  <Box
                    component="table"
                    sx={{
                      borderCollapse: 'collapse',
                      width: '100%',
                      fontSize: '0.95em',
                      '& td': {
                        padding: '2px 6px'
                      },
                      '& th': {
                        borderBottom: '1px solid #ccc',
                        padding: '2px 6px',
                        textAlign: 'left'
                      }
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Municipal Tax (市町村民税)</td>
                        <td>6%</td>
                      </tr>
                      <tr>
                        <td>Prefectural Tax (都道府県民税)</td>
                        <td>4%</td>
                      </tr>
                      <tr>
                        <td><strong>Total</strong></td>
                        <td><strong>10%</strong></td>
                      </tr>
                    </tbody>
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1.5, fontSize: '0.85em' }}>
                    <strong>Rounding:</strong> The municipal and prefectural portions are each rounded down to the nearest 100 yen after applying any tax credits.
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    Official Sources:
                    <ul>
                      <li>
                        <a href="https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                          個人住民税 (Tokyo Bureau of Taxation)
                        </a>
                      </li>
                    </ul>
                  </Box>
                </Box>
              </DetailedTooltip>
            </span>
          }
          value={formatJPY(results.residenceTax.city.cityIncomeTax + results.residenceTax.prefecture.prefecturalIncomeTax)}
          type="detail"
        />

        {/* Municipal/Prefectural breakdown for income-based portion */}
        <Collapse in={showDetailedBreakdown}>
          <Box sx={{ ml: 2, mb: 1 }}>
            <ResultRow
              label="Municipal portion (6%)"
              value={formatJPY(Math.round(results.residenceTax.taxableIncome * 0.06))}
              type="detail"
              sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
            />
            {results.residenceTax.city.cityAdjustmentCredit > 0 && (
              <ResultRow
                label={
                  <span>
                    Tax credit (municipal)
                    <DetailedTooltip
                      title="Municipal Tax Credits"
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Tax Credits Applied to Municipal Portion
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.9em' }}>
                          The following tax credits (税額控除) reduce the municipal portion of residence tax:
                        </Typography>

                        {/* Adjustment Credit */}
                        <Box sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Adjustment Credit (調整控除)
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.85em', mb: 0.5 }}>
                            Personal deduction difference: ¥{results.residenceTax.personalDeductionDifference.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.8em', color: 'text.secondary', mb: 0.5 }}>
                            The statutory personal deduction difference (defined in <a href="https://laws.e-gov.go.jp/law/325AC0000000226#Mp-At_314_6" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Local Tax Act Article 314-6</a>) accounts for differences between national and residence tax deduction amounts.
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.8em', color: 'text.secondary', mb: 1 }}>
                            The adjustment credit is calculated:
                          </Typography>

                          <Box sx={{ pl: 1, borderLeft: '2px solid #eee', mb: 1 }}>
                            <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                              If Taxable Income ≤ 2,000,000 JPY:
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                              Min(Difference, Taxable Income) × 5%
                            </Typography>

                            <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                              If Taxable Income &gt; 2,000,000 JPY:
                            </Typography>
                            <Typography variant="caption" display="block">
                              (Difference - (Taxable Income - 2,000,000)) × 5%
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontStyle: 'italic', mb: 0.5 }}>
                              (Minimum credit: 2,500 JPY)
                            </Typography>

                            <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: 'error.main' }}>
                              If Net Income &gt; 25,000,000 JPY, no credit.
                            </Typography>
                          </Box>

                          <Typography variant="body2" sx={{ fontSize: '0.85em', mb: 0.5 }}>
                            Municipal portion (60%): ¥{results.residenceTax.city.cityAdjustmentCredit.toLocaleString()}
                          </Typography>
                        </Box>

                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                          Total Municipal Tax Credit: ¥{results.residenceTax.city.cityAdjustmentCredit.toLocaleString()}
                        </Typography>
                      </Box>
                    </DetailedTooltip>
                  </span>
                }
                value={formatJPY(-results.residenceTax.city.cityAdjustmentCredit)}
                type="detail"
                sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
              />
            )}

            <ResultRow
              label="Prefectural portion (4%)"
              value={formatJPY(Math.round(results.residenceTax.taxableIncome * 0.04))}
              type="detail"
              sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
            />
            {results.residenceTax.prefecture.prefecturalAdjustmentCredit > 0 && (
              <ResultRow
                label={
                  <span>
                    Tax credit (prefectural)
                    <DetailedTooltip
                      title="Prefectural Tax Credits"
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Tax Credits Applied to Prefectural Portion
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1, fontSize: '0.9em' }}>
                          The following tax credits (税額控除) reduce the prefectural portion of residence tax:
                        </Typography>

                        {/* Adjustment Credit */}
                        <Box sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Adjustment Credit (調整控除)
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.85em', mb: 0.5 }}>
                            Personal deduction difference: ¥{results.residenceTax.personalDeductionDifference.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.8em', color: 'text.secondary', mb: 0.5 }}>
                            The statutory personal deduction difference (defined in <a href="https://laws.e-gov.go.jp/law/325AC0000000226#Mp-At_314_6" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Local Tax Act Article 314-6</a>) accounts for differences between national and residence tax deduction amounts.
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.8em', color: 'text.secondary', mb: 1 }}>
                            The adjustment credit is calculated:
                          </Typography>

                          <Box sx={{ pl: 1, borderLeft: '2px solid #eee', mb: 1 }}>
                            <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                              If Taxable Income ≤ 2,000,000 JPY:
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                              Min(Difference, Taxable Income) × 5%
                            </Typography>

                            <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                              If Taxable Income &gt; 2,000,000 JPY:
                            </Typography>
                            <Typography variant="caption" display="block">
                              (Difference - (Taxable Income - 2,000,000)) × 5%
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontStyle: 'italic', mb: 0.5 }}>
                              (Minimum credit: 2,500 JPY)
                            </Typography>

                            <Typography variant="caption" display="block" sx={{ fontWeight: 600, color: 'error.main' }}>
                              If Net Income &gt; 25,000,000 JPY, no credit.
                            </Typography>
                          </Box>

                          <Typography variant="body2" sx={{ fontSize: '0.85em', mb: 0.5 }}>
                            Prefectural portion (40%): ¥{results.residenceTax.prefecture.prefecturalAdjustmentCredit.toLocaleString()}
                          </Typography>
                        </Box>

                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                          Total Prefectural Tax Credit: ¥{results.residenceTax.prefecture.prefecturalAdjustmentCredit.toLocaleString()}
                        </Typography>
                      </Box>
                    </DetailedTooltip>
                  </span>
                }
                value={formatJPY(-results.residenceTax.prefecture.prefecturalAdjustmentCredit)}
                type="detail"
                sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
              />
            )}
          </Box>
        </Collapse>

        {/* Per capita portion */}
        <ResultRow
          label={
            <span>
              Per Capita Portion
              <DetailedTooltip
                title="Per Capita Residence Tax"
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Per Capita Portion (均等割): Fixed Amount
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    A fixed amount paid by all non-exempt residents, split among the following.
                  </Typography>
                  <Box
                    component="table"
                    sx={{
                      borderCollapse: 'collapse',
                      width: '100%',
                      fontSize: '0.95em',
                      '& td': {
                        padding: '2px 6px'
                      },
                      '& th': {
                        borderBottom: '1px solid #ccc',
                        padding: '2px 6px',
                        textAlign: 'left'
                      }
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Component</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Municipal Tax (市町村民税)</td>
                        <td>¥3,000</td>
                      </tr>
                      <tr>
                        <td>Prefectural Tax (都道府県民税)</td>
                        <td>¥1,000</td>
                      </tr>
                      <tr>
                        <td>Forest Environment Tax (森林環境税)</td>
                        <td>¥1,000</td>
                      </tr>
                      <tr>
                        <td><strong>Total</strong></td>
                        <td><strong>¥5,000</strong></td>
                      </tr>
                    </tbody>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 1, mt: 1 }}>
                    <strong>Purpose:</strong> Covers basic administrative costs and local services that benefit all residents equally.
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    Official Sources:
                    <ul>
                      <li>
                        <a href="https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                          個人住民税 (Tokyo Bureau of Taxation)
                        </a>
                      </li>
                    </ul>
                  </Box>
                </Box>
              </DetailedTooltip>
            </span>
          }
          value={formatJPY(results.residenceTax.perCapitaTax)}
          type="detail"
        />



        <ResultRow
          label="Total Residence Tax"
          value={formatJPY(results.residenceTax.totalResidenceTax)}
          type="subtotal"
        />
      </Box>

      {/* Total */}
      <Box sx={{ mt: 2 }}>
        <ResultRow
          label="Total Taxes"
          value={formatJPY(totalTaxes)}
          type="total"
        />
      </Box>
    </Box>
  );
};

export default TaxesTab;

