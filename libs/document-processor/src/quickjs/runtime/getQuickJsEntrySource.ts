import fs from 'fs';
import path from 'path';

let cachedEntrySource: Promise<string> | null = null;
const fsPromises = fs.promises;

export async function getQuickJsEntrySource(): Promise<string> {
  const bypassCache =
    process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  if (!cachedEntrySource || bypassCache) {
    cachedEntrySource = loadEntrySource();
  }
  return cachedEntrySource;
}

async function loadEntrySource(): Promise<string> {
  const envBundle = process.env.BLUE_JS_QUICKJS_BUNDLE;
  if (envBundle) {
    return fsPromises.readFile(path.resolve(envBundle), 'utf8');
  }

  const projectRoot = path.resolve(__dirname, '../../../../..');
  const prebuiltPath = path.resolve(
    projectRoot,
    'artifacts/document-processor.quickjs.mjs'
  );

  try {
    return await fsPromises.readFile(prebuiltPath, 'utf8');
  } catch (_) {
    // fall through to dynamic build
  }

  const { build } = await import('esbuild');

  const aliasPlugin = {
    name: 'quickjs-bundle-alias',
    setup(buildPlugin: any) {
      buildPlugin.onResolve({ filter: /^@blue-labs\/language$/ }, () => ({
        path: path.resolve(projectRoot, 'libs/language/src/index.ts'),
      }));
      buildPlugin.onResolve({ filter: /^quickjs-emscripten$/ }, () => ({
        path: path.resolve(
          projectRoot,
          'libs/document-processor/src/quickjs/stubs/quickjs-emscripten.ts'
        ),
      }));
      buildPlugin.onResolve({ filter: /^crypto$/ }, () => ({
        path: path.resolve(
          projectRoot,
          'libs/document-processor/src/quickjs/stubs/crypto.js'
        ),
      }));
      buildPlugin.onResolve({ filter: /^buffer$/ }, () => ({
        path: path.resolve(
          projectRoot,
          'libs/document-processor/src/quickjs/stubs/buffer.js'
        ),
      }));
      buildPlugin.onResolve({ filter: /\.yaml\?raw$/ }, (args: any) => ({
        path: path.resolve(args.resolveDir, args.path.replace('?raw', '')),
        namespace: 'raw-yaml',
      }));
      buildPlugin.onLoad(
        { filter: /\.yaml$/, namespace: 'raw-yaml' },
        async (args: any) => {
          const contents = await fsPromises.readFile(args.path, 'utf8');
          return { contents, loader: 'text' };
        }
      );
    },
  };

  const lockPath = `${prebuiltPath}.lock`;
  const lockHandle = await acquireLock(lockPath);
  try {
    try {
      return await fsPromises.readFile(prebuiltPath, 'utf8');
    } catch (_) {
      // continue to build
    }

    const result = await build({
      entryPoints: [
        path.resolve(
          projectRoot,
          'libs/document-processor/src/quickjs/entry.ts'
        ),
      ],
      bundle: true,
      platform: 'neutral',
      format: 'iife',
      globalName: '__BLUE_ENTRY__',
      target: ['es2020'],
      sourcemap: false,
      legalComments: 'none',
      mainFields: ['module', 'main'],
      plugins: [aliasPlugin],
      define: {
        process: 'undefined',
      },
      write: false,
    });

    if (!result.outputFiles || result.outputFiles.length === 0) {
      throw new Error('Failed to bundle QuickJS entry source.');
    }

    const source = result.outputFiles[0].text;
    await fsPromises.mkdir(path.dirname(prebuiltPath), { recursive: true });
    await fsPromises.writeFile(prebuiltPath, source, 'utf8');
    return source;
  } finally {
    await releaseLock(lockHandle, lockPath);
  }
}

async function acquireLock(lockPath: string) {
  while (true) {
    try {
      return await fsPromises.open(lockPath, 'wx');
    } catch (error: any) {
      if (error && error.code === 'EEXIST') {
        await delay(50);
        continue;
      }
      throw error;
    }
  }
}

async function releaseLock(handle: any, lockPath: string) {
  try {
    await handle?.close();
  } finally {
    await fsPromises.unlink(lockPath).catch(() => undefined);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
