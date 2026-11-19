# anti-slop Upstream Provenance

- **Source repository**: <https://github.com/dmmulroy/anti-slop>
- **Source commit**: `13909c9e07590f5a85d93c62712259fe14a883f7` (installed via `npx skills add dmmulroy/anti-slop --skill install-anti-slop`, recorded in `skills-lock.json`; asset copy placed via `install.mjs`)
- **Installed plugin path**: `scripts/oxlint-plugins/anti-slop/index.ts` (vendored directory: `scripts/oxlint-plugins/anti-slop/`, alongside `scripts/oxlint-plugins/local.js`)
- **Vendored sub-dependencies preserved**: `scripts/oxlint-plugins/anti-slop/vendor/eslint-stylistic/LICENSE` and `scripts/oxlint-plugins/anti-slop/vendor/eslint-stylistic/UPSTREAM.md`

## Configuration & Intentional Deviations

- **Effect plugin removed**: `scripts/oxlint-plugins/anti-slop/effect/` was removed and is not registered because `effect` is not a dependency in `package.json`.
- **`anti-slop/require-readable-spacing`**: Set to `"off"` in `.oxlintrc.json` to leave spacing and formatting to `oxfmt`.
- **`anti-slop/no-runtime-typeof`**: Configured with `["error", { "allowInTypeGuards": true }]` globally, and `"off"` via overrides for tooling `.mjs` scripts (`scripts/**/*.mjs`, `.github/**/*.mjs`) and `src/data/rate.ts`, `src/components/TakeHomeCalculator/ResultRow.tsx`, `src/utils/healthInsuranceCalculator.ts`.
- **`anti-slop/no-module-mocking`**: Enabled at `"error"` globally; set to `"off"` via overrides only for `test-setup.ts` and the 19 UI/JSDOM component test files that isolate `Tooltips`, lazy modals/charts, or `react-chartjs-2`.
- **Vendored fix (`shared/dictionary-types.ts`)**: Updated `classifyWideningTarget` to check `isBroadMappedKey(unwrapped.constraint, ...)` for `TSMappedType` (matching `classifyAliasBroadTarget`) so finite-key mapped types (`{ [T in IncomeStreamType]: ... }`) are not treated as open dictionaries.
- **All other generic rules + `oxc/no-accumulating-spread`**: Enabled at `"error"` in `.oxlintrc.json`.
