import { describe, it, expect } from 'vitest';
import {
  newQuickJSWASMModuleFromVariant,
  QuickJSRuntime,
  QuickJSWASMModule,
} from 'quickjs-emscripten';
import gasVariant, {
  setGasBudget,
  getGasRemaining,
  disableRuntimeAutomaticGC,
  collectRuntimeGarbage,
} from '@blue-labs/quickjs-wasmfile-release-sync-gas';

import { wasmFuelToHostGas } from '../../../runtime/gas-schedule.js';
import { QuickJSEvaluator } from '../quickjs-evaluator.js';
import { DEFAULT_WASM_GAS_LIMIT } from '../quickjs-config.js';

describe('QuickJS wasm fuel samples', () => {
  const LIMIT = 10_000_000_000n;

  it('captures baseline usage for representative scripts', async () => {
    // Use fresh module (not cached) for deterministic measurements across environments
    const module = await newQuickJSWASMModuleFromVariant(gasVariant);
    const runtime = module.newRuntime();
    disableRuntimeAutomaticGC(module, runtime);
    collectRuntimeGarbage(module, runtime);
    const ctx = runtime.newContext();

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

    const results: Array<{ name: string; fuel: string; hostFuel: string }> = [];

    for (const sample of samples) {
      // Compile function once
      const wrappedCode = `(function __eval(){ ${sample.code} })`;
      const fnResult = ctx.evalCode(wrappedCode);
      if (fnResult.error) {
        fnResult.error.dispose();
        throw new Error(`Failed to compile: ${sample.name}`);
      }
      const fnHandle = fnResult.value;

      // Warmup run to prime internal state
      collectRuntimeGarbage(module, runtime);
      setGasBudget(module, LIMIT);
      const warmup = ctx.callFunction(fnHandle, ctx.undefined);
      if (warmup.error) warmup.error.dispose();
      else warmup.value.dispose();
      collectRuntimeGarbage(module, runtime);

      // Measured run
      setGasBudget(module, LIMIT);
      const result = ctx.callFunction(fnHandle, ctx.undefined);
      if (result.error) result.error.dispose();
      else result.value.dispose();
      const remaining = getGasRemaining(module) ?? 0n;
      const used = LIMIT - remaining;
      collectRuntimeGarbage(module, runtime);

      fnHandle.dispose();

      results.push({
        name: sample.name,
        fuel: used.toString(),
        hostFuel: wasmFuelToHostGas(used).toString(),
      });
    }

    ctx.dispose();
    runtime.dispose();

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "fuel": "16404",
          "hostFuel": "1",
          "name": "return-1",
        },
        {
          "fuel": "48228184",
          "hostFuel": "298",
          "name": "loop-1k",
        },
        {
          "fuel": "481830294",
          "hostFuel": "2975",
          "name": "loop-10k",
        },
      ]
    `);
  });

  it('captures baseline usage via createPinnedRunner (for comparison)', async () => {
    // Uses QuickJSEvaluator internals but forces a fresh module per sample to avoid cache drift
    const evaluator = new QuickJSEvaluator({ useModuleCache: false });
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

    const results: Array<{ name: string; fuel: string; hostFuel: string }> = [];

    for (const sample of samples) {
      let used = 0n;
      const runner = await evaluator.createPinnedRunner({
        code: sample.code,
        wasmGasLimit: DEFAULT_WASM_GAS_LIMIT,
        wrapAsAsync: false,
      });
      try {
        await runner.run({
          onWasmGasUsed: ({ used: reported }) => {
            used = reported;
          },
        });
      } finally {
        runner.dispose();
      }
      results.push({
        name: sample.name,
        fuel: used.toString(),
        hostFuel: wasmFuelToHostGas(used).toString(),
      });
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "fuel": "102867",
          "hostFuel": "1",
          "name": "return-1",
        },
        {
          "fuel": "48314760",
          "hostFuel": "299",
          "name": "loop-1k",
        },
        {
          "fuel": "481919958",
          "hostFuel": "2975",
          "name": "loop-10k",
        },
      ]
    `);
  });
});

describe('QuickJS gas metering determinism', () => {
  const LIMIT = 10_000_000_000n;
  const configureRuntime = (module: QuickJSWASMModule): QuickJSRuntime => {
    const runtime = module.newRuntime();
    disableRuntimeAutomaticGC(module, runtime);
    collectRuntimeGarbage(module, runtime);
    return runtime;
  };

  const runDeterministicGC = (
    module: QuickJSWASMModule,
    runtime: QuickJSRuntime,
  ): void => {
    try {
      collectRuntimeGarbage(module, runtime);
    } catch {
      // ignore GC cleanup failures in tests
    }
  };

  const readGasUsage = (module: QuickJSWASMModule): bigint => {
    const remaining = getGasRemaining(module) ?? 0n;
    return LIMIT - remaining;
  };

  const LOOP_1K_CODE =
    '(function() { let s = 0; for(let i=0; i<1000; i++) s += i; return s; })()';

  it('ensures runtime/context initialization produces identical gas values', async () => {
    const module = await newQuickJSWASMModuleFromVariant(gasVariant);
    const measurements: bigint[] = [];

    for (let i = 0; i < 10; i++) {
      const rt = configureRuntime(module);
      const ctx = rt.newContext();
      runDeterministicGC(module, rt);
      setGasBudget(module, LIMIT);
      const result = ctx.evalCode('1');
      if (result.error) result.error.dispose();
      else result.value.dispose();
      const used = readGasUsage(module);
      measurements.push(used);
      runDeterministicGC(module, rt);
      ctx.dispose();
      rt.dispose();
    }

    const [first] = measurements;
    expect(measurements).toHaveLength(10);
    expect(first).toBeDefined();
    expect(measurements.every((sample) => sample === first)).toBe(true);
  });

  it('ensures repeated same-context evaluations remain deterministic', async () => {
    const module = await newQuickJSWASMModuleFromVariant(gasVariant);
    const rt = configureRuntime(module);
    const ctx = rt.newContext();

    setGasBudget(module, LIMIT);
    const warmup = ctx.evalCode('1');
    if (warmup.error) warmup.error.dispose();
    else warmup.value.dispose();
    runDeterministicGC(module, rt);
    const fnResult = ctx.evalCode(
      '(function loop(){ let s=0; for (let i=0; i<100000; i++) s+=i; return s; })',
    );
    if (fnResult.error) {
      const err = fnResult.error;
      err.dispose();
      throw new Error('failed to compile loop function');
    }
    const fnHandle = fnResult.value;
    const runSample = (): bigint => {
      runDeterministicGC(module, rt);
      setGasBudget(module, LIMIT);
      const result = ctx.callFunction(fnHandle, ctx.undefined);
      if (result.error) result.error.dispose();
      else result.value.dispose();
      const used = readGasUsage(module);
      runDeterministicGC(module, rt);
      return used;
    };

    // Prime the runtime with the exact code we intend to measure.
    runSample();

    const measurements: bigint[] = [];
    for (let i = 0; i < 10; i++) {
      measurements.push(runSample());
    }

    fnHandle.dispose();
    ctx.dispose();
    rt.dispose();

    const min = measurements.reduce((a, b) => (a < b ? a : b));
    const max = measurements.reduce((a, b) => (a > b ? a : b));
    const variance = max - min;
    const distinctValues = new Set(
      measurements.map((sample) => sample.toString()),
    );

    // QuickJS occasionally re-interns atoms when GC runs between evals. That adds
    // a fixed, low overhead (~MAX_CONTEXT_VARIANCE fuel) that we allow but still guard tightly.
    // If absolute zero variance is required, pin the compiled function (avoid re-parsing) and
    // avoid forcing GC inside the measurement loop so atom tables stay untouched.
    expect(distinctValues.size).toBe(1);
    expect(variance).toBe(0n);
  });

  it('ensures module instances agree on identical fuel usage', async () => {
    const module1 = await newQuickJSWASMModuleFromVariant(gasVariant);
    const module2 = await newQuickJSWASMModuleFromVariant(gasVariant);

    const measureModule = (module: Awaited<typeof module1>): bigint => {
      const rt = configureRuntime(module);
      const ctx = rt.newContext();
      runDeterministicGC(module, rt);
      setGasBudget(module, LIMIT);
      const result = ctx.evalCode(
        'let x = 0; for(let i=0; i<1000; i++) x += i; x',
      );
      if (result.error) result.error.dispose();
      else result.value.dispose();
      const used = readGasUsage(module);
      runDeterministicGC(module, rt);
      ctx.dispose();
      rt.dispose();
      return used;
    };

    const gas1 = measureModule(module1);
    const gas2 = measureModule(module2);

    expect(gas1).toBe(gas2);
  });

  it('ensures warmup overhead is eliminated', async () => {
    const module = await newQuickJSWASMModuleFromVariant(gasVariant);
    const rt = configureRuntime(module);
    const ctx = rt.newContext();

    const runSample = (): bigint => {
      runDeterministicGC(module, rt);
      setGasBudget(module, LIMIT);
      const result = ctx.evalCode(LOOP_1K_CODE);
      if (result.error) result.error.dispose();
      else result.value.dispose();
      const used = readGasUsage(module);
      runDeterministicGC(module, rt);
      return used;
    };

    // Warm the runtime with the heavy loop before measuring.
    runSample();

    const firstGas = runSample();
    const secondGas = runSample();

    ctx.dispose();
    rt.dispose();

    expect(firstGas).toBe(secondGas);
  });
});
