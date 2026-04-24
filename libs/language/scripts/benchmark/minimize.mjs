import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { performance } from 'perf_hooks';
import { Blue, BlueNode, BasicNodeProvider } from '../../dist/index.mjs';

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

const readNonNegativeInt = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Expected ${name} to be a non-negative integer, got: ${raw}`,
    );
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

const config = {
  warmupIterations: readPositiveInt('BENCH_WARMUP_ITERATIONS', 2),
  measuredIterations: readPositiveInt('BENCH_ITERATIONS', 10),
  typePropertyCount: readPositiveInt('BENCH_TYPE_PROPERTIES', 300),
  typeItemCount: readNonNegativeInt('BENCH_TYPE_ITEMS', 0),
  authoringPropertyCount: readPositiveInt('BENCH_AUTHORING_PROPERTIES', 420),
  authoringItemCount: readNonNegativeInt('BENCH_AUTHORING_ITEMS', 0),
};

const baselineOptions = {
  filePath:
    process.env.BENCH_BASELINE_FILE ??
    'scripts/benchmark/data/minimize-baseline.json',
  save: readBooleanFlag('BENCH_SAVE_BASELINE'),
  compare: readBooleanFlag('BENCH_COMPARE_BASELINE'),
};

const createTypeNode = () => {
  const properties = {};
  for (let i = 0; i < config.typePropertyCount; i += 1) {
    properties[`field_${i}`] = new BlueNode().setValue(`type-value-${i}`);
  }

  return new BlueNode('MinimizeBenchmarkType')
    .setDescription('Synthetic benchmark type')
    .setProperties(properties)
    .setItems(
      Array.from({ length: config.typeItemCount }, (_, index) =>
        new BlueNode().setValue(`type-item-${index}`),
      ),
    );
};

const createAuthoringNode = (typeBlueId) => {
  const properties = {};
  for (let i = 0; i < config.authoringPropertyCount; i += 1) {
    if (i < config.typePropertyCount) {
      properties[`field_${i}`] = new BlueNode().setValue(`type-value-${i}`);
      continue;
    }

    properties[`field_${i}`] = new BlueNode().setValue(`authoring-value-${i}`);
  }

  const items = Array.from(
    { length: config.authoringItemCount },
    (_, index) => {
      if (index < config.typeItemCount) {
        return new BlueNode().setValue(`type-item-${index}`);
      }
      return new BlueNode().setValue(`authoring-item-${index}`);
    },
  );

  return new BlueNode('MinimizeBenchmarkDoc')
    .setType(new BlueNode().setBlueId(typeBlueId))
    .setDescription('Synthetic benchmark instance')
    .setProperties(properties)
    .setItems(items);
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

const compareWithBaseline = async (result) => {
  try {
    const raw = await readFile(baselineOptions.filePath, 'utf8');
    const baseline = JSON.parse(raw);

    const baselineTimeAvg = baseline?.metrics?.timeMs?.avg;
    const baselineReductionAvg = baseline?.metrics?.propertyReduction?.avg;
    if (
      !Number.isFinite(baselineTimeAvg) ||
      !Number.isFinite(baselineReductionAvg)
    ) {
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
    const reductionDelta =
      result.metrics.propertyReduction.avg - baselineReductionAvg;

    console.log(
      `- minimize avg delta: ${timeDelta >= 0 ? '+' : ''}${timeDelta.toFixed(
        2,
      )} ms (${calculatePercentDelta(result.metrics.timeMs.avg, baselineTimeAvg)})`,
    );
    console.log(
      `- property reduction avg delta: ${
        reductionDelta >= 0 ? '+' : ''
      }${reductionDelta.toFixed(2)} (${calculatePercentDelta(
        result.metrics.propertyReduction.avg,
        baselineReductionAvg,
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

const getPropertyCount = (node) =>
  Object.keys(node.getProperties() ?? {}).length;
const getItemCount = (node) => (node.getItems() ?? []).length;

const runBenchmark = async () => {
  const nodeProvider = new BasicNodeProvider();
  const typeNode = createTypeNode();
  nodeProvider.addSingleNodes(typeNode);
  const typeBlueId = nodeProvider.getBlueIdByName('MinimizeBenchmarkType');
  const authoring = createAuthoringNode(typeBlueId);
  const blue = new Blue({ nodeProvider });
  const expectedBlueId = blue.calculateBlueIdSync(authoring);
  const resolved = blue.resolve(authoring);
  const resolvedPropertyCount = getPropertyCount(resolved);
  const resolvedItemCount = getItemCount(resolved);

  const durations = [];
  const propertyReductions = [];
  const itemReductions = [];
  let blueIdMismatchCount = 0;

  console.log('Minimize benchmark configuration:');
  console.log(`- warmup iterations: ${config.warmupIterations}`);
  console.log(`- measured iterations: ${config.measuredIterations}`);
  console.log(`- type properties: ${config.typePropertyCount}`);
  console.log(`- type items: ${config.typeItemCount}`);
  console.log(`- authoring properties: ${config.authoringPropertyCount}`);
  console.log(`- authoring items: ${config.authoringItemCount}`);
  console.log(`- type blueId: ${typeBlueId}`);
  console.log(`- expected BlueId: ${expectedBlueId}`);

  for (let i = 0; i < config.warmupIterations; i += 1) {
    blue.minimizeResolved(resolved);
  }

  for (let i = 0; i < config.measuredIterations; i += 1) {
    const start = performance.now();
    const minimized = blue.minimizeResolved(resolved);
    const durationMs = performance.now() - start;
    const minimizedBlueId = blue.calculateBlueIdSync(minimized);
    const blueIdMatches = minimizedBlueId === expectedBlueId;
    if (!blueIdMatches) {
      blueIdMismatchCount += 1;
    }

    const minimizedPropertyCount = getPropertyCount(minimized);
    const minimizedItemCount = getItemCount(minimized);
    const propertyReduction = resolvedPropertyCount - minimizedPropertyCount;
    const itemReduction = resolvedItemCount - minimizedItemCount;

    durations.push(durationMs);
    propertyReductions.push(propertyReduction);
    itemReductions.push(itemReduction);

    console.log(
      `Iteration ${String(i + 1).padStart(2, '0')}: ${durationMs.toFixed(
        2,
      )} ms | properties ${resolvedPropertyCount} -> ${minimizedPropertyCount} (Δ ${propertyReduction}) | items ${resolvedItemCount} -> ${minimizedItemCount} (Δ ${itemReduction}) | blueId ${
        blueIdMatches ? 'match' : 'mismatch'
      }`,
    );
  }

  const timeStats = calculateStats(durations);
  const propertyReductionStats = calculateStats(propertyReductions);
  const itemReductionStats = calculateStats(itemReductions);

  console.log('\nSummary');
  console.log(
    `- minimize time (ms): avg=${timeStats.avg.toFixed(2)} min=${timeStats.min.toFixed(2)} max=${timeStats.max.toFixed(2)}`,
  );
  console.log(
    `- property reduction: avg=${propertyReductionStats.avg.toFixed(2)} min=${propertyReductionStats.min} max=${propertyReductionStats.max}`,
  );
  console.log(
    `- item reduction: avg=${itemReductionStats.avg.toFixed(2)} min=${itemReductionStats.min} max=${itemReductionStats.max}`,
  );
  console.log(
    `- BlueId mismatches vs authoring: ${blueIdMismatchCount}/${config.measuredIterations}`,
  );

  const result = {
    createdAt: new Date().toISOString(),
    config,
    typeBlueId,
    expectedBlueId,
    metrics: {
      timeMs: timeStats,
      propertyReduction: propertyReductionStats,
      itemReduction: itemReductionStats,
      blueIdMismatchCount,
      blueIdMismatchRatio: blueIdMismatchCount / config.measuredIterations,
    },
  };

  if (baselineOptions.compare) {
    await compareWithBaseline(result);
  }

  if (baselineOptions.save) {
    await saveBaseline(result);
  }
};

runBenchmark().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
