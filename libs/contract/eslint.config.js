const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
            '{projectRoot}/scripts/*.{js,ts,mjs,mts}',
          ],
          ignoredDependencies: [
            '@blue-company/language',
            '@blue-company/shared-utils',
          ],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
  {
    files: ['**/*.zod.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
