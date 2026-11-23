// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { percentTo, Rate } from './rate';

const percent = percentTo(1);

/**
 * Official source URLs for Furusato Nozei gift valuation, shipping inclusion, and temporary income
 * (一時所得) taxation.
 */
export const FURUSATO_SOURCES = {
  micArchive:
    'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/archive/#ac03',
  micFy2025Pdf: 'https://www.soumu.go.jp/main_content/001085011.pdf',
  ntaTemporaryIncomeQa: 'https://www.nta.go.jp/law/shitsugi/shotoku/02/37.htm',
  ntaTimingQa: 'https://www.nta.go.jp/law/shitsugi/shotoku/03/08.htm',
  ntaTemporaryIncomeTaxAnswer: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1490.htm',
  kfsDecision2022: 'https://www.kfs.go.jp/service/JP/126/02/index.html',
  yokohamaDistrictCourt2024Pdf:
    'https://www.nta.go.jp/about/organization/ntc/soshoshiryo/kazei/2024/pdf/13940.pdf',
  tokyoHighCourt2024Pdf:
    'https://www.nta.go.jp/about/organization/ntc/soshoshiryo/kazei/2024/pdf/14061.pdf',
} as const;

/**
 * Average gift procurement cost as a share of Furusato Nozei donations (返礼品の調達に係る費用: 26.5%).
 * Source: MIC 令和8年度調査結果（概要）(FY2025 actuals, published July 31, 2026, slide 5 — ¥352.8B / ¥1,331.4B).
 * @see https://www.soumu.go.jp/main_content/001085011.pdf
 */
export const FURUSATO_AVERAGE_GIFT_COST_RATE: Rate = percent(26.5);

/**
 * Average gift delivery/shipping cost as a share of Furusato Nozei donations (返礼品の送付に係る費用: 5.7%).
 * Source: MIC 令和8年度調査結果（概要）(FY2025 actuals, published July 31, 2026, slide 5 — ¥75.6B / ¥1,331.4B).
 * Included in the estimated economic benefit per National Tax Tribunal decision of Feb 7, 2022
 * (令和4年2月7日裁決, Vol. 126, §4(3)ハ(ロ)), which held bundled shipping is not deducted from
 * return-gift economic benefit under Income Tax Act Art. 36(1)-(2).
 * @see https://www.kfs.go.jp/service/JP/126/02/index.html
 */
export const FURUSATO_AVERAGE_SHIPPING_COST_RATE: Rate = percent(5.7);

/**
 * Combined average economic benefit rate (goods 26.5% + shipping 5.7% = 32.2%).
 */
export const FURUSATO_AVERAGE_ECONOMIC_BENEFIT_RATE: Rate = Rate.sum(
  FURUSATO_AVERAGE_GIFT_COST_RATE,
  FURUSATO_AVERAGE_SHIPPING_COST_RATE,
);

/**
 * Annual special deduction for temporary income (一時所得の特別控除額: ¥500,000),
 * shared across all temporary income received in the calendar year.
 * Source: Income Tax Act Art. 34(3) (所得税法第34条第3項).
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1490.htm
 */
export const TEMPORARY_INCOME_SPECIAL_DEDUCTION = 500_000;

/**
 * Divisor for including net temporary income in aggregate taxable income (総所得金額: 1/2).
 * Source: Income Tax Act Art. 22(2)(ii) (所得税法第22条第2項第2号);
 * Local Tax Act Arts. 32(2) & 313(2) (地方税法第32条第2項・第313条第2項).
 */
export const TEMPORARY_INCOME_INCLUSION_DIVISOR = 2;
