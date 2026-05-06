module.exports = {
  root: true,
  plugins: ['dusk-local'],
  rules: {
    'dusk-local/no-legacy-tailwind-colors': 'error',
    'dusk-local/no-deep-system-imports': 'error',
    'dusk-local/no-emoji-icons': 'warn',
    'dusk-local/prefer-design-system-button': 'error',
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: 'lucide-react',
          message: "Import icons from '@/system/icons' instead.",
        },
      ],
      patterns: [
        {
          group: ['**/shared/dusk-ui', '@/shared/dusk-ui'],
          message: "Do not import shared/dusk-ui in app surfaces. Use the public design-system barrel from '../system' instead.",
        },
      ],
    }],
  },
};
