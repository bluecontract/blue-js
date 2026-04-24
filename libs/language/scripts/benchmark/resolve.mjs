import { performance } from 'perf_hooks';
import { Blue, BlueNode, BasicNodeProvider } from '../../dist/index.mjs';
import {
  calculateStats,
  createBaselineOptions,
  formatStats,
  handleBaseline,
  installCloneCounter,
  readEnum,
  readPositiveInt,
} from './benchmarkUtils.mjs';

const TYPE_MODES = ['shared', 'unique'];
const typeMode = readEnum('BENCH_TYPE_MODE', TYPE_MODES, 'shared');

const config = {
  warmupIterations: readPositiveInt('BENCH_WARMUP_ITERATIONS', 2),
  measuredIterations: readPositiveInt('BENCH_ITERATIONS', 10),
  objectPropertyCount: readPositiveInt('BENCH_OBJECT_PROPERTIES', 300),
  listItemCount: readPositiveInt('BENCH_LIST_ITEMS', 300),
  typePropertyCount: readPositiveInt('BENCH_TYPE_PROPERTIES', 60),
  perNodePayloadProperties: readPositiveInt('BENCH_NODE_PAYLOAD_PROPERTIES', 6),
  typeMode,
};

const defaultBaselineFilePathByMode = {
  shared: 'scripts/benchmark/data/resolve-baseline.json',
  unique: 'scripts/benchmark/data/resolve-baseline-unique.json',
};

const baselineOptions = createBaselineOptions(
  defaultBaselineFilePathByMode[typeMode],
);

const createTypeDefinitionNode = (name, typePropertyCount, typeIndex) => {
  const typeProperties = {};

  for (let i = 0; i < typePropertyCount; i += 1) {
    typeProperties[`base_property_${i}`] = new BlueNode().setValue(
      `base-value-${typeIndex}-${i}`,
    );
  }

  return new BlueNode(name).setProperties(typeProperties);
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
  const typeBlueIds = Array.isArray(typeBlueId) ? typeBlueId : [typeBlueId];
  if (typeBlueIds.length === 0) {
    throw new Error('Expected at least one type blueId for benchmark source');
  }

  const getTypeBlueIdForIndex = (index) =>
    typeBlueIds[index % typeBlueIds.length];
  const properties = {};

  for (let i = 0; i < config.objectPropertyCount; i += 1) {
    properties[`property_${i}`] = createTypedBenchmarkNode(
      getTypeBlueIdForIndex(i),
      i,
      config.perNodePayloadProperties,
    );
  }

  const items = Array.from({ length: config.listItemCount }, (_, index) =>
    createTypedBenchmarkNode(
      getTypeBlueIdForIndex(config.objectPropertyCount + index),
      config.objectPropertyCount + index,
      config.perNodePayloadProperties,
    ),
  );

  return new BlueNode('ResolveBenchmarkRoot')
    .setProperties(properties)
    .setItems(items);
};

const createTypePlan = () => {
  const totalTypedNodes = config.objectPropertyCount + config.listItemCount;

  if (config.typeMode === 'shared') {
    return {
      definitions: [
        createTypeDefinitionNode(
          'ResolveBenchmarkType',
          config.typePropertyCount,
          0,
        ),
      ],
      typeNameForIndex: () => 'ResolveBenchmarkType',
      typeDefinitionsCount: 1,
      duplicateTypeReferenceCount: Math.max(totalTypedNodes - 1, 0),
    };
  }

  const definitionNames = Array.from(
    { length: totalTypedNodes },
    (_, index) => `ResolveBenchmarkType-${index}`,
  );
  return {
    definitions: definitionNames.map((name, index) =>
      createTypeDefinitionNode(name, config.typePropertyCount, index),
    ),
    typeNameForIndex: (index) => definitionNames[index],
    typeDefinitionsCount: definitionNames.length,
    duplicateTypeReferenceCount: 0,
  };
};

const runBenchmark = async () => {
  const nodeProvider = new BasicNodeProvider();
  const typePlan = createTypePlan();
  nodeProvider.addSingleNodes(...typePlan.definitions);
  const totalTypedNodes = config.objectPropertyCount + config.listItemCount;
  const typeBlueIds = Array.from({ length: totalTypedNodes }, (_, index) =>
    nodeProvider.getBlueIdByName(typePlan.typeNameForIndex(index)),
  );

  const benchmarkSource = createBenchmarkSource(typeBlueIds);
  const blue = new Blue({ nodeProvider });

  const cloneCounter = installCloneCounter(BlueNode);
  const durations = [];
  const cloneCounts = [];
  const cloneShallowCounts = [];
  const cloneTotalCounts = [];

  console.log('Resolve benchmark configuration:');
  console.log(`- warmup iterations: ${config.warmupIterations}`);
  console.log(`- measured iterations: ${config.measuredIterations}`);
  console.log(`- object properties: ${config.objectPropertyCount}`);
  console.log(`- list items: ${config.listItemCount}`);
  console.log(`- type mode: ${config.typeMode}`);
  console.log(`- type definitions: ${typePlan.typeDefinitionsCount}`);
  console.log(
    `- duplicate type references: ${typePlan.duplicateTypeReferenceCount}`,
  );
  console.log(`- type properties per definition: ${config.typePropertyCount}`);
  console.log(
    `- per-node payload properties: ${config.perNodePayloadProperties}`,
  );
  if (config.typeMode === 'shared') {
    console.log(`- shared type blueId: ${typeBlueIds[0]}`);
  } else {
    console.log(`- first unique type blueId: ${typeBlueIds[0]}`);
    console.log(
      `- last unique type blueId: ${typeBlueIds[typeBlueIds.length - 1]}`,
    );
  }

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
  console.log(`- resolve time (ms): ${formatStats(timeStats)}`);
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
    config,
    typeMode: config.typeMode,
    typeDefinitionsCount: typePlan.typeDefinitionsCount,
    duplicateTypeReferenceCount: typePlan.duplicateTypeReferenceCount,
    sharedTypeBlueId: config.typeMode === 'shared' ? typeBlueIds[0] : null,
    metrics: {
      timeMs: timeStats,
      cloneCalls: cloneStats,
      cloneShallowCalls: cloneShallowStats,
      cloneTotalCalls: cloneTotalStats,
    },
  };

  await handleBaseline(result, baselineOptions, [
    {
      label: 'resolve avg',
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
