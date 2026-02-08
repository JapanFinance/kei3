// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TakeHomeInputForm } from '../components/TakeHomeCalculator/InputForm';
import type { TakeHomeFormState } from '../types/tax';
import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';
import { getProviderDisplayName, NATIONAL_HEALTH_INSURANCE_ID, CUSTOM_PROVIDER_ID, DEFAULT_PROVIDER_REGION, DEFAULT_PROVIDER } from '../types/healthInsurance';
import { calculateNetEmploymentIncome } from '../utils/taxCalculations';

describe('TakeHomeInputForm Tests', () => {
  const mockOnInputChange = vi.fn();

  const baseInputs: TakeHomeFormState = {
    annualIncome: 5000000,
    incomeMode: 'salary',
    incomeStreams: [],
    isSubjectToLongTermCarePremium: false,
    healthInsuranceProvider: 'KyokaiKenpo',
    region: 'Tokyo',
    dcPlanContributions: 0,
    dependents: [],
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  };

  beforeEach(() => {
    mockOnInputChange.mockClear();
  });

  describe('when salary mode income input is used', () => {
    it('should include National Health Insurance as an option alongside employee providers for employment income', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs };

      render(
        <TakeHomeInputForm
          inputs={employmentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      await user.click(providerSelect);

      // After clicking, there's exactly one listbox - the one for our select
      const listbox = screen.getByRole('listbox');

      // Now scope our option searches to this listbox (which we know is ours)
      expect(within(listbox).getByRole('option', { name: 'National Health Insurance' })).toBeInTheDocument();
      expect(within(listbox).getByRole('option', { name: 'Kyokai Kenpo' })).toBeInTheDocument();
      expect(within(listbox).getByRole('option', { name: 'Kanto ITS Kenpo' })).toBeInTheDocument();

      // Should have employee providers + NHI + Custom
      const optionsInSelect = within(listbox).getAllByRole('option');
      expect(optionsInSelect).toHaveLength(Object.keys(PROVIDER_DEFINITIONS).length + 2);
    });

    it('should allow selecting different employee health insurance providers', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs };

      render(
        <TakeHomeInputForm
          inputs={employmentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      await user.click(providerSelect);

      // After clicking, there's exactly one listbox - the one for our select
      const listbox = screen.getByRole('listbox');
      const kantoOption = within(listbox).getByRole('option', { name: 'Kanto ITS Kenpo' });
      await user.click(kantoOption);

      // Verify the change handler was called with correct value
      expect(mockOnInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            name: 'healthInsuranceProvider',
            value: 'KantoItsKenpo',
          })
        })
      );
    });
  });

  describe('when in business income mode (non-employment income)', () => {
    it('should show dependent coverage and NHI when income is below threshold', async () => {
      const user = userEvent.setup();
      const nonEmploymentInputs = {
        ...baseInputs,
        incomeMode: 'business' as const,
        annualIncome: 1_000_000, // Below threshold
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };

      render(
        <TakeHomeInputForm
          inputs={nonEmploymentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      // Dropdown should NOT be disabled since there are multiple options
      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).not.toHaveAttribute('aria-disabled', 'true');

      // Click to open dropdown
      await user.click(providerSelect);
      const listbox = screen.getByRole('listbox');

      // Should have both dependent coverage and NHI
      expect(within(listbox).getByRole('option', { name: 'None (dependent of insured employee)' })).toBeInTheDocument();
      expect(within(listbox).getByRole('option', { name: 'National Health Insurance' })).toBeInTheDocument();
    });

    it('should only show NHI when non-employment income is above threshold', () => {
      const nonEmploymentInputs = {
        ...baseInputs,
        incomeMode: 'business' as const,
        annualIncome: 1_500_000, // Above threshold
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };

      render(
        <TakeHomeInputForm
          inputs={nonEmploymentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      // Dropdown should be disabled since there's only one option
      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).toHaveAttribute('aria-disabled', 'true');

      // Should show helper text about only option available
      expect(screen.getByText(/Only National Health Insurance available for this configuration/i)).toBeInTheDocument();
    });

    it('should not show employee health insurance providers for non-employment income', async () => {
      const user = userEvent.setup();
      const nonEmploymentInputs = {
        ...baseInputs,
        incomeMode: 'business' as const,
        annualIncome: 1_000_000, // Below threshold to have options
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };

      render(
        <TakeHomeInputForm
          inputs={nonEmploymentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      await user.click(providerSelect);

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');

      // Should only have dependent coverage and NHI, no employee providers
      expect(options).toHaveLength(2);
      expect(within(listbox).getByRole('option', { name: 'None (dependent of insured employee)' })).toBeInTheDocument();
      expect(within(listbox).getByRole('option', { name: 'National Health Insurance' })).toBeInTheDocument();
      expect(within(listbox).queryByRole('option', { name: 'Kyokai Kenpo' })).not.toBeInTheDocument();
    });
  });

  describe('when switching between employment and non-employment income', () => {
    it('should change available providers when toggling income mode', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs, incomeMode: 'salary' as const };

      const { rerender } = render(
        <TakeHomeInputForm
          inputs={employmentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      // Initially should have multiple providers (enabled dropdown)
      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).not.toBeDisabled();

      // Find and click the Business toggle
      const businessToggle = screen.getByRole('button', { name: /business/i });
      await user.click(businessToggle);

      // Verify that the mode change was registered
      expect(mockOnInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            name: 'incomeMode',
            value: 'business'
          })
        })
      );

      // Update props to simulate the mode change taking effect
      rerender(
        <TakeHomeInputForm
          inputs={{ ...baseInputs, incomeMode: 'business' as const }}
          onInputChange={mockOnInputChange}
        />
      );

      // For business income at 5M (baseInputs), only NHI is available
      const updatedSelect = screen.getByRole('combobox', { name: /health insurance provider/i });

      // Verify it's now disabled (single option)
      expect(updatedSelect).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText(/Only National Health Insurance available/i)).toBeInTheDocument();
    });
  });

  describe('integration with real provider data', () => {
    it('should dynamically include all providers from PROVIDER_DEFINITIONS', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs };

      render(
        <TakeHomeInputForm
          inputs={employmentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      await user.click(providerSelect);

      // After clicking, there's exactly one listbox - the one for our select
      const listbox = screen.getByRole('listbox');
      const optionsInSelect = within(listbox).getAllByRole('option');
      expect(optionsInSelect).toHaveLength(Object.keys(PROVIDER_DEFINITIONS).length + 2);

      // Each provider from PROVIDER_DEFINITIONS should be present within the listbox
      Object.entries(PROVIDER_DEFINITIONS).forEach(([, { providerName }]) => {
        expect(within(listbox).getByRole('option', { name: providerName })).toBeInTheDocument();
      });
    });

    it('should maintain consistency with provider display names', () => {
      const nonEmploymentInputs = {
        ...baseInputs,
        incomeMode: 'business' as const,
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };

      render(
        <TakeHomeInputForm
          inputs={nonEmploymentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).toHaveTextContent(getProviderDisplayName(NATIONAL_HEALTH_INSURANCE_ID));
    });
  });

  describe('accessibility and user experience', () => {
    it('should have proper ARIA labels and roles', () => {
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };

      render(
        <TakeHomeInputForm
          inputs={employmentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      // Health insurance provider field should be properly labeled
      expect(screen.getByRole('combobox', { name: /health insurance provider/i })).toBeInTheDocument();

      // Income mode selection should be present
      expect(screen.getByRole('group', { name: /income mode/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /salary/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /business/i })).toBeInTheDocument();
    });

    it('should show helpful tooltips and explanatory text', () => {
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };

      render(
        <TakeHomeInputForm
          inputs={employmentInputs}
          onInputChange={mockOnInputChange}
        />
      );

      // Should have health insurance provider section (test accessibility)
      expect(screen.getByRole('combobox', { name: /health insurance provider/i })).toBeInTheDocument();

      // Should have tooltip for Age Range
      const ageRangeLabel = screen.getByText('Age Range');
      expect(ageRangeLabel).toBeInTheDocument();
    });
  });
});

describe('Dependent Coverage UI Behavior', () => {
  const mockOnInputChange = vi.fn();
  const baseInputs: TakeHomeFormState = {
    annualIncome: 5000000,
    incomeMode: 'salary',
    incomeStreams: [],
    isSubjectToLongTermCarePremium: false,
    healthInsuranceProvider: 'KyokaiKenpo',
    region: 'Tokyo',
    dcPlanContributions: 0,
    dependents: [],
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  };

  beforeEach(() => {
    mockOnInputChange.mockClear();
  });

  it('should include dependent coverage option when income is below threshold for employment income', async () => {
    const user = userEvent.setup();
    const inputs = { ...baseInputs, annualIncome: 1_200_000 };

    render(<TakeHomeInputForm inputs={inputs} onInputChange={mockOnInputChange} />);

    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
    await user.click(providerSelect);

    const listbox = screen.getByRole('listbox');

    // Should include dependent coverage option
    expect(within(listbox).getByRole('option', { name: 'None (dependent of insured employee)' })).toBeInTheDocument();
  });

  it('should NOT include dependent coverage option when income is at or above threshold', async () => {
    const user = userEvent.setup();
    const inputs = { ...baseInputs, annualIncome: 1_300_000 };

    render(<TakeHomeInputForm inputs={inputs} onInputChange={mockOnInputChange} />);

    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
    await user.click(providerSelect);

    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    const optionTexts = options.map(opt => opt.textContent);

    expect(optionTexts).not.toContain('None (dependent of insured employee)');
  });

  it('should include dependent coverage option for non-employment income when below threshold', async () => {
    const user = userEvent.setup();
    const inputs = { ...baseInputs, annualIncome: 1_000_000, incomeMode: 'business' as const };

    render(<TakeHomeInputForm inputs={inputs} onInputChange={mockOnInputChange} />);

    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
    await user.click(providerSelect);

    const listbox = screen.getByRole('listbox');

    // Should include both dependent coverage and NHI for non-employment income below threshold
    expect(within(listbox).getByRole('option', { name: 'None (dependent of insured employee)' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'National Health Insurance' })).toBeInTheDocument();
  });

  it('should NOT include dependent coverage option for non-employment income above threshold', () => {
    const inputs = { ...baseInputs, annualIncome: 1_500_000, incomeMode: 'business' as const };

    render(<TakeHomeInputForm inputs={inputs} onInputChange={mockOnInputChange} />);

    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });

    // Should be disabled since only one option (NHI)
    expect(providerSelect).toHaveAttribute('aria-disabled', 'true');

    // Should show helper text explaining only NHI is available for this configuration
    expect(screen.getByText(/Only National Health Insurance available for this configuration/i)).toBeInTheDocument();
  });

  it('should show helper text about dependent coverage when income is below threshold', () => {
    const inputs = { ...baseInputs, annualIncome: 1_200_000 };

    render(<TakeHomeInputForm inputs={inputs} onInputChange={mockOnInputChange} />);

    // Should show helper text mentioning the threshold
    expect(screen.getByText(/If you are covered as a dependent under employee health insurance, select "None"./i)).toBeInTheDocument();
  });

  describe('Custom Provider UI', () => {
    it('should show custom rate fields when Custom Provider is selected', async () => {
      const customInputs = { ...baseInputs, healthInsuranceProvider: CUSTOM_PROVIDER_ID };

      render(
        <TakeHomeInputForm
          inputs={customInputs}
          onInputChange={mockOnInputChange}
        />
      );

      // Check if custom rate fields are visible
      // There are two "Rate (%)" fields
      const rateInputs = screen.getAllByLabelText('Rate (%)');
      expect(rateInputs).toHaveLength(2);

      // Verify context labels exist
      expect(screen.getByText('Health Insurance', { selector: 'p' })).toBeInTheDocument(); // Typography renders as p by default or I can check text content
      expect(screen.getByText('Long-term Care', { selector: 'p' })).toBeInTheDocument();
    });

    it('should call onInputChange when custom rates are updated', async () => {
      const user = userEvent.setup();
      const customInputs = { ...baseInputs, healthInsuranceProvider: CUSTOM_PROVIDER_ID };

      render(
        <TakeHomeInputForm
          inputs={customInputs}
          onInputChange={mockOnInputChange}
        />
      );

      const rateInputs = screen.getAllByLabelText('Rate (%)');
      const healthRateInput = rateInputs[0]; // First one is Health Insurance

      if (!healthRateInput) {
        throw new Error('Health rate input not found');
      }

      await user.clear(healthRateInput);
      await user.type(healthRateInput, '5');

      expect(mockOnInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            name: 'customEHIRates',
            value: expect.objectContaining({
              healthInsuranceRate: 5,
            }),
          })
        })
      );
    });

    it('should hide custom rate fields when another provider is selected', () => {
      const standardInputs = { ...baseInputs, healthInsuranceProvider: 'KyokaiKenpo' };

      render(
        <TakeHomeInputForm
          inputs={standardInputs}
          onInputChange={mockOnInputChange}
        />
      );

      expect(screen.queryByLabelText('Rate (%)')).not.toBeInTheDocument();
    });
  });

  describe('Manual Social Insurance Entry', () => {
    it('should show manual entry input when toggle is on', () => {
      const manualInputs = { ...baseInputs, manualSocialInsuranceEntry: true };

      render(
        <TakeHomeInputForm
          inputs={manualInputs}
          onInputChange={mockOnInputChange}
        />
      );

      // Check if the input field is visible
      expect(screen.getByLabelText(/Total Social Insurance Amount/i)).toBeInTheDocument();

      // Check if the provider dropdown is NOT visible
      expect(screen.queryByRole('combobox', { name: /health insurance provider/i })).not.toBeInTheDocument();
    });

    it('should hide manual entry input when toggle is off', () => {
      const manualInputs = { ...baseInputs, manualSocialInsuranceEntry: false };

      render(
        <TakeHomeInputForm
          inputs={manualInputs}
          onInputChange={mockOnInputChange}
        />
      );

      expect(screen.queryByLabelText(/Total Social Insurance Amount/i)).not.toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /health insurance provider/i })).toBeInTheDocument();
    });

    it('should call onInputChange when manual amount changes', async () => {
      const user = userEvent.setup();
      const manualInputs = { ...baseInputs, manualSocialInsuranceEntry: true, manualSocialInsuranceAmount: 0 };

      render(
        <TakeHomeInputForm
          inputs={manualInputs}
          onInputChange={mockOnInputChange}
        />
      );

      const amountInput = screen.getByLabelText(/Total Social Insurance Amount/i);
      await user.type(amountInput, '5');

      expect(mockOnInputChange).toHaveBeenCalled();
    });
  });

});

describe('Age Range Selection', () => {
  const mockOnInputChange = vi.fn();
  const baseInputs: TakeHomeFormState = {
    annualIncome: 5000000,
    incomeMode: 'salary',
    incomeStreams: [],
    isSubjectToLongTermCarePremium: false,
    healthInsuranceProvider: 'KyokaiKenpo',
    region: 'Tokyo',
    dcPlanContributions: 0,
    dependents: [],
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  };

  it('should toggle age range using segmented buttons', async () => {
    const user = userEvent.setup();
    render(<TakeHomeInputForm inputs={baseInputs} onInputChange={mockOnInputChange} />);

    // Find the buttons
    const under40Button = screen.getByRole('button', { name: /<40 or 65\+/i });
    const over40Button = screen.getByRole('button', { name: /40-64/i });

    // Initial state: <40 or 65+ is selected (false)
    expect(under40Button).toHaveAttribute('aria-pressed', 'true');
    expect(over40Button).toHaveAttribute('aria-pressed', 'false');

    // Click 40-64
    await user.click(over40Button);

    expect(mockOnInputChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          name: 'isSubjectToLongTermCarePremium',
          checked: true,
        })
      })
    );
  });
});

describe('TakeHomeInputForm Dependents Modal', () => {

  // Mock DependentsModal to inspect props
  vi.mock('../components/TakeHomeCalculator/Dependents/DependentsModal', () => ({
    DependentsModal: ({ taxpayerNetIncome }: { taxpayerNetIncome: number }) => (
      <div data-testid="dependents-modal" data-net-income={taxpayerNetIncome}>
        Mocked Modal
      </div>
    )
  }));

  const defaultInputs: TakeHomeFormState = {
    annualIncome: 0,
    incomeMode: 'advanced',
    incomeStreams: [],
    isSubjectToLongTermCarePremium: false,
    region: DEFAULT_PROVIDER_REGION,
    healthInsuranceProvider: DEFAULT_PROVIDER,
    dependents: [],
    dcPlanContributions: 0,
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  };

  test('correctly calculates net income passed to dependents modal for mixed income streams', () => {
    const inputs: TakeHomeFormState = {
      ...defaultInputs,
      incomeMode: 'advanced',
      incomeStreams: [
        { id: '1', type: 'salary', amount: 5_000_000, frequency: 'annual' },
        { id: '2', type: 'business', amount: 5_000_000 }
      ]
    };

    const mockOnInputChange = vi.fn();

    render(<TakeHomeInputForm inputs={inputs} onInputChange={mockOnInputChange} />);

    const modal = screen.getByTestId('dependents-modal');
    const netIncomePassed = Number(modal.getAttribute('data-net-income'));

    const expectedNetSalary = calculateNetEmploymentIncome(5_000_000);
    const expectedTotalNet = expectedNetSalary + 5_000_000;

    expect(netIncomePassed).toBe(expectedTotalNet);
  });
});
