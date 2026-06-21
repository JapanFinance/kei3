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
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import WarningIcon from '@mui/icons-material/Warning';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { HomeLoanTaxCreditInput, HomeLoanTaxCreditResult } from '../../types/tax';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import { SimpleTooltip, DetailedTooltip } from '../ui/Tooltips';
import { SIMPLE_TOOLTIP_ICON } from '../ui/constants';
import { earliestEligibleMoveInYear, homeLoanCreditDistinguishesTokuteiShutoku } from '../../utils/homeLoanTaxCredit';

interface AdditionalDeductionsModalProps {
  open: boolean;
  onClose: () => void;
  dcPlanContributions: number;
  onDcPlanContributionsChange: (value: number) => void;
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
  onHomeLoanTaxCreditChange: (input: HomeLoanTaxCreditInput | undefined) => void;
  homeLoanTaxCreditResult?: HomeLoanTaxCreditResult | undefined;
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
  homeLoanTaxCreditResult,
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
                  >iDeCo / Corporate DC Plan</a>{' '}Contributions
                </Typography>
                <SpinnerNumberField
                  id="dcPlanContributions"
                  name="dcPlanContributions"
                  value={dcPlanContributions}
                  onInputChange={(e) => onDcPlanContributionsChange(Number((e.target as HTMLInputElement).value) || 0)}
                  label="Annual Contributions"
                  step={1_000}
                  shiftStep={10_000}
                  helperText="Not including employer contributions."
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
                  A tax credit for homeowners with a home loan, applied for 10-13 years from move-in. Reduces income tax first, with any remainder spilling over to residence tax up to a cap.
                </SimpleTooltip>
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <FormControl sx={{ flex: '1 1 160px', minWidth: 140 }}>
                  <SpinnerNumberField
                    id="homeLoanCreditAmount"
                    name="creditAmount"
                    value={effectiveHomeLoan.creditAmount}
                    onInputChange={(e) => updateHomeLoan({ creditAmount: Number((e.target as HTMLInputElement).value) || 0 })}
                    label="Available credit amount (控除可能額)"
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                    helperText={'From your withholding statement, use 住宅借入金等特別控除可能額 (not 住宅借入金等特別控除の額).'}
                  />
                </FormControl>

                <TextField
                  select
                  size="small"
                  id="homeLoanMoveInYear"
                  label="Move-in Year"
                  value={effectiveHomeLoan.moveInYear}
                  onChange={(e) => updateHomeLoan({ moveInYear: Number(e.target.value) })}
                  sx={{ flex: '0 1 100px', minWidth: 100 }}
                >
                  {moveInYearOptions.map((y) => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </TextField>
              </Box>

              {/* 特定取得 toggle, shown only for move-in years where it changes the residence-tax
                  spillover cap (the 2014–2021 cohort). Defaults to checked = 特定取得. */}
              {homeLoanCreditDistinguishesTokuteiShutoku(effectiveHomeLoan.moveInYear) && (
                <FormControlLabel
                  sx={{ mt: 1.5, ml: 0, alignItems: 'flex-start' }}
                  control={
                    <Checkbox
                      size="small"
                      checked={effectiveHomeLoan.isTokuteiShutoku ?? true}
                      onChange={(e) => updateHomeLoan({ isTokuteiShutoku: e.target.checked })}
                      sx={{ py: 0, mr: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2" component="span" sx={{ fontSize: '0.85rem' }}>
                      Purchase subject to consumption tax? (特定取得)
                      <DetailedTooltip title="特定取得" icon={SIMPLE_TOOLTIP_ICON}>
                        <Box>
                          <Typography variant="body2">
                            Check this if consumption tax was charged on the purchase — i.e. a new build, or a
                            pre-owned home bought from a consumption tax-collecting business. Uncheck it if no
                            consumption tax was charged, such as a pre-owned home bought from a private individual. For 2014–2021
                            move-ins this changes the residence-tax spillover cap (特定取得 → 7% / ¥136,500;
                            non-特定取得 → 5% / ¥97,500).
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <a
                              href="https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/090929.html"
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--primary-main)', textDecoration: 'underline' }}
                            >
                              総務省: 個人住民税の住宅ローン控除
                            </a>
                          </Box>
                        </Box>
                      </DetailedTooltip>
                    </Typography>
                  }
                />
              )}

              {/* Surface any warning the credit calculation produced: income over the limit
                  (credit zeroed) OR part of the credit unusable this year (availableCredit > 0 but
                  capped). Gated only on a positive entered amount so we don't warn before the
                  user has entered a credit (the income-limit warning fires even at amount 0). */}
              {homeLoanTaxCreditResult && homeLoanTaxCreditResult.warnings.length > 0 && effectiveHomeLoan.creditAmount > 0 && (
                <Box sx={{ p: 1.5, bgcolor: 'warning.light', color: 'warning.contrastText', borderRadius: 1, mt: 2, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <WarningIcon sx={{ fontSize: '1.1rem', mt: '1px' }} />
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    {homeLoanTaxCreditResult.warnings.join(' ')}
                  </Typography>
                </Box>
              )}

              <Accordion disableGutters elevation={0} sx={{ mt: 2, border: '1px solid', borderColor: 'divider' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>How is the available credit amount calculated?</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1 }}>
                    The available credit amount is the <strong>year-end mortgage balance &times; the credit rate</strong> (<strong>0.7%</strong> for homes moved into from 2022, or <strong>1%</strong> for move-ins before 2022).
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1 }}>
                    The year-end balance is capped by a <strong>borrowing limit (借入限度額)</strong>. That limit depends on the home's energy-efficiency standard (認定長期優良住宅, ZEH水準, 省エネ基準, or 一般住宅), your household, and your move-in year. The credit runs for <strong>10 or 13 years</strong>.
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                    After the first year, this figure appears as <strong>住宅借入金等特別控除可能額</strong> on your annual withholding summary (源泉徴収票). To work it out for the first year, or to check the limits, see the{' '}
                    <a href="https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>MLIT overview</a> (which has the full limit table) and the{' '}
                    <a href="https://www.nta.go.jp/taxes/shiraberu/shinkoku/tokushu/keisubetsu/juutaku.htm" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>NTA guide</a>.
                  </Typography>
                </AccordionDetails>
              </Accordion>
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
