import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import yaml from 'js-yaml';

export const BLUE_LANGUAGE_1_0_FIXTURE_PACKAGE_IDENTITY =
  'sha256:3387cb4b6626fc56cec91d584b2df7f37c229e396dee990750ac50e762a1bc1d';

export const BLUE_LANGUAGE_1_0_FIXTURE_COUNT = 77;

export interface BlueLanguageConformanceFailure {
  readonly fixtureId: string;
  readonly category: string;
  readonly operation: string;
  readonly message: string;
  readonly cause?: string;
  readonly classification?: string;
}

export class BlueLanguageConformanceReport {
  constructor(
    readonly specVersion: string,
    readonly fixturePackageIdentity: string,
    private readonly passedIds: readonly string[],
    private readonly failed: readonly BlueLanguageConformanceFailure[],
    private readonly identityMatches: boolean,
    private readonly requiredCoverage: boolean,
    private readonly exactFixtureSet: boolean,
  ) {}

  fixturePackageIdentityMatchesFixtureFiles(): boolean {
    return this.identityMatches;
  }

  hasRequiredFixtureCoverage(): boolean {
    return this.requiredCoverage;
  }

  hasExactRequiredFixtureSet(): boolean {
    return this.exactFixtureSet;
  }

  passedFixtureIds(): string[] {
    return [...this.passedIds];
  }

  failedFixtureIds(): string[] {
    return this.failed.map((failure) => failure.fixtureId);
  }

  failures(): BlueLanguageConformanceFailure[] {
    return [...this.failed];
  }
}

export interface BlueLanguageFixtureEntry {
  readonly id: string;
  readonly category: string;
  readonly path: string;
  readonly operation?: string;
}

type FixtureRecord = Record<string, unknown>;

const FIXTURE_ROOT = path.resolve(
  process.cwd(),
  'libs/language/src/lib/conformance/fixtures/blue-language-1.0/fixtures',
);
const MANIFEST_PATH = path.join(FIXTURE_ROOT, 'manifest.yaml');

export function fixturePackageIdentityMatchesFixtureFiles(): boolean {
  return (
    computeFixturePackageIdentity() ===
    BLUE_LANGUAGE_1_0_FIXTURE_PACKAGE_IDENTITY
  );
}

export function hasRequiredFixtureCoverage(): boolean {
  return (
    loadLanguageConformanceFixtureEntries().length ===
    BLUE_LANGUAGE_1_0_FIXTURE_COUNT
  );
}

export function hasExactRequiredFixtureSet(): boolean {
  const manifestPaths = new Set(
    loadLanguageConformanceFixtureEntries().map((entry) => entry.path),
  );
  const actualPaths = yamlFiles(FIXTURE_ROOT).filter(
    (file) => file !== 'manifest.yaml',
  );
  return (
    actualPaths.length === manifestPaths.size &&
    actualPaths.every((file) => manifestPaths.has(file))
  );
}

export function loadLanguageConformanceFixtureEntries(): BlueLanguageFixtureEntry[] {
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
  const entries = loadLanguageConformanceFixtureEntries();
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
