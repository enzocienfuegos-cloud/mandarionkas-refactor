/**
 * ESLint rule: no-legacy-tailwind-colors
 * --------------------------------------
 * Forbids use of legacy Tailwind color utilities (indigo, generic green-600,
 * generic red-600) anywhere in the codebase. Use the design system tokens
 * instead:
 *   - bg-indigo-* / text-indigo-* / border-indigo-*  →  bg-brand-* etc.
 *   - bg-green-600 / bg-red-600                       →  Button variant="primary" / variant="danger"
 *
 * Detected patterns:
 *   className="bg-indigo-600 ..."
 *   className={cn('text-indigo-700', ...)}
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow legacy Tailwind color utilities; use design system tokens instead.',
      category: 'Stylistic Issues',
    },
    schema: [],
    messages: {
      legacyColor:
        'Legacy Tailwind color "{{token}}" is forbidden. Use the design system instead (e.g. "bg-brand-500" or a Button variant).',
    },
  },

  create(context) {
    const FORBIDDEN_PATTERNS = [
      /\bbg-indigo-\d{2,3}\b/,
      /\btext-indigo-\d{2,3}\b/,
      /\bborder-indigo-\d{2,3}\b/,
      /\bring-indigo-\d{2,3}\b/,
      /\bfocus:ring-indigo-\d{2,3}\b/,
      /\bbg-green-600\b/,
      /\bbg-red-600\b/,
      /\bhover:bg-green-700\b/,
      /\bhover:bg-red-700\b/,
    ];

    const checkString = (node, value) => {
      if (typeof value !== 'string') return;
      for (const pattern of FORBIDDEN_PATTERNS) {
        const match = value.match(pattern);
        if (match) {
          context.report({
            node,
            messageId: 'legacyColor',
            data: { token: match[0] },
          });
        }
      }
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') checkString(node, node.value);
      },
      TemplateElement(node) {
        if (node.value && node.value.cooked) checkString(node, node.value.cooked);
      },
    };
  },
};
