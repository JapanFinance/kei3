import type { FurusatoNozeiDetails, ResidenceTaxDetails } from "../types/tax";
import { calculateNationalIncomeTax } from "./taxCalculations";
import type { DependentDeductionResults } from "../types/dependents";
import { DEDUCTION_TYPES } from "../types/dependents";
import { calculateDependentTotalNetIncome, DEPENDENT_INCOME_THRESHOLDS } from './dependentDeductions';

/**
 * Calculates the basic deduction (基礎控除) for residence tax based on income
 * Source: https://www.machi-gr-blog.com/【住民税】給与所得控除・基礎控除の改正でどう変わる？/
 * - 430,000 yen for income up to 24,000,000 yen
 * - 290,000 yen for income between 24,000,001 and 24,500,000 yen
 * - 150,000 yen for income between 24,500,001 and 25,000,000 yen
 * - 0 yen for income above 25,000,000 yen
 */
export const calculateResidenceTaxBasicDeduction = (netIncome: number): number => {
    if (netIncome <= 24000000) {
        return 430000;
    } else if (netIncome <= 24500000) {
        return 290000;
    } else if (netIncome <= 25000000) {
        return 150000;
    } else {
        return 0;
    }
}

const RESIDENCE_TAX_RATE = 0.1;
const CITY_TAX_PROPORTION = 0.6;
const PREFECTURAL_TAX_PROPORTION = 0.4;

// 非課税制度 - 所得割・均等割とも非課税
export const NON_TAXABLE_RESIDENCE_TAX_DETAIL: ResidenceTaxDetails = {
    taxableIncome: 0, // 市町村民税の課税標準額
    cityProportion: CITY_TAX_PROPORTION,
    prefecturalProportion: PREFECTURAL_TAX_PROPORTION,
    residenceTaxRate: RESIDENCE_TAX_RATE,
    basicDeduction: 0,
    personalDeductionDifference: 0,
    city: {
        cityTaxableIncome: 0,
        cityAdjustmentCredit: 0,
        cityIncomeTax: 0,
        cityPerCapitaTax: 0,
    },
    prefecture: {
        prefecturalTaxableIncome: 0,
        prefecturalAdjustmentCredit: 0,
        prefecturalIncomeTax: 0,
        prefecturalPerCapitaTax: 0,
    },
    perCapitaTax: 0,
    forestEnvironmentTax: 0,
    totalResidenceTax: 0,
}

// Per capita tax breakdown
const cityPerCapitaTax = 3000; // Municipal per capita tax
const prefecturalPerCapitaTax = 1000;
const forestEnvironmentTax = 1000; // 森林環境税
const perCapitaTax = cityPerCapitaTax + prefecturalPerCapitaTax + forestEnvironmentTax;

/**
 * Calculates residence tax (住民税) based on net income and deductions
 * Rate: 10% (6% municipal tax + 4% prefectural tax) of taxable income
 * Taxable income = net income - social insurance deductions - residence tax basic deduction
 * The details vary by municipality, but most deviate little from this calculation.
 * https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju
 * 
 * @param netIncome - Net income
 * @param nonBasicDeductions - Social insurance + iDeCo deductions
 * @param dependentDeductions - Full dependent deduction results
 * @param taxCredit - Tax credit amount
 */
export const calculateResidenceTax = (
    netIncome: number,
    nonBasicDeductions: number,
    dependentDeductions: DependentDeductionResults,
    taxCredit: number = 0
): ResidenceTaxDetails => {
    const qualifiedDependentsCount = countQualifiedDependents(dependentDeductions);
    const { perCapitaLimit, incomeBasedLimit } = getResidenceTaxExemptionLimits(qualifiedDependentsCount);

    if (netIncome <= perCapitaLimit) {
        return NON_TAXABLE_RESIDENCE_TAX_DETAIL;
    }

    // If income is below Income Based Limit, Income portion is 0.
    if (netIncome <= incomeBasedLimit) {
         return {
            taxableIncome: 0,
            cityProportion: CITY_TAX_PROPORTION,
            prefecturalProportion: PREFECTURAL_TAX_PROPORTION,
            residenceTaxRate: RESIDENCE_TAX_RATE,
            basicDeduction: calculateResidenceTaxBasicDeduction(netIncome),
            personalDeductionDifference: 0,
            city: {
                cityTaxableIncome: 0,
                cityAdjustmentCredit: 0,
                cityIncomeTax: 0,
                cityPerCapitaTax,
            },
            prefecture: {
                prefecturalTaxableIncome: 0,
                prefecturalAdjustmentCredit: 0,
                prefecturalIncomeTax: 0,
                prefecturalPerCapitaTax,
            },
            perCapitaTax,
            forestEnvironmentTax,
            totalResidenceTax: perCapitaTax,
        };
    }

    const basicDeduction = calculateResidenceTaxBasicDeduction(netIncome);
    
    // Calculate taxable income using residence tax deductions
    const dependentDeductionsResidenceTaxTotal = dependentDeductions.residenceTax.total;
    const taxableIncome = Math.floor(Math.max(0, netIncome - nonBasicDeductions - basicDeduction - dependentDeductionsResidenceTaxTotal) / 1000) * 1000;

    const personalDeductionDifference = calculateStatutoryPersonalDeductionDifference(dependentDeductions, netIncome);

    // 調整控除額 (adjustment credit)
    const adjustmentCredit = calculateAdjustmentCredit(netIncome, taxableIncome, personalDeductionDifference);
    const cityAdjustmentCredit = adjustmentCredit * CITY_TAX_PROPORTION;
    const prefecturalAdjustmentCredit = adjustmentCredit * PREFECTURAL_TAX_PROPORTION;

    const cityIncomeTax = Math.floor(Math.max(0, (taxableIncome * 0.06) - cityAdjustmentCredit - (taxCredit * CITY_TAX_PROPORTION)) / 100) * 100;
    const prefecturalIncomeTax = Math.floor(Math.max(0, (taxableIncome * 0.04) - prefecturalAdjustmentCredit - (taxCredit * PREFECTURAL_TAX_PROPORTION)) / 100) * 100;
    
    return {
        taxableIncome,
        cityProportion: CITY_TAX_PROPORTION,
        prefecturalProportion: PREFECTURAL_TAX_PROPORTION,
        residenceTaxRate: RESIDENCE_TAX_RATE,
        basicDeduction,
        personalDeductionDifference,
        city: {
            cityTaxableIncome: taxableIncome * CITY_TAX_PROPORTION,
            cityAdjustmentCredit,
            cityIncomeTax,
            cityPerCapitaTax,
        },
        prefecture: {
            prefecturalTaxableIncome: taxableIncome * PREFECTURAL_TAX_PROPORTION,
            prefecturalAdjustmentCredit,
            prefecturalIncomeTax,
            prefecturalPerCapitaTax,
        },
        perCapitaTax,
        forestEnvironmentTax,
        totalResidenceTax: cityIncomeTax + prefecturalIncomeTax + perCapitaTax,
    };
}

/**
 * Counts the number of qualified dependents for residence tax non-taxable limit calculations.
 * Includes spouse and other dependents with total net income <= threshold.
 * Note: Includes dependents under 16.
 * 扶養親族は、年齢16歳未満の者及び地方税法第314条の2第1項第11号に規定する控除対象扶養親族に限ります。
 * @see https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju#gaiyo_06
 */
function countQualifiedDependents(dependentDeductions: DependentDeductionResults): number {
    const uniqueDependents = new Map();
    dependentDeductions.breakdown.forEach(b => {
        uniqueDependents.set(b.dependent.id, b.dependent);
    });
    
    let qualifiedDependentsCount = 0;
    uniqueDependents.forEach((dependent) => {
        const totalNetIncome = calculateDependentTotalNetIncome(dependent.income);
        if (totalNetIncome <= DEPENDENT_INCOME_THRESHOLDS.DEPENDENT_DEDUCTION_MAX) {
            qualifiedDependentsCount++;
        }
    });
    return qualifiedDependentsCount;
}

/**
 * Calculates the non-taxable limits for residence tax (Tokyo 23 wards standard).
 * 
 * There are two limits:
 * 1. Per Capita Exempt Limit (所得割・均等割とも非課税): Below this, no residence tax at all.
 * 2. Income Exempt Limit (所得割が非課税): Below this, no income-based residence tax but per capita residence tax applies.
 * 
 * @param qualifiedDependentsCount Number of {@link countQualifiedDependents qualified dependents}
 * @returns Object containing both net income limits
 * @see https://www.city.nerima.tokyo.jp/kurashi/zei/jyuminzei/hikazeikijun/juuminzei-hikazei.html
 */
function getResidenceTaxExemptionLimits(qualifiedDependentsCount: number): { perCapitaLimit: number, incomeBasedLimit: number } {
    if (qualifiedDependentsCount === 0) {
        return {
            perCapitaLimit: 450_000,
            incomeBasedLimit: 450_000
        };
    }

    // With dependents: 350,000 * (dependents + 1) + 100,000 + add-on
    // Note: (dependents + 1) accounts for the taxpayer themselves
    const baseAmount = 350_000 * (qualifiedDependentsCount + 1) + 100_000;
    
    return {
        perCapitaLimit: baseAmount + 210_000,
        incomeBasedLimit: baseAmount + 320_000
    };
}

/**
 * Statutory personal deduction difference amounts per Local Tax Act Article 314-6
 * These are used for the adjustment credit calculation (調整控除)
 * 
 * IMPORTANT: These are specific statutory amounts defined in law, NOT actual differences between national and residence tax deductions.
 * 
 * Reference: https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 */
const STATUTORY_DEDUCTION_DIFFERENCES = {
    // 扶養控除 (Dependent Deduction) (8) and (9) in the statutory table.
    DEPENDENT_GENERAL: 50_000, // General dependent (16-18, 23-69)
    DEPENDENT_SPECIAL: 180_000, // Special dependent (19-22)
    DEPENDENT_ELDERLY: 100_000, // Elderly dependent (70+)
    DEPENDENT_ELDERLY_COHABITING: 130_000, // Elderly cohabiting parent/grandparent (70+)
    
    // 障害者控除 (Disability Deduction) (1) and (2) in the statutory table.
    DISABILITY_REGULAR: 10_000, // Regular disability
    DISABILITY_SPECIAL: 100_000, // Special disability
    DISABILITY_SPECIAL_COHABITING: 220_000, // Special disability with cohabitation
} as const;

/**
 * Calculates the statutory personal deduction difference (人的控除額の差) per Local Tax Act Article 314-6
 * 
 * IMPORTANT: These are NOT the actual arithmetic differences between national and residence tax deductions.
 * They are specific statutory amounts defined in law for the adjustment credit calculation.
 * 
 * @param deductions - The dependent deduction results containing breakdown by deduction
 * @param taxpayerNetIncome - Taxpayer's total net income (納税義務者の前年の合計所得金額)
 * @returns The statutory personal deduction difference amount for adjustment credit calculation
 * @see https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 * @see https://www.town.hinode.tokyo.jp/0000000519.html
 */
function calculateStatutoryPersonalDeductionDifference(deductions: DependentDeductionResults, taxpayerNetIncome: number): number {
    let totalDifference = 0;

    if (taxpayerNetIncome <= 25_000_000) {
        totalDifference += 50_000;
    }
    
    // Calculate the statutory difference for each deduction in the breakdown
    for (const breakdown of deductions.breakdown) {
        const dep = breakdown.dependent;
        
        switch (breakdown.deductionType) {
            case DEDUCTION_TYPES.SPOUSE: {
                const isElderly = dep.ageCategory === '70plus';
                totalDifference += getSpouseDeductionDifference(isElderly, taxpayerNetIncome);
                break;
            }
                
            case DEDUCTION_TYPES.SPECIAL_DEPENDENT:
                // Special dependent (19-22)
                totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_SPECIAL;
                break;
                
            case DEDUCTION_TYPES.ELDERLY_DEPENDENT:
                // Elderly dependent (70+)
                if (dep.isCohabiting && (dep.relationship === 'parent' || dep.relationship === 'other')) {
                    totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_ELDERLY_COHABITING;
                } else {
                    totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_ELDERLY;
                }
                break;
                
            case DEDUCTION_TYPES.GENERAL_DEPENDENT:
                // General dependent (16-18, 23-69)
                totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_GENERAL;
                break;
                
            case DEDUCTION_TYPES.DISABILITY:
                totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_REGULAR;
                break;
                
            case DEDUCTION_TYPES.SPECIAL_DISABILITY:
                totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_SPECIAL;
                break;
                
            case DEDUCTION_TYPES.SPECIAL_DISABILITY_COHABITING:
                totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_SPECIAL_COHABITING;
                break;
                
            /*
              Spouse Special Deduction contributes no statutory difference because of a quirk in the statute.
              The income ranges for qualifying for Spouse Special Deduction (>580,000 yen) are mutually exclusive
              with the ranges where statutory differences are defined (<550,000 yen) in Article 314-6(7) of the Local Tax Act.
              
              The Specific Relative Special Deduction has no statutory difference defined in the law.
              The relevant statute was not updated when the Specific Relative Special Deduction was introduced.

              Therefore, no statutory personal difference is added for the Spouse Special Deduction or Specific Relative Special Deduction.
            */
            case DEDUCTION_TYPES.SPOUSE_SPECIAL:
            case DEDUCTION_TYPES.SPECIFIC_RELATIVE_SPECIAL:
            case DEDUCTION_TYPES.NOT_ELIGIBLE:
            default:
                // No statutory difference
                break;
        }
    }
    
    return totalDifference;
}

/**
 * Get statutory difference for spouse deduction based on taxpayer's income
 * Per Local Tax Act Article 314-6(6), varies by taxpayer income.
 * 
 * Note: Spouse special deduction has NO statutory difference because the income ranges
 * for qualifying for spouse special deduction (>58万円) are mutually exclusive with
 * the ranges where statutory differences are defined (<55万円) in Article 314-6(7).
 * 
 * Reference: 地方税法第314条の6第6号 (6) in the statutory table.
 * Reference: https://www.town.hinode.tokyo.jp/0000000519.html
 * 
 * @param isElderly - Whether spouse is 70+ years old
 * @param taxpayerNetIncome - Taxpayer's net income (納税義務者の前年の合計所得金額)
 * @returns Statutory deduction difference amount
 */
function getSpouseDeductionDifference(isElderly: boolean, taxpayerNetIncome: number): number {
    if (taxpayerNetIncome <= 9_000_000) {
        return isElderly ? 100_000 : 50_000;
    } else if (taxpayerNetIncome <= 9_500_000) {
        return isElderly ? 60_000 : 40_000;
    } else if (taxpayerNetIncome <= 10_000_000) {
        return isElderly ? 30_000 : 20_000;
    }
    return 0;
}

/**
 * 調整控除額 (adjustment credit)
 * For taxable income of 2M or less: min(personal deduction difference x 5%, taxable income x 5%)
 * For taxable income over 2M: max({personal deduction difference - (taxable income - 2M)} x 5%, personal deduction difference x 5%)
 * No adjustment credit if net income exceeds 25M yen
 * @param netIncome 
 * @param taxableIncome 
 * @param personalDeductionDifference 
 * @returns adjustment credit amount
 * @see https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 * @see https://www.town.hinode.tokyo.jp/0000000519.html
 */
function calculateAdjustmentCredit(netIncome: number, taxableIncome: number, personalDeductionDifference: number): number {
    let adjustmentCredit = 0;
    if (netIncome > 25000000) {
        adjustmentCredit = 0;
    } else if (taxableIncome <= 2000000) {
        adjustmentCredit = Math.min(personalDeductionDifference * 0.05, taxableIncome * 0.05);
    } else {
        adjustmentCredit = Math.max((personalDeductionDifference - (taxableIncome - 2000000)) * 0.05, personalDeductionDifference * 0.05);
    }
    return adjustmentCredit;
}

// ふるさと納税の自己負担額
const FURUSATO_OUT_OF_POCKET_COST = 2000;
// 基本控除率 (ふるさと納税の寄付金控除の基本控除率)
const donationBasicDeductionRate = 0.1;

/**
 * Calculate the maximum deductible ふるさと納税 (Furusato Nozei) donation limit for which the user's out-of-pocket cost is ~2,000 yen.
 *
 * @param taxableIncomeForNationalIncomeTax - Taxable income for national income tax, before rounding (所得税課税所得)
 * @param residenceTaxDetails - Details of the residence tax, including taxable income and rates
 * @returns The various details of the Furusato Nozei deduction, including the limit, out-of-pocket cost, and tax reductions.
 * @see https://kaikei7.com/furusato_nouzei_keisan/
 * @see https://kaikei7.com/furusato_nouzei_onestop/
 */
export function calculateFurusatoNozeiDetails(
    taxableIncomeForNationalIncomeTax: number,
    residenceTaxDetails: ResidenceTaxDetails
): FurusatoNozeiDetails {
    if (taxableIncomeForNationalIncomeTax <= 0 || residenceTaxDetails.taxableIncome <= 0) {
        return {
            limit: 0,
            incomeTaxReduction: 0,
            residenceTaxDonationBasicDeduction: 0,
            residenceTaxSpecialDeduction: 0,
            outOfPocketCost: 0,
            residenceTaxReduction: 0
        };
    }
    // 調整控除後 所得割
    const residentTaxAmountForIncomePortion = residenceTaxDetails.totalResidenceTax - residenceTaxDetails.perCapitaTax;

    // Special deduction rate for resident tax (特例控除割合)
    const specialDeductionRate = getSpecialDeductionMultiplier(residenceTaxDetails.taxableIncome - residenceTaxDetails.personalDeductionDifference);

    // The deduction breakdown:
    // Income tax deduction: (X - 2000) * incomeTaxRate (not used if one-stop)
    // Resident tax basic deduction (基本控除): (X - 2000) * residenceTaxRate
    // Resident tax special deduction (特例控除): (X - 2000) * (1 - residenceTaxRate - marginalIncomeTaxRate) [capped at 20% of resident tax amount for the income portion]
    // One-stop special deduction (申告特例控除): 

    // We need to find X such that:
    // (X - 2000) * specialDeductionRate <= residentTaxAmountForIncomePortion * 0.2
    const maxSpecialDeduction = residentTaxAmountForIncomePortion * 0.2;
    const furusatoNozeiLimit = maxSpecialDeduction / specialDeductionRate + FURUSATO_OUT_OF_POCKET_COST;

    // Statutory cap: donation cannot exceed 30% of resident tax taxable income
    // This will always be higher than the 20% cap for the special deduction
    const statutoryCap = residenceTaxDetails.taxableIncome * 0.3;

    // Final limit is the lower of the two, rounded down to the nearest 1,000 yen
    const finalLimit = Math.floor(Math.min(furusatoNozeiLimit, statutoryCap) / 1000) * 1000;
    const deductibleDonation = Math.max(finalLimit - FURUSATO_OUT_OF_POCKET_COST, 0);
    // const incomeTaxReduction = deductibleDonation * (1 - specialDeductionRate - donationBasicDeductionRate);
    const incomeTaxReduction = calculateIncomeTaxReduction(taxableIncomeForNationalIncomeTax, deductibleDonation);
    const residenceTaxDonationBasicDeduction = deductibleDonation * donationBasicDeductionRate;
    let residenceTaxSpecialDeduction = deductibleDonation * specialDeductionRate;
    residenceTaxSpecialDeduction = Math.ceil(residenceTaxSpecialDeduction * residenceTaxDetails.cityProportion) + Math.ceil(residenceTaxSpecialDeduction * residenceTaxDetails.prefecturalProportion);

    const furusatoNozeiTaxCredit = residenceTaxDonationBasicDeduction + residenceTaxSpecialDeduction;
    const beforeCityIncomeTax = residenceTaxDetails.city.cityTaxableIncome * residenceTaxDetails.residenceTaxRate - residenceTaxDetails.city.cityAdjustmentCredit;
    const cityIncomeTaxWithFurusato = Math.floor((beforeCityIncomeTax - Math.ceil(furusatoNozeiTaxCredit * residenceTaxDetails.cityProportion)) / 100) * 100;
    const beforePrefectureIncomeTax = residenceTaxDetails.prefecture.prefecturalTaxableIncome * residenceTaxDetails.residenceTaxRate - residenceTaxDetails.prefecture.prefecturalAdjustmentCredit;
    const prefectureIncomeTaxWithFurusato = Math.floor((beforePrefectureIncomeTax - Math.ceil(furusatoNozeiTaxCredit * residenceTaxDetails.prefecturalProportion)) / 100) * 100;
    const residenceTaxDifference = (residenceTaxDetails.totalResidenceTax) - (cityIncomeTaxWithFurusato + prefectureIncomeTaxWithFurusato + residenceTaxDetails.perCapitaTax);

    return {
        limit: finalLimit,
        incomeTaxReduction,
        residenceTaxDonationBasicDeduction,
        residenceTaxSpecialDeduction,
        residenceTaxReduction: residenceTaxDifference,
        outOfPocketCost: finalLimit - residenceTaxDifference - incomeTaxReduction
    };
}

function calculateIncomeTaxReduction(taxableIncome: number, furusatoNozeiDeduction: number): number {
    const incomeTaxBefore = calculateNationalIncomeTax(Math.floor(taxableIncome / 1000) * 1000);
    const incomeTaxAfter = calculateNationalIncomeTax(Math.floor((taxableIncome - furusatoNozeiDeduction) / 1000) * 1000);

    return incomeTaxBefore - incomeTaxAfter;
}

/**
 * 
 * @param taxableIncome taxable income for residence tax minus the personal deduction difference (住民税の課税総所得金額 - 人的控除差調整額)
 * @returns 特例控除割合
 * @see 地方税法第37条の二
 */
function getSpecialDeductionMultiplier(taxableIncome: number): number {
    let incomeTaxRate = 0;
    if (taxableIncome <= 1950000) incomeTaxRate = 0.05;
    else if (taxableIncome <= 3300000) incomeTaxRate = 0.10;
    else if (taxableIncome <= 6950000) incomeTaxRate = 0.20;
    else if (taxableIncome <= 9000000) incomeTaxRate = 0.23;
    else if (taxableIncome <= 18000000) incomeTaxRate = 0.33;
    else if (taxableIncome <= 40000000) incomeTaxRate = 0.40;
    else incomeTaxRate = 0.45; // Over 40 million

    incomeTaxRate *= 1.021; // Add 2.1% surtax

    return 1 - donationBasicDeductionRate - incomeTaxRate;
}
