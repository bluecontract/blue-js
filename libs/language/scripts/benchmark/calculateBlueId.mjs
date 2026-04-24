import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { performance } from 'perf_hooks';
import { testData } from './data/testData.mjs';
import { BlueIdCalculator, Blue } from '../../dist/index.mjs';

const readPositiveInt = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected ${name} to be a positive integer, got: ${raw}`);
  }

  return parsed;
};

const readBooleanFlag = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
};

const calculateStats = (values) => {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: total / values.length,
  };
};

const calculatePercentDelta = (current, baseline) => {
  if (baseline === 0) {
    return 'n/a';
  }

  const percent = ((current - baseline) / baseline) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

const hasSameConfig = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

const config = {
  warmupIterations: readPositiveInt('BENCH_WARMUP_ITERATIONS', 2),
  measuredIterations: readPositiveInt('BENCH_ITERATIONS', 10),
};

const baselineOptions = {
  filePath:
    process.env.BENCH_BASELINE_FILE ??
    'scripts/benchmark/data/calculate-blue-id-baseline.json',
  save: readBooleanFlag('BENCH_SAVE_BASELINE'),
  compare: readBooleanFlag('BENCH_COMPARE_BASELINE'),
};

const compareWithBaseline = async (result) => {
  try {
    const raw = await readFile(baselineOptions.filePath, 'utf8');
    const baseline = JSON.parse(raw);
    const baselineTimeAvg = baseline?.metrics?.timeMs?.avg;
    if (!Number.isFinite(baselineTimeAvg)) {
      throw new Error(
        `Baseline file has unsupported format: ${baselineOptions.filePath}`,
      );
    }

    console.log('\nBaseline comparison');
    if (!hasSameConfig(config, baseline.config)) {
      console.log(
        '- warning: baseline config differs from current run; treat comparison as approximate',
      );
    }

    const timeDelta = result.metrics.timeMs.avg - baselineTimeAvg;
    console.log(
      `- calculateBlueId avg delta: ${
        timeDelta >= 0 ? '+' : ''
      }${timeDelta.toFixed(2)} ms (${calculatePercentDelta(
        result.metrics.timeMs.avg,
        baselineTimeAvg,
      )})`,
    );
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      console.log(
        `\nBaseline comparison skipped: file not found (${baselineOptions.filePath})`,
      );
      return;
    }

    throw error;
  }
};

const saveBaseline = async (result) => {
  await mkdir(dirname(baselineOptions.filePath), { recursive: true });
  await writeFile(
    baselineOptions.filePath,
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  console.log(`Baseline saved to ${baselineOptions.filePath}`);
};

const runProfile = async () => {
  const node = new Blue().jsonValueToNode(testData);
  const durations = [];

  console.log('calculateBlueId benchmark configuration:');
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
      `Iteration ${String(i + 1).padStart(2, '0')}: ${durationMs.toFixed(2)} ms`,
    );
  }

  const timeStats = calculateStats(durations);
  console.log('\nSummary');
  console.log(
    `- calculateBlueId time (ms): avg=${timeStats.avg.toFixed(2)} min=${timeStats.min.toFixed(2)} max=${timeStats.max.toFixed(2)}`,
  );

  const result = {
    createdAt: new Date().toISOString(),
    config,
    metrics: { timeMs: timeStats },
  };

  if (baselineOptions.compare) {
    await compareWithBaseline(result);
  }

  if (baselineOptions.save) {
    await saveBaseline(result);
  }
};

runProfile().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
