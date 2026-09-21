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
import {
  DEFAULT_REPORTED_DIVIDENDS_TAXATION,
  type CapitalGainsIncomeStream,
  type IncomeStream,
  type IncomeStreamType,
  type ReportedDividendsTaxation,
} from '../../../types/tax';
import { formatJPY, formatMonthLong } from '../../../utils/formatters';
import { getFrequencyAnnualMultiplier } from '../../../utils/incomeStreams';
import { withholdingAccountDividendsMustBeReported } from '../../../utils/investmentReporting';
import { SIMPLE_TOOLTIP_ICON } from '../../ui/constants';
import SourceLinks from '../../ui/SourceLinks';
import { SpinnerNumberField } from '../../ui/SpinnerNumberField';
import { DetailedTooltip } from '../../ui/Tooltips';
import { getIncomeCategory, INCOME_STREAM_CATALOG } from './incomeStreamCatalog';
import { variantLabelSx, variantToggleGroupSx } from './variantControlStyles';

interface IncomeStreamFormProps {
  /**
   * Fixed for the life of the form: chosen before the form opens when adding, or taken from
   * {@link initialData} when editing.
   */
  type: IncomeStreamType;
  initialData?: IncomeStream;
  onSave: (stream: IncomeStream) => void;
  onCancel: () => void;
  /**
   * The election in force for every reported dividend, so the form can say how a dividend it
   * reports will be taxed. Made in the income list, not here; the default when omitted.
   */
  reportedDividendsTaxation?: ReportedDividendsTaxation | undefined;
}

const guidanceBoxSx = {
  p: 1.5,
  backgroundColor: 'background.default',
  borderRadius: 1,
  mt: 2,
  border: '1px solid',
  borderColor: 'divider',
};

export const IncomeStreamForm: React.FC<IncomeStreamFormProps> = ({
  type,
  initialData,
  onSave,
  onCancel,
  reportedDividendsTaxation = DEFAULT_REPORTED_DIVIDENDS_TAXATION,
}) => {
  const info = INCOME_STREAM_CATALOG[type];
  const [amount, setAmount] = useState<number>(
    initialData && 'amount' in initialData ? initialData.amount : 0,
  );
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
    initialData?.type === 'capitalGains' ? initialData.account : 'domesticNoWithholding',
  );
  const [paymentChannel, setPaymentChannel] = useState<'domestic' | 'abroad'>(
    initialData?.type === 'dividends' ? initialData.paymentChannel : 'domestic',
  );
  const [isReported, setIsReported] = useState<boolean>(
    initialData?.type === 'dividends' ? initialData.isReported : false,
  );
  const [accountCapitalGains, setAccountCapitalGains] = useState<number>(
    initialData?.type === 'withholdingAccount' ? initialData.capitalGains : 0,
  );
  const [accountDividends, setAccountDividends] = useState<number>(
    initialData?.type === 'withholdingAccount' ? initialData.dividends : 0,
  );
  const [reportsCapitalGains, setReportsCapitalGains] = useState<boolean>(
    initialData?.type === 'withholdingAccount' ? initialData.reportsCapitalGains : false,
  );
  const [reportsDividends, setReportsDividends] = useState<boolean>(
    initialData?.type === 'withholdingAccount' ? initialData.reportsDividends : false,
  );
  const [error, setError] = useState<string | null>(null);

  // 措法37条の11の6⑩: a reported loss that reduced the account's dividend withholding drags the
  // dividends onto the return regardless of the toggle below.
  const dividendsForced = withholdingAccountDividendsMustBeReported({
    capitalGains: accountCapitalGains,
    dividends: accountDividends,
    reportsCapitalGains,
  });

  const handlePaymentChannelChange = (newPaymentChannel: 'domestic' | 'abroad') => {
    setPaymentChannel(newPaymentChannel);
    // 措令4条の3②五・六 excludes a dividend paid abroad from 申告不要.
    if (newPaymentChannel === 'abroad') {
      setIsReported(true);
    }
  };

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
      case 'withholdingAccount':
        stream = {
          id,
          type,
          capitalGains: accountCapitalGains,
          dividends: accountDividends,
          reportsCapitalGains,
          reportsDividends: dividendsForced || reportsDividends,
        };
        break;
      case 'capitalGains':
        stream = { id, type, amount, shareType, account };
        break;
      case 'dividends':
        stream = {
          id,
          type,
          amount,
          shareType,
          paymentChannel,
          isReported: paymentChannel === 'abroad' || isReported,
        };
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
          {info.labelDetail && (
            <Typography variant="caption" sx={{ color: 'text.secondary', flexBasis: '100%' }}>
              {info.labelDetail}
            </Typography>
          )}
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
              <MenuItem value="domesticNoWithholding">
                Domestic account without withholding (特定口座（源泉徴収なし）・一般口座)
              </MenuItem>
              <MenuItem value="foreign">Foreign account</MenuItem>
            </Select>
            <FormHelperText
              component="div"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <span>
                A sale outside a withholding designated account is always reported. That account has
                its own entry type.
              </span>
              <DetailedTooltip
                title="Account"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="account info"
              >
                <Typography sx={{ display: 'block' }}>
                  A 特定口座（源泉徴収なし）and a 一般口座 are one option here because the tax
                  cannot tell them apart — they differ only in who computes the figures. A foreign
                  account is its own option because a sale there is not 売委託 to a licensed
                  金融商品取引業者, which 措法37条の12の2② requires of a loss before it can offset
                  配当等 or be carried forward: a loss in a foreign account is netted against the
                  year's other reported gains and no further.
                </Typography>
              </DetailedTooltip>
            </FormHelperText>
          </FormControl>
        )}

        {type === 'dividends' && (
          <FormControl fullWidth>
            <FormLabel id="dividend-payment-channel-label" sx={variantLabelSx}>
              <span>Paid</span>
              <DetailedTooltip
                title="Where the Dividend Is Paid"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="dividend payment channel info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>In Japan</strong> means paid in Japan, or paid abroad through a Japanese
                  broker that handles the payment (支払の取扱者). Japanese tax was withheld, so the
                  dividend may be left to withholding per payment (措法8条の5, 9条の2⑤).
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  <strong>Abroad</strong> means received outside Japan with no Japanese handler — a
                  foreign brokerage account, for example. Such a dividend cannot be left to
                  withholding (措令4条の3②五・六), so it has to be reported.
                </Typography>
              </DetailedTooltip>
            </FormLabel>
            <ToggleButtonGroup
              value={paymentChannel}
              exclusive
              onChange={(_, newValue: 'domestic' | 'abroad' | null) => {
                if (newValue) {
                  handlePaymentChannelChange(newValue);
                }
              }}
              aria-labelledby="dividend-payment-channel-label"
              aria-label="where the dividend is paid"
              size="small"
              sx={variantToggleGroupSx}
            >
              <ToggleButton value="domestic">In Japan</ToggleButton>
              <ToggleButton value="abroad">Abroad</ToggleButton>
            </ToggleButtonGroup>
          </FormControl>
        )}

        {type === 'dividends' && (
          <FormControl fullWidth>
            <FormLabel id="reporting-label" sx={variantLabelSx}>
              <span>Reporting</span>
              <DetailedTooltip
                title="Reporting"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="reporting info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Withheld only (申告不要)</strong> means the 20.315% the payer withholds
                  settles the tax in full. The amount stays off the return, so it changes no
                  aggregate — not 合計所得金額, health-insurance premiums, the basic deduction,
                  spouse or dependent eligibility, residence-tax exemption, or the furusato nozei
                  limit. It is a choice per payment (措法8条の5, 37条の11の5).
                </Typography>
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Reported</strong> puts the amount on the return, where it enters
                  合計所得金額 — and so every figure keyed to it. Tax the payer withheld on a
                  reported amount is credited at filing, so it is not shown. A share sale is then
                  taxed under 申告分離課税 (措法37条の11): the same 15.315% and 5% through the
                  return, after any deductions the other income could not use, with a loss set
                  against the year's other reported gains and then, where the sale qualifies,
                  against reported dividends (損益通算). Carrying a loss forward (繰越控除) is not
                  modelled.
                </Typography>
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Reported dividends</strong> are taxed under one election for all of them,
                  made in the Investment Income list: 申告分離課税, the same 15.315% and 5% apart
                  from the brackets, or 総合課税, in the progressive brackets and at the 10%
                  residence rate with the other income. 措法8条の4② allows no mix of the two on one
                  return. The 配当控除 (所法92条) that offsets part of the 総合課税 tax for a
                  dividend from a domestic company is not modelled yet, and only 配当等 proper —
                  剰余金の配当 and 公募株式投資信託の分配金 — can be taxed that way;
                  特定公社債の利子 cannot.
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  Since 令和6年度 the residence tax follows the election made for income tax
                  (地方税法32条⑬, 313条⑬).
                </Typography>
              </DetailedTooltip>
            </FormLabel>
            <ToggleButtonGroup
              value={isReported ? 'reported' : 'withheldOnly'}
              exclusive
              onChange={(_, newValue: 'withheldOnly' | 'reported' | null) => {
                if (newValue) {
                  setIsReported(newValue === 'reported');
                }
              }}
              aria-labelledby="reporting-label"
              aria-label="reporting"
              size="small"
              sx={variantToggleGroupSx}
            >
              <ToggleButton value="withheldOnly" disabled={paymentChannel === 'abroad'}>
                Withheld only
              </ToggleButton>
              <ToggleButton value="reported">Reported</ToggleButton>
            </ToggleButtonGroup>
            {isReported && (
              <FormHelperText>
                {reportedDividendsTaxation === 'separate'
                  ? 'Taxed as separate (申告分離課税), the election set for all reported dividends in the income list.'
                  : 'Taxed as aggregate (総合課税), the election set for all reported dividends in the income list; the 配当控除 is not modelled yet.'}
              </FormHelperText>
            )}
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

          {type !== 'withholdingAccount' && (
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
          )}

          {type === 'withholdingAccount' && (
            <Stack spacing={2}>
              <SpinnerNumberField
                inputProps={{ autoFocus: true }}
                label={info.amountLabel}
                value={accountCapitalGains}
                onChange={val => setAccountCapitalGains(val)}
                sx={{ width: '100%' }}
                helperText={info.amountHelperText}
                {...(info.min !== undefined && { min: info.min })}
              />
              <SpinnerNumberField
                label="Dividends Received into the Account (配当等)"
                value={accountDividends}
                onChange={val => setAccountDividends(val)}
                sx={{ width: '100%' }}
                helperText="Before withholding, from the same report. Dividends taken by bank transfer or dividend receipt (配当金領収証) go in a Dividends entry."
              />
              <FormControl fullWidth>
                <FormLabel sx={variantLabelSx}>
                  <span id="account-sales-reporting-label">Sales</span>
                  <DetailedTooltip
                    title="Reporting"
                    icon={SIMPLE_TOOLTIP_ICON}
                    iconAriaLabel="reporting info"
                  >
                    <Typography sx={{ display: 'block', mb: 1 }}>
                      Whether this account's sales and dividends go on the return is chosen per
                      account (措法37条の11の5①, 37条の11の6⑨), separate from every other account.
                    </Typography>
                    <Typography sx={{ display: 'block', mb: 1 }}>
                      Whatever is left to withholding is netted within the account first — a loss
                      offsets the dividends before the tax is calculated, the way the broker does at
                      year end (措法37条の11の6⑥⑦).
                    </Typography>
                    <Typography sx={{ display: 'block', mb: 1 }}>
                      Reporting puts the amount on the return, where it enters total income
                      (合計所得金額) — and so every figure keyed to it. Reported dividends are taxed
                      under the one election made for all reported dividends in the income list.
                    </Typography>
                    <Typography sx={{ display: 'block' }}>
                      Tax withheld on a reported amount is credited at filing, so it is not shown
                      separately.
                    </Typography>
                  </DetailedTooltip>
                </FormLabel>
                <ToggleButtonGroup
                  value={reportsCapitalGains ? 'reported' : 'withheldOnly'}
                  exclusive
                  onChange={(_, newValue: 'withheldOnly' | 'reported' | null) => {
                    if (newValue) {
                      setReportsCapitalGains(newValue === 'reported');
                    }
                  }}
                  aria-labelledby="account-sales-reporting-label"
                  size="small"
                  sx={variantToggleGroupSx}
                >
                  <ToggleButton value="withheldOnly">Withheld only</ToggleButton>
                  <ToggleButton value="reported">Reported</ToggleButton>
                </ToggleButtonGroup>
              </FormControl>
              <FormControl fullWidth>
                <FormLabel id="account-dividends-reporting-label" sx={variantLabelSx}>
                  Dividends
                </FormLabel>
                <ToggleButtonGroup
                  value={dividendsForced || reportsDividends ? 'reported' : 'withheldOnly'}
                  exclusive
                  onChange={(_, newValue: 'withheldOnly' | 'reported' | null) => {
                    if (newValue) {
                      setReportsDividends(newValue === 'reported');
                    }
                  }}
                  aria-labelledby="account-dividends-reporting-label"
                  size="small"
                  sx={variantToggleGroupSx}
                >
                  <ToggleButton value="withheldOnly" disabled={dividendsForced}>
                    Withheld only
                  </ToggleButton>
                  <ToggleButton value="reported">Reported</ToggleButton>
                </ToggleButtonGroup>
                {dividendsForced && (
                  <FormHelperText>
                    Reporting this account's loss puts its dividends on the return as well
                    (措法37条の11の6⑩).
                  </FormHelperText>
                )}
              </FormControl>
            </Stack>
          )}

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

          {(type === 'withholdingAccount' || type === 'capitalGains' || type === 'dividends') && (
            <Box sx={guidanceBoxSx}>
              {type === 'withholdingAccount' && (
                <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
                  Copy the two figures from the account's annual transaction report
                  (特定口座年間取引報告書).
                </Typography>
              )}
              <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
                {type === 'withholdingAccount' &&
                  'In a withholding designated account the broker withholds 20.315% — 15.315% income tax including the reconstruction surtax, and 5% residence tax — and nets a capital loss for the year against the dividends paid into the account before withholding, as it does at year end. A reported amount is taxed at the same rates through the return instead, alongside the other income.'}
                {type === 'capitalGains' &&
                  'No tax is withheld on a sale outside a withholding designated account, so it is reported and taxed through the return at 15.315% income tax including the reconstruction surtax, and 5% residence tax, alongside the other income.'}
                {type === 'dividends' &&
                  'A dividend paid in Japan has 20.315% withheld — 15.315% income tax including the reconstruction surtax, and 5% residence tax — which settles the tax unless the dividend is reported. A reported dividend is taxed through the return instead, alongside the other income.'}
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
                    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1474.htm',
                    label: '上場株式等に係る譲渡損失の損益通算及び繰越控除 - NTA',
                  },
                  {
                    href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1476.htm',
                    label: '特定口座制度 - NTA',
                  },
                  ...(type === 'dividends'
                    ? [
                        {
                          href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1250.htm',
                          label: '配当所得があるとき(配当控除) - NTA',
                        },
                      ]
                    : []),
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
