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

/**
 * Flags getters and setters in object literals. V8 builds an object literal from a template in
 * which the accessor's name is a plain property, and defining the accessor over that property
 * converts the object to dictionary mode (a hash table) every time the literal is evaluated.
 * Reads and writes of its properties are then hash lookups, and every evaluation also creates new
 * accessor functions. Class accessors are not affected: the prototype holds them once.
 */
const noObjectLiteralAccessor = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow getters and setters in object literals, which V8 stores as dictionaries.',
    },
  },
  create(context) {
    return {
      Property(node) {
        if (node.kind !== 'get' && node.kind !== 'set') return;
        context.report({
          node,
          message:
            'A getter or setter in an object literal makes V8 store the object as a hash table each time the literal is evaluated. Store the value as a data property, or define the accessor in a class.',
        });
      },
    };
  },
};

const SINGLE_QUOTE_ENTITY_RE = /&(?:apos|#0*39|#[xX]0*27);/g;
const DOUBLE_QUOTE_ENTITY_RE = /&(?:quot|#0*34|#[xX]0*22);/g;
const QUOTE_ENTITY_RE = /&(?:(apos|#0*39|#[xX]0*27)|(quot|#0*34|#[xX]0*22));/g;

/**
 * Flags unnecessary HTML entities for ASCII single and double quotes (`&apos;`,
 * `&quot;`, `&#39;`, `&#34;`, `&#x27;`, `&#x22;`) in JSX text and compatible
 * JSX string attributes. JSX does not require escaping quotes in text content.
 */
const noJsxQuoteEntity = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Disallow unnecessary HTML quote entities in JSX text and attributes.',
    },
  },
  create(context) {
    function checkNode(node, pattern, replacer) {
      const raw = context.sourceCode.getText(node);
      pattern.lastIndex = 0;
      if (!pattern.test(raw)) return;
      pattern.lastIndex = 0;
      context.report({
        node,
        message:
          'Use literal quote characters instead of HTML entities like &apos; or &quot; in JSX.',
        fix(fixer) {
          return fixer.replaceText(node, raw.replace(pattern, replacer));
        },
      });
    }

    return {
      JSXText(node) {
        checkNode(node, QUOTE_ENTITY_RE, (_, single) => (single ? "'" : '"'));
      },
      'JSXAttribute > Literal'(node) {
        if (typeof node.value !== 'string') return;
        const raw = context.sourceCode.getText(node);
        if (raw.startsWith('"')) {
          checkNode(node, SINGLE_QUOTE_ENTITY_RE, "'");
        } else if (raw.startsWith("'")) {
          checkNode(node, DOUBLE_QUOTE_ENTITY_RE, '"');
        }
      },
    };
  },
};

export default {
  meta: { name: 'local' },
  rules: {
    'license-header': licenseHeader,
    'no-jsx-quote-entity': noJsxQuoteEntity,
    'no-jsx-unicode-escape': noJsxUnicodeEscape,
    'no-object-literal-accessor': noObjectLiteralAccessor,
  },
};
