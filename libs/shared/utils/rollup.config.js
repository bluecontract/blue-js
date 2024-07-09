const { withNx } = require('@nx/rollup/with-nx');

module.exports = withNx(
  {
    main: './src/index.ts',
    outputPath: '../../../dist/libs/shared/utils',
    tsConfig: './tsconfig.lib.json',
    compiler: 'swc',
    format: ['cjs', 'esm'],
    assets: [{ input: '.', output: '.', glob: './libs/shared/utils/*.md' }],

    // uncomment the following lines to support secondary entry points
    // additionalEntryPoints: ['./src/modules/json/json.ts'],
    // generateExportsField: true,
  },
  {
    // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
    // e.g.
    // output: { sourcemap: true },
  }
);
