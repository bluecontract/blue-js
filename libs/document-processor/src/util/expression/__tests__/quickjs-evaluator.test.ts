import { describe, expect, it } from 'vitest';

import { QuickJSEvaluator } from '../quickjs-evaluator.js';

describe('QuickJSEvaluator', () => {
  it('evaluates synchronous code and returns the host value', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: 'return 21 * 2;',
    });

    expect(result).toBe(42);
  });

  it('supports awaiting asynchronous results within the code block', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: `
        const data = await Promise.resolve({ nested: [1, 2, 3] });
        return data;
      `,
    });

    expect(result).toEqual({ nested: [1, 2, 3] });
  });

  it('exposes provided bindings (values and functions) to the evaluated code', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: 'return add(steps, 5);',
      bindings: {
        steps: 7,
        add: (a: number, b: number) => a + b,
      },
    });

    expect(result).toBe(12);
  });

  it('returns an error object when a binding rejects with an async result', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: 'return add(1, 2);',
      bindings: {
        add: () => Promise.resolve(3),
      },
    });

    expect(result).toEqual({
      message: 'Async bindings are not supported',
      name: 'Error',
    });
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
          missing: canon.at(canonicalEvent, '/payload/missing')
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
    expect(result.missing).toBeUndefined();
  });
});
