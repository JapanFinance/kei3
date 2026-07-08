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
import WarningIcon from '@mui/icons-material/Warning';
import { DetailedTooltip } from '../../ui/Tooltips';
import SourceLinks from '../../ui/SourceLinks';
import ReferenceTable from '../../ui/ReferenceTable';
import HighlightedRowValue from '../../ui/HighlightedRowValue';
import { ResultRow } from '../ResultRow';
import NetEmploymentIncomeTooltip from './NetEmploymentIncomeTooltip';
import AdditionalDeductionsTooltip from './AdditionalDeductionsTooltip';
import AdjustmentCreditTooltip from './AdjustmentCreditTooltip';
import { getNationalBasicDeductionTiers } from '../../../data/nationalBasicDeduction';
import {
  buildNationalBasicDeductionRows,
  getNationalBasicDeductionHighlightIndex,
  buildResidenceBasicDeductionRows,
  getResidenceBasicDeductionHighlightIndex,
  buildNationalIncomeTaxBracketRows,
  getNationalIncomeTaxBracketHighlightIndex,
} from './referenceTableHighlight';

interface TaxesTabProps {
  results: TakeHomeResults;
  inputs: TakeHomeInputs;
}

interface DependentDeductionTooltipProps {
  deductions: DependentDeductionResults;
  taxType: 'national' | 'residence';
}

const DependentDeductionTooltip: React.FC<DependentDeductionTooltipProps> = ({
  deductions,
  taxType,
}) => {
  const isNational = taxType === 'national';
  const rows = deductions.breakdown.filter(b =>
    isNational ? b.nationalTaxAmount > 0 : b.residenceTaxAmount > 0,
  );
  const total = isNational ? deductions.nationalTax.total : deductions.residenceTax.total;
  const getAmount = (item: (typeof deductions.breakdown)[number]) =>
    isNational ? item.nationalTaxAmount : item.residenceTaxAmount;

  return (
    <Box sx={{ minWidth: { xs: 0, sm: 350 }, maxWidth: { xs: '100vw', sm: 500 } }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Applied Deductions Breakdown
      </Typography>
      {rows.length > 0 ? (
        <TableContainer component={Box} sx={{ mb: 2 }}>
          <Table
            size="small"
            sx={{ '& .MuiTableCell-root': { padding: '2px 6px', fontSize: '0.95em' } }}
          >
            <TableHead>
              <TableRow>
                <TableCell>Dependent / Type</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div style={{ fontWeight: 500 }}>{item.deductionType}</div>
                  </TableCell>
                  <TableCell align="right">{formatJPY(getAmount(item))}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatJPY(total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
          No dependent deductions applied.
        </Typography>
      )}
      {isNational ? (
        <SourceLinks
          heading="Official Sources (NTA)"
          sources={[
            {
              href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1180.htm',
              label: '扶養控除 (Dependent Deduction)',
            },
            {
              href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1177.htm',
              label: '特定親族特別控除 (Specific Relative Special Deduction)',
            },
            {
              href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm',
              label: '配偶者控除 (Spouse Deduction)',
            },
            {
              href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm',
              label: '配偶者特別控除 (Spouse Special Deduction)',
            },
            {
              href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm',
              label: '障害者控除 (Disability Deduction)',
            },
          ]}
        />
      ) : (
        <SourceLinks
          sources={[
            {
              href: 'https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/shotokukojo/jintekikojo.html',
              label: '人的控除 (Residence tax deduction amounts - Nerima City)',
            },
            {
              href: 'https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/seido/8zeiseikaisei.html',
              label: '令和7年度税制改正 (2025 Tax Reform - Nerima City)',
            },
          ]}
        />
      )}
    </Box>
  );
};

const TaxesTab: React.FC<TaxesTabProps> = ({ results, inputs }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const totalSocialInsurance =
    results.socialInsuranceOverride ??
    results.healthInsurance + results.pensionPayments + (results.employmentInsurance ?? 0);
  // Almost taxable income but before applying the basic deduction
  const subtotalIncome =
    results.totalNetIncome - totalSocialInsurance - results.dcPlanContributions;
  const totalTaxes = results.nationalIncomeTax + results.residenceTax.totalResidenceTax;
  const incomeYear = inputs.incomeYear;
  const basicDeductionTiers = getNationalBasicDeductionTiers(incomeYear);

  // Which reference-table row applies to this taxpayer (undefined → highlight nothing). Basic
  // deductions key off 合計所得金額; the income-tax bracket off the (already 1,000-floored) taxable
  // income. Guard on a positive value so a zero-income result doesn't highlight a misleading row.
  const nationalBasicDeductionHighlight =
    results.totalNetIncome > 0
      ? getNationalBasicDeductionHighlightIndex(basicDeductionTiers, results.totalNetIncome)
      : undefined;
  const residenceBasicDeductionHighlight =
    results.totalNetIncome > 0
      ? getResidenceBasicDeductionHighlightIndex(results.totalNetIncome)
      : undefined;
  const incomeTaxBracketHighlight =
    results.taxableIncomeForNationalIncomeTax !== undefined &&
    results.taxableIncomeForNationalIncomeTax > 0
      ? getNationalIncomeTaxBracketHighlightIndex(results.taxableIncomeForNationalIncomeTax)
      : undefined;

  const businessAndMiscIncome = inputs.incomeStreams
    .filter(s => s.type === 'business' || s.type === 'miscellaneous')
    .reduce((sum, s) => sum + s.amount, 0);

  const hasEmploymentIncome = results.grossEmploymentIncome > 0;
  const hasBusinessOrMiscIncome = businessAndMiscIncome > 0;

  // Residence income-based portion (所得割). When a home loan credit spills over to
  // residence tax, show the portion BEFORE the spillover and the spillover as its own
  // row so the line items sum to the total (otherwise the portion is already net of it).
  const residenceIncomeBasedPost =
    results.residenceTax.city.cityIncomeTax + results.residenceTax.prefecture.prefecturalIncomeTax;
  const residenceIncomeBasedPre =
    results.residenceTaxIncomeBasedBeforeHomeLoanCredit ?? residenceIncomeBasedPost;
  const hasHomeLoanResidenceSpillover = (results.homeLoanTaxCredit?.appliedToResidenceTax ?? 0) > 0;
  const residenceIncomeBasedDisplayed = hasHomeLoanResidenceSpillover
    ? residenceIncomeBasedPre
    : residenceIncomeBasedPost;
  // Exact reduction (pre − post) so the displayed rows reconcile to the total.
  const homeLoanResidenceReduction = residenceIncomeBasedPre - residenceIncomeBasedPost;

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
          fontSize: isMobile ? '1.1rem' : '1.25rem',
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
                <NetEmploymentIncomeTooltip
                  grossEmploymentIncome={results.grossEmploymentIncome}
                  netEmploymentIncome={results.netEmploymentIncome}
                  incomeAdjustmentDeduction={results.incomeAdjustmentDeduction ?? 0}
                  year={incomeYear}
                />
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
                  <DetailedTooltip title="Business & Miscellaneous Income">
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Calculation Breakdown
                      </Typography>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '0.9rem',
                          marginBottom: '8px',
                        }}
                      >
                        <tbody>
                          <tr>
                            <td style={{ padding: '2px 0' }}>Business/Miscellaneous Income:</td>
                            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 500 }}>
                              {formatJPY(businessAndMiscIncome)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0' }}>Blue-Filer Deduction:</td>
                            <Box
                              component="td"
                              sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}
                            >
                              -{formatJPY(results.blueFilerDeduction)}
                            </Box>
                          </tr>
                          <Box
                            component="tr"
                            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                          >
                            <td style={{ padding: '4px 0', fontWeight: 600 }}>
                              Net Business/Misc Income:
                            </td>
                            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>
                              {formatJPY(
                                results.totalNetIncome - (results.netEmploymentIncome ?? 0),
                              )}
                            </td>
                          </Box>
                        </tbody>
                      </table>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Blue-Filer Special Deduction
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          A special deduction for business operators with permission to file a Blue
                          Return. This amount is deducted from business income after expenses before
                          calculating taxable income.
                        </Typography>
                        <SourceLinks
                          sources={[
                            {
                              href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm',
                              label: '青色申告特別控除 - NTA',
                            },
                          ]}
                        />
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
        {hasEmploymentIncome && hasBusinessOrMiscIncome && (
          <ResultRow
            label="Total Net Income"
            value={formatJPY(results.totalNetIncome)}
            type="subtotal"
          />
        )}

        {results.dcPlanContributions > 0 && (
          <ResultRow
            label={
              <span>
                iDeCo/Corp DC Deduction
                <DetailedTooltip title="iDeCo and Corporate DC Contributions">
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Small Enterprise Mutual Aid Contribution Deduction (小規模企業共済等掛金控除)
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Contributions to iDeCo (individual defined contribution pension) and corporate
                      defined contribution plans reduce taxable income for income tax and residence
                      tax. Employer contributions cannot be included in this deduction.
                    </Typography>
                    <SourceLinks
                      sources={[
                        {
                          href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1135.htm',
                          label: '小規模企業共済等掛金控除 (NTA)',
                        },
                        {
                          href: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/kyoshutsu/gaiyou.html',
                          label: '確定拠出年金制度の概要 (MHLW)',
                        },
                      ]}
                    />
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(-results.dcPlanContributions)}
            type="default"
          />
        )}

        <ResultRow
          label="Social Insurance Deduction"
          value={formatJPY(-totalSocialInsurance)}
          type="default"
        />
        <ResultRow
          label="Subtotal Taxable Income"
          value={formatJPY(subtotalIncome)}
          type="subtotal"
        />
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
              <DetailedTooltip title="National Income Tax Basic Deduction">
                <Box sx={{ minWidth: { xs: 0, sm: 320 }, maxWidth: { xs: '100vw', sm: 420 } }}>
                  <HighlightedRowValue label="Net income" value={results.totalNetIncome} />
                  <ReferenceTable
                    headers={['Net Income (¥)', 'Deduction Amount']}
                    highlightedRow={nationalBasicDeductionHighlight}
                    rows={buildNationalBasicDeductionRows(basicDeductionTiers)}
                  />
                  <SourceLinks
                    heading="Official Sources (NTA)"
                    sources={[
                      {
                        href: 'https://www.nta.go.jp/users/gensen/2025kiso/index.htm#a-01',
                        label: '令和７年度税制改正による所得税の基礎控除の見直し等について',
                      },
                      {
                        href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm',
                        label: '基礎控除',
                      },
                    ]}
                  />
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
                <DetailedTooltip title="Dependent-Related Deductions (National Tax)">
                  <DependentDeductionTooltip
                    deductions={results.dependentDeductions}
                    taxType="national"
                  />
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(-results.dependentDeductions.nationalTax.total)}
            type="detail"
          />
        )}

        {results.additionalDeductions.national > 0 && (
          <ResultRow
            label={
              <span>
                Other Deductions
                <AdditionalDeductionsTooltip
                  deductions={results.additionalDeductions}
                  taxType="national"
                />
              </span>
            }
            value={formatJPY(-results.additionalDeductions.national)}
            type="detail"
          />
        )}

        {results.taxableIncomeForNationalIncomeTax !== undefined && (
          <ResultRow
            label={
              <span>
                Taxable Income
                <DetailedTooltip title="Taxable Income for National Income Tax">
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Taxable Income Calculation
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Taxable income is calculated by subtracting all applicable deductions from net
                      income.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Formula:</strong> Net Income - Applicable Deductions = Taxable Income
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Rounding:</strong> The taxable income is rounded down to the nearest
                      1,000 yen before applying tax rates.
                    </Typography>
                    <SourceLinks
                      sources={[
                        {
                          href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',
                          label: '所得税の税率 - NTA',
                        },
                      ]}
                    />
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(results.taxableIncomeForNationalIncomeTax)}
            type="detail-subtotal"
          />
        )}

        {results.nationalIncomeTaxBase !== undefined && (
          <ResultRow
            label={
              <span>
                Base Income Tax
                <DetailedTooltip title="Base Income Tax">
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      This is the income tax calculated using the standard progressive tax brackets,
                      before applying the special reconstruction surtax.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <HighlightedRowValue
                        label="Taxable income"
                        value={results.taxableIncomeForNationalIncomeTax}
                      />
                      <ReferenceTable
                        headers={['Taxable Income (¥)', 'Tax Rate', 'Deduction (¥)']}
                        highlightedRow={incomeTaxBracketHighlight}
                        rows={buildNationalIncomeTaxBracketRows()}
                      />
                      <SourceLinks
                        sources={[
                          {
                            href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',
                            label: '所得税の税率 - NTA',
                          },
                        ]}
                      />
                    </Box>
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(results.nationalIncomeTaxBase)}
            type="detail"
          />
        )}

        {results.homeLoanTaxCredit && results.homeLoanTaxCredit.appliedToIncomeTax > 0 && (
          <ResultRow
            label={
              <span>
                Home Loan Tax Credit
                <DetailedTooltip title="Home Loan Tax Credit — Income Tax Portion">
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      A tax credit (税額控除) for homeowners with a home loan. It reduces the base
                      income tax before the reconstruction surtax is calculated.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      <strong>Applied to income tax:</strong>{' '}
                      {formatJPY(results.homeLoanTaxCredit.appliedToIncomeTax)}
                    </Typography>
                    {results.homeLoanTaxCredit.appliedToResidenceTax > 0 && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        The available credit amount is larger than the income tax. The remainder
                        spills over to residence tax. See the <strong>Home Loan Tax Credit</strong>{' '}
                        line under Residence Tax (below) for the spillover cap and any amount that
                        cannot be claimed.
                      </Typography>
                    )}
                    <SourceLinks
                      sources={[
                        {
                          href: 'https://www.nta.go.jp/taxes/shiraberu/shinkoku/tokushu/keisubetsu/juutaku.htm',
                          label: '住宅借入金等特別控除 - NTA',
                        },
                        {
                          href: 'https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html',
                          label: '住宅ローン減税 - 国土交通省 (MLIT)',
                        },
                      ]}
                    />
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(-results.homeLoanTaxCredit.appliedToIncomeTax)}
            type="detail"
          />
        )}

        {results.reconstructionSurtax !== undefined && (
          <ResultRow
            label={
              <span>
                Reconstruction Surtax
                <DetailedTooltip title="Special Reconstruction Surtax">
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      復興特別所得税
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      A temporary surtax of 2.1% applied to the base income tax remaining after tax
                      credits such as the home loan tax credit (基準所得税額). Originally introduced
                      to help fund reconstruction efforts after the 2011 Great East Japan Earthquake
                      and tsunami.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Rate:</strong> 2.1% of base income tax after tax credits
                      (基準所得税額)
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Period:</strong> January 1, 2013 - December 31, 2037 (25 years)
                    </Typography>
                    <SourceLinks
                      sources={[
                        {
                          href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',
                          label: '所得税の税率 - NTA',
                        },
                        {
                          href: 'https://www.nta.go.jp/publication/pamph/shotoku/fukko_tokubetsu/index.htm',
                          label: '個人の方に係る復興特別所得税のあらまし - NTA',
                        },
                      ]}
                    />
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
              <DetailedTooltip title="Total Income Tax Calculation">
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Total Income Tax = Base Income Tax (− Tax Credits) + Reconstruction Surtax
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Rounding:</strong> The sum of base income tax and surtax is rounded down
                    to the nearest 100 yen for the final amount.
                  </Typography>
                  <SourceLinks
                    sources={[
                      {
                        href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm',
                        label: '所得税の税率 - NTA',
                      },
                    ]}
                  />
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
                onChange={e => setShowDetailedBreakdown(e.target.checked)}
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
                fontSize: '0.85rem',
              },
            }}
          />
        </Box>

        <ResultRow
          label={
            <span>
              Basic Deduction
              <DetailedTooltip title="Residence Tax Basic Deduction">
                <>
                  <HighlightedRowValue label="Net income" value={results.totalNetIncome} />
                  <ReferenceTable
                    headers={['Net Income (¥)', 'Deduction Amount']}
                    highlightedRow={residenceBasicDeductionHighlight}
                    rows={buildResidenceBasicDeductionRows()}
                  />
                  <SourceLinks
                    sources={[
                      {
                        href: 'https://www.city.yokohama.lg.jp/kurashi/koseki-zei-hoken/zeikin/y-shizei/kojin-shiminzei-kenminzei/kaisei/R3zeiseikaisei.html#4',
                        label: '令和3年度税制改正 (2021 Tax Reform - Yokohama City)',
                      },
                    ]}
                  />
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
                <DetailedTooltip title="Dependent-Related Deductions (Residence Tax)">
                  <DependentDeductionTooltip
                    deductions={results.dependentDeductions}
                    taxType="residence"
                  />
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(-results.dependentDeductions.residenceTax.total)}
            type="detail"
          />
        )}

        {results.additionalDeductions.residence > 0 && (
          <ResultRow
            label={
              <span>
                Other Deductions
                <AdditionalDeductionsTooltip
                  deductions={results.additionalDeductions}
                  taxType="residence"
                />
              </span>
            }
            value={formatJPY(-results.additionalDeductions.residence)}
            type="detail"
          />
        )}

        {results.taxableIncomeForResidenceTax !== undefined && (
          <ResultRow
            label={
              <span>
                Taxable Income
                <DetailedTooltip title="Taxable Income for Residence Tax">
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Taxable Income Calculation
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Taxable income for residence tax is calculated by subtracting all applicable
                      deductions from net income.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Formula:</strong> Net Income - Applicable Deductions = Taxable Income
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Rounding:</strong> The taxable income is rounded down to the nearest
                      1,000 yen before applying tax rates.
                    </Typography>
                    <SourceLinks
                      sources={[
                        {
                          href: 'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
                          label: '個人住民税 (Tokyo Bureau of Taxation)',
                        },
                      ]}
                    />
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(results.taxableIncomeForResidenceTax)}
            type="detail-subtotal"
          />
        )}

        {/* Income-based portion breakdown */}
        <ResultRow
          label={
            <span>
              Income-based Portion
              <DetailedTooltip title="Income-based Residence Tax">
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Income-based Portion (所得割): 10% of Taxable Income
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    This portion is calculated as a percentage of taxable income and split between
                    municipal and prefectural governments.
                  </Typography>
                  <ReferenceTable
                    headers={['Component', 'Rate']}
                    rows={[
                      ['Municipal Tax (市町村民税)', '6%'],
                      ['Prefectural Tax (都道府県民税)', '4%'],
                      [<strong>Total</strong>, <strong>10%</strong>],
                    ]}
                  />
                  <Typography variant="body2" sx={{ mt: 1.5, fontSize: '0.85em' }}>
                    <strong>Rounding:</strong> The municipal and prefectural portions are each
                    rounded down to the nearest 100 yen after applying any tax credits.
                  </Typography>
                  <SourceLinks
                    sources={[
                      {
                        href: 'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
                        label: '個人住民税 (Tokyo Bureau of Taxation)',
                      },
                    ]}
                  />
                </Box>
              </DetailedTooltip>
            </span>
          }
          value={formatJPY(residenceIncomeBasedDisplayed)}
          type="detail"
        />

        {/* Municipal/Prefectural breakdown for income-based portion */}
        <Collapse in={showDetailedBreakdown}>
          <Box sx={{ ml: 2, mb: 1 }}>
            <ResultRow
              label="Municipal portion (6%)"
              value={formatJPY(Math.round(results.residenceTax.taxableIncome * 0.06))}
              type="detail"
            />
            {results.residenceTax.city.cityAdjustmentCredit > 0 && (
              <ResultRow
                label={
                  <span>
                    Tax credit (municipal)
                    <AdjustmentCreditTooltip
                      level="municipal"
                      adjustmentCredit={results.residenceTax.city.cityAdjustmentCredit}
                      personalDeductionDifference={results.residenceTax.personalDeductionDifference}
                    />
                  </span>
                }
                value={formatJPY(-results.residenceTax.city.cityAdjustmentCredit)}
                type="detail"
              />
            )}

            <ResultRow
              label="Prefectural portion (4%)"
              value={formatJPY(Math.round(results.residenceTax.taxableIncome * 0.04))}
              type="detail"
            />
            {results.residenceTax.prefecture.prefecturalAdjustmentCredit > 0 && (
              <ResultRow
                label={
                  <span>
                    Tax credit (prefectural)
                    <AdjustmentCreditTooltip
                      level="prefectural"
                      adjustmentCredit={results.residenceTax.prefecture.prefecturalAdjustmentCredit}
                      personalDeductionDifference={results.residenceTax.personalDeductionDifference}
                    />
                  </span>
                }
                value={formatJPY(-results.residenceTax.prefecture.prefecturalAdjustmentCredit)}
                type="detail"
              />
            )}
          </Box>
        </Collapse>

        {/* Home loan tax credit spillover (reduces the income-based portion above) */}
        {results.homeLoanTaxCredit && results.homeLoanTaxCredit.appliedToResidenceTax > 0 && (
          <ResultRow
            label={
              <span>
                Home Loan Tax Credit
                {results.homeLoanTaxCredit.unusedCredit > 0 && (
                  <WarningIcon
                    fontSize="small"
                    sx={{
                      ml: 0.5,
                      color: 'warning.main',
                      fontSize: '1rem',
                      verticalAlign: 'text-bottom',
                    }}
                  />
                )}
                <DetailedTooltip title="Home Loan Tax Credit — Residence Tax Spillover">
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      When the available credit amount exceeds the income tax, the remainder spills
                      over to reduce residence tax. The cap is the lower of ¥97,500 (¥136,500 for
                      2014–2021 move-ins) and 5% (7% for 2014–2021 move-ins) of the{' '}
                      <strong>income tax</strong> taxable total income (所得税の課税総所得金額等).
                    </Typography>
                    {results.homeLoanTaxCredit.residenceTaxSpilloverCap && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Spillover cap:</strong>{' '}
                        {formatJPY(results.homeLoanTaxCredit.residenceTaxSpilloverCap.applied)} (the
                        lower of{' '}
                        {formatJPY(results.homeLoanTaxCredit.residenceTaxSpilloverCap.flatCap)} and{' '}
                        {formatJPY(
                          results.homeLoanTaxCredit.residenceTaxSpilloverCap.incomeRateCap,
                        )}
                        ).
                      </Typography>
                    )}
                    {results.homeLoanTaxCredit.unusedCredit > 0 && (
                      <Typography variant="body2" sx={{ mb: 1, color: 'warning.main' }}>
                        The available credit amount (
                        {formatJPY(results.homeLoanTaxCredit.availableCredit)}) is more than the
                        income tax ({formatJPY(results.homeLoanTaxCredit.appliedToIncomeTax)}) plus
                        this cap ({formatJPY(results.homeLoanTaxCredit.appliedToResidenceTax)})
                        combined, so {formatJPY(results.homeLoanTaxCredit.unusedCredit)} cannot be
                        applied and is lost.
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      The home loan tax credit spillover is subtracted from the income-based portion
                      (所得割) of residence tax.
                    </Typography>
                  </Box>
                </DetailedTooltip>
              </span>
            }
            value={formatJPY(-homeLoanResidenceReduction)}
            type="detail"
          />
        )}

        {/* Per capita portion */}
        <ResultRow
          label={
            <span>
              Per Capita Portion
              <DetailedTooltip title="Per Capita Residence Tax">
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Per Capita Portion (均等割): Fixed Amount
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    A fixed amount paid by all non-exempt residents, split among the following.
                  </Typography>
                  <ReferenceTable
                    headers={['Component', 'Amount']}
                    rows={[
                      ['Municipal Tax (市町村民税)', '¥3,000'],
                      ['Prefectural Tax (都道府県民税)', '¥1,000'],
                      ['Forest Environment Tax (森林環境税)', '¥1,000'],
                      [<strong>Total</strong>, <strong>¥5,000</strong>],
                    ]}
                  />
                  <Typography variant="body2" sx={{ mb: 1, mt: 1 }}>
                    <strong>Purpose:</strong> Covers basic administrative costs and local services
                    that benefit all residents equally.
                  </Typography>
                  <SourceLinks
                    sources={[
                      {
                        href: 'https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju',
                        label: '個人住民税 (Tokyo Bureau of Taxation)',
                      },
                    ]}
                  />
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
        <ResultRow label="Total Taxes" value={formatJPY(totalTaxes)} type="total" />
      </Box>
    </Box>
  );
};

export default TaxesTab;
