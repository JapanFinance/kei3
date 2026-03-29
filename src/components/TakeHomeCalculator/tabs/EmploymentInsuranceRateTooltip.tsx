// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Typography from '@mui/material/Typography';
import { DetailedTooltip } from '../../ui/Tooltips';
import { getEmploymentInsuranceRate } from '../../../data/employmentInsurance';
import { formatPercent } from '../../../utils/formatters';

const formatMonthShort = (month: number): string =>
    new Date(2000, month).toLocaleString('en', { month: 'short' });

interface RateRange {
    rate: number;
    startMonth: number;
    endMonth: number;
}

/**
 * Groups consecutive months with the same rate into ranges for display.
 */
const getRateRanges = (year: number): RateRange[] => {
    const ranges: RateRange[] = [];
    let currentRate = getEmploymentInsuranceRate(year, 0);
    let startMonth = 0;

    for (let month = 1; month < 12; month++) {
        const rate = getEmploymentInsuranceRate(year, month);
        if (rate !== currentRate) {
            ranges.push({ rate: currentRate, startMonth, endMonth: month - 1 });
            currentRate = rate;
            startMonth = month;
        }
    }
    ranges.push({ rate: currentRate, startMonth, endMonth: 11 });

    return ranges;
};

const EmploymentInsuranceRateTooltip: React.FC = () => {
    const year = new Date().getFullYear();
    const ranges = getRateRanges(year);

    return (
        <DetailedTooltip title="Employment Insurance Rate">
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Employee Rate ({year})
            </Typography>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr>
                        <th style={{ padding: '4px 8px 4px 0', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Months</th>
                        <th style={{ padding: '4px 0', textAlign: 'right', borderBottom: '1px solid #ccc' }}>Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {ranges.map((range) => (
                        <tr key={range.startMonth}>
                            <td style={{ padding: '4px 8px 4px 0' }}>
                                {range.startMonth === range.endMonth
                                    ? formatMonthShort(range.startMonth)
                                    : `${formatMonthShort(range.startMonth)}-${formatMonthShort(range.endMonth)}`}
                            </td>
                            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 500 }}>
                                {formatPercent(range.rate, 2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </DetailedTooltip>
    );
};

export default EmploymentInsuranceRateTooltip;
