import { Blue, BlueRepository } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { NativeBlueDocumentProcessor } from '../NativeBlueDocumentProcessor';
import { defaultProcessors } from '../config';
import { DocumentNode, EventNodePayload, ProcessingOptions } from '../types';

function coerceArray<T>(value: unknown): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value as T[];
}

declare global {
  // eslint-disable-next-line no-var
  var __BLUE_HOST__:
    | {
        log?: (level: string, message: string) => void;
      }
    | undefined;
  // eslint-disable-next-line no-var
  var __BLUE_ENV__: Record<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __BLUE_REPOSITORIES__: BlueRepository[] | undefined;
  // Exposed to the host runtime after bundling so the bridge can pick up the entry points.
  // eslint-disable-next-line no-var
  var __BLUE_ENTRY__: Record<string, unknown> | undefined;
}

const host = globalThis.__BLUE_HOST__;

const envBag = globalThis.__BLUE_ENV__ ?? {};

envBag.SKIP_QUICKJS = 'true';
envBag.SKIP_QUICKJS_WASM = 'true';
envBag.SKIP_ISOLATED_VM = 'true';

globalThis.__BLUE_ENV__ = envBag;

const repositories = coerceArray<BlueRepository>(
  globalThis.__BLUE_REPOSITORIES__
) ?? [coreRepository, myosRepository];

const blue = new Blue({ repositories });
const processor = new NativeBlueDocumentProcessor(blue, defaultProcessors);

function serializeState(state: DocumentNode) {
  return blue.nodeToJson(state, 'original');
}

function serializeEmitted(emitted: EventNodePayload[] | undefined) {
  if (!emitted) return [];
  return emitted.map((evt) => blue.nodeToJson(evt, 'original'));
}

function deserializeDocument(json: unknown): DocumentNode {
  return blue.jsonValueToNode(json);
}

function deserializeEvents(json: unknown[] | undefined): EventNodePayload[] {
  if (!json) return [];
  return json.map((evt) => blue.jsonValueToNode(evt));
}

async function safeCall<T>(
  label: string,
  fn: () => Promise<T> | T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    host?.log?.(
      'error',
      `${label} failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
}

async function initialize(
  documentJson: unknown,
  options: ProcessingOptions = {}
) {
  return safeCall('initialize', async () => {
    const document = deserializeDocument(documentJson);
    const result = await processor.initialize(document, options);
    return {
      state: serializeState(result.state),
      emitted: serializeEmitted(result.emitted),
      gasUsed: result.gasUsed,
      gasRemaining: result.gasRemaining,
    };
  });
}

async function processEvents(
  documentJson: unknown,
  eventsJson: unknown[],
  options: ProcessingOptions = {}
) {
  return safeCall('processEvents', async () => {
    const document = deserializeDocument(documentJson);
    const events = deserializeEvents(eventsJson);
    const result = await processor.processEvents(document, events, options);
    return {
      state: serializeState(result.state),
      emitted: serializeEmitted(result.emitted),
      gasUsed: result.gasUsed,
      gasRemaining: result.gasRemaining,
    };
  });
}

const quickJsEntry = {
  initialize,
  processEvents,
};

globalThis.__BLUE_ENTRY__ = quickJsEntry;
