import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_PROCESSOR_HOST_ABI_VERSION,
  QuickJSEvaluator,
  type QuickJSBindings,
} from '../quickjs-evaluator.js';

type DocumentBinding = NonNullable<QuickJSBindings['document']>;

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
});
