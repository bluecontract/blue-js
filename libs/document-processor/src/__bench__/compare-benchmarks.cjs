const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const options = {
  baseline: null,
  current: null,
  threshold: null,
  update: false,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--baseline') {
    options.baseline = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === '--current') {
    options.current = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === '--threshold') {
    options.threshold = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === '--update') {
    options.update = true;
  }
}

const baselinePath = path.resolve(
  process.cwd(),
  options.baseline ?? 'src/__bench__/benchmarks.baseline.json',
);
const currentPath = path.resolve(
  process.cwd(),
  options.current ?? '../../tmp/document-processor.bench.json',
);
const thresholdRaw =
  options.threshold ?? process.env.BENCHMARK_REGRESSION_THRESHOLD ?? '0.1';
const threshold = Number(thresholdRaw);
const updateBaseline =
  options.update ||
  process.env.BENCHMARK_UPDATE_BASELINE === '1' ||
  process.env.BENCHMARK_UPDATE_BASELINE === 'true';

if (!Number.isFinite(threshold) || threshold < 0) {
  throw new Error(
    `Invalid regression threshold '${thresholdRaw}'. Expected a non-negative number.`,
  );
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing benchmark file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenBenchmarks(report) {
  const flat = {};
  const files = Array.isArray(report?.files) ? report.files : [];
  for (const file of files) {
    const groups = Array.isArray(file?.groups) ? file.groups : [];
    for (const group of groups) {
      const benchmarks = Array.isArray(group?.benchmarks)
        ? group.benchmarks
        : [];
      for (const benchmark of benchmarks) {
        if (benchmark?.id) {
          flat[benchmark.id] = benchmark;
        }
      }
    }
  }
  return flat;
}

function sanitizeReportPaths(report) {
  if (!Array.isArray(report?.files)) {
    return report;
  }
  return {
    ...report,
    files: report.files.map((file) => ({
      ...file,
      filepath: file?.filepath
        ? path.relative(process.cwd(), file.filepath)
        : file.filepath,
    })),
  };
}

if (updateBaseline) {
  const currentReport = readJson(currentPath);
  const sanitizedReport = sanitizeReportPaths(currentReport);
  fs.writeFileSync(baselinePath, JSON.stringify(sanitizedReport, null, 2));
  console.log(`Updated benchmark baseline at ${baselinePath}`);
  process.exit(0);
}

const baselineReport = readJson(baselinePath);
const currentReport = readJson(currentPath);
const baselineBenchmarks = flattenBenchmarks(baselineReport);
const currentBenchmarks = flattenBenchmarks(currentReport);

const missingBaseline = [];
const regressions = [];

for (const [id, current] of Object.entries(currentBenchmarks)) {
  const baseline = baselineBenchmarks[id];
  if (!baseline) {
    missingBaseline.push(current.name || id);
    continue;
  }

  const baseMean = Number(baseline.mean);
  const currentMean = Number(current.mean);
  if (!Number.isFinite(baseMean) || !Number.isFinite(currentMean)) {
    continue;
  }
  if (baseMean <= 0) {
    continue;
  }

  const delta = (currentMean - baseMean) / baseMean;
  if (delta > threshold) {
    regressions.push({
      name: current.name || id,
      baseline: baseMean,
      current: currentMean,
      delta,
    });
  }
}

if (missingBaseline.length > 0) {
  console.error('Benchmark baseline is missing entries for:');
  for (const name of missingBaseline) {
    console.error(`- ${name}`);
  }
  console.error('Update the baseline before comparing results.');
  process.exit(1);
}

if (regressions.length > 0) {
  console.error(
    `Benchmark regressions exceeded ${(threshold * 100).toFixed(1)}%:`,
  );
  for (const regression of regressions) {
    console.error(
      `- ${regression.name}: ${regression.current.toFixed(4)}ms (baseline ${regression.baseline.toFixed(4)}ms, ${(regression.delta * 100).toFixed(1)}% slower)`,
    );
  }
  process.exit(1);
}

console.log('Benchmark results are within the regression threshold.');
