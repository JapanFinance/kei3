import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';

const fileHeaderRule = {
  meta: {
    type: 'layout',
    fixable: 'code',
  },
  create(context) {
    return {
      Program(node) {
        const sourceCode = context.sourceCode;
        const text = sourceCode.getText();

        // Detect line ending style from the file
        const lineEnding = text.includes('\r\n') ? '\r\n' : '\n';
        const expectedHeader = `// Copyright the original author or authors${lineEnding}// SPDX-License-Identifier: AGPL-3.0-or-later${lineEnding}${lineEnding}`;

        // Check if the file starts with the expected header
        if (!text.startsWith(expectedHeader)) {
          context.report({
            node,
            message: 'Missing expected copyright/license header',
            fix(fixer) {
              // Remove any existing copyright/license headers first
              let cleanedText = text
                .replace(/^\/\/ Copyright.*?\r?\n/s, '')
                .replace(/^\/\/ SPDX-License-Identifier:.*?\r?\n/s, '')
                .trimStart();
              // Then insert the correct header
              return fixer.replaceTextRange([0, text.length], expectedHeader + cleanedText);
            },
          });
        }
      },
    };
  },
};

export default defineConfig(
  // `.claude` holds agent worktrees (full, sometimes-stale repo copies) that would
  // otherwise be traversed and break type-aware linting with multiple root tsconfigs.
  { ignores: ['dist', '.claude'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        // Type-aware linting (strictTypeChecked). projectService resolves each file
        // to its nearest tsconfig; the two root config files aren't in any project.
        projectService: {
          allowDefaultProject: ['test-setup.ts', 'vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      local: {
        rules: {
          'copyright-header': fileHeaderRule,
        },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'local/copyright-header': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ regex: '^@mui/[^/]+$' }],
        },
      ],
      // Unicode escapes (\uXXXX) are NOT interpreted inside JSX text — they render
      // literally. They only work inside string literals/expressions. Catch it at lint time.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/\\\\u[0-9a-fA-F]{4}/]',
          message:
            'Unicode escapes like \\u6240 render literally in JSX text. Use the actual character (e.g. 所得控除), or move the text into a string literal/expression.',
        },
      ],
      // strictTypeChecked adoption. Numbers and booleans interpolated into template
      // strings are intentional throughout the UI copy, so allow them.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      // Returning a void call from an arrow shorthand (e.g. `onChange={e => setX(e)}`) is
      // idiomatic React and intentional here; keep the rule for the genuinely confusing
      // non-shorthand cases (e.g. `return doVoidThing()` in a value position).
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // --- Existing violations: downgraded to `warn` so they surface as a burn-down
      // list without blocking CI. Categories with zero current violations (floating
      // promises, misused promises, await-thenable, no-base-to-string, …) stay hard
      // errors and will fail CI on new code. Promote these back to `error` as cleared.
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
    },
  },
  {
    extends: [vitest.configs.recommended],
    files: ['src/__tests__/**/*.{ts,tsx}'],
    rules: {
      // Non-null assertions are idiomatic in test setup/queries
      // (e.g. `screen.getByText(...).parentElement!`); no need to flag them here.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
