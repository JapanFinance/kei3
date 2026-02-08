// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const EmploymentIncomeDeductionTooltip: React.FC = () => (
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
                        給与所得控除 - NTA
                    </a>
                </li>
                <li>
                    <a href="https://www.nta.go.jp/english/taxes/individual/12012.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline', fontSize: '0.95em' }}>
                        Overview of deduction for employment income - NTA (English)
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

export default EmploymentIncomeDeductionTooltip;
