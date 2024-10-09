import { withNx } from '@nx/rollup/with-nx.js';
import packageJson from './package.json' assert { type: 'json' };

export default withNx(
  {
    main: './src/index.ts',
    outputPath: '../../dist/libs/language',
    tsConfig: './tsconfig.lib.json',
    compiler: 'swc',
    format: ['esm'],
    assets: [
      { input: '.', output: '.', glob: './libs/language/{*.md,LICENSE}' },
    ],
  },
  {
    external: (id) => {
      const dependencies = Object.keys(packageJson.dependencies);
      return dependencies.some((dependency) => {
        if (id.startsWith('multiformats')) {
          return true;
        }
        return id === dependency;
      });
    },
  }
);
