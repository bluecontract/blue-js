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
            '{projectRoot}/vitest-setup.ts',
          ],
          ignoredDependencies: [
            '@types/big.js',
            '@types/js-yaml',
            'canonicalize',
            'multiformats',
            '@blue-company/shared-utils',
          ],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
];
