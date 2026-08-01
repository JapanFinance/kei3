// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="vite/client" />

// This file has top-level imports, so it is a module: globals it declares need
// the `declare global` wrapper to be visible to the rest of the app.
declare global {
  /**
   * Newest date in CHANGELOG.md (yyyy-mm-dd), inlined by the build; empty when
   * the changelog has no dated entries. Defined in changelogDate.ts.
   */
  const __LATEST_CHANGELOG_DATE__: string;
}

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
