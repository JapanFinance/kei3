// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Typography from '@mui/material/Typography';
import { DetailedTooltip } from '../../ui/Tooltips';
import { getEmploymentInsuranceRate } from '../../../data/employmentInsurance';
import { roundSocialInsurancePremium } from '../../../utils/taxCalculations';
import { formatJPY, formatPercent } from '../../../utils/formatters';
import type { BonusIncomeStream } from '../../../types/tax';

const formatMonthShort = (month: number): string =>
    new Date(2000, month).toLocaleString('en', { month: 'short' });

const cellStyle = { padding: '2px 8px 2px 0' } as const;
const rightCellStyle = { ...cellStyle, textAlign: 'right' as const };
const headerStyle = { ...cellStyle, borderBottom: '1px solid #ccc', fontWeight: 'normal' as const };
const rightHeaderStyle = { ...rightCellStyle, borderBottom: '1px solid #ccc', fontWeight: 'normal' as const };
const totalStyle = { ...rightCellStyle, borderTop: '1px solid #ccc', fontWeight: 600 };

interface SalaryTooltipProps {
    monthlyIncome: number;
}

const SalaryBreakdownTooltip: React.FC<SalaryTooltipProps> = ({ monthlyIncome }) => {
    const year = new Date().getFullYear();

    const months = Array.from({ length: 12 }, (_, month) => {
        const rate = getEmploymentInsuranceRate(year, month);
        const premium = roundSocialInsurancePremium(monthlyIncome * rate);
        return { month, rate, premium };
    });

    const annualTotal = months.reduce((sum, m) => sum + m.premium, 0);

    return (
        <DetailedTooltip title="Monthly Premium Breakdown">
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Employment Insurance ({year})
            </Typography>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                    <tr>
                        <th style={headerStyle}>Month</th>
                        <th style={rightHeaderStyle}>Income</th>
                        <th style={rightHeaderStyle}>Rate</th>
                        <th style={rightHeaderStyle}>Premium</th>
                    </tr>
                </thead>
                <tbody>
                    {months.map(({ month, rate, premium }) => (
                        <tr key={month}>
                            <td style={cellStyle}>{formatMonthShort(month)}</td>
                            <td style={rightCellStyle}>{formatJPY(Math.round(monthlyIncome))}</td>
                            <td style={rightCellStyle}>{formatPercent(rate, 2)}</td>
                            <td style={rightCellStyle}>{formatJPY(premium)}</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan={3} style={totalStyle}>Annual Total</td>
                        <td style={totalStyle}>{formatJPY(annualTotal)}</td>
                    </tr>
                </tbody>
            </table>
        </DetailedTooltip>
    );
};

interface BonusTooltipProps {
    bonuses: BonusIncomeStream[];
}

const BonusBreakdownTooltip: React.FC<BonusTooltipProps> = ({ bonuses }) => {
    const year = new Date().getFullYear();

    const rows = bonuses.map((bonus) => {
        const rate = getEmploymentInsuranceRate(year, bonus.month);
        const premium = roundSocialInsurancePremium(bonus.amount * rate);
        return { month: bonus.month, amount: bonus.amount, rate, premium };
    });

    const total = rows.reduce((sum, r) => sum + r.premium, 0);

    return (
        <DetailedTooltip title="Bonus Premium Breakdown">
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Employment Insurance on Bonuses ({year})
            </Typography>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                    <tr>
                        <th style={headerStyle}>Month</th>
                        <th style={rightHeaderStyle}>Bonus</th>
                        <th style={rightHeaderStyle}>Rate</th>
                        <th style={rightHeaderStyle}>Premium</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ month, amount, rate, premium }, i) => (
                        <tr key={i}>
                            <td style={cellStyle}>{formatMonthShort(month)}</td>
                            <td style={rightCellStyle}>{formatJPY(amount)}</td>
                            <td style={rightCellStyle}>{formatPercent(rate, 2)}</td>
                            <td style={rightCellStyle}>{formatJPY(premium)}</td>
                        </tr>
                    ))}
                    {rows.length > 1 && (
                        <tr>
                            <td colSpan={3} style={totalStyle}>Total</td>
                            <td style={totalStyle}>{formatJPY(total)}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </DetailedTooltip>
    );
};

export { SalaryBreakdownTooltip, BonusBreakdownTooltip };
