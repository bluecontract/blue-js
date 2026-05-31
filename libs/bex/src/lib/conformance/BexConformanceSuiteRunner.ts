import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

import yaml from 'js-yaml';
import { BlueNode } from '@blue-labs/language';

import { BexException } from '../BexException';
import { BexEngine } from '../api/BexEngine';
import { BexExecutionContext } from '../api/BexExecutionContext';
import { BexProgramSource } from '../api/BexProgramSource';
import { BexStepResults } from '../api/BexStepResults';
import { BexGasSchedule, BexGasScheduleValues } from '../gas/BexGasSchedule';
import { BexValues } from '../value/BexValues';

export const BEX_1_0_FIXTURE_PACKAGE_IDENTITY =
  'sha256:c0e9323a02d5d7102e727e8bc82f2c1f6e9f40132ba5380ef93240068e9d1946';

export const BEX_1_0_FIXTURE_COUNT = 159;

export interface BexConformanceFailure {
  readonly fixtureId: string;
  readonly category: string;
  readonly operation: string;
  readonly message: string;
  readonly cause?: string;
  readonly classification?: string;
}

export class BexConformanceReport {
  constructor(
    readonly specVersion: string,
    readonly fixturePackageIdentity: string,
    private readonly passedIds: readonly string[],
    private readonly failed: readonly BexConformanceFailure[],
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

  failures(): BexConformanceFailure[] {
    return [...this.failed];
  }
}

export interface BexFixtureEntry {
  readonly id: string;
  readonly path: string;
}

export interface BexConformanceOptions {
  readonly mutateFixture?: (
    entry: BexFixtureEntry,
    fixture: RichFixture,
  ) => RichFixture;
}

interface RichFixture {
  fixtureId: string;
  title: string;
  context?: Record<string, unknown>;
  blueDefinitions?: Record<string, string>;
  gasSchedule?: Partial<BexGasScheduleValues>;
  programSource: string;
  expectation: {
    outcome: string;
    resultSimple?: unknown;
    changeset?: unknown;
    events?: unknown;
    gasUsed?: number;
    errorContains?: string;
    property?: string;
  };
}

type FixtureRecord = Record<string, unknown>;

const fixtureRoot = path.resolve(
  process.cwd(),
  'libs/bex/src/lib/conformance/fixtures/rich-fixtures',
);
const manifestPath = path.join(fixtureRoot, 'manifest.yaml');

const tinyEventProgram = [
  'type: Blue/BEX Program',
  'do:',
  '  - $appendEvent:',
  '      eventKind: Tiny',
  '      payload: x',
].join('\n');

export async function runBexConformanceSuite(
  options: BexConformanceOptions = {},
): Promise<BexConformanceReport> {
  const entries = loadBexConformanceFixtureEntries();
  const identityMatches = fixturePackageIdentityMatchesFixtureFiles();
  const requiredCoverage = hasRequiredFixtureCoverage();
  const exactFixtureSet = hasExactRequiredFixtureSet();
  const failures: BexConformanceFailure[] = [];
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
      const fixture = readFixture(path.join(fixtureRoot, entry.path));
      runBexFixture(options.mutateFixture?.(entry, fixture) ?? fixture);
      passed.push(entry.id);
    } catch (error) {
      failures.push(
        failure(
          entry.id,
          categoryForPath(entry.path),
          'execute',
          formatError(error),
          error,
        ),
      );
    }
  }

  return new BexConformanceReport(
    '1.0-draft',
    BEX_1_0_FIXTURE_PACKAGE_IDENTITY,
    passed,
    failures,
    identityMatches,
    requiredCoverage,
    exactFixtureSet,
  );
}

export function loadBexConformanceFixtureEntries(): BexFixtureEntry[] {
  const manifest = readManifest();
  if (!Array.isArray(manifest.fixtures)) {
    throw new Error('BEX fixture manifest field "fixtures" must be a list.');
  }
  return manifest.fixtures.map((entry) => {
    if (!isObject(entry)) {
      throw new Error('BEX fixture manifest entries must be objects.');
    }
    return {
      id: textField(entry, 'id'),
      path: textField(entry, 'path'),
    };
  });
}

export function fixturePackageIdentityMatchesFixtureFiles(): boolean {
  return computeFixturePackageIdentity() === BEX_1_0_FIXTURE_PACKAGE_IDENTITY;
}

export function hasRequiredFixtureCoverage(): boolean {
  return loadBexConformanceFixtureEntries().length === BEX_1_0_FIXTURE_COUNT;
}

export function hasExactRequiredFixtureSet(): boolean {
  const manifestPaths = new Set(
    loadBexConformanceFixtureEntries().map((entry) => entry.path),
  );
  const actualPaths = walk(fixtureRoot)
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => path.relative(fixtureRoot, file).split(path.sep).join('/'))
    .filter((file) => file !== 'manifest.yaml')
    .sort();
  return (
    actualPaths.length === manifestPaths.size &&
    actualPaths.every((file) => manifestPaths.has(file))
  );
}

export function runBexFixture(fixture: RichFixture): void {
  const expectation = fixture.expectation;

  if (expectation.outcome === 'parse-error') {
    assert.throws(
      () => compileFixture(fixture),
      expectedErrorMatcher(expectation.errorContains),
    );
    return;
  }

  if (expectation.outcome === 'parse-error-or-output-conversion-error') {
    assert.throws(() => {
      const result = executeFixture(fixture);
      assertOutputConvertible(result.value.toSimple());
    }, expectedErrorMatcher(expectation.errorContains));
    return;
  }

  if (expectation.outcome === 'compile-error') {
    assert.throws(
      () => compileFixture(fixture),
      expectedErrorMatcher(expectation.errorContains),
    );
    return;
  }

  if (expectation.outcome === 'runtime-error') {
    assert.throws(
      () => executeFixture(fixture),
      expectedErrorMatcher(expectation.errorContains),
    );
    return;
  }

  if (expectation.outcome === 'output-conversion-error') {
    const result = executeFixture(fixture);
    assert.throws(
      () => assertOutputConvertible(result.value.toSimple()),
      expectedErrorMatcher(expectation.errorContains),
    );
    return;
  }

  if (expectation.outcome === 'gas-property') {
    const engine = engineForFixture(fixture);
    const context = contextForFixture(fixture);
    const large = engine.execute(compileFixture(fixture), context).gasUsed;
    const tinySource = BexProgramSource.inline(parseYamlNode(tinyEventProgram));
    const tiny = engine.compileAndExecute(tinySource, context).gasUsed;
    assert.ok(large > tiny);
    return;
  }

  assert.equal(expectation.outcome, 'success');
  const result = executeFixture(fixture);
  if ('resultSimple' in expectation) {
    assert.deepEqual(
      result.value.toSimple(),
      normalize(expectation.resultSimple),
    );
  }
  if ('changeset' in expectation) {
    assert.deepEqual(
      result.changeset.toSimple(),
      normalize(expectation.changeset),
    );
  }
  if ('events' in expectation) {
    assert.deepEqual(result.events.toSimple(), normalize(expectation.events));
  }
  if ('gasUsed' in expectation) {
    assert.equal(result.gasUsed, expectation.gasUsed);
  }
}

function compileFixture(fixture: RichFixture) {
  const source = BexProgramSource.inline(parseYamlNode(fixture.programSource));
  return engineForFixture(fixture).compile(source);
}

function executeFixture(fixture: RichFixture) {
  const source = BexProgramSource.inline(parseYamlNode(fixture.programSource));
  const engine = engineForFixture(fixture);
  return engine.execute(engine.compile(source), contextForFixture(fixture));
}

function engineForFixture(fixture: RichFixture): BexEngine {
  return BexEngine.builder()
    .gasSchedule(BexGasSchedule.defaults().with(fixture.gasSchedule ?? {}))
    .build();
}

function contextForFixture(fixture: RichFixture): BexExecutionContext {
  const context = fixture.context ?? {};
  const root = parseNodeSource(context.rootDocumentSource);
  const event = parseNodeSource(context.eventSource);
  const currentContract = parseNodeSource(context.currentContractSource);
  const steps = BexStepResults.fromSimple(
    normalize(context.stepsBinding ?? {}) as Record<string, unknown>,
  );
  const builder = BexExecutionContext.builder()
    .document(root, String(context.documentScope ?? '/'), root)
    .event(BexValues.nodeSnapshot(event))
    .currentContract(BexValues.nodeSnapshot(currentContract))
    .steps(steps)
    .gasLimit(Number(context.gasLimit ?? 1_000_000));
  const bindings = normalize(context.bindings ?? {});
  if (isObject(bindings)) {
    for (const [key, value] of Object.entries(bindings)) {
      builder.binding(key, BexValues.fromSimple(value));
    }
  }
  return builder.build();
}

function parseNodeSource(source: unknown) {
  if (typeof source !== 'string' || source.trim().length === 0) {
    return simpleToNode({});
  }
  return parseYamlNode(source);
}

function parseYamlNode(source: string): BlueNode {
  return simpleToNode(yaml.load(source));
}

function simpleToNode(value: unknown): BlueNode {
  const node = new BlueNode();
  if (value === undefined) {
    return node;
  }
  if (value === null) {
    return node.setValue(null);
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return node.setValue(value);
  }
  if (Array.isArray(value)) {
    return node.setItems(value.map(simpleToNode));
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      node.addProperty(key, simpleToNode(child));
    }
    return node;
  }
  return node.setValue(String(value));
}

function readManifest(): FixtureRecord {
  return yaml.load(fs.readFileSync(manifestPath, 'utf8')) as FixtureRecord;
}

function readFixture(file: string): RichFixture {
  return yaml.load(fs.readFileSync(file, 'utf8')) as RichFixture;
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

function computeFixturePackageIdentity(): string {
  const entries = loadBexConformanceFixtureEntries();
  const digest = createHash('sha256');
  digest.update(
    normalizeManifestForIdentity(fs.readFileSync(manifestPath, 'utf8')),
    'utf8',
  );
  for (const entry of [...entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    digest.update(`${entry.path}\n`, 'utf8');
    digest.update(
      normalizeLineEndings(
        fs.readFileSync(path.join(fixtureRoot, entry.path), 'utf8'),
      ),
      'utf8',
    );
    digest.update('\n', 'utf8');
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

function expectedErrorMatcher(expected: string | undefined): RegExp {
  return expected === undefined || expected.length === 0
    ? /./
    : new RegExp(escapeRegExp(expected));
}

function assertOutputConvertible(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertOutputConvertible);
    return;
  }
  if (!isObject(value)) {
    return;
  }
  if ('blueId' in value && Object.keys(value).length > 1) {
    throw new BexException(
      'blueId reference objects cannot contain sibling fields.',
      'output-conversion-error',
    );
  }
  for (const child of Object.values(value)) {
    assertOutputConvertible(child);
  }
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}

function failure(
  fixtureId: string,
  category: string,
  operation: string,
  message: string,
  cause?: unknown,
): BexConformanceFailure {
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

function categoryForPath(fixturePath: string): string {
  return fixturePath.split('/')[0] ?? 'Fixture';
}

function textField(record: FixtureRecord, field: string): string {
  const value = record[field];
  if (value == null) {
    throw new Error(`Fixture field "${field}" is required.`);
  }
  return String(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
