/// <reference types='vitest' />
import * as path from 'path';
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import dts from 'vite-plugin-dts';

// @ts-expect-error - This is a valid import.
import packageJson from './package.json';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/sdk-dsl',
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
      name: 'sdk-dsl',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: (id: string) => {
        const dependencies = Object.keys(packageJson.dependencies ?? {});
        const peerDependencies = Object.keys(packageJson.peerDependencies ?? {});
        const devDependencies = Object.keys(packageJson.devDependencies ?? {});
        return (
          dependencies.some((dependency) => id === dependency) ||
          peerDependencies.some((dependency) => id === dependency) ||
          devDependencies.some((dependency) => id === dependency)
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
      reportsDirectory: '../../coverage/libs/sdk-dsl',
      provider: 'v8' as const,
    },
    passWithNoTests: true,
  },
}));
