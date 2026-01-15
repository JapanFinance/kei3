import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const copyrightRule = {
  meta: {
    type: 'layout',
    fixable: 'code',
  },
  create(context) {
    return {
      Program(node) {
        const sourceCode = context.sourceCode || context.getSourceCode();
        const text = sourceCode.getText();
        const expectedHeader = '// Copyright the original author or authors';
        
        // Check if the file starts with the copyright header
        if (!text.startsWith(expectedHeader)) {
          context.report({
            node,
            message: 'Missing copyright header',
            fix(fixer) {
              return fixer.insertTextBeforeRange([0, 0], expectedHeader + '\n');
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
          'copyright-header': copyrightRule,
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
