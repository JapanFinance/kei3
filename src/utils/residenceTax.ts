import type { FurusatoNozeiDetails, ResidenceTaxDetails } from "../types/tax";
import { calculateNationalIncomeTax } from "./taxCalculations";
import type { DependentDeductionResults } from "./dependentDeductions";

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

// 非課税制度
export const NON_TAXABLE_RESIDENCE_TAX_DETAIL: ResidenceTaxDetails = {
    taxableIncome: 0, // 市町村民税の課税標準額
    cityProportion: 0.6,
    prefecturalProportion: 0.4,
    residenceTaxRate: 0.1,
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

/**
 * Statutory personal deduction difference amounts per Local Tax Act Article 314-6
 * These are used for the adjustment credit calculation (調整控除)
 * 
 * IMPORTANT: These are specific statutory amounts defined in law, NOT arithmetic differences.
 * 
 * Reference: https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 */
const STATUTORY_DEDUCTION_DIFFERENCES = {
    // 扶養控除 (Dependent Deduction)
    DEPENDENT_GENERAL: 50_000, // General dependent (16-18, 23-69)
    DEPENDENT_SPECIAL: 180_000, // Special dependent (19-22)
    DEPENDENT_ELDERLY: 100_000, // Elderly dependent (70+)
    DEPENDENT_ELDERLY_COHABITING: 130_000, // Elderly cohabiting parent/grandparent (70+)
    
    // 障害者控除 (Disability Deduction)
    DISABILITY_REGULAR: 10_000, // Regular disability
    DISABILITY_SPECIAL: 100_000, // Special disability
    DISABILITY_SPECIAL_COHABITING: 220_000, // Special disability with cohabitation
} as const;

/**
 * Get statutory difference for spouse deduction based on taxpayer's income
 * Per Local Tax Act Article 314-6(6), varies by taxpayer income.
 * 
 * Note: Spouse special deduction has NO statutory difference because the income ranges
 * for qualifying for spouse special deduction (>58万円) are mutually exclusive with
 * the ranges where statutory differences are defined (<55万円) in Article 314-6(7).
 * 
 * Reference: 地方税法第314条の6第6号
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
 * Calculates the statutory personal deduction difference (人的控除額の差) per Local Tax Act Article 314-6
 * 
 * IMPORTANT: These are NOT the actual arithmetic differences between national and residence tax deductions.
 * They are specific statutory amounts defined in law for the adjustment credit calculation.
 * 
 * Reference: https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
 * Reference: https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/pdf/R03chouseikoujo01.pdf
 * 
 * @param deductions - The dependent deduction results containing breakdown by dependent
 * @returns The statutory personal deduction difference amount for adjustment credit calculation
 */
function calculateStatutoryPersonalDeductionDifference(deductions: DependentDeductionResults, taxpayerNetIncome: number): number {
    let totalDifference = 0;
    
    // Calculate the statutory difference for each dependent based on their specific characteristics
    for (const breakdown of deductions.breakdown) {
        const dep = breakdown.dependent;
        
        // Spouse deductions
        if (dep.relationship === 'spouse') {
            // Only spouse deduction (配偶者控除) has statutory difference
            // Spouse special deduction (配偶者特別控除) has NO statutory difference because:
            // - Spouse special deduction requires spouse income > 58万円
            // - Statutory differences only defined for spouse income < 55万円
            // These ranges are mutually exclusive per Article 314-6(7)
            if (breakdown.deductionType === 'Spouse Deduction') {
                const isElderly = dep.ageCategory === '70plus';
                totalDifference += getSpouseDeductionDifference(isElderly, taxpayerNetIncome);
            }
            // Spouse special deduction: statutory difference is 0 (not defined in law)
        } 
        // Other dependent deductions
        else {
            // For specific relative special deduction, no statutory difference is defined in the law
            // So we use the standard dependent deduction differences
            if (dep.ageCategory === '19to22') {
                // Special dependent (19-22)
                totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_SPECIAL;
            } else if (dep.ageCategory === '70plus') {
                // Elderly dependent
                if (dep.isCohabiting && (dep.relationship === 'parent' || dep.relationship === 'other')) {
                    totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_ELDERLY_COHABITING;
                } else {
                    totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_ELDERLY;
                }
            } else if (dep.ageCategory === '16to18' || dep.ageCategory === '23to69') {
                // General dependent (16-18, 23-69)
                totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DEPENDENT_GENERAL;
            }
        }
        
        // Disability deductions (apply in addition to other deductions)
        if (dep.disability === 'special' && dep.isCohabiting) {
            totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_SPECIAL_COHABITING;
        } else if (dep.disability === 'special') {
            totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_SPECIAL;
        } else if (dep.disability === 'regular') {
            totalDifference += STATUTORY_DEDUCTION_DIFFERENCES.DISABILITY_REGULAR;
        }
    }
    
    return totalDifference;
}

/**
 * Calculates residence tax (住民税) based on net income and deductions
 * Rate: 10% (6% municipal tax + 4% prefectural tax) of taxable income
 * Taxable income = net income - social insurance deductions - residence tax basic deduction
 * The details vary by municipality, but most deviate little from this calculation.
 * https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju
 * 
 * @param netIncome - Net income after employment income deduction (used for both taxable income calculation and taxpayer income for statutory differences)
 * @param nonBasicDeductions - Social insurance + iDeCo deductions
 * @param dependentDeductions - Full dependent deduction results (used for adjustment credit calculation per Local Tax Act Article 314-6)
 * @param taxCredit - Tax credit amount
 */
export const calculateResidenceTax = (
    netIncome: number,
    nonBasicDeductions: number,
    dependentDeductions: DependentDeductionResults | null = null,
    taxCredit: number = 0
): ResidenceTaxDetails => {
    if (netIncome <= 450_000) {
        return NON_TAXABLE_RESIDENCE_TAX_DETAIL;
    }
    const residenceTaxRate = 0.1;
    const cityProportion = 0.6;
    const prefecturalProportion = 0.4;
    const basicDeduction = calculateResidenceTaxBasicDeduction(netIncome);
    
    // Calculate taxable income using residence tax deductions
    const dependentDeductionsResidenceTaxTotal = dependentDeductions?.residenceTax.total || 0;
    const taxableIncome = Math.floor(Math.max(0, netIncome - nonBasicDeductions - basicDeduction - dependentDeductionsResidenceTaxTotal) / 1000) * 1000;

    // 人的控除額調整控除 (personal deduction adjustment credit)
    // Per Local Tax Act Article 314-6, the "personal deduction difference" (人的控除額の差) 
    // uses specific statutory amounts defined by law, NOT actual arithmetic differences
    // Source: https://laws.e-gov.go.jp/law/325AC0000000226#Mp-Ch_3-Se_1-Ss_2-At_314_6
    
    // Basic deduction difference per Article 314-6:
    // Fixed at 50,000 yen for taxpayers with combined net income ≤ 25M yen
    // (i.e., anyone who qualifies for any amount of basic deduction)
    // 「五万円に、当該納税義務者が次の表の上欄に掲げる者に該当する場合には...」
    let basicDeductionDifference = 0;
    if (netIncome <= 25_000_000) {
        basicDeductionDifference = 50_000;
    }
    
    // Dependent-related deduction differences use statutory amounts from Article 314-6 table
    // These are NOT the actual arithmetic differences but legally defined amounts for adjustment credit
    const dependentDeductionsDifference = dependentDeductions 
        ? calculateStatutoryPersonalDeductionDifference(dependentDeductions, netIncome)
        : 0;
    
    // Total personal deduction difference per law
    const personalDeductionDifference = basicDeductionDifference + dependentDeductionsDifference;

    // 調整控除額 (adjustment credit)
    // For taxable income of 2M or less: min(personal deduction difference x 5%, taxable income x 5%)
    // For taxable income over 2M: max({personal deduction difference - (taxable income - 2M)} x 5%, personal deduction difference x 5%)
    // No adjustment credit if net income exceeds 25M yen
    let adjustmentCredit = 0;
    if (netIncome > 25_000_000) {
        adjustmentCredit = 0;
    } else if (taxableIncome <= 2_000_000) {
        adjustmentCredit = Math.min(personalDeductionDifference * 0.05, taxableIncome * 0.05);
    } else {
        adjustmentCredit = Math.max((personalDeductionDifference - (taxableIncome - 2_000_000)) * 0.05, personalDeductionDifference * 0.05);
    }
    const cityAdjustmentCredit = adjustmentCredit * cityProportion;
    const prefecturalAdjustmentCredit = adjustmentCredit * prefecturalProportion;

    const cityIncomeTax = Math.floor(((taxableIncome * 0.06) - cityAdjustmentCredit - (taxCredit * cityProportion)) / 100) * 100;
    const prefecturalIncomeTax = Math.floor(((taxableIncome * 0.04) - prefecturalAdjustmentCredit - (taxCredit * prefecturalProportion)) / 100) * 100;
    
    // Per capita tax breakdown
    const cityPerCapitaTax = 3000; // Municipal per capita tax
    const prefecturalPerCapitaTax = 1000; // Prefectural per capita tax  
    const forestEnvironmentTax = 1000; // Forest environment tax (森林環境税)
    const perCapitaTax = cityPerCapitaTax + prefecturalPerCapitaTax + forestEnvironmentTax; // Total per capita tax

    return {
        taxableIncome,
        cityProportion,
        prefecturalProportion,
        residenceTaxRate,
        basicDeduction,
        personalDeductionDifference,
        city: {
            cityTaxableIncome: taxableIncome * cityProportion,
            cityAdjustmentCredit,
            cityIncomeTax,
            cityPerCapitaTax,
        },
        prefecture: {
            prefecturalTaxableIncome: taxableIncome * prefecturalProportion,
            prefecturalAdjustmentCredit,
            prefecturalIncomeTax,
            prefecturalPerCapitaTax,
        },
        perCapitaTax,
        forestEnvironmentTax,
        totalResidenceTax: cityIncomeTax + prefecturalIncomeTax + perCapitaTax,
    };
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
 * @param taxableIncome taxable income for residence tax (住民税の課税総所得金額)
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
