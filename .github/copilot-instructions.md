# Kei3 - Japan Tax Calculator

A React TypeScript application providing take-home pay calculations for Japan using Material-UI, deployed on Cloudflare Pages.

## Architecture Overview

This is a single-page application built around a **reactive tax calculation engine** that immediately recalculates results as inputs change. The core flow:

1. **Input Form** (`components/TakeHomeCalculator/InputForm.tsx`) - Complex multi-section form with health insurance provider selection
2. **Tax Engine** (`utils/taxCalculations.ts`) - Main calculation orchestrator calling specialized calculators
3. **Results Display** (`components/TakeHomeCalculator/TakeHomeResults.tsx`) - Tabbed results with detailed breakdowns
4. **Chart Visualization** (`components/TakeHomeCalculator/TakeHomeChart.tsx`) - Interactive Chart.js visualization

## Key Technical Patterns

### Tax Calculation Architecture
- **Main Calculator**: `calculateTaxes()` in `utils/taxCalculations.ts` orchestrates all calculations
- **Specialized Calculators**: Separate modules for health insurance, pension, residence tax, etc.
- **Immediate Updates**: `useEffect` in `App.tsx` triggers recalculation on any input change
- **Type Safety**: Comprehensive TypeScript interfaces in `types/tax.ts` and `types/healthInsurance.ts`

### Data Organization
- **Health Insurance**: Two-tier system with employees' insurance (`data/employeesHealthInsurance/`) and national insurance (`data/nationalHealthInsurance/`)
- **Provider Data**: Structured as `ProviderDefinition` with regional rate variations in `providerRateData.ts`
- **Regional Logic**: Health insurance providers tied to specific regions with fallback handling

### Component Patterns
- **Lazy Loading**: Results and charts are lazy-loaded with `Suspense` boundaries
- **Controlled Components**: All form inputs controlled via `inputs` state in `App.tsx`
- **Responsive Design**: MUI breakpoints used throughout, mobile-first approach
- **Custom Components**: `SpinnerNumberField` for numeric inputs, `InfoTooltip` for contextual help

## Development Workflow

### Commands
```bash
npm run dev          # Vite dev server (port 5173)
npm run build       # TypeScript compilation + Vite build
npm run deploy      # Cloudflare Pages deployment via Wrangler
```

### Testing Strategy
When running tests, do not use the command line directly.
Instead, use the IDE's test runner for better integration.
You get stuck when the command line is waiting for input if you run tests using the command line.

- **Unit Tests**: Focus on calculation accuracy (see `__tests__/taxCalculations.test.ts`)
- **Component Tests**: React Testing Library for UI components
- **Test Environment**: Vitest with jsdom, setup in `test-setup.ts`

### Code Organization
- **Barrel Exports**: Not used - direct imports preferred
- **Utility Functions**: Pure functions with comprehensive JSDoc comments
- **Type Imports**: Use `import type` for type-only imports
- **Constants**: Defined near usage (e.g., `DEFAULT_PROVIDER` in types file)

## Critical Implementation Details

### Health Insurance Provider Logic
The app handles two distinct health insurance systems:
- **Employees' Health Insurance**: Regional providers with varying rates (Tokyo, Osaka, etc.)
- **National Health Insurance**: Municipal system with region-specific calculations

Provider selection affects both premium calculation and available regions. See `getProviderDisplayName()` in `types/healthInsurance.ts`.

### Tax Calculation Specifics
- **Employment Income Deduction**: Complex bracketed system in `calculateNetEmploymentIncome()`
- **Rounding Rules**: Employment insurance uses special monthly rounding (0.50 yen threshold)
- **Furusato Nozei**: Donation tax benefit calculations with multiple components

### Performance Considerations
- **Bundle Splitting**: Manual chunks for React, MUI, and Chart.js in `vite.config.ts`
- **Lazy Loading**: Results components loaded on-demand
- **Memo Usage**: Minimal - calculations are fast enough for real-time updates

### Deployment
- **Target**: Cloudflare Pages with custom domain `kei3.japanfinance.org`
- **Build Output**: Static site in `dist/` directory
- **Assets**: Auto-chunked with source maps enabled

## Common Modification Patterns

When adding new tax calculations, follow the pattern in existing calculators:
1. Create pure calculation function in `utils/`
2. Add result properties to `TakeHomeResults` interface
3. Update main `calculateTaxes()` orchestrator
4. Add corresponding display components in results tabs
5. Write comprehensive unit tests covering edge cases

The codebase prioritizes calculation accuracy and transparency - all formulas include source references to official Japanese tax documentation.

If the change is noteworthy, add an entry to the `CHANGELOG.md` summarizing the update for users.
Entries have a specific format and are processed for displaying to users in the "What's New" dialog.

## Critical Rule: Official Sources Only

**NEVER infer, guess, or calculate tax amounts based on patterns or ratios.** Japanese tax law specifies exact amounts in legislation, not mathematical formulas.

When implementing tax calculations:
1. **Always reference official government sources** for exact amounts:
   - National Tax (income tax): [NTA (National Tax Agency)](https://www.nta.go.jp/)
   - Residence Tax: Local government websites (e.g., [Nerima City](https://www.city.nerima.tokyo.jp/))
2. **Use lookup tables with exact legislated values**, not calculated ratios
3. **Document the source URL** in code comments for each value
4. **Verify against multiple official sources** when implementing new features
5. **If official values cannot be found**, request clarification rather than guessing

Example: Spouse deductions use specific amounts (38万, 26万, 13万) defined by law, not ratios like "2/3" or "1/3" of base amounts.
