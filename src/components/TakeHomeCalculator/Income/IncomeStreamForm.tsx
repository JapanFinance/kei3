// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import { COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP } from '../../../constants/taxThresholds';
import type {
  CapitalGainsIncomeStream,
  IncomeStream,
  IncomeStreamType,
  InvestmentTaxTreatment,
} from '../../../types/tax';
import { formatJPY, formatMonthLong } from '../../../utils/formatters';
import { getFrequencyAnnualMultiplier } from '../../../utils/incomeStreams';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks from '../../ui/SourceLinks';
import { SpinnerNumberField } from '../../ui/SpinnerNumberField';
import { DetailedTooltip } from '../../ui/Tooltips';
import { getIncomeCategory, INCOME_STREAM_CATALOG } from './incomeStreamCatalog';

interface IncomeStreamFormProps {
  /**
   * Fixed for the life of the form: chosen before the form opens when adding, or taken from
   * {@link initialData} when editing.
   */
  type: IncomeStreamType;
  initialData?: IncomeStream;
  onSave: (stream: IncomeStream) => void;
  onCancel: () => void;
}

const guidanceBoxSx = {
  p: 1.5,
  backgroundColor: 'background.default',
  borderRadius: 1,
  mt: 2,
  border: '1px solid',
  borderColor: 'divider',
};

const variantToggleGroupSx = {
  '& .MuiToggleButton-root': {
    px: 2,
    py: 0.5,
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  '& .MuiToggleButton-root.Mui-selected': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    '&:hover': {
      bgcolor: 'primary.dark',
    },
  },
};

const variantLabelSx = {
  mb: 0.5,
  fontWeight: 500,
  color: 'text.primary',
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
};

export const IncomeStreamForm: React.FC<IncomeStreamFormProps> = ({
  type,
  initialData,
  onSave,
  onCancel,
}) => {
  const info = INCOME_STREAM_CATALOG[type];
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [frequency, setFrequency] = useState<'monthly' | '3-months' | '6-months' | 'annual'>(
    initialData?.type === 'salary' || initialData?.type === 'commutingAllowance'
      ? initialData.frequency
      : type === 'commutingAllowance'
        ? 'monthly'
        : 'annual',
  );
  const [month, setMonth] = useState<number>(
    (initialData?.type === 'bonus' && initialData.month) || 0,
  ); // 0 = Jan
  const [blueFilerDeduction, setBlueFilerDeduction] = useState<number>(
    (initialData?.type === 'business' && initialData.blueFilerDeduction) || 0,
  );
  const [issuerDomicile, setIssuerDomicile] = useState<'foreign' | 'domestic'>(
    initialData?.type === 'stockCompensation' ? initialData.issuerDomicile : 'foreign',
  );
  const [shareType, setShareType] = useState<'listed' | 'other'>(
    initialData?.type === 'capitalGains' || initialData?.type === 'dividends'
      ? initialData.shareType
      : 'listed',
  );
  const [payerDomicile, setPayerDomicile] = useState<'domestic' | 'foreign'>(
    initialData?.type === 'interest' ? initialData.payerDomicile : 'domestic',
  );
  const [account, setAccount] = useState<CapitalGainsIncomeStream['account']>(
    initialData?.type === 'capitalGains' ? initialData.account : 'specifiedWithholding',
  );
  const [taxTreatment, setTaxTreatment] = useState<InvestmentTaxTreatment>(
    initialData?.type === 'capitalGains' || initialData?.type === 'dividends'
      ? initialData.taxTreatment
      : 'withheldOnly',
  );
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (type === 'commutingAllowance') {
      const monthlyAmount = (amount * getFrequencyAnnualMultiplier(frequency)) / 12;

      if (monthlyAmount > COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP) {
        setError(
          `Commuting allowance cannot exceed ${formatJPY(COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP)}/month (non-taxable limit). For amounts exceeding this, please include the excess as part of the salary.`,
        );
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const id = initialData?.id ?? Date.now().toString(36) + Math.random().toString(36).substring(2);
    let stream: IncomeStream;

    switch (type) {
      case 'salary':
        stream = { id, type, amount, frequency: frequency as 'monthly' | 'annual' };
        break;
      case 'bonus':
        stream = { id, type, amount, month };
        break;
      case 'business':
        stream = { id, type, amount, blueFilerDeduction };
        break;
      case 'commutingAllowance':
        stream = { id, type, amount, frequency };
        break;
      case 'stockCompensation':
        stream = { id, type, amount, issuerDomicile };
        break;
      case 'miscellaneous':
      case 'publicPension':
        stream = { id, type, amount };
        break;
      case 'capitalGains':
        if (taxTreatment === 'aggregate') {
          // 措法37条の11 has no 総合課税 election, so the selector never offers one.
          throw new Error('総合課税 does not apply to a share sale.');
        }
        stream = { id, type, amount, shareType, account, taxTreatment };
        break;
      case 'dividends':
        stream = { id, type, amount, shareType, taxTreatment };
        break;
      case 'interest':
        stream = { id, type, amount, payerDomicile };
        break;
      default: {
        const unhandled: never = type;
        throw new Error(`Unhandled income stream type: ${String(unhandled)}`);
      }
    }

    onSave(stream);
  };

  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={info.chipLabel}
            size="small"
            color={getIncomeCategory(info.category).chipColor}
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
            {initialData ? 'Edit' : 'Add'} {info.label}
          </Typography>
        </Box>

        {type === 'salary' && (
          <FormControl fullWidth>
            <InputLabel id="salary-frequency-label">Frequency</InputLabel>
            <Select
              labelId="salary-frequency-label"
              value={frequency}
              label="Frequency"
              onChange={e => setFrequency(e.target.value)}
            >
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="annual">Annual</MenuItem>
            </Select>
          </FormControl>
        )}

        {type === 'commutingAllowance' && (
          <FormControl fullWidth>
            <InputLabel id="commuting-allowance-frequency-label">Frequency</InputLabel>
            <Select
              labelId="commuting-allowance-frequency-label"
              value={frequency}
              label="Frequency"
              onChange={e => setFrequency(e.target.value)}
            >
              <MenuItem value="monthly">1 Month</MenuItem>
              <MenuItem value="3-months">3 Months</MenuItem>
              <MenuItem value="6-months">6 Months</MenuItem>
              <MenuItem value="annual">Annual</MenuItem>
            </Select>
          </FormControl>
        )}

        {type === 'bonus' && (
          <FormControl fullWidth>
            <InputLabel>Month Paid</InputLabel>
            <Select value={month} label="Month Paid" onChange={e => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => (
                <MenuItem key={i} value={i}>
                  {formatMonthLong(i)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {type === 'stockCompensation' && (
          <FormControl fullWidth>
            <FormLabel id="stock-issuer-label" sx={variantLabelSx}>
              <span>Stock Issuer</span>
              <DetailedTooltip
                title="Stock Issuer"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="issuance info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Foreign-issued stock compensation</strong> means grants from a
                  non-Japanese company, such as the foreign parent company of a Japanese subsidiary.
                  It is not subject to social insurance premiums (社会保険料).
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  <strong>Domestic-issued stock compensation</strong> is not currently supported. It
                  is subject to social insurance premiums.
                </Typography>
              </DetailedTooltip>
            </FormLabel>
            <ToggleButtonGroup
              value={issuerDomicile}
              exclusive
              onChange={(_, newValue: 'domestic' | 'foreign' | null) => {
                if (newValue) {
                  setIssuerDomicile(newValue);
                }
              }}
              aria-labelledby="stock-issuer-label"
              aria-label="stock compensation issuance"
              size="small"
              sx={variantToggleGroupSx}
            >
              <ToggleButton value="domestic" disabled>
                Domestic
              </ToggleButton>
              <ToggleButton value="foreign">Foreign</ToggleButton>
            </ToggleButtonGroup>
          </FormControl>
        )}

        {(type === 'capitalGains' || type === 'dividends') && (
          <FormControl fullWidth>
            <FormLabel id="share-type-label" sx={variantLabelSx}>
              <span>Share Type</span>
              <DetailedTooltip
                title="Share Type"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="share type info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Listed (上場株式等)</strong> covers shares traded on an exchange, along
                  with 公募株式投資信託 and 特定公社債. These are taxed apart from the progressive
                  brackets at a flat rate.
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  <strong>Other (一般株式等)</strong> is everything else — 措法37条の10① defines it
                  as 株式等 other than 上場株式等, which is mostly but not only unlisted shares. It
                  is not currently supported: it is a separate class that cannot be offset against
                  listed amounts, and its dividends are taxed at the progressive rates instead.
                </Typography>
              </DetailedTooltip>
            </FormLabel>
            <ToggleButtonGroup
              value={shareType}
              exclusive
              onChange={(_, newValue: 'listed' | 'other' | null) => {
                if (newValue) {
                  setShareType(newValue);
                }
              }}
              aria-labelledby="share-type-label"
              aria-label="share type"
              size="small"
              sx={variantToggleGroupSx}
            >
              <ToggleButton value="listed">Listed</ToggleButton>
              <ToggleButton value="other" disabled>
                Other
              </ToggleButton>
            </ToggleButtonGroup>
          </FormControl>
        )}

        {type === 'capitalGains' && (
          <FormControl fullWidth>
            <InputLabel id="share-account-label">Account</InputLabel>
            <Select
              labelId="share-account-label"
              value={account}
              label="Account"
              onChange={e => setAccount(e.target.value)}
            >
              <MenuItem value="specifiedWithholding">
                特定口座（源泉徴収あり） — broker withholds
              </MenuItem>
              <MenuItem value="specifiedNoWithholding" disabled>
                特定口座（源泉徴収なし）
              </MenuItem>
              <MenuItem value="general" disabled>
                一般口座
              </MenuItem>
              <MenuItem value="foreign" disabled>
                Foreign broker
              </MenuItem>
            </Select>
            <FormHelperText
              component="div"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <span>Only a 源泉徴収あり account can leave the sale off a tax return.</span>
              <DetailedTooltip
                title="Account and the Election"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="account info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  措法37条の11の5 lets a share sale stay off the return only where it settles in a
                  源泉徴収選択口座 — a 特定口座 whose holder elected withholding.
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  A sale in a 特定口座（源泉徴収なし）, a 一般口座, or at a broker outside Japan has
                  to be reported, which changes 合計所得金額 and everything keyed to it. Those are
                  not modelled yet.
                </Typography>
              </DetailedTooltip>
            </FormHelperText>
          </FormControl>
        )}

        {(type === 'capitalGains' || type === 'dividends') && (
          <FormControl fullWidth>
            <FormLabel id="tax-treatment-label" sx={variantLabelSx}>
              <span>Tax treatment</span>
              <DetailedTooltip
                title="Tax Treatment"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="tax treatment info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Withheld only (申告不要)</strong> means the 20.315% the payer withholds
                  settles the tax in full. The amount stays off the return, so it changes no
                  aggregate — not 合計所得金額, health-insurance premiums, the basic deduction,
                  spouse or dependent eligibility, residence-tax exemption, or the furusato nozei
                  limit.
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  <strong>Reported</strong> — 申告分離課税, or 総合課税 for a dividend — is what
                  makes 損益通算 and 繰越控除 available, and for a dividend the 配当控除, at the
                  cost of entering those aggregates. Reporting is not modelled yet.
                </Typography>
              </DetailedTooltip>
            </FormLabel>
            <ToggleButtonGroup
              value={taxTreatment}
              exclusive
              onChange={(_, newValue: InvestmentTaxTreatment | null) => {
                if (newValue) {
                  setTaxTreatment(newValue);
                }
              }}
              aria-labelledby="tax-treatment-label"
              aria-label="tax treatment"
              size="small"
              sx={variantToggleGroupSx}
            >
              <ToggleButton value="withheldOnly">Withheld only</ToggleButton>
              <ToggleButton value="separate" disabled>
                Reported (separate)
              </ToggleButton>
              {type === 'dividends' && (
                <ToggleButton value="aggregate" disabled>
                  Reported (progressive)
                </ToggleButton>
              )}
            </ToggleButtonGroup>
          </FormControl>
        )}

        {type === 'interest' && (
          <FormControl fullWidth>
            <FormLabel id="interest-payer-label" sx={variantLabelSx}>
              <span>Paid</span>
              <DetailedTooltip
                title="Where the Interest Is Paid"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="interest payer info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>In Japan</strong> means a 一般利子等 payment received here, such as
                  interest on a deposit held in Japan. 措法3条① settles it by withholding at source,
                  with no election and nothing to report.
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  <strong>Outside Japan</strong> is not currently supported. No Japanese tax is
                  withheld, so the interest has to be reported and is taxed at the progressive
                  rates.
                </Typography>
              </DetailedTooltip>
            </FormLabel>
            <ToggleButtonGroup
              value={payerDomicile}
              exclusive
              onChange={(_, newValue: 'domestic' | 'foreign' | null) => {
                if (newValue) {
                  setPayerDomicile(newValue);
                }
              }}
              aria-labelledby="interest-payer-label"
              aria-label="where the interest is paid"
              size="small"
              sx={variantToggleGroupSx}
            >
              <ToggleButton value="domestic">In Japan</ToggleButton>
              <ToggleButton value="foreign" disabled>
                Outside Japan
              </ToggleButton>
            </ToggleButtonGroup>
          </FormControl>
        )}

        <Box>
          {type === 'business' && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="blue-filer-label">Blue-Filer Special Deduction</InputLabel>
              <Select
                labelId="blue-filer-label"
                value={blueFilerDeduction}
                label="Blue-Filer Special Deduction"
                onChange={e => setBlueFilerDeduction(e.target.value)}
              >
                <MenuItem value={0}>None</MenuItem>
                <MenuItem value={100000}>¥100,000</MenuItem>
                <MenuItem value={550000}>¥550,000</MenuItem>
                <MenuItem value={650000}>¥650,000</MenuItem>
              </Select>
              <FormHelperText
                component="div"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <span>
                  See{' '}
                  <a
                    href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2072.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    No.2072 青色申告特別控除 (NTA)
                  </a>
                  .
                </span>
                <DetailedTooltip
                  title="Blue-Filer Requirements"
                  icon={<InfoOutlinedIcon fontSize="small" />}
                  iconAriaLabel="requirements"
                >
                  <Typography variant="caption" sx={{ display: 'block', mb: 1, lineHeight: 1.2 }}>
                    Requires prior tax office approval (see{' '}
                    <a
                      href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      Blue-Form Approval Application
                    </a>
                    ).
                  </Typography>

                  <Box
                    component="table"
                    sx={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.75rem',
                      '& th': {
                        textAlign: 'center',
                        p: 0.5,
                        fontWeight: 600,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        verticalAlign: 'middle',
                      },
                      '& td': {
                        textAlign: 'center',
                        p: 0.5,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        verticalAlign: 'middle',
                      },
                      '& td:first-of-type': {
                        textAlign: 'left',
                        fontWeight: 500,
                        color: 'text.secondary',
                      },
                    }}
                  >
                    <thead>
                      <tr>
                        <Box component="th" sx={{ width: '30%', textAlign: 'left' }}>
                          Requirement
                        </Box>
                        <Box component="th" sx={{ color: 'primary.main' }}>
                          ¥650k
                        </Box>
                        <Box component="th" sx={{ color: 'text.primary' }}>
                          ¥550k
                        </Box>
                        <Box component="th" sx={{ color: 'text.secondary' }}>
                          ¥100k
                        </Box>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Bookkeeping</td>
                        <Box component="td" sx={{ color: 'success.main' }}>
                          Double Entry
                        </Box>
                        <Box component="td" sx={{ color: 'success.main' }}>
                          Double Entry
                        </Box>
                        <Box component="td" sx={{ color: 'text.secondary' }}>
                          Simple
                        </Box>
                      </tr>
                      <tr>
                        <td>Balance Sheet, Profit & Loss Statement</td>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                          ○
                        </Box>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                          ○
                        </Box>
                        <Box component="td" sx={{ color: 'text.disabled' }}>
                          —
                        </Box>
                      </tr>
                      <tr>
                        <td>On-time Filing</td>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                          ○
                        </Box>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                          ○
                        </Box>
                        <Box component="td" sx={{ color: 'text.disabled' }}>
                          —
                        </Box>
                      </tr>
                      <tr>
                        <td>e-Tax or Electronic Books</td>
                        <Box component="td" sx={{ color: 'success.main', fontSize: '1rem' }}>
                          ○
                        </Box>
                        <Box component="td" sx={{ color: 'text.disabled' }}>
                          —
                        </Box>
                        <Box component="td" sx={{ color: 'text.disabled' }}>
                          —
                        </Box>
                      </tr>
                    </tbody>
                  </Box>
                </DetailedTooltip>
              </FormHelperText>
            </FormControl>
          )}

          <SpinnerNumberField
            inputProps={{ autoFocus: true }}
            label={info.amountLabel}
            value={amount}
            onChange={val => setAmount(val)}
            sx={{ width: '100%' }}
            helperText={error || info.amountHelperText}
            error={!!error}
            {...(info.min !== undefined && { min: info.min })}
          />
          {type === 'salary' && frequency === 'monthly' && amount > 0 && (
            <Typography variant="body2" align="right" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Annual: {formatJPY(amount * 12)}
            </Typography>
          )}
          {type === 'commutingAllowance' && amount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Monthly: {formatJPY((amount * getFrequencyAnnualMultiplier(frequency)) / 12)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Annual: {formatJPY(amount * getFrequencyAnnualMultiplier(frequency))}
              </Typography>
            </Box>
          )}

          {(type === 'capitalGains' || type === 'dividends') && (
            <Box sx={guidanceBoxSx}>
              <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
                The broker withholds 20.315% — 15.315% income tax including 復興特別所得税, and 5%
                residence tax. A capital loss for the year is netted against dividends within the
                account before withholding, as the broker does at year end.
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                Do not include NISA (非課税) amounts.
              </Typography>
              <SourceLinks
                sources={[
                  {
                    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm',
                    label: '株式等を譲渡したときの課税(申告分離課税) - NTA',
                  },
                  {
                    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1330.htm',
                    label: '配当金を受け取ったとき(配当所得) - NTA',
                  },
                  {
                    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1476.htm',
                    label: '特定口座制度 - NTA',
                  },
                ]}
              />
            </Box>
          )}

          {type === 'interest' && (
            <Box sx={guidanceBoxSx}>
              <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
                Taxed at source at 20.315% (源泉分離課税) and not reported on a tax return, so it
                does not affect 合計所得金額 or anything that depends on it.
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                This covers 利子所得 only — the interest on 公社債 and 預貯金, and distributions
                from 合同運用信託, 公社債投資信託 and 公募公社債等運用投資信託 (所法23条①). Interest
                on money lent privately is 雑所得 rather than 利子所得: nothing is withheld from it
                and it has to be reported, so enter it as Miscellaneous income instead.
              </Typography>
              <SourceLinks
                sources={[
                  {
                    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1310.htm',
                    label: '利息を受け取ったとき(利子所得) - NTA',
                  },
                ]}
              />
            </Box>
          )}

          {type === 'publicPension' && (
            <Box sx={guidanceBoxSx}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                What Counts as Public Pension (公的年金等)
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
                National Pension (国民年金), Employees' Pension (厚生年金保険), mutual-aid pensions
                (共済組合の年金), and pensions from past employment, including annuities received
                from defined benefit plans (確定給付企業年金) and defined contribution plans
                (確定拠出年金, such as iDeCo). Pensions from a foreign social insurance or mutual
                aid system comparable to the National Pension or Employees' Pension are also
                included.
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                Disability pensions (障害年金) and survivors' pensions (遺族年金) are non-taxable
                and should not be included. Payments from private individual annuity insurance
                (個人年金保険) are not considered public pension income. For private pensions,
                instead enter the amount net of the premiums paid as Miscellaneous income.
              </Typography>
              <SourceLinks
                sources={[
                  {
                    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm',
                    label: '公的年金等の課税関係 - NTA',
                  },
                ]}
              />
            </Box>
          )}

          {type === 'stockCompensation' && (
            <Box sx={guidanceBoxSx}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                How to Calculate Stock-Based Compensation Income
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
                See the notes below for more specific information. In general, calculate the JPY
                amount of financial benefit realized.
              </Typography>

              <Accordion sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Exchange Rate
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">
                    Use the TTM (Telegraphic Transfer Middle) exchange rate on the day of the
                    taxable event for converting foreign currency denominated share value to JPY. If
                    that date's exchange rate is not available, use the closest available prior
                    date's TTM rate.
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', mt: 1, display: 'block' }}
                  >
                    Example conversion: $15,000 × 150 JPY/USD = ¥2,250,000.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    RS / RSU / PS / PSU{' '}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Restricted Stock (Units) / Performance Shares (Units)
                  </Typography>
                  <Typography variant="body2">
                    Use the fair market value on the vesting date of the vested shares.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Stock Options
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Use (share price at exercise − strike price) × exercised shares.
                  </Typography>
                  <Typography variant="body2">
                    Only{' '}
                    <a
                      href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1543.htm"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      non-qualified stock options
                    </a>{' '}
                    income should be entered here.{' '}
                    <a
                      href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1540.htm"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      Qualified stock options
                    </a>{' '}
                    are not currently supported.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    ESPP (Employee Stock Purchase Plan)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">
                    Use the discount amount when shares are purchased. For example, for shares
                    purchased with a fair market value of $10,000 at a 15% discount (i.e. for
                    $8,500), the taxable amount is $1,500.
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Foreign-Source Income & Non-Permanent Tax Residents
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">
                    If work was performed outside Japan for a period of time between grant and
                    vest/exercise, the proportion of the income realized equal to the proportion of
                    time worked outside Japan would be foreign-source income. For a{' '}
                    <a
                      href="https://wiki.japanfinance.org/tax/income/#non-permanent-tax-residents"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      non-permanent tax resident
                    </a>{' '}
                    at the time that income is realized, the foreign-source income will not be
                    taxable in Japan unless{' '}
                    <a
                      href="https://wiki.japanfinance.org/tax/income/#income-that-is-neither-japan-source-nor-foreign-source"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      remittances to Japan
                    </a>{' '}
                    were made in the same year that make some or all of it taxable. Taxpayers who
                    are not non-permanent tax residents would have to use foreign tax credits to
                    alleviate Japanese taxation on the foreign-source income that will be taxable in
                    the foreign country.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1.5 }}>
                    Only input the amount of stock-based compensation income that is taxable in
                    Japan.
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </Box>

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {initialData ? 'Update' : 'Add'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};
