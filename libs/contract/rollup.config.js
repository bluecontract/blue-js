const { withNx } = require('@nx/rollup/with-nx');

// @ts-expect-error - This is a valid import.
const packageJson = require('./package.json');

module.exports = withNx(
  {
    main: './src/index.ts',
    outputPath: '../../dist/libs/contract',
    tsConfig: './tsconfig.lib.json',
    compiler: 'swc',
    format: ['cjs', 'esm'],
    assets: [
      { input: '.', output: '.', glob: './libs/contract/{*.md,LICENSE}' },
    ],
    external: (id) => {
      const dependencies = packageJson.dependencies;
      return !!dependencies[id];
    },
  },
  {
    // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
    // e.g.
    // output: { sourcemap: true },
  }
);
