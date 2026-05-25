import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';
import { BexException } from '../BexException';
import { BexGasSchedule, BexGasScheduleValues } from '../gas/BexGasSchedule';
import { BexValues } from '../value/BexValues';
import { BexEngine } from '../api/BexEngine';
import { BexExecutionContext } from '../api/BexExecutionContext';
import { BexProgramSource } from '../api/BexProgramSource';
import { BexStepResults } from '../api/BexStepResults';

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

const fixtureRoot = path.join(__dirname, 'fixtures', 'rich-fixtures');

if (process.env.CI && process.env.BEX_FIXTURE) {
  throw new Error('BEX_FIXTURE must not be set in CI conformance runs.');
}

const tinyEventProgram = [
  'type: Blue/BEX Program',
  'do:',
  '  - $appendEvent:',
  '      eventKind: Tiny',
  '      payload: x',
].join('\n');

const fixturePaths = walk(fixtureRoot)
  .filter((file) => file.endsWith('.yaml') && !file.endsWith('manifest.yaml'))
  .sort();

describe('Java BEX rich fixtures', () => {
  for (const fixturePath of fixturePaths) {
    const fixture = readFixture(fixturePath);
    it(`${fixture.fixtureId} ${fixture.title}`, () => {
      runFixture(fixture);
    });
  }
});

function runFixture(fixture: RichFixture): void {
  const expectation = fixture.expectation;

  if (expectation.outcome === 'parse-error') {
    expect(() => compileFixture(fixture)).toThrowError(
      expectedErrorMatcher(expectation.errorContains),
    );
    return;
  }

  if (expectation.outcome === 'parse-error-or-output-conversion-error') {
    expect(() => {
      const result = executeFixture(fixture);
      assertOutputConvertible(result.value.toSimple());
    }).toThrowError(expectedErrorMatcher(expectation.errorContains));
    return;
  }

  if (expectation.outcome === 'compile-error') {
    expect(() => compileFixture(fixture)).toThrowError(
      expectedErrorMatcher(expectation.errorContains),
    );
    return;
  }

  if (expectation.outcome === 'runtime-error') {
    expect(() => executeFixture(fixture)).toThrowError(
      expectedErrorMatcher(expectation.errorContains),
    );
    return;
  }

  if (expectation.outcome === 'output-conversion-error') {
    const result = executeFixture(fixture);
    expect(() => assertOutputConvertible(result.value.toSimple())).toThrowError(
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
    expect(large).toBeGreaterThan(tiny);
    return;
  }

  expect(expectation.outcome).toBe('success');
  const result = executeFixture(fixture);
  if ('resultSimple' in expectation) {
    expect(result.value.toSimple()).toEqual(
      normalize(expectation.resultSimple),
    );
  }
  if ('changeset' in expectation) {
    expect(result.changeset.toSimple()).toEqual(
      normalize(expectation.changeset),
    );
  }
  if ('events' in expectation) {
    expect(result.events.toSimple()).toEqual(normalize(expectation.events));
  }
  if ('gasUsed' in expectation) {
    expect(result.gasUsed).toBe(expectation.gasUsed);
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

function readFixture(file: string): RichFixture {
  return yaml.load(fs.readFileSync(file, 'utf8')) as RichFixture;
}

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
