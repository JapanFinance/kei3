// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * National Income Tax Basic Deduction (基礎控除) tiers for 2025/2026
 * Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm
 * 2025 reform: https://www.nta.go.jp/users/gensen/2025kiso/index.htm#a-01
 *
 * Each tier is (income_max, deduction_amount). Applies to net income.
 */
export const NATIONAL_BASIC_DEDUCTION_TIERS: ReadonlyArray<{ maxIncomeInclusive: number; deduction: number }> = [
  { maxIncomeInclusive: 1_320_000,  deduction: 950_000 }, // Up from 480,000 in 2024
  { maxIncomeInclusive: 3_360_000,  deduction: 880_000 }, // Will be 580,000 from 2027
  { maxIncomeInclusive: 4_890_000,  deduction: 680_000 }, // Will be 580,000 from 2027
  { maxIncomeInclusive: 6_550_000,  deduction: 630_000 }, // Will be 580,000 from 2027
  { maxIncomeInclusive: 23_500_000, deduction: 580_000 }, // Up from 480,000 in 2024
  { maxIncomeInclusive: 24_000_000, deduction: 480_000 }, // Unchanged for income > 23.5M
  { maxIncomeInclusive: 24_500_000, deduction: 320_000 },
  { maxIncomeInclusive: 25_000_000, deduction: 160_000 },
  // Above 25,000,000: deduction = 0
];

/**
 * Cap on the non-taxable portion of commuting allowance (150,000 yen/month)
 * Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2585.htm
 */
export const COMMUTING_ALLOWANCE_NONTAXABLE_ANNUAL_CAP : number = 150_000 * 12;
