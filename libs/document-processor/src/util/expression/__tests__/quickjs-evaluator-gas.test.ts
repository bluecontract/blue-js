import { describe, it, expect } from 'vitest';

import { QuickJSEvaluator } from '../quickjs-evaluator.js';
import { BlueQuickJsEngine } from '../javascript-evaluation-engine.js';

describe('QuickJSEvaluator with wasm gas metering', () => {
  it('throws OutOfGas for an infinite loop under a tiny gas budget', async () => {
    const evaluator = new QuickJSEvaluator();
    await expect(
      evaluator.evaluate({
        code: 'while (true) {}',
        wasmGasLimit: 1_000n,
      }),
    ).rejects.toThrow(/OutOfGas/);
  });

  it('completes a small script within the gas budget', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: `
        let total = 0;
        for (let i = 0; i < 1000; i += 1) {
          total += i;
        }
        return total;
      `,
      wasmGasLimit: 1_000_000_000n,
    });

    expect(result).toBe(499_500);
  });

  it('exposes gas trace through an evaluation callback', async () => {
    const evaluator = new QuickJSEvaluator();
    const traces: unknown[] = [];

    const result = await evaluator.evaluate({
      code: 'return 1 + 1;',
      onGasTrace: (trace) => traces.push(trace),
    });

    expect(result).toBe(2);
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      opcodeCount: expect.any(BigInt),
      opcodeGas: expect.any(BigInt),
    });
  });

  it('forwards configured engine gas trace callbacks', async () => {
    const traces: unknown[] = [];
    const engine = new BlueQuickJsEngine({
      enableGasTrace: true,
      onGasTrace: (trace) => traces.push(trace),
    });

    const result = await engine.evaluate({
      code: 'return 3;',
    });

    expect(result).toBe(3);
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      opcodeCount: expect.any(BigInt),
      opcodeGas: expect.any(BigInt),
    });
  });
});
