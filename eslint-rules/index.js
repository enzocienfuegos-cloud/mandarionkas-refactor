/**
 * Aggregator for the local ESLint plugin "dusk-local".
 *
 * Setup (in apps/web/.eslintrc.cjs):
 *
 *   const duskLocal = require('../../eslint-rules');
 *   module.exports = {
 *     plugins: { 'dusk-local': duskLocal },
 *     rules: {
 *       'dusk-local/no-legacy-tailwind-colors': 'error',
 *       'dusk-local/no-deep-system-imports':    'error',
 *       'dusk-local/no-emoji-icons':            'warn',
 *       'dusk-local/prefer-design-system-button': 'error',
 *     },
 *   };
 */

module.exports = {
  rules: {
    'no-legacy-tailwind-colors':   require('./no-legacy-tailwind-colors'),
    'no-deep-system-imports':      require('./no-deep-system-imports'),
    'no-emoji-icons':              require('./no-emoji-icons'),
    'prefer-design-system-button': require('./prefer-design-system-button'),
  },
};
