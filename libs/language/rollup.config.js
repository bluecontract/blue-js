const { withNx } = require('@nx/rollup/with-nx');

// @ts-expect-error - This is a valid import.
const packageJson = require('./package.json');

module.exports = withNx(
  {
    main: './src/index.ts',
    outputPath: '../../dist/libs/language',
    tsConfig: './tsconfig.lib.json',
    compiler: 'swc',
    format: ['cjs', 'esm'],
    assets: [
      { input: '.', output: '.', glob: './libs/language/{*.md,LICENSE}' },
    ],
  },
  {
    external: (id) => {
      const dependencies = Object.keys(packageJson.dependencies);
      return dependencies.some((dependency) => id.includes(dependency));
    },
  }
);
