// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type { CapitalGainsIncomeStream, InterestIncomeStream } from '../../../../types/tax';
import { foreignTaxEntryError, validateIncomeStream } from '../../../../utils/incomeStreams';
import { SIMPLE_TOOLTIP_ICON } from '../../../ui/constants';
import SourceLinks from '../../../ui/SourceLinks';
import { SpinnerNumberField } from '../../../ui/SpinnerNumberField';
import { DetailedTooltip } from '../../../ui/Tooltips';
import { INCOME_STREAM_CATALOG } from '../incomeStreamCatalog';
import { variantLabelSx, variantToggleGroupSx } from '../variantControlStyles';
import { ListedShareGuidanceBox, ListedShareTypeControl } from './investmentStreamFormShared';
import {
  createStreamId,
  guidanceBoxSx,
  IncomeStreamFormShell,
  NTA_TAX_ANSWERS,
  StreamAmountField,
  type StreamTypeFormProps,
} from './streamFormShared';

export const CapitalGainsStreamForm: React.FC<StreamTypeFormProps<'capitalGains'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [shareType, setShareType] = useState<'listed' | 'other'>(
    initialData?.shareType ?? 'listed',
  );
  const [account, setAccount] = useState<CapitalGainsIncomeStream['account']>(
    initialData?.account ?? 'domesticNoWithholding',
  );

  const handleSave = () => {
    const stream: CapitalGainsIncomeStream = {
      id: createStreamId(initialData),
      type: 'capitalGains',
      amount,
      shareType,
      account,
    };
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="capitalGains"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <ListedShareTypeControl value={shareType} onChange={setShareType} />

      <FormControl fullWidth>
        <InputLabel id="share-account-label">Account</InputLabel>
        <Select
          labelId="share-account-label"
          value={account}
          label="Account"
          onChange={e => setAccount(e.target.value as CapitalGainsIncomeStream['account'])}
        >
          <MenuItem value="domesticNoWithholding">
            Domestic account no withholding (特定口座（源泉徴収なし）・一般口座)
          </MenuItem>
          <MenuItem value="foreign">Foreign account</MenuItem>
        </Select>
        <FormHelperText component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <span>A sale outside a withholding designated account is always reported.</span>
          <DetailedTooltip title="Account" icon={SIMPLE_TOOLTIP_ICON} iconAriaLabel="account info">
            {/* 措法37条の12の2② requires sales to be through a licensed broker in Japan to offset dividends or carry forward */}
            <Typography sx={{ display: 'block' }}>
              A designated account without withholding (特定口座（源泉徴収なし）) and a general
              account (一般口座) are one option here because they have the same tax treatment. A
              foreign account is its own option because a sale there is not made through a broker
              licensed in Japan (金融商品取引業者), which the law requires of a loss for it to
              offset dividends or be carried forward. A loss in a foreign account only offsets the
              year&apos;s other reported gains.
            </Typography>
          </DetailedTooltip>
        </FormHelperText>
      </FormControl>

      <Box>
        <StreamAmountField type="capitalGains" value={amount} onChange={setAmount} />
        <ListedShareGuidanceBox type="capitalGains" />
      </Box>
    </IncomeStreamFormShell>
  );
};

export const InterestStreamForm: React.FC<StreamTypeFormProps<'interest'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const info = INCOME_STREAM_CATALOG.interest;
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [payerDomicile, setPayerDomicile] = useState<'domestic' | 'foreign'>(
    initialData?.payerDomicile ?? 'domestic',
  );
  const [foreignTax, setForeignTax] = useState<number>(initialData?.foreignTax ?? 0);
  const [foreignTaxError, setForeignTaxError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The catalog's helper text covers interest paid in Japan; interest paid outside Japan has no
  // Japanese withholding to be "before", and the taxpayer converts the receipt themselves.
  const amountHelperText =
    payerDomicile === 'foreign'
      ? 'Enter the amount in yen, before any foreign tax withheld.'
      : info.amountHelperText;

  const handleSave = () => {
    const stream: InterestIncomeStream = {
      id: createStreamId(initialData),
      type: 'interest',
      amount,
      payerDomicile,
      foreignTax: payerDomicile === 'foreign' ? foreignTax : 0,
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
      type="interest"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <FormControl fullWidth>
        <FormLabel id="interest-payer-label" sx={variantLabelSx}>
          <span>Paid</span>
          <DetailedTooltip
            title="Where the Interest Is Paid"
            icon={SIMPLE_TOOLTIP_ICON}
            iconAriaLabel="interest payer info"
          >
            <Typography sx={{ display: 'block', mb: 1 }}>
              <strong>In Japan</strong> means interest received in a Japanese account, such as on a
              deposit held at a bank in Japan. The tax is settled by withholding at source, with no
              election and nothing to report.
            </Typography>
            <Typography sx={{ display: 'block' }}>
              <strong>Outside Japan</strong> means received with no Japanese intermediary, interest
              on a deposit at a foreign bank for example. No Japanese tax is withheld, so the
              interest is reported and taxed with the other income under aggregate taxation
              (総合課税).
            </Typography>
          </DetailedTooltip>
        </FormLabel>
        <ToggleButtonGroup
          value={payerDomicile}
          exclusive
          onChange={(_, newValue: 'domestic' | 'foreign' | null) => {
            if (newValue) {
              setPayerDomicile(newValue);
              if (newValue === 'domestic') {
                setForeignTax(0);
                setForeignTaxError(null);
              }
            }
          }}
          aria-labelledby="interest-payer-label"
          aria-label="where the interest is paid"
          size="small"
          sx={variantToggleGroupSx}
        >
          <ToggleButton value="domestic">In Japan</ToggleButton>
          <ToggleButton value="foreign">Outside Japan</ToggleButton>
        </ToggleButtonGroup>
      </FormControl>

      <Box>
        <StreamAmountField
          type="interest"
          value={amount}
          onChange={val => {
            setAmount(val);
            setError(null);
          }}
          helperText={amountHelperText}
          error={error}
        />

        {payerDomicile === 'foreign' && (
          <SpinnerNumberField
            label="Foreign Tax Withheld (外国所得税)"
            value={foreignTax}
            onChange={val => {
              setForeignTax(val);
              setForeignTaxError(null);
            }}
            sx={{ width: '100%', mt: 2 }}
            helperText={foreignTaxError ?? 'In yen. The gross amount above includes it.'}
            error={!!foreignTaxError}
          />
        )}

        <Box sx={guidanceBoxSx}>
          <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
            This covers Interest Income (利子所得) as the law defines it: interest on bonds (公社債)
            and deposits (預貯金), and distributions from jointly operated money trusts
            (合同運用信託), bond investment trusts (公社債投資信託) and publicly offered bond
            investment trusts (公募公社債等運用投資信託). Interest on money lent privately should be
            reported as Miscellaneous Income (雑所得) rather than Interest Income.
          </Typography>
          {payerDomicile === 'foreign' && (
            <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
              Tax withheld abroad is credited against Japanese tax, up to the limit on the Foreign
              Tax Credit.
            </Typography>
          )}
          <SourceLinks
            sources={[
              {
                href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1310.htm',
                label: 'Interest income (利子所得) - NTA',
              },
              ...(payerDomicile === 'foreign' ? [NTA_TAX_ANSWERS.foreignTaxCredit] : []),
            ]}
          />
        </Box>
      </Box>
    </IncomeStreamFormShell>
  );
};
