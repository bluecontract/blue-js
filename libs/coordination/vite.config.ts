/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import dts from 'vite-plugin-dts';
import * as path from 'path';

// @ts-expect-error - This is a valid import.
import packageJson from './package.json';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/coordination',
  resolve:
    mode === 'test'
      ? {
          alias: {
            '@blue-labs/bex': path.resolve(__dirname, '../bex/src/index.ts'),
            '@blue-labs/document-processor': path.resolve(
              __dirname,
              '../document-processor/src/index.ts',
            ),
            '@blue-labs/language': path.resolve(
              __dirname,
              '../language/src/index.ts',
            ),
          },
        }
      : undefined,
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
      name: 'coordination',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: (id: string) => {
        const dependencies = Object.keys(packageJson.dependencies ?? {});
        const peerDependencies = Object.keys(
          packageJson.peerDependencies ?? {},
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
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    passWithNoTests: true,
  },
}));
