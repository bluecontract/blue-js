import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
const dts = require('vite-plugin-dts').default;

// @ts-expect-error - This is a valid import.
import packageJson from './package.json';

/** @type {import('vite').UserConfig} */
export default {
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/repository-generator',

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
      entry: 'src/index.ts',
      name: 'repository-generator',
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: (id: string) => {
        // Treat Node built-ins as external so this library
        // is built purely for Node and Vite doesn't try to
        // replace them with browser stubs.
        if (id === 'fs' || id === 'path' || id.startsWith('node:')) {
          return true;
        }

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
      reportsDirectory: '../../coverage/libs/repository-generator',
      provider: 'v8',
    },
    passWithNoTests: true,
  },
};
