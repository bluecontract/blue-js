import { describe, it, expect } from 'vitest';

import { QuickJSEvaluator } from '../quickjs-evaluator.js';
import { DEFAULT_WASM_GAS_LIMIT } from '../quickjs-config.js';
import { wasmFuelToHostGas } from '../../../runtime/gas-schedule.js';

const MEASUREMENTS = 3;
const DETERMINISM_RUNS = 10;

async function measureFuel(
  evaluator: QuickJSEvaluator,
  code: string,
): Promise<bigint> {
  let used = 0n;
  await evaluator.evaluate({
    code,
    wasmGasLimit: DEFAULT_WASM_GAS_LIMIT,
    onWasmGasUsed: ({ used: reported }) => {
      used = reported;
    },
  });
  return used;
}

async function measureFuelSeries(
  evaluator: QuickJSEvaluator,
  code: string,
  runs: number,
): Promise<bigint[]> {
  const measurements: bigint[] = [];
  for (let i = 0; i < runs; i += 1) {
    measurements.push(await measureFuel(evaluator, code));
  }
  return measurements;
}

function summarizeMeasurements(measurements: bigint[]): {
  distinct: Set<string>;
  min: bigint;
  max: bigint;
} {
  const distinct = new Set(measurements.map((value) => value.toString()));
  const min = measurements.reduce((a, b) => (a < b ? a : b));
  const max = measurements.reduce((a, b) => (a > b ? a : b));
  return { distinct, min, max };
}

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

    const results: Array<{ name: string; fuel: string; hostFuel: string }> = [];

    for (const sample of samples) {
      const used = await measureFuel(evaluator, sample.code);
      results.push({
        name: sample.name,
        fuel: used.toString(),
        hostFuel: wasmFuelToHostGas(used).toString(),
      });
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "fuel": "275",
          "hostFuel": "1",
          "name": "return-1",
        },
        {
          "fuel": "17474",
          "hostFuel": "11",
          "name": "loop-1k",
        },
        {
          "fuel": "170474",
          "hostFuel": "101",
          "name": "loop-10k",
        },
      ]
    `);
  });
});

describe('QuickJS deterministic gas metering', () => {
  it('reports stable usage for identical code in one evaluator', async () => {
    const evaluator = new QuickJSEvaluator();
    const measurements = await measureFuelSeries(
      evaluator,
      'return 1;',
      MEASUREMENTS,
    );

    const { distinct } = summarizeMeasurements(measurements);
    expect(distinct.size).toBe(1);
    expect(measurements[0]).toBeGreaterThan(0n);
  });

  it('reports stable usage across evaluator instances', async () => {
    const measurements: bigint[] = [];

    for (let i = 0; i < MEASUREMENTS; i += 1) {
      const evaluator = new QuickJSEvaluator();
      measurements.push(await measureFuel(evaluator, 'return 1;'));
    }

    const { distinct } = summarizeMeasurements(measurements);
    expect(distinct.size).toBe(1);
  });

  it('charges more gas for heavier scripts', async () => {
    const evaluator = new QuickJSEvaluator();

    const baseline = await measureFuel(evaluator, 'return 1;');
    const loop1k = await measureFuel(
      evaluator,
      'let sum = 0; for (let i = 0; i < 1000; i++) sum += i; return sum;',
    );

    expect(loop1k).toBeGreaterThan(baseline);
  });

  it('shows string concatenation is deterministic', async () => {
    const evaluator = new QuickJSEvaluator();
    const code = `
      let arr = [];
      for (let i = 0; i < 1000; i++) {
        arr.push({ x: i, y: i * 2, s: 'item' + i });
      }
      return arr.length;
    `;

    const measurements = await measureFuelSeries(
      evaluator,
      code,
      DETERMINISM_RUNS,
    );
    const { distinct, min, max } = summarizeMeasurements(measurements);

    expect(distinct.size).toBe(1);
    expect(max - min).toBe(0n);
    expect([...distinct][0]).toMatchInlineSnapshot(`"59310"`);
  });

  it('shows numeric object allocation is deterministic', async () => {
    const evaluator = new QuickJSEvaluator();
    const code = `
      let arr = [];
      for (let i = 0; i < 1000; i++) {
        arr.push({ x: i, y: i * 2, z: i * 3 });
      }
      return arr.length;
    `;

    const measurements = await measureFuelSeries(
      evaluator,
      code,
      DETERMINISM_RUNS,
    );
    const { distinct, min, max } = summarizeMeasurements(measurements);

    expect(distinct.size).toBe(1);
    expect(max - min).toBe(0n);
    expect([...distinct][0]).toMatchInlineSnapshot(`"49278"`);
  });

  it('shows array operations are deterministic', async () => {
    const evaluator = new QuickJSEvaluator();
    const code = `
      let arr = new Array(1000);
      for (let i = 0; i < 1000; i++) {
        arr[i] = i * 2 + 1;
      }
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += arr[i];
      }
      return sum;
    `;

    const measurements = await measureFuelSeries(
      evaluator,
      code,
      DETERMINISM_RUNS,
    );
    const { distinct, min, max } = summarizeMeasurements(measurements);

    expect(distinct.size).toBe(1);
    expect(max - min).toBe(0n);
    expect([...distinct][0]).toMatchInlineSnapshot(`"36390"`);
  });
});
