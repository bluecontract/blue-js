import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

import {
  BLUE_CONTRACTS_1_0_FIXTURE_COUNT,
  BLUE_CONTRACTS_1_0_FIXTURE_PACKAGE_IDENTITY,
  BlueContractsConformanceReport,
  type BlueContractsConformanceFailure,
} from './BlueContractsConformanceReport.js';
import {
  runContractsFixtureEntry,
  type ContractsFixtureSpec,
  type ContractsManifestEntry,
} from './BlueContractsConformanceFixtureRunner.js';

export interface BlueContractsFixtureEntry {
  readonly id: string;
  readonly category: string;
  readonly path: string;
  readonly operation?: string;
}

export interface ConformanceOptions {
  readonly mutateFixture?: (
    entry: BlueContractsFixtureEntry,
    spec: FixtureRecord,
  ) => FixtureRecord;
}

type FixtureRecord = Record<string, unknown>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PACKAGE_ROOT = resolveExistingDirectory([
  path.join(__dirname, 'fixtures/blue-contracts-1.0'),
  path.join(__dirname, 'conformance/fixtures/blue-contracts-1.0'),
  path.resolve(
    process.cwd(),
    'libs/document-processor/src/conformance/fixtures/blue-contracts-1.0',
  ),
]);
const FIXTURE_ROOT = path.join(FIXTURE_PACKAGE_ROOT, 'fixtures');
const MANIFEST_PATH = path.join(FIXTURE_ROOT, 'manifest.yaml');

export async function runContractsConformanceSuite(
  options: ConformanceOptions = {},
): Promise<BlueContractsConformanceReport> {
  const entries = loadContractsConformanceFixtureEntries();
  const identityMatches = fixturePackageIdentityMatchesFixtureFiles();
  const requiredCoverage = hasRequiredFixtureCoverage();
  const exactFixtureSet = hasExactRequiredFixtureSet();
  const failures: BlueContractsConformanceFailure[] = [];
  const passed: string[] = [];

  if (!identityMatches) {
    failures.push(
      failure('manifest', 'Manifest', 'identity', 'identity mismatch'),
    );
  }
  if (!requiredCoverage) {
    failures.push(
      failure(
        'manifest',
        'Manifest',
        'coverage',
        'fixture coverage is incomplete',
      ),
    );
  }
  if (!exactFixtureSet) {
    failures.push(
      failure(
        'manifest',
        'Manifest',
        'fixture-set',
        'fixture set is not exact',
      ),
    );
  }

  for (const entry of entries) {
    try {
      await runContractsFixtureEntry(
        entry as ContractsManifestEntry,
        options.mutateFixture == null
          ? undefined
          : (fixtureEntry, spec) =>
              options.mutateFixture?.(
                fixtureEntry,
                spec as FixtureRecord,
              ) as ContractsFixtureSpec,
      );
      passed.push(entry.id);
    } catch (error) {
      failures.push(
        failure(
          entry.id,
          entry.category,
          entry.operation ?? 'unknown',
          formatError(error),
          error,
        ),
      );
    }
  }

  return new BlueContractsConformanceReport(
    '1.0',
    BLUE_CONTRACTS_1_0_FIXTURE_PACKAGE_IDENTITY,
    passed,
    failures,
    identityMatches,
    requiredCoverage,
    exactFixtureSet,
  );
}

export function fixturePackageIdentityMatchesFixtureFiles(): boolean {
  return (
    computeFixturePackageIdentity() ===
    BLUE_CONTRACTS_1_0_FIXTURE_PACKAGE_IDENTITY
  );
}

export function hasRequiredFixtureCoverage(): boolean {
  return (
    loadContractsConformanceFixtureEntries().length ===
    BLUE_CONTRACTS_1_0_FIXTURE_COUNT
  );
}

export function hasExactRequiredFixtureSet(): boolean {
  const manifest = readManifest();
  if (!Array.isArray(manifest.fixtures)) {
    return false;
  }
  const manifestPaths = new Set(
    loadContractsConformanceFixtureEntries().map((entry) => entry.path),
  );
  const actualPaths = yamlFiles(FIXTURE_ROOT).filter(
    (file) => file !== 'manifest.yaml',
  );
  return (
    actualPaths.length === manifestPaths.size &&
    actualPaths.every((file) => manifestPaths.has(file))
  );
}

export function loadContractsConformanceFixtureEntries(): BlueContractsFixtureEntry[] {
  const manifest = readManifest();
  if (!Array.isArray(manifest.fixtures)) {
    throw new Error('Fixture manifest field "fixtures" must be a list.');
  }
  return manifest.fixtures.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error('Fixture manifest entries must be objects.');
    }
    const fixture = readFixture(textField(entry, 'path'));
    return {
      id: textField(entry, 'id'),
      category: textField(entry, 'category'),
      path: textField(entry, 'path'),
      operation: isRecord(fixture)
        ? optionalText(fixture, 'operation')
        : undefined,
    };
  });
}

export function readContractsConformanceFixture(
  fixturePath: string,
): FixtureRecord {
  const fixture = yaml.load(
    fs.readFileSync(path.join(FIXTURE_ROOT, fixturePath), 'utf8'),
  );
  if (!isRecord(fixture)) {
    throw new Error(`Fixture ${fixturePath} must be an object.`);
  }
  return fixture;
}

function readManifest(): FixtureRecord {
  return readFixture('manifest.yaml');
}

function readFixture(fixturePath: string): FixtureRecord {
  const value = yaml.load(
    fs.readFileSync(path.join(FIXTURE_ROOT, fixturePath), 'utf8'),
  );
  if (!isRecord(value)) {
    throw new Error(`Fixture ${fixturePath} must be an object.`);
  }
  return value;
}

function computeFixturePackageIdentity(): string {
  const entries = loadContractsConformanceFixtureEntries();
  const digest = createHash('sha256');
  digest.update('manifest.yaml\n', 'utf8');
  digest.update(
    normalizeManifestForIdentity(fs.readFileSync(MANIFEST_PATH, 'utf8')),
    'utf8',
  );
  for (const entry of entries) {
    digest.update(`\n--- ${entry.path}\n`, 'utf8');
    digest.update(
      normalizeLineEndings(
        fs.readFileSync(path.join(FIXTURE_ROOT, entry.path), 'utf8'),
      ),
      'utf8',
    );
  }
  return `sha256:${digest.digest('hex')}`;
}

function normalizeManifestForIdentity(source: string): string {
  const normalized = normalizeLineEndings(source);
  if (!/^fixturePackageIdentity:.*$/m.test(normalized)) {
    throw new Error('Manifest is missing fixturePackageIdentity line.');
  }
  return normalized.replace(
    /^fixturePackageIdentity:.*$/m,
    'fixturePackageIdentity: ""',
  );
}

function normalizeLineEndings(source: string): string {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function yamlFiles(directory: string): string[] {
  return walk(directory)
    .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
    .map((file) => path.relative(directory, file).split(path.sep).join('/'))
    .sort();
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

function failure(
  fixtureId: string,
  category: string,
  operation: string,
  message: string,
  cause?: unknown,
): BlueContractsConformanceFailure {
  return {
    fixtureId,
    category,
    operation,
    message,
    cause: cause instanceof Error ? cause.message : undefined,
    classification: cause instanceof Error ? cause.name : undefined,
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function textField(record: FixtureRecord, field: string): string {
  const value = record[field];
  if (value == null) {
    throw new Error(`Fixture field "${field}" is required.`);
  }
  return String(value);
}

function optionalText(
  record: FixtureRecord,
  field: string,
): string | undefined {
  const value = record[field];
  return value == null ? undefined : String(value);
}

function isRecord(value: unknown): value is FixtureRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveExistingDirectory(candidates: readonly string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  throw new Error(
    `Blue Contracts conformance fixtures are missing. Checked: ${candidates.join(
      ', ',
    )}`,
  );
}
