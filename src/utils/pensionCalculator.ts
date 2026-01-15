// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { BonusIncomeStream } from '../types/tax';

export interface IncomeBracketToPensionPremium {
  min: number;
  max: number | null;
  fullAmount: number;
  halfAmount: number;
}

/** National pension (国民年金) - fixed monthly contribution.
 * Source: https://www.nenkin.go.jp/service/kokunen/hokenryo/hokenryo.html#cms01
 */
export const monthlyNationalPensionContribution = 17510;

export const PENSION_RATE = 0.183; // 18.3%

export const EMPLOYEES_PENSION_PREMIUM: IncomeBracketToPensionPremium[] = [
  { min: 0, max: 93000, fullAmount: 16104.00, halfAmount: 8052.00 },
  { min: 93000, max: 101000, fullAmount: 17934.00, halfAmount: 8967.00 },
  { min: 101000, max: 107000, fullAmount: 19032.00, halfAmount: 9516.00 },
  { min: 107000, max: 114000, fullAmount: 20130.00, halfAmount: 10065.00 },
  { min: 114000, max: 122000, fullAmount: 21594.00, halfAmount: 10797.00 },
  { min: 122000, max: 130000, fullAmount: 23058.00, halfAmount: 11529.00 },
  { min: 130000, max: 138000, fullAmount: 24522.00, halfAmount: 12261.00 },
  { min: 138000, max: 146000, fullAmount: 25986.00, halfAmount: 12993.00 },
  { min: 146000, max: 155000, fullAmount: 27450.00, halfAmount: 13725.00 },
  { min: 155000, max: 165000, fullAmount: 29280.00, halfAmount: 14640.00 },
  { min: 165000, max: 175000, fullAmount: 31110.00, halfAmount: 15555.00 },
  { min: 175000, max: 185000, fullAmount: 32940.00, halfAmount: 16470.00 },
  { min: 185000, max: 195000, fullAmount: 34770.00, halfAmount: 17385.00 },
  { min: 195000, max: 210000, fullAmount: 36600.00, halfAmount: 18300.00 },
  { min: 210000, max: 230000, fullAmount: 40260.00, halfAmount: 20130.00 },
  { min: 230000, max: 250000, fullAmount: 43920.00, halfAmount: 21960.00 },
  { min: 250000, max: 270000, fullAmount: 47580.00, halfAmount: 23790.00 },
  { min: 270000, max: 290000, fullAmount: 51240.00, halfAmount: 25620.00 },
  { min: 290000, max: 310000, fullAmount: 54900.00, halfAmount: 27450.00 },
  { min: 310000, max: 330000, fullAmount: 58560.00, halfAmount: 29280.00 },
  { min: 330000, max: 350000, fullAmount: 62220.00, halfAmount: 31110.00 },
  { min: 350000, max: 370000, fullAmount: 65880.00, halfAmount: 32940.00 },
  { min: 370000, max: 395000, fullAmount: 69540.00, halfAmount: 34770.00 },
  { min: 395000, max: 425000, fullAmount: 75030.00, halfAmount: 37515.00 },
  { min: 425000, max: 455000, fullAmount: 80520.00, halfAmount: 40260.00 },
  { min: 455000, max: 485000, fullAmount: 86010.00, halfAmount: 43005.00 },
  { min: 485000, max: 515000, fullAmount: 91500.00, halfAmount: 45750.00 },
  { min: 515000, max: 545000, fullAmount: 96990.00, halfAmount: 48495.00 },
  { min: 545000, max: 575000, fullAmount: 102480.00, halfAmount: 51240.00 },
  { min: 575000, max: 605000, fullAmount: 107970.00, halfAmount: 53985.00 },
  { min: 605000, max: 635000, fullAmount: 113460.00, halfAmount: 56730.00 },
  { min: 635000, max: null, fullAmount: 118950.00, halfAmount: 59475.00 },
];

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
    return { total: monthlyNationalPensionContribution * 12, bonusPortion: 0 }; // Annual contribution
  }
  if (monthlyIncome < 0) {
    throw new Error('Monthly income must be a positive number');
  }

  const monthlyPremium = EMPLOYEES_PENSION_PREMIUM.find(bracket => 
    monthlyIncome >= bracket.min && 
    (bracket.max === null || monthlyIncome < bracket.max)
  );

  if (!monthlyPremium) {
    throw new Error('No matching income bracket found');
  }

  let totalPremium = (isHalfAmount ? monthlyPremium.halfAmount : monthlyPremium.fullAmount) * 12;
  let bonusPortion = 0;

  // Calculate bonus premiums
  if (bonuses.length > 0) {
    const bonusRate = PENSION_RATE;
    const effectiveRate = isHalfAmount ? bonusRate / 2 : bonusRate;

    for (const bonus of bonuses) {
      // Standard Bonus Amount: Round down to nearest 1,000 yen
      const standardBonusAmount = Math.floor(bonus.amount / 1000) * 1000;
      
      // Cap at 1.5 million yen per payment
      const cappedBonusAmount = Math.min(standardBonusAmount, 1_500_000);
      
      // Calculate premium
      const premium = Math.round(cappedBonusAmount * effectiveRate);
      bonusPortion += premium;
      totalPremium += premium;
    }
  }

  return { total: totalPremium, bonusPortion };
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
