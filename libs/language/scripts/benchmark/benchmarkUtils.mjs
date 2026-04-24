import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';

export const readPositiveInt = (name, fallback) => {
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

export const readBooleanFlag = (name, fallback = false) => {
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

export const readEnum = (name, allowedValues, fallback) => {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (!allowedValues.includes(normalized)) {
    throw new Error(
      `Expected ${name} to be one of: ${allowedValues.join(', ')}, got: ${raw}`,
    );
  }
  return normalized;
};

export const createBaselineOptions = (defaultFilePath) => ({
  filePath: process.env.BENCH_BASELINE_FILE ?? defaultFilePath,
  save: readBooleanFlag('BENCH_SAVE_BASELINE'),
  compare: readBooleanFlag('BENCH_COMPARE_BASELINE'),
});

export const calculateStats = (values) => {
  if (values.length === 0) {
    throw new Error('Cannot calculate benchmark stats for an empty sample');
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: total / values.length,
  };
};

export const calculatePercentDelta = (current, baseline) => {
  if (baseline === 0) {
    return 'n/a';
  }

  const percent = ((current - baseline) / baseline) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

export const formatStats = (stats) =>
  `avg=${stats.avg.toFixed(2)} min=${stats.min.toFixed(2)} max=${stats.max.toFixed(2)}`;

const hasSameConfig = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

const valueAtPath = (object, path) =>
  path.split('.').reduce((current, segment) => current?.[segment], object);

export const compareWithBaseline = async (
  result,
  baselineOptions,
  metricComparisons,
) => {
  try {
    const raw = await readFile(baselineOptions.filePath, 'utf8');
    const baseline = JSON.parse(raw);

    for (const comparison of metricComparisons) {
      const baselineValue = valueAtPath(baseline, comparison.path);
      const currentValue = valueAtPath(result, comparison.path);
      if (!Number.isFinite(baselineValue) || !Number.isFinite(currentValue)) {
        throw new Error(
          `Baseline file has unsupported format for ${comparison.path}: ${baselineOptions.filePath}`,
        );
      }
    }

    console.log('\nBaseline comparison');
    if (!hasSameConfig(result.config, baseline.config)) {
      console.log(
        '- warning: baseline config differs from current run; treat comparison as approximate',
      );
    }

    for (const comparison of metricComparisons) {
      const baselineValue = valueAtPath(baseline, comparison.path);
      const currentValue = valueAtPath(result, comparison.path);
      const delta = currentValue - baselineValue;
      const suffix = comparison.unit ? ` ${comparison.unit}` : '';
      console.log(
        `- ${comparison.label} delta: ${delta >= 0 ? '+' : ''}${delta.toFixed(
          2,
        )}${suffix} (${calculatePercentDelta(currentValue, baselineValue)})`,
      );
    }
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

export const saveBaseline = async (result, baselineOptions) => {
  await mkdir(dirname(baselineOptions.filePath), { recursive: true });
  await writeFile(
    baselineOptions.filePath,
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  console.log(`Baseline saved to ${baselineOptions.filePath}`);
};

export const handleBaseline = async (
  result,
  baselineOptions,
  metricComparisons,
) => {
  if (baselineOptions.compare) {
    await compareWithBaseline(result, baselineOptions, metricComparisons);
  }

  if (baselineOptions.save) {
    await saveBaseline(result, baselineOptions);
  }
};

export const installCloneCounter = (BlueNode) => {
  const originalClone = BlueNode.prototype.clone;
  const originalCloneShallow = BlueNode.prototype.cloneShallow;
  if (typeof originalCloneShallow !== 'function') {
    throw new Error(
      'BlueNode.prototype.cloneShallow is not available. Build libs/language first.',
    );
  }

  let cloneCount = 0;
  let cloneShallowCount = 0;

  BlueNode.prototype.clone = function cloneWithCounter() {
    cloneCount += 1;
    return originalClone.call(this);
  };
  BlueNode.prototype.cloneShallow = function cloneShallowWithCounter() {
    cloneShallowCount += 1;
    return originalCloneShallow.call(this);
  };

  return {
    reset() {
      cloneCount = 0;
      cloneShallowCount = 0;
    },
    deepValue() {
      return cloneCount;
    },
    shallowValue() {
      return cloneShallowCount;
    },
    totalValue() {
      return cloneCount + cloneShallowCount;
    },
    restore() {
      BlueNode.prototype.clone = originalClone;
      BlueNode.prototype.cloneShallow = originalCloneShallow;
    },
  };
};
