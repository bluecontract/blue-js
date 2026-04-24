import { testData } from './data/testData.mjs';
import { performance } from 'perf_hooks';
import { BlueNode, BlueIdCalculator } from '../../dist/index.mjs';
import {
  calculateStats,
  createBaselineOptions,
  formatStats,
  handleBaseline,
  readPositiveInt,
} from './benchmarkUtils.mjs';

const config = {
  warmupIterations: readPositiveInt('BENCH_WARMUP_ITERATIONS', 2),
  measuredIterations: readPositiveInt('BENCH_ITERATIONS', 10),
};

const baselineOptions = createBaselineOptions(
  'scripts/benchmark/data/calculate-blue-id-baseline.json',
);

const nodeFromJson = (value) => {
  const node = new BlueNode();

  if (Array.isArray(value)) {
    return node.setItems(value.map(nodeFromJson));
  }

  if (value !== null && typeof value === 'object') {
    return node.setProperties(
      Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, nodeFromJson(child)]),
      ),
    );
  }

  return node.setValue(value);
};

const node = nodeFromJson(testData);

const runBenchmark = async () => {
  const durations = [];

  console.log('Calculate BlueId benchmark configuration:');
  console.log(`- warmup iterations: ${config.warmupIterations}`);
  console.log(`- measured iterations: ${config.measuredIterations}`);

  for (let i = 0; i < config.warmupIterations; i += 1) {
    await BlueIdCalculator.calculateBlueId(node);
  }

  for (let i = 0; i < config.measuredIterations; i += 1) {
    const start = performance.now();
    await BlueIdCalculator.calculateBlueId(node);
    const durationMs = performance.now() - start;
    durations.push(durationMs);

    console.log(
      `Iteration ${String(i + 1).padStart(2, '0')}: ${durationMs.toFixed(
        2,
      )} ms`,
    );
  }

  const timeStats = calculateStats(durations);

  console.log('\nSummary');
  console.log(`- calculateBlueId time (ms): ${formatStats(timeStats)}`);

  const result = {
    createdAt: new Date().toISOString(),
    config,
    metrics: {
      timeMs: timeStats,
    },
  };

  await handleBaseline(result, baselineOptions, [
    {
      label: 'calculateBlueId avg',
      path: 'metrics.timeMs.avg',
      unit: 'ms',
    },
  ]);
};

runBenchmark().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
