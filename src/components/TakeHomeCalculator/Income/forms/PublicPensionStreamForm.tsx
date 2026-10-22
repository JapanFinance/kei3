// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type { PublicPensionIncomeStream, PublicPensionTreatyCredit } from '../../../../types/tax';
import { validateIncomeStream } from '../../../../utils/incomeStreams';
import { SIMPLE_TOOLTIP_ICON } from '../../../ui/constants';
import SourceLinks from '../../../ui/SourceLinks';
import { SpinnerNumberField } from '../../../ui/SpinnerNumberField';
import { DetailedTooltip } from '../../../ui/Tooltips';
import { variantLabelSx, variantToggleGroupSx } from '../variantControlStyles';
import {
  createStreamId,
  guidanceBoxSx,
  IncomeStreamFormShell,
  NTA_TAX_ANSWERS,
  StreamAmountField,
  type StreamTypeFormProps,
} from './streamFormShared';

export const PublicPensionStreamForm: React.FC<StreamTypeFormProps<'publicPension'>> = ({
  initialData,
  onSave,
  onCancel,
}) => {
  const [amount, setAmount] = useState<number>(initialData?.amount ?? 0);
  const [payerDomicile, setPayerDomicile] = useState<'domestic' | 'foreign'>(
    initialData?.payerDomicile ?? 'domestic',
  );
  const [treatyCredit, setTreatyCredit] = useState<PublicPensionTreatyCredit>(() => {
    if (initialData?.treatyCredit) {
      return initialData.treatyCredit;
    }
    if (initialData && initialData.foreignTax > 0) {
      return 'available';
    }
    return 'unavailable';
  });
  const [foreignTax, setForeignTax] = useState<number>(initialData?.foreignTax ?? 0);
  const [foreignTaxError, setForeignTaxError] = useState<string | null>(null);

  const handleSave = () => {
    const stream: PublicPensionIncomeStream = {
      id: createStreamId(initialData),
      type: 'publicPension',
      amount,
      payerDomicile,
      ...(payerDomicile === 'foreign' && { treatyCredit }),
      foreignTax: payerDomicile === 'foreign' && treatyCredit === 'available' ? foreignTax : 0,
    };
    const message = validateIncomeStream(stream);
    if (message) {
      setForeignTaxError(message);
      return;
    }
    setForeignTaxError(null);
    onSave(stream);
  };

  return (
    <IncomeStreamFormShell
      type="publicPension"
      isEditing={!!initialData}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <FormControl fullWidth>
        <FormLabel id="pension-payer-label" sx={variantLabelSx}>
          <span>Paid by</span>
          <DetailedTooltip
            title="Pension System"
            icon={SIMPLE_TOOLTIP_ICON}
            iconAriaLabel="pension system info"
          >
            <Typography sx={{ display: 'block', mb: 1 }}>
              <strong>Foreign system</strong> is a public pension under a foreign country&apos;s
              social insurance system.
            </Typography>
            <Typography sx={{ display: 'block', mb: 1 }}>
              When a foreign tax credit is available in Japan under a tax treaty or domestic law,
              foreign tax withheld is credited against Japanese income tax and residence tax, up to
              limits (the foreign tax credit, 外国税額控除). For that limit, the net income of the
              foreign pensions is worked out on their own, with a public pension deduction of their
              own.
            </Typography>
            <Typography sx={{ display: 'block' }}>
              <strong>Japanese system</strong> is a pension under a Japanese system, even when it is
              paid abroad.
            </Typography>
            {/* 所得税法第95条 */}
            <SourceLinks sources={[NTA_TAX_ANSWERS.foreignTaxCredit]} />
          </DetailedTooltip>
        </FormLabel>
        <ToggleButtonGroup
          value={payerDomicile}
          exclusive
          onChange={(_, newValue: 'domestic' | 'foreign' | null) => {
            if (newValue) {
              setPayerDomicile(newValue);
              if (newValue === 'domestic') {
                setForeignTax(0);
                setForeignTaxError(null);
              }
            }
          }}
          aria-labelledby="pension-payer-label"
          aria-label="pension system"
          size="small"
          sx={variantToggleGroupSx}
        >
          <ToggleButton value="domestic">Japanese system</ToggleButton>
          <ToggleButton value="foreign">Foreign system</ToggleButton>
        </ToggleButtonGroup>
      </FormControl>

      {payerDomicile === 'foreign' && (
        <FormControl fullWidth>
          <FormLabel id="pension-treaty-label" sx={variantLabelSx}>
            <span>Foreign tax credit in Japan</span>
            <DetailedTooltip
              title="Foreign Tax Credit on Public Pensions"
              icon={SIMPLE_TOOLTIP_ICON}
              iconAriaLabel="pension treaty info"
            >
              <Typography sx={{ display: 'block', mb: 1 }}>
                Under most tax treaties (e.g. the US, UK, Australia), public pensions are taxable
                only in the country of residence (Japan). Any foreign tax paid cannot be credited in
                Japan and must be refunded by the foreign authority. For US citizens taxed under the
                saving clause, double taxation is relieved on the US return (Form 1116) rather than
                in Japan.
              </Typography>
              <Typography sx={{ display: 'block', mb: 1 }}>
                <strong>Unavailable</strong> — The pension is taxed in Japan with the public pension
                deduction (公的年金等控除) and is excluded from foreign-source income for
                Japan&apos;s foreign tax credit limit.
              </Typography>
              <Typography sx={{ display: 'block', mb: 1 }}>
                <strong>Available</strong> — Foreign tax can be credited against Japanese tax up to
                statutory limits when:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1, '& li': { mb: 0.5 } }}>
                <li>
                  The treaty has no pension clause and the source country taxes the pension (e.g.
                  Canada&apos;s CPP and OAS, Sweden, Thailand).
                </li>
                <li>The treaty explicitly permits source-country taxation (e.g. Germany).</li>
                <li>
                  Foreign government or military service pensions where the paying country retains
                  taxation rights under the treaty (e.g. government service provisions).
                </li>
                <li>
                  Countries or territories without a tax treaty with Japan (e.g. Nepal, Myanmar,
                  Cambodia, Bolivia, Guam).
                </li>
              </Box>
              <Typography sx={{ display: 'block' }}>
                Pensions that are exempt from Japanese tax under a treaty should not be entered in
                this calculator.
              </Typography>
              {/* 所得税法第95条 */}
              <SourceLinks sources={[NTA_TAX_ANSWERS.foreignTaxCredit]} />
            </DetailedTooltip>
          </FormLabel>
          <ToggleButtonGroup
            value={treatyCredit}
            exclusive
            onChange={(_, newValue: PublicPensionTreatyCredit | null) => {
              if (newValue) {
                setTreatyCredit(newValue);
                if (newValue !== 'available') {
                  setForeignTax(0);
                  setForeignTaxError(null);
                }
              }
            }}
            aria-labelledby="pension-treaty-label"
            aria-label="foreign tax credit in Japan"
            size="small"
            sx={variantToggleGroupSx}
          >
            <ToggleButton value="unavailable">Unavailable</ToggleButton>
            <ToggleButton value="available">Available</ToggleButton>
          </ToggleButtonGroup>
          {treatyCredit === 'unavailable' && (
            <FormHelperText>
              No tax credit in Japan (e.g. US Social Security, UK State Pension, Australia).
            </FormHelperText>
          )}
          {treatyCredit === 'available' && (
            <FormHelperText>
              Foreign tax credit in Japan (e.g. Canada CPP/OAS, Germany, non-treaty countries).
            </FormHelperText>
          )}
        </FormControl>
      )}

      <Box>
        <StreamAmountField type="publicPension" value={amount} onChange={setAmount} />

        {payerDomicile === 'foreign' && treatyCredit === 'available' && (
          <SpinnerNumberField
            label="Foreign Tax Withheld (外国所得税)"
            value={foreignTax}
            onChange={val => {
              setForeignTax(val);
              setForeignTaxError(null);
            }}
            sx={{ width: '100%', mt: 2 }}
            helperText={foreignTaxError ?? 'In yen. The gross amount above includes it.'}
            error={!!foreignTaxError}
          />
        )}

        <Box sx={guidanceBoxSx}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            What Counts as Public Pension (公的年金等)
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.6 }}>
            National Pension (国民年金), Employees&apos; Pension (厚生年金保険), mutual-aid pensions
            (共済組合の年金), and pensions from past employment, including annuities received from
            defined benefit plans (確定給付企業年金) and defined contribution plans (確定拠出年金,
            such as iDeCo). Pensions from a foreign social insurance or mutual aid system comparable
            to the National Pension or Employees&apos; Pension are also included.
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            Disability pensions (障害年金) and survivors&apos; pensions (遺族年金) are non-taxable
            and should not be included. Payments from private individual annuity insurance
            (個人年金保険) are not considered public pension income. For private pensions, instead
            enter the amount net of the premiums paid as Miscellaneous Income.
          </Typography>
          <SourceLinks
            sources={[
              {
                href: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1600.htm',
                label: '公的年金等の課税関係 - NTA',
              },
            ]}
          />
        </Box>
      </Box>
    </IncomeStreamFormShell>
  );
};
