// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { percentTo, Rate } from './rate';

const percent = percentTo(1);

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
 * Gross annual employment income threshold above which a salaried taxpayer is excluded from
 * year-end adjustment and must file an income tax return (¥20,000,000).
 * Source: Income Tax Act Art. 121(1)(i) (所得税法第121条第1項第1号).
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1900.htm
 */
export const MANDATORY_RETURN_SALARY_THRESHOLD = 20_000_000;

/**
 * Gross annual public pension income threshold above which a pensioner cannot use the
 * no-return system for public pensions and must file an income tax return (¥4,000,000).
 * Source: Income Tax Act Art. 121(3)(i) (所得税法第121条第3項第1号).
 * @see https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm
 */
export const MANDATORY_RETURN_PENSION_THRESHOLD = 4_000_000;
