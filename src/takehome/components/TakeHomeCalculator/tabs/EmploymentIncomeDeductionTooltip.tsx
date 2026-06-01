// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getEmploymentIncomeDeductionPeriod } from '../../../data/employmentIncomeDeduction';

const fmtNum = (n: number) => n.toLocaleString('en');

interface EmploymentIncomeDeductionTooltipProps {
    year: number;
}

const EmploymentIncomeDeductionTooltip: React.FC<EmploymentIncomeDeductionTooltipProps> = ({ year }) => {
    const period = getEmploymentIncomeDeductionPeriod(year);

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
        <Box>
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
        </Box>
    );
};

export default EmploymentIncomeDeductionTooltip;
