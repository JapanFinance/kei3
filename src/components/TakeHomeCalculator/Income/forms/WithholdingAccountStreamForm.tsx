// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useMemo, useState } from 'react';

import type { WithholdingAccountIncomeStream } from '../../../../types/tax';
import { validateIncomeStream } from '../../../../utils/incomeStreams';
import { withholdingAccountDividendsMustBeReported } from '../../../../utils/investmentReporting';
import { SpinnerNumberField } from '../../../ui/SpinnerNumberField';
import { INCOME_STREAM_CATALOG } from '../incomeStreamCatalog';
import { variantLabelSx, variantToggleGroupSx } from '../variantControlStyles';
import {
  ListedShareGuidanceBox,
  WITHHOLDING_ACCOUNT_REPORTING_TOOLTIP,
} from './investmentStreamFormShared';
import {
  createStreamId,
  figureGridSx,
  IncomeStreamFormShell,
  MINIMUM_TAX_REPORTING_NOTE,
  minimumTaxWarningSx,
  type StreamTypeFormProps,
} from './streamFormShared';

export const WithholdingAccountStreamForm: React.FC<StreamTypeFormProps<'withholdingAccount'>> = ({
  initialData,
  onSave,
  onCancel,
  isMinimumTaxTriggered,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const info = INCOME_STREAM_CATALOG.withholdingAccount;

  const [accountCapitalGains, setAccountCapitalGains] = useState<number>(
    initialData?.capitalGains ?? 0,
  );
  const [accountDividends, setAccountDividends] = useState<number>(initialData?.dividends ?? 0);
  const [accountForeignDividends, setAccountForeignDividends] = useState<number>(
    initialData?.foreignDividends ?? 0,
  );
  const [foreignTax, setForeignTax] = useState<number>(initialData?.foreignTax ?? 0);
  const [reportsCapitalGains, setReportsCapitalGains] = useState<boolean>(
    initialData?.reportsCapitalGains ?? false,
  );
  const [reportsDividends, setReportsDividends] = useState<boolean>(
    initialData?.reportsDividends ?? false,
  );
  const [foreignTaxError, setForeignTaxError] = useState<string | null>(null);

  // 措法37条の11の6⑩: a reported loss that reduced the account's dividend withholding drags the
  // dividends onto the return regardless of the toggle below.
  const dividendsForced = withholdingAccountDividendsMustBeReported({
    capitalGains: accountCapitalGains,
    dividends: accountDividends,
    reportsCapitalGains,
  });

  const minimumTaxApplies = useMemo(() => {
    if (!isMinimumTaxTriggered) return false;
    const draft: WithholdingAccountIncomeStream = {
      id: initialData?.id ?? 'draft',
      type: 'withholdingAccount',
      capitalGains: accountCapitalGains,
      dividends: accountDividends,
      foreignDividends: accountForeignDividends,
      foreignTax,
      reportsCapitalGains: true,
      reportsDividends: true,
    };
    if (validateIncomeStream(draft)) return false;
    return isMinimumTaxTriggered(draft);
  }, [
    isMinimumTaxTriggered,
    initialData?.id,
    accountCapitalGains,
    accountDividends,
    accountForeignDividends,
    foreignTax,
  ]);

  const handleSave = () => {
    const stream: WithholdingAccountIncomeStream = {
      id: createStreamId(initialData),
      type: 'withholdingAccount',
      capitalGains: accountCapitalGains,
      dividends: accountDividends,
      foreignDividends: accountForeignDividends,
      foreignTax,
      reportsCapitalGains: minimumTaxApplies || reportsCapitalGains,
      reportsDividends: minimumTaxApplies || dividendsForced || reportsDividends,
    };
    const message = validateIncomeStream(stream);
    if (message) {
      setForeignTaxError(message);
      return;
    }
    setForeignTaxError(null);
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="withholdingAccount"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <Stack spacing={2}>
        <Typography variant="body2">
          Enter one account per annual transaction report (特定口座年間取引報告書), and choose
          whether to report its sales and/or dividends on a tax return.
        </Typography>

        <FormControl fullWidth role="group" aria-labelledby="account-sales-label">
          <Box sx={figureGridSx}>
            <Box>
              <Box sx={variantLabelSx}>
                <FormLabel
                  id="account-sales-label"
                  sx={{ color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit' }}
                >
                  Sales
                </FormLabel>
                {isMobile && WITHHOLDING_ACCOUNT_REPORTING_TOOLTIP}
              </Box>
              <SpinnerNumberField
                inputProps={{ autoFocus: true, 'aria-describedby': 'account-sales-help' }}
                label={info.amountLabel}
                value={accountCapitalGains}
                onChange={val => setAccountCapitalGains(val)}
                sx={{ width: '100%' }}
                {...(info.min !== undefined && { min: info.min })}
              />
            </Box>
            <Box>
              {!isMobile && (
                <FormLabel id="account-sales-reporting-label" sx={variantLabelSx}>
                  <span>Reporting</span>
                  {WITHHOLDING_ACCOUNT_REPORTING_TOOLTIP}
                </FormLabel>
              )}
              <ToggleButtonGroup
                value={minimumTaxApplies || reportsCapitalGains ? 'reported' : 'withheldOnly'}
                exclusive
                onChange={(_, newValue: 'withheldOnly' | 'reported' | null) => {
                  if (newValue) {
                    setReportsCapitalGains(newValue === 'reported');
                  }
                }}
                aria-labelledby={!isMobile ? 'account-sales-reporting-label' : undefined}
                aria-label="sales reporting"
                size="small"
                sx={variantToggleGroupSx}
              >
                <ToggleButton value="withheldOnly" disabled={minimumTaxApplies}>
                  Withheld only
                </ToggleButton>
                <ToggleButton value="reported">Reported</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
          <FormHelperText id="account-sales-help">{info.amountHelperText}</FormHelperText>
          {minimumTaxApplies && (
            <FormHelperText sx={minimumTaxWarningSx}>{MINIMUM_TAX_REPORTING_NOTE}</FormHelperText>
          )}
        </FormControl>

        <FormControl fullWidth role="group" aria-labelledby="account-dividends-label">
          <Box sx={figureGridSx}>
            <Box>
              <Box sx={variantLabelSx}>
                <FormLabel
                  id="account-dividends-label"
                  sx={{ color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit' }}
                >
                  Dividends
                </FormLabel>
                {isMobile && WITHHOLDING_ACCOUNT_REPORTING_TOOLTIP}
              </Box>
              <SpinnerNumberField
                inputProps={{ 'aria-describedby': 'account-dividends-help' }}
                label="Dividends Received into the Account (配当等)"
                value={accountDividends}
                onChange={val => setAccountDividends(val)}
                sx={{ width: '100%' }}
              />
            </Box>
            <Box>
              {!isMobile && (
                <FormLabel id="account-dividends-reporting-label" sx={variantLabelSx}>
                  <span>Reporting</span>
                  {WITHHOLDING_ACCOUNT_REPORTING_TOOLTIP}
                </FormLabel>
              )}
              <ToggleButtonGroup
                value={
                  minimumTaxApplies || dividendsForced || reportsDividends
                    ? 'reported'
                    : 'withheldOnly'
                }
                exclusive
                onChange={(_, newValue: 'withheldOnly' | 'reported' | null) => {
                  if (newValue) {
                    setReportsDividends(newValue === 'reported');
                  }
                }}
                aria-labelledby={!isMobile ? 'account-dividends-reporting-label' : undefined}
                aria-label="dividends reporting"
                size="small"
                sx={variantToggleGroupSx}
              >
                <ToggleButton value="withheldOnly" disabled={minimumTaxApplies || dividendsForced}>
                  Withheld only
                </ToggleButton>
                <ToggleButton value="reported">Reported</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
          <FormHelperText id="account-dividends-help">
            Enter the total amount before withholding.
          </FormHelperText>
          {minimumTaxApplies ? (
            <FormHelperText sx={minimumTaxWarningSx}>{MINIMUM_TAX_REPORTING_NOTE}</FormHelperText>
          ) : dividendsForced ? (
            <FormHelperText>
              Reporting this account&apos;s loss requires reporting its dividends as well.
            </FormHelperText>
          ) : null}
        </FormControl>

        <FormControl fullWidth>
          <FormLabel id="account-foreign-label" sx={variantLabelSx}>
            Foreign shares and funds (国外株式又は国外投資信託等)
          </FormLabel>
          <Box role="group" aria-labelledby="account-foreign-label" sx={figureGridSx}>
            <SpinnerNumberField
              inputProps={{ 'aria-describedby': 'account-foreign-help' }}
              label="Foreign Dividends"
              value={accountForeignDividends}
              onChange={val => {
                setAccountForeignDividends(val);
                setForeignTaxError(null);
              }}
              sx={{ width: '100%' }}
            />
            <SpinnerNumberField
              inputProps={{ 'aria-describedby': 'account-foreign-help' }}
              label="Foreign Tax (外国所得税の額)"
              value={foreignTax}
              onChange={val => {
                setForeignTax(val);
                setForeignTaxError(null);
              }}
              sx={{ width: '100%' }}
            />
          </Box>
          <FormHelperText id="account-foreign-help">
            The part of the dividends above from foreign companies and funds, foreign tax included,
            and the foreign tax withheld on it.
          </FormHelperText>
          {foreignTaxError && <FormHelperText error>{foreignTaxError}</FormHelperText>}
        </FormControl>

        <ListedShareGuidanceBox type="withholdingAccount" />
      </Stack>
    </IncomeStreamFormShell>
  );
};
