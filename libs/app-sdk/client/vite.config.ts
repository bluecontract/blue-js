import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
const dts = require('vite-plugin-dts').default;
import * as ts from 'typescript';
import createParameterNamesTransformer from './src/tools/parameterNamesTransformer';
// @ts-expect-error - This is a valid import.
import packageJson from './package.json';

/** @type {import('vite').UserConfig} */
export default {
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/app-sdk/client',
  plugins: [
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    {
      name: 'typescript-transform',
      enforce: 'pre',
      transform(code: string, id: string) {
        if (!id.endsWith('.ts')) return;
        if (!id.includes('/src/')) return;

        const result = ts.transpileModule(code, {
          compilerOptions: {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
          transformers: {
            before: [createParameterNamesTransformer()],
          },
        });

        return {
          code: result.outputText,
          map: result.sourceMapText,
        };
      },
    },
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
      entry: 'src/index.ts',
      name: '@blue-company/app-sdk',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: (id: string) => {
        const dependencies = Object.keys(packageJson.dependencies);
        return dependencies.some((dependency) => {
          return id === dependency;
        });
      },
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/app-sdk/client',
      provider: 'v8',
    },
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
  },
};
