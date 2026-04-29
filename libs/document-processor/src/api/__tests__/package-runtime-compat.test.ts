import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { loadQuickjsWasmMetadata } from '@blue-quickjs/quickjs-wasm';
import { describe, expect, it } from 'vitest';

import { DocumentProcessor } from '../document-processor.js';
import { createBlue } from '../../test-support/blue.js';
import { expectOk, numericProperty } from '../../__tests__/test-utils.js';

const require = createRequire(import.meta.url);
const BLUE_QUICKJS_VERSION = '0.4.1';

describe('document-processor package/runtime compatibility', () => {
  it('does not retain the old isolated-vm engine dependency', () => {
    const rootPackage = readJson<PackageJson>(
      new URL('../../../../../package.json', import.meta.url),
    );
    const rootLock = readJson<PackageLock>(
      new URL('../../../../../package-lock.json', import.meta.url),
    );
    const documentProcessorPackage = readJson<PackageJson>(
      new URL('../../../package.json', import.meta.url),
    );

    expect(hasDependency(rootPackage, 'isolated-vm')).toBe(false);
    expect(hasDependency(documentProcessorPackage, 'isolated-vm')).toBe(false);
    expect(
      rootLock.packages['']?.dependencies?.['isolated-vm'],
    ).toBeUndefined();
    expect(
      rootLock.packages['']?.devDependencies?.['isolated-vm'],
    ).toBeUndefined();
    expect(rootLock.packages['node_modules/isolated-vm']).toBeUndefined();
  });

  it('declares the quickjs runtime dependencies used by document-processor source', () => {
    const documentProcessorPackage = readJson<PackageJson>(
      new URL('../../../package.json', import.meta.url),
    );

    expect(
      documentProcessorPackage.dependencies['@blue-quickjs/abi-manifest'],
    ).toBe(BLUE_QUICKJS_VERSION);
    expect(documentProcessorPackage.dependencies['@blue-quickjs/dv']).toBe(
      BLUE_QUICKJS_VERSION,
    );
    expect(
      documentProcessorPackage.dependencies['@blue-quickjs/quickjs-runtime'],
    ).toBe(BLUE_QUICKJS_VERSION);
  });

  it('resolves the transitive quickjs wasm loader, wasm binary, and metadata assets', () => {
    const quickjsRuntimePackage = readJson<PackageJson>(
      require.resolve('@blue-quickjs/quickjs-runtime/package.json'),
    );
    const rootLock = readJson<PackageLock>(
      new URL('../../../../../package-lock.json', import.meta.url),
    );

    expect(quickjsRuntimePackage.version).toBe(BLUE_QUICKJS_VERSION);
    expect(
      rootLock.packages['node_modules/@blue-quickjs/quickjs-runtime']
        ?.dependencies?.['@blue-quickjs/quickjs-wasm'],
    ).toBe(BLUE_QUICKJS_VERSION);

    const loaderPath =
      require.resolve('@blue-quickjs/quickjs-wasm/quickjs-eval');
    const wasmPath =
      require.resolve('@blue-quickjs/quickjs-wasm/quickjs-eval.wasm');
    const metadataPath =
      require.resolve('@blue-quickjs/quickjs-wasm/quickjs-wasm-build.metadata.json');

    expect(existsSync(loaderPath)).toBe(true);
    expect(existsSync(wasmPath)).toBe(true);
    expect(existsSync(metadataPath)).toBe(true);
  });

  it('loads quickjs wasm metadata from the published package export', async () => {
    const metadata = await loadQuickjsWasmMetadata();

    expect(metadata.engineBuildHash).toMatch(/^[0-9a-f]{64}$/);
    expect(metadata.gasVersion).toBeGreaterThan(0);
    expect(metadata.variants.wasm32.release.wasm.filename).toBe(
      'quickjs-eval.wasm',
    );
  });

  it('evaluates document JavaScript through the real processor runtime', async () => {
    const blue = createBlue();
    const processor = new DocumentProcessor({ blue });
    const yaml = `name: Package Runtime Smoke
counter: 2
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Apply
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /counter
            val: "\${document('/counter') + 3}"
`;

    const result = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    expect(numericProperty(result.document, 'counter')).toBe(5);
  });
});

function readJson<T>(path: string | URL): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function hasDependency(pkg: PackageJson, name: string): boolean {
  return (
    pkg.dependencies[name] !== undefined ||
    pkg.devDependencies?.[name] !== undefined
  );
}

interface PackageJson {
  readonly version?: string;
  readonly dependencies: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

interface PackageLock {
  readonly packages: Record<
    string,
    {
      readonly dependencies?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
    }
  >;
}
