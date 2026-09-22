// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Dependent, DependentDeductionResults, DisabilityLevel } from './dependents';
import type { HealthInsuranceProviderId, LongTermCareCategory1Estimate } from './healthInsurance';
import type { TaxpayerAgeRange } from './taxpayerAge';

export type IncomeMode = 'salary' | 'advanced';

export interface BaseIncomeStream {
  id: string;
  type: IncomeStreamType;
  amount: number;
}

export interface SalaryIncomeStream extends BaseIncomeStream {
  type: 'salary';
  frequency: 'monthly' | 'annual';
}

export interface CommutingAllowanceIncomeStream extends BaseIncomeStream {
  type: 'commutingAllowance';
  frequency: 'monthly' | '3-months' | '6-months' | 'annual';
}

export interface BonusIncomeStream extends BaseIncomeStream {
  type: 'bonus';
  month: number; // 0-11 for Jan-Dec
}

export interface BusinessIncomeStream extends BaseIncomeStream {
  type: 'business';
  blueFilerDeduction?: number; // 0, 100000, 550000, or 650000
}

export interface MiscellaneousIncomeStream extends BaseIncomeStream {
  type: 'miscellaneous';
}

/**
 * Public pension income (公的年金等): {@link BaseIncomeStream.amount} is the gross annual
 * amount received (公的年金等の収入金額), before withholding. The public pension deduction (公的年金等控除)
 * is applied by the calculation, using the taxpayer's age range for the 65 boundary.
 */
export interface PublicPensionIncomeStream extends BaseIncomeStream {
  type: 'publicPension';
}

export interface StockCompensationIncomeStream extends BaseIncomeStream {
  type: 'stockCompensation';
  issuerDomicile: 'foreign' | 'domestic';
}

/**
 * How the dividends that go on the return are taxed — one election for all of them, not one per
 * entry. 措法8条の4② applies 申告分離課税 only where the return elects it for the year's
 * 特定上場株式等の配当等, and withdraws it from every other such dividend once one of them is
 * taxed under 所法22条 (総合課税); NTA No.1330 puts it as 申告分離課税の選択は、確定申告する
 * 上場株式等の配当所得の全額についてしなければなりません. 申告不要 is different: 措法8条の5 grants
 * it per payment, so each entry chooses that for itself — {@link DividendsIncomeStream.isReported}.
 * - `separate` — 申告分離課税 (措法8条の4①): 15% + 復興特別所得税 and 5%, apart from the
 *   progressive brackets; what makes 損益通算 with a reported 譲渡損失 available; no 配当控除.
 * - `aggregate` — 総合課税: 配当所得 inside 総所得金額 (所法22条②一), taxed in the progressive
 *   brackets. The 配当控除 (所法92, 地方税法附則5条) is not yet modelled, so for a dividend from a
 *   domestic company the tax under this election is overstated. Open to 配当等 proper (剰余金の
 *   配当 and 公募株式投資信託の分配金) only: 特定公社債の利子 is 利子所得 that 措法8条の4① taxes
 *   apart from the brackets with no 総合課税 election.
 *
 * A share sale has no such election — 措法37条の11 taxes a reported sale under 申告分離課税 and
 * nothing else — and interest none at all: 措法3条① makes 源泉分離課税 the final treatment of the
 * 一般利子等 国内において支払を受けるべき, while interest paid outside Japan is taxed in the
 * brackets with no election either, see {@link InterestIncomeStream}.
 */
export type ReportedDividendsTaxation = 'separate' | 'aggregate';

/** The election in force until one is made — see {@link TakeHomeInputs.reportedDividendsTaxation}. */
export const DEFAULT_REPORTED_DIVIDENDS_TAXATION: ReportedDividendsTaxation = 'separate';

/**
 * One 特定口座（源泉徴収あり）for the year, as its 特定口座年間取引報告書 states it. The account is
 * the unit the law uses: 申告不要 is chosen per account for its sales (措法37条の11の5①) and for
 * the dividends received into it (措法37条の11の6⑨), and the broker nets the year's loss against
 * those dividends before withholding (⑥⑦).
 */
export interface WithholdingAccountIncomeStream {
  id: string;
  type: 'withholdingAccount';
  /** 譲渡損益 for the year, net of costs; negative for a net loss. */
  capitalGains: number;
  /**
   * 配当等 received into the account (源泉徴収選択口座内配当等), before withholding. Dividends on
   * the same shares taken by bank transfer or 配当金領収証 are outside the account and belong in
   * a {@link DividendsIncomeStream}.
   */
  dividends: number;
  /** Whether the account's sales are on the return; false is 申告不要 (措法37条の11の5①). */
  reportsCapitalGains: boolean;
  /**
   * Whether the account's dividends are on the return. Has to be true when a reported loss
   * reduced their withholding (措法37条の11の6⑩) — see
   * {@link import("../utils/investmentReporting").withholdingAccountDividendsMustBeReported}.
   */
  reportsDividends: boolean;
}

/**
 * 株式等に係る譲渡所得等の金額 for the year from a sale outside a 特定口座（源泉徴収あり）, net of
 * acquisition and transfer costs. {@link BaseIncomeStream.amount} may be negative (譲渡損失). Such
 * a sale is always reported: 措法37条の11の5① grants 申告不要 only to a 源泉徴収選択口座, which is
 * a {@link WithholdingAccountIncomeStream} instead. A reported loss here is netted against the
 * year's other reported gains, and what remains is 損益通算 against reported dividends only where
 * the sale qualifies — see {@link account}.
 */
export interface CapitalGainsIncomeStream extends BaseIncomeStream {
  type: 'capitalGains';
  /**
   * 上場株式等 (措法37条の11) or 一般株式等, which 措法37条の10① defines as 株式等 other than
   * those. Only 'listed' is supported: the two are separate 分離課税 classes that cannot offset
   * each other, so a 一般株式等 amount needs a calculation of its own rather than joining this one.
   */
  shareType: 'listed' | 'other';
  /**
   * The account the shares were sold from. A sale outside Japan is not 売委託 to a licensed
   * 金融商品取引業者, which 措法37条の12の2②一〜三 requires of a loss before it is
   * 上場株式等に係る譲渡損失の金額, so a loss in a 'foreign' account nets against the year's
   * other reported gains and no further: it neither offsets 配当等 nor carries forward. A
   * 特定口座（源泉徴収なし）and a 一般口座 differ only in who computes the figures, so they share
   * an option.
   */
  account: 'domesticNoWithholding' | 'foreign';
}

/**
 * 配当等: gross dividends before withholding, including 公募株式投資信託の分配金 and
 * 特定公社債の利子, received outside a 特定口座（源泉徴収あり）— a dividend received into such an
 * account is a {@link WithholdingAccountIncomeStream} instead. Under 申告分離課税 the 損益通算 of
 * 措法37条の12の2① nets a qualifying reported loss against this; under 総合課税 nothing nets
 * against it — 措法37条の12の2① offsets a loss only against the 配当所得等 that elected 措法8条の4.
 */
export interface DividendsIncomeStream extends BaseIncomeStream {
  type: 'dividends';
  /**
   * Whether the payer is 上場株式等, whose 配当等 措法8条の4 taxes separately from the
   * progressive brackets, or 一般株式等. Only 'listed' is supported: a 一般株式等 dividend is
   * 総合課税 unless it is a 少額配当 (措法8条の5①一), so it belongs in the brackets instead.
   */
  shareType: 'listed' | 'other';
  /**
   * Where the dividend is paid. 'domestic' is paid in Japan, or paid abroad through a Japanese
   * broker acting as 支払の取扱者, so Japanese tax was withheld and 申告不要 is available per
   * payment (措法8条の5①④, 9条の2⑤). 'abroad' is received outside Japan with no Japanese
   * handler — a foreign brokerage account, for example — which 措令4条の3②五・六 exclude from
   * 申告不要, so {@link isReported} has to be true.
   */
  paymentChannel: 'domestic' | 'abroad';
  /**
   * Whether the dividend goes on the return. False is 申告不要, which 措法8条の5 grants per
   * payment on the withholding alone, only for a 'domestic' {@link paymentChannel}. True puts it
   * on the return, where it is taxed under the election made once for every reported dividend,
   * {@link ReportedDividendsTaxation}. The amount is taken as the 配当所得 (所法24条②:
   * 収入金額 less the 負債利子 on money borrowed to buy the shares, which is not modelled).
   */
  isReported: boolean;
}

/**
 * 利子所得 as 所法23条① defines it — the interest on 公社債 and 預貯金, and distributions from
 * 合同運用信託, 公社債投資信託 and 公募公社債等運用投資信託 — gross before withholding. Interest
 * outside that definition is not 利子所得 at all: interest on money lent privately, for one, is
 * 雑所得, is not withheld, and has to be reported, so it belongs in
 * {@link MiscellaneousIncomeStream} instead.
 */
export interface InterestIncomeStream extends BaseIncomeStream {
  type: 'interest';
  /**
   * Where the interest is paid.
   * - `domestic` — 国内において支払を受けるべき一般利子等, which 措法3条① settles by
   *   源泉分離課税 at 15% plus the 復興特別所得税 and 5% 住民税, with no election and nothing to
   *   report. Interest paid outside Japan on a 公社債 or 公社債投資信託 but handed over by a
   *   Japanese 支払の取扱者 is settled the same way (措法3条の3①) and belongs here too.
   * - `foreign` — received with no Japanese payer or 支払の取扱者, interest on a deposit at a
   *   foreign bank for example. 措法3条① does not reach it, so nothing is withheld in Japan and
   *   所法22条②一 counts the whole receipt (所法23条②) in 総所得金額, taxed in the progressive
   *   brackets and at the 住民税 所得割 rate with the other income. The foreign tax withheld on
   *   it is not modelled (外国税額控除, 所法95条).
   */
  payerDomicile: 'domestic' | 'foreign';
}

export type IncomeStream =
  | SalaryIncomeStream
  | BonusIncomeStream
  | BusinessIncomeStream
  | MiscellaneousIncomeStream
  | PublicPensionIncomeStream
  | CommutingAllowanceIncomeStream
  | StockCompensationIncomeStream
  | WithholdingAccountIncomeStream
  | CapitalGainsIncomeStream
  | DividendsIncomeStream
  | InterestIncomeStream;

export type IncomeStreamType = IncomeStream['type'];

/**
 * Whether `stream` is one of the investment-income types. These are never earned income — see
 * {@link import("../utils/incomeStreams").isEarnedIncomeStream} — and, except for a
 * dividend reported under 総合課税 and for interest paid outside Japan
 * ({@link InterestIncomeStream.payerDomicile}), are taxed separately from the progressive
 * brackets, see {@link import("../utils/investmentIncome").calculateWithheldInvestmentTax}.
 */
export const isInvestmentIncomeStream = (
  stream: IncomeStream,
): stream is
  | WithholdingAccountIncomeStream
  | CapitalGainsIncomeStream
  | DividendsIncomeStream
  | InterestIncomeStream =>
  stream.type === 'withholdingAccount' ||
  stream.type === 'capitalGains' ||
  stream.type === 'dividends' ||
  stream.type === 'interest';

/**
 * Gross investment-income amounts for the year that are settled by withholding and stay off
 * the return, before that withholding: 上場株式等 under 申告不要 for {@link capitalGains} and
 * {@link dividends} — including the unreported parts of a
 * {@link WithholdingAccountIncomeStream} — and 国内において支払を受ける一般利子等 for
 * {@link interest}.
 */
export interface InvestmentIncomeAmounts {
  /** See {@link CapitalGainsIncomeStream}; may be negative. */
  capitalGains: number;
  /** See {@link DividendsIncomeStream}. */
  dividends: number;
  /** Interest paid in Japan — see {@link InterestIncomeStream.payerDomicile}. */
  interest: number;
}

/** The 申告分離課税 amounts gathered from the reported streams, as entered. */
export interface ReportedInvestmentAmounts {
  /**
   * 上場株式等に係る譲渡所得等 netted across every reported account; negative when the year
   * closed at a loss.
   */
  capitalGains: number;
  /**
   * The losses within {@link capitalGains} realized in a Japanese account. Only these can be
   * 上場株式等に係る譲渡損失の金額 — 措法37条の12の2②一〜三 requires a sale through a licensed
   * 金融商品取引業者 or 登録金融機関 — so only these can offset dividends or carry forward.
   */
  qualifyingCapitalLosses: number;
  /** 上場株式等の配当等 reported under 措法8条の4①. */
  dividends: number;
}

/**
 * The net 分離課税 amounts that enter 合計所得金額 (措法8条の4③一, 37条の10⑥一 as 37条の11⑥
 * applies it): each class after 損益通算, never negative.
 */
export interface SeparateNetIncome {
  capitalGains: number;
  dividends: number;
}

/** Investment income reported under 申告分離課税 and how the return taxes it. */
export interface ReportedInvestmentIncome {
  gross: ReportedInvestmentAmounts;
  /** 上場株式等に係る譲渡損失の金額 deducted from the dividends (措法37条の12の2①). */
  lossOffsetAgainstDividends: number;
  /**
   * Qualifying loss left after that offset. It would carry forward for three years
   * (措法37条の12の2⑤), which is not modelled.
   */
  unabsorbedQualifyingLoss: number;
  /**
   * Loss realized in a foreign account that the year's reported gains did not absorb. It
   * offsets nothing and is not carried forward (措法37条の12の2②, 措令25条の11の2②③).
   */
  nonQualifyingLoss: number;
  netIncome: SeparateNetIncome;
  /**
   * National taxable amounts (上場株式等に係る課税配当所得等の金額・課税譲渡所得等の金額): the
   * net amounts less the 所得控除 that 総所得金額 could not absorb, each floored to ¥1,000.
   */
  taxable: SeparateNetIncome;
  /**
   * 15% of the taxable total (措法8条の4①, 37条の11①), before the 復興特別所得税 that the
   * total income tax applies to it together with the bracket tax.
   */
  nationalIncomeTaxBase: number;
}

/**
 * Tax withheld at source on investment income that is 申告不要 (not reported on the return).
 * Unlike withholding on salary or other income — a prepayment reconciled against the progressive
 * brackets at 年末調整/確定申告, and so never itself shown — 申告不要 investment income has no
 * further step: 措法8条の4①・37条の11① tax it at the flat rate as the complete treatment, so what
 * is withheld IS the final tax liability. This holds only while a stream is 申告不要; a reported
 * (申告分離課税) stream's tax is an assessed amount, not a withholding, and should not be modeled
 * through this type.
 *
 * 所得税 15.315% + 住民税 5% (措法9条の3, 3条①, 8条の4; 地方税法71条の28〔配当割〕,
 * 71条の49〔株式等譲渡所得割〕, 71条の6〔利子割〕).
 */
export interface WithheldInvestmentTax {
  national: number;
  residence: number;
  total: number;
}

/**
 * User input for the home loan tax credit (住宅ローン控除).
 */
export interface HomeLoanTaxCreditInput {
  /**
   * Calendar year the user first moved into the residence. Drives the cohort
   * lookup for the residence-tax spillover cap and the income-eligibility limit.
   */
  moveInYear: number;
  /**
   * The full calculated annual credit (住宅借入金等特別控除可能額) in yen — i.e.
   * year-end loan balance × the credit rate, up to the home's qualifying maximum.
   * This is the 控除可能額 (E2 on the 源泉徴収票), NOT the already-applied amount
   * (E1 / 住宅借入金等特別控除の額), which is capped at the prior year's income tax.
   */
  creditAmount: number;
  /**
   * Whether the home was a 特定取得 — acquired under the 8%/10% consumption tax (a new build,
   * or a pre-owned home bought from a business). A non-特定取得 (e.g. a pre-owned home bought from
   * a private individual, with no consumption tax) uses a lower residence-tax spillover cap.
   * Only affects the 2014–2021 move-in cohort (特定取得 → 7%/¥136,500; non-特定取得 → 5%/¥97,500);
   * 2022+ move-ins use 5%/¥97,500 regardless. Defaults to true (特定取得) when omitted.
   */
  isTokuteiShutoku?: boolean;
}

/** Computed application of the home loan tax credit. */
export interface HomeLoanTaxCreditResult {
  /**
   * The credit available to apply this year (yen). Sum of {@link appliedToIncomeTax},
   * {@link appliedToResidenceTax}, and {@link unusedCredit}. Zero when the taxpayer is
   * ineligible (income over the cohort limit, or an unsupported move-in year), so it may
   * be less than the entered 控除可能額 in that case.
   */
  availableCredit: number;
  /** Portion applied against national income tax. */
  appliedToIncomeTax: number;
  /** Portion that spilled over and was applied against residence tax. */
  appliedToResidenceTax: number;
  /** Credit that could not be applied because of caps (informational). */
  unusedCredit: number;
  /**
   * The residence-tax spillover ceiling for the year, exposed so the UI can explain
   * why a credit may not be fully usable: the credit can reduce residence tax
   * by at most `applied` = min(flatCap 定額限度, incomeRateCap 定率限度).
   */
  residenceTaxSpilloverCap?: {
    /** The binding cap actually used: min(flatCap, incomeRateCap). */
    applied: number;
    /** 定額限度 — the cohort flat cap (¥97,500 or ¥136,500). */
    flatCap: number;
    /** 定率限度 — floor(課税総所得金額等 × cohort rate). */
    incomeRateCap: number;
  };
  /** Human-readable warnings: out-of-period, income exceeds limit, etc. */
  warnings: ReadonlyArray<string>;
}

/**
 * User input for the life insurance premium deduction (生命保険料控除). All values are
 * annual premiums paid, in yen. New-contract (新契約) categories are 2012-01-01-onward
 * policies; old-contract (旧契約) categories are pre-2012 policies. 介護医療 has no
 * old-contract equivalent.
 */
export interface LifeInsuranceInput {
  /** 一般生命保険料 — new contract (新契約). */
  generalNew: number;
  /** 介護医療保険料 — new contract only. */
  medicalCareNew: number;
  /** 個人年金保険料 — new contract (新契約). */
  pensionNew: number;
  /** 一般生命保険料 — old contract (旧契約, pre-2012). */
  generalOld?: number;
  /** 個人年金保険料 — old contract (旧契約, pre-2012). */
  pensionOld?: number;
}

/**
 * User input for the earthquake insurance premium deduction (地震保険料控除). Values are
 * annual premiums in yen.
 */
export interface EarthquakeInsuranceInput {
  /** 地震保険料 paid in the year. */
  earthquake: number;
  /** 旧長期損害保険料 — qualifying pre-2007 long-term casualty contracts (0 if none). */
  longTermOld: number;
}

/** User input for the medical expense deduction (医療費控除). Amounts in yen. */
export interface MedicalExpensesInput {
  /** Total medical expenses paid (支払った医療費の合計). */
  paid: number;
  /** Amounts reimbursed by insurance, etc. (保険金などで補填される金額). */
  reimbursed: number;
}

/**
 * Whether the taxpayer is a 寡婦 or an ひとり親, and which statutory sub-case. One field carries
 * all of them because they are mutually exclusive: a 寡婦 is defined as a woman who does not
 * qualify as an ひとり親 (所法2①三十), and its two branches partition the ways of not being
 * married.
 *
 * The mother/father split changes no deduction amount — both are ¥350,000 income tax / ¥300,000
 * residence tax. It selects the 人的控除額の差 that the residence-tax 調整控除 uses: 地方税法
 * 第314条の6第1号イ(3) gives ¥10,000 and (4) gives ¥50,000, and 地方税法施行令 assigns (3) to
 * ひとり親のうち父である者 and (4) to ひとり親のうち母である者.
 *
 * The 寡婦 split changes no amount either — it distinguishes the branches of 所法2①三十イ/ロ so
 * the calculator can check the one requirement that differs: a divorced 寡婦 (イ) must have a
 * dependent relative (扶養親族), while a bereaved one — 死別, or the husband's survival unknown
 * (ロ) — needs none.
 *
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1170.htm — 寡婦控除
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1171.htm — ひとり親控除
 */
export type WidowOrSingleParentStatus =
  | 'none'
  | 'singleParentMother'
  | 'singleParentFather'
  | 'widowDivorced'
  | 'widowBereaved';

/**
 * The taxpayer's own circumstances that carry a 人的控除 of their own, as entered in the
 * Additional Deductions & Credits modal. Every one of them is self-asserted: the calculator can
 * check the 合計所得金額 ceilings it knows and cross-check the Dependents list
 * ({@link import("../utils/personalDeductions").getPersonalCircumstanceWarnings}), but not
 * 障害者手帳 status, marital history, or 事実婚, so the modal states those requirements and
 * applies what is selected.
 */
export interface PersonalCircumstancesInput {
  /**
   * 障害者控除 for the taxpayer themselves. There is no 同居特別障害者 option here: that higher
   * amount exists only for a 同一生計配偶者 or 扶養親族 living with the taxpayer, never for the
   * taxpayer (所法79).
   * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1160.htm
   */
  disability: DisabilityLevel;
  /** 寡婦控除 / ひとり親控除 — see {@link WidowOrSingleParentStatus}. */
  widowOrSingleParent: WidowOrSingleParentStatus;
}

/**
 * Zero-value defaults for the additional-deduction inputs. The modal always shows these fields
 * (defaulting to 0), so "nothing entered" is all-zeros rather than absent — which is why these
 * inputs are required, not optional. Use these to seed form state, and spread
 * {@link EMPTY_ADDITIONAL_DEDUCTION_INPUTS} in tests to satisfy the required fields in one line.
 */
export const EMPTY_LIFE_INSURANCE: LifeInsuranceInput = {
  generalNew: 0,
  medicalCareNew: 0,
  pensionNew: 0,
};
export const EMPTY_EARTHQUAKE_INSURANCE: EarthquakeInsuranceInput = {
  earthquake: 0,
  longTermOld: 0,
};
export const EMPTY_MEDICAL_EXPENSES: MedicalExpensesInput = { paid: 0, reimbursed: 0 };
export const EMPTY_PERSONAL_CIRCUMSTANCES: PersonalCircumstancesInput = {
  disability: 'none',
  widowOrSingleParent: 'none',
};
export const EMPTY_ADDITIONAL_DEDUCTION_INPUTS = {
  lifeInsurance: EMPTY_LIFE_INSURANCE,
  earthquakeInsurance: EMPTY_EARTHQUAKE_INSURANCE,
  medicalExpenses: EMPTY_MEDICAL_EXPENSES,
  personalCircumstances: EMPTY_PERSONAL_CIRCUMSTANCES,
};

/** One line in the additional-deductions breakdown, with its per-tax amounts (yen). */
export interface AdditionalDeductionItem {
  key: 'lifeInsurance' | 'earthquakeInsurance' | 'medical';
  /** Amount deductible against national income tax. */
  national: number;
  /** Amount deductible against residence tax. */
  residence: number;
}

/**
 * Aggregated additional income deductions (所得控除) entered in the modal, beyond the
 * basic, dependent, social-insurance, and 小規模企業共済等掛金 deductions handled elsewhere. Shaped like
 * {@link DependentDeductionResults}: per-tax totals plus an itemized breakdown for display.
 * Because every member is a 物的控除, none of these affect the residence-tax 調整控除.
 */
export interface AdditionalDeductionsResult {
  /** Total deductible against national income tax (yen). */
  national: number;
  /** Total deductible against residence tax (yen). */
  residence: number;
  /** Per-item breakdown; only items contributing a positive amount are included. */
  items: AdditionalDeductionItem[];
}

/** One line in the personal-deduction breakdown, with its per-tax amounts (yen). */
export interface PersonalDeductionItem {
  /** 障害者控除 covers both 一般の障害者 and 特別障害者; the amounts distinguish them. */
  key: 'disability' | 'widow' | 'singleParent';
  /** Amount deductible against national income tax. */
  national: number;
  /** Amount deductible against residence tax. */
  residence: number;
  /** This item's 人的控除額の差 — see {@link PersonalDeductionsResult.statutoryDifference}. */
  statutoryDifference: number;
}

/**
 * The 人的控除 arising from the taxpayer's own circumstances (障害者控除・寡婦控除・ひとり親控除),
 * shaped like {@link AdditionalDeductionsResult} with one extra member. Unlike the 物的控除 in that
 * result, these are 人的控除 and so add to the residence-tax 調整控除's 人的控除額の差.
 */
export interface PersonalDeductionsResult {
  /** Total deductible against national income tax (yen). */
  national: number;
  /** Total deductible against residence tax (yen). */
  residence: number;
  /**
   * Combined 人的控除額の差 these deductions contribute to the residence-tax 調整控除
   * (地方税法第314条の6第1号イ). A statutory figure, not the arithmetic difference between the
   * national and residence amounts — the two disagree for an ひとり親（父）.
   */
  statutoryDifference: number;
  /** Per-item breakdown; only items contributing a positive amount are included. */
  items: PersonalDeductionItem[];
}

/**
 * The most recent income (tax) year the calculator has data and rules for, and the
 * default written into form state.
 *
 * Pinned deliberately rather than derived from `new Date().getFullYear()`: Japanese
 * tax-year changes are frequently not finalized until ~April of that year, and the
 * data tables (e.g. NATIONAL_BASIC_DEDUCTION_TIER_PERIODS) are newest-first lookups
 * that silently reuse the latest authored period for any later year. Rolling over
 * automatically on Jan 1 would therefore present a not-yet-implemented year using the
 * prior year's rules. Bump this when the data tables gain a newer effective year.
 */
export const DEFAULT_INCOME_YEAR = 2026;

/** Interface for the UI Form State */
export interface TakeHomeFormState {
  annualIncome: number;
  /**
   * Calendar year the income is taxed in. Single source of truth for the income year,
   * defaulted to {@link DEFAULT_INCOME_YEAR} in App. A future year-picker UI writes here.
   */
  incomeYear: number;
  incomeMode: IncomeMode;
  incomeStreams: IncomeStream[];
  /** See {@link TakeHomeInputs.reportedDividendsTaxation}. */
  reportedDividendsTaxation: ReportedDividendsTaxation;
  ageRange: TaxpayerAgeRange;
  /**
   * True when the user has switched off the calculated 介護保険料 estimate to enter the billed
   * annual amount into {@link longTermCareCategory1Premium}. Named for the manual side so that
   * the false default means "estimate", matching {@link manualSocialInsuranceEntry}'s
   * convention. Ignored below age 65 and under manual social insurance entry.
   */
  longTermCareCategory1ManualEntry: boolean;
  /**
   * Annual 介護保険料 billed directly to a 第1号被保険者 (ages 65 and over), from the
   * June-July 介護保険料決定通知書. Read only when {@link longTermCareCategory1ManualEntry}
   * is on; 0 when nothing has been entered. Required (rather than optional) because it
   * backs a controlled number field, matching {@link manualSocialInsuranceAmount}, which
   * is likewise only meaningful when a sibling field says so.
   */
  longTermCareCategory1Premium: number;
  region: string;
  healthInsuranceProvider: HealthInsuranceProviderId;
  dependents: Dependent[];
  dcPlanContributions: number;
  manualSocialInsuranceEntry: boolean;
  manualSocialInsuranceAmount: number;
  customEHIRates?: CustomEmployeesHealthInsuranceRates | undefined;
  savedIncomeStreams: IncomeStream[];
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
  lifeInsurance: LifeInsuranceInput;
  earthquakeInsurance: EarthquakeInsuranceInput;
  medicalExpenses: MedicalExpensesInput;
  personalCircumstances: PersonalCircumstancesInput;
}

/** Interface for Calculation Logic (clean, normalized inputs) */
export interface TakeHomeInputs {
  incomeStreams: IncomeStream[];
  /**
   * The one election that taxes every reported dividend among {@link incomeStreams} — see
   * {@link ReportedDividendsTaxation}. Absent means {@link DEFAULT_REPORTED_DIVIDENDS_TAXATION}.
   */
  reportedDividendsTaxation?: ReportedDividendsTaxation | undefined;
  ageRange: TaxpayerAgeRange;
  /** See {@link TakeHomeFormState.longTermCareCategory1ManualEntry}. Absent means false. */
  longTermCareCategory1ManualEntry?: boolean | undefined;
  /** See {@link TakeHomeFormState.longTermCareCategory1Premium}. Absent means 0. */
  longTermCareCategory1Premium?: number | undefined;
  region: string;
  healthInsuranceProvider: HealthInsuranceProviderId;
  dependents: Dependent[];
  dcPlanContributions: number;
  manualSocialInsuranceEntry: boolean;
  manualSocialInsuranceAmount: number;
  customEHIRates?: CustomEmployeesHealthInsuranceRates | undefined;
  /**
   * Calendar year the income is taxed in. Required: every caller threads it through from
   * {@link TakeHomeFormState.incomeYear} (defaulted to {@link DEFAULT_INCOME_YEAR}), so the
   * calculation never has to fall back to a guessed year.
   */
  incomeYear: number;
  homeLoanTaxCredit?: HomeLoanTaxCreditInput | undefined;
  lifeInsurance: LifeInsuranceInput;
  earthquakeInsurance: EarthquakeInsuranceInput;
  medicalExpenses: MedicalExpensesInput;
  personalCircumstances: PersonalCircumstancesInput;
}

/**
 * The employee rates entered for a custom health insurance provider, as the percentages the form
 * holds them: 4.755 is 4.755%. {@link getCustomProviderRates} reads them into premium rates, to the
 * decimal places the form accepts.
 */
export interface CustomEmployeesHealthInsuranceRates {
  healthInsuranceRate: number;
  longTermCareRate: number;
}

export interface TakeHomeResults {
  /**
   * The income received over the year before taxes and social insurance: net of the real costs
   * of earning it and gross of every deduction that is not a cash outflow. Salary, bonus and
   * stock compensation gross; public pension gross, before the 公的年金等控除; business and
   * miscellaneous income after 必要経費 but before the 青色申告特別控除; and investment income
   * as entered, whether reported under 申告分離課税 or 総合課税 or settled by withholding under
   * 申告不要 (so a 譲渡損失 reduces it). A commuting allowance is excluded as a cost
   * reimbursement. {@link takeHomeIncome} is this amount minus social insurance and every tax on
   * it, assessed through the return or withheld at source — see {@link investmentIncome} for the
   * withheld tax.
   *
   * The same definition is used by the 国民生活基礎調査 figure behind the chart's median and
   * percentile bands, which the survey's 用語の説明 (2025 edition, item 13「所得の種類」,
   * k-tyosa25/dl/07.pdf p. 38) defines as 雇用者所得 = 給料・賃金・賞与の合計金額 including
   * 税金や社会保険料, 事業所得 = 収入 minus 仕入原価や必要経費, and 公的年金・恩給 =
   * 支給された年金額; item 15 defines 可処分所得 as that 所得 minus taxes and social insurance
   * and calls it the equivalent of 手取り収入, which is {@link takeHomeIncome}. The 年間収入 of
   * the social insurance dependent-coverage test is a different total — the earned part plus
   * the commuting allowance and the investment receipts whatever their election
   * (dependentTestAnnualIncome in incomeStreams.ts). Totalled by totalAnnualIncomeFromStreams
   * on the input side.
   */
  annualIncome: number;
  hasEmploymentIncome: boolean;
  blueFilerDeduction?: number;
  nationalIncomeTax: number;
  residenceTax: ResidenceTaxDetails;
  healthInsurance: number;
  pensionPayments: number;
  employmentInsurance?: number | undefined;
  takeHomeIncome: number;
  socialInsuranceOverride?: number | undefined;
  // Bonus breakdown
  healthInsuranceOnBonus?: number;
  pensionOnBonus?: number;
  employmentInsuranceOnBonus?: number;
  // Added detailed properties
  netEmploymentIncome?: number | undefined;
  /**
   * Canonical gross employment income (給与等の収入金額): the exact figure the employment income
   * deduction (給与所得控除) and {@link netEmploymentIncome}/{@link incomeAdjustmentDeduction} are
   * derived from — salary + taxable commuting allowance + bonus + stock compensation. The UI must
   * display THIS value rather than recomputing a per-tab subset, which can understate gross and make
   * the derived deduction (gross − net − adjustment) wrong or even negative. 0 when no employment income.
   */
  grossEmploymentIncome: number;
  /**
   * 所得金額調整控除（子ども・特別障害者等を有する者等）applied to net employment income (給与所得).
   * Subtracted after the 給与所得控除, so it lowers 合計所得金額 and the taxable income for both
   * income tax and residence tax. 0 when the taxpayer is not eligible. {@link netEmploymentIncome}
   * is already net of this amount.
   */
  incomeAdjustmentDeduction?: number | undefined;
  /**
   * 所得金額調整控除（給与所得と年金所得の双方を有する者）: up to ¥100,000 subtracted from net
   * employment income when the taxpayer has both 給与所得 and 公的年金等に係る雑所得.
   * {@link netEmploymentIncome} is already net of this amount. Absent when not applicable.
   */
  pensionIncomeAdjustmentDeduction?: number | undefined;
  /**
   * 事業所得 and 雑所得 other than public pensions, net of the 青色申告特別控除
   * ({@link blueFilerDeduction}). 0 when there is no business or miscellaneous income.
   */
  netBusinessAndMiscIncome: number;
  /** Gross public pension income (公的年金等の収入金額). Absent when there is none. */
  grossPublicPensionIncome?: number | undefined;
  /**
   * Net public pension income (公的年金等に係る雑所得): {@link grossPublicPensionIncome} minus the
   * public pension deduction (公的年金等控除). Absent when there is no public pension income.
   */
  netPublicPensionIncome?: number | undefined;
  totalNetIncome: number;
  /**
   * 通勤手当 paid over the year. Wholly non-taxable, so it is no part of 給与等の収入金額 and does
   * not reach any tax; it counts towards 報酬 for social insurance.
   */
  commutingAllowance?: number;
  /**
   * Investment income (listed-share capital gains and dividends, interest). Every amount
   * is inside {@link annualIncome} and {@link takeHomeIncome}. The amounts settled by
   * withholding are outside {@link totalNetIncome} and every assessed figure, and the tax
   * withheld on them, in the `withheld` field, comes off take-home like any other tax; the
   * amounts reported, under 申告分離課税 or 総合課税, are taxed through the same calculation as
   * the earned income. Absent when every amount is 0.
   */
  investmentIncome?:
    | {
        /** The 申告不要 amounts, before withholding. */
        gross: InvestmentIncomeAmounts;
        /**
         * Sum of the three {@link InvestmentIncomeAmounts}; may be negative when a capital-gains
         * loss exceeds the dividends and interest.
         */
        grossTotal: number;
        withheld: WithheldInvestmentTax;
        /** Present when any amount is reported under 申告分離課税. */
        reported?: ReportedInvestmentIncome | undefined;
        /**
         * 配当所得 reported under 総合課税, as entered: part of 総所得金額 and taxed in the
         * progressive brackets with the earned income, with no 配当控除 (not yet modelled) and
         * nothing netted against it. Present when any dividend is reported that way.
         */
        aggregateDividends?: number | undefined;
        /**
         * 利子所得 paid outside Japan, as entered: no Japanese tax was withheld on it, so the
         * whole receipt is part of 総所得金額 and is taxed in the progressive brackets with the
         * earned income. The foreign tax withheld on it is not modelled. Present when any
         * interest is paid that way.
         */
        aggregateInterest?: number | undefined;
      }
    | undefined;
  nationalIncomeTaxBasicDeduction?: number | undefined;
  taxableIncomeForNationalIncomeTax?: number | undefined;
  residenceTaxBasicDeduction?: number | undefined;
  taxableIncomeForResidenceTax?: number | undefined;
  furusatoNozei: FurusatoNozeiDetails;
  homeLoanTaxCredit?: HomeLoanTaxCreditResult;
  additionalDeductions: AdditionalDeductionsResult;
  /**
   * 障害者控除・寡婦控除・ひとり親控除 for the taxpayer themselves. Absent when none applies, so
   * the display rows can key off its presence (as they do for {@link dependentDeductions}).
   */
  personalDeductions?: PersonalDeductionsResult;
  /**
   * Residence tax income-based portion (所得割) BEFORE the home loan credit spillover, for
   * display. Not simply (post-credit 所得割 + appliedToResidenceTax): the city and prefectural
   * 所得割 are each floored to ¥100 after subtracting their share of the spillover, so the true
   * pre-credit 所得割 can differ from that sum by up to ~¥100. Taken from the pre-credit residence
   * calculation (already computed for the furusato 20% cap) so the Taxes-tab rows reconcile exactly.
   */
  residenceTaxIncomeBasedBeforeHomeLoanCredit?: number | undefined;
  dcPlanContributions: number;
  // Dependent deductions
  dependentDeductions?: DependentDeductionResults;
  // Income tax breakdown
  nationalIncomeTaxBase?: number | undefined;
  reconstructionSurtax?: number | undefined;
  // National Health Insurance breakdown (only for non-employment income)
  nhiMedicalPortion?: number | undefined;
  nhiElderlySupportPortion?: number | undefined;
  nhiLongTermCarePortion?: number | undefined;
  nhiChildSupportPortion?: number | undefined;
  // 後期高齢者医療制度 breakdown (only at ages 75+); the portions sum to healthInsurance
  latterStageMedicalPortion?: number | undefined;
  latterStageChildSupportPortion?: number | undefined;
  /**
   * Whether {@link latterStageMedicalPortion} has stopped rising with income, which for a
   * calendar year that blends two fiscal years needs both of them at their 賦課限度額.
   */
  latterStageMedicalCapped?: boolean | undefined;
  /**
   * Annual 介護保険料第1号 amount actually applied at ages 65+ outside manual social insurance
   * entry: the calculator's estimate, or the entered billed amount when positive. Included in
   * the social insurance deduction but not in {@link healthInsurance}.
   */
  longTermCareCategory1Premium?: number | undefined;
  /**
   * Present exactly when {@link longTermCareCategory1Premium} is the calculator's estimate
   * rather than an entered billed amount; carries the 所得段階 and 基準額 behind the figure.
   */
  longTermCareCategory1Estimate?: LongTermCareCategory1Estimate | undefined;
  // Context needed for cap detection
  salaryIncome: number; // Regular salary income (monthly * 12 or annual amount) excluding bonuses
  healthInsuranceProvider: HealthInsuranceProviderId;
  region: string;
  ageRange: TaxpayerAgeRange;
  // Custom provider rates (percentages, e.g. 5.0 for 5%)
  customEHIRates?: CustomEmployeesHealthInsuranceRates | undefined;
}

export interface ResidenceTaxDetails {
  taxableIncome: number; // 市町村民税の課税標準額
  cityProportion: number;
  prefecturalProportion: number;
  residenceTaxRate: number;
  basicDeduction: number;
  personalDeductionDifference: number; // 人的控除額の差 - difference between national and residence tax personal deductions
  city: {
    cityTaxableIncome: number;
    cityAdjustmentCredit: number;
    cityIncomeTax: number;
    cityPerCapitaTax: number;
  };
  prefecture: {
    prefecturalTaxableIncome: number;
    prefecturalAdjustmentCredit: number;
    prefecturalIncomeTax: number;
    prefecturalPerCapitaTax: number;
  };
  perCapitaTax: number;
  forestEnvironmentTax: number; // 森林環境税
  totalResidenceTax: number;
  /**
   * Set when the result is non-taxable under 地方税法第295条第1項第2号, naming the status that
   * applied, so the display can explain the zero rows without re-deriving the rule.
   */
  nonTaxableStatus?: NonTaxableResidenceTaxStatus;
  /**
   * The 所得割 on investment income reported under 申告分離課税, which {@link city} and
   * {@link prefecture} already include. Present only when 所得割 is levied and an amount is
   * reported.
   */
  separate?: ResidenceTaxSeparateDetails;
}

/**
 * The 分離課税 part of the 所得割 (地方税法附則第33条の2, 第35条の2の2): 3% 市町村民税 + 2%
 * 道府県民税 on the taxable amounts, alongside the 6% + 4% on 課税総所得金額.
 */
export interface ResidenceTaxSeparateDetails {
  /** 上場株式等に係る課税配当所得等の金額 for residence tax, floored to ¥1,000. */
  taxableDividends: number;
  /** 上場株式等に係る課税譲渡所得等の金額 for residence tax, floored to ¥1,000. */
  taxableCapitalGains: number;
  /** 3% of the taxable total, before the ¥100 floor applied to the whole 市町村民税所得割. */
  cityIncomeTax: number;
  /** 2% of the taxable total, before the ¥100 floor applied to the whole 道府県民税所得割. */
  prefecturalIncomeTax: number;
}

/**
 * The statuses 地方税法第295条第1項第2号 exempts from residence tax entirely when 合計所得金額 is
 * within the statutory limit: 障害者・未成年者・寡婦・ひとり親.
 */
export type NonTaxableResidenceTaxStatus = 'minor' | 'disability' | 'widow' | 'singleParent';

export interface FurusatoNozeiDetails {
  limit: number;
  incomeTaxReduction: number;
  residenceTaxDonationBasicDeduction: number;
  residenceTaxSpecialDeduction: number;
  outOfPocketCost: number;
  residenceTaxReduction: number;
}

export interface ChartRange {
  min: number;
  max: number;
}
