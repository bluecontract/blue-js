import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { QuickJSEvaluator } from '../quickjs-evaluator.js';
import { DEFAULT_WASM_GAS_LIMIT } from '../quickjs-config.js';

const GAS_WASM_ENV = process.env.QUICKJS_GAS_WASM;
const GAS_WASM_DEFAULT = path.resolve(
  __dirname,
  '../../../../../../libs/quickjs-wasmfile-release-sync-gas/emscripten-module-gas.wasm',
);

const gasWasmPath =
  (GAS_WASM_ENV && fs.existsSync(GAS_WASM_ENV) && GAS_WASM_ENV) ||
  (fs.existsSync(GAS_WASM_DEFAULT) ? GAS_WASM_DEFAULT : undefined);

const describeIfGas = gasWasmPath ? describe : describe.skip;

describeIfGas('QuickJS wasm fuel samples', () => {
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
        instrumentedWasmUrl: gasWasmPath,
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
          "fuel": "2436121",
          "name": "return-1",
        },
        {
          "fuel": "53128144",
          "name": "loop-1k",
        },
        {
          "fuel": "486743029",
          "name": "loop-10k",
        },
      ]
    `);
  });
});

if (!gasWasmPath) {
  console.warn(
    'Skipping QuickJS fuel calibration test; set QUICKJS_GAS_WASM or place emscripten-module-gas.wasm under libs/document-processor/',
  );
}
