// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CalculateIcon from '@mui/icons-material/Calculate';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type SimpleTooltip from './SimpleTooltip';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type DetailedTooltip from './DetailedTooltip';

/**
 * Default icon for {@link SimpleTooltip} component.
 * Represents general informational tooltips with brief explanations.
 */
export const SIMPLE_TOOLTIP_ICON = <HelpOutlineIcon fontSize="small" />;

/**
 * Default icon for {@link DetailedTooltip} component.
 * Represents detailed calculation/breakdown tooltips with rich content.
 */
export const DETAILED_TOOLTIP_ICON = <CalculateIcon fontSize="small" />;
