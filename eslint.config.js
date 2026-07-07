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
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
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
    },
  },
  {
    extends: [vitest.configs.recommended],
    files: ['src/__tests__/**/*.{ts,tsx}'],
  },
);
