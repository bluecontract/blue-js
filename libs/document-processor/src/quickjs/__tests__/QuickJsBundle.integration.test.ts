import { describe, expect, it } from 'vitest';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { build } from 'esbuild';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { loadQuickJsBlueDocumentProcessorFromBundle } from '../loadQuickJsBlueDocumentProcessorFromBundle';
import type { PluginBuild } from 'esbuild';

const projectRoot = path.resolve(__dirname, '../../../../..');
const entryPath = path.resolve(
  projectRoot,
  'libs/document-processor/src/quickjs/entry.ts'
);

const RUN_BUNDLE_TEST = process.env.RUN_QUICKJS_BUNDLE_TEST === '1';
const maybeIt = RUN_BUNDLE_TEST ? it : it.skip;

describe('QuickJS bundle integration', () => {
  maybeIt('processes documents using bundled entry source', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quickjs-bundle-'));
    const bundlePath = path.resolve(tmpDir, 'bundle.mjs');

    const aliasPlugin = {
      name: 'quickjs-bundle-alias',
      setup(buildPlugin: PluginBuild) {
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
        buildPlugin.onResolve({ filter: /\.yaml\?raw$/ }, (args) => ({
          path: path.resolve(args.resolveDir, args.path.replace('?raw', '')),
          namespace: 'raw-yaml',
        }));
        buildPlugin.onLoad(
          { filter: /\.yaml$/, namespace: 'raw-yaml' },
          async (args) => {
            const contents = await fs.readFile(args.path, 'utf8');
            return { contents, loader: 'text' };
          }
        );
      },
    };

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      platform: 'neutral',
      format: 'esm',
      target: ['es2020'],
      sourcemap: false,
      legalComments: 'none',
      mainFields: ['module', 'main'],
      plugins: [aliasPlugin],
      define: {
        process: 'undefined',
      },
    });

    const { processor, bridge } =
      await loadQuickJsBlueDocumentProcessorFromBundle({
        bundlePath,
        repositories: [coreRepository, myosRepository],
        hostApis: {
          log: () => {
            // no-op
          },
        },
      });

    const blue = new Blue({ repositories: [coreRepository, myosRepository] });
    const documentDefinition = {
      contracts: {
        channelName: {
          type: 'MyOS Timeline Channel',
          timelineId: 'timeline-1',
        },
      },
    } as const;

    const documentNode = blue.jsonValueToNode(documentDefinition);

    const initResult = await processor.initialize(documentNode, {
      gasBudget: 10_000,
    });
    expect(initResult.state).toBeDefined();

    await bridge.dispose();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
