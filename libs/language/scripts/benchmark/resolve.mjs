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
  objectPropertyCount: readPositiveInt('BENCH_OBJECT_PROPERTIES', 300),
  listItemCount: readPositiveInt('BENCH_LIST_ITEMS', 300),
  typePropertyCount: readPositiveInt('BENCH_TYPE_PROPERTIES', 60),
  perNodePayloadProperties: readPositiveInt('BENCH_NODE_PAYLOAD_PROPERTIES', 6),
};

const baselineOptions = {
  filePath:
    process.env.BENCH_BASELINE_FILE ??
    'scripts/benchmark/data/resolve-baseline.json',
  save: readBooleanFlag('BENCH_SAVE_BASELINE'),
  compare: readBooleanFlag('BENCH_COMPARE_BASELINE'),
};

const createSharedTypeNode = (typePropertyCount) => {
  const sharedTypeProperties = {};

  for (let i = 0; i < typePropertyCount; i += 1) {
    sharedTypeProperties[`base_property_${i}`] = new BlueNode().setValue(
      `base-value-${i}`,
    );
  }

  return new BlueNode('ResolveBenchmarkType').setProperties(
    sharedTypeProperties,
  );
};

const createTypedBenchmarkNode = (typeBlueId, nodeIndex, payloadProperties) => {
  const nodeProperties = {};

  for (let i = 0; i < payloadProperties; i += 1) {
    nodeProperties[`field_${i}`] = new BlueNode().setValue(
      `node-${nodeIndex}-field-${i}`,
    );
  }

  return new BlueNode()
    .setType(new BlueNode().setBlueId(typeBlueId))
    .setProperties(nodeProperties);
};

const createBenchmarkSource = (typeBlueId) => {
  const properties = {};

  for (let i = 0; i < config.objectPropertyCount; i += 1) {
    properties[`property_${i}`] = createTypedBenchmarkNode(
      typeBlueId,
      i,
      config.perNodePayloadProperties,
    );
  }

  const items = Array.from({ length: config.listItemCount }, (_, index) =>
    createTypedBenchmarkNode(
      typeBlueId,
      config.objectPropertyCount + index,
      config.perNodePayloadProperties,
    ),
  );

  return new BlueNode('ResolveBenchmarkRoot')
    .setProperties(properties)
    .setItems(items);
};

const installCloneCounter = () => {
  const originalClone = BlueNode.prototype.clone;
  let cloneCount = 0;

  BlueNode.prototype.clone = function cloneWithCounter() {
    cloneCount += 1;
    return originalClone.call(this);
  };

  return {
    reset() {
      cloneCount = 0;
    },
    value() {
      return cloneCount;
    },
    restore() {
      BlueNode.prototype.clone = originalClone;
    },
  };
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
    const baselineCloneAvg = baseline?.metrics?.cloneCalls?.avg;
    if (
      !Number.isFinite(baselineTimeAvg) ||
      !Number.isFinite(baselineCloneAvg)
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
    const cloneDelta = result.metrics.cloneCalls.avg - baselineCloneAvg;

    console.log(
      `- resolve avg delta: ${timeDelta >= 0 ? '+' : ''}${timeDelta.toFixed(
        2,
      )} ms (${calculatePercentDelta(result.metrics.timeMs.avg, baselineTimeAvg)})`,
    );
    console.log(
      `- clone avg delta: ${cloneDelta >= 0 ? '+' : ''}${cloneDelta.toFixed(
        2,
      )} (${calculatePercentDelta(
        result.metrics.cloneCalls.avg,
        baselineCloneAvg,
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

const runBenchmark = async () => {
  const nodeProvider = new BasicNodeProvider();
  nodeProvider.addSingleNodes(createSharedTypeNode(config.typePropertyCount));

  const typeBlueId = nodeProvider.getBlueIdByName('ResolveBenchmarkType');
  const benchmarkSource = createBenchmarkSource(typeBlueId);
  const blue = new Blue({ nodeProvider });

  const cloneCounter = installCloneCounter();
  const durations = [];
  const cloneCounts = [];

  console.log('Resolve benchmark configuration:');
  console.log(`- warmup iterations: ${config.warmupIterations}`);
  console.log(`- measured iterations: ${config.measuredIterations}`);
  console.log(`- object properties: ${config.objectPropertyCount}`);
  console.log(`- list items: ${config.listItemCount}`);
  console.log(`- shared type properties: ${config.typePropertyCount}`);
  console.log(
    `- per-node payload properties: ${config.perNodePayloadProperties}`,
  );
  console.log(`- shared type blueId: ${typeBlueId}`);

  try {
    for (let i = 0; i < config.warmupIterations; i += 1) {
      cloneCounter.reset();
      blue.resolve(benchmarkSource);
    }

    for (let i = 0; i < config.measuredIterations; i += 1) {
      cloneCounter.reset();
      const start = performance.now();
      const resolved = blue.resolve(benchmarkSource);
      const durationMs = performance.now() - start;

      if (!resolved.isResolved()) {
        throw new Error('Expected resolve() to return ResolvedBlueNode');
      }

      const cloneCount = cloneCounter.value();
      durations.push(durationMs);
      cloneCounts.push(cloneCount);

      console.log(
        `Iteration ${String(i + 1).padStart(2, '0')}: ${durationMs.toFixed(
          2,
        )} ms | clone() calls: ${cloneCount}`,
      );
    }
  } finally {
    cloneCounter.restore();
  }

  const timeStats = calculateStats(durations);
  const cloneStats = calculateStats(cloneCounts);

  console.log('\nSummary');
  console.log(
    `- resolve time (ms): avg=${timeStats.avg.toFixed(2)} min=${timeStats.min.toFixed(2)} max=${timeStats.max.toFixed(2)}`,
  );
  console.log(
    `- clone() calls: avg=${cloneStats.avg.toFixed(2)} min=${cloneStats.min} max=${cloneStats.max}`,
  );

  const result = {
    createdAt: new Date().toISOString(),
    config,
    sharedTypeBlueId: typeBlueId,
    metrics: {
      timeMs: timeStats,
      cloneCalls: cloneStats,
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
