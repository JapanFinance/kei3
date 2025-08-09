/**
 * Standard Monthly Remuneration (SMR) brackets used by all Japanese employee health insurance providers
 * Based on the standardized grade system (等級) established by the Ministry of Health, Labour and Welfare
 * 
 * These brackets are consistent across all employee health insurance providers (Kyokai Kenpo, corporate health insurance associations, etc.)
 * Only the premium rates differ between providers, not the income brackets themselves.
 */
export interface StandardMonthlyRemunerationBracket {
  /** Grade level (等級) - standardized across all providers */
  grade: number;
  /** Standard Monthly Remuneration amount (標準報酬月額) */
  smrAmount: number;
  /** Minimum monthly income (inclusive) for this bracket */
  minIncomeInclusive: number;
  /** Maximum monthly income (exclusive) for this bracket */
  maxIncomeExclusive: number;
}

/**
 * Standardized SMR brackets for all employee health insurance providers in Japan
 * Source: Ministry of Health, Labour and Welfare (MHLW) standardized grade system
 */
export const STANDARD_SMR_BRACKETS: StandardMonthlyRemunerationBracket[] = [
  // Grade 1
  { grade: 1, smrAmount: 58000, minIncomeInclusive: 0, maxIncomeExclusive: 63000 },
  // Grade 2
  { grade: 2, smrAmount: 68000, minIncomeInclusive: 63000, maxIncomeExclusive: 73000 },
  // Grade 3
  { grade: 3, smrAmount: 78000, minIncomeInclusive: 73000, maxIncomeExclusive: 83000 },
  // Grade 4
  { grade: 4, smrAmount: 88000, minIncomeInclusive: 83000, maxIncomeExclusive: 93000 },
  // Grade 5
  { grade: 5, smrAmount: 98000, minIncomeInclusive: 93000, maxIncomeExclusive: 101000 },
  // Grade 6
  { grade: 6, smrAmount: 104000, minIncomeInclusive: 101000, maxIncomeExclusive: 107000 },
  // Grade 7
  { grade: 7, smrAmount: 110000, minIncomeInclusive: 107000, maxIncomeExclusive: 114000 },
  // Grade 8
  { grade: 8, smrAmount: 118000, minIncomeInclusive: 114000, maxIncomeExclusive: 122000 },
  // Grade 9
  { grade: 9, smrAmount: 126000, minIncomeInclusive: 122000, maxIncomeExclusive: 130000 },
  // Grade 10
  { grade: 10, smrAmount: 134000, minIncomeInclusive: 130000, maxIncomeExclusive: 138000 },
  // Grade 11
  { grade: 11, smrAmount: 142000, minIncomeInclusive: 138000, maxIncomeExclusive: 146000 },
  // Grade 12
  { grade: 12, smrAmount: 150000, minIncomeInclusive: 146000, maxIncomeExclusive: 155000 },
  // Grade 13
  { grade: 13, smrAmount: 160000, minIncomeInclusive: 155000, maxIncomeExclusive: 165000 },
  // Grade 14
  { grade: 14, smrAmount: 170000, minIncomeInclusive: 165000, maxIncomeExclusive: 175000 },
  // Grade 15
  { grade: 15, smrAmount: 180000, minIncomeInclusive: 175000, maxIncomeExclusive: 185000 },
  // Grade 16
  { grade: 16, smrAmount: 190000, minIncomeInclusive: 185000, maxIncomeExclusive: 195000 },
  // Grade 17
  { grade: 17, smrAmount: 200000, minIncomeInclusive: 195000, maxIncomeExclusive: 210000 },
  // Grade 18
  { grade: 18, smrAmount: 220000, minIncomeInclusive: 210000, maxIncomeExclusive: 230000 },
  // Grade 19
  { grade: 19, smrAmount: 240000, minIncomeInclusive: 230000, maxIncomeExclusive: 250000 },
  // Grade 20
  { grade: 20, smrAmount: 260000, minIncomeInclusive: 250000, maxIncomeExclusive: 270000 },
  // Grade 21
  { grade: 21, smrAmount: 280000, minIncomeInclusive: 270000, maxIncomeExclusive: 290000 },
  // Grade 22
  { grade: 22, smrAmount: 300000, minIncomeInclusive: 290000, maxIncomeExclusive: 310000 },
  // Grade 23
  { grade: 23, smrAmount: 320000, minIncomeInclusive: 310000, maxIncomeExclusive: 330000 },
  // Grade 24
  { grade: 24, smrAmount: 340000, minIncomeInclusive: 330000, maxIncomeExclusive: 350000 },
  // Grade 25
  { grade: 25, smrAmount: 360000, minIncomeInclusive: 350000, maxIncomeExclusive: 370000 },
  // Grade 26
  { grade: 26, smrAmount: 380000, minIncomeInclusive: 370000, maxIncomeExclusive: 395000 },
  // Grade 27
  { grade: 27, smrAmount: 410000, minIncomeInclusive: 395000, maxIncomeExclusive: 425000 },
  // Grade 28
  { grade: 28, smrAmount: 440000, minIncomeInclusive: 425000, maxIncomeExclusive: 455000 },
  // Grade 29
  { grade: 29, smrAmount: 470000, minIncomeInclusive: 455000, maxIncomeExclusive: 485000 },
  // Grade 30
  { grade: 30, smrAmount: 500000, minIncomeInclusive: 485000, maxIncomeExclusive: 515000 },
  // Grade 31
  { grade: 31, smrAmount: 530000, minIncomeInclusive: 515000, maxIncomeExclusive: 545000 },
  // Grade 32
  { grade: 32, smrAmount: 560000, minIncomeInclusive: 545000, maxIncomeExclusive: 575000 },
  // Grade 33
  { grade: 33, smrAmount: 590000, minIncomeInclusive: 575000, maxIncomeExclusive: 605000 },
  // Grade 34
  { grade: 34, smrAmount: 620000, minIncomeInclusive: 605000, maxIncomeExclusive: 635000 },
  // Grade 35
  { grade: 35, smrAmount: 650000, minIncomeInclusive: 635000, maxIncomeExclusive: 665000 },
  // Grade 36
  { grade: 36, smrAmount: 680000, minIncomeInclusive: 665000, maxIncomeExclusive: 695000 },
  // Grade 37
  { grade: 37, smrAmount: 710000, minIncomeInclusive: 695000, maxIncomeExclusive: 730000 },
  // Grade 38
  { grade: 38, smrAmount: 750000, minIncomeInclusive: 730000, maxIncomeExclusive: 770000 },
  // Grade 39
  { grade: 39, smrAmount: 790000, minIncomeInclusive: 770000, maxIncomeExclusive: 810000 },
  // Grade 40
  { grade: 40, smrAmount: 830000, minIncomeInclusive: 810000, maxIncomeExclusive: 855000 },
  // Grade 41
  { grade: 41, smrAmount: 880000, minIncomeInclusive: 855000, maxIncomeExclusive: 905000 },
  // Grade 42
  { grade: 42, smrAmount: 930000, minIncomeInclusive: 905000, maxIncomeExclusive: 955000 },
  // Grade 43
  { grade: 43, smrAmount: 980000, minIncomeInclusive: 955000, maxIncomeExclusive: 1005000 },
  // Grade 44
  { grade: 44, smrAmount: 1030000, minIncomeInclusive: 1005000, maxIncomeExclusive: 1055000 },
  // Grade 45
  { grade: 45, smrAmount: 1090000, minIncomeInclusive: 1055000, maxIncomeExclusive: 1115000 },
  // Grade 46
  { grade: 46, smrAmount: 1150000, minIncomeInclusive: 1115000, maxIncomeExclusive: 1175000 },
  // Grade 47
  { grade: 47, smrAmount: 1210000, minIncomeInclusive: 1175000, maxIncomeExclusive: 1235000 },
  // Grade 48
  { grade: 48, smrAmount: 1270000, minIncomeInclusive: 1235000, maxIncomeExclusive: 1295000 },
  // Grade 49
  { grade: 49, smrAmount: 1330000, minIncomeInclusive: 1295000, maxIncomeExclusive: 1355000 },
  // Grade 50 (Maximum)
  { grade: 50, smrAmount: 1390000, minIncomeInclusive: 1355000, maxIncomeExclusive: Infinity },
];

/**
 * Utility function to find the SMR bracket for a given monthly income
 */
export function findSMRBracket(monthlyIncome: number): StandardMonthlyRemunerationBracket | undefined {
  return STANDARD_SMR_BRACKETS.find(bracket => 
    monthlyIncome >= bracket.minIncomeInclusive && monthlyIncome < bracket.maxIncomeExclusive
  );
}
