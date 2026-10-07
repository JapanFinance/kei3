// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import {
  getHighIncomeMinimumTaxParams,
  HIGH_INCOME_MINIMUM_TAX_PERIODS,
} from '../data/highIncomeMinimumTax';
import { percentTo } from '../data/premiumRate';
import { DEFAULT_PROVIDER } from '../types/healthInsurance';
import {
  EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  EMPTY_PERSONAL_CIRCUMSTANCES,
  type TakeHomeInputs,
} from '../types/tax';
import { calculateHighIncomeMinimumTax } from '../utils/highIncomeMinimumTax';
import { calculateTaxes } from '../utils/taxCalculations';

const createBaseInputs = (overrides: Partial<TakeHomeInputs> = {}): TakeHomeInputs => ({
  ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
  personalCircumstances: EMPTY_PERSONAL_CIRCUMSTANCES,
  incomeStreams: [],
  ageRange: 'age40to59',
  region: 'Tokyo',
  healthInsuranceProvider: DEFAULT_PROVIDER,
  dependents: [],
  dcPlanContributions: 0,
  manualSocialInsuranceEntry: false,
  manualSocialInsuranceAmount: 0,
  incomeYear: 2025,
  ...overrides,
});

describe('High Income Minimum Tax Parameters (getHighIncomeMinimumTaxParams)', () => {
  it('returns undefined for tax years prior to 2025', () => {
    expect(getHighIncomeMinimumTaxParams(2020)).toBeUndefined();
    expect(getHighIncomeMinimumTaxParams(2023)).toBeUndefined();
    expect(getHighIncomeMinimumTaxParams(2024)).toBeUndefined();
  });

  it('returns 2025 statutory parameters (¥330M deduction, 22.5% rate) for 2025 and 2026', () => {
    const params2025 = getHighIncomeMinimumTaxParams(2025);
    expect(params2025).toBeDefined();
    expect(params2025?.effectiveYear).toBe(2025);
    expect(params2025?.threshold).toBe(330_000_000);
    expect(params2025?.rate.equals(percentTo(1)(22.5))).toBe(true);
    expect(params2025?.rate.toPercent(1)).toBe('22.5%');

    const params2026 = getHighIncomeMinimumTaxParams(2026);
    expect(params2026).toEqual(params2025);
  });

  it('returns 2027 statutory parameters (¥165M deduction, 30.0% rate) for 2027 and onward', () => {
    const params2027 = getHighIncomeMinimumTaxParams(2027);
    expect(params2027).toBeDefined();
    expect(params2027?.effectiveYear).toBe(2027);
    expect(params2027?.threshold).toBe(165_000_000);
    expect(params2027?.rate.equals(percentTo(1)(30))).toBe(true);
    expect(params2027?.rate.toPercent(1)).toBe('30.0%');

    const params2028 = getHighIncomeMinimumTaxParams(2028);
    expect(params2028).toEqual(params2027);
  });

  it('maintains periods sorted newest-first', () => {
    for (let i = 1; i < HIGH_INCOME_MINIMUM_TAX_PERIODS.length; i++) {
      expect(HIGH_INCOME_MINIMUM_TAX_PERIODS[i - 1]!.effectiveYear).toBeGreaterThan(
        HIGH_INCOME_MINIMUM_TAX_PERIODS[i]!.effectiveYear,
      );
    }
  });
});

describe('calculateHighIncomeMinimumTax (Statutory Formula)', () => {
  // Official NTA example from Form tokutei.pdf:
  // Baseline income (⑬): ¥1,053,000,000 (Real estate net ¥3M + Dividends ¥1,050M)
  // Threshold: ¥330,000,000
  // ⑭ = 723,000,000
  // ⑮ = 162,675,000
  // ⑳ = 157,672,500
  // ㉑ = 3,311,122
  // ㉒ = 160,983,622
  // ㉓ = 162,675,000 - 160,983,622 = 1,691,378
  it('exactly reproduces the official NTA example from Form tokutei.pdf', () => {
    const result = calculateHighIncomeMinimumTax({
      baselineIncome: 1_053_000_000,
      incomeYear: 2025,
      baseIncomeTaxAll: 157_672_500,
      normalBaselineTax: 160_983_622,
    });

    expect(result).toBeDefined();
    expect(result?.baselineIncome).toBe(1_053_000_000);
    expect(result?.threshold).toBe(330_000_000);
    expect(result?.taxableExcess).toBe(723_000_000); // ⑭
    expect(result?.rate.equals(percentTo(1)(22.5))).toBe(true);
    expect(result?.taxOnExcess).toBe(162_675_000); // ⑮
    expect(result?.baselineIncomeTax).toBe(160_983_622); // ㉒
    expect(result?.additionalIncomeTax).toBe(1_691_378); // ㉓
    expect(result?.additionalReconstructionSurtax).toBe(35_518);
    expect(result?.totalAdditionalTax).toBe(1_726_896);
  });

  it('returns undefined when baseline income is at or below the statutory threshold', () => {
    expect(
      calculateHighIncomeMinimumTax({
        baselineIncome: 330_000_000,
        incomeYear: 2025,
        baseIncomeTaxAll: 40_000_000,
        normalBaselineTax: 40_840_000,
      }),
    ).toBeUndefined();

    expect(
      calculateHighIncomeMinimumTax({
        baselineIncome: 200_000_000,
        incomeYear: 2025,
        baseIncomeTaxAll: 20_000_000,
        normalBaselineTax: 20_420_000,
      }),
    ).toBeUndefined();
  });

  it('returns undefined when tax on excess does not exceed baseline income tax', () => {
    // 500M salary income: base income tax under progressive brackets is ~210M, far exceeding 22.5% of (500M - 330M)
    const baselineIncome = 500_000_000;
    const taxableExcess = baselineIncome - 330_000_000; // 170M
    const taxOnExcess = taxableExcess * 0.225; // 38.25M
    const baseIncomeTaxAll = 210_000_000;
    const normalBaselineTax = Math.floor(baseIncomeTaxAll * 1.021);
    expect(taxOnExcess).toBeLessThan(normalBaselineTax);

    expect(
      calculateHighIncomeMinimumTax({
        baselineIncome,
        incomeYear: 2025,
        baseIncomeTaxAll,
        normalBaselineTax,
      }),
    ).toBeUndefined();
  });

  it('applies 2027 parameters (¥165M threshold, 30% rate)', () => {
    // Baseline income ¥400,000,000 from separate investment in 2027
    // Excess = 400M - 165M = 235M
    // Tax on excess = 235M * 30% = 70.5M
    // Normal tax = 400M * 15% = 60M; baseIncomeTax = 60M
    // Baseline income tax with surtax = 60M + 1.26M = 61.26M
    // Additional income tax = 70.5M - 61.26M = 9.24M
    const result = calculateHighIncomeMinimumTax({
      baselineIncome: 400_000_000,
      incomeYear: 2027,
      baseIncomeTaxAll: 60_000_000,
      normalBaselineTax: 61_260_000,
    });

    expect(result).toBeDefined();
    expect(result?.threshold).toBe(165_000_000);
    expect(result?.taxableExcess).toBe(235_000_000);
    expect(result?.rate.equals(percentTo(1)(30))).toBe(true);
    expect(result?.taxOnExcess).toBe(70_500_000);
    expect(result?.baselineIncomeTax).toBe(61_260_000);
    expect(result?.additionalIncomeTax).toBe(9_240_000);
  });
});

describe('calculateTaxes End-to-End Integration with High Income Minimum Tax', () => {
  it('accurately reproduces all fields of the NTA tokutei.pdf example', () => {
    const inputs = createBaseInputs({
      incomeStreams: [
        {
          id: 'real-estate',
          type: 'business',
          amount: 3_000_000,
          blueFilerDeduction: 0,
        },
        {
          id: 'dividends',
          type: 'dividends',
          amount: 1_050_000_000,
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: true,
          issuerDomicile: 'domestic',
          foreignTax: 0,
        },
      ],
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 300_000,
      incomeYear: 2025,
    });

    const results = calculateTaxes(inputs);

    // Minimum tax breakdown
    expect(results.highIncomeMinimumTax).toBeDefined();
    expect(results.highIncomeMinimumTax?.baselineIncome).toBe(1_053_000_000);
    expect(results.highIncomeMinimumTax?.threshold).toBe(330_000_000);
    expect(results.highIncomeMinimumTax?.taxableExcess).toBe(723_000_000);
    expect(results.highIncomeMinimumTax?.taxOnExcess).toBe(162_675_000);
    expect(results.highIncomeMinimumTax?.additionalIncomeTax).toBe(1_691_378);

    // Return box ㊺ (Reconstruction Surtax) = ⌊(157,672,500 + 1,691,378) × 2.1%⌋ = 3,346,641
    expect(results.reconstructionSurtax).toBe(3_346_641);

    // Return box ㊻ (Total income tax before credits) floored to ¥100:
    // 159,363,878 + 3,346,641 = 162,710,519 -> 162,710,500
    expect(results.nationalIncomeTax).toBe(162_710_500);
  });

  it('automatically disallows 確定申告不要制度 and produces identical tax when dividends are left to withholding', () => {
    const baseWithheldInputs = createBaseInputs({
      incomeStreams: [
        {
          id: 'real-estate',
          type: 'business',
          amount: 3_000_000,
          blueFilerDeduction: 0,
        },
        {
          id: 'withholding-account',
          type: 'withholdingAccount',
          capitalGains: 0,
          dividends: 1_050_000_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false, // Withheld only
        },
      ],
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 300_000,
      incomeYear: 2025,
    });

    const reportedInputs = createBaseInputs({
      ...baseWithheldInputs,
      incomeStreams: [
        baseWithheldInputs.incomeStreams[0]!,
        {
          id: 'withholding-account',
          type: 'withholdingAccount',
          capitalGains: 0,
          dividends: 1_050_000_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: true,
          reportsDividends: true, // Explicitly reported
        },
      ],
    });

    const withheldResults = calculateTaxes(baseWithheldInputs);
    const reportedResults = calculateTaxes(reportedInputs);

    // Both should trigger the minimum tax
    expect(withheldResults.highIncomeMinimumTax).toBeDefined();
    expect(reportedResults.highIncomeMinimumTax).toBeDefined();

    // The calculated taxes and take-home income must be identical
    expect(withheldResults.nationalIncomeTax).toBe(reportedResults.nationalIncomeTax);
    expect(withheldResults.reconstructionSurtax).toBe(reportedResults.reconstructionSurtax);
    expect(withheldResults.residenceTax.totalResidenceTax).toBe(
      reportedResults.residenceTax.totalResidenceTax,
    );
    expect(withheldResults.takeHomeIncome).toBe(reportedResults.takeHomeIncome);
  });

  it('honors 措法通達41の19-2 when box ⑱ < box ⑮ ≤ box ㉒: does not apply minimum tax and preserves 確定申告不要制度', () => {
    // Edge case:
    // Business income: ¥3,000,000 (net) with ¥300,000 social insurance.
    // Dividends: ¥1,025,800,000 in a withholding account.
    // Under normal filing with dividends withheld (確定申告不要):
    //   - 基礎控除 (¥480,000) applies because reported income is only ¥3,000,000.
    //   - Taxable business income: 3M - 300k - 480k = 2.22M.
    //   - Business income tax + surtax = 124,500 + 2,614 = 127,114.
    //   - Dividend withholding tax @ 15.315% = 157,101,270.
    //   - Box ⑱ (normalBaselineTax) = 127,114 + 157,101,270 = 157,228,384.
    // Target minimum tax:
    //   - Baseline income (⑬): 3M + 1,025.8M = 1,028.8M.
    //   - Excess (⑭): 1,028.8M - 330M = 698.8M.
    //   - Box ⑮ (target tax @ 22.5%): 698.8M * 22.5% = 157,230,000.
    // Notice: Box ⑮ (157,230,000) > Box ⑱ (157,228,384). So Box ⑲ is positive (+1,616).
    // However, if all income is reported:
    //   - 合計所得金額 exceeds ¥25,000,000, so 基礎控除 is lost (¥0).
    //   - Taxable business income: 3M - 300k = 2.7M.
    //   - Business income tax: 172,500.
    //   - Dividend income tax @ 15%: 153,870,000.
    //   - Box ⑳ = 172,500 + 153,870,000 = 154,042,500.
    //   - Box ㉑ = ⑳ * 2.1% = 3,234,892.
    //   - Box ㉒ = ⑳ + ㉑ = 157,277,392.
    //   - Box ㉓ (⑮ - ㉒) = 157,230,000 - 157,277,392 = -47,392 (NEGATIVE).
    // Under 措法通達41の19-2 (https://www.nta.go.jp/law/tsutatsu/kobetsu/shotoku/sochiho/801226/sinkoku/57/41/20.htm)
    // and Form 01.pdf 記載要領2, the minimum tax DOES NOT APPLY, and the taxpayer is allowed to keep
    // 確定申告不要制度 and their 基礎控除.
    const inputs = createBaseInputs({
      incomeStreams: [
        {
          id: 'real-estate',
          type: 'business',
          amount: 3_000_000,
          blueFilerDeduction: 0,
        },
        {
          id: 'withholding-account',
          type: 'withholdingAccount',
          capitalGains: 0,
          dividends: 1_025_800_000,
          foreignDividends: 0,
          foreignTax: 0,
          reportsCapitalGains: false,
          reportsDividends: false, // Withheld only
        },
      ],
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 300_000,
      incomeYear: 2025,
    });

    const results = calculateTaxes(inputs);

    // Minimum tax must NOT apply
    expect(results.highIncomeMinimumTax).toBeUndefined();

    // The basic deduction must be preserved because dividends were kept to withholding
    expect(results.nationalIncomeTaxBasicDeduction).toBe(880_000);

    // Withheld investment tax reflects the dividend withholding
    expect(results.investmentIncome?.withheld).toBeDefined();
    expect(results.investmentIncome?.withheld?.tax.national).toBe(
      Math.floor(1_025_800_000 * 0.15315),
    );
  });

  it('does not apply to pure high employment income (¥500,000,000 salary)', () => {
    const inputs = createBaseInputs({
      incomeStreams: [
        {
          id: 'salary',
          type: 'salary',
          amount: 500_000_000,
          frequency: 'annual',
        },
      ],
      incomeYear: 2025,
    });

    const results = calculateTaxes(inputs);
    expect(results.highIncomeMinimumTax).toBeUndefined();
  });

  it('does not apply in tax year 2024 (prior to effective year 2025)', () => {
    const inputs = createBaseInputs({
      incomeStreams: [
        {
          id: 'dividends',
          type: 'dividends',
          amount: 1_050_000_000,
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: true,
          issuerDomicile: 'domestic',
          foreignTax: 0,
        },
      ],
      incomeYear: 2024,
    });

    const results = calculateTaxes(inputs);
    expect(results.highIncomeMinimumTax).toBeUndefined();
  });

  it('correctly applies the tightened 2027 parameters for 2027 tax year', () => {
    const inputs = createBaseInputs({
      incomeStreams: [
        {
          id: 'dividends',
          type: 'dividends',
          amount: 500_000_000,
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: true,
          issuerDomicile: 'domestic',
          foreignTax: 0,
        },
      ],
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 1_000_000,
      incomeYear: 2027,
    });

    const results = calculateTaxes(inputs);
    expect(results.highIncomeMinimumTax).toBeDefined();
    expect(results.highIncomeMinimumTax?.threshold).toBe(165_000_000);
    expect(results.highIncomeMinimumTax?.rate.equals(percentTo(1)(30))).toBe(true);
    // 500M baseline, 165M threshold -> 335M taxable excess
    expect(results.highIncomeMinimumTax?.taxableExcess).toBe(335_000_000);
    // 335M * 30% = 100,500,000
    expect(results.highIncomeMinimumTax?.taxOnExcess).toBe(100_500_000);
  });

  it('excludes domestic bank account interest (源泉分離課税) from baseline income', () => {
    // ¥300,000,000 separate capital gains + ¥50,000,000 domestic bank interest
    // If domestic interest were included, baseline income would be ¥350M (> ¥330M threshold).
    // Because domestic interest is subject to 源泉分離課税 (措法3条①), it is excluded from 基準所得金額.
    const inputs = createBaseInputs({
      incomeStreams: [
        {
          id: 'dividends',
          type: 'dividends',
          amount: 300_000_000,
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: true,
          issuerDomicile: 'domestic',
          foreignTax: 0,
        },
        {
          id: 'domestic-interest',
          type: 'interest',
          amount: 50_000_000,
          payerDomicile: 'domestic',
          foreignTax: 0,
        },
      ],
      incomeYear: 2025,
    });

    const results = calculateTaxes(inputs);
    // Baseline income is only ¥300,000,000 (<= ¥330,000,000 threshold), so minimum tax does not apply
    expect(results.highIncomeMinimumTax).toBeUndefined();
  });

  it('does not inflate baseline income or minimum tax when domestic interest is added to an ultra-high earner', () => {
    // Official tokutei.pdf example: ¥3M real estate + ¥1,050M dividends = ¥1,053M baseline
    // Adding ¥50,000,000 of domestic bank interest must NOT change baseline income or the minimum tax addition.
    const baseInputs = createBaseInputs({
      incomeStreams: [
        {
          id: 'real-estate',
          type: 'business',
          amount: 3_000_000,
          blueFilerDeduction: 0,
        },
        {
          id: 'dividends',
          type: 'dividends',
          amount: 1_050_000_000,
          shareType: 'listed',
          paymentChannel: 'domestic',
          isReported: true,
          issuerDomicile: 'domestic',
          foreignTax: 0,
        },
      ],
      manualSocialInsuranceEntry: true,
      manualSocialInsuranceAmount: 300_000,
      incomeYear: 2025,
    });

    const withDomesticInterestInputs = createBaseInputs({
      ...baseInputs,
      incomeStreams: [
        ...baseInputs.incomeStreams,
        {
          id: 'domestic-interest',
          type: 'interest',
          amount: 50_000_000,
          payerDomicile: 'domestic',
          foreignTax: 0,
        },
      ],
    });

    const baseResults = calculateTaxes(baseInputs);
    const withInterestResults = calculateTaxes(withDomesticInterestInputs);

    expect(withInterestResults.highIncomeMinimumTax).toBeDefined();
    expect(withInterestResults.highIncomeMinimumTax?.baselineIncome).toBe(
      baseResults.highIncomeMinimumTax?.baselineIncome,
    );
    expect(withInterestResults.highIncomeMinimumTax?.taxOnExcess).toBe(
      baseResults.highIncomeMinimumTax?.taxOnExcess,
    );
    expect(withInterestResults.highIncomeMinimumTax?.additionalIncomeTax).toBe(
      baseResults.highIncomeMinimumTax?.additionalIncomeTax,
    );
  });
});
