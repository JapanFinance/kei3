// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getEmploymentIncomeDeductionPeriod } from '../../../data/employmentIncomeDeduction';
import { formatJPY } from '../../../utils/formatters';
import { DetailedTooltip } from '../../ui/Tooltips';

const fmtNum = (n: number) => n.toLocaleString('en');

interface NetEmploymentIncomeTooltipProps {
    /** Gross employment income (給与等の収入金額) in yen. */
    grossEmploymentIncome: number;
    /** Net employment income (給与所得), already net of the 給与所得控除 and 所得金額調整控除. */
    netEmploymentIncome: number;
    /**
     * 所得金額調整控除 applied to this taxpayer (yen). When greater than 0, it is shown as its own
     * breakdown line and an explanatory note is added below the 給与所得控除 table.
     */
    incomeAdjustmentDeduction?: number;
    /** Income year, for the 給与所得控除 table lookup. */
    year: number;
}

/**
 * Tooltip for the "Net Employment Income" row: shows how gross employment income becomes net
 * employment income (the 給与所得控除, then the 所得金額調整控除 when applicable), followed by the
 * 給与所得控除 rate table and source links. Renders its own DetailedTooltip trigger, so callers
 * place it directly after the row label. Shared by the Taxes and Social Insurance tabs.
 */
const NetEmploymentIncomeTooltip: React.FC<NetEmploymentIncomeTooltipProps> = ({
    grossEmploymentIncome,
    netEmploymentIncome,
    incomeAdjustmentDeduction = 0,
    year,
}) => {
    const period = getEmploymentIncomeDeductionPeriod(year);

    // The 給与所得控除 portion is whatever remains after backing out the income adjustment, so the
    // displayed rows always reconcile to net employment income regardless of which gross is passed.
    const employmentIncomeDeduction = grossEmploymentIncome - netEmploymentIncome - incomeAdjustmentDeduction;

    // The effective upper boundary of the flat-floor region (including transition values).
    // For R8: transitions end at 2,199,999 → standard starts at 2,200,000.
    // For R7: no transitions → standard starts at flatFloorGrossMaxInclusive + 1.
    const flatUpperBound = period.transitionValues.length > 0
        ? period.transitionValues[period.transitionValues.length - 1]!.grossMaxInclusive + 1
        : period.flatFloorGrossMaxInclusive;

    // Build rows from standardTiers
    const tierRows = period.standardTiers.map((tier, i) => {
        const lower = (i === 0 ? flatUpperBound : period.standardTiers[i - 1]!.grossMaxInclusive) + 1;
        const isCap = !isFinite(tier.grossMaxInclusive);
        const deductionPct = Math.round((1 - tier.retentionRate) * 100);

        const range = isCap
            ? `${fmtNum(lower)} and above`
            : `${fmtNum(lower)} – ${fmtNum(tier.grossMaxInclusive)}`;

        const deduction = isCap
            ? `${fmtNum(tier.offset)} (max)`
            : `${deductionPct}% of income + ${fmtNum(tier.offset)}`;

        return { range, deduction };
    });

    return (
        <DetailedTooltip title="Employment Income Details">
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
                        <Box component="td" sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}>-{formatJPY(employmentIncomeDeduction)}</Box>
                    </tr>
                    {incomeAdjustmentDeduction > 0 && (
                        <tr>
                            <td style={{ padding: '2px 0' }}>Income Adjustment Deduction:</td>
                            <Box component="td" sx={{ padding: '2px 0', textAlign: 'right', color: 'error.main' }}>-{formatJPY(incomeAdjustmentDeduction)}</Box>
                        </tr>
                    )}
                    <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                        <td style={{ padding: '4px 0', fontWeight: 600 }}>Net Employment Income:</td>
                        <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{formatJPY(netEmploymentIncome)}</td>
                    </Box>
                </tbody>
            </table>

            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Employment Income Deduction Table
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
                        borderBottom: 1,
                        borderColor: 'divider',
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
                        <td>Up to {fmtNum(flatUpperBound)}</td>
                        <td>{fmtNum(period.flatFloorDeduction)}</td>
                    </tr>
                    {tierRows.map((row, i) => (
                        <tr key={i}>
                            <td>{row.range}</td>
                            <td>{row.deduction}</td>
                        </tr>
                    ))}
                </tbody>
            </Box>
            <Box sx={{ mt: 1 }}>
                Official Sources:
                <ul>
                    <li>
                        <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-main)', textDecoration: 'underline', fontSize: '0.95em' }}>
                            給与所得控除 - NTA
                        </a>
                    </li>
                    <li>
                        <a href="https://www.nta.go.jp/english/taxes/individual/12012.htm" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-main)', textDecoration: 'underline', fontSize: '0.95em' }}>
                            Overview of deduction for employment income - NTA (English)
                        </a>
                    </li>
                </ul>
            </Box>

            {incomeAdjustmentDeduction > 0 && (
                <Box sx={{ mt: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Income Amount Adjustment Deduction (所得金額調整控除)
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        Because your employment income exceeds ¥8,500,000 and you have a qualifying dependent
                        (a relative under 23, or a specially-disabled spouse/dependent), a further deduction is
                        subtracted from your employment income:
                        ⌈(min(salary, ¥10,000,000) − ¥8,500,000) × 10%⌉, up to ¥150,000. This lowers your total
                        net income (合計所得金額), reducing <strong>both income tax and residence tax</strong>.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                        Official Source:
                        <ul>
                            <li>
                                <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1411.htm" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-main)', textDecoration: 'underline', fontSize: '0.95em' }}>
                                    所得金額調整控除 - NTA
                                </a>
                            </li>
                        </ul>
                    </Box>
                </Box>
            )}
        </DetailedTooltip>
    );
};

export default NetEmploymentIncomeTooltip;
