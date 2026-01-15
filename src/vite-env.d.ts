// Copyright the original author or authors
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
