import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const fileHeaderRule = {
  meta: {
    type: 'layout',
    fixable: 'code',
  },
  create(context) {
    return {
      Program(node) {
        const sourceCode = context.sourceCode || context.getSourceCode();
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
              let cleanedText = text.replace(/^\/\/ Copyright.*?\r?\n/s, '').replace(/^\/\/ SPDX-License-Identifier:.*?\r?\n/s, '').trimStart();
              // Then insert the correct header
              return fixer.replaceTextRange([0, text.length], expectedHeader + cleanedText);
            },
          });
        }
      },
    };
  },
};

export default tseslint.config(
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
      'local': {
        rules: {
          'copyright-header': fileHeaderRule,
        },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'local/copyright-header': 'error',
      'no-restricted-imports': [
        'error',
        {
          'patterns': [{ 'regex': '^@mui/[^/]+$' }]
        }
      ],
    },
  },
)
