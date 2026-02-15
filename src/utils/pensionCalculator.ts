// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { BonusIncomeStream } from '../types/tax';
import { roundSocialInsurancePremium } from './taxCalculations';
import type { StandardMonthlyRemunerationBracket } from '../data/employeesHealthInsurance/smrBrackets';

export type { StandardMonthlyRemunerationBracket };

/** National pension (国民年金) - fixed monthly contribution.
 * Source: https://www.nenkin.go.jp/service/kokunen/hokenryo/hokenryo.html#cms01
 */
export const monthlyNationalPensionContribution = 17510;

/**
 * Employees' pension insurance rate (厚生年金保険料率)
 * Source: https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/index.html
 */
export const EMPLOYEES_PENSION_RATE = 0.183; // 18.3%

/**
 * Employees' pension insurance SMR brackets
 * Source: https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/index.html
 */
export const EMPLOYEES_PENSION_BRACKETS: StandardMonthlyRemunerationBracket[] = [
  { grade: 1, smrAmount: 88000, minIncomeInclusive: 0, maxIncomeExclusive: 93000 },
  { grade: 2, smrAmount: 98000, minIncomeInclusive: 93000, maxIncomeExclusive: 101000 },
  { grade: 3, smrAmount: 104000, minIncomeInclusive: 101000, maxIncomeExclusive: 107000 },
  { grade: 4, smrAmount: 110000, minIncomeInclusive: 107000, maxIncomeExclusive: 114000 },
  { grade: 5, smrAmount: 118000, minIncomeInclusive: 114000, maxIncomeExclusive: 122000 },
  { grade: 6, smrAmount: 126000, minIncomeInclusive: 122000, maxIncomeExclusive: 130000 },
  { grade: 7, smrAmount: 134000, minIncomeInclusive: 130000, maxIncomeExclusive: 138000 },
  { grade: 8, smrAmount: 142000, minIncomeInclusive: 138000, maxIncomeExclusive: 146000 },
  { grade: 9, smrAmount: 150000, minIncomeInclusive: 146000, maxIncomeExclusive: 155000 },
  { grade: 10, smrAmount: 160000, minIncomeInclusive: 155000, maxIncomeExclusive: 165000 },
  { grade: 11, smrAmount: 170000, minIncomeInclusive: 165000, maxIncomeExclusive: 175000 },
  { grade: 12, smrAmount: 180000, minIncomeInclusive: 175000, maxIncomeExclusive: 185000 },
  { grade: 13, smrAmount: 190000, minIncomeInclusive: 185000, maxIncomeExclusive: 195000 },
  { grade: 14, smrAmount: 200000, minIncomeInclusive: 195000, maxIncomeExclusive: 210000 },
  { grade: 15, smrAmount: 220000, minIncomeInclusive: 210000, maxIncomeExclusive: 230000 },
  { grade: 16, smrAmount: 240000, minIncomeInclusive: 230000, maxIncomeExclusive: 250000 },
  { grade: 17, smrAmount: 260000, minIncomeInclusive: 250000, maxIncomeExclusive: 270000 },
  { grade: 18, smrAmount: 280000, minIncomeInclusive: 270000, maxIncomeExclusive: 290000 },
  { grade: 19, smrAmount: 300000, minIncomeInclusive: 290000, maxIncomeExclusive: 310000 },
  { grade: 20, smrAmount: 320000, minIncomeInclusive: 310000, maxIncomeExclusive: 330000 },
  { grade: 21, smrAmount: 340000, minIncomeInclusive: 330000, maxIncomeExclusive: 350000 },
  { grade: 22, smrAmount: 360000, minIncomeInclusive: 350000, maxIncomeExclusive: 370000 },
  { grade: 23, smrAmount: 380000, minIncomeInclusive: 370000, maxIncomeExclusive: 395000 },
  { grade: 24, smrAmount: 410000, minIncomeInclusive: 395000, maxIncomeExclusive: 425000 },
  { grade: 25, smrAmount: 440000, minIncomeInclusive: 425000, maxIncomeExclusive: 455000 },
  { grade: 26, smrAmount: 470000, minIncomeInclusive: 455000, maxIncomeExclusive: 485000 },
  { grade: 27, smrAmount: 500000, minIncomeInclusive: 485000, maxIncomeExclusive: 515000 },
  { grade: 28, smrAmount: 530000, minIncomeInclusive: 515000, maxIncomeExclusive: 545000 },
  { grade: 29, smrAmount: 560000, minIncomeInclusive: 545000, maxIncomeExclusive: 575000 },
  { grade: 30, smrAmount: 590000, minIncomeInclusive: 575000, maxIncomeExclusive: 605000 },
  { grade: 31, smrAmount: 620000, minIncomeInclusive: 605000, maxIncomeExclusive: 635000 },
  { grade: 32, smrAmount: 650000, minIncomeInclusive: 635000, maxIncomeExclusive: Infinity },
];

/**
 * Utility function to find the Pension SMR bracket for a given monthly income
 */
export function findPensionBracket(monthlyIncome: number): StandardMonthlyRemunerationBracket {
  if (monthlyIncome < 0) {
    throw new Error('Monthly income must be non-negative');
  }
  return EMPLOYEES_PENSION_BRACKETS.find(bracket =>
    monthlyIncome >= bracket.minIncomeInclusive && monthlyIncome < bracket.maxIncomeExclusive
  )!; // Invariant: there is always a matching bracket for non-negative income
}

/**
 * Breakdown of Pension premium components
 */
export interface PensionBreakdown {
  total: number;
  bonusPortion: number;
}

/**
 * Calculates the annual insurance premium breakdown based on monthly income
 */
export function calculatePensionBreakdown(
  isEmployeesPension: boolean = true,
  monthlyIncome: number = 0,
  isHalfAmount: boolean = true,
  bonuses: BonusIncomeStream[] = []
): PensionBreakdown {
  if (!isEmployeesPension) {
    return { total: monthlyNationalPensionContribution * 12, bonusPortion: 0 };
  }
  if (monthlyIncome < 0) {
    throw new Error('Monthly income must be a positive number');
  }

  const bracket = findPensionBracket(monthlyIncome);

  if (!bracket) {
    throw new Error('No matching income bracket found');
  }

  const fullPremium = bracket.smrAmount * EMPLOYEES_PENSION_RATE;
  const monthlyAmount = roundSocialInsurancePremium(isHalfAmount ? fullPremium / 2 : fullPremium);

  let totalPremium = monthlyAmount * 12;
  let bonusPortion = 0;

  if (bonuses.some(b => b.amount > 0)) {
    const bonusBreakdown = calculatePensionBonusBreakdown(bonuses, isHalfAmount);
    bonusPortion = bonusBreakdown.reduce((sum, item) => sum + item.premium, 0);
    totalPremium += bonusPortion;
  }

  return { total: totalPremium, bonusPortion };
}

/**
 * Breakdown of a single month's bonus pension premium calculation
 */
export interface PensionBonusBreakdownItem {
  month: number;
  totalBonusAmount: number;
  standardBonusAmount: number;
  premium: number;
}

/**
 * Calculates the detailed breakdown of pension premiums for bonuses
 * @param bonuses - List of bonus payments
 * @param isHalfAmount - Whether to return the half amount (折半額)
 */
export function calculatePensionBonusBreakdown(
  bonuses: BonusIncomeStream[],
  isHalfAmount: boolean = true
): PensionBonusBreakdownItem[] {
  if (bonuses.length === 0) {
    return [];
  }

  const effectiveRate = isHalfAmount ? EMPLOYEES_PENSION_RATE / 2 : EMPLOYEES_PENSION_RATE;
  const breakdown: PensionBonusBreakdownItem[] = [];

  // Group bonuses by month (0-11)
  const monthlyBonusTotals = new Map<number, number>();

  for (const bonus of bonuses) {
    const currentMonthTotal = monthlyBonusTotals.get(bonus.month) || 0;
    monthlyBonusTotals.set(bonus.month, currentMonthTotal + bonus.amount);
  }

  // Calculate premium for each month with bonuses
  for (const [month, totalAmount] of monthlyBonusTotals) {
    // 1. Round down to nearest 1,000 yen
    const roundedBonusAmount = Math.floor(totalAmount / 1000) * 1000;

    // 2. Cap at 1.5 million yen per month to get Standard Bonus Amount
    const standardBonusAmount = Math.min(roundedBonusAmount, 1_500_000);

    // 3. Calculate premium
    const premium = roundSocialInsurancePremium(standardBonusAmount * effectiveRate);

    breakdown.push({
      month,
      totalBonusAmount: totalAmount,
      standardBonusAmount,
      premium,
    });
  }

  // Sort by month
  return breakdown.sort((a, b) => a.month - b.month);
}

/**
 * Calculates the annual insurance premium based on monthly income
 * @param isEmployeesPension - Whether the person is enrolled in employees pension (厚生年金)
 * @param monthlyIncome - Monthly income in JPY
 * @param isHalfAmount - Whether to return the half amount (折半額) instead of full amount (全額)
 * @param bonuses - List of bonus payments
 * @returns The calculated annual insurance premium amount
 * @see https://www.nenkin.go.jp/service/kounen/hokenryo/ryogaku/ryogakuhyo/20200825.html
 * @see https://www.nenkin.go.jp/service/kokunen/hokenryo/hokenryo.html#cms01
 */
export function calculatePensionPremium(
  isEmployeesPension: boolean = true,
  monthlyIncome: number = 0,
  isHalfAmount: boolean = true,
  bonuses: BonusIncomeStream[] = []
): number {
  return calculatePensionBreakdown(isEmployeesPension, monthlyIncome, isHalfAmount, bonuses).total;
}
