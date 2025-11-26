import { describe, it, expect } from 'vitest';

import { QuickJSEvaluator } from '../quickjs-evaluator.js';
import { DEFAULT_WASM_GAS_LIMIT } from '../quickjs-config.js';

describe('QuickJS wasm fuel samples', () => {
  it('captures baseline usage for representative scripts', async () => {
    const evaluator = new QuickJSEvaluator();
    const samples = [
      { name: 'return-1', code: 'return 1;' },
      {
        name: 'loop-1k',
        code: `let sum = 0;\nfor (let i = 0; i < 1000; i += 1) {\n  sum += i;\n}\nreturn sum;`,
      },
      {
        name: 'loop-10k',
        code: `let sum = 0;\nfor (let i = 0; i < 10000; i += 1) {\n  sum += i;\n}\nreturn sum;`,
      },
    ];

    const results: Array<{ name: string; fuel: string }> = [];

    for (const sample of samples) {
      let used = 0n;
      await evaluator.evaluate({
        code: sample.code,
        wasmGasLimit: DEFAULT_WASM_GAS_LIMIT,
        onWasmGasUsed: ({ used: reported }) => {
          used = reported;
        },
      });
      results.push({ name: sample.name, fuel: used.toString() });
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "fuel": "1522699",
          "name": "return-1",
        },
        {
          "fuel": "52214722",
          "name": "loop-1k",
        },
        {
          "fuel": "485829607",
          "name": "loop-10k",
        },
      ]
    `);
  });
});
