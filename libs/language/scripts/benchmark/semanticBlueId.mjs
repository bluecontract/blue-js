import { performance } from 'perf_hooks';
import { Blue, BasicNodeProvider } from '../../dist/index.mjs';
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
  propertyCount: readPositiveInt('BENCH_SEMANTIC_PROPERTIES', 120),
};

const baselineOptions = createBaselineOptions(
  'scripts/benchmark/data/semantic-blue-id-baseline.json',
);

const createPropertiesYaml = (count) =>
  Array.from(
    { length: count },
    (_, index) => `field_${index}: value-${index}`,
  ).join('\n');

const createFixture = () => {
  const provider = new BasicNodeProvider();
  provider.addSingleDocs(`
name: SemanticBenchmarkBase
base_field: inherited
${createPropertiesYaml(Math.floor(config.propertyCount / 4))}
`);

  const blue = new Blue({ nodeProvider: provider });
  const baseId = provider.getBlueIdByName('SemanticBenchmarkBase');
  const authoringNoType = blue.yamlToNode(`
name: SemanticBenchmarkNoType
${createPropertiesYaml(config.propertyCount)}
`);
  const authoringSharedType = blue.yamlToNode(`
name: SemanticBenchmarkSharedType
type:
  blueId: ${baseId}
base_field: inherited
local_field: local
`);
  const resolved = blue.resolve(authoringSharedType);
  const minimal = blue.minimize(resolved);

  return {
    provider,
    blue,
    baseId,
    authoringNoType,
    authoringSharedType,
    resolved,
    minimal,
  };
};

const measureScenario = (label, createWork) => {
  const durations = [];

  for (let i = 0; i < config.warmupIterations; i += 1) {
    createWork()();
  }

  for (let i = 0; i < config.measuredIterations; i += 1) {
    const work = createWork();
    const start = performance.now();
    work();
    const durationMs = performance.now() - start;
    durations.push(durationMs);
    console.log(
      `${label} iteration ${String(i + 1).padStart(2, '0')}: ${durationMs.toFixed(
        2,
      )} ms`,
    );
  }

  return calculateStats(durations);
};

const runBenchmark = async () => {
  const fixture = createFixture();

  console.log('Public semantic BlueId benchmark configuration:');
  console.log(`- warmup iterations: ${config.warmupIterations}`);
  console.log(`- measured iterations: ${config.measuredIterations}`);
  console.log(`- properties: ${config.propertyCount}`);
  console.log(`- shared type blueId: ${fixture.baseId}`);

  const scenarios = {
    authoringNoType: measureScenario('authoring-no-type', () => () => {
      fixture.blue.calculateBlueIdSync(fixture.authoringNoType);
    }),
    authoringSharedType: measureScenario('authoring-shared-type', () => () => {
      fixture.blue.calculateBlueIdSync(fixture.authoringSharedType);
    }),
    resolved: measureScenario('resolved', () => () => {
      fixture.blue.calculateBlueIdSync(fixture.resolved);
    }),
    minimalTrusted: measureScenario('minimal-trusted', () => () => {
      fixture.blue.calculateBlueIdSync(fixture.minimal);
    }),
    providerIngest: measureScenario('provider-ingest', () => () => {
      const provider = new BasicNodeProvider();
      provider.addSingleDocs(`
name: SemanticBenchmarkBase
base_field: inherited
`);
      const blue = new Blue({ nodeProvider: provider });
      const baseId = provider.getBlueIdByName('SemanticBenchmarkBase');
      provider.addSingleNodes(
        blue.yamlToNode(`
name: SemanticBenchmarkChild
type:
  blueId: ${baseId}
base_field: inherited
local_field: local
`),
      );
    }),
  };

  console.log('\nSummary');
  for (const [label, stats] of Object.entries(scenarios)) {
    console.log(`- ${label} time (ms): ${formatStats(stats)}`);
  }

  const result = {
    createdAt: new Date().toISOString(),
    config,
    metrics: Object.fromEntries(
      Object.entries(scenarios).map(([label, stats]) => [
        label,
        { timeMs: stats },
      ]),
    ),
  };

  await handleBaseline(result, baselineOptions, [
    {
      label: 'semantic authoring no-type avg',
      path: 'metrics.authoringNoType.timeMs.avg',
      unit: 'ms',
    },
    {
      label: 'semantic authoring shared-type avg',
      path: 'metrics.authoringSharedType.timeMs.avg',
      unit: 'ms',
    },
    {
      label: 'semantic resolved avg',
      path: 'metrics.resolved.timeMs.avg',
      unit: 'ms',
    },
    {
      label: 'semantic minimal trusted avg',
      path: 'metrics.minimalTrusted.timeMs.avg',
      unit: 'ms',
    },
    {
      label: 'provider ingest avg',
      path: 'metrics.providerIngest.timeMs.avg',
      unit: 'ms',
    },
  ]);
};

runBenchmark().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
