// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import { useTheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useMemo, useState } from 'react';

import type { DividendsIncomeStream } from '../../../../types/tax';
import { foreignTaxEntryError, validateIncomeStream } from '../../../../utils/incomeStreams';
import { SIMPLE_TOOLTIP_ICON } from '../../../ui/constants';
import SourceLinks from '../../../ui/SourceLinks';
import { SpinnerNumberField } from '../../../ui/SpinnerNumberField';
import { DetailedTooltip } from '../../../ui/Tooltips';
import { INCOME_STREAM_CATALOG } from '../incomeStreamCatalog';
import { variantLabelSx, variantToggleGroupSx } from '../variantControlStyles';
import {
  FOREIGN_DIVIDEND_TAX_NOTE,
  ListedShareGuidanceBox,
  ListedShareTypeControl,
} from './investmentStreamFormShared';
import {
  createStreamId,
  figureGridSx,
  IncomeStreamFormShell,
  MINIMUM_TAX_REPORTING_NOTE,
  minimumTaxWarningSx,
  NTA_TAX_ANSWERS,
  type StreamTypeFormProps,
} from './streamFormShared';

export const DividendsStreamForm: React.FC<StreamTypeFormProps<'dividends'>> = ({
  initialData,
  onSave,
  onCancel,
  isMinimumTaxTriggered,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const info = INCOME_STREAM_CATALOG.dividends;

  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [shareType, setShareType] = useState<'listed' | 'other'>(
    initialData?.shareType ?? 'listed',
  );
  const [paymentChannel, setPaymentChannel] = useState<'domestic' | 'abroad'>(
    initialData?.paymentChannel ?? 'domestic',
  );
  const [isReported, setIsReported] = useState<boolean>(initialData?.isReported ?? false);
  const [issuerDomicile, setIssuerDomicile] = useState<'foreign' | 'domestic'>(
    initialData?.issuerDomicile ?? 'domestic',
  );
  const [foreignTax, setForeignTax] = useState<number>(initialData?.foreignTax ?? 0);
  const [foreignTaxError, setForeignTaxError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minimumTaxApplies = useMemo(() => {
    if (!isMinimumTaxTriggered) return false;
    const draft: DividendsIncomeStream = {
      id: initialData?.id ?? 'draft',
      type: 'dividends',
      amount,
      shareType,
      paymentChannel,
      isReported: true,
      issuerDomicile,
      foreignTax: issuerDomicile === 'foreign' ? foreignTax : 0,
    };
    if (validateIncomeStream(draft)) return false;
    return isMinimumTaxTriggered(draft);
  }, [
    isMinimumTaxTriggered,
    initialData?.id,
    amount,
    shareType,
    paymentChannel,
    issuerDomicile,
    foreignTax,
  ]);

  const handlePaymentChannelChange = (newPaymentChannel: 'domestic' | 'abroad') => {
    setPaymentChannel(newPaymentChannel);
    // 措令4条の3②五・六 excludes a dividend paid abroad from 申告不要.
    if (newPaymentChannel === 'abroad') {
      setIsReported(true);
    }
  };

  const handleSave = () => {
    const stream: DividendsIncomeStream = {
      id: createStreamId(initialData),
      type: 'dividends',
      amount,
      shareType,
      paymentChannel,
      isReported: minimumTaxApplies || paymentChannel === 'abroad' || isReported,
      issuerDomicile,
      foreignTax: issuerDomicile === 'foreign' ? foreignTax : 0,
    };
    const message = validateIncomeStream(stream);
    if (message) {
      if (foreignTaxEntryError(stream)) {
        setForeignTaxError(message);
      } else {
        setError(message);
      }
      return;
    }
    setForeignTaxError(null);
    setError(null);
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="dividends"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <Box sx={figureGridSx}>
        {/* Row 1, Column 1: Share Type */}
        <ListedShareTypeControl value={shareType} onChange={setShareType} />

        {/* Row 1, Column 2: Received */}
        <FormControl fullWidth>
          <FormLabel id="dividend-payment-channel-label" sx={variantLabelSx}>
            <span>Received</span>
            <DetailedTooltip
              title="Where the Dividend Is Received"
              icon={SIMPLE_TOOLTIP_ICON}
              iconAriaLabel="dividend payment channel info"
            >
              <Typography sx={{ display: 'block', mb: 1 }}>
                <strong>In Japan</strong> means received in Japan, or received through a Japanese
                broker that handles the payment. Japanese tax was withheld, so the decision about
                whether to report the dividend on a tax return can be made per payment.
              </Typography>
              <Typography sx={{ display: 'block' }}>
                <strong>Outside Japan</strong> means received with no Japanese intermediary, such as
                in a foreign brokerage account. With no Japanese tax withheld, such a dividend must
                be reported.
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
            aria-label="where the dividend is received"
            size="small"
            sx={variantToggleGroupSx}
          >
            <ToggleButton value="domestic">In Japan</ToggleButton>
            <ToggleButton value="abroad">Outside Japan</ToggleButton>
          </ToggleButtonGroup>
        </FormControl>

        {/* Row 2, Column 1: Gross Dividends */}
        <FormControl fullWidth>
          <Box sx={variantLabelSx}>
            <FormLabel
              id="dividend-amount-label"
              htmlFor="dividend-amount-input"
              sx={{ color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit' }}
            >
              Gross Dividends
            </FormLabel>
            {isMobile && (
              <DetailedTooltip
                title="Reporting"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="reporting info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Withheld only (申告不要)</strong> means the Japanese tax the payer
                  withheld settles the tax. The dividend stays off the return and out of total net
                  income.
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  <strong>Reported</strong> puts the dividend on the tax return, where it counts
                  toward total net income. The tax withheld is credited at filing. Reported
                  dividends are taxed under the election made in the income list, separate or
                  aggregate taxation. Reporting can be beneficial when the other income cannot use
                  all the deductions, or, under separate taxation, when a reported loss can offset
                  the dividend.
                </Typography>
                {issuerDomicile === 'foreign' && (
                  <>
                    <Typography sx={{ display: 'block', mt: 1 }}>
                      {FOREIGN_DIVIDEND_TAX_NOTE}
                    </Typography>
                    <SourceLinks sources={[NTA_TAX_ANSWERS.foreignTaxCredit]} />
                  </>
                )}
              </DetailedTooltip>
            )}
          </Box>
          <SpinnerNumberField
            id="dividend-amount-input"
            inputProps={{ autoFocus: true, 'aria-describedby': 'dividend-amount-help' }}
            value={amount}
            onChange={val => {
              setAmount(val);
              setError(null);
            }}
            sx={{ width: '100%' }}
            error={!!error}
            {...(info.min !== undefined && { min: info.min })}
          />
          <FormHelperText id="dividend-amount-help">
            {error || info.amountHelperText}
          </FormHelperText>
        </FormControl>

        {/* Row 2, Column 2: Reporting */}
        <FormControl fullWidth>
          {!isMobile && (
            <FormLabel id="reporting-label" sx={variantLabelSx}>
              <span>Reporting</span>
              <DetailedTooltip
                title="Reporting"
                icon={SIMPLE_TOOLTIP_ICON}
                iconAriaLabel="reporting info"
              >
                <Typography sx={{ display: 'block', mb: 1 }}>
                  <strong>Withheld only (申告不要)</strong> means the Japanese tax the payer
                  withheld settles the tax. The dividend stays off the return and out of total net
                  income.
                </Typography>
                <Typography sx={{ display: 'block' }}>
                  <strong>Reported</strong> puts the dividend on the tax return, where it counts
                  toward total net income. The tax withheld is credited at filing. Reported
                  dividends are taxed under the election made in the income list, separate or
                  aggregate taxation. Reporting can be beneficial when the other income cannot use
                  all the deductions, or, under separate taxation, when a reported loss can offset
                  the dividend.
                </Typography>
                {issuerDomicile === 'foreign' && (
                  <>
                    <Typography sx={{ display: 'block', mt: 1 }}>
                      {FOREIGN_DIVIDEND_TAX_NOTE}
                    </Typography>
                    <SourceLinks sources={[NTA_TAX_ANSWERS.foreignTaxCredit]} />
                  </>
                )}
              </DetailedTooltip>
            </FormLabel>
          )}
          <ToggleButtonGroup
            value={
              minimumTaxApplies || paymentChannel === 'abroad' || isReported
                ? 'reported'
                : 'withheldOnly'
            }
            exclusive
            onChange={(_, newValue: 'withheldOnly' | 'reported' | null) => {
              if (newValue) {
                setIsReported(newValue === 'reported');
              }
            }}
            aria-labelledby={!isMobile ? 'reporting-label' : undefined}
            aria-label="reporting"
            size="small"
            sx={variantToggleGroupSx}
          >
            <ToggleButton
              value="withheldOnly"
              disabled={minimumTaxApplies || paymentChannel === 'abroad'}
            >
              Withheld only
            </ToggleButton>
            <ToggleButton value="reported">Reported</ToggleButton>
          </ToggleButtonGroup>
          {minimumTaxApplies ? (
            <FormHelperText sx={minimumTaxWarningSx}>{MINIMUM_TAX_REPORTING_NOTE}</FormHelperText>
          ) : paymentChannel === 'abroad' ? (
            <FormHelperText>A dividend received outside Japan must be reported.</FormHelperText>
          ) : null}
        </FormControl>

        {/* Row 3, Column 1: Company or fund */}
        <FormControl fullWidth>
          <FormLabel id="dividend-issuer-label" sx={variantLabelSx}>
            <span>Company or fund</span>
            <DetailedTooltip
              title="Company or Fund"
              icon={SIMPLE_TOOLTIP_ICON}
              iconAriaLabel="company or fund info"
            >
              <Typography sx={{ display: 'block', mb: 1 }}>
                <strong>Foreign</strong> is a company or fund domiciled outside Japan: a US stock, a
                US-listed ETF, or a foreign ETF listed on a Japanese exchange. Its dividends are
                foreign-source income, and the foreign tax withheld on them can be entered.
              </Typography>
              <Typography sx={{ display: 'block' }}>
                <strong>Japanese</strong> includes Japan-domiciled funds that invest abroad. A
                different credit (分配時調整外国税相当額控除) reduces the Japanese tax on its
                distributions by the foreign tax its holdings paid; that credit is not supported
                yet.
              </Typography>
            </DetailedTooltip>
          </FormLabel>
          <ToggleButtonGroup
            value={issuerDomicile}
            exclusive
            onChange={(_, newValue: 'domestic' | 'foreign' | null) => {
              if (newValue) {
                setIssuerDomicile(newValue);
                if (newValue === 'domestic') {
                  setForeignTax(0);
                  setForeignTaxError(null);
                }
              }
            }}
            aria-labelledby="dividend-issuer-label"
            aria-label="company or fund"
            size="small"
            sx={variantToggleGroupSx}
          >
            <ToggleButton value="domestic">Japanese</ToggleButton>
            <ToggleButton value="foreign">Foreign</ToggleButton>
          </ToggleButtonGroup>
        </FormControl>

        {/* Row 3, Column 2: Foreign Tax Withheld (if Foreign company/fund) */}
        {issuerDomicile === 'foreign' && (
          <FormControl fullWidth>
            <FormLabel
              id="dividend-foreign-tax-label"
              htmlFor="dividend-foreign-tax-input"
              sx={variantLabelSx}
            >
              Foreign Tax Withheld (外国所得税)
            </FormLabel>
            <SpinnerNumberField
              id="dividend-foreign-tax-input"
              value={foreignTax}
              onChange={val => {
                setForeignTax(val);
                setForeignTaxError(null);
              }}
              sx={{ width: '100%' }}
              helperText={foreignTaxError ?? 'In yen. The gross dividends include it.'}
              error={!!foreignTaxError}
            />
          </FormControl>
        )}
      </Box>

      <ListedShareGuidanceBox
        type="dividends"
        showForeignDividendTaxNote={issuerDomicile === 'foreign'}
      />
    </IncomeStreamFormShell>
  );
};
