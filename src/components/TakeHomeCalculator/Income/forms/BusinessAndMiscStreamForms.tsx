// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import React, { useState } from 'react';

import type { BusinessIncomeStream, MiscellaneousIncomeStream } from '../../../../types/tax';
import {
  createStreamId,
  IncomeStreamFormShell,
  StreamAmountField,
  type StreamTypeFormProps,
} from './streamFormShared';

export const BusinessStreamForm: React.FC<StreamTypeFormProps<'business'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);

  const handleSave = () => {
    const stream: BusinessIncomeStream = {
      id: createStreamId(initialData),
      type: 'business',
      amount,
      ...(initialData?.blueFilerDeduction !== undefined && {
        blueFilerDeduction: initialData.blueFilerDeduction,
      }),
    };
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="business"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <Box>
        <StreamAmountField type="business" value={amount} onChange={setAmount} />
      </Box>
    </IncomeStreamFormShell>
  );
};

export const MiscellaneousStreamForm: React.FC<StreamTypeFormProps<'miscellaneous'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);

  const handleSave = () => {
    const stream: MiscellaneousIncomeStream = {
      id: createStreamId(initialData),
      type: 'miscellaneous',
      amount,
    };
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="miscellaneous"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <Box>
        <StreamAmountField type="miscellaneous" value={amount} onChange={setAmount} />
      </Box>
    </IncomeStreamFormShell>
  );
};
