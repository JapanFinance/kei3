# Kei3

A website featuring various calculators. Currently, it has a Japan take-home pay calculator.

## Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm

### Installation

Install dependencies:
```bash
npm install
```

### Development

To start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (by default, unless the port is taken)

### Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview the Production Build

```bash
npm run preview
```

### Testing

Run the test suite:

```bash
npm test
```

### Linting

Check code quality:

```bash
npm run lint
```

## Project Structure

- `src/` - Source code
- `public/` - Static assets
- `dist/` - Production build output
- `tests/` - Test files

## Updating Tax Rules for a New Year

When updating the calculator to support a new tax year (e.g., 2026):

1. **Update the tax year constant** in `src/types/tax.ts`:
   ```typescript
   export const CURRENT_TAX_YEAR = 2026; // Change from 2025
   ```

2. **Search for all uses** of `CURRENT_TAX_YEAR` in the codebase to find date-sensitive text

3. **Review and update tax rules** throughout the codebase:
   - Tax brackets and rates (`src/utils/taxCalculations.ts`)
   - Health insurance rates (`src/data/employeesHealthInsurance/`, `src/data/nationalHealthInsurance/`)
   - Deduction amounts and thresholds (`src/utils/dependentDeductions.ts`)
   - Employment income deduction formula (if changed)
   - Basic deduction amounts (if changed)

4. **Search for hardcoded year references** (e.g., "2025") to catch any missed updates

5. **Update documentation and source links** to point to the new year's official guidance

6. **Run all tests** to ensure calculations remain accurate with the new rules
