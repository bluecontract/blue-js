import { describe, it, expect } from 'vitest';

import {
  type QuickJSPinnedRunner,
  QuickJSEvaluator,
} from '../quickjs-evaluator.js';
import { DEFAULT_WASM_GAS_LIMIT } from '../quickjs-config.js';
import { wasmFuelToHostGas } from '../../../runtime/gas-schedule.js';

const DETERMINISM_LIMIT = 10_000_000_000n;

const SAMPLE_CODES = {
  return1: 'return 1;',
  loop1k: 'let sum = 0; for (let i = 0; i < 1000; i++) sum += i; return sum;',
  loop10k: 'let sum = 0; for (let i = 0; i < 10000; i++) sum += i; return sum;',
} as const;
const LOOP_100K_PROGRAM =
  'let s=0; for (let i=0; i<100000; i++) s+=i; return s;';

type FuelSamples = {
  return1: bigint;
  loop1k: bigint;
  loop10k: bigint;
};

let cachedFuelSamplesPromise: Promise<FuelSamples> | undefined;

const runWithRunner = async (
  evaluator: QuickJSEvaluator,
  code: string,
  gasLimit: bigint,
  options: {
    runDeterministicGCBetweenRuns?: boolean;
    reuse?: QuickJSPinnedRunner;
    wrapAsAsync?: boolean;
  } = {},
): Promise<{ used: bigint; runner: QuickJSPinnedRunner }> => {
  const runner =
    options.reuse ??
    (await evaluator.createPinnedRunner({
      code,
      wasmGasLimit: gasLimit,
      runDeterministicGCBetweenRuns:
        options.runDeterministicGCBetweenRuns ?? true,
      wrapAsAsync: options.wrapAsAsync,
    }));

  let used = 0n;
  await runner.run({
    wasmGasLimit: gasLimit,
    onWasmGasUsed: ({ used: reported }) => {
      used = reported;
    },
  });

  return { used, runner };
};

const collectFuelSamples = async (): Promise<FuelSamples> => {
  const evaluator = new QuickJSEvaluator();

  const measure = async (code: string): Promise<bigint> => {
    const { used, runner } = await runWithRunner(
      evaluator,
      code,
      DEFAULT_WASM_GAS_LIMIT,
      {
        runDeterministicGCBetweenRuns: false,
      },
    );
    runner.dispose();
    return used;
  };

  return {
    return1: await measure(SAMPLE_CODES.return1),
    loop1k: await measure(SAMPLE_CODES.loop1k),
    loop10k: await measure(SAMPLE_CODES.loop10k),
  };
};

const getFuelSamples = (): Promise<FuelSamples> => {
  if (!cachedFuelSamplesPromise) {
    cachedFuelSamplesPromise = collectFuelSamples();
  }
  return cachedFuelSamplesPromise;
};

describe('QuickJS wasm fuel samples', () => {
  it('captures baseline usage for representative scripts', async () => {
    const samples = await getFuelSamples();
    const results = [
      {
        name: 'return-1',
        fuel: samples.return1.toString(),
        hostFuel: wasmFuelToHostGas(samples.return1).toString(),
      },
      {
        name: 'loop-1k',
        fuel: samples.loop1k.toString(),
        hostFuel: wasmFuelToHostGas(samples.loop1k).toString(),
      },
      {
        name: 'loop-10k',
        fuel: samples.loop10k.toString(),
        hostFuel: wasmFuelToHostGas(samples.loop10k).toString(),
      },
    ];

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "fuel": "423911",
          "hostFuel": "3",
          "name": "return-1",
        },
        {
          "fuel": "49322566",
          "hostFuel": "305",
          "name": "loop-1k",
        },
        {
          "fuel": "489137764",
          "hostFuel": "3020",
          "name": "loop-10k",
        },
      ]
    `);
  });
});

describe('QuickJS gas metering determinism', () => {
  const LOOP_1K_FUNCTION =
    '(function loop1k(){ let s = 0; for(let i=0; i<1000; i++) s += i; return s; })';
  const LOOP_100K_PROGRAM =
    'let s=0; for (let i=0; i<100000; i++) s+=i; return s;';

  it('ensures runtime/context initialization produces identical gas values', async () => {
    const evaluator = new QuickJSEvaluator();
    const measurements: bigint[] = [];

    for (let i = 0; i < 10; i++) {
      const { used, runner } = await runWithRunner(
        evaluator,
        'return 1;',
        DETERMINISM_LIMIT,
      );
      runner.dispose();
      measurements.push(used);
    }

    const [first] = measurements;
    expect(measurements).toHaveLength(10);
    expect(first).toBeDefined();
    expect(measurements.every((sample) => sample === first)).toBe(true);
  });

  it('ensures repeated same-context evaluations remain deterministic', async () => {
    const evaluator = new QuickJSEvaluator();
    const { runner } = await runWithRunner(
      evaluator,
      LOOP_100K_PROGRAM,
      DETERMINISM_LIMIT,
      { runDeterministicGCBetweenRuns: false, wrapAsAsync: false },
    );

    // Prime once to avoid cold-start variance.
    await runWithRunner(evaluator, LOOP_100K_PROGRAM, DETERMINISM_LIMIT, {
      reuse: runner,
    });
    await runWithRunner(evaluator, LOOP_100K_PROGRAM, DETERMINISM_LIMIT, {
      reuse: runner,
    });

    const measurements: bigint[] = [];
    for (let i = 0; i < 10; i++) {
      const { used } = await runWithRunner(
        evaluator,
        LOOP_100K_PROGRAM,
        DETERMINISM_LIMIT,
        { reuse: runner },
      );
      measurements.push(used);
    }

    runner.dispose();

    const min = measurements.reduce((a, b) => (a < b ? a : b));
    const max = measurements.reduce((a, b) => (a > b ? a : b));
    const variance = max - min;
    const distinct = new Set(measurements.map((sample) => sample.toString()));

    expect(distinct.size).toBe(1);
    expect(variance).toBe(0n);
  });

  it('ensures module instances agree on identical fuel usage', async () => {
    const evaluator1 = new QuickJSEvaluator();
    const evaluator2 = new QuickJSEvaluator();

    const measure = async (evaluator: QuickJSEvaluator): Promise<bigint> => {
      const { used, runner } = await runWithRunner(
        evaluator,
        'let x = 0; for(let i=0; i<1000; i++) x += i; x',
        DETERMINISM_LIMIT,
      );
      runner.dispose();
      return used;
    };

    const gas1 = await measure(evaluator1);
    const gas2 = await measure(evaluator2);

    expect(gas1).toBe(gas2);
  });

  it('ensures warmup overhead is eliminated', async () => {
    const evaluator = new QuickJSEvaluator();
    const { runner } = await runWithRunner(
      evaluator,
      LOOP_1K_FUNCTION,
      DETERMINISM_LIMIT,
      { runDeterministicGCBetweenRuns: false },
    );

    // Warm the runtime with the heavy loop before measuring.
    await runWithRunner(evaluator, LOOP_1K_FUNCTION, DETERMINISM_LIMIT, {
      runDeterministicGCBetweenRuns: false,
      reuse: runner,
    });

    const { used: firstGas } = await runWithRunner(
      evaluator,
      LOOP_1K_FUNCTION,
      DETERMINISM_LIMIT,
      { runDeterministicGCBetweenRuns: false, reuse: runner },
    );
    const { used: secondGas } = await runWithRunner(
      evaluator,
      LOOP_1K_FUNCTION,
      DETERMINISM_LIMIT,
      { runDeterministicGCBetweenRuns: false, reuse: runner },
    );

    runner.dispose();

    const min = firstGas < secondGas ? firstGas : secondGas;
    const max = firstGas > secondGas ? firstGas : secondGas;
    expect(max - min).toBeLessThanOrEqual(500n);
  });

  it('captures deterministic gas values for regression tracking', async () => {
    const samples = await getFuelSamples();

    const snapshot = {
      return1: samples.return1.toString(),
      loop1k: samples.loop1k.toString(),
      loop10k: samples.loop10k.toString(),
    };
    expect(snapshot).toMatchInlineSnapshot(`
      {
        "loop10k": "489137764",
        "loop1k": "49322566",
        "return1": "423911",
      }
    `);
  });
});
