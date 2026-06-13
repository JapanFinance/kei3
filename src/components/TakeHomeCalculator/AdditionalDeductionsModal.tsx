// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { HomeLoanTaxCreditInput } from '../../types/tax';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import { SimpleTooltip } from '../ui/Tooltips';
import { earliestEligibleMoveInYear } from '../../utils/homeLoanTaxCredit';

interface AdditionalDeductionsModalProps {
  open: boolean;
  onClose: () => void;
  dcPlanContributions: number;
  onDcPlanContributionsChange: (value: number) => void;
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
  onHomeLoanTaxCreditChange: (input: HomeLoanTaxCreditInput | undefined) => void;
  currentYear: number;
}

const SectionHeader: React.FC<{ children: React.ReactNode; tooltip?: string }> = ({ children, tooltip }) => (
  <Typography
    sx={{
      fontSize: '0.95rem',
      fontWeight: 700,
      color: 'text.primary',
      display: 'flex',
      alignItems: 'center',
      mb: 1,
    }}
  >
    {children}
    {tooltip && <SimpleTooltip>{tooltip}</SimpleTooltip>}
  </Typography>
);

export const AdditionalDeductionsModal: React.FC<AdditionalDeductionsModalProps> = ({
  open,
  onClose,
  dcPlanContributions,
  onDcPlanContributionsChange,
  homeLoanTaxCredit,
  onHomeLoanTaxCreditChange,
  currentYear,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const effectiveHomeLoan: HomeLoanTaxCreditInput = homeLoanTaxCredit ?? {
    moveInYear: currentYear,
    creditAmount: 0,
  };

  const moveInYearOptions = React.useMemo(() => {
    const floor = earliestEligibleMoveInYear(currentYear);
    const years: number[] = [];
    for (let y = currentYear; y >= floor; y--) years.push(y);
    return years;
  }, [currentYear]);

  const updateHomeLoan = (patch: Partial<HomeLoanTaxCreditInput>) => {
    onHomeLoanTaxCreditChange({ ...effectiveHomeLoan, ...patch });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            minHeight: isMobile ? '100dvh' : '480px',
            maxHeight: isMobile ? '100dvh' : '90vh',
            '@supports not (height: 100dvh)': {
              minHeight: isMobile ? '100vh' : '480px',
              maxHeight: isMobile ? '100vh' : '90vh',
            },
          },
        },
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pb: 1,
        pt: isMobile ? 'max(16px, env(safe-area-inset-top))' : 2,
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon />
          <Typography variant="h6" component="span">
            Additional Deductions &amp; Credits
          </Typography>
        </Box>
        <IconButton edge="end" onClick={onClose} aria-label="close" size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{
        p: { xs: 2, sm: 3 },
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}>
        {/* Income Deductions (所得控除) */}
        <Box>
          <SectionHeader tooltip="Deductions (所得控除) reduce your taxable income before tax is calculated.">
            Income Deductions (所得控除)
          </SectionHeader>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <FormControl fullWidth>
            <Typography
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', fontSize: '0.95rem', fontWeight: 500, mb: 0.5, color: 'text.primary' }}
            >
              <a
                href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/kyoshutsu/gaiyou.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', fontWeight: 500 }}
              >iDeCo / Corporate DC</a>{' '}Contributions
              <SimpleTooltip>Annual contributions to iDeCo (individual defined contribution pension) and corporate DC plans. Do not include employer contributions in this amount. The max allowed contribution will vary depending on your situation.</SimpleTooltip>
            </Typography>
            <SpinnerNumberField
              id="dcPlanContributions"
              name="dcPlanContributions"
              value={dcPlanContributions}
              onInputChange={(e) => onDcPlanContributionsChange(Number((e.target as HTMLInputElement).value) || 0)}
              label="Annual Contributions"
              step={1_000}
              shiftStep={10_000}
            />
          </FormControl>
            </CardContent>
          </Card>
        </Box>

        {/* Tax Credits (税額控除) */}
        <Box>
          <SectionHeader tooltip="Tax credits (税額控除) reduce the tax you owe directly, after it has been calculated.">
            Tax Credits (税額控除)
          </SectionHeader>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', color: 'text.primary' }}>
            Home Loan Tax Credit (住宅ローン控除)
            <SimpleTooltip>
              A tax credit for homeowners with a home loan, applied for 10–13 years from move-in. Reduces income tax first, with any remainder spilling over to residence tax up to a cap. Also affects your furusato nozei limit. Leave the amount at 0 if it doesn't apply to you.
            </SimpleTooltip>
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <FormControl sx={{ flex: '1 1 200px', minWidth: 180 }}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                Credit amount (控除可能額)
                <SimpleTooltip>
                  Enter your full calculated credit (住宅借入金等特別控除可能額) — your year-end loan balance × the credit rate (0.7% for 2022+ move-ins, 1% earlier), up to your home's qualifying maximum. On your 源泉徴収票 this is the 住宅借入金等特別控除可能額, NOT the 住宅借入金等特別控除の額 (which is already capped at last year's income tax).
                </SimpleTooltip>
              </Typography>
              <SpinnerNumberField
                id="homeLoanCreditAmount"
                name="creditAmount"
                value={effectiveHomeLoan.creditAmount}
                onInputChange={(e) => updateHomeLoan({ creditAmount: Number((e.target as HTMLInputElement).value) || 0 })}
                label="Amount"
                step={1_000}
                shiftStep={10_000}
                min={0}
              />
            </FormControl>

            <FormControl sx={{ flex: '0 1 140px', minWidth: 120 }}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                Year moved in
                <SimpleTooltip>
                  The year you first moved in and began claiming the credit. Determines the residence-tax spillover cap and the income-eligibility limit.
                </SimpleTooltip>
              </Typography>
              <InputLabel id="homeLoanMoveInYear-label" sx={{ position: 'absolute', left: '-9999px', opacity: 0 }}>
                Year moved in
              </InputLabel>
              <Select
                id="homeLoanMoveInYear"
                labelId="homeLoanMoveInYear-label"
                value={effectiveHomeLoan.moveInYear}
                onChange={(e) => updateHomeLoan({ moveInYear: Number(e.target.value) })}
                fullWidth
              >
                {moveInYearOptions.map((y) => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, mt: 2 }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
              Don't know your credit amount? Calculate it with the{' '}
              <a
                href="https://www.nta.go.jp/taxes/shiraberu/shinkoku/tokushu/keisubetsu/juutaku.htm"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                NTA's home loan tax credit guide
              </a>.
            </Typography>
          </Box>
            </CardContent>
          </Card>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{
        px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
        py: 2,
        pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : 2,
      }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
};
