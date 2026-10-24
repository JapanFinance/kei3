// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';

import type { IncomeStream, IncomeStreamType } from '../../../types/tax';
import { BusinessStreamForm, MiscellaneousStreamForm } from './forms/BusinessAndMiscStreamForms';
import {
  CapitalGainsStreamForm,
  InterestStreamForm,
} from './forms/CapitalGainsAndInterestStreamForms';
import { DividendsStreamForm } from './forms/DividendsStreamForm';
import {
  BonusStreamForm,
  CommutingAllowanceStreamForm,
  SalaryStreamForm,
  StockCompensationStreamForm,
} from './forms/EmploymentStreamForms';
import { PublicPensionStreamForm } from './forms/PublicPensionStreamForm';
import { RealEstateStreamForm } from './forms/RealEstateStreamForm';
import { MINIMUM_TAX_REPORTING_NOTE, type StreamTypeFormProps } from './forms/streamFormShared';
import { WithholdingAccountStreamForm } from './forms/WithholdingAccountStreamForm';

export { MINIMUM_TAX_REPORTING_NOTE };

export interface IncomeStreamFormProps {
  /**
   * Fixed for the life of the form: chosen before the form opens when adding, or taken from
   * {@link initialData} when editing.
   */
  type: IncomeStreamType;
  initialData?: IncomeStream;
  onSave: (stream: IncomeStream) => void;
  onCancel: () => void;
  /**
   * Tests whether a draft stream triggers the High Income Minimum Tax (措法41条の19)
   * under the current tax return inputs.
   */
  isMinimumTaxTriggered?: ((draft: IncomeStream) => boolean) | undefined;
}

const STREAM_FORM_COMPONENTS: { [T in IncomeStreamType]: React.FC<StreamTypeFormProps<T>> } = {
  salary: SalaryStreamForm,
  bonus: BonusStreamForm,
  commutingAllowance: CommutingAllowanceStreamForm,
  stockCompensation: StockCompensationStreamForm,
  business: BusinessStreamForm,
  realEstate: RealEstateStreamForm,
  miscellaneous: MiscellaneousStreamForm,
  publicPension: PublicPensionStreamForm,
  withholdingAccount: WithholdingAccountStreamForm,
  capitalGains: CapitalGainsStreamForm,
  dividends: DividendsStreamForm,
  interest: InterestStreamForm,
};

export const IncomeStreamForm: React.FC<IncomeStreamFormProps> = ({
  type,
  initialData,
  onSave,
  onCancel,
  isMinimumTaxTriggered,
}) => {
  // STREAM_FORM_COMPONENTS is exhaustively typed over every IncomeStreamType above.
  const Component = STREAM_FORM_COMPONENTS[type] as React.FC<StreamTypeFormProps>;
  const key = initialData ? `${type}-${initialData.id}` : type;
  const typedInitialData = initialData?.type === type ? initialData : undefined;

  return (
    <Component
      key={key}
      initialData={typedInitialData}
      onSave={onSave}
      onCancel={onCancel}
      isMinimumTaxTriggered={isMinimumTaxTriggered}
    />
  );
};
