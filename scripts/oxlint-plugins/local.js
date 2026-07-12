// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Local oxlint JS plugin holding project-specific lint rules that have no
// built-in oxlint equivalent. Registered via `jsPlugins` in .oxlintrc.json
// under the alias `local`, so rules are referenced as `local/<rule-name>`.
//
// The JS-plugin API is ESLint v9-compatible (create(context) returning AST
// visitors, context.report, and fixers). Note it is currently alpha in oxlint.

const COPYRIGHT_LINE = '// Copyright the original author or authors';
const SPDX_LINE = '// SPDX-License-Identifier: AGPL-3.0-or-later';

/**
 * Requires the SPDX copyright/license header on every source file. Ports the
 * former `local/copyright-header` ESLint rule: detects the file's line-ending
 * style, and `--fix` strips any existing copyright/SPDX header then prepends the
 * correct one.
 */
const licenseHeader = {
  meta: {
    type: 'layout',
    fixable: 'code',
    docs: { description: 'Require the SPDX copyright/license header.' },
  },
  create(context) {
    return {
      Program(node) {
        const text = context.sourceCode.getText();
        const lineEnding = text.includes('\r\n') ? '\r\n' : '\n';
        const expected = `${COPYRIGHT_LINE}${lineEnding}${SPDX_LINE}${lineEnding}${lineEnding}`;
        if (text.startsWith(expected)) return;
        context.report({
          node,
          message: 'Missing expected copyright/license header',
          fix(fixer) {
            const cleaned = text
              .replace(/^\/\/ Copyright.*?\r?\n/s, '')
              .replace(/^\/\/ SPDX-License-Identifier:.*?\r?\n/s, '')
              .trimStart();
            return fixer.replaceTextRange([0, text.length], expected + cleaned);
          },
        });
      },
    };
  },
};

/**
 * Flags `\uXXXX` escape sequences appearing in JSX *text*. Unlike string
 * literals, JSX text does not interpret unicode escapes — `所` renders as
 * the literal seven characters, not 所. This ports the former ESLint
 * `no-restricted-syntax` guard (selector `JSXText[value=/\\u[0-9a-fA-F]{4}/]`).
 */
const noJsxUnicodeEscape = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow unicode escape sequences in JSX text, where they render literally.',
    },
  },
  create(context) {
    return {
      JSXText(node) {
        if (/\\u[0-9a-fA-F]{4}/.test(node.value)) {
          context.report({
            node,
            message:
              'Unicode escapes like \\u6240 render literally in JSX text. Use the actual character (e.g. 所得控除), or move the text into a string literal/expression.',
          });
        }
      },
    };
  },
};

export default {
  meta: { name: 'local' },
  rules: {
    'license-header': licenseHeader,
    'no-jsx-unicode-escape': noJsxUnicodeEscape,
  },
};
