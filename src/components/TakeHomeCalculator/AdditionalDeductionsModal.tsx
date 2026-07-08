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
import { useTheme, type SxProps, type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type {
  HomeLoanTaxCreditInput,
  HomeLoanTaxCreditResult,
  LifeInsuranceInput,
  EarthquakeInsuranceInput,
  MedicalExpensesInput,
  AdditionalDeductionsResult,
} from '../../types/tax';
import { SpinnerNumberField } from '../ui/SpinnerNumberField';
import { SimpleTooltip, DetailedTooltip } from '../ui/Tooltips';
import { SIMPLE_TOOLTIP_ICON } from '../ui/constants';
import {
  earliestEligibleMoveInYear,
  homeLoanCreditDistinguishesTokuteiShutoku,
} from '../../utils/homeLoanTaxCredit';
import { formatJPY } from '../../utils/formatters';
import { ADDITIONAL_DEDUCTION_INFO } from './additionalDeductionInfo';

interface AdditionalDeductionsModalProps {
  open: boolean;
  onClose: () => void;
  dcPlanContributions: number;
  onDcPlanContributionsChange: (value: number) => void;
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
  onHomeLoanTaxCreditChange: (input: HomeLoanTaxCreditInput | undefined) => void;
  homeLoanTaxCreditResult?: HomeLoanTaxCreditResult | undefined;
  lifeInsurance: LifeInsuranceInput;
  onLifeInsuranceChange: (input: LifeInsuranceInput) => void;
  earthquakeInsurance: EarthquakeInsuranceInput;
  onEarthquakeInsuranceChange: (input: EarthquakeInsuranceInput) => void;
  medicalExpenses: MedicalExpensesInput;
  onMedicalExpensesChange: (input: MedicalExpensesInput) => void;
  /** Computed additional deductions, used for the live per-card readouts. */
  additionalDeductions?: AdditionalDeductionsResult | undefined;
  /** Income year being modeled; upper bound for the home-loan move-in-year dropdown. */
  incomeYear: number;
}

/**
 * Shared style for the live "Deduction: …" readouts under each card: a muted line whose bold
 * figures are lifted to the primary colour so they stand out. Keeping the emphasis on the line
 * (via `& strong`) lets the content stay plain `<strong>` markup, and scopes the recolour here rather than
 * globally — where it would clobber intentionally-coloured text elsewhere.
 */
const readoutSx: SxProps<Theme> = {
  mt: 1.5,
  fontSize: '0.85rem',
  color: 'text.secondary',
  '& strong': { color: 'text.primary', fontWeight: 600 },
};

const SectionHeader: React.FC<{ children: React.ReactNode; tooltip?: string }> = ({
  children,
  tooltip,
}) => (
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

/**
 * Info icon + popover shown next to a computed deduction readout, explaining how the amount was
 * derived and linking the official source. These deductions are computed for the user, so the
 * explanation lives next to the result (not in a "how to calculate" accordion like the home loan
 * credit, whose accordion explains how to derive the figure the user must enter).
 */
const DeductionCalcTooltip: React.FC<{ infoKey: keyof typeof ADDITIONAL_DEDUCTION_INFO }> = ({
  infoKey,
}) => {
  const info = ADDITIONAL_DEDUCTION_INFO[infoKey];
  return (
    <DetailedTooltip title={info.name} icon={SIMPLE_TOOLTIP_ICON}>
      <Box>
        <Typography variant="body2">{info.explanation}</Typography>
        <Box sx={{ mt: 1 }}>
          <a
            href={info.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary-main)', textDecoration: 'underline' }}
          >
            {info.sourceLabel}
          </a>
        </Box>
      </Box>
    </DetailedTooltip>
  );
};

export const AdditionalDeductionsModal: React.FC<AdditionalDeductionsModalProps> = ({
  open,
  onClose,
  dcPlanContributions,
  onDcPlanContributionsChange,
  homeLoanTaxCredit,
  onHomeLoanTaxCreditChange,
  homeLoanTaxCreditResult,
  lifeInsurance,
  onLifeInsuranceChange,
  earthquakeInsurance,
  onEarthquakeInsuranceChange,
  medicalExpenses,
  onMedicalExpensesChange,
  additionalDeductions,
  incomeYear,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Insurance category fields: on mobile, shorten the label to English (using `shortEn` when the
  // full English is too wide) and move the Japanese term to helper text so the inputs fit on one
  // row; on desktop (already one row, with room) keep the full inline "English (日本語)".
  const catField = (
    en: string,
    jp: string,
    shortEn: string = en,
  ): { label: string; helperText?: string } =>
    isMobile ? { label: shortEn, helperText: jp } : { label: `${en} (${jp})` };

  // The three-up life fields are narrow on mobile; trim the input's side padding so a 6-digit ¥
  // value fits without clipping. (No-op on desktop, where the fields are wide.)
  const denseValueSx = isMobile ? { '& .MuiInputBase-input': { px: 1 } } : undefined;

  const effectiveHomeLoan: HomeLoanTaxCreditInput = homeLoanTaxCredit ?? {
    moveInYear: incomeYear,
    creditAmount: 0,
  };

  const moveInYearOptions = React.useMemo(() => {
    const floor = earliestEligibleMoveInYear(incomeYear);
    const years: number[] = [];
    for (let y = incomeYear; y >= floor; y--) years.push(y);
    return years;
  }, [incomeYear]);

  const updateHomeLoan = (patch: Partial<HomeLoanTaxCreditInput>) => {
    onHomeLoanTaxCreditChange({ ...effectiveHomeLoan, ...patch });
  };

  const lifeInput = lifeInsurance;
  const updateLife = (patch: Partial<LifeInsuranceInput>) => {
    onLifeInsuranceChange({ ...lifeInput, ...patch });
  };
  const [showOldLife, setShowOldLife] = React.useState(
    !!(lifeInsurance.generalOld || lifeInsurance.pensionOld),
  );
  const toggleOldLife = (checked: boolean) => {
    setShowOldLife(checked);
    if (!checked) updateLife({ generalOld: 0, pensionOld: 0 });
  };

  const earthquakeInput = earthquakeInsurance;
  const updateEarthquake = (patch: Partial<EarthquakeInsuranceInput>) => {
    onEarthquakeInsuranceChange({ ...earthquakeInput, ...patch });
  };

  const medicalInput = medicalExpenses;
  const updateMedical = (patch: Partial<MedicalExpensesInput>) => {
    onMedicalExpensesChange({ ...medicalInput, ...patch });
  };

  const lifeItem = additionalDeductions?.items.find(i => i.key === 'lifeInsurance');
  const earthquakeItem = additionalDeductions?.items.find(i => i.key === 'earthquakeInsurance');
  const medicalItem = additionalDeductions?.items.find(i => i.key === 'medical');

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
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          pt: isMobile ? 'max(16px, env(safe-area-inset-top))' : 2,
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
        }}
      >
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

      <DialogContent
        sx={{
          p: { xs: 2, sm: 3 },
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Income Deductions (所得控除) */}
        <Box>
          <SectionHeader tooltip="Deductions (所得控除) reduce taxable income before tax is calculated.">
            Income Deductions (所得控除)
          </SectionHeader>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <FormControl fullWidth>
                <Typography
                  gutterBottom
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    mb: 0.5,
                    color: 'text.primary',
                  }}
                >
                  <a
                    href="https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/kyoshutsu/gaiyou.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', fontWeight: 500 }}
                  >
                    iDeCo / Corporate DC Plan
                  </a>
                  {' '}Contributions
                </Typography>
                <SpinnerNumberField
                  id="dcPlanContributions"
                  name="dcPlanContributions"
                  value={dcPlanContributions}
                  onChange={onDcPlanContributionsChange}
                  label="Annual Contributions"
                  step={1_000}
                  shiftStep={10_000}
                  helperText="Not including employer contributions."
                />
              </FormControl>
            </CardContent>
          </Card>

          {/* Life Insurance (生命保険料控除) */}
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'text.primary',
                }}
              >
                Life Insurance (生命保険料控除)
                <SimpleTooltip>
                  A deduction for life, medical-care, and pension insurance premiums. Enter the
                  annual premiums; the calculator works out the deductions for income tax and
                  residence tax, which may differ.
                </SimpleTooltip>
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}
              >
                New contracts (新契約) — policies from 2012.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl sx={{ flex: '1 1 86px', minWidth: 86 }}>
                  <SpinnerNumberField
                    id="lifeGeneralNew"
                    name="lifeGeneralNew"
                    value={lifeInput.generalNew}
                    onChange={value => updateLife({ generalNew: value })}
                    {...catField('General', '一般')}
                    {...(denseValueSx && { sx: denseValueSx })}
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                  />
                </FormControl>
                <FormControl sx={{ flex: '1 1 86px', minWidth: 86 }}>
                  <SpinnerNumberField
                    id="lifeMedicalCareNew"
                    name="lifeMedicalCareNew"
                    value={lifeInput.medicalCareNew}
                    onChange={value => updateLife({ medicalCareNew: value })}
                    {...catField('Medical care', '介護医療', 'Medical')}
                    {...(denseValueSx && { sx: denseValueSx })}
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                  />
                </FormControl>
                <FormControl sx={{ flex: '1 1 86px', minWidth: 86 }}>
                  <SpinnerNumberField
                    id="lifePensionNew"
                    name="lifePensionNew"
                    value={lifeInput.pensionNew}
                    onChange={value => updateLife({ pensionNew: value })}
                    {...catField('Pension', '個人年金')}
                    {...(denseValueSx && { sx: denseValueSx })}
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                  />
                </FormControl>
              </Box>

              <FormControlLabel
                sx={{ mt: 1, ml: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={showOldLife}
                    onChange={e => toggleOldLife(e.target.checked)}
                    sx={{ py: 0, mr: 0.5 }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    Input pre-2012 policies (旧契約)
                  </Typography>
                }
              />
              {showOldLife && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                  <FormControl sx={{ flex: '1 1 130px', minWidth: 120 }}>
                    <SpinnerNumberField
                      id="lifeGeneralOld"
                      name="lifeGeneralOld"
                      value={lifeInput.generalOld ?? 0}
                      onChange={value => updateLife({ generalOld: value })}
                      {...catField('General, old', '旧一般')}
                      step={1_000}
                      shiftStep={10_000}
                      min={0}
                    />
                  </FormControl>
                  <FormControl sx={{ flex: '1 1 130px', minWidth: 120 }}>
                    <SpinnerNumberField
                      id="lifePensionOld"
                      name="lifePensionOld"
                      value={lifeInput.pensionOld ?? 0}
                      onChange={value => updateLife({ pensionOld: value })}
                      {...catField('Pension, old', '旧個人年金')}
                      step={1_000}
                      shiftStep={10_000}
                      min={0}
                    />
                  </FormControl>
                </Box>
              )}

              {lifeItem && (
                <Typography variant="body2" sx={readoutSx}>
                  Deduction: <strong>{formatJPY(lifeItem.national)}</strong> income tax,{' '}
                  <strong>{formatJPY(lifeItem.residence)}</strong> residence tax
                  <DeductionCalcTooltip infoKey="lifeInsurance" />
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Earthquake Insurance (地震保険料控除) */}
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'text.primary',
                }}
              >
                Earthquake Insurance (地震保険料控除)
                <SimpleTooltip>
                  A deduction for earthquake insurance premiums (and qualifying pre-2007 long-term
                  casualty premiums). The deduction differs for income tax and residence tax.
                </SimpleTooltip>
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <FormControl sx={{ flex: '1 1 130px', minWidth: 120 }}>
                  <SpinnerNumberField
                    id="earthquakePremium"
                    name="earthquakePremium"
                    value={earthquakeInput.earthquake}
                    onChange={value => updateEarthquake({ earthquake: value })}
                    {...catField('Earthquake premium', '地震保険料', 'Earthquake')}
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                  />
                </FormControl>
                <FormControl sx={{ flex: '1 1 130px', minWidth: 120 }}>
                  <SpinnerNumberField
                    id="earthquakeLongTermOld"
                    name="earthquakeLongTermOld"
                    value={earthquakeInput.longTermOld}
                    onChange={value => updateEarthquake({ longTermOld: value })}
                    {...catField('Long-term, old', '旧長期損害保険料', 'Long-term')}
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                  />
                </FormControl>
              </Box>

              {earthquakeItem && (
                <Typography variant="body2" sx={readoutSx}>
                  Deduction: <strong>{formatJPY(earthquakeItem.national)}</strong> income tax,{' '}
                  <strong>{formatJPY(earthquakeItem.residence)}</strong> residence tax
                  <DeductionCalcTooltip infoKey="earthquakeInsurance" />
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Medical Expenses (医療費控除) */}
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'text.primary',
                }}
              >
                Medical Expenses (医療費控除)
                <SimpleTooltip>
                  Enter the medical expenses paid and any reimbursements (insurance payouts,
                  高額療養費, government subsidies, etc.). The calculator subtracts the income-based
                  floor automatically, so enter the raw amounts — not a deduction figure. This is
                  the standard 医療費控除 only; the セルフメディケーション税制 (医療費控除の特例)
                  alternative isn&apos;t supported yet.
                </SimpleTooltip>
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl sx={{ flex: '1 1 130px', minWidth: 120 }}>
                  <SpinnerNumberField
                    id="medicalPaid"
                    name="medicalPaid"
                    value={medicalInput.paid}
                    onChange={value => updateMedical({ paid: value })}
                    label="Total paid"
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                  />
                </FormControl>
                <FormControl sx={{ flex: '1 1 130px', minWidth: 120 }}>
                  <SpinnerNumberField
                    id="medicalReimbursed"
                    name="medicalReimbursed"
                    value={medicalInput.reimbursed}
                    onChange={value => updateMedical({ reimbursed: value })}
                    label="Reimbursements"
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                  />
                </FormControl>
              </Box>

              {medicalItem ? (
                <Typography variant="body2" sx={readoutSx}>
                  Deduction: <strong>{formatJPY(medicalItem.national)}</strong>
                  <DeductionCalcTooltip infoKey="medical" />
                </Typography>
              ) : (
                medicalInput.paid > 0 && (
                  <Typography variant="body2" sx={readoutSx}>
                    The calculated amount is less than the deduction floor (the lower of ¥100,000
                    and 5% of income).
                  </Typography>
                )
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Tax Credits (税額控除) */}
        <Box>
          <SectionHeader tooltip="Tax credits (税額控除) reduce the tax owed directly, after it has been calculated.">
            Tax Credits (税額控除)
          </SectionHeader>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'text.primary',
                }}
              >
                Home Loan Tax Credit (住宅ローン控除)
                <SimpleTooltip>
                  A tax credit for homeowners with a home loan, applied for 10-13 years from
                  move-in. Reduces income tax first, with any remainder spilling over to residence
                  tax up to a cap.
                </SimpleTooltip>
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <FormControl sx={{ flex: '1 1 160px', minWidth: 140 }}>
                  <SpinnerNumberField
                    id="homeLoanCreditAmount"
                    name="creditAmount"
                    value={effectiveHomeLoan.creditAmount}
                    onChange={value => updateHomeLoan({ creditAmount: value })}
                    label="Available credit amount (控除可能額)"
                    step={1_000}
                    shiftStep={10_000}
                    min={0}
                    helperText={
                      'From the withholding statement, use 住宅借入金等特別控除可能額 (not 住宅借入金等特別控除の額).'
                    }
                  />
                </FormControl>

                <TextField
                  select
                  id="homeLoanMoveInYear"
                  label="Move-in Year"
                  value={effectiveHomeLoan.moveInYear}
                  onChange={e => updateHomeLoan({ moveInYear: Number(e.target.value) })}
                  sx={{ flex: '0 1 100px', minWidth: 100 }}
                >
                  {moveInYearOptions.map(y => (
                    <MenuItem key={y} value={y}>
                      {y}
                    </MenuItem>
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
                      onChange={e => updateHomeLoan({ isTokuteiShutoku: e.target.checked })}
                      sx={{ py: 0, mr: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2" component="span" sx={{ fontSize: '0.85rem' }}>
                      Purchase subject to consumption tax? (特定取得)
                      <DetailedTooltip title="特定取得" icon={SIMPLE_TOOLTIP_ICON}>
                        <Box>
                          <Typography variant="body2">
                            Check this if consumption tax was charged on the purchase — i.e. a new
                            build, or a pre-owned home bought from a consumption tax-collecting
                            business. Uncheck it if no consumption tax was charged, such as a
                            pre-owned home bought from a private individual. For 2014–2021 move-ins
                            this changes the residence tax spillover cap (特定取得 → 7% / ¥136,500;
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
              {homeLoanTaxCreditResult &&
                homeLoanTaxCreditResult.warnings.length > 0 &&
                effectiveHomeLoan.creditAmount > 0 && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: 'warning.light',
                      color: 'warning.contrastText',
                      borderRadius: 1,
                      mt: 2,
                      display: 'flex',
                      gap: 1,
                      alignItems: 'flex-start',
                    }}
                  >
                    <WarningIcon sx={{ fontSize: '1.1rem', mt: '1px' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                      {homeLoanTaxCreditResult.warnings.join(' ')}
                    </Typography>
                  </Box>
                )}

              <Accordion
                disableGutters
                elevation={0}
                sx={{ mt: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    How is the available credit amount calculated?
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1 }}
                  >
                    The available credit amount is the{' '}
                    <strong>year-end mortgage balance &times; the credit rate</strong> (
                    <strong>0.7%</strong> for homes moved into from 2022, or <strong>1%</strong> for
                    move-ins before 2022).
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 1 }}
                  >
                    The year-end balance is capped by a{' '}
                    <strong>borrowing limit (借入限度額)</strong>. That limit depends on the home's
                    energy-efficiency standard (認定長期優良住宅, ZEH水準, 省エネ基準, or 一般住宅),
                    family composition, and the move-in year. The credit runs for{' '}
                    <strong>10 or 13 years</strong>.
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                    After the first year, this figure appears as{' '}
                    <strong>住宅借入金等特別控除可能額</strong> on the annual withholding summary
                    (源泉徴収票). To work it out for the first year, or to check the limits, see the{' '}
                    <a
                      href="https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk2_000017.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      MLIT overview
                    </a>{' '}
                    (which has the full limit table) and the{' '}
                    <a
                      href="https://www.nta.go.jp/taxes/shiraberu/shinkoku/tokushu/keisubetsu/juutaku.htm"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      NTA guide
                    </a>
                    .
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions
        sx={{
          px: isMobile ? 'max(16px, env(safe-area-inset-left))' : 3,
          py: 2,
          pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : 2,
        }}
      >
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
