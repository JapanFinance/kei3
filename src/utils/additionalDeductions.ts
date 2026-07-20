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

import {
  calculateEarthquakeInsuranceDeduction,
  calculateLifeInsuranceDeduction,
} from '../data/insuranceDeductions';
import type { Dependent } from '../types/dependents';
import type {
  AdditionalDeductionItem,
  AdditionalDeductionsResult,
  EarthquakeInsuranceInput,
  LifeInsuranceInput,
  MedicalExpensesInput,
} from '../types/tax';
import { hasDependentRelativeUnder23 } from './dependentDeductions';

/** Medical expense deduction floor: the lower of ¥100,000 and 5% of total net income. */
const MEDICAL_DEDUCTION_FLOOR_CAP = 100_000;
const MEDICAL_DEDUCTION_INCOME_RATE = 0.05;
/** Statutory maximum medical expense deduction. */
const MEDICAL_DEDUCTION_MAX = 2_000_000;

/**
 * Medical expense deduction (医療費控除). Equal for income tax and residence tax.
 *
 *   deduction = clamp((paid − reimbursed) − min(¥100,000, netIncome × 5%), 0, ¥2,000,000)
 *
 * The statutory floor base is 総所得金額等; `netIncome` is the taxpayer's 合計所得金額, used here as
 * a stand-in. The two differ only by carried-forward losses (純損失・雑損失等の繰越控除): 総所得金額等
 * is after applying them, 合計所得金額 is before. This calculator models no loss carryforwards, so the
 * two coincide and the substitution is exact. Source: NTA No.1120
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

/**
 * The subset of inputs the additional-deduction aggregation reads — a structural subset of
 * TakeHomeInputs, so the full inputs object satisfies it. `incomeYear` and `dependents` drive the
 * child-rearing 生命保険料控除 expansion (令和8・9年分); the rest are the figures entered in the modal.
 */
export interface AdditionalDeductionInputs {
  incomeYear: number;
  dependents: Dependent[];
  lifeInsurance: LifeInsuranceInput;
  earthquakeInsurance: EarthquakeInsuranceInput;
  medicalExpenses: MedicalExpensesInput;
}

/**
 * Aggregates the additional income deductions into per-tax totals plus an itemized breakdown.
 * Only items contributing a positive amount appear in `items`. `netIncome` (合計所得金額) is needed
 * for the medical-expense income floor.
 */
export const calculateAdditionalDeductions = (
  inputs: AdditionalDeductionInputs,
  netIncome: number,
): AdditionalDeductionsResult => {
  const items: AdditionalDeductionItem[] = [];

  const lifeDeduction = calculateLifeInsuranceDeduction(
    inputs.lifeInsurance,
    inputs.incomeYear,
    hasDependentRelativeUnder23(inputs.dependents, inputs.incomeYear),
  );
  if (lifeDeduction.national > 0 || lifeDeduction.residence > 0) {
    items.push({ key: 'lifeInsurance', ...lifeDeduction });
  }

  const earthquakeDeduction = calculateEarthquakeInsuranceDeduction(inputs.earthquakeInsurance);
  if (earthquakeDeduction.national > 0 || earthquakeDeduction.residence > 0) {
    items.push({ key: 'earthquakeInsurance', ...earthquakeDeduction });
  }

  const medicalDeduction = calculateMedicalExpenseDeduction(
    inputs.medicalExpenses.paid,
    inputs.medicalExpenses.reimbursed,
    netIncome,
  );
  if (medicalDeduction > 0) {
    items.push({
      key: 'medical',
      national: medicalDeduction,
      residence: medicalDeduction,
    });
  }

  return {
    national: items.reduce((sum, item) => sum + item.national, 0),
    residence: items.reduce((sum, item) => sum + item.residence, 0),
    items,
  };
};
