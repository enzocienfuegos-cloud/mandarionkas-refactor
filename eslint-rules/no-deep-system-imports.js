/**
 * ESLint rule: no-deep-system-imports
 * -----------------------------------
 * Forces all design system imports to go through the public barrel:
 *   ✗ import { Button } from '@/system/primitives/Button';
 *   ✓ import { Button } from '@/system';
 *
 * This protects against tree-shaking surprises and keeps the public API
 * single-sourced.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow deep imports into the design system; use the public barrel instead.',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      deepImport:
        'Deep import "{{path}}" is forbidden. Import from "@/system" (the barrel) instead.',
    },
  },

  create(context) {
    const FORBIDDEN_PREFIXES = [
      '@/system/primitives/',
      '@/system/data-table/',
      '@/system/feedback/',
      '@/system/icons/',
      '@/system/hooks/',
      '../system/primitives/',
      '../system/data-table/',
      '../system/feedback/',
      '../../system/primitives/',
      '../../system/data-table/',
      '../../system/feedback/',
    ];

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;
        for (const prefix of FORBIDDEN_PREFIXES) {
          if (source.startsWith(prefix)) {
            context.report({
              node: node.source,
              messageId: 'deepImport',
              data: { path: source },
            });
            return;
          }
        }
      },
    };
  },
};
