// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  DividendsIncomeStream,
  IncomeStream,
  WithholdingAccountIncomeStream,
} from '../types/tax';

/** 措法37条の11の6⑩: a reported loss that reduced the account's dividend withholding drags the dividends onto the return. */
export const withholdingAccountDividendsMustBeReported = (
  account: Pick<
    WithholdingAccountIncomeStream,
    'capitalGains' | 'dividends' | 'reportsCapitalGains'
  >,
): boolean => account.reportsCapitalGains && account.capitalGains < 0 && account.dividends > 0;

/** 措令4条の3②五・六: a dividend paid abroad is outside 申告不要. */
export const dividendMustBeReported = (
  dividend: Pick<DividendsIncomeStream, 'paymentChannel'>,
): boolean => dividend.paymentChannel === 'abroad';

/** `stream` with the reporting flags the two rules above force; other streams are returned as they are. */
export const withRequiredReporting = (stream: IncomeStream): IncomeStream => {
  switch (stream.type) {
    case 'withholdingAccount':
      return withholdingAccountDividendsMustBeReported(stream)
        ? { ...stream, reportsDividends: true }
        : stream;
    case 'dividends':
      return dividendMustBeReported(stream) ? { ...stream, isReported: true } : stream;
    default:
      return stream;
  }
};

/**
 * Forces all investment streams to be reported on the tax return.
 * Under Special Tax Measures Act Art. 41-19, when the minimum tax on high income applies,
 * 確定申告不要制度 is disallowed, requiring all investment income to be reported.
 */
export const withAllInvestmentReported = (stream: IncomeStream): IncomeStream => {
  switch (stream.type) {
    case 'withholdingAccount':
      return { ...stream, reportsCapitalGains: true, reportsDividends: true };
    case 'dividends':
      return { ...stream, isReported: true };
    default:
      return stream;
  }
};
