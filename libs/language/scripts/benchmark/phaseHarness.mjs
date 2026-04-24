import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { performance } from 'perf_hooks';
import {
  Blue,
  BasicNodeProvider,
  BlueIdCalculator,
} from '../../dist/index.mjs';

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

const readString = (name, fallback) => process.env[name] ?? fallback;

const measure = (fn, warmupIterations, measuredIterations) => {
  for (let i = 0; i < warmupIterations; i += 1) {
    fn();
  }

  const durations = [];
  for (let i = 0; i < measuredIterations; i += 1) {
    const start = performance.now();
    fn();
    durations.push(performance.now() - start);
  }

  return durations;
};

const average = (values) =>
  values.reduce((acc, value) => acc + value, 0) / values.length;

const percentile = (values, p) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(p * (sorted.length - 1))];
};

const countProperties = (node) =>
  Object.keys(node.getProperties() ?? {}).length;

const createPropertyLines = (from, to, keyPrefix, valuePrefix) =>
  Array.from(
    { length: to - from },
    (_, idx) => `${keyPrefix}${from + idx}: ${valuePrefix}${from + idx}`,
  ).join('\n');

const run = async () => {
  const config = {
    commit: readString('BENCH_COMMIT', 'unknown'),
    warmupIterations: readPositiveInt('BENCH_WARMUP_ITERATIONS', 2),
    measuredIterations: readPositiveInt('BENCH_ITERATIONS', 20),
    inheritedPropertyCount: readPositiveInt('BENCH_INHERITED_PROPERTIES', 120),
    extraPropertyCount: readPositiveInt('BENCH_EXTRA_PROPERTIES', 60),
  };

  const provider = new BasicNodeProvider();
  provider.addSingleDocs(
    `name: BaseType\n${createPropertyLines(0, config.inheritedPropertyCount, 'p', 'v')}`,
  );
  const baseBlueId = provider.getBlueIdByName('BaseType');
  const blue = new Blue({ nodeProvider: provider });

  const authoringYaml = `name: BenchDoc
type:
  blueId: ${baseBlueId}
${createPropertyLines(0, config.inheritedPropertyCount, 'p', 'v')}
${createPropertyLines(
  config.inheritedPropertyCount,
  config.inheritedPropertyCount + config.extraPropertyCount,
  'p',
  'extra-',
)}`;

  const authoring = blue.yamlToNode(authoringYaml);
  const resolved = blue.resolve(authoring);
  const minimizeFn =
    typeof blue.minimizeResolved === 'function'
      ? () => blue.minimizeResolved(resolved)
      : () => resolved.getMinimalNode();

  const blueIdDurations = measure(
    () => BlueIdCalculator.calculateBlueIdSync(authoring),
    config.warmupIterations,
    config.measuredIterations,
  );
  const resolveDurations = measure(
    () => blue.resolve(authoring),
    config.warmupIterations,
    config.measuredIterations,
  );
  const minimizeDurations = measure(
    () => minimizeFn(),
    config.warmupIterations,
    config.measuredIterations,
  );

  const minimized = minimizeFn();
  const authoringBlueId = BlueIdCalculator.calculateBlueIdSync(authoring);
  const minimizedBlueId = BlueIdCalculator.calculateBlueIdSync(minimized);

  const result = {
    commit: config.commit,
    config: {
      warmupIterations: config.warmupIterations,
      measuredIterations: config.measuredIterations,
      inheritedPropertyCount: config.inheritedPropertyCount,
      extraPropertyCount: config.extraPropertyCount,
    },
    metrics: {
      blueIdAvgMs: average(blueIdDurations),
      blueIdP95Ms: percentile(blueIdDurations, 0.95),
      resolveAvgMs: average(resolveDurations),
      resolveP95Ms: percentile(resolveDurations, 0.95),
      minimizeAvgMs: average(minimizeDurations),
      minimizeP95Ms: percentile(minimizeDurations, 0.95),
    },
    structure: {
      resolvedProps: countProperties(resolved),
      minimizedProps: countProperties(minimized),
      reducedProps: countProperties(resolved) - countProperties(minimized),
    },
    invariants: {
      hasMinimizeApi: typeof blue.minimizeResolved === 'function',
      blueIdEqual: authoringBlueId === minimizedBlueId,
    },
  };

  console.log(JSON.stringify(result));

  const outputPath = process.env.BENCH_OUTPUT_PATH;
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
