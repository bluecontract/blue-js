import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import dts from 'vite-plugin-dts';

// @ts-expect-error - JSON import
import packageJson from './package.json';

/** @type {import('vite').UserConfig} */
export default {
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/document-dsl-sdk',
  resolve: {
    alias: {
      '@blue-labs/language': path.resolve(
        __dirname,
        '../language/src/index.ts',
      ),
      '@blue-labs/document-processor': path.resolve(
        __dirname,
        '../document-processor/src/index.ts',
      ),
    },
  },

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
      name: 'document-dsl-sdk',
      fileName: () => 'index.js',
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
      reportsDirectory: '../../coverage/libs/document-dsl-sdk',
      provider: 'v8',
    },
    passWithNoTests: true,
  },
};
