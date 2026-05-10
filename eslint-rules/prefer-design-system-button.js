/**
 * ESLint rule: prefer-design-system-button
 * ----------------------------------------
 * Forbids inline buttons that mimic the brand gradient via raw classes.
 * Use <Button variant="primary"> from '@/system' instead.
 *
 * Detected pattern:
 *   <button className="bg-[linear-gradient(135deg,#F1008B,..." />
 *   <button className="bg-fuchsia-600 ..." />  (we have brand tokens now)
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Force use of <Button> from the design system for primary actions.',
      category: 'Best Practices',
    },
    schema: [],
    messages: {
      rawGradientButton:
        'Inline brand-gradient <button> is forbidden. Use <Button variant="primary"> from "@/system" instead.',
      rawFuchsiaButton:
        'Inline fuchsia <button> is forbidden. Use <Button variant="primary"> from "@/system" instead.',
    },
  },

  create(context) {
    const checkClassName = (node, value) => {
      if (typeof value !== 'string') return;
      if (/bg-\[linear-gradient\([^)]*F1008B/i.test(value)) {
        context.report({ node, messageId: 'rawGradientButton' });
      } else if (/\bbg-fuchsia-\d{3}\b/.test(value)) {
        context.report({ node, messageId: 'rawFuchsiaButton' });
      }
    };

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'button') return;
        const classNameAttr = node.attributes.find(
          (attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'className',
        );
        if (!classNameAttr || !classNameAttr.value) return;

        if (classNameAttr.value.type === 'Literal') {
          checkClassName(node, classNameAttr.value.value);
        } else if (classNameAttr.value.type === 'JSXExpressionContainer') {
          const expr = classNameAttr.value.expression;
          if (expr.type === 'TemplateLiteral') {
            const joined = expr.quasis.map((q) => q.value.cooked).join('');
            checkClassName(node, joined);
          } else if (expr.type === 'CallExpression') {
            // cn('bg-[linear-gradient(...]', ...) — check string args
            for (const arg of expr.arguments) {
              if (arg.type === 'Literal') checkClassName(node, arg.value);
            }
          }
        }
      },
    };
  },
};
