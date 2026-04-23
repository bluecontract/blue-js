import { describe, expect, it } from 'vitest';

import {
  QuickJSEvaluator,
  type QuickJSBindings,
} from '../quickjs-evaluator.js';

describe('QuickJSEvaluator', () => {
  it('evaluates synchronous code and returns the host value', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: 'return 21 * 2;',
    });

    expect(result).toBe(42);
  });

  it('supports Array.isArray', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = (await evaluator.evaluate({
      code: `
        return {
          typeofIsArray: typeof Array.isArray,
          empty: Array.isArray([]),
          nested: Array.isArray([1, [2]]),
          object: Array.isArray({ 0: 'a', length: 1 }),
          nullish: Array.isArray(null),
          undef: Array.isArray(undefined),
        };
      `,
    })) as Record<string, unknown>;

    expect(result.typeofIsArray).toBe('function');
    expect(result.empty).toBe(true);
    expect(result.nested).toBe(true);
    expect(result.object).toBe(false);
    expect(result.nullish).toBe(false);
    expect(result.undef).toBe(false);
  });

  it('supports Number.isFinite', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = (await evaluator.evaluate({
      code: `
        return {
          typeofFn: typeof Number.isFinite,
          ok: Number.isFinite(1),
          zero: Number.isFinite(0),
          nan: Number.isFinite(NaN),
          infPos: Number.isFinite(Infinity),
          infNeg: Number.isFinite(-Infinity),
          coercesString: Number.isFinite('1'),
        };
      `,
    })) as Record<string, unknown>;

    expect(result.typeofFn).toBe('function');
    expect(result.ok).toBe(true);
    expect(result.zero).toBe(true);
    expect(result.nan).toBe(false);
    expect(result.infPos).toBe(false);
    expect(result.infNeg).toBe(false);
    expect(result.coercesString).toBe(false);
  });

  it('supports Array.prototype.join with newline separators (including spread)', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = (await evaluator.evaluate({
      code: `
        const lines = ['a', 'b', 'c'];
        return {
          joinNewline: lines.join('\\n'),
          joinLiteralBackslashN: lines.join('\\\\n'),
          spreadJoin: [...lines].join('\\n'),
        };
      `,
    })) as Record<string, unknown>;

    expect(result.joinNewline).toBe('a\nb\nc');
    expect(result.spreadJoin).toBe('a\nb\nc');
    expect(result.joinLiteralBackslashN).toBe('a\\nb\\nc');
  });

  it('throws from deterministic JSON.stringify when object values are undefined', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: `return JSON.stringify({ a: 1, b: undefined });`,
      }),
    ).rejects.toThrow(
      /JSON\.stringify only supports null, booleans, strings, finite numbers, arrays, and plain objects/,
    );
  });

  it('rejects async/await syntax in deterministic mode', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: `
          const data = await Promise.resolve({ nested: [1, 2, 3] });
          return data;
        `,
      }),
    ).rejects.toThrow(/expecting ';'/);
  });

  it('exposes provided bindings (values) to the evaluated code', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: 'return steps + event.payload.value;',
      bindings: {
        steps: 7,
        event: { payload: { value: 5 } },
      },
    });

    expect(result).toBe(12);
  });

  it('exposes current contract bindings to the evaluated code', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = (await evaluator.evaluate({
      code: `
        return {
          contract: currentContract,
          canonical: currentContractCanonical
        };
      `,
      bindings: {
        currentContract: { foo: 1 },
        currentContractCanonical: { foo: { value: 1 } },
      },
    })) as Record<string, unknown>;

    expect(result.contract).toEqual({ foo: 1 });
    expect(result.canonical).toEqual({ foo: { value: 1 } });
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

  it('can be reused across multiple evaluations', async () => {
    const evaluator = new QuickJSEvaluator();

    const first = await evaluator.evaluate({ code: 'return 1;' });
    const second = await evaluator.evaluate({ code: 'return 2;' });

    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it('provides canon helpers for working with canonical JSON', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = (await evaluator.evaluate({
      code: `
        const canonicalEvent = {
          payload: {
            id: { value: 'evt-123' },
            tags: { items: [{ value: 'a' }, { value: 'b' }] }
          },
          name: { value: 'example' }
        };
        const pointer = canon.at(canonicalEvent, '/payload/id');
        return {
          pointer,
          pointerUnwrapped: canon.unwrap(pointer),
          eventPlain: canon.unwrap(canonicalEvent),
          eventShallow: canon.unwrap(canonicalEvent, false),
          arrayPlain: canon.unwrap({ items: [{ value: 1 }, { value: 2 }] }),
          missing: canon.at(canonicalEvent, '/payload/missing') ?? null
        };
      `,
    })) as Record<string, unknown>;

    expect(result.pointer).toMatchObject({ value: 'evt-123' });
    expect(result.pointerUnwrapped).toBe('evt-123');
    expect(result.eventPlain).toEqual({
      payload: { id: 'evt-123', tags: ['a', 'b'] },
      name: 'example',
    });
    const shallow = result.eventShallow as Record<string, unknown>;
    expect(shallow.payload).toMatchObject({
      id: { value: 'evt-123' },
      tags: { items: [{ value: 'a' }, { value: 'b' }] },
    });
    expect(result.arrayPlain).toEqual([1, 2]);
    expect(result.missing).toBeNull();
  });

  it('forwards emit calls to the host binding', async () => {
    const evaluator = new QuickJSEvaluator();
    const emissions: unknown[] = [];

    const result = await evaluator.evaluate({
      code: `
        emit({ level: 'debug', message: 'hello', value: 42 });
        return 7;
      `,
      bindings: {
        emit: (value: unknown) => {
          emissions.push(value);
        },
      },
    });

    expect(result).toBe(7);
    expect(emissions).toEqual([
      { level: 'debug', message: 'hello', value: 42 },
    ]);
  });

  it('rejects non-function emit bindings', async () => {
    const evaluator = new QuickJSEvaluator();

    await expect(
      evaluator.evaluate({
        code: 'emit("test"); return 1;',
        bindings: {
          emit: 'not-a-function',
        } as unknown as QuickJSBindings,
      }),
    ).rejects.toThrow(/emit binding must be a function/);
  });
});
