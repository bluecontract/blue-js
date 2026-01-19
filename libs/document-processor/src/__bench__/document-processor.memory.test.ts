import { describe, expect, it } from 'vitest';
import { Blue, type BlueNode } from '@blue-labs/language';
import { repository as blueRepository } from '@blue-repository/types';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { writeHeapSnapshot } from 'node:v8';

import { DocumentProcessor } from '../api/document-processor.js';
import { createBlue } from '../test-support/blue.js';
import { counterFixture } from './fixtures/counter.js';
import { quizFixture } from './fixtures/quiz.js';
import type { BenchFixture } from './fixtures/types.js';

const shouldRun = process.env.MEMCHECK === '1';
const memoryDescribe = shouldRun ? describe : describe.skip;

const DEFAULT_WARMUP = 3;
const DEFAULT_ITERATIONS = 100;
const DEFAULT_MAX_DELTA_RATIO = 0.1;
const DEFAULT_MAX_DELTA_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function readNumber(value: string | undefined, fallback: number): number {
  if (value == null) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

const warmupIterations = Math.max(
  0,
  Math.floor(readNumber(process.env.MEMCHECK_WARMUP, DEFAULT_WARMUP)),
);
const iterations = Math.max(
  1,
  Math.floor(readNumber(process.env.MEMCHECK_ITERATIONS, DEFAULT_ITERATIONS)),
);
const maxDeltaRatio = Math.max(
  0,
  readNumber(process.env.MEMCHECK_MAX_DELTA_RATIO, DEFAULT_MAX_DELTA_RATIO),
);
const maxDeltaBytes = Math.max(
  0,
  readNumber(process.env.MEMCHECK_MAX_DELTA_BYTES, DEFAULT_MAX_DELTA_BYTES),
);
const timeoutMs = Math.max(
  1000,
  Math.floor(readNumber(process.env.MEMCHECK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)),
);
const maxRssDeltaBytes = readNumber(
  process.env.MEMCHECK_RSS_MAX_DELTA_BYTES,
  -1,
);
const maxWasmDeltaBytes = readNumber(
  process.env.MEMCHECK_WASM_MAX_DELTA_BYTES,
  -1,
);
const snapshotsEnabled =
  process.env.MEMCHECK_SNAPSHOTS === '1' ||
  process.env.MEMCHECK_SNAPSHOTS === 'true';
const snapshotsDir =
  process.env.MEMCHECK_SNAPSHOTS_DIR ??
  resolve(process.cwd(), '../../tmp/document-processor-memcheck');
const backendMode = readBoolean(process.env.MEMCHECK_BACKEND_MODE);
const useRepositoryBlue = readBoolean(
  process.env.MEMCHECK_USE_REPOSITORY_BLUE,
  backendMode,
);
const newProcessorPerIteration = readBoolean(
  process.env.MEMCHECK_NEW_PROCESSOR,
  backendMode,
);
const newBluePerIteration = readBoolean(
  process.env.MEMCHECK_NEW_BLUE,
  backendMode,
);
const resolveDocument = readBoolean(process.env.MEMCHECK_RESOLVE_DOCUMENT);
const resolveEvent = readBoolean(
  process.env.MEMCHECK_RESOLVE_EVENT,
  backendMode,
);
const concurrency = Math.max(
  1,
  Math.floor(readNumber(process.env.MEMCHECK_CONCURRENCY, 1)),
);
const fixtureSelection =
  process.env.MEMCHECK_FIXTURES ?? process.env.MEMCHECK_FIXTURE ?? 'quiz';

type FixtureSource = BenchFixture;

type PreparedFixture = {
  name: string;
  document: BlueNode;
  events: ReadonlyArray<BlueNode>;
};

type ProcessorContext = {
  blue: Blue;
  processor: DocumentProcessor;
  fixtures: PreparedFixture[];
};

function sanitizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const fixtureCatalog: FixtureSource[] = [counterFixture, quizFixture];
const fixtureAliases = new Map<string, FixtureSource>();

for (const fixture of fixtureCatalog) {
  fixtureAliases.set(fixture.name.toLowerCase(), fixture);
  fixtureAliases.set(sanitizeName(fixture.name), fixture);
}

fixtureAliases.set('counter', counterFixture);
fixtureAliases.set('quiz', quizFixture);

function selectFixtures(selection: string): FixtureSource[] {
  const tokens = selection
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) {
    return [quizFixture];
  }

  if (tokens.includes('all')) {
    return fixtureCatalog;
  }

  const selected: FixtureSource[] = [];
  for (const token of tokens) {
    const fixture = fixtureAliases.get(token);
    if (!fixture) {
      throw new Error(
        `Unknown memcheck fixture "${token}". ` +
          'Use "quiz", "counter", or "all".',
      );
    }
    if (!selected.includes(fixture)) {
      selected.push(fixture);
    }
  }

  return selected;
}

const selectedFixtures = selectFixtures(fixtureSelection);

function createBlueInstance(): Blue {
  if (useRepositoryBlue) {
    return new Blue({
      repositories: [blueRepository],
    });
  }
  return createBlue();
}

function prepareFixtures(
  blue: Blue,
  fixtures: ReadonlyArray<FixtureSource>,
): PreparedFixture[] {
  return fixtures.map((fixture) => ({
    name: fixture.name,
    document: blue.jsonValueToNode(fixture.document),
    events: fixture.events.map((event) => blue.jsonValueToNode(event)),
  }));
}

type MemorySnapshot = {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
};

function readMemorySnapshot(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers ?? 0,
  };
}

function logSnapshot(label: string, snapshot: MemorySnapshot): void {
  console.log(`${label} rss`, snapshot.rss);
  console.log(`${label} heapTotal`, snapshot.heapTotal);
  console.log(`${label} heapUsed`, snapshot.heapUsed);
  console.log(`${label} external`, snapshot.external);
  console.log(`${label} arrayBuffers`, snapshot.arrayBuffers);
}

memoryDescribe('DocumentProcessor memory check', () => {
  it(
    'does not grow heap beyond the configured threshold',
    async () => {
      const gc = (global as typeof globalThis & { gc?: () => void }).gc;
      if (typeof gc !== 'function') {
        throw new Error(
          'Memory check requires --expose-gc (use NODE_OPTIONS=--expose-gc).',
        );
      }

      const fixtureLabel =
        selectedFixtures.length === 1
          ? sanitizeName(selectedFixtures[0].name)
          : 'multi-fixtures';
      const snapshotRunId = `${Date.now()}-${process.pid}`;
      const effectiveNewProcessor =
        newProcessorPerIteration || newBluePerIteration;

      console.log('memcheck config', {
        fixtures: selectedFixtures.map((fixture) => fixture.name),
        warmupIterations,
        iterations,
        concurrency,
        backendMode,
        useRepositoryBlue,
        newProcessorPerIteration: effectiveNewProcessor,
        newBluePerIteration,
        resolveDocument,
        resolveEvent,
      });

      const captureSnapshot = (label: string): void => {
        if (!snapshotsEnabled) {
          return;
        }
        mkdirSync(snapshotsDir, { recursive: true });
        const fileName = `memcheck-${fixtureLabel}-${label}-${snapshotRunId}.heapsnapshot`;
        const filePath = join(snapshotsDir, fileName);
        const written = writeHeapSnapshot(filePath);
        console.log(`Heap snapshot (${label}) written to ${written}`);
      };

      const runFixture = async (
        context: ProcessorContext,
        fixture: PreparedFixture,
      ): Promise<void> => {
        const baseDocument = resolveDocument
          ? context.blue.resolve(fixture.document.clone())
          : fixture.document.clone();
        const initResult =
          await context.processor.initializeDocument(baseDocument);
        if (initResult.capabilityFailure) {
          throw new Error(
            `Memory check fixture '${fixture.name}' failed to initialize: ${
              initResult.failureReason ?? 'capability failure'
            }`,
          );
        }

        let current = initResult.document;
        for (const event of fixture.events) {
          const eventNode = resolveEvent
            ? context.blue.resolve(event.clone())
            : event.clone();
          const result = await context.processor.processDocument(
            current,
            eventNode,
          );
          if (result.capabilityFailure) {
            throw new Error(
              `Memory check fixture '${fixture.name}' failed to process event: ${
                result.failureReason ?? 'capability failure'
              }`,
            );
          }
          current = result.document;
        }
      };

      const createContext = (blueOverride?: Blue): ProcessorContext => {
        const blue = blueOverride ?? createBlueInstance();
        const processor = new DocumentProcessor({ blue });
        return {
          blue,
          processor,
          fixtures: prepareFixtures(blue, selectedFixtures),
        };
      };

      const runContext = async (context: ProcessorContext): Promise<void> => {
        for (const fixture of context.fixtures) {
          await runFixture(context, fixture);
        }
      };

      const runIterations = async (
        count: number,
        baseBlue?: Blue,
        baseContext?: ProcessorContext,
      ): Promise<void> => {
        for (let i = 0; i < count; i += 1) {
          const context = effectiveNewProcessor
            ? createContext(newBluePerIteration ? undefined : baseBlue)
            : (baseContext ?? createContext(baseBlue));
          await runContext(context);
        }
      };

      const runAll = async (count: number): Promise<void> => {
        const perWorker = Math.floor(count / concurrency);
        const remainder = count % concurrency;
        const tasks = Array.from({ length: concurrency }, (_, index) => {
          const iterationsForWorker = perWorker + (index < remainder ? 1 : 0);
          if (iterationsForWorker === 0) {
            return Promise.resolve();
          }
          const baseBlue = newBluePerIteration
            ? undefined
            : createBlueInstance();
          const baseContext = effectiveNewProcessor
            ? undefined
            : createContext(baseBlue);
          return runIterations(iterationsForWorker, baseBlue, baseContext);
        });

        await Promise.all(tasks);
      };

      await runAll(warmupIterations);
      gc();
      const before = readMemorySnapshot();
      logSnapshot('before', before);
      captureSnapshot('before');

      await runAll(iterations);
      gc();
      const after = readMemorySnapshot();
      logSnapshot('after', after);
      captureSnapshot('after');

      const delta = after.heapUsed - before.heapUsed;
      const allowedGrowth = Math.max(
        maxDeltaBytes,
        Math.floor(before.heapUsed * maxDeltaRatio),
      );
      const rssDelta = after.rss - before.rss;
      const wasmDelta = after.arrayBuffers - before.arrayBuffers;

      console.log('heapUsed delta', delta);
      console.log('maxDeltaBytes', maxDeltaBytes);
      console.log(
        'Math.floor(before.heapUsed * maxDeltaRatio)',
        Math.floor(before.heapUsed * maxDeltaRatio),
      );
      console.log('allowedGrowth', allowedGrowth);
      console.log('rss delta', rssDelta);
      console.log('arrayBuffers delta', wasmDelta);

      if (maxRssDeltaBytes >= 0) {
        expect(rssDelta).toBeLessThanOrEqual(maxRssDeltaBytes);
      }
      if (maxWasmDeltaBytes >= 0) {
        expect(wasmDelta).toBeLessThanOrEqual(maxWasmDeltaBytes);
      }

      expect(delta).toBeLessThanOrEqual(allowedGrowth);
    },
    timeoutMs,
  );
});
