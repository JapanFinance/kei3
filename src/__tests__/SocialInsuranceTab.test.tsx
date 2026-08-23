// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll } from 'vitest';

import SocialInsuranceTab from '../components/TakeHomeCalculator/tabs/SocialInsuranceTab';
import type { TakeHomeResults, TakeHomeInputs } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';
import { makeResidenceTaxDetails, makeTakeHomeResults } from './fixtures/takeHomeResults';

// Mock DetailedTooltip to render children directly for easier testing
vi.mock('../components/ui/Tooltips', async () => {
  const { createPortal } = await import('react-dom');
  return {
    DetailedTooltip: ({ title, children }: { title: string; children?: React.ReactNode }) => (
      <>
        <span data-testid="detail-info-tooltip-trigger" title={title}>
          ℹ️
        </span>
        {createPortal(
          <div data-testid="detail-info-tooltip-content">{children}</div>,
          document.body,
        )}
      </>
    ),
    SimpleTooltip: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="info-tooltip">{children}</div>
    ),
  };
});

// Mock scrollTo for JSDOM
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

describe('SocialInsuranceTab', () => {
  const mockInputs: TakeHomeInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [
      { id: '1', type: 'salary', amount: 500000, frequency: 'monthly' }, // 6M annual
      { id: '2', type: 'commutingAllowance', amount: 20000, frequency: 'monthly' }, // 240k annual
    ],
    ageRange: 'age40to59' as const,
    region: 'Tokyo',
    healthInsuranceProvider: 'KyokaiKenpo',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    incomeYear: 2025, // this fixture models income year 2025 (FY2025 rates); drives all tooltips via inputs
  };

  const mockResults: TakeHomeResults = makeTakeHomeResults({
    annualIncome: 6000000,
    healthInsurance: 300000,
    pensionPayments: 500000,
    employmentInsurance: 30000,
    nationalIncomeTax: 100000,
    residenceTax: makeResidenceTaxDetails({ totalResidenceTax: 200000 }),
    takeHomeIncome: 4870000,
    healthInsuranceProvider: 'KyokaiKenpo',
    region: 'Tokyo',
    ageRange: 'age40to59',
    hasEmploymentIncome: true,
    totalNetIncome: 4200000,
    residenceTaxBasicDeduction: 430000,
    salaryIncome: 6000000,
    grossEmploymentIncome: 6000000,
  });

  it('displays Monthly Remuneration label', () => {
    render(<SocialInsuranceTab inputs={mockInputs} results={mockResults} />);
    expect(screen.getAllByText('Monthly Remuneration').length).toBeGreaterThan(0);
  });

  it('shows Monthly Remuneration breakdown in tooltip', () => {
    render(<SocialInsuranceTab inputs={mockInputs} results={mockResults} />);

    // Detailed Breakdown is rendered directly by mock
    expect(screen.getByText('Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Base Monthly Salary:')).toBeInTheDocument();
    expect(screen.getAllByText('¥500,000').length).toBeGreaterThan(0);
    expect(screen.getByText('Monthly Commuting Allowance:')).toBeInTheDocument();
    expect(screen.getAllByText('¥20,000').length).toBeGreaterThan(0);
    expect(screen.getByText('Total:')).toBeInTheDocument();
    expect(screen.getAllByText('¥520,000').length).toBeGreaterThan(0);
  });

  it('shows calculation and SMR table in Health Insurance tooltip', () => {
    render(<SocialInsuranceTab inputs={mockInputs} results={mockResults} />);

    // With mock, content is rendered directly
    expect(screen.getAllByText(/Standard Monthly Remuneration/i).length).toBeGreaterThan(0);
    // SMR for 520,000 monthly remuneration is 530,000
    expect(screen.getAllByText('¥530,000').length).toBeGreaterThan(0);
    expect(screen.getByText('Monthly Insurance Premium')).toBeInTheDocument();
    // Health insurance premium for 530,000 SMR is 30,475
    expect(screen.getAllByText('¥30,475').length).toBeGreaterThan(0);
  });

  it('shows calculation and SMR table in Pension tooltip', () => {
    render(<SocialInsuranceTab inputs={mockInputs} results={mockResults} />);

    // With mock, content is rendered directly
    // "Employees' Pension" is the section header in main tab
    expect(screen.getByText("Employees' Pension")).toBeInTheDocument();

    // Tooltip content:
    expect(screen.getByText('Employees Pension Insurance Calculation')).toBeInTheDocument();

    // Verify Pension SMR is used (Table Column Header)
    expect(screen.getAllByText('Pension SMR').length).toBeGreaterThan(0);

    // Verify Standard Monthly Remuneration is present in calculation box
    expect(screen.getAllByText(/Standard Monthly Remuneration/).length).toBeGreaterThan(0);

    // Verify Monthly Pension Contribution header
    expect(screen.getByText('Monthly Pension Contribution')).toBeInTheDocument();

    // Pension SMR for 520k is also 530k (in the table row)
    expect(screen.getAllByText('¥530,000').length).toBeGreaterThan(0);

    // Verify Table is present title
    expect(screen.getByText('Employees Pension (厚生年金) SMR Table')).toBeInTheDocument();
  });

  it('handles high income caps correctly (Health vs Pension SMR)', () => {
    const highIncomeInputs = {
      ...mockInputs,
      incomeStreams: [
        { id: '1', type: 'salary', amount: 800000, frequency: 'monthly' }, // 800k/month
      ],
    } as TakeHomeInputs;

    // 800k falls into Grade 39 (770k-810k) -> SMR 790k
    // Pension Caps at Grade 32 (635k+) -> SMR 650k
    render(<SocialInsuranceTab inputs={highIncomeInputs} results={mockResults} />);

    // 1. Check Health Insurance Tooltip -> Should show SMR 790,000
    expect(screen.getAllByText(/Grade:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/¥790,000/).length).toBeGreaterThan(0);

    // 2. Check Pension Tooltip -> Should show Pension SMR 650,000
    expect(screen.getByText('Employees Pension Insurance Calculation')).toBeInTheDocument();
    expect(screen.getByText('Pension SMR')).toBeInTheDocument();

    // Check for capped value
    expect(screen.getAllByText('¥650,000').length).toBeGreaterThan(0);
    expect(screen.getByText(/\(Maximum Cap\)/)).toBeInTheDocument();
  });

  it('keeps the pension row with a zero value and an age tooltip for an NHI user outside 20-59', () => {
    const inputs = {
      ...mockInputs,
      ageRange: 'age60to64' as const,
      healthInsuranceProvider: 'NationalHealthInsurance' as const,
      region: 'Tokyo-Shinjuku',
      incomeStreams: [{ id: 'm1', type: 'miscellaneous' as const, amount: 4_000_000 }],
    };
    const results = {
      ...mockResults,
      ageRange: 'age60to64' as const,
      healthInsuranceProvider: 'NationalHealthInsurance' as const,
      region: 'Tokyo-Shinjuku',
      hasEmploymentIncome: false,
      grossEmploymentIncome: 0,
      netBusinessAndMiscIncome: 4_000_000,
      totalNetIncome: 4_000_000,
      pensionPayments: 0,
      nhiMedicalPortion: 300_000,
      nhiElderlySupportPortion: 100_000,
    };

    render(<SocialInsuranceTab inputs={inputs} results={results} />);

    expect(screen.getByText('National Pension')).toBeInTheDocument();
    expect(screen.getByText('Annual Contribution')).toBeInTheDocument();
    expect(screen.getByText('¥0')).toBeInTheDocument();
    expect(
      screen.getByText(/no compulsory National Pension .* enrollment covers ages 20-59/),
    ).toBeInTheDocument();
    // The contribution-table tooltip is not shown while nothing is due.
    expect(screen.queryByTitle('Pension Contribution')).not.toBeInTheDocument();
  });

  it('keeps the pension rows with zero values and an age tooltip for a 70-74 employee', () => {
    const inputs = { ...mockInputs, ageRange: 'age70to74' as const };
    const results = { ...mockResults, ageRange: 'age70to74' as const, pensionPayments: 0 };

    render(<SocialInsuranceTab inputs={inputs} results={results} />);

    expect(screen.getByText("Employees' Pension")).toBeInTheDocument();
    expect(screen.getByText('Monthly Contribution')).toBeInTheDocument();
    expect(screen.getByText('Annual Contribution')).toBeInTheDocument();
    expect(
      screen.getByText(/no compulsory Employees' Pension .* enrollment ends at age 70/),
    ).toBeInTheDocument();
    // The SMR-based contribution tooltip is not shown while nothing is due.
    expect(screen.queryByTitle('Pension Contribution')).not.toBeInTheDocument();
  });

  it('hides Monthly Commuting Allowance row when 0', () => {
    const noCommutingInputs = {
      ...mockInputs,
      incomeStreams: [{ id: '1', type: 'salary', amount: 500000, frequency: 'monthly' }],
    } as TakeHomeInputs;

    render(<SocialInsuranceTab inputs={noCommutingInputs} results={mockResults} />);

    // Breakdown should be present
    expect(screen.getByText('Breakdown')).toBeInTheDocument();

    // Base Salary should be present
    expect(screen.getByText('Base Monthly Salary:')).toBeInTheDocument();

    // Commuting Allowance row should NOT be present
    expect(screen.queryByText('Monthly Commuting Allowance:')).not.toBeInTheDocument();

    // Total should still be present
    expect(screen.getByText('Total:')).toBeInTheDocument();
  });
});

describe('SocialInsuranceTab at ages 65 and over', () => {
  const baseInputs: TakeHomeInputs = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    incomeStreams: [{ id: 'm1', type: 'miscellaneous', amount: 4_000_000 }],
    ageRange: 'age75plus',
    region: 'Tokyo',
    healthInsuranceProvider: 'LatterStageElderly',
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
    longTermCareCategory1Premium: 150_000,
    incomeYear: 2026,
  };

  const baseResults: TakeHomeResults = makeTakeHomeResults({
    annualIncome: 4_000_000,
    healthInsurance: 408_500,
    nationalIncomeTax: 100_000,
    residenceTax: makeResidenceTaxDetails({ totalResidenceTax: 200_000 }),
    takeHomeIncome: 3_000_000,
    healthInsuranceProvider: 'LatterStageElderly',
    region: 'Tokyo',
    ageRange: 'age75plus',
    totalNetIncome: 4_000_000,
    residenceTaxBasicDeduction: 430_000,
    latterStageMedicalPortion: 401_500,
    latterStageChildSupportPortion: 7_000,
    longTermCareCategory1Premium: 150_000,
  });

  it('renders the latter-stage premium breakdown and no-pension note at 75+', () => {
    render(<SocialInsuranceTab inputs={baseInputs} results={baseResults} />);

    expect(screen.getByText('Medical System for the Elderly (75+)')).toBeInTheDocument();
    expect(screen.getByText('Premium Calculation Base')).toBeInTheDocument();
    expect(screen.getByText('Medical Portion')).toBeInTheDocument();
    expect(screen.getByText('Child Support Portion')).toBeInTheDocument();
    expect(screen.getAllByText('¥401,500').length).toBeGreaterThan(0);
    expect(screen.getByText(/enrollment ends at age 70 and National Pension/)).toBeInTheDocument();
    expect(screen.queryByText('Monthly Contribution')).not.toBeInTheDocument();
  });

  it('renders the 第1号 long-term care premium row and includes it in the total at 75+', () => {
    render(<SocialInsuranceTab inputs={baseInputs} results={baseResults} />);

    expect(screen.getByText('Age 65+ Long-term Care Insurance')).toBeInTheDocument();
    expect(screen.getAllByText('¥150,000').length).toBeGreaterThan(0);
    // 408,500 health insurance + 0 pension + 150,000 第1号.
    expect(screen.getByText('Annual Social Insurance')).toBeInTheDocument();
    expect(screen.getByText('¥558,500')).toBeInTheDocument();
  });

  it('omits the 第1号 section when no premium applies at 75+', () => {
    render(
      <SocialInsuranceTab
        inputs={{ ...baseInputs, longTermCareCategory1Premium: 0 }}
        results={{ ...baseResults, longTermCareCategory1Premium: undefined }}
      />,
    );

    expect(screen.queryByText('Age 65+ Long-term Care Insurance')).not.toBeInTheDocument();
    // The annual premium and the social insurance total are both 408,500 with nothing else due.
    expect(screen.getAllByText('¥408,500')).toHaveLength(2);
  });

  it('renders the 第1号 section alongside employee health insurance at 65-69', () => {
    const inputs: TakeHomeInputs = {
      ...baseInputs,
      incomeStreams: [{ id: 's1', type: 'salary', amount: 300_000, frequency: 'monthly' }],
      ageRange: 'age65to69',
      healthInsuranceProvider: 'KyokaiKenpo',
    };
    const results: TakeHomeResults = {
      ...baseResults,
      ageRange: 'age65to69',
      healthInsuranceProvider: 'KyokaiKenpo',
      hasEmploymentIncome: true,
      grossEmploymentIncome: 3_600_000,
      salaryIncome: 3_600_000,
      healthInsurance: 200_000,
      pensionPayments: 300_000,
      employmentInsurance: 18_000,
      latterStageMedicalPortion: undefined,
      latterStageChildSupportPortion: undefined,
    };

    render(<SocialInsuranceTab inputs={inputs} results={results} />);

    expect(screen.getByText("Employees' Health Insurance")).toBeInTheDocument();
    expect(screen.queryByText('Medical System for the Elderly (75+)')).not.toBeInTheDocument();
    expect(screen.getByText('Age 65+ Long-term Care Insurance')).toBeInTheDocument();
    // 200,000 + 300,000 + 18,000 + 150,000.
    expect(screen.getByText('¥668,000')).toBeInTheDocument();
  });
});
