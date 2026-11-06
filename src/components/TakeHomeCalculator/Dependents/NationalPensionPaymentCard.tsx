// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { useId, useState } from 'react';

import { getNationalPensionAnnualTotal } from '../../../data/nationalPensionContribution';
import { formatJPY } from '../../../utils/formatters';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks from '../../ui/SourceLinks';
import { SpinnerNumberField } from '../../ui/SpinnerNumberField';
import { DetailedTooltip } from '../../ui/Tooltips';

interface NationalPensionPaymentCardProps {
  /** Whether the family member is a spouse (adjusts Category 3 vs Category 1 guidance). */
  isSpouse?: boolean | undefined;
  paysNationalPension: boolean;
  customAmount?: number | undefined;
  incomeYear: number;
  onChange: (updates: {
    paysNationalPension: boolean;
    nationalPensionCustomAmount?: number | undefined;
  }) => void;
}

/**
 * Control card for indicating whether the taxpayer pays a 20–59 family member's
 * National Pension (国民年金) contributions and claiming 社会保険料控除 (所法第74条第2項第1号).
 */
export const NationalPensionPaymentCard: React.FC<NationalPensionPaymentCardProps> = ({
  isSpouse = false,
  paysNationalPension,
  customAmount,
  incomeYear,
  onChange,
}) => {
  const inputId = useId();
  const statutoryTotal = getNationalPensionAnnualTotal(incomeYear);
  const isCustom = customAmount !== undefined;
  const [savedCustomAmount, setSavedCustomAmount] = useState<number>(
    customAmount ?? statutoryTotal,
  );

  const handleTogglePaid = (checked: boolean) => {
    onChange({
      paysNationalPension: checked,
      nationalPensionCustomAmount: customAmount,
    });
  };

  const handleToggleCustom = (checked: boolean) => {
    onChange({
      paysNationalPension,
      nationalPensionCustomAmount: checked ? savedCustomAmount : undefined,
    });
  };

  const handleAmountChange = (value: number) => {
    if (!isCustom) return;
    setSavedCustomAmount(value);
    onChange({
      paysNationalPension,
      nationalPensionCustomAmount: value,
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Typography
        variant="subtitle2"
        sx={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 28,
          mb: 1,
        }}
      >
        National Pension (国民年金)
        <DetailedTooltip
          title="Family Member's National Pension (国民年金・社会保険料控除)"
          icon={SIMPLE_TOOLTIP_ICON}
        >
          <Typography variant="body2" sx={{ mb: 1 }}>
            National Pension contributions paid by the taxpayer on behalf of a spouse or relative
            who shares living expenses (生計を一にする) are 100% deductible as a social insurance
            deduction (社会保険料控除, Income Tax Act Art. 74). Neither living at the same address
            nor claiming a dependent tax deduction is required.
          </Typography>
          {isSpouse ? (
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Category 3 note:</strong> A dependent spouse aged 20–59 supported by an
              employee under 70 enrolled in Employees&apos; Pension (厚生年金) with annual income
              below ¥1.3M is normally a Category 3 insured person (第3号被保険者) with ¥0
              contribution. Enable this only when actually paying Category 1 contributions (e.g.
              taxpayer on NHI or aged 70+, spouse earning ≥ ¥1.3M outside 厚生年金, or back-payments
              追納).
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Category 1 obligation:</strong> Children and other relatives aged 20–59 are
              never Category 3 — even when covered as dependents on Employee Health Insurance — and
              owe Category 1 contributions ({formatJPY(statutoryTotal)}/yr in {incomeYear}) unless
              granted a student deferral (学生納付特例) or exemption (免除・納付猶予). Attach the
              deduction certificate (社会保険料（国民年金保険料）控除証明書) at year-end adjustment
              or tax filing.
            </Typography>
          )}
          <Typography variant="body2" sx={{ mb: 1 }}>
            Switch on <strong>Custom</strong> to enter partial-year payments (e.g. turning 20
            mid-year), advance payment discounts (前納・2年前納), additional pension (+¥400/mo
            付加保険料), or back-payments of deferred periods (追納).
          </Typography>
          <SourceLinks
            sources={[
              {
                href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1130.htm',
                label: 'NTA: Social Insurance Deduction (国税庁: 社会保険料控除 No.1130)',
              },
              {
                href: 'https://www.nenkin.go.jp/service/kokunen/hokenryo/hokenryo.html',
                label: 'Japan Pension Service: National Pension Contributions (国民年金保険料)',
              },
            ]}
          />
        </DetailedTooltip>
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={paysNationalPension}
              onChange={e => handleTogglePaid(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Paid by taxpayer (社会保険料控除)</Typography>}
          sx={{ m: 0 }}
        />

        {paysNationalPension && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SpinnerNumberField
                id={inputId}
                value={isCustom ? customAmount : statutoryTotal}
                onChange={handleAmountChange}
                label={isCustom ? 'Annual Contribution' : 'Annual Contribution (full year)'}
                step={1_000}
                shiftStep={10_000}
                min={0}
                size="small"
                disabled={!isCustom}
                sx={{ flex: 1, minWidth: 0 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={isCustom}
                    onChange={e => handleToggleCustom(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Custom</Typography>}
                sx={{ m: 0, whiteSpace: 'nowrap' }}
              />
            </Box>
            <FormHelperText sx={{ mx: 0, mt: 0.5 }}>
              {isCustom
                ? `Enter actual amount paid in ${incomeYear} (full-year standard: ${formatJPY(statutoryTotal)}).`
                : `Full-year ${incomeYear} Category 1 contribution (${formatJPY(statutoryTotal)}).`}
            </FormHelperText>
          </Box>
        )}
      </Paper>
    </Box>
  );
};
