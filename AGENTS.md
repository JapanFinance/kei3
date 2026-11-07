# Kei3 - Japan Tax & Take-Home Pay Calculator

A React 19 + TypeScript single-page application calculating Japanese take-home pay, income tax, residence tax, and social insurance, built with Material-UI and Vite and deployed on Cloudflare Workers.

## Architecture Overview

The app is built around a synchronous, pure calculation engine that recomputes results as form state changes:

1. **Form State & Reducer** ([`src/state/takeHomeFormReducer.ts`](src/state/takeHomeFormReducer.ts), [`src/App.tsx`](src/App.tsx)) — All user inputs live in `TakeHomeFormState` managed by `useReducer(takeHomeFormReducer, ...)`. `App.tsx` passes `useDeferredValue(inputs)` into `useMemo(() => calculateTaxes(deferredInputs), [deferredInputs])` so rapid input changes stay responsive while heavy views (`TakeHomeResults`, `TakeHomeChart`) are lazy-loaded and `React.memo`-wrapped.
2. **Input Form** ([`src/components/TakeHomeCalculator/InputForm.tsx`](src/components/TakeHomeCalculator/InputForm.tsx)) — Supports "Salary only" (`salary`) and multi-stream "Advanced" (`advanced`) income modes, health insurance selection, household/dependents configuration ([`src/components/TakeHomeCalculator/Dependents/`](src/components/TakeHomeCalculator/Dependents)), and additional deductions/credits ([`src/components/TakeHomeCalculator/AdditionalDeductionsModal.tsx`](src/components/TakeHomeCalculator/AdditionalDeductionsModal.tsx)).
3. **Tax & Social Insurance Engine** ([`src/utils/taxCalculations.ts`](src/utils/taxCalculations.ts)) — `calculateTaxes()` orchestrates specialized pure calculators in [`src/utils/`](src/utils) using statutory tables and parameters in [`src/data/`](src/data).
4. **Results & Visualization** ([`src/components/TakeHomeCalculator/TakeHomeResults.tsx`](src/components/TakeHomeCalculator/TakeHomeResults.tsx), [`src/components/TakeHomeCalculator/TakeHomeChart.tsx`](src/components/TakeHomeCalculator/TakeHomeChart.tsx)) — Tabbed breakdowns with explanatory tooltips/reference tables and an interactive Chart.js visualization across income levels.

## Commands & Verification

```bash
npm run dev                                               # Vite dev server
npm run build                                             # TypeScript check (tsc -b) + Vite production build
npm run size:summary                                      # 1-line bundle size summary (or npm run size)
npm run lint                                              # Type-aware oxlint (npm run lint:fix to autofix)
npm run format                                            # Format with oxfmt (*.md is excluded)
npx vitest run --reporter=minimal                         # Run full test suite once (bare `npm test` enters watch mode)
npx vitest related <path> --run --reporter=minimal        # Run only tests affected by <path>
npm run bench                                             # Run Vitest calculation benchmarks
```

### Verification Protocol

Before declaring a task complete, you MUST:
1. Run `npm run format` and `npm run lint` (or `npm run lint:fix`), fixing all errors and any new warnings.
2. Run `npm run build` and `npm run size:summary` to verify TypeScript compilation, bundling, and that the bundle stays within budget.
3. Run relevant tests with `npx vitest related <files> --run --reporter=minimal` (or the full suite) to ensure no regressions.

### Testing Guidelines (Vitest)
- **Execution**: Always pass `run` (or `--run` with `related`) so Vitest exits cleanly, and `--reporter=minimal` to keep output token-efficient.
- **Targeted Runs**: When iterating on specific files, run `npx vitest related <path> --run --reporter=minimal` or `npx vitest run <test-file> --reporter=minimal`.
- **Naming & Structure**: Write short, active-voice `it(...)` descriptions (e.g., `'adds rates of different scales via common denominator'`). Follow the AAA pattern (Arrange, Act, Assert) separated by single blank lines.
- **Isolation & Mocking**: Prefer testing real pure functions in [`src/utils/`](src/utils) and [`src/data/`](src/data) over mocking. Reserve `vi.mock()` for isolating heavy UI modules in component tests, and clean up any spies or fake timers (`vi.useRealTimers()`, `vi.restoreAllMocks()`) in `afterEach` (note: [`vitest.config.ts`](vitest.config.ts) does not enable global `restoreMocks`).

## Pull Requests

- **Title**: Imperative mood, concise, no issue prefixes (e.g., `Make advanced income input title fit better on mobile`, `Implement household-level NHI calculations`).
- **Scale to Scope**: Follow [`.github/pull_request_template.md`](.github/pull_request_template.md):
  - *Small fixes/tweaks*: A concise 1–3 sentence summary is sufficient.
  - *Substantial features*: Use the modular structure modeled after [PR #704](https://github.com/JapanFinance/kei3/pull/704) (`### Summary`, `### Key Changes` grouped by area, `### Key Considerations`).
- **Official Source Links**: When altering tax/insurance logic, provide direct Markdown links to official government sources (e-Gov, NTA, MHLW, etc.).
- **No CI/Verification Boilerplate**: Do NOT include test results, lint status, or verification checklists in the PR body — CI runs and reports on these automatically.

## Key Technical & Domain Patterns

### Exact Rate Arithmetic ([`src/data/rate.ts`](src/data/rate.ts))
- **Use `Rate` instead of raw floats for statutory rates**: Rates such as `5.075%` have no exact IEEE-754 binary fraction, which can corrupt tie-breaking on social insurance premiums (`50銭以下切り捨て` — 0.50 yen or less rounds down, above 0.50 rounds up).
- Construct rates using `percentTo` or `perMilleTo` in the unit published by the official source, combine them with `.plus()` / `.minus()` / `Rate.sum()`, and apply them via `.taxOn(amount)` or `.premiumOn(amount)`.

### Health Insurance & Social Insurance ([`src/types/healthInsurance.ts`](src/types/healthInsurance.ts))
- `HealthInsuranceProviderId` covers five distinct modes:
  1. **Employees' Health Insurance** (`EmployeeProviderId` in [`src/data/employeesHealthInsurance/providerRateData.ts`](src/data/employeesHealthInsurance/providerRateData.ts), default `KyokaiKenpo`) — regional rates and standard monthly remuneration (SMR / 標準報酬月額) brackets.
  2. **National Health Insurance** (`NationalHealthInsurance`, [`src/data/nationalHealthInsurance/`](src/data/nationalHealthInsurance), [`src/utils/nhiHousehold.ts`](src/utils/nhiHousehold.ts)) — assessed at the municipal household (`世帯`) level with statutory low-income reductions (70%/50%/20%), preschool discounts, and child exemptions.
  3. **Medical System for the Elderly (75+)** (`LatterStageElderly`, [`src/data/latterStageElderlyParams.ts`](src/data/latterStageElderlyParams.ts)) — 後期高齢者医療制度, calculated separately from shared employee/NHI logic (`NonLatterStageProviderId` excludes it at the type level).
  4. **Dependent Coverage** (`DependentCoverage`) — eligibility tested against prospective social-insurance `年間収入` (`dependentTestAnnualIncome` in [`src/utils/incomeStreams.ts`](src/utils/incomeStreams.ts)), which differs from tax-side `合計所得金額`.
  5. **Custom Employee Provider** (`CustomProvider`) — user-supplied rates.
- **Long-Term Care Category 1 (65+)** ([`src/utils/longTermCareCategory1.ts`](src/utils/longTermCareCategory1.ts)) — estimated from prefectural base amounts and the standard 13-tier multiplier unless manual entry is enabled.

### Code Organization
- Keep modules in [`src/utils/`](src/utils) and [`src/data/`](src/data) pure and free of DOM/React state, with JSDoc comments linking to official statutory sources.
- Formatting, SPDX license headers, deep `@mui/*` imports (no barrel imports), and JSX/object-literal rules are enforced by [`oxlint`](.oxlintrc.json) and [`oxfmt`](.oxfmtrc.jsonc).

### Performance & Bundle Size ([`.github/size-report.mjs`](.github/size-report.mjs))
- **Enforced Budget**: CI runs `npm run size` after build and fails if the total Brotli size exceeds `BUDGET_BYTES` in [`.github/size-report.mjs`](.github/size-report.mjs). Use `npm run size:summary` for token-efficient local verification.
- **Conscious Increases**: Bundle size increases must be conscious, measured decisions justified by the change. If a feature legitimately requires exceeding the budget, adjust `BUDGET_BYTES` in the same PR with justification.
- **Load Waves**: Maintain the prioritized startup sequence (`Wave 1` entry → `Wave 2` app → deferred results/chart/modals). Avoid importing deferred dependencies statically into eager entry modules.

## Common Modification Workflows

### Adding or Modifying Tax Calculations
1. Define statutory constants/tables in [`src/data/`](src/data) with source URLs in comments.
2. Implement pure calculation functions in [`src/utils/`](src/utils).
3. Wire results through `TakeHomeResults` ([`src/types/tax.ts`](src/types/tax.ts)) and `calculateTaxes()` ([`src/utils/taxCalculations.ts`](src/utils/taxCalculations.ts)).
4. Update the relevant results tab in [`src/components/TakeHomeCalculator/tabs/`](src/components/TakeHomeCalculator/tabs) and chart logic in [`src/utils/chartConfig.ts`](src/utils/chartConfig.ts) if applicable.
5. Add unit tests in [`src/__tests__/`](src/__tests__) covering boundary values and statutory edge cases.

### Adding a New Income Stream Type
`IncomeStream` in [`src/types/tax.ts`](src/types/tax.ts) is a discriminated union. Add the new stream interface to `IncomeStream` first; TypeScript's exhaustive checks and the step-by-step checklist in the JSDoc on `IncomeStream` will guide all required updates across [`src/utils/incomeStreams.ts`](src/utils/incomeStreams.ts), `incomeStreamCatalog.ts`, form components, `IncomeDetailsModal.tsx`, `taxCalculations.ts`, and `chartConfig.ts`.

### Updating `CHANGELOG.md`
If a change is user-facing and noteworthy, add an entry at the top of [`CHANGELOG.md`](CHANGELOG.md) under an ISO date heading (`## YYYY-MM-DD`) and a category heading (`### New`, `### Updated`, `### Fixed`, `### Deprecated`, `### Removed`, or `### Security`) with `- ` bullet items. [`src/utils/changelogUtils.ts`](src/utils/changelogUtils.ts) parses this exact structure for the in-app "What's New" dialog.

## Critical Rule: Official Sources Only

**NEVER infer, guess, or calculate statutory tax or social insurance amounts from patterns or ratios.** Japanese tax and social insurance laws specify exact amounts and rounding rules in legislation.

1. **Always reference official government sources** for exact figures and rules:
   - National Tax: [National Tax Agency (NTA)](https://www.nta.go.jp/) and statutory provisions (所得税法 / 租税特別措置法)
   - Residence Tax: Local government guidance (e.g., [Nerima City](https://www.city.nerima.tokyo.jp/), 東京都主税局) and 地方税法
   - Social Insurance: [Japan Pension Service](https://www.nenkin.go.jp/), [Kyokai Kenpo](https://www.kyoukaikenpo.or.jp/), [MHLW](https://www.mhlw.go.jp/), and municipal NHI offices
2. **Use lookup tables with exact legislated values**, not calculated ratios (e.g., spouse deduction tiers of 38万, 26万, 13万 are statutory amounts, not fractions).
3. **Document the source URL and/or statutory article** in code comments for every rate, bracket, and threshold.
4. **If official values cannot be verified**, ask for clarification rather than guessing.
