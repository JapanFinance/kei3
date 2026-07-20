// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import CalculateIcon from '@mui/icons-material/Calculate';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SimpleTooltip, DetailedTooltip } from './Tooltips';

/**
 * Default icon for {@link SimpleTooltip} component.
 * Represents general informational tooltips with brief explanations.
 */
export const SIMPLE_TOOLTIP_ICON = <HelpOutlineOutlinedIcon fontSize="small" />;

/**
 * Default icon for {@link DetailedTooltip} component.
 * Represents detailed calculation/breakdown tooltips with rich content.
 */
export const DETAILED_TOOLTIP_ICON = <CalculateIcon fontSize="small" />;
