import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { QuickJSEvaluator } from '../quickjs-evaluator.js';

const GAS_WASM_ENV = process.env.QUICKJS_GAS_WASM;
const GAS_WASM_DEFAULT = path.resolve(
  __dirname,
  '../../../../../../libs/quickjs-wasmfile-release-sync-gas/quickjs.release.gas.wasm',
);

const gasWasmPath =
  (GAS_WASM_ENV && fs.existsSync(GAS_WASM_ENV) && GAS_WASM_ENV) ||
  (fs.existsSync(GAS_WASM_DEFAULT) ? GAS_WASM_DEFAULT : undefined);

const describeIfGas = gasWasmPath ? describe : describe.skip;

describeIfGas('QuickJSEvaluator with wasm gas metering', () => {
  it('throws OutOfGas for an infinite loop under a tiny fuel budget', async () => {
    const evaluator = new QuickJSEvaluator();
    await expect(
      evaluator.evaluate({
        code: 'while (true) {}',
        instrumentedWasmUrl: gasWasmPath,
        wasmGasLimit: 1_000n,
      }),
    ).rejects.toThrow(/OutOfGas/);
  });

  it('completes a small script within the fuel budget', async () => {
    const evaluator = new QuickJSEvaluator();

    const result = await evaluator.evaluate({
      code: `
        let total = 0;
        for (let i = 0; i < 1000; i += 1) {
          total += i;
        }
        return total;
      `,
      instrumentedWasmUrl: gasWasmPath,
      wasmGasLimit: 200_000_000n,
    });

    expect(result).toBe(499_500);
  });
});

if (!gasWasmPath) {
  console.warn(
    'Skipping QuickJS gas metering tests; set QUICKJS_GAS_WASM or place quickjs.release.gas.wasm under libs/document-processor/',
  );
}
