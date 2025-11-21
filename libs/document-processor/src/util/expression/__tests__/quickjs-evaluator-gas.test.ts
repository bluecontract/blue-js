import { describe, it, expect } from 'vitest';

import { QuickJSEvaluator } from '../quickjs-evaluator.js';

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
});
