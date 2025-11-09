import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Collapse from '@mui/material/Collapse';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import type { TakeHomeResults } from '../../../types/tax';
import { formatJPY } from '../../../utils/formatters';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DetailInfoTooltip from '../../ui/DetailInfoTooltip';
import { ResultRow } from '../ResultRow';

interface TaxesTabProps {
  results: TakeHomeResults;
}

// Reusable tooltip content for employment income deduction
const EmploymentIncomeDeductionTooltip: React.FC = () => (
  <Box>
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
      2025 Employment Income Deduction Table
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
          <th>Gross Employment Income (¥)</th>
          <th>Deduction Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Up to 1,900,000</td>
          <td>650,000</td>
        </tr>
        <tr>
          <td>1,900,001 – 3,600,000</td>
          <td>30% of income + 80,000</td>
        </tr>
        <tr>
          <td>3,600,001 – 6,600,000</td>
          <td>20% of income + 440,000</td>
        </tr>
        <tr>
          <td>6,600,001 – 8,500,000</td>
          <td>10% of income + 1,100,000</td>
        </tr>
        <tr>
          <td>8,500,001 and above</td>
          <td>1,950,000 (max)</td>
        </tr>
      </tbody>
    </Box>
    <Box sx={{ mt: 1 }}>
      Official Sources:
      <ul>
        <li>
          <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
            No.1410 給与所得控除 - NTA
          </a>
        </li>
        <li>
          <a href="https://www.nta.go.jp/english/taxes/individual/12012.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
            No.12012 Overview of deduction for employment income - NTA (English)
          </a>
        </li>
        <li>
          <a href="https://www.nta.go.jp/users/gensen/2025kiso/index.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
            令和７年度税制改正による所得税の基礎控除の見直し等について - NTA
          </a>
        </li>
        <li>
          <a href="https://www.city.yokohama.lg.jp/kurashi/koseki-zei-hoken/zeikin/y-shizei/kojin-shiminzei-kenminzei/R7kaisei.html" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
            令和７年度税制改正（いわゆる年収の壁への対応）の概要 - Yokohama City
          </a>
        </li>
      </ul>
    </Box>
  </Box>
);

const TaxesTab: React.FC<TaxesTabProps> = ({ results }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);

  const totalSocialInsurance = results.healthInsurance + results.pensionPayments + (results.employmentInsurance ?? 0);
  // Almost taxable income but before applying the basic deduction
  const subtotalIncome = (results.netEmploymentIncome ?? results.annualIncome) - totalSocialInsurance - (results.dcPlanContributions ?? 0);
  const totalTaxes = results.nationalIncomeTax + results.residenceTax.totalResidenceTax;

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
        <ResultRow label={results.isEmploymentIncome ? "Gross Employment Income" : "Net Annual Income"} value={formatJPY(results.annualIncome)} type="header" />

        {results.isEmploymentIncome && results.netEmploymentIncome !== undefined && (
          <ResultRow 
            label={
              <span>
                Net Employment Income
                <DetailInfoTooltip 
                  title="Employment Income Deduction Table"
                  children={<EmploymentIncomeDeductionTooltip />} 
                />
              </span>
            }
            value={formatJPY(results.netEmploymentIncome)} 
            type="default" 
          />
        )}

        {results.dcPlanContributions > 0 && (
          <ResultRow 
            label={
              <span>
                iDeCo/Corp DC Deduction
                <DetailInfoTooltip
                  title="iDeCo and Corporate DC Contributions (小規模企業共済等掛金控除)"
                  children={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Small Enterprise Mutual Aid Contribution Deduction
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
                  }
                />
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
              <DetailInfoTooltip
                title="National Income Tax Basic Deduction"
                children={
                  <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 420 } }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      National Income Tax Basic Deduction (2025)
                    </Typography>
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
                            No.1199 基礎控除
                          </a>
                        </li>
                      </ul>
                    </Box>
                  </Box>
                }
              />
            </span>
          }
          value={formatJPY(-(results.nationalIncomeTaxBasicDeduction ?? 0))} 
          type="detail" 
        />
        
        {results.dependentDeductions && results.dependentDeductions.nationalTaxTotal > 0 && (
          <ResultRow 
            label={
              <span>
                Dependent Deductions
                <DetailInfoTooltip
                  title="Dependent-Related Deductions"
                  children={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Dependent-Related Deductions for Income Tax
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        These deductions include spouse deductions, dependent deductions, and disability deductions based on your household composition.
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        Official Sources:
                        <ul>
                          <li>
                            <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                              配偶者控除 - NTA
                            </a>
                          </li>
                          <li>
                            <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                              扶養控除 - NTA
                            </a>
                          </li>
                          <li>
                            <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                              障害者控除 - NTA
                            </a>
                          </li>
                        </ul>
                      </Box>
                    </Box>
                  }
                />
              </span>
            }
            value={formatJPY(-results.dependentDeductions.nationalTaxTotal)} 
            type="detail" 
          />
        )}
        
        {results.taxableIncomeForNationalIncomeTax !== undefined && (
          <ResultRow 
            label={
              <span>
                Taxable Income
                <DetailInfoTooltip
                  title="Taxable Income for National Income Tax"
                  children={
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
                              No.2260 所得税の税率 - NTA
                            </a>
                          </li>
                        </ul>
                      </Box>
                    </Box>
                  }
                />
              </span>
            }
            value={formatJPY(results.taxableIncomeForNationalIncomeTax)} type="detail-subtotal" sx={{ mt: 0.5 }} />
        )}
        
        {results.nationalIncomeTaxBase !== undefined && (
          <ResultRow 
            label={
              <span>
                Base Income Tax
                <DetailInfoTooltip
                  title="Base Income Tax Calculation"
                  children={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Base Income Tax (before reconstruction surtax)
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        This is the income tax calculated using the standard progressive tax brackets.
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          2025 Income Tax Brackets:
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
                                No.2260 所得税の税率 - NTA
                              </a>
                            </li>
                          </ul>
                        </Box>
                      </Box>
                    </Box>
                  }
                />
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
                <DetailInfoTooltip
                  title="Special Reconstruction Surtax (復興特別所得税)"
                  children={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Special Reconstruction Surtax (復興特別所得税)
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
                              No.2260 所得税の税率 - NTA
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
                  }
                />
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
              <DetailInfoTooltip
                title="Total Income Tax Calculation"
                children={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Total Income Tax = Base Income Tax + Reconstruction Surtax
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      The total income tax is calculated by adding the base income tax (calculated using progressive tax brackets) and the 2.1% reconstruction surtax.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Rounding:</strong> The sum of base tax + surtax is rounded down to the nearest 100 yen for the final amount.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      Official Sources:
                      <ul>
                        <li>
                          <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                            No.2260 所得税の税率 - NTA
                          </a>
                        </li>
                      </ul>
                    </Box>
                  </Box>
                }
              />
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
              <DetailInfoTooltip
                title="Residence Tax Basic Deduction"
                children={
                  <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 420 } }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Residence Tax Basic Deduction (2025)
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
                  </Box>
                }
              />
            </span>
          }
          value={formatJPY(-(results.residenceTaxBasicDeduction ?? 0))} 
          type="detail" 
        />
        
        {results.dependentDeductions && results.dependentDeductions.residenceTaxTotal > 0 && (
          <ResultRow 
            label={
              <span>
                Dependent Deductions
                <DetailInfoTooltip
                  title="Dependent-Related Deductions"
                  children={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Dependent-Related Deductions for Residence Tax
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        These deductions include spouse deductions, dependent deductions, and disability deductions based on your household composition.
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        Official Sources:
                        <ul>
                          <li>
                            <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                              配偶者控除 - NTA
                            </a>
                          </li>
                          <li>
                            <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                              扶養控除 - NTA
                            </a>
                          </li>
                          <li>
                            <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                              障害者控除 - NTA
                            </a>
                          </li>
                        </ul>
                      </Box>
                    </Box>
                  }
                />
              </span>
            }
            value={formatJPY(-results.dependentDeductions.residenceTaxTotal)} 
            type="detail" 
          />
        )}
        
        {results.taxableIncomeForResidenceTax !== undefined && (
          <ResultRow 
            label={
              <span>
                Taxable Income
                <DetailInfoTooltip
                  title="Taxable Income for Residence Tax"
                  children={
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
                  }
                />
              </span>
            }
            value={formatJPY(results.taxableIncomeForResidenceTax)} type="detail-subtotal" sx={{ mt: 0.5 }} />
        )}
        
        {/* Income-based portion breakdown */}
        <ResultRow 
          label={
            <span>
              Income-based Portion
              <DetailInfoTooltip
                title="Income-based Residence Tax Breakdown"
                children={
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
                    <Typography variant="body2" sx={{ mt: 1, fontSize: '0.85em' }}>
                      Note: Small adjustment credits (調整控除) may apply to reduce the final amount.
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, fontSize: '0.85em' }}>
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
                }
              />
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
                label="Adjustment credit"
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
                label="Adjustment credit"
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
              <DetailInfoTooltip
                title="Per Capita Residence Tax"
                children={
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Per Capita Portion (均等割): Fixed Annual Amount
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      A fixed amount paid by all residents regardless of income level, split between municipal, prefectural, and forest environment taxes.
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
                }
              />
            </span>
          }
          value={formatJPY(results.residenceTax.perCapitaTax)} 
          type="detail" 
        />
        
        {/* Municipal/Prefectural breakdown for per capita portion */}
        <Collapse in={showDetailedBreakdown}>
          <Box sx={{ ml: 2, mb: 1 }}>
            <ResultRow 
              label="Municipal portion"
              value={formatJPY(results.residenceTax.city.cityPerCapitaTax)} 
              type="detail" 
              sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
            />
            <ResultRow 
              label="Prefectural portion"
              value={formatJPY(results.residenceTax.prefecture.prefecturalPerCapitaTax)} 
              type="detail" 
              sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
            />
            <ResultRow 
              label="Forest Environment Tax"
              value={formatJPY(results.residenceTax.forestEnvironmentTax)} 
              type="detail" 
              sx={{ fontSize: '0.85rem', color: 'text.secondary' }}
            />
          </Box>
        </Collapse>
        
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
