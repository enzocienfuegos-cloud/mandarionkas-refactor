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
    }],
  },
};
