// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { NumericFormat } from 'react-number-format';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

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
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  helperText?: React.ReactNode;
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
  inputProps,
  prefix = "¥",
  suffix = "",
  min = 0,
  max,
  helperText,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const handleChange = (newValue: number) => {
    let clampedValue = newValue;
    if (typeof min === 'number') clampedValue = Math.max(min, clampedValue);
    if (typeof max === 'number') clampedValue = Math.min(max, clampedValue);

    if (onChange) {
      onChange(clampedValue);
    } else if (onInputChange && name) {
      const event = {
        target: {
          name,
          value: clampedValue,
          type: 'number'
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onInputChange(event);
    }
  };

  // Helper to avoid floating point errors (e.g. 0.1 + 0.2 = 0.30000000000000004)
  const roundFloatingPoint = (result: number) => {
    // Round to 10 decimal places to strip floating point artifacts
    return Math.round(result * 1e10) / 1e10;
  };

  const handleIncrement = () => {
    handleChange(roundFloatingPoint(value + step));
  };

  const handleDecrement = () => {
    handleChange(roundFloatingPoint(value - step));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentStep = e.shiftKey ? shiftStep : step;
      const newValue = e.key === 'ArrowUp' 
        ? roundFloatingPoint(value + currentStep) 
        : roundFloatingPoint(value - currentStep);
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
      isAllowed={(values) => {
        const { floatValue } = values;
        if (floatValue === undefined) return true;
        if (typeof min === 'number' && floatValue < min) return false;
        if (typeof max === 'number' && floatValue > max) return false;
        return true;
      }}
      onKeyDown={handleKeyDown}
      thousandSeparator=","
      prefix={prefix}
      suffix={suffix}
      allowNegative={min < 0}
      {...(label && { label })}
      {...(helperText && { helperText })}
      size="small"
      slotProps={{
        htmlInput: {
          inputMode: "numeric",
          ...inputProps,
        },
        input: {
          endAdornment: !isMobile ? (
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
          ) : undefined,
        },
      }}
      {...(sx && { sx })}
    />
  );
};
