// Copyright the original author or authors
import React from 'react';
import InfoTooltip from './InfoTooltip';
import CalculateIcon from '@mui/icons-material/Calculate';

const detailIconSx = { p: 0.25, ml: 0.3, color: 'text.secondary', verticalAlign: 'middle' };

const DetailInfoTooltip: React.FC<React.ComponentProps<typeof InfoTooltip>> = (props) => (
  <InfoTooltip
    icon={<CalculateIcon fontSize="small" />}
    iconSx={detailIconSx}
    iconAriaLabel="More calculation info"
    {...props}
  />
);

export default DetailInfoTooltip;
