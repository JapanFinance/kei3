import type { FurusatoNozeiDetails, ResidenceTaxDetails } from "../types/tax";
import { calculateNationalIncomeTax } from "./taxCalculations";

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

// 人的控除額調整控除 - 50,000 yen for the basic deduction; should be updated if other deductions are added to the calculator
const personalDeductionDifference = 50_000;

/**
 * Calculates residence tax (住民税) based on net income and deductions
 * Rate: 10% (6% municipal tax + 4% prefectural tax) of taxable income
 * Taxable income = net income - social insurance deductions - residence tax basic deduction
 * The details vary by municipality, but most deviate little from this calculation.
 * https://www.tax.metro.tokyo.lg.jp/kazei/life/kojin_ju
 */
export const calculateResidenceTax = (
    netIncome: number,
    nonBasicDeductions: number,
    dependentDeductionsTotal: number = 0,
    taxCredit: number = 0
): ResidenceTaxDetails => {
    if (netIncome <= 450_000) {
        return NON_TAXABLE_RESIDENCE_TAX_DETAIL;
    }
    const residenceTaxRate = 0.1;
    const cityProportion = 0.6;
    const prefecturalProportion = 0.4;
    const basicDeduction = calculateResidenceTaxBasicDeduction(netIncome);
    const taxableIncome = Math.floor(Math.max(0, netIncome - nonBasicDeductions - basicDeduction - dependentDeductionsTotal) / 1000) * 1000;

    // 調整控除額
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
    const specialDeductionRate = getSpecialDeductionMultiplier(residenceTaxDetails.taxableIncome - personalDeductionDifference);

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
