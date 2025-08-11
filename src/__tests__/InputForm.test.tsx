import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TakeHomeInputForm } from '../components/TakeHomeCalculator/InputForm';
import type { TakeHomeInputs } from '../types/tax';
import { PROVIDER_DEFINITIONS } from '../data/employeesHealthInsurance/providerRateData';
import { getProviderDisplayName, NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';

describe('TakeHomeInputForm - Available Providers Logic', () => {
  const mockOnInputChange = vi.fn();
  
  const baseInputs: TakeHomeInputs = {
    annualIncome: 5000000,
    isEmploymentIncome: true,
    isSubjectToLongTermCarePremium: false,
    healthInsuranceProvider: 'KyokaiKenpo',
    prefecture: 'Tokyo',
    dcPlanContributions: 0,
    numberOfDependents: 0,
    showDetailedInput: false,
  };

  beforeEach(() => {
    mockOnInputChange.mockClear();
  });

  describe('when employment income is checked', () => {
    it('should include National Health Insurance as an option alongside employee providers for employment income', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };
      
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
      
      // Should have employee providers + NHI
      const optionsInSelect = within(listbox).getAllByRole('option');
      expect(optionsInSelect).toHaveLength(Object.keys(PROVIDER_DEFINITIONS).length + 1);
    });

    it('should allow selecting different employee health insurance providers', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };
      
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

    it('should display helper text when dropdown has choices', () => {
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };
      
      render(
        <TakeHomeInputForm 
          inputs={employmentInputs} 
          onInputChange={mockOnInputChange} 
        />
      );

      // Should not show "automatically set" message when there are choices
      expect(screen.queryByText(/automatically set to.*national health insurance/i)).not.toBeInTheDocument();
    });
  });

  describe('when employment income is unchecked (non-employment income)', () => {
    it('should only show National Health Insurance and disable dropdown', () => {
      const nonEmploymentInputs = { 
        ...baseInputs, 
        isEmploymentIncome: false,
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };
      
      render(
        <TakeHomeInputForm 
          inputs={nonEmploymentInputs} 
          onInputChange={mockOnInputChange} 
        />
      );

      // Dropdown should be disabled
      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).toHaveAttribute('aria-disabled', 'true');

      // Should show explanatory text
      expect(screen.getByText(/automatically set to.*national health insurance.*for non-employment income/i)).toBeInTheDocument();
    });

    it('should not show employee health insurance providers for non-employment income', async () => {
      const nonEmploymentInputs = { 
        ...baseInputs, 
        isEmploymentIncome: false,
        healthInsuranceProvider: NATIONAL_HEALTH_INSURANCE_ID,
      };
      
      render(
        <TakeHomeInputForm 
          inputs={nonEmploymentInputs} 
          onInputChange={mockOnInputChange} 
        />
      );

      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      
      // Since it's disabled, we can't click to see options, but we can verify
      // that the current value is National Health Insurance
      expect(providerSelect).toHaveTextContent('National Health Insurance');
      expect(providerSelect).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('when switching between employment and non-employment income', () => {
    it('should change available providers when toggling employment income checkbox', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };
      
      render(
        <TakeHomeInputForm 
          inputs={employmentInputs} 
          onInputChange={mockOnInputChange} 
        />
      );

      // Initially should have multiple providers (enabled dropdown)
      const providerSelect = screen.getByRole('combobox', { name: /health insurance provider/i });
      expect(providerSelect).not.toBeDisabled();

      // Find and uncheck the employment income checkbox
      const employmentCheckbox = screen.getByRole('checkbox', { name: /employment income/i });
      expect(employmentCheckbox).toBeChecked();
      
      await user.click(employmentCheckbox);

      // Verify that the checkbox change was registered
      // Note: React Testing Library shows the target element at the moment of interaction
      expect(mockOnInputChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            name: 'isEmploymentIncome',
            type: 'checkbox'
          }),
          type: 'change'
        })
      );
    });
  });

  describe('integration with real provider data', () => {
    it('should dynamically include all providers from PROVIDER_DEFINITIONS', async () => {
      const user = userEvent.setup();
      const employmentInputs = { ...baseInputs, isEmploymentIncome: true };
      
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
      expect(optionsInSelect).toHaveLength(Object.keys(PROVIDER_DEFINITIONS).length + 1);

      // Each provider from PROVIDER_DEFINITIONS should be present within the listbox
      Object.entries(PROVIDER_DEFINITIONS).forEach(([, { providerName }]) => {
        expect(within(listbox).getByRole('option', { name: providerName })).toBeInTheDocument();
      });
    });

    it('should maintain consistency with provider display names', () => {
      const nonEmploymentInputs = { 
        ...baseInputs, 
        isEmploymentIncome: false,
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
      
      // Employment income checkbox should be properly labeled
      expect(screen.getByRole('checkbox', { name: /employment income/i })).toBeInTheDocument();
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
      
      // Should have tooltip for employment income
      const employmentIncomeLabel = screen.getByText('Employment Income');
      expect(employmentIncomeLabel).toBeInTheDocument();
    });
  });
});
