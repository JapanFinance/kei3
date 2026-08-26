// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Cap on the non-taxable portion of a commuting allowance paid to a 通勤者 using public transport,
 * per month (通勤手当の非課税限度額). Allowances at or below it are wholly non-taxable, so they
 * never enter 給与等の収入金額; the calculator accepts no amount above it, and asks for the excess
 * to be entered as salary instead.
 *
 * Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2582.htm
 */
export const COMMUTING_ALLOWANCE_NONTAXABLE_MONTHLY_CAP: number = 150_000;
