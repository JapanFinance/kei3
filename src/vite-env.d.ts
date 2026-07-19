// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="vite/client" />

// Extend Chart.js types to include our custom plugin
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ChartType } from 'chart.js';

declare module 'chart.js' {
  interface PluginOptionsByType {
    customPlugin?: {
      id?: string;
      data?: {
        currentIncomePosition: number;
        medianIncomePosition: number;
        currentIncome: number;
      };
    };
    quintileBands?: {
      /** The selected household type's quintile boundary incomes (Q20/Q40/Q60/Q80), in yen.
       * Not marked optional: the plugin draws nothing without them, and Chart.js wraps every
       * plugin option in DeepPartial anyway, so use sites see them as possibly-undefined
       * regardless. */
      boundaries: number[];
    };
  }
}
