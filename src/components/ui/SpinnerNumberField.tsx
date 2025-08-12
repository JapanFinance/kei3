import React from 'react';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { NumericFormat } from 'react-number-format';

interface SpinnerNumberFieldProps {
  id?: string;
  name?: string;
  label?: string;
  value: number;
  onChange?: (value: number) => void;
  onInputChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  shiftStep?: number;
  sx?: object;
}

export const SpinnerNumberField: React.FC<SpinnerNumberFieldProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  onInputChange,
  step = 1000,
  shiftStep = 10000,
  sx,
}) => {
  const handleChange = (newValue: number) => {
    if (onChange) {
      onChange(newValue);
    } else if (onInputChange && name) {
      const event = {
        target: {
          name,
          value: newValue,
          type: 'number'
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onInputChange(event);
    }
  };

  const handleIncrement = () => {
    handleChange(value + step);
  };

  const handleDecrement = () => {
    handleChange(Math.max(0, value - step));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentStep = e.shiftKey ? shiftStep : step;
      const newValue = e.key === 'ArrowUp' 
        ? value + currentStep 
        : Math.max(0, value - currentStep);
      handleChange(newValue);
    }
  };

  return (
    <NumericFormat
      customInput={TextField}
      {...(id && { id })}
      {...(name && { name })}
      value={value}
      onValueChange={(values) => {
        handleChange(values.floatValue || 0);
      }}
      onKeyDown={handleKeyDown}
      thousandSeparator=","
      prefix="¥"
      allowNegative={false}
      {...(label && { label })}
      inputMode="numeric"
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <IconButton
                  size="small"
                  onClick={handleIncrement}
                  sx={{ p: 0.25, height: 16 }}
                >
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleDecrement}
                  sx={{ p: 0.25, height: 16 }}
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
              </Box>
            </InputAdornment>
          ),
        },
      }}
      {...(sx && { sx })}
    />
  );
};
