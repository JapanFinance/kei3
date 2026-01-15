// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, fireEvent } from '@testing-library/react';
import { SpinnerNumberField } from '../components/ui/SpinnerNumberField';

describe('SpinnerNumberField', () => {
  it('renders with initial value and formats numbers with commas and yen symbol', () => {
    const mockOnChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={123456}
        onChange={mockOnChange}
        label="Test Amount"
      />
    );

    const input = screen.getByLabelText(/Test Amount/i);
    expect(input).toBeInTheDocument();
    
    // The input should display the formatted value with commas and yen symbol
    expect(input.getAttribute('value')).toBe('¥123,456');
  });

  it('calls onChange with numeric value when user types', () => {
    const mockOnChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={0}
        onChange={mockOnChange}
        label="Test Amount"
      />
    );

    const input = screen.getByLabelText(/Test Amount/i);
    
    // Simulate user typing
    fireEvent.change(input, { target: { value: '¥789,000' } });
    
    // onChange should be called with the numeric value
    expect(mockOnChange).toHaveBeenCalledWith(789000);
  });

  it('handles up and down arrow keys for increment/decrement', () => {
    const mockOnChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={100000}
        onChange={mockOnChange}
        label="Test Amount"
        step={10000}
      />
    );

    const input = screen.getByLabelText(/Test Amount/i);
    
    // Test arrow up - should increment by step
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(mockOnChange).toHaveBeenCalledWith(110000);
    
    // Test arrow down - should decrement by step
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(mockOnChange).toHaveBeenCalledWith(90000);
  });

  it('handles shift+arrow keys for larger increments', () => {
    const mockOnChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={100000}
        onChange={mockOnChange}
        label="Test Amount"
        step={10000}
        shiftStep={100000}
      />
    );

    const input = screen.getByLabelText(/Test Amount/i);
    
    // Test shift+arrow up - should increment by shiftStep
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true });
    expect(mockOnChange).toHaveBeenCalledWith(200000);
  });

  it('prevents negative values when using arrow keys', () => {
    const mockOnChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={5000}
        onChange={mockOnChange}
        label="Test Amount Near Min"
        step={10000}
      />
    );
    
    const input = screen.getByLabelText(/Test Amount Near Min/i);
    
    // Test arrow down near min - should cap at 0 (not go negative)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(mockOnChange).toHaveBeenCalledWith(0);
  });

  it('handles spinner button clicks for increment/decrement', () => {
    const mockOnChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={100000}
        onChange={mockOnChange}
        label="Test Amount"
        step={5000}
      />
    );

    // Find the spinner buttons by their icons
    const upButton = screen.getByTestId('KeyboardArrowUpIcon').closest('button');
    const downButton = screen.getByTestId('KeyboardArrowDownIcon').closest('button');
    
    // Test up button click
    fireEvent.click(upButton!);
    expect(mockOnChange).toHaveBeenCalledWith(105000);
    
    // Test down button click  
    fireEvent.click(downButton!);
    expect(mockOnChange).toHaveBeenCalledWith(95000);
  });

  it('displays yen symbol prefix in formatted input', () => {
    const mockOnChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={1500000}
        onChange={mockOnChange}
        label="Test Amount"
      />
    );

    const input = screen.getByLabelText(/Test Amount/i);
    
    // Should show formatted value with yen prefix
    expect(input.getAttribute('value')).toBe('¥1,500,000');
  });

  it('works with onInputChange event handler pattern', () => {
    const mockOnInputChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={100000}
        onInputChange={mockOnInputChange}
        name="testField"
        label="Test Amount"
      />
    );

    const input = screen.getByLabelText(/Test Amount/i);
    
    // Test arrow key with event handler pattern
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    
    // Should call onInputChange with a synthetic event
    expect(mockOnInputChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          name: 'testField',
          value: 101000,
          type: 'number'
        })
      })
    );
  });

  it('has inputMode="numeric" for mobile keyboard support', () => {
    const mockOnChange = vi.fn();
    
    render(
      <SpinnerNumberField
        value={100000}
        onChange={mockOnChange}
        label="Test Amount"
      />
    );

    const input = screen.getByLabelText(/Test Amount/i);
    
    // Should have inputMode="numeric" attribute for mobile keyboards
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });
});
