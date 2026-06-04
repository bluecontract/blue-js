/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import * as fs from 'fs';

// @ts-expect-error - This is a valid import.
import packageJson from './package.json';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/document-processor',
  resolve:
    mode === 'test'
      ? {
          alias: {
            '@blue-labs/bex': path.resolve(__dirname, '../bex/src/index.ts'),
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
    copyConformanceFixtures(),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: {
        index: 'src/index.ts',
        conformance: 'src/conformance/index.ts',
      },
      name: 'document-processor',
      fileName: (_format: string, entryName: string) => `${entryName}.js`,
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
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
    name: 'copy-document-processor-conformance-fixtures',
    closeBundle() {
      const source = path.join(__dirname, 'src/conformance/fixtures');
      const target = path.join(__dirname, 'dist/conformance/fixtures');
      if (!fs.existsSync(source)) {
        return;
      }
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(source, target, { recursive: true });
    },
  };
}
