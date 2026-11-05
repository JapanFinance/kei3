// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DependentsModal } from '../components/TakeHomeCalculator/Dependents/DependentsModal';
import SpouseSection from '../components/TakeHomeCalculator/Dependents/SpouseSection';
import type { Dependent } from '../types/dependents';
import { DEFAULT_PROVIDER, NATIONAL_HEALTH_INSURANCE_ID } from '../types/healthInsurance';
import { makeDependent, makeSpouse } from './fixtures/dependents';

const INCOME_YEAR = 2026;

describe('SpouseSection', () => {
  it('toggles spouse creation and removal and stays synchronized with controlled spouse prop updates', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SpouseSection spouse={null} onChange={onChange} incomeYear={INCOME_YEAR} />,
    );

    const includeSwitch = screen.getByRole('switch', { name: 'Include spouse?' });
    expect(includeSwitch).not.toBeChecked();

    await user.click(includeSwitch);
    expect(onChange).toHaveBeenCalledTimes(1);
    const createdSpouse = onChange.mock.calls[0]![0];
    expect(createdSpouse).toMatchObject({
      relationship: 'spouse',
      ageRange: 'under40',
      isSameHousehold: true,
      isClaimedAsDependent: true,
      healthInsurance: 'auto',
      isHouseholdHead: false,
    });

    // External prop update from null -> spouse -> null reflects directly without stale local state
    rerender(
      <SpouseSection
        spouse={makeSpouse({ id: 'ext-spouse' })}
        onChange={onChange}
        incomeYear={INCOME_YEAR}
      />,
    );
    expect(screen.getByRole('switch', { name: 'Include spouse?' })).toBeChecked();
    expect(screen.getByText('Income Information')).toBeInTheDocument();

    rerender(<SpouseSection spouse={null} onChange={onChange} incomeYear={INCOME_YEAR} />);
    expect(screen.getByRole('switch', { name: 'Include spouse?' })).not.toBeChecked();
    expect(screen.queryByText('Income Information')).not.toBeInTheDocument();
  });

  it('shows the zero-impact notice when neither claimed for tax nor at the same address', () => {
    render(
      <SpouseSection
        spouse={makeSpouse({ isClaimedAsDependent: false, isSameHousehold: false })}
        onChange={vi.fn()}
        incomeYear={INCOME_YEAR}
      />,
    );

    expect(
      screen.getByText(/neither claimed for tax deductions nor registered at the same address/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Household & Health Insurance')).not.toBeInTheDocument();
  });

  it('shows the 75+ Latter-Stage Elderly notice instead of the insurance selector at 75plus', () => {
    render(
      <SpouseSection
        spouse={makeSpouse({ ageRange: '75plus', isSameHousehold: true })}
        onChange={vi.fn()}
        incomeYear={INCOME_YEAR}
      />,
    );

    expect(
      screen.getByText(/Aged 75\+: Enrolled in Medical System for the Elderly/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Health Insurance' })).not.toBeInTheDocument();
  });
});

describe('DependentsModal', () => {
  it('enforces at most one household head across spouse, added dependents, and edited dependents', async () => {
    const user = userEvent.setup();
    const onDependentsChange = vi.fn();

    const initialChild = makeDependent({
      id: 'child-1',
      relationship: 'child',
      ageRange: '23to39',
      isHouseholdHead: true,
    });
    const initialSpouse = makeSpouse({
      id: 'spouse-1',
      isHouseholdHead: false,
    });

    const { rerender } = render(
      <DependentsModal
        open
        onClose={vi.fn()}
        dependents={[initialSpouse, initialChild]}
        onDependentsChange={onDependentsChange}
        taxpayerNetIncome={4_000_000}
        incomeYear={INCOME_YEAR}
        healthInsuranceProvider={DEFAULT_PROVIDER}
      />,
    );

    // 1. Designating the spouse as household head clears isHouseholdHead on child-1
    await user.click(screen.getByRole('switch', { name: /Household head/ }));
    expect(onDependentsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'spouse-1', isHouseholdHead: true }),
      expect.objectContaining({ id: 'child-1', isHouseholdHead: false }),
    ]);

    const afterSpouseHead: Dependent[] = onDependentsChange.mock.lastCall![0];
    rerender(
      <DependentsModal
        open
        onClose={vi.fn()}
        dependents={afterSpouseHead}
        onDependentsChange={onDependentsChange}
        taxpayerNetIncome={4_000_000}
        incomeYear={INCOME_YEAR}
        healthInsuranceProvider={DEFAULT_PROVIDER}
      />,
    );

    // 2. Adding a new dependent designated as household head clears isHouseholdHead on spouse-1
    await user.click(screen.getByRole('button', { name: 'Add Dependent' }));
    await user.click(screen.getByRole('switch', { name: /Household head/ }));
    await user.click(screen.getByRole('button', { name: 'Add Dependent' }));

    const afterAddHead: Dependent[] = onDependentsChange.mock.lastCall![0];
    expect(afterAddHead).toHaveLength(3);
    expect(afterAddHead.filter(d => d.isHouseholdHead)).toHaveLength(1);
    expect(afterAddHead.find(d => d.id === 'spouse-1')?.isHouseholdHead).toBe(false);
    const addedId = afterAddHead[2]!.id;
    expect(afterAddHead[2]!.isHouseholdHead).toBe(true);

    rerender(
      <DependentsModal
        open
        onClose={vi.fn()}
        dependents={afterAddHead}
        onDependentsChange={onDependentsChange}
        taxpayerNetIncome={4_000_000}
        incomeYear={INCOME_YEAR}
        healthInsuranceProvider={DEFAULT_PROVIDER}
      />,
    );

    // 3. Editing child-1 to become household head clears isHouseholdHead on the added dependent
    const editButtons = screen.getAllByRole('button', { name: 'edit' });
    await user.click(editButtons[0]!);
    await user.click(screen.getByRole('switch', { name: /Household head/ }));
    await user.click(screen.getByRole('button', { name: 'Update Dependent' }));

    const afterEditHead: Dependent[] = onDependentsChange.mock.lastCall![0];
    expect(afterEditHead.find(d => d.id === 'child-1')?.isHouseholdHead).toBe(true);
    expect(afterEditHead.find(d => d.id === addedId)?.isHouseholdHead).toBe(false);
    expect(afterEditHead.find(d => d.id === 'spouse-1')?.isHouseholdHead).toBe(false);
  });

  it('shows Household NHI settings only when a member is on NHI, defaults region from main form region, and wires callbacks', async () => {
    const user = userEvent.setup();
    const onAttributionChange = vi.fn();
    const onRegionChange = vi.fn();

    // EHI taxpayer in Osaka with auto spouse -> spouse resolves to EHI, so no Household NHI card
    const { rerender } = render(
      <DependentsModal
        open
        onClose={vi.fn()}
        dependents={[makeSpouse({ healthInsurance: 'auto' })]}
        onDependentsChange={vi.fn()}
        taxpayerNetIncome={4_000_000}
        incomeYear={INCOME_YEAR}
        healthInsuranceProvider={DEFAULT_PROVIDER}
        region="Osaka"
        onNHIPaymentAttributionChange={onAttributionChange}
        onNHIHouseholdRegionChange={onRegionChange}
      />,
    );
    expect(screen.queryByText('Household National Health Insurance')).not.toBeInTheDocument();

    // Spouse explicitly enrolled in NHI -> card renders, region defaults to Osaka (not Tokyo!)
    rerender(
      <DependentsModal
        open
        onClose={vi.fn()}
        dependents={[makeSpouse({ healthInsurance: 'nhi' })]}
        onDependentsChange={vi.fn()}
        taxpayerNetIncome={4_000_000}
        incomeYear={INCOME_YEAR}
        healthInsuranceProvider={DEFAULT_PROVIDER}
        region="Osaka"
        onNHIPaymentAttributionChange={onAttributionChange}
        onNHIHouseholdRegionChange={onRegionChange}
      />,
    );

    expect(screen.getByText('Household National Health Insurance')).toBeInTheDocument();

    const regionSelect = screen.getByRole('combobox', {
      name: 'Household NHI Municipality / Region',
    });
    expect(regionSelect).toHaveTextContent(/Osaka/);

    await user.click(regionSelect);
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: /Nara Prefecture/ }),
    );
    expect(onRegionChange).toHaveBeenCalledWith('Nara');

    const attributionSelect = screen.getByRole('combobox', {
      name: 'Payment Attribution & Deduction',
    });
    await user.click(attributionSelect);
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: 'Not paid by taxpayer' }),
    );
    expect(onAttributionChange).toHaveBeenCalledWith('none');

    // When taxpayer themselves is on NHI, the secondary region dropdown is hidden
    rerender(
      <DependentsModal
        open
        onClose={vi.fn()}
        dependents={[makeSpouse({ healthInsurance: 'auto' })]}
        onDependentsChange={vi.fn()}
        taxpayerNetIncome={4_000_000}
        incomeYear={INCOME_YEAR}
        healthInsuranceProvider={NATIONAL_HEALTH_INSURANCE_ID}
        region="Osaka"
      />,
    );
    expect(screen.getByText('Household National Health Insurance')).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Household NHI Municipality / Region' }),
    ).not.toBeInTheDocument();
  });

  it('renders status chips accurately for household and non-household dependents', () => {
    render(
      <DependentsModal
        open
        onClose={vi.fn()}
        dependents={[
          makeDependent({
            id: 'd1',
            isClaimedAsDependent: false,
            isSameHousehold: false,
          }),
          makeDependent({
            id: 'd2',
            ageRange: '75plus',
            isSameHousehold: true,
            isHouseholdHead: true,
          }),
          makeDependent({
            id: 'd3',
            ageRange: '23to39',
            isSameHousehold: true,
            healthInsurance: 'nhi',
          }),
        ]}
        onDependentsChange={vi.fn()}
        taxpayerNetIncome={4_000_000}
        incomeYear={INCOME_YEAR}
        healthInsuranceProvider={DEFAULT_PROVIDER}
      />,
    );

    expect(screen.getByText('Not tax dependent')).toBeInTheDocument();
    expect(screen.getByText('No tax/NHI impact')).toBeInTheDocument();
    expect(screen.getByText('75+ Elderly Medical')).toBeInTheDocument();
    expect(screen.getByText('Household Head')).toBeInTheDocument();
    expect(screen.getByText('NHI')).toBeInTheDocument();
  });
});
