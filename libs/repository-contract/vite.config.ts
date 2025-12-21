import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import dts from 'vite-plugin-dts';

// @ts-expect-error - This is a valid import.
import packageJson from './package.json';

const entryPoints = {
  index: 'src/index.ts',
  pointers: 'src/pointers.ts',
  refs: 'src/refs.ts',
  validation: 'src/validation.ts',
  types: 'src/types.ts',
};

/** @type {import('vite').UserConfig} */
export default {
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/repository-contract',

  plugins: [
    nxViteTsPaths(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],

  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: entryPoints,
      name: 'repository-contract',
      fileName: (_format: string, entryName: string) => `${entryName}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: (id: string) => {
        const dependencies = Object.keys(packageJson.dependencies || {});
        const peerDependencies = Object.keys(
          packageJson.peerDependencies || {},
        );
        return (
          dependencies.some((dependency) => id === dependency) ||
          peerDependencies.some((dependency) => id === dependency)
        );
      },
    },
  },

  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/repository-contract',
      provider: 'v8',
    },
    passWithNoTests: true,
  },
};
