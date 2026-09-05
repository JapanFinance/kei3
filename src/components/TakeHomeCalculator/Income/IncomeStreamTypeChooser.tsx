// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { IncomeStream, IncomeStreamType } from '../../../types/tax';
import {
  INCOME_CATEGORIES,
  INCOME_STREAM_CATALOG,
  INCOME_STREAM_TYPES,
  incomeStreamTypesInCategory,
  isIncomeStreamTypeAtLimit,
} from './incomeStreamCatalog';

interface IncomeStreamTypeChooserProps {
  /** Existing streams, so types already at their limit are shown disabled. */
  streams: readonly IncomeStream[];
  onSelect: (type: IncomeStreamType) => void;
}

/** The first step of adding an income stream: the type, grouped by income classification. */
export const IncomeStreamTypeChooser: React.FC<IncomeStreamTypeChooserProps> = ({
  streams,
  onSelect,
}) => {
  const firstEnabledType = INCOME_STREAM_TYPES.find(
    type => !isIncomeStreamTypeAtLimit(type, streams),
  );

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Choose the type of income or benefit to add.
      </Typography>
      {INCOME_CATEGORIES.map(category => {
        const headingId = `income-type-group-${category.key}`;
        return (
          <div key={category.key}>
            <Typography
              id={headingId}
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1, ml: 0.5 }}
            >
              {category.heading}
            </Typography>
            <List
              disablePadding
              aria-labelledby={headingId}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              {incomeStreamTypesInCategory(category.key).map((type, index, types) => {
                const info = INCOME_STREAM_CATALOG[type];
                const atLimit = isIncomeStreamTypeAtLimit(type, streams);
                return (
                  <ListItemButton
                    key={type}
                    autoFocus={type === firstEnabledType}
                    disabled={atLimit}
                    divider={index < types.length - 1}
                    onClick={() => onSelect(type)}
                    sx={{ '&.Mui-disabled': { opacity: 1, color: 'text.disabled' } }}
                  >
                    <ListItemText
                      primary={info.label}
                      secondary={
                        atLimit
                          ? 'Already added. Edit the existing entry instead.'
                          : info.description
                      }
                      slotProps={{ secondary: { color: atLimit ? 'inherit' : undefined } }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </div>
        );
      })}
    </Stack>
  );
};
