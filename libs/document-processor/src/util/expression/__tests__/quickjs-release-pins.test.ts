import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { HOST_V1_HASH, HOST_V1_MANIFEST } from '@blue-quickjs/abi-manifest';
import {
  evaluate,
  type HostDispatcherHandlers,
  type InputEnvelope,
  type ProgramArtifactV2,
} from '@blue-quickjs/quickjs-runtime';
import { describe, expect, it } from 'vitest';

import { BlueQuickJsEngine } from '../javascript-evaluation-engine.js';
import { QuickJSEvaluator } from '../quickjs-evaluator.js';

const require = createRequire(import.meta.url);
const PINNED_BLUE_QUICKJS_VERSION = '0.4.1';
const PINNED_ENGINE_BUILD_HASH =
  'f91091cb7feb788df340305a877a9cadb0c6f4d13aea8a7da4040b6367d178ea';
const PINNED_GAS_VERSION = 8;
const WRONG_HASH =
  '0000000000000000000000000000000000000000000000000000000000000000';

const input: InputEnvelope = {
  event: null,
  eventCanonical: null,
  steps: [],
  currentContract: null,
  currentContractCanonical: null,
};

const handlers: HostDispatcherHandlers = {
  document: {
    get: () => ({ ok: null, units: 1 }),
    getCanonical: () => ({ ok: null, units: 1 }),
  },
  emit: () => ({ ok: null, units: 1 }),
};

describe('QuickJS release-mode artifact pins', () => {
  it('runs through QuickJSEvaluator when release-mode pins match the pinned runtime', async () => {
    const evaluator = new QuickJSEvaluator({
      releaseMode: true,
      artifactPins: {
        engineBuildHash: PINNED_ENGINE_BUILD_HASH,
        gasVersion: PINNED_GAS_VERSION,
      },
    });

    await expect(evaluator.evaluate({ code: 'return 42;' })).resolves.toBe(42);
  });

  it('forwards release-mode pins through BlueQuickJsEngine configuration', async () => {
    const engine = new BlueQuickJsEngine({
      releaseMode: true,
      artifactPins: {
        engineBuildHash: PINNED_ENGINE_BUILD_HASH,
        gasVersion: PINNED_GAS_VERSION,
      },
    });

    await expect(engine.evaluate({ code: 'return 42;' })).resolves.toBe(42);
  });

  it('rejects release-mode evaluation when required artifact pins are missing', async () => {
    const evaluator = new QuickJSEvaluator({ releaseMode: true });

    await expect(evaluator.evaluate({ code: 'return 1;' })).rejects.toThrow(
      /release-mode requires program\.engineBuildHash/i,
    );
  });

  it('rejects artifacts built for a different execution profile', async () => {
    await expect(
      evaluate({
        program: artifact({
          executionProfile: 'baseline-v1',
          engineBuildHash: WRONG_HASH,
          gasVersion: PINNED_GAS_VERSION,
        }),
        input,
        gasLimit: 50_000n,
        manifest: HOST_V1_MANIFEST,
        handlers,
        releaseMode: true,
        expectedExecutionProfile: 'compat-general-v1',
      }),
    ).rejects.toThrow(/executionProfile mismatch/i);
  });

  it('rejects artifacts pinned to a different engine build hash', async () => {
    await expect(
      evaluate({
        program: artifact({
          engineBuildHash: WRONG_HASH,
          gasVersion: PINNED_GAS_VERSION,
        }),
        input,
        gasLimit: 50_000n,
        manifest: HOST_V1_MANIFEST,
        handlers,
        releaseMode: true,
        expectedExecutionProfile: 'baseline-v1',
      }),
    ).rejects.toThrow(/engineBuildHash mismatch/i);
  });

  it('rejects artifacts pinned to a different gas version', async () => {
    await expect(
      evaluate({
        program: artifact({
          engineBuildHash: PINNED_ENGINE_BUILD_HASH,
          gasVersion: PINNED_GAS_VERSION + 1,
        }),
        input,
        gasLimit: 50_000n,
        manifest: HOST_V1_MANIFEST,
        handlers,
        releaseMode: true,
        expectedExecutionProfile: 'baseline-v1',
      }),
    ).rejects.toThrow(/gasVersion mismatch/i);
  });

  it('fails clearly when the artifact ABI manifest hash does not match Host.v1', async () => {
    const evaluator = new QuickJSEvaluator({
      artifactPins: {
        abiManifestHash: WRONG_HASH,
      },
    });

    await expect(evaluator.evaluate({ code: 'return 1;' })).rejects.toThrow(
      /ABI_MANIFEST_HASH_MISMATCH|abi manifest hash mismatch/i,
    );
  });

  it('documents the pinned blue-quickjs package and runtime metadata fixture', () => {
    const rootPackage = readJson<PackageJson>(
      new URL('../../../../../../package.json', import.meta.url),
    );
    const documentProcessorPackage = readJson<PackageJson>(
      new URL('../../../../package.json', import.meta.url),
    );
    const wasmPackage = readJson<PackageJson>(
      require.resolve('@blue-quickjs/quickjs-wasm/package.json'),
    );
    const metadata = readJson<QuickjsWasmMetadata>(
      require.resolve('@blue-quickjs/quickjs-wasm/quickjs-wasm-build.metadata.json'),
    );

    expect(rootPackage.dependencies['@blue-quickjs/quickjs-runtime']).toBe(
      PINNED_BLUE_QUICKJS_VERSION,
    );
    expect(rootPackage.dependencies['@blue-quickjs/quickjs-wasm']).toBe(
      PINNED_BLUE_QUICKJS_VERSION,
    );
    expect(
      documentProcessorPackage.dependencies['@blue-quickjs/quickjs-runtime'],
    ).toBe(PINNED_BLUE_QUICKJS_VERSION);
    expect(wasmPackage.version).toBe(PINNED_BLUE_QUICKJS_VERSION);
    expect(metadata.engineBuildHash).toBe(PINNED_ENGINE_BUILD_HASH);
    expect(metadata.gasVersion).toBe(PINNED_GAS_VERSION);
    expect(metadata.quickjsVersion).toBe('2025-09-13');
  });
});

function artifact(
  overrides: Partial<ProgramArtifactV2> = {},
): ProgramArtifactV2 {
  return {
    version: 2,
    abiId: 'Host.v1',
    abiVersion: 1,
    abiManifestHash: HOST_V1_HASH,
    executionProfile: 'baseline-v1',
    sourceKind: 'script',
    source: {
      code: '(() => 1)()',
    },
    ...overrides,
  };
}

function readJson<T>(path: string | URL): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

interface PackageJson {
  readonly version?: string;
  readonly dependencies: Record<string, string>;
}

interface QuickjsWasmMetadata {
  readonly quickjsVersion: string;
  readonly engineBuildHash: string;
  readonly gasVersion: number;
}
