const baseConfig = require('../../../eslint.config.js');

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
            '{projectRoot}/src/tools/**/*.ts',
          ],
          ignoredDependencies: ['@blue-company/app-sdk-core'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
  {
    files: ['src/api/agents/**/*.{js,ts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
