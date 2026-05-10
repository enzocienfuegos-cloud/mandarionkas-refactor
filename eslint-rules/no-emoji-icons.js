/**
 * ESLint rule: no-emoji-icons
 * ---------------------------
 * Forbids emojis being used as functional UI icons in JSX text content.
 * Emojis are inconsistent across platforms, can't be themed, are noisy
 * to screen readers, and look amateurish in a B2B product.
 *
 * Detected emojis (typical legacy offenders in this codebase):
 *   📊 📈 📉 ⏸ ▶ ■ 🔗 📋 ✅ ❌ ⚠ 🔥 ⭐
 *
 * Replace with lucide-react icons imported from @/system/icons.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow emoji used as functional UI icons in JSX.',
      category: 'Stylistic Issues',
    },
    schema: [],
    messages: {
      emojiIcon:
        'Emoji icon "{{glyph}}" is forbidden. Import a lucide icon from "@/system/icons" instead.',
    },
  },

  create(context) {
    // List of common emoji ranges + the specific glyphs found in the codebase
    const EMOJI_RE =
      /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1FA70}-\u{1FAFF}]|[▶⏸■◼◻]/u;

    return {
      JSXText(node) {
        const value = node.value;
        if (typeof value !== 'string') return;
        const match = value.match(EMOJI_RE);
        if (match) {
          context.report({
            node,
            messageId: 'emojiIcon',
            data: { glyph: match[0] },
          });
        }
      },
      Literal(node) {
        // Only flag emojis inside JSX-like attribute strings (children, label, etc.)
        if (typeof node.value !== 'string') return;
        const parent = node.parent;
        if (
          parent &&
          (parent.type === 'JSXAttribute' ||
            (parent.type === 'JSXExpressionContainer' && parent.parent?.type === 'JSXAttribute'))
        ) {
          const match = node.value.match(EMOJI_RE);
          if (match) {
            context.report({
              node,
              messageId: 'emojiIcon',
              data: { glyph: match[0] },
            });
          }
        }
      },
    };
  },
};
