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
  }
}
