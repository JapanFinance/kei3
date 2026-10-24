// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP } from '../constants/taxThresholds';
import type {
  BonusIncomeStream,
  BusinessIncomeStream,
  CommutingAllowanceIncomeStream,
  DividendsIncomeStream,
  IncomeStream,
  IncomeStreamType,
  InterestIncomeStream,
  MiscellaneousIncomeStream,
  PublicPensionIncomeStream,
  RealEstateIncomeStream,
  SalaryIncomeStream,
  StockCompensationIncomeStream,
  WithholdingAccountIncomeStream,
} from '../types/tax';
import { formatJPY } from './formatters';
import {
  dividendMustBeReported,
  withholdingAccountDividendsMustBeReported,
} from './investmentReporting';

/** The member of the {@link IncomeStream} union discriminated by `T`, by discriminant. */
type IncomeStreamOfType = { [T in IncomeStreamType]: Extract<IncomeStream, { type: T }> };

/** The income-stream types {@link isEarnedIncomeStream} treats as earned income. */
export type EarnedIncomeStream =
  | SalaryIncomeStream
  | BonusIncomeStream
  | BusinessIncomeStream
  | RealEstateIncomeStream
  | MiscellaneousIncomeStream
  | PublicPensionIncomeStream
  | StockCompensationIncomeStream;

/**
 * Why an entry's foreign-tax figures cannot be used, or undefined when they can. Shared by the
 * calculation, which throws the message, and the entry form, which shows it.
 */
export const foreignTaxEntryError = (
  stream:
    | DividendsIncomeStream
    | InterestIncomeStream
    | PublicPensionIncomeStream
    | RealEstateIncomeStream
    | WithholdingAccountIncomeStream,
): string | undefined => {
  if (stream.foreignTax < 0) return 'Foreign tax cannot be negative.';
  switch (stream.type) {
    case 'realEstate':
      if (stream.foreignTax > 0 && stream.location === 'domestic') {
        return 'Foreign tax can be entered only for foreign real estate.';
      }
      if (stream.foreignTax > 0 && stream.amount > 0 && stream.foreignTax > stream.amount) {
        return 'Foreign tax cannot be more than the net income.';
      }
      return undefined;
    case 'dividends':
      if (stream.foreignTax > 0 && stream.issuerDomicile === 'domestic') {
        return 'Only a dividend from a foreign company or fund has foreign tax withheld.';
      }
      if (stream.foreignTax > 0 && stream.foreignTax > stream.amount) {
        return 'Foreign tax cannot be more than the gross dividend.';
      }
      return undefined;
    case 'interest':
      if (stream.foreignTax > 0 && stream.payerDomicile === 'domestic') {
        return 'Foreign tax on interest paid in Japan is not supported.';
      }
      if (stream.foreignTax > 0 && stream.foreignTax > stream.amount) {
        return 'Foreign tax cannot be more than the gross interest.';
      }
      return undefined;
    case 'publicPension':
      if (stream.foreignTax > 0 && stream.payerDomicile === 'domestic') {
        return 'Foreign tax can be entered only for a pension from a foreign system.';
      }
      if (stream.foreignTax > 0 && stream.treatyCredit === 'unavailable') {
        return 'Foreign tax can be entered only when a tax credit is available in Japan.';
      }
      if (stream.foreignTax > 0 && stream.foreignTax > stream.amount) {
        return 'Foreign tax cannot be more than the gross pension.';
      }
      return undefined;
    case 'withholdingAccount':
      if (stream.foreignDividends < 0) return 'Foreign dividends cannot be negative.';
      if (stream.foreignDividends > 0 && stream.foreignDividends > stream.dividends) {
        return 'Foreign dividends cannot be more than the dividends received into the account.';
      }
      if (stream.foreignTax > 0 && stream.foreignTax > stream.foreignDividends) {
        return 'Foreign tax cannot be more than the foreign dividends.';
      }
      return undefined;
    default: {
      const unhandled: never = stream;
      throw new Error(`Unhandled income stream type: ${JSON.stringify(unhandled)}`);
    }
  }
};

interface IncomeStreamBehavior<T extends IncomeStreamType> {
  /**
   * Whether streams of this type are earned income: pay for work, or business, miscellaneous or
   * pension income received over the year. Earned income is what the chart sweep scales across
   * its income range (see isPassThroughStream in chartConfig.ts, the complement of this) and
   * the part of the social-insurance dependent-coverage test's 年間収入 that is taken at its
   * annual amount ({@link dependentTestAnnualIncome}, which adds the investment receipts and the
   * commuting allowance on their own terms). False for a reimbursement (通勤手当, not income at
   * all) and for investment income, which is asset-based: it is held at its entered amount
   * across the sweep.
   */
  isEarnedIncome: boolean;
  /**
   * Whether streams of this type are income: they count toward annual income (see
   * TakeHomeResults.annualIncome in tax.ts) and toward their category's subtotal in the income
   * modal. False only for a reimbursement (通勤手当), which sits in the employment category for
   * entry but is not income of that category either. Investment income counts whether it is
   * reported or settled by withholding: it is money received either way, and the tax withheld
   * on it is a tax like any other.
   */
  countsTowardCategorySubtotal: boolean;
  /** The amount the stream represents over a year, from however its amount is entered. */
  annualAmount: (stream: IncomeStreamOfType[T]) => number;
  /**
   * Why `stream` violates an invariant of its type, or `undefined` when valid.
   * Shared by the entry form (which shows the message) and `calculateTaxes` (which throws it).
   */
  validate: (stream: IncomeStreamOfType[T]) => string | undefined;
}

/**
 * Returns the multiplier to convert a per-period commuting allowance amount to an annual total.
 * e.g. a monthly payment × 12 = annual; a 3-month payment × 4 = annual.
 */
export const getFrequencyAnnualMultiplier = (
  frequency: CommutingAllowanceIncomeStream['frequency'],
): number => {
  switch (frequency) {
    case 'monthly':
      return 12;
    case '3-months':
      return 4;
    case '6-months':
      return 2;
    case 'annual':
      return 1;
  }
};

const earned = <T extends IncomeStreamType>(
  annualAmount: IncomeStreamBehavior<T>['annualAmount'],
  validate: IncomeStreamBehavior<T>['validate'] = () => undefined,
): IncomeStreamBehavior<T> => ({
  isEarnedIncome: true,
  countsTowardCategorySubtotal: true,
  annualAmount,
  validate,
});

/**
 * How each income stream type behaves. Every type answers every question, so adding one to
 * {@link IncomeStream} does not compile until its behaviour is declared here — in particular
 * a type whose amount is entered per period cannot silently annualize at face value.
 *
 * Read through {@link isEarnedIncomeStream}, {@link countsTowardCategorySubtotal} and
 * {@link annualIncomeStreamAmount}.
 */
const INCOME_STREAM_BEHAVIOR: { [T in IncomeStreamType]: IncomeStreamBehavior<T> } = {
  salary: earned(s => (s.frequency === 'monthly' ? s.amount * 12 : s.amount)),
  bonus: earned(s => s.amount),
  business: earned(s => s.amount),
  realEstate: earned(
    s => s.amount,
    s => {
      const foreignError = foreignTaxEntryError(s);
      if (foreignError) return foreignError;
      if (s.landDebtInterest !== undefined && s.landDebtInterest < 0) {
        return 'Interest on debt to acquire land cannot be negative.';
      }
      if (
        s.foreignUsedBuildingDisallowedLoss !== undefined &&
        s.foreignUsedBuildingDisallowedLoss < 0
      ) {
        return 'Disallowed foreign building loss cannot be negative.';
      }
      return undefined;
    },
  ),
  miscellaneous: earned(s => s.amount),
  publicPension: earned(s => s.amount, foreignTaxEntryError),
  stockCompensation: earned(s => s.amount),
  // A commuting allowance (通勤手当) reimburses a cost rather than paying for work.
  commutingAllowance: {
    isEarnedIncome: false,
    countsTowardCategorySubtotal: false,
    annualAmount: s => s.amount * getFrequencyAnnualMultiplier(s.frequency),
    validate: s =>
      (s.amount * getFrequencyAnnualMultiplier(s.frequency)) / 12 >
      COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP
        ? `Commuting allowance cannot exceed ${formatJPY(COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP)}/month (non-taxable cap). For amounts exceeding this, please include the excess as part of the salary.`
        : undefined,
  },
  // One 特定口座（源泉徴収あり）; the account's own two flags say whether its sales and its
  // dividends are on the return (措法37条の11の5①, 37条の11の6⑨).
  withholdingAccount: {
    isEarnedIncome: false,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.capitalGains + s.dividends,
    validate: s => {
      const foreignError = foreignTaxEntryError(s);
      if (foreignError) return foreignError;
      if (s.dividends < 0) return 'Dividends cannot be negative.';
      if (withholdingAccountDividendsMustBeReported(s) && !s.reportsDividends) {
        return "A reported loss that reduced this account's dividend withholding must be reported together with the dividends (措法37条の11の6⑩).";
      }
      return undefined;
    },
  },
  // Asset-based income. Settled at source under 申告不要 (see calculateWithheldInvestmentTax in
  // investmentIncome.ts) or taxed through the return when reported; real income of its own
  // category either way. A sale outside a withholding account is always reported.
  capitalGains: {
    isEarnedIncome: false,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
    validate: s =>
      s.shareType !== 'listed'
        ? 'Capital gains on 一般株式等 are not currently supported.'
        : undefined,
  },
  dividends: {
    isEarnedIncome: false,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
    validate: s => {
      const foreignError = foreignTaxEntryError(s);
      if (foreignError) return foreignError;
      if (s.shareType !== 'listed') return 'Dividends on 一般株式等 are not currently supported.';
      if (s.amount < 0) return 'Dividends cannot be negative.';
      if (dividendMustBeReported(s) && !s.isReported) {
        return 'A dividend received outside Japan with no Japanese handler must be reported (措令4条の3②).';
      }
      return undefined;
    },
  },
  // 措法3条① settles interest paid in Japan by withholding; interest paid outside Japan is
  // reported.
  interest: {
    isEarnedIncome: false,
    countsTowardCategorySubtotal: true,
    annualAmount: s => s.amount,
    validate: s => {
      const foreignError = foreignTaxEntryError(s);
      if (foreignError) return foreignError;
      if (s.amount < 0) return 'Interest cannot be negative.';
      return undefined;
    },
  },
};

/** Whether `stream` is earned income — see {@link IncomeStreamBehavior.isEarnedIncome}. */
export const isEarnedIncomeStream = (stream: IncomeStream): stream is EarnedIncomeStream =>
  INCOME_STREAM_BEHAVIOR[stream.type].isEarnedIncome;

/** Whether `stream` is income — see {@link IncomeStreamBehavior.countsTowardCategorySubtotal}. */
export const countsTowardCategorySubtotal = (stream: IncomeStream): boolean =>
  INCOME_STREAM_BEHAVIOR[stream.type].countsTowardCategorySubtotal;

// Taking the discriminant and the stream as correlated parameters is what lets TypeScript
// check the indexed call; reading INCOME_STREAM_BEHAVIOR[stream.type] inline does not.
const annualAmountOf = <T extends IncomeStreamType>(
  type: T,
  stream: IncomeStreamOfType[T],
): number => INCOME_STREAM_BEHAVIOR[type].annualAmount(stream);

/** The amount `stream` represents over a year. */
export const annualIncomeStreamAmount = (stream: IncomeStream): number =>
  annualAmountOf(stream.type, stream);

const validateStreamOf = <T extends IncomeStreamType>(
  type: T,
  stream: IncomeStreamOfType[T],
): string | undefined => INCOME_STREAM_BEHAVIOR[type].validate(stream);

/**
 * Why `stream` violates an invariant of its type, or `undefined` when valid.
 * Shared by the entry form (which shows the message) and `calculateTaxes` (which throws it).
 */
export const validateIncomeStream = (stream: IncomeStream): string | undefined =>
  validateStreamOf(stream.type, stream);

/**
 * The part of `stream`'s annual amount that contributes to {@link totalAnnualIncomeFromStreams}:
 * all of it when the stream is income, nothing for a reimbursement.
 */
export const annualIncomeContribution = (stream: IncomeStream): number =>
  countsTowardCategorySubtotal(stream) ? annualIncomeStreamAmount(stream) : 0;

/**
 * The amount `stream` represents in a month, from however its amount is entered: its
 * {@link annualIncomeStreamAmount} spread evenly over the year.
 */
export const monthlyIncomeStreamAmount = (stream: IncomeStream): number =>
  annualIncomeStreamAmount(stream) / 12;

/** Returns the annualized amount for a commuting allowance income stream. */
export const getCommutingAllowanceAnnualAmount = (stream: CommutingAllowanceIncomeStream): number =>
  INCOME_STREAM_BEHAVIOR.commutingAllowance.annualAmount(stream);

/**
 * Total annual income represented by a set of income streams: the sum of every stream's
 * {@link annualIncomeContribution}. Each stream's entered amount is already at the level this
 * total is defined at (see TakeHomeResults.annualIncome in tax.ts): gross for employment and
 * public pension income, after 必要経費 for business and miscellaneous income, as entered for
 * investment income, whether reported or settled by withholding.
 */
export function totalAnnualIncomeFromStreams(streams: readonly IncomeStream[]): number {
  return streams.reduce((sum, s) => sum + annualIncomeContribution(s), 0);
}

/** The annualized total of every commuting allowance among `streams`. */
export function totalCommutingAllowanceFromStreams(streams: readonly IncomeStream[]): number {
  return streams.reduce(
    (sum, s) =>
      s.type === 'commutingAllowance' ? sum + getCommutingAllowanceAnnualAmount(s) : sum,
    0,
  );
}

/**
 * The 年間収入 the dependent-coverage test (被扶養者認定) is judged on: the earned income among
 * `streams` ({@link isEarnedIncomeStream}) and the annualized commuting allowance, plus the
 * investment receipts — dividends and interest gross of the tax withheld, and the year's capital
 * gains netted across withholding accounts and other sales alike and floored at zero — whatever
 * their tax election or account. The test is a social-insurance rule on 収入, not a tax rule on
 * the return, so the reporting election cannot be what decides it.
 *
 * The rule itself names a figure and no list: 昭和52年4月6日 保発第9号・庁保発第9号「収入がある
 * 者についての被扶養者の認定について」sets the 130万円 (180万円) 年間収入 test without
 * enumerating what counts. 日本年金機構 reads 年間収入 as the amount expected from the
 * certification date onward, counting non-taxable benefits, self-employment income after
 * 必要経費, and any other income a 課税証明書 evidences. 協会けんぽ's 再確認 guidance lists
 * 給与収入, 事業収入, 地代・家賃収入などの財産収入, 公的年金 and the insurance benefits, and
 * judges a 給与所得者 on the 総収入額; dividends and interest are read here as 財産収入 and taken
 * gross, before the 20.315% withheld. A net loss from business income (事業所得の損失) does not
 * reduce other earnings for dependent testing and is floored at ¥0.
 *
 * Capital gains have no uniform rule — a securities-company FAQ notes that whether 株式の譲渡所得
 * や配当 count as 恒常的な収入 has no explicit provision — so the written 健保組合 practice is
 * modelled: 株等の譲渡収入 (譲渡価額 − 取得価額) is 恒常的 while the person keeps holding 株等, a
 * losing year counts as ¥0 and is never netted against other income, 繰越損失 is ignored, and
 * only a one-time sale, of inherited shares for one, is 一時的. So a positive year's gains count,
 * a losing year adds nothing, and whether a given sale is 恒常的 is the insurer's call. An amount
 * that is 申告不要 never reaches a 課税証明書, but the rule is about the amount, not where it can
 * be read from, so it counts all the same.
 *
 * The commuting allowance is added back by name because it is the one amount earned income and
 * 年間収入 disagree on — annual income leaves it out as a cost reimbursement, while 認定 reads
 * 年間収入 off the 労働基準法第11条 賃金, which includes 諸手当, and a labour contract stating
 * only 「通勤手当有」 without an amount is one the 保険者 cannot judge on. Its income-tax
 * non-taxability does not exempt it, that being a tax rule rather than a 社会保険 one.
 *
 * Sources:
 * - 昭和52年4月6日 保発第9号・庁保発第9号
 *   https://www.mhlw.go.jp/web/t_doc?dataId=00tb0189&dataType=1&pageNo=1
 * - 日本年金機構「被扶養者になれる人の範囲」
 *   https://www.nenkin.go.jp/service/kounen/tekiyo/hihokensha1/20141202.html
 * - 日本年金機構「労働契約内容による年間収入での被扶養者の認定の取り扱いについて」
 *   https://www.nenkin.go.jp/oshirase/taisetu/jigyosho/2026/202605/0501.html
 * - 協会けんぽ「被扶養者資格の再確認」
 *   https://www.kyoukaikenpo.or.jp/about/business/dependent_status/001/index.html
 * - 三菱UFJモルガン・スタンレー証券 FAQ
 *   https://faq.sc.mufg.jp/faq/show/2238?category_id=97&site_domain=default
 * - azbil健康保険組合「株の譲渡収入がある場合」
 *   https://www.kenpo.gr.jp/azbil-g/contents/04shinsei/case/fuyou_kabu.html
 * - 安川電機健康保険組合 FAQ
 *   https://www.yaskawa-kenpo.or.jp/asp/faq/faq.asp?articleid=12565
 */
export function dependentTestAnnualIncome(streams: readonly IncomeStream[]): number {
  let capitalGains = 0;
  let total = totalCommutingAllowanceFromStreams(streams);
  for (const s of streams) {
    switch (s.type) {
      case 'salary':
      case 'bonus':
      case 'miscellaneous':
      case 'publicPension':
      case 'stockCompensation':
        total += annualIncomeStreamAmount(s);
        break;
      case 'business':
      case 'realEstate':
        total += Math.max(0, annualIncomeStreamAmount(s));
        break;
      case 'commutingAllowance':
        // Commuting allowances are annualized in totalCommutingAllowanceFromStreams above.
        break;
      case 'dividends':
      case 'interest':
        total += s.amount;
        break;
      case 'capitalGains':
        capitalGains += s.amount;
        break;
      case 'withholdingAccount':
        total += s.dividends;
        capitalGains += s.capitalGains;
        break;
      default: {
        const unhandled: never = s;
        throw new Error(`Unhandled income stream: ${JSON.stringify(unhandled)}`);
      }
    }
  }
  return total + Math.max(0, capitalGains);
}
