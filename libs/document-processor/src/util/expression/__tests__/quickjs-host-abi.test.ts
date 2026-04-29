import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ModulePackV1 } from '@blue-quickjs/quickjs-runtime';

import {
  DOCUMENT_PROCESSOR_HOST_ABI_VERSION,
  QuickJSEvaluator,
  type QuickJSBindings,
} from '../quickjs-evaluator.js';

type DocumentBinding = NonNullable<QuickJSBindings['document']>;

const MODULE_PACK_BUILDER_VERSION = 'document-processor-test-builder-v1';
const MODULE_PACK_DEPENDENCY_INTEGRITY =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('Document processor QuickJS host ABI', () => {
  it('exposes the document processor host ABI version', () => {
    expect(DOCUMENT_PROCESSOR_HOST_ABI_VERSION).toBe(
      'document-processor-host-v1',
    );
  });

  it('exposes stable globals with default values', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = (await evaluator.evaluate({
      code: `
        return {
          event,
          eventCanonical,
          stepsIsArray: Array.isArray(steps),
          stepsLength: steps.length,
          documentValue: document('/missing'),
          documentCanonicalValue: document.canonical('/missing'),
          emitValue: emit({ type: 'Noop' }),
          currentContract,
          currentContractCanonical
        };
      `,
    })) as Record<string, unknown>;

    expect(result).toEqual({
      event: null,
      eventCanonical: null,
      stepsIsArray: true,
      stepsLength: 0,
      documentValue: null,
      documentCanonicalValue: null,
      emitValue: null,
      currentContract: null,
      currentContractCanonical: null,
    });
  });

  it('exposes event, steps, and current contract bindings as DV values', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = (await evaluator.evaluate({
      code: `
        return {
          eventValue: event.payload.value,
          eventCanonicalValue: eventCanonical.payload.value.value,
          stepValue: steps.prepare.amount,
          contractName: currentContract.name,
          canonicalContractName: currentContractCanonical.name.value
        };
      `,
      bindings: {
        event: { payload: { value: 7 } },
        eventCanonical: { payload: { value: { value: 7 } } },
        steps: { prepare: { amount: 5 } },
        currentContract: { name: 'Example' },
        currentContractCanonical: { name: { value: 'Example' } },
      },
    })) as Record<string, unknown>;

    expect(result).toEqual({
      eventValue: 7,
      eventCanonicalValue: 7,
      stepValue: 5,
      contractName: 'Example',
      canonicalContractName: 'Example',
    });
  });

  it('defaults eventCanonical and currentContractCanonical to their plain values', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = (await evaluator.evaluate({
      code: `
        return {
          eventCanonical,
          currentContractCanonical
        };
      `,
      bindings: {
        event: { payload: { value: 1 } },
        currentContract: { name: 'Plain Contract' },
      },
    })) as Record<string, unknown>;

    expect(result).toEqual({
      eventCanonical: { payload: { value: 1 } },
      currentContractCanonical: { name: 'Plain Contract' },
    });
  });

  it('supports document() and document.canonical() lookups', async () => {
    const evaluator = new QuickJSEvaluator();
    const documentBinding = ((pointer?: unknown) => {
      if (pointer === '/counter') {
        return { value: 3 };
      }
      return undefined;
    }) as DocumentBinding;
    documentBinding.canonical = (pointer?: unknown) => {
      if (pointer === '/counter') {
        return { value: { value: 3 } };
      }
      return undefined;
    };

    const result = (await evaluator.evaluate({
      code: `
        return {
          plain: document('/counter'),
          canonical: document.canonical('/counter'),
          missing: document('/missing'),
          missingCanonical: document.canonical('/missing')
        };
      `,
      bindings: {
        document: documentBinding,
      },
    })) as Record<string, unknown>;

    expect(result).toEqual({
      plain: { value: 3 },
      canonical: { value: { value: 3 } },
      missing: null,
      missingCanonical: null,
    });
  });

  it('falls back to document() when document.canonical is not provided', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: `return document.canonical('/counter');`,
      bindings: {
        document: () => 9,
      },
    });

    expect(result).toBe(9);
  });

  it('rejects non-function document bindings', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: `return document('/counter');`,
        bindings: {
          document: 'not-a-function',
        } as unknown as QuickJSBindings,
      }),
    ).rejects.toThrow(/document binding must be a function/);
  });

  it('maps invalid document pointers to host errors', async () => {
    const evaluator = new QuickJSEvaluator();
    const documentBinding = ((pointer?: unknown) => {
      if (typeof pointer !== 'string') {
        throw new TypeError('document() expects a string pointer');
      }
      return null;
    }) as DocumentBinding;

    await expect(
      evaluator.evaluate({
        code: `return document(123);`,
        bindings: {
          document: documentBinding,
        },
      }),
    ).rejects.toThrow(
      /HostError|invalid_path|document\(\) expects|document\.get argument 1 must be a string/i,
    );
  });

  it('rejects document callback failures as host errors', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: `return document('/broken');`,
        bindings: {
          document: () => {
            throw new Error('document read failed');
          },
        },
      }),
    ).rejects.toThrow(/HostError|invalid_path|document read failed/i);
  });

  it('rejects document callback return values that are not valid DV', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: `return document('/invalid');`,
        bindings: {
          document: () => Symbol('not-dv'),
        },
      }),
    ).rejects.toThrow(
      /HostError|host\/limit|LIMIT_EXCEEDED|valid DV|unsupported DV type: undefined/i,
    );
  });

  it('rejects async document callbacks', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: `return document('/async');`,
        bindings: {
          document: (() => Promise.resolve(1)) as unknown as DocumentBinding,
        },
      }),
    ).rejects.toThrow(
      /HostError|host\/limit|LIMIT_EXCEEDED|valid DV|unsupported DV type: undefined/i,
    );
  });

  it('forwards emit() payloads as normalized DV values', async () => {
    const evaluator = new QuickJSEvaluator();
    const emissions: unknown[] = [];

    const result = await evaluator.evaluate({
      code: `
        emit({ type: 'Example', payload: { value: 42 } });
        return 'done';
      `,
      bindings: {
        emit: (value: unknown) => {
          emissions.push(value);
        },
      },
    });

    expect(result).toBe('done');
    expect(emissions).toEqual([{ type: 'Example', payload: { value: 42 } }]);
  });

  it('rejects emit() payloads that are not valid DV', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: `emit(undefined); return 1;`,
        bindings: {
          emit: () => undefined,
        },
      }),
    ).rejects.toThrow(/unsupported DV type: undefined/i);
  });

  it('rejects async emit callbacks', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: `emit({ type: 'Async' }); return 1;`,
        bindings: {
          emit: () => Promise.resolve(),
        },
      }),
    ).rejects.toThrow(/HostError|host\/limit|LIMIT_EXCEEDED|Async emit/i);
  });

  it('rejects unsupported binding keys', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: 'return 1;',
        bindings: {
          add: (a: number, b: number) => a + b,
        } as unknown as QuickJSBindings,
      }),
    ).rejects.toThrow(/Unsupported QuickJS binding/);
  });

  it('evaluates module packs against the same host ABI globals', async () => {
    const evaluator = new QuickJSEvaluator();
    const documentBinding = ((pointer?: unknown) => {
      if (pointer === '/counter') {
        return { value: 4 };
      }
      return undefined;
    }) as DocumentBinding;
    documentBinding.canonical = (pointer?: unknown) => {
      if (pointer === '/counter') {
        return { value: { value: 4 } };
      }
      return undefined;
    };

    const result = (await evaluator.evaluate({
      modulePack: createModulePack({
        entrySpecifier: './entry.js',
        modules: [
          {
            specifier: './entry.js',
            source: `
              import { readCounter } from './helper.js';

              export default {
                eventValue: event.payload.value,
                eventCanonicalValue: eventCanonical.payload.value.value,
                stepValue: steps.prepare.amount,
                documentValue: readCounter(),
                canonicalDocumentValue: document.canonical('/counter').value.value,
                contractName: currentContract.name,
                canonicalContractName: currentContractCanonical.name.value
              };
            `,
          },
          {
            specifier: './helper.js',
            source: `
              export function readCounter() {
                return document('/counter').value;
              }
            `,
          },
        ],
      }),
      bindings: {
        event: { payload: { value: 7 } },
        eventCanonical: { payload: { value: { value: 7 } } },
        steps: { prepare: { amount: 5 } },
        document: documentBinding,
        currentContract: { name: 'Example' },
        currentContractCanonical: { name: { value: 'Example' } },
      },
    })) as Record<string, unknown>;

    expect(result).toEqual({
      eventValue: 7,
      eventCanonicalValue: 7,
      stepValue: 5,
      documentValue: 4,
      canonicalDocumentValue: 4,
      contractName: 'Example',
      canonicalContractName: 'Example',
    });
  });

  it('supports emit() from module packs', async () => {
    const evaluator = new QuickJSEvaluator();
    const emissions: unknown[] = [];

    const result = await evaluator.evaluate({
      modulePack: createModulePack({
        entrySpecifier: './entry.js',
        modules: [
          {
            specifier: './entry.js',
            source: `
              emit({ type: 'ModuleEvent', payload: { value: 11 } });
              export default 'done';
            `,
          },
        ],
      }),
      bindings: {
        emit: (value: unknown) => {
          emissions.push(value);
        },
      },
    });

    expect(result).toBe('done');
    expect(emissions).toEqual([
      { type: 'ModuleEvent', payload: { value: 11 } },
    ]);
  });
});

function createModulePack(options: {
  readonly entrySpecifier: string;
  readonly entryExport?: string;
  readonly modules: ModulePackV1['modules'];
}): ModulePackV1 {
  const modulePackWithoutHash = {
    version: 1 as const,
    entrySpecifier: options.entrySpecifier,
    ...(options.entryExport ? { entryExport: options.entryExport } : {}),
    modules: options.modules,
    builderVersion: MODULE_PACK_BUILDER_VERSION,
    dependencyIntegrity: MODULE_PACK_DEPENDENCY_INTEGRITY,
  };

  return {
    ...modulePackWithoutHash,
    graphHash: computeModulePackGraphHash(modulePackWithoutHash),
  };
}

function computeModulePackGraphHash(
  modulePack: Omit<ModulePackV1, 'graphHash'>,
) {
  const canonical = {
    version: modulePack.version,
    entrySpecifier: modulePack.entrySpecifier,
    entryExport: modulePack.entryExport ?? 'default',
    modules: [...modulePack.modules]
      .sort((left, right) =>
        compareUtf8ByteOrder(left.specifier, right.specifier),
      )
      .map((module) => ({
        specifier: module.specifier,
        source: module.source,
        ...(module.sourceMap ? { sourceMap: module.sourceMap } : {}),
      })),
    builderVersion: modulePack.builderVersion,
    dependencyIntegrity: modulePack.dependencyIntegrity,
  };

  return createHash('sha256')
    .update(stableStringify(canonical), 'utf8')
    .digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => compareUtf8ByteOrder(left, right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

const UTF8_ENCODER = new TextEncoder();

function compareUtf8ByteOrder(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const leftBytes = UTF8_ENCODER.encode(left);
  const rightBytes = UTF8_ENCODER.encode(right);
  const limit = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < limit; index += 1) {
    const delta = leftBytes[index] - rightBytes[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return leftBytes.length - rightBytes.length;
}
