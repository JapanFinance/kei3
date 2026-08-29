// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';

import { TakeHomeInputForm } from '../components/TakeHomeCalculator/InputForm';
import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';
import { calculateNetEmploymentIncome } from '../data/netEmploymentIncome';
import { takeHomeFormReducer } from '../state/takeHomeFormReducer';
import {
  getProviderDisplayName,
  NATIONAL_HEALTH_INSURANCE_ID,
  CUSTOM_PROVIDER_ID,
  DEFAULT_PROVIDER_REGION,
  DEFAULT_PROVIDER,
} from '../types/healthInsurance';
import type { TakeHomeFormState } from '../types/tax';
import { EMPTY_ADDITIONAL_DEDUCTION_INPUTS } from '../types/tax';

vi.mock('../components/TakeHomeCalculator/Dependents/DependentsModal', () => ({
  DependentsModal: ({ taxpayerNetIncome }: { taxpayerNetIncome: number }) => (
    <div data-testid="dependents-modal" data-net-income={taxpayerNetIncome}>
      Mocked Modal
    </div>
  ),
}));

describe('TakeHomeInputForm Tests', () => {
  const mockDispatch = vi.fn();

  const baseInputs: TakeHomeFormState = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    annualIncome: 5000000,
    incomeYear: 2026,
    incomeMode: 'salary',
    incomeStreams: [],
    savedIncomeStreams: [],
    longTermCareCategory1ManualEntry: false,
    longTermCareCategory1Premium: 0,
    ageRange: 'age20to39' as const,
    healthInsuranceProvider: 'KyokaiKenpo',
    region: 'Tokyo',
    dcPlanContributions: 0,
    dependents: [],
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  };

  beforeEach(() => {
    mockDispatch.mockClear();
  });

  describe('when salary mode income input is used', () => {
    it('should include National Health Insurance as an option alongside employee providers for employment income', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs };

      render(<TakeHomeInputForm inputs={employmentInputs} dispatch={mockDispatch} />);

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      await user.click(providerSelect);

      // After clicking, there's exactly one listbox - the one for our select
      const listbox = screen.getByRole('listbox');

      // Now scope our option searches to this listbox (which we know is ours)
      expect(
        within(listbox).getByRole('option', { name: 'National Health Insurance' }),
      ).toBeInTheDocument();
      expect(within(listbox).getByRole('option', { name: 'Kyokai Kenpo' })).toBeInTheDocument();
      expect(within(listbox).getByRole('option', { name: 'Kanto ITS Kenpo' })).toBeInTheDocument();

      // Should have employee providers + NHI + Custom
      const optionsInSelect = within(listbox).getAllByRole('option');
      expect(optionsInSelect).toHaveLength(Object.keys(PROVIDER_DEFINITIONS).length + 2);
    });

    it('should allow selecting different employee health insurance providers', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs };

      render(<TakeHomeInputForm inputs={employmentInputs} dispatch={mockDispatch} />);

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      await user.click(providerSelect);

      // After clicking, there's exactly one listbox - the one for our select
      const listbox = screen.getByRole('listbox');
      const kantoOption = within(listbox).getByRole('option', { name: 'Kanto ITS Kenpo' });
      await user.click(kantoOption);

      // Verify the reducer action was dispatched with the correct value
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'providerChanged',
        provider: 'KantoItsKenpo',
      });
    });
  });

  describe('when in miscellaneous income mode (non-employment income)', () => {
    it('should show dependent coverage and NHI when income is below threshold', async () => {
      const user = userEvent.setup();
      const nonEmploymentInputs = {
        ...baseInputs,
        incomeMode: 'miscellaneous' as const,
        annualIncome: 1_000_000, // Below threshold
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };

      render(<TakeHomeInputForm inputs={nonEmploymentInputs} dispatch={mockDispatch} />);

      // Dropdown should NOT be disabled since there are multiple options
      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).not.toHaveAttribute('aria-disabled', 'true');

      // Click to open dropdown
      await user.click(providerSelect);
      const listbox = screen.getByRole('listbox');

      // Should have both dependent coverage and NHI
      expect(
        within(listbox).getByRole('option', { name: 'None (dependent of insured employee)' }),
      ).toBeInTheDocument();
      expect(
        within(listbox).getByRole('option', { name: 'National Health Insurance' }),
      ).toBeInTheDocument();
    });

    it('should only show NHI when non-employment income is above threshold', () => {
      const nonEmploymentInputs = {
        ...baseInputs,
        incomeMode: 'miscellaneous' as const,
        annualIncome: 1_500_000, // Above threshold
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };

      render(<TakeHomeInputForm inputs={nonEmploymentInputs} dispatch={mockDispatch} />);

      // Dropdown should be disabled since there's only one option
      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).toHaveAttribute('aria-disabled', 'true');

      // Should show helper text about only option available
      expect(
        screen.getByText(/Only National Health Insurance available for this configuration/i),
      ).toBeInTheDocument();
    });

    it('should not show employee health insurance providers for non-employment income', async () => {
      const user = userEvent.setup();
      const nonEmploymentInputs = {
        ...baseInputs,
        incomeMode: 'miscellaneous' as const,
        annualIncome: 1_000_000, // Below threshold to have options
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };

      render(<TakeHomeInputForm inputs={nonEmploymentInputs} dispatch={mockDispatch} />);

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      await user.click(providerSelect);

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');

      // Should only have dependent coverage and NHI, no employee providers
      expect(options).toHaveLength(2);
      expect(
        within(listbox).getByRole('option', { name: 'None (dependent of insured employee)' }),
      ).toBeInTheDocument();
      expect(
        within(listbox).getByRole('option', { name: 'National Health Insurance' }),
      ).toBeInTheDocument();
      expect(
        within(listbox).queryByRole('option', { name: 'Kyokai Kenpo' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('when switching between employment and non-employment income', () => {
    it('should change available providers when toggling income mode', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs, incomeMode: 'salary' as const };

      const { rerender } = render(
        <TakeHomeInputForm inputs={employmentInputs} dispatch={mockDispatch} />,
      );

      // Initially should have multiple providers (enabled dropdown)
      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).not.toBeDisabled();

      // Find and click the Miscellaneous toggle
      const miscToggle = screen.getByRole('button', { name: /misc/i });
      await user.click(miscToggle);

      // Verify that the mode change was dispatched
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'incomeModeChanged',
        mode: 'miscellaneous',
      });

      // Update props to simulate the mode change taking effect
      rerender(
        <TakeHomeInputForm
          inputs={{ ...baseInputs, incomeMode: 'miscellaneous' as const }}
          dispatch={mockDispatch}
        />,
      );

      // For miscellaneous income at 5M (baseInputs), only NHI is available
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

      render(<TakeHomeInputForm inputs={employmentInputs} dispatch={mockDispatch} />);

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
        incomeMode: 'miscellaneous' as const,
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };

      render(<TakeHomeInputForm inputs={nonEmploymentInputs} dispatch={mockDispatch} />);

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).toHaveTextContent(
        getProviderDisplayName(NATIONAL_HEALTH_INSURANCE_ID),
      );
    });
  });

  describe('accessibility and user experience', () => {
    it('should have proper ARIA labels and roles', () => {
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };

      render(<TakeHomeInputForm inputs={employmentInputs} dispatch={mockDispatch} />);

      // Health insurance provider field should be properly labeled
      expect(
        screen.getByRole('combobox', { name: /health insurance provider/i }),
      ).toBeInTheDocument();

      // Income mode selection should be present
      expect(screen.getByRole('group', { name: /income mode/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Salary' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /misc/i })).toBeInTheDocument();
    });

    it('should show helpful tooltips and explanatory text', () => {
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };

      render(<TakeHomeInputForm inputs={employmentInputs} dispatch={mockDispatch} />);

      // Should have health insurance provider section (test accessibility)
      expect(
        screen.getByRole('combobox', { name: /health insurance provider/i }),
      ).toBeInTheDocument();

      // Should have tooltip for the Age input
      const ageRangeLabel = screen.getByText('Age');
      expect(ageRangeLabel).toBeInTheDocument();
    });
  });
});

describe('Dependent Coverage UI Behavior', () => {
  const mockDispatch = vi.fn();
  const baseInputs: TakeHomeFormState = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    annualIncome: 5000000,
    incomeYear: 2026,
    incomeMode: 'salary',
    incomeStreams: [],
    savedIncomeStreams: [],
    longTermCareCategory1ManualEntry: false,
    longTermCareCategory1Premium: 0,
    ageRange: 'age20to39' as const,
    healthInsuranceProvider: 'KyokaiKenpo',
    region: 'Tokyo',
    dcPlanContributions: 0,
    dependents: [],
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  };

  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('should include dependent coverage option when income is below threshold for employment income', async () => {
    const user = userEvent.setup();
    const inputs = { ...baseInputs, annualIncome: 1_200_000 };

    render(<TakeHomeInputForm inputs={inputs} dispatch={mockDispatch} />);

    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
    await user.click(providerSelect);

    const listbox = screen.getByRole('listbox');

    // Should include dependent coverage option
    expect(
      within(listbox).getByRole('option', { name: 'None (dependent of insured employee)' }),
    ).toBeInTheDocument();
  });

  it('should NOT include dependent coverage option when income is at or above threshold', async () => {
    const user = userEvent.setup();
    const inputs = { ...baseInputs, annualIncome: 1_300_000 };

    render(<TakeHomeInputForm inputs={inputs} dispatch={mockDispatch} />);

    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
    await user.click(providerSelect);

    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    const optionTexts = options.map(opt => opt.textContent);

    expect(optionTexts).not.toContain('None (dependent of insured employee)');
  });

  it('should include dependent coverage option for non-employment income when below threshold', async () => {
    const user = userEvent.setup();
    const inputs = { ...baseInputs, annualIncome: 1_000_000, incomeMode: 'miscellaneous' as const };

    render(<TakeHomeInputForm inputs={inputs} dispatch={mockDispatch} />);

    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
    await user.click(providerSelect);

    const listbox = screen.getByRole('listbox');

    // Should include both dependent coverage and NHI for non-employment income below threshold
    expect(
      within(listbox).getByRole('option', { name: 'None (dependent of insured employee)' }),
    ).toBeInTheDocument();
    expect(
      within(listbox).getByRole('option', { name: 'National Health Insurance' }),
    ).toBeInTheDocument();
  });

  it('should NOT include dependent coverage option for non-employment income above threshold', () => {
    const inputs = { ...baseInputs, annualIncome: 1_500_000, incomeMode: 'miscellaneous' as const };

    render(<TakeHomeInputForm inputs={inputs} dispatch={mockDispatch} />);

    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });

    // Should be disabled since only one option (NHI)
    expect(providerSelect).toHaveAttribute('aria-disabled', 'true');

    // Should show helper text explaining only NHI is available for this configuration
    expect(
      screen.getByText(/Only National Health Insurance available for this configuration/i),
    ).toBeInTheDocument();
  });

  it('should show helper text about dependent coverage when income is below threshold', () => {
    const inputs = { ...baseInputs, annualIncome: 1_200_000 };

    render(<TakeHomeInputForm inputs={inputs} dispatch={mockDispatch} />);

    // Should show helper text mentioning the threshold
    expect(
      screen.getByText(
        /If covered as a dependent under employee health insurance, select "None"./i,
      ),
    ).toBeInTheDocument();
  });

  describe('Custom Provider UI', () => {
    it('should show custom rate fields when Custom Provider is selected', () => {
      const customInputs = { ...baseInputs, healthInsuranceProvider: CUSTOM_PROVIDER_ID };

      render(<TakeHomeInputForm inputs={customInputs} dispatch={mockDispatch} />);

      // Check if custom rate fields are visible
      // There are two "Rate (%)" fields
      const rateInputs = screen.getAllByLabelText('Rate (%)');
      expect(rateInputs).toHaveLength(2);

      // Verify context labels exist
      expect(screen.getByText('Health Insurance', { selector: 'p' })).toBeInTheDocument(); // Typography renders as p by default or I can check text content
      expect(screen.getByText('Long-term Care', { selector: 'p' })).toBeInTheDocument();
    });

    it('should dispatch setField when custom rates are updated', async () => {
      const user = userEvent.setup();
      const customInputs = { ...baseInputs, healthInsuranceProvider: CUSTOM_PROVIDER_ID };

      render(<TakeHomeInputForm inputs={customInputs} dispatch={mockDispatch} />);

      const rateInputs = screen.getAllByLabelText('Rate (%)');
      const healthRateInput = rateInputs[0]; // First one is Health Insurance

      if (!healthRateInput) {
        throw new Error('Health rate input not found');
      }

      await user.clear(healthRateInput);
      await user.type(healthRateInput, '5');

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'setField',
          field: 'customEHIRates',
          value: expect.objectContaining({
            healthInsuranceRate: 5,
          }),
        }),
      );
    });

    it('should hide custom rate fields when another provider is selected', () => {
      const standardInputs = { ...baseInputs, healthInsuranceProvider: DEFAULT_PROVIDER };

      render(<TakeHomeInputForm inputs={standardInputs} dispatch={mockDispatch} />);

      expect(screen.queryByLabelText('Rate (%)')).not.toBeInTheDocument();
    });
  });

  describe('Manual Social Insurance Entry', () => {
    it('should show manual entry input when toggle is on', () => {
      const manualInputs = { ...baseInputs, manualSocialInsuranceEntry: true };

      render(<TakeHomeInputForm inputs={manualInputs} dispatch={mockDispatch} />);

      // Check if the input field is visible
      expect(screen.getByLabelText('Total Social Insurance Amount')).toBeInTheDocument();

      // Check if the provider dropdown is NOT visible
      expect(
        screen.queryByRole('combobox', { name: /health insurance provider/i }),
      ).not.toBeInTheDocument();
    });

    it('should hide manual entry input when toggle is off', () => {
      const manualInputs = { ...baseInputs, manualSocialInsuranceEntry: false };

      render(<TakeHomeInputForm inputs={manualInputs} dispatch={mockDispatch} />);

      expect(screen.queryByLabelText('Total Social Insurance Amount')).not.toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: /health insurance provider/i }),
      ).toBeInTheDocument();
    });

    it('should dispatch setField when manual amount changes', async () => {
      const user = userEvent.setup();
      const manualInputs = {
        ...baseInputs,
        manualSocialInsuranceEntry: true,
        manualSocialInsuranceAmount: 0,
      };

      render(<TakeHomeInputForm inputs={manualInputs} dispatch={mockDispatch} />);

      const amountInput = screen.getByLabelText('Total Social Insurance Amount');
      await user.type(amountInput, '5');

      expect(mockDispatch).toHaveBeenCalled();
    });
  });
});

describe('Age Selection', () => {
  const mockDispatch = vi.fn();
  const baseInputs: TakeHomeFormState = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    annualIncome: 5000000,
    incomeYear: 2026,
    incomeMode: 'salary',
    incomeStreams: [],
    savedIncomeStreams: [],
    longTermCareCategory1ManualEntry: false,
    longTermCareCategory1Premium: 0,
    ageRange: 'age20to39' as const,
    healthInsuranceProvider: 'KyokaiKenpo',
    region: 'Tokyo',
    dcPlanContributions: 0,
    dependents: [],
    manualSocialInsuranceEntry: false,
    manualSocialInsuranceAmount: 0,
  };

  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('offers every age range and shows the current selection', async () => {
    const user = userEvent.setup();
    render(<TakeHomeInputForm inputs={baseInputs} dispatch={mockDispatch} />);

    const ageSelect = screen.getByRole('combobox', { name: 'Age' });
    expect(ageSelect).toHaveTextContent('20-39');

    await user.click(ageSelect);
    const listbox = screen.getByRole('listbox');
    for (const label of ['Under 18', '18-19', '20-39', '40-59', '60-64', '65-69', '70-74', '75+']) {
      expect(within(listbox).getByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('dispatches ageRangeChanged when a range is selected', async () => {
    const user = userEvent.setup();
    render(<TakeHomeInputForm inputs={baseInputs} dispatch={mockDispatch} />);

    await user.click(screen.getByRole('combobox', { name: 'Age' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '40-59' }));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ageRangeChanged',
      ageRange: 'age40to59' as const,
    });
  });

  it('shows the 第1号 premium field only from age 65', () => {
    const { rerender } = render(
      <TakeHomeInputForm
        inputs={{ ...baseInputs, ageRange: 'age60to64' }}
        dispatch={mockDispatch}
      />,
    );
    expect(screen.queryByRole('switch', { name: 'Estimate' })).not.toBeInTheDocument();

    rerender(
      <TakeHomeInputForm
        inputs={{ ...baseInputs, ageRange: 'age65to69' }}
        dispatch={mockDispatch}
      />,
    );
    expect(screen.getByText('Age 65+ Long-term Care Insurance')).toBeInTheDocument();
    // The estimate switch defaults on, so the amount field stays in place but read-only.
    expect(screen.getByRole('switch', { name: 'Estimate' })).toBeChecked();
    expect(screen.getByLabelText('Annual Premium (estimate)')).toBeDisabled();

    rerender(
      <TakeHomeInputForm
        inputs={{
          ...baseInputs,
          ageRange: 'age75plus',
          healthInsuranceProvider: 'LatterStageElderly',
        }}
        dispatch={mockDispatch}
      />,
    );
    expect(screen.getByRole('switch', { name: 'Estimate' })).toBeInTheDocument();
  });

  it('shows the estimated amount in the disabled field', () => {
    render(
      <TakeHomeInputForm
        inputs={{ ...baseInputs, ageRange: 'age65to69', longTermCareCategory1Premium: 5_000 }}
        dispatch={mockDispatch}
        longTermCareCategory1Estimate={{
          currentFiscalYear: { tier: 7, multiplier: 1.3, annualBase: 75_840, premium: 98_500 },
          baseScope: 'Tokyo',
          total: 98_500,
        }}
      />,
    );

    // The estimate displaces the stored manual amount while the switch is on, rather than the
    // two fighting over one field.
    const field = screen.getByLabelText('Annual Premium (estimate)');
    expect(field).toHaveValue('¥98,500');
    expect(field).toBeDisabled();
  });

  it('keeps the entered amount across a round trip through the estimate', async () => {
    // Runs on the real reducer so the field's two sources are exercised through actual state.
    // Note this does not reproduce the number formatter writing the estimate back over the
    // entered amount, which only happens in a browser; it pins the surrounding behaviour.
    const RoundTrip = () => {
      const [inputs, dispatch] = useReducer(takeHomeFormReducer, {
        ...baseInputs,
        ageRange: 'age65to69' as const,
        longTermCareCategory1ManualEntry: true,
        longTermCareCategory1Premium: 200_000,
      });
      return (
        <TakeHomeInputForm
          inputs={inputs}
          dispatch={dispatch}
          longTermCareCategory1Estimate={{
            currentFiscalYear: { tier: 7, multiplier: 1.3, annualBase: 75_840, premium: 98_500 },
            baseScope: 'Tokyo',
            total: 98_500,
          }}
        />
      );
    };
    const user = userEvent.setup();
    render(<RoundTrip />);

    expect(screen.getByLabelText('Annual Premium')).toHaveValue('¥200,000');

    await user.click(screen.getByRole('switch', { name: 'Estimate' }));
    expect(screen.getByLabelText('Annual Premium (estimate)')).toHaveValue('¥98,500');

    await user.click(screen.getByRole('switch', { name: 'Estimate' }));
    expect(screen.getByLabelText('Annual Premium')).toHaveValue('¥200,000');
  });

  it('shows the entered amount once the estimate is switched off', () => {
    render(
      <TakeHomeInputForm
        inputs={{
          ...baseInputs,
          ageRange: 'age65to69',
          longTermCareCategory1ManualEntry: true,
          longTermCareCategory1Premium: 5_000,
        }}
        dispatch={mockDispatch}
        longTermCareCategory1Estimate={undefined}
      />,
    );

    const field = screen.getByLabelText('Annual Premium');
    expect(field).toHaveValue('¥5,000');
    expect(field).not.toBeDisabled();
  });

  it('dispatches the manual-entry flag when the estimate switch is turned off', async () => {
    const user = userEvent.setup();
    render(
      <TakeHomeInputForm
        inputs={{ ...baseInputs, ageRange: 'age65to69' }}
        dispatch={mockDispatch}
      />,
    );

    await user.click(screen.getByRole('switch', { name: 'Estimate' }));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'setField',
      field: 'longTermCareCategory1ManualEntry',
      value: true,
    });
  });

  it('turns the estimate back on from manual entry', async () => {
    // The switch is driven by the negation of the stored field on both the checked prop and the
    // dispatched value, so the off-to-on direction fails independently of the on-to-off one.
    const user = userEvent.setup();
    render(
      <TakeHomeInputForm
        inputs={{ ...baseInputs, ageRange: 'age65to69', longTermCareCategory1ManualEntry: true }}
        dispatch={mockDispatch}
      />,
    );

    const estimateSwitch = screen.getByRole('switch', { name: 'Estimate' });
    expect(estimateSwitch).not.toBeChecked();
    await user.click(estimateSwitch);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'setField',
      field: 'longTermCareCategory1ManualEntry',
      value: false,
    });
  });

  it('dispatches setField for the 第1号 premium under manual entry', async () => {
    const user = userEvent.setup();
    render(
      <TakeHomeInputForm
        inputs={{ ...baseInputs, ageRange: 'age65to69', longTermCareCategory1ManualEntry: true }}
        dispatch={mockDispatch}
      />,
    );

    await user.type(screen.getByLabelText('Annual Premium'), '5');

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'setField',
      field: 'longTermCareCategory1Premium',
      value: 5,
    });
  });
});

describe('TakeHomeInputForm Dependents Modal', () => {
  const defaultInputs: TakeHomeFormState = {
    ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
    annualIncome: 0,
    incomeYear: 2026,
    incomeMode: 'advanced',
    incomeStreams: [],
    savedIncomeStreams: [],
    longTermCareCategory1ManualEntry: false,
    longTermCareCategory1Premium: 0,
    ageRange: 'age20to39' as const,
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
        { id: '2', type: 'business', amount: 5_000_000 },
      ],
    };

    const mockDispatch = vi.fn();

    render(<TakeHomeInputForm inputs={inputs} dispatch={mockDispatch} />);

    const modal = screen.getByTestId('dependents-modal');
    const netIncomePassed = Number(modal.getAttribute('data-net-income'));

    const expectedNetSalary = calculateNetEmploymentIncome(5_000_000, 2026);
    const expectedTotalNet = expectedNetSalary + 5_000_000;

    expect(netIncomePassed).toBe(expectedTotalNet);
  });
});

describe('TakeHomeInputForm Income Details Modal', () => {
  // Real reducer so switching the age range flows through the app's own state update.
  const TestWrapper = ({ ageRange }: { ageRange: 'age60to64' | 'age65to69' }) => {
    const [inputs, dispatch] = useReducer(takeHomeFormReducer, {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      annualIncome: 2_400_000,
      incomeYear: 2026,
      incomeMode: 'advanced' as const,
      incomeStreams: [{ id: 'p1', type: 'publicPension' as const, amount: 2_400_000 }],
      savedIncomeStreams: [],
      longTermCareCategory1ManualEntry: false,
      longTermCareCategory1Premium: 0,
      ageRange,
      healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      region: 'Tokyo',
      dcPlanContributions: 0,
      dependents: [],
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
    });

    return <TakeHomeInputForm inputs={inputs} dispatch={dispatch} />;
  };

  it('shows the age-appropriate 公的年金等控除 on the pension group', async () => {
    const user = userEvent.setup();
    render(<TestWrapper ageRange="age65to69" />);

    await user.click(screen.getByRole('button', { name: /edit income/i }));

    // 措法41の15の3: at 65 or older the band-1 minimum deduction is 1,100,000, above the
    // 400,000 + 25% × (2,400,000 − 500,000) = 875,000 the 所法35④一 formula gives.
    expect(screen.getByText(/Public Pension Deduction.*-¥1,100,000/)).toBeInTheDocument();
    expect(screen.getByText('Net Public Pension Income: ¥1,300,000')).toBeInTheDocument();

    // Under 65 the formula governs instead, so the same gross nets a smaller deduction.
    await user.click(screen.getByRole('button', { name: /close/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    await user.click(screen.getByRole('combobox', { name: 'Age' }));
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: '60-64' }));
    await user.click(screen.getByRole('button', { name: /edit income/i }));

    expect(screen.getByText(/Public Pension Deduction.*-¥875,000/)).toBeInTheDocument();
    expect(screen.getByText('Net Public Pension Income: ¥1,525,000')).toBeInTheDocument();
  }, 10_000);
});

describe('Commuting Allowance Integration', () => {
  // Real reducer so the displayed total income is derived exactly as it is in the app;
  // the point of this test is that the commuting allowance is excluded from that total.
  const TestWrapper = () => {
    const [inputs, dispatch] = useReducer(takeHomeFormReducer, {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      annualIncome: 5000000,
      incomeYear: 2026,
      incomeMode: 'advanced',
      incomeStreams: [{ id: '1', type: 'salary', amount: 5000000, frequency: 'annual' }],
      savedIncomeStreams: [],
      longTermCareCategory1ManualEntry: false,
      longTermCareCategory1Premium: 0,
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: 'KyokaiKenpo',
      region: 'Tokyo',
      dcPlanContributions: 0,
      dependents: [],
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
    });

    return <TakeHomeInputForm inputs={inputs} dispatch={dispatch} />;
  };

  it('should exclude commuting allowance from total annual income when added via UI', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    // The lone salary stream totals ¥5,000,000. Re-queried after each render since the
    // row is rebuilt when the streams change.
    const totalIncomeRow = () => screen.getByText('Total Annual Income').parentElement!;
    expect(within(totalIncomeRow()).getByText('¥5,000,000')).toBeInTheDocument();

    // 1. Open Income Details Modal
    await user.click(screen.getByRole('button', { name: /edit income/i }));

    // 2. Click Add Income
    await user.click(screen.getByRole('button', { name: /add income/i }));

    // 3. Select Commuting Allowance
    const typeSelect = screen.getByRole('combobox', { name: /income\/benefit type/i });
    await user.click(typeSelect);
    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getByRole('option', { name: /commuting allowance/i }));

    // 4. Enter Amount
    const amountInput = screen.getByRole('textbox', { name: /allowance amount/i });
    await user.type(amountInput, '20000');

    // 5. Save the stream and close the modal
    await user.click(screen.getByRole('button', { name: /add/i }));
    await user.click(screen.getByRole('button', { name: /close/i }));

    // The allowance was added — a nontaxable-benefits row now appears ...
    expect(screen.getByText('Total Nontaxable Benefits')).toBeInTheDocument();
    // ... but it is excluded from the total annual income, which stays ¥5,000,000.
    expect(within(totalIncomeRow()).getByText('¥5,000,000')).toBeInTheDocument();
  }, 10_000);
});

describe('Regression: Health Insurance Provider Auto-Correction', () => {
  // Wrapper component to manage state like the real application
  const TestWrapper = () => {
    const [inputs, dispatch] = useReducer(takeHomeFormReducer, {
      ...EMPTY_ADDITIONAL_DEDUCTION_INPUTS,
      annualIncome: 10000000,
      incomeYear: 2026,
      incomeMode: 'advanced',
      incomeStreams: [
        { id: '1', type: 'salary', amount: 6000000, frequency: 'annual' },
        { id: '2', type: 'business', amount: 4000000 },
      ],
      savedIncomeStreams: [],
      longTermCareCategory1ManualEntry: false,
      longTermCareCategory1Premium: 0,
      ageRange: 'age20to39' as const,
      healthInsuranceProvider: 'KyokaiKenpo', // An employee provider
      region: 'Tokyo',
      dcPlanContributions: 0,
      dependents: [],
      manualSocialInsuranceEntry: false,
      manualSocialInsuranceAmount: 0,
    });

    return <TakeHomeInputForm inputs={inputs} dispatch={dispatch} />;
  };

  it('should auto-switch to National Health Insurance when last employment income is removed via UI', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    // 1. Verify initial state (Kyokai Kenpo selected)
    const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
    expect(providerSelect).toHaveTextContent('Kyokai Kenpo');

    // 2. Open Income Details Modal
    await user.click(screen.getByRole('button', { name: /edit income/i }));

    // 3. Find and Delete the Salary stream
    // Look for the "SALARY" chip/text to find the right card
    const salaryChip = screen.getByText('SALARY');
    const salaryCard = salaryChip.closest('.MuiCard-root');
    expect(salaryCard).toBeInTheDocument();
    if (!salaryCard) throw new Error('Salary card not found');

    // Find the delete button within this card using the accessible name
    const deleteButton = within(salaryCard as HTMLElement).getByRole('button', {
      name: /delete income/i,
    });
    expect(deleteButton).toBeInTheDocument();

    await user.click(deleteButton);

    // 4. Close the Modal
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    // 5. Assert UI Outcome
    // The provider should now be "National Health Insurance"
    expect(providerSelect).toHaveTextContent('National Health Insurance');
  });
});
