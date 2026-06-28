// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Aggregates the "additional" income deductions (所得控除) entered in the Additional
 * Deductions & Credits modal — life insurance, earthquake insurance, and medical expenses —
 * into a single {@link AdditionalDeductionsResult} with per-tax totals and an itemized
 * breakdown for display.
 *
 * Split-amount deductions (life, earthquake) come from `data/insuranceDeductions.ts`.
 * Medical reduces income tax and residence tax by the same amount and so carries a single
 * figure. None of these are 人的控除, so none affect the residence-tax 調整控除.
 */

import type {
  AdditionalDeductionItem,
  AdditionalDeductionsResult,
  EarthquakeInsuranceInput,
  LifeInsuranceInput,
  MedicalExpensesInput,
} from '../types/tax';
import {
  calculateEarthquakeInsuranceDeduction,
  calculateLifeInsuranceDeduction,
} from '../data/insuranceDeductions';

/** Medical expense deduction floor: the lower of ¥100,000 and 5% of total income. */
const MEDICAL_DEDUCTION_FLOOR_CAP = 100_000;
const MEDICAL_DEDUCTION_INCOME_RATE = 0.05;
/** Statutory maximum medical expense deduction. */
const MEDICAL_DEDUCTION_MAX = 2_000_000;

/**
 * Medical expense deduction (医療費控除). Equal for income tax and residence tax.
 *
 *   deduction = clamp((paid − reimbursed) − min(¥100,000, netIncome × 5%), 0, ¥2,000,000)
 *
 * `netIncome` is the taxpayer's 合計所得金額, used here in place of 総所得金額等 — they
 * coincide for the income types this calculator models. Source: NTA No.1120
 * https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm
 */
export const calculateMedicalExpenseDeduction = (
  paid: number,
  reimbursed: number,
  netIncome: number,
): number => {
  const netPaid = Math.max(0, paid - Math.max(0, reimbursed));
  const floor = Math.min(
    MEDICAL_DEDUCTION_FLOOR_CAP,
    Math.max(0, netIncome) * MEDICAL_DEDUCTION_INCOME_RATE,
  );
  const deduction = Math.floor(netPaid - floor);
  return Math.min(Math.max(0, deduction), MEDICAL_DEDUCTION_MAX);
};

/** The subset of inputs the additional-deduction aggregation reads. */
export interface AdditionalDeductionInputs {
  lifeInsurance?: LifeInsuranceInput | undefined;
  earthquakeInsurance?: EarthquakeInsuranceInput | undefined;
  medicalExpenses?: MedicalExpensesInput | undefined;
}

/**
 * Aggregates the additional income deductions into per-tax totals plus an itemized
 * breakdown. Only items contributing a positive amount appear in `items`. `netIncome`
 * (合計所得金額) is needed for the medical-expense income floor.
 */
export const calculateAdditionalDeductions = (
  inputs: AdditionalDeductionInputs,
  netIncome: number,
): AdditionalDeductionsResult => {
  const items: AdditionalDeductionItem[] = [];

  if (inputs.lifeInsurance) {
    const d = calculateLifeInsuranceDeduction(inputs.lifeInsurance);
    if (d.national > 0 || d.residence > 0) {
      items.push({ key: 'lifeInsurance', label: '生命保険料控除', ...d });
    }
  }

  if (inputs.earthquakeInsurance) {
    const d = calculateEarthquakeInsuranceDeduction(inputs.earthquakeInsurance);
    if (d.national > 0 || d.residence > 0) {
      items.push({ key: 'earthquakeInsurance', label: '地震保険料控除', ...d });
    }
  }

  if (inputs.medicalExpenses) {
    const m = calculateMedicalExpenseDeduction(
      inputs.medicalExpenses.paid,
      inputs.medicalExpenses.reimbursed,
      netIncome,
    );
    if (m > 0) {
      items.push({ key: 'medical', label: '医療費控除', national: m, residence: m });
    }
  }

  return {
    national: items.reduce((sum, item) => sum + item.national, 0),
    residence: items.reduce((sum, item) => sum + item.residence, 0),
    items,
  };
};
