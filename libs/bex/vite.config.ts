/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import * as fs from 'fs';

// @ts-expect-error - This is a valid import.
import packageJson from './package.json';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/bex',
  plugins: [
    nxViteTsPaths(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    copyConformanceFixtures(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: {
        index: 'src/index.ts',
        conformance: 'src/conformance.ts',
      },
      name: 'bex',
      fileName: (_format: string, entryName: string) => `${entryName}.mjs`,
      formats: ['es' as const],
    },
    rollupOptions: {
      external: (id: string) => {
        const dependencies = Object.keys(packageJson.dependencies ?? {});
        const peerDependencies = Object.keys(
          packageJson.peerDependencies ?? {},
        );
        return (
          id.startsWith('node:') ||
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

function copyConformanceFixtures() {
  return {
    name: 'copy-bex-conformance-fixtures',
    closeBundle() {
      const source = path.join(__dirname, 'src/lib/conformance/fixtures');
      const target = path.join(__dirname, 'dist/lib/conformance/fixtures');
      if (!fs.existsSync(source)) {
        return;
      }
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(source, target, { recursive: true });
    },
  };
}
