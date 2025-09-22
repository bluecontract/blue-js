import { build } from 'esbuild';
import fs from 'fs/promises';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const projectRoot = path.resolve(__dirname, '../../..');
  const entryPoint = path.resolve(projectRoot, 'libs/document-processor/src/quickjs/entry.ts');
  const outDir = path.resolve(projectRoot, 'artifacts');
  const outFile = path.resolve(outDir, 'document-processor.quickjs.mjs');

  const aliasPlugin = {
    name: 'quickjs-bundle-alias',
    setup(build) {
      build.onResolve({ filter: /^@blue-labs\/language$/ }, () => ({
        path: path.resolve(projectRoot, 'libs/language/src/index.ts'),
      }));
      build.onResolve({ filter: /^quickjs-emscripten$/ }, () => ({
        path: path.resolve(
          projectRoot,
          'libs/document-processor/src/quickjs/stubs/quickjs-emscripten.ts'
        ),
      }));
      build.onResolve({ filter: /^crypto$/ }, () => ({
        path: path.resolve(projectRoot, 'libs/document-processor/src/quickjs/stubs/crypto.js'),
      }));
      build.onResolve({ filter: /^buffer$/ }, () => ({
        path: path.resolve(projectRoot, 'libs/document-processor/src/quickjs/stubs/buffer.js'),
      }));
      build.onResolve({ filter: /\.yaml\?raw$/ }, (args) => ({
        path: path.resolve(
          args.resolveDir,
          args.path.replace('?raw', '')
        ),
        namespace: 'raw-yaml',
      }));
      build.onLoad({ filter: /\.yaml$/, namespace: 'raw-yaml' }, async (args) => {
        const contents = await fs.readFile(args.path, 'utf8');
        return { contents, loader: 'text' };
      });
    },
  };

  await ensureDir(outDir);

  await build({
    entryPoints: [entryPoint],
    outfile: outFile,
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    target: ['es2020'],
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'info',
    mainFields: ['module', 'main'],
    plugins: [aliasPlugin],
    define: {
      process: 'undefined',
    },
  });

  console.log(`QuickJS entry written to ${path.relative(projectRoot, outFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
