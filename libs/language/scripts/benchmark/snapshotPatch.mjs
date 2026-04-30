import { performance } from 'perf_hooks';
import {
  Blue,
  BlueNode,
  BasicNodeProvider,
  applyBlueNodePatch,
} from '../../dist/index.mjs';
import {
  calculateStats,
  createBaselineOptions,
  formatStats,
  handleBaseline,
  installCloneCounter,
  readPositiveInt,
} from './benchmarkUtils.mjs';

const config = {
  warmupIterations: readPositiveInt('BENCH_WARMUP_ITERATIONS', 2),
  measuredIterations: readPositiveInt('BENCH_ITERATIONS', 10),
  objectPropertyCount: readPositiveInt('BENCH_OBJECT_PROPERTIES', 300),
  perNodePayloadProperties: readPositiveInt('BENCH_NODE_PAYLOAD_PROPERTIES', 6),
};

const baselineOptions = createBaselineOptions(
  'scripts/benchmark/data/snapshot-patch-baseline.json',
);

const patchTarget = {
  propertyIndex: Math.floor(config.objectPropertyCount / 2),
  fieldIndex: Math.floor(config.perNodePayloadProperties / 2),
};

const createBenchmarkSource = () => {
  const properties = {};

  for (let i = 0; i < config.objectPropertyCount; i += 1) {
    const nodeProperties = {};
    for (let j = 0; j < config.perNodePayloadProperties; j += 1) {
      nodeProperties[`field_${j}`] = new BlueNode().setValue(
        `node-${i}-field-${j}`,
      );
    }
    properties[`property_${i}`] = new BlueNode().setProperties(nodeProperties);
  }

  return new BlueNode('SnapshotPatchBenchmarkRoot').setProperties(properties);
};

const createPatch = (iteration) => ({
  op: 'replace',
  path: `/property_${patchTarget.propertyIndex}/field_${patchTarget.fieldIndex}/value`,
  val: `patched-${iteration}`,
});

const runPatchCycle = (blue, source, iteration) => {
  const patched = applyBlueNodePatch(source, createPatch(iteration));
  const resolved = blue.resolve(patched);
  if (!resolved.isResolved()) {
    throw new Error('Expected resolve() to return ResolvedBlueNode');
  }
  return resolved;
};

const runBenchmark = async () => {
  const blue = new Blue({ nodeProvider: new BasicNodeProvider() });
  const benchmarkSource = createBenchmarkSource();
  const cloneCounter = installCloneCounter(BlueNode);
  const durations = [];
  const cloneCounts = [];
  const cloneShallowCounts = [];
  const cloneTotalCounts = [];

  console.log('Patch-then-full-resolve benchmark configuration:');
  console.log(`- warmup iterations: ${config.warmupIterations}`);
  console.log(`- measured iterations: ${config.measuredIterations}`);
  console.log(`- object properties: ${config.objectPropertyCount}`);
  console.log(
    `- per-node payload properties: ${config.perNodePayloadProperties}`,
  );
  console.log(
    `- patch path: /property_${patchTarget.propertyIndex}/field_${patchTarget.fieldIndex}/value`,
  );

  try {
    for (let i = 0; i < config.warmupIterations; i += 1) {
      cloneCounter.reset();
      runPatchCycle(blue, benchmarkSource, i);
    }

    for (let i = 0; i < config.measuredIterations; i += 1) {
      cloneCounter.reset();
      const start = performance.now();
      runPatchCycle(blue, benchmarkSource, i);
      const durationMs = performance.now() - start;

      const cloneCount = cloneCounter.deepValue();
      const cloneShallowCount = cloneCounter.shallowValue();
      const cloneTotalCount = cloneCounter.totalValue();
      durations.push(durationMs);
      cloneCounts.push(cloneCount);
      cloneShallowCounts.push(cloneShallowCount);
      cloneTotalCounts.push(cloneTotalCount);

      console.log(
        `Iteration ${String(i + 1).padStart(2, '0')}: ${durationMs.toFixed(
          2,
        )} ms | clone() calls: ${cloneCount} | cloneShallow() calls: ${cloneShallowCount} | clone(total): ${cloneTotalCount}`,
      );
    }
  } finally {
    cloneCounter.restore();
  }

  const timeStats = calculateStats(durations);
  const cloneStats = calculateStats(cloneCounts);
  const cloneShallowStats = calculateStats(cloneShallowCounts);
  const cloneTotalStats = calculateStats(cloneTotalCounts);

  console.log('\nSummary');
  console.log(`- patch-then-full-resolve time (ms): ${formatStats(timeStats)}`);
  console.log(
    `- clone() calls: avg=${cloneStats.avg.toFixed(2)} min=${cloneStats.min} max=${cloneStats.max}`,
  );
  console.log(
    `- cloneShallow() calls: avg=${cloneShallowStats.avg.toFixed(2)} min=${cloneShallowStats.min} max=${cloneShallowStats.max}`,
  );
  console.log(
    `- clone(total) calls: avg=${cloneTotalStats.avg.toFixed(2)} min=${cloneTotalStats.min} max=${cloneTotalStats.max}`,
  );

  const result = {
    createdAt: new Date().toISOString(),
    config: {
      ...config,
      patchTarget,
    },
    metrics: {
      timeMs: timeStats,
      cloneCalls: cloneStats,
      cloneShallowCalls: cloneShallowStats,
      cloneTotalCalls: cloneTotalStats,
    },
  };

  await handleBaseline(result, baselineOptions, [
    {
      label: 'patch-then-full-resolve avg',
      path: 'metrics.timeMs.avg',
      unit: 'ms',
    },
    {
      label: 'clone avg',
      path: 'metrics.cloneCalls.avg',
    },
    {
      label: 'cloneShallow avg',
      path: 'metrics.cloneShallowCalls.avg',
    },
    {
      label: 'total clone avg',
      path: 'metrics.cloneTotalCalls.avg',
    },
  ]);
};

runBenchmark().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
