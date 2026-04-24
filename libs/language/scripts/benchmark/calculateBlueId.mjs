import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { performance } from 'perf_hooks';
import { testData } from './data/testData.mjs';
import { BlueIdCalculator, BlueNode } from '../../dist/index.mjs';

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
  largeListItems: readPositiveInt('BENCH_LARGE_LIST_ITEMS', 2000),
  emptyListFields: readPositiveInt('BENCH_EMPTY_LIST_FIELDS', 500),
  referenceFields: readPositiveInt('BENCH_REFERENCE_FIELDS', 1000),
  baselineFile:
    process.env.BENCH_BASELINE_FILE ??
    'scripts/benchmark/baselines/calculate-blue-id-baseline.json',
  saveBaseline: readBooleanFlag('BENCH_SAVE_BASELINE'),
};

const createLargeList = () => ({
  items: Array.from({ length: config.largeListItems }, (_, index) => ({
    id: `item-${index}`,
    value: index,
    tags: [`tag-${index % 5}`, `bucket-${index % 17}`],
  })),
});

const createEmptyListHeavyDocument = () => {
  const properties = {};
  for (let i = 0; i < config.emptyListFields; i += 1) {
    properties[`empty_${i}`] = [];
    properties[`value_${i}`] = i;
  }
  return properties;
};

const createPureReferenceHeavyDocument = () => {
  const properties = {};
  for (let i = 0; i < config.referenceFields; i += 1) {
    properties[`ref_${i}`] = {
      blueId: `ReferenceBlueId${i.toString().padStart(6, '0')}`,
    };
  }
  return properties;
};

const authoringVariant = {
  amount: 10,
  label: 'phase-0',
  entries: ['a', 'b', 'c'],
  nested: {
    enabled: true,
    count: 3,
  },
};

const wrappedVariant = {
  amount: { value: 10 },
  label: { value: 'phase-0' },
  entries: {
    items: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
  },
  nested: {
    enabled: { value: true },
    count: { value: 3 },
  },
};

const scenarios = [
  ['nested-object', testData],
  ['large-list', createLargeList()],
  ['empty-list-heavy', createEmptyListHeavyDocument()],
  ['pure-reference-heavy', createPureReferenceHeavyDocument()],
  ['authoring-sugar-variant', authoringVariant],
  ['wrapped-variant', wrappedVariant],
];

const collectMetrics = (value) => {
  const metrics = {
    byteLength: Buffer.byteLength(JSON.stringify(value), 'utf8'),
    maps: 0,
    lists: 0,
    scalars: 0,
    emptyLists: 0,
    exactReferences: 0,
    broadReferences: 0,
    scalarWrappers: 0,
    listWrappers: 0,
  };

  const visit = (current) => {
    if (Array.isArray(current)) {
      metrics.lists += 1;
      if (current.length === 0) {
        metrics.emptyLists += 1;
      }
      current.forEach(visit);
      return;
    }

    if (current !== null && typeof current === 'object') {
      metrics.maps += 1;
      const keys = Object.keys(current);
      if (keys.length === 1 && keys[0] === 'blueId') {
        metrics.exactReferences += 1;
      } else if (keys.includes('blueId')) {
        metrics.broadReferences += 1;
      }
      if (keys.includes('value')) {
        metrics.scalarWrappers += 1;
      }
      if (keys.includes('items')) {
        metrics.listWrappers += 1;
      }
      Object.values(current).forEach(visit);
      return;
    }

    metrics.scalars += 1;
  };

  visit(value);
  return metrics;
};

const jsonToBenchmarkNode = (value) => {
  if (Array.isArray(value)) {
    return new BlueNode().setItems(value.map(jsonToBenchmarkNode));
  }

  if (value !== null && typeof value === 'object') {
    const node = new BlueNode();
    const properties = {};

    for (const [key, entryValue] of Object.entries(value)) {
      if (key === 'name' && typeof entryValue === 'string') {
        node.setName(entryValue);
      } else if (key === 'description' && typeof entryValue === 'string') {
        node.setDescription(entryValue);
      } else if (
        key === 'value' &&
        (entryValue === null || typeof entryValue !== 'object')
      ) {
        node.setValue(entryValue);
      } else if (key === 'items' && Array.isArray(entryValue)) {
        node.setItems(entryValue.map(jsonToBenchmarkNode));
      } else if (key === 'blueId' && typeof entryValue === 'string') {
        node.setBlueId(entryValue);
      } else {
        properties[key] = jsonToBenchmarkNode(entryValue);
      }
    }

    if (Object.keys(properties).length > 0) {
      node.setProperties(properties);
    }

    return node;
  }

  return new BlueNode().setValue(value);
};

const calculateStats = (durations) => {
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  return {
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    avgMs: total / durations.length,
  };
};

const runScenario = async ([name, value]) => {
  const node = jsonToBenchmarkNode(value);
  const metrics = collectMetrics(value);

  for (let i = 0; i < config.warmupIterations; i += 1) {
    await BlueIdCalculator.calculateBlueId(node);
  }

  const durations = [];
  let lastBlueId = null;
  for (let i = 0; i < config.measuredIterations; i += 1) {
    const start = performance.now();
    lastBlueId = await BlueIdCalculator.calculateBlueId(node);
    durations.push(performance.now() - start);
  }

  return {
    name,
    ...metrics,
    ...calculateStats(durations),
    iterations: config.measuredIterations,
    blueId: lastBlueId,
  };
};

async function runProfile() {
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }

  console.table(
    results.map((result) => ({
      scenario: result.name,
      avgMs: Number(result.avgMs.toFixed(3)),
      minMs: Number(result.minMs.toFixed(3)),
      maxMs: Number(result.maxMs.toFixed(3)),
      bytes: result.byteLength,
      maps: result.maps,
      lists: result.lists,
      emptyLists: result.emptyLists,
      exactReferences: result.exactReferences,
      broadReferences: result.broadReferences,
    })),
  );

  if (config.saveBaseline) {
    await mkdir(dirname(config.baselineFile), { recursive: true });
    await writeFile(
      config.baselineFile,
      `${JSON.stringify({ config, results }, null, 2)}\n`,
    );
    console.log(`Saved BlueId benchmark baseline to ${config.baselineFile}`);
  }

  console.log('BlueId baseline profiling complete');
}

runProfile().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
