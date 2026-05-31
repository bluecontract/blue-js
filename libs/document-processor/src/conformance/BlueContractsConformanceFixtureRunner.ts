import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Blue,
  BlueNode,
  blueNodeField,
  type JsonBlueValue,
} from '@blue-labs/language';
import yaml from 'js-yaml';
import { expect } from './conformance-expect.js';
import { z } from 'zod';

import { DocumentProcessor } from '../api/document-processor.js';
import type { ProcessorRuntimeHooks } from '../engine/processor-engine.js';
import { ContractProcessorRegistryBuilder } from '../registry/contract-processor-registry-builder.js';
import type {
  ChannelEvaluationContext,
  ChannelMatch,
  ChannelProcessor,
  ContractProcessorContext,
  HandlerExecutionMetadata,
  HandlerProcessor,
} from '../registry/types.js';
import type { JsonPatch } from '../model/shared/json-patch.js';
import { ProcessorEngine } from '../engine/processor-engine.js';
import type { DocumentProcessingRuntime } from '../runtime/document-processing-runtime.js';
import type { DocumentProcessingResult } from '../types/document-processing-result.js';
import { ProcessorErrorCategory } from '../types/document-processing-result.js';
import { ProcessorFatalError } from '../engine/processor-fatal-error.js';
import { ProcessorErrors } from '../types/errors.js';
import { createDefaultMergingProcessor } from '../merge/utils/default.js';
import { blueIds, blueRepository } from '../repository/semantic-repository.js';
import { calculateContentBlueId } from '../util/content-blue-id.js';
import { normalizePointer as normalizeRuntimePointer } from '../util/pointer-utils.js';
import { nodeAt as productionGeneralizationNodeAt } from '../engine/generalization/type-generalization-planner.js';
import {
  StaticTypeGraphProvider,
  type TypeGraphProvider,
} from '../engine/generalization/type-graph-provider.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(
  __dirname,
  'fixtures/blue-contracts-1.0/fixtures',
);
const REGISTRY_ROOT = path.join(
  __dirname,
  'fixtures/blue-contracts-1.0/registry',
);

const MOCK_EXTERNAL_CHANNEL = 'C37UoAfTNUnoxkB2CdEE7BfHJwYqTNiWzQb5xuRMkBzm';
const MOCK_HANDLER = '2TwRC3EdLXk4gqwyyVWy52h5BQ5ntrkmpcrhrTxsGAs1';
const LEGACY_MOCK_EXTERNAL_CHANNEL =
  '9XJaukZBmGUkFJ5TD3mrEnj98A6UfXXhzXGtwTJapmZi';
const LEGACY_MOCK_HANDLER = 'HvDTdkzXnW9fRL7NrifNu63TMdQbXUcyihfiPy4CARw4';

const SUPPORTED_EXPECTED_FIELDS = new Set([
  'expectedAbsentDocumentPathValues',
  'expectedAbsentDocumentPaths',
  'expectedBlueId',
  'expectedCapabilityFailure',
  'expectedCheckpointLastEvents',
  'expectedDescendantOrEqual',
  'expectedDocument',
  'expectedDocumentPathExists',
  'expectedDocumentPathValues',
  'expectedDocumentPaths',
  'expectedDocumentUpdateOrder',
  'expectedDocumentUpdates',
  'expectedErrorCategories',
  'expectedErrorCategory',
  'expectedEffectApplicationOrder',
  'expectedEmbeddedDeliveryOrder',
  'expectedExactGas',
  'expectedFailureReasonContains',
  'expectedGasByteView',
  'expectedInitializationContentBlueIdInput',
  'expectedNoDocumentMutation',
  'expectedOriginalBlueId',
  'expectedPointerReads',
  'expectedPointerWrites',
  'expectedProcessorEventTypes',
  'expectedRootEventCount',
  'expectedRootEventPathValues',
  'expectedRootEventSuffix',
  'expectedRootEventTypes',
  'expectedRootEvents',
  'expectedRuntimeBlueIds',
  'expectedRuntimeInsertionNormalizedValues',
  'expectedStatus',
  'expectedStoredObjectKeys',
  'expectedTerminationFallback',
  'expectedTotalGas',
  'expectedTotalGasMin',
  'expectedTriggeredFifoAfterDocumentUpdates',
  'expectedTriggeredDeliveryOrder',
  'expectedValid',
]);

const SUPPORTED_PROCESSOR_CAPABILITIES = new Set([
  'blue-contracts-fixture-scripted-runtime-v1',
  'blue-contracts-fixture-type-graph-v1',
]);

const RUNTIME_TYPE_KEY_TO_NAME: Record<string, string> = {
  CONTRACT: 'Contract',
  CHANNEL: 'Channel',
  HANDLER: 'Handler',
  MARKER: 'Marker',
  JSON_PATCH_ENTRY: 'Json Patch Entry',
  CONTRACT_EXECUTION_RESULT: 'Contract Execution Result',
  PROCESS_EMBEDDED: 'Process Embedded',
  PROCESSING_INITIALIZED_MARKER: 'Processing Initialized Marker',
  PROCESSING_TERMINATED_MARKER: 'Processing Terminated Marker',
  CHANNEL_EVENT_CHECKPOINT: 'Channel Event Checkpoint',
  TYPE_GENERALIZATION_POLICY: 'Type Generalization Policy',
  TYPE_GENERALIZATION_RULE: 'Type Generalization Rule',
  DOCUMENT_UPDATE_CHANNEL: 'Document Update Channel',
  TRIGGERED_EVENT_CHANNEL: 'Triggered Event Channel',
  LIFECYCLE_EVENT_CHANNEL: 'Lifecycle Event Channel',
  EMBEDDED_NODE_CHANNEL: 'Embedded Node Channel',
  DOCUMENT_UPDATE: 'Document Update',
  DOCUMENT_PROCESSING_INITIATED: 'Document Processing Initiated',
  DOCUMENT_PROCESSING_TERMINATED: 'Document Processing Terminated',
  DOCUMENT_PROCESSING_FATAL_ERROR: 'Document Processing Fatal Error',
};

export interface ContractsManifestEntry {
  readonly id: string;
  readonly category: string;
  readonly path: string;
}

export type ContractsFixtureSpec = Record<string, unknown>;

const blue = new Blue({
  repositories: [blueRepository],
  mergingProcessor: createDefaultMergingProcessor(),
});

const mockChannelSchema = z
  .object({
    accept: z.boolean().optional(),
    event: blueNodeField().optional(),
    name: z.string().optional(),
    order: z.number().optional(),
    payload: blueNodeField().optional(),
  })
  .passthrough();

type MockChannel = z.infer<typeof mockChannelSchema>;

const patchSchema = z.object({
  op: z.string(),
  path: z.string(),
  val: blueNodeField().optional(),
});

const mockHandlerSchema = z
  .object({
    addDocumentUpdateChannelAt: z.string().optional(),
    channel: z.string().optional(),
    documentUpdatePath: z.string().optional(),
    emitInvalidEvent: z.boolean().optional(),
    event: blueNodeField().optional(),
    failure: z.string().optional(),
    gasConsumed: z.number().optional(),
    name: z.string().optional(),
    order: z.number().optional(),
    patches: z.array(patchSchema).optional(),
    termination: z.string().optional(),
    terminationReason: z.string().optional(),
    triggeredEvents: z.array(blueNodeField()).optional(),
  })
  .passthrough();

type MockHandler = z.infer<typeof mockHandlerSchema>;

function readYamlFile(filePath: string): unknown {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function readFixture(relativePath: string): ContractsFixtureSpec {
  const loaded = readYamlFile(path.join(FIXTURE_ROOT, relativePath));
  if (!isRecord(loaded)) {
    throw new Error(`Fixture ${relativePath} must be a YAML object.`);
  }
  return loaded;
}

function fixtureEntries(): ContractsManifestEntry[] {
  const manifest = readFixture('manifest.yaml');
  const fixtures = manifest.fixtures;
  if (!Array.isArray(fixtures)) {
    throw new Error('Fixture manifest field "fixtures" must be a list.');
  }
  return fixtures.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error('Fixture manifest entries must be objects.');
    }
    return {
      id: textField(entry, 'id'),
      category: textField(entry, 'category'),
      path: textField(entry, 'path'),
    };
  });
}

export function contractsConformanceFixtureEntries(): ContractsManifestEntry[] {
  return fixtureEntries();
}

export function readContractsFixtureSpec(
  relativePath: string,
): ContractsFixtureSpec {
  return readFixture(relativePath);
}

export async function runContractsFixtureEntry(
  entry: ContractsManifestEntry,
  mutateFixture?: (
    entry: ContractsManifestEntry,
    spec: ContractsFixtureSpec,
  ) => ContractsFixtureSpec,
): Promise<void> {
  const fixture = readContractsFixtureSpec(entry.path);
  const spec = mutateFixture?.(entry, fixture) ?? fixture;
  validateFixtureMatchesManifest(entry, spec);
  await runContractsFixtureSpec(spec);
}

export async function runContractsFixtureSpec(
  spec: ContractsFixtureSpec,
): Promise<void> {
  const operation = textField(spec, 'operation');
  switch (operation) {
    case 'registryRuntimeTypeBlueIds':
      runRegistryRuntimeTypeBlueIdsFixture(spec);
      return;
    case 'changingRegistryDescriptionChangesBlueId':
      runChangingRegistryDescriptionFixture(spec);
      return;
    case 'runtimeRegistryPreprocessingEnvironmentReproducible':
      runRuntimeRegistryPreprocessingEnvironmentFixture(spec);
      return;
    case 'registryNodeHashesToPublishedBlueId':
      runRegistryNodeHashesFixture(spec);
      return;
    case 'registryFieldUsesTextBlueIdString':
      runRegistryFieldUsesTextBlueIdStringFixture(spec);
      return;
    case 'pointerDescendant':
      runPointerFixture(spec);
      return;
    case 'pointerValidation':
      runPointerValidationFixture(spec);
      return;
    case 'processDocument':
      await runProcessFixture(spec);
      return;
    default:
      throw new Error(
        `Unsupported Blue Contracts fixture operation: ${operation}`,
      );
  }
}

function validateFixtureMatchesManifest(
  entry: ContractsManifestEntry,
  spec: ContractsFixtureSpec,
): void {
  validateFixtureMetadata(spec);
  expect(textField(spec, 'id')).toBe(entry.id);
  expect(textField(spec, 'category')).toBe(entry.category);
}

function validateFixtureMetadata(spec: ContractsFixtureSpec): void {
  textField(spec, 'id');
  textField(spec, 'category');
  const operation = textField(spec, 'operation');
  validateExpectedFields(spec);
  validateProcessorCapabilities(spec);
  switch (operation) {
    case 'registryRuntimeTypeBlueIds':
      requireField(spec, 'expectedRuntimeBlueIds');
      break;
    case 'changingRegistryDescriptionChangesBlueId':
      requireField(spec, 'registryKey');
      requireField(spec, 'registryPath');
      requireField(spec, 'expectedOriginalBlueId');
      requireField(spec, 'mutation');
      break;
    case 'runtimeRegistryPreprocessingEnvironmentReproducible':
      requireField(spec, 'preprocessingEnvironment');
      break;
    case 'registryNodeHashesToPublishedBlueId':
      requireField(spec, 'registryKey');
      requireField(spec, 'registryPath');
      requireField(spec, 'expectedBlueId');
      break;
    case 'registryFieldUsesTextBlueIdString':
      requireField(spec, 'fields');
      break;
    case 'pointerDescendant':
      requireField(spec, 'path');
      requireField(spec, 'ancestor');
      requireField(spec, 'expectedDescendantOrEqual');
      break;
    case 'pointerValidation':
      requireField(spec, 'pointer');
      requireField(spec, 'expectedValid');
      break;
    case 'processDocument':
      requireField(spec, 'initialDocument');
      if (!hasMeaningfulProcessAssertion(spec)) {
        throw new Error('processDocument fixtures must assert outputs');
      }
      break;
    default:
      throw new Error(
        `Unsupported Blue Contracts fixture operation: ${operation}`,
      );
  }
}

function validateExpectedFields(spec: ContractsFixtureSpec): void {
  for (const field of Object.keys(spec)) {
    if (field.startsWith('expected') && !SUPPORTED_EXPECTED_FIELDS.has(field)) {
      throw new Error(`Unsupported expected fixture field: ${field}`);
    }
  }
}

function validateProcessorCapabilities(spec: ContractsFixtureSpec): void {
  const capabilities = spec.processorCapabilities;
  if (capabilities == null) {
    return;
  }
  if (!Array.isArray(capabilities)) {
    throw new Error('processorCapabilities must be a list');
  }
  for (const capability of capabilities) {
    if (
      typeof capability !== 'string' ||
      !SUPPORTED_PROCESSOR_CAPABILITIES.has(capability)
    ) {
      throw new Error(
        `Unsupported processor capability: ${String(capability)}`,
      );
    }
  }
}

function hasMeaningfulProcessAssertion(spec: ContractsFixtureSpec): boolean {
  return [...SUPPORTED_EXPECTED_FIELDS].some((field) =>
    Object.prototype.hasOwnProperty.call(spec, field),
  );
}

function runRegistryRuntimeTypeBlueIdsFixture(
  spec: ContractsFixtureSpec,
): void {
  const expected = recordField(spec, 'expectedRuntimeBlueIds');
  for (const [runtimeKey, expectedBlueId] of Object.entries(expected)) {
    const typeName = RUNTIME_TYPE_KEY_TO_NAME[runtimeKey];
    expect(typeName, `Unknown runtime type key ${runtimeKey}`).toBeDefined();
    expect(blueIds[typeName]).toBe(expectedBlueId);
  }
}

function runChangingRegistryDescriptionFixture(
  spec: ContractsFixtureSpec,
): void {
  const registryPath = textField(spec, 'registryPath');
  const node = readRegistryNode(registryPath);
  expect(runtimeBlueIdForRegistryKey(textField(spec, 'registryKey'))).toBe(
    textField(spec, 'expectedOriginalBlueId'),
  );
  const mutation = recordField(spec, 'mutation');
  expect(mutation.field).toBe('description');
  node.setDescription(
    `${node.getDescription() ?? ''}${String(mutation.append ?? '')}`,
  );
  if (spec.expectBlueIdChanged === true) {
    expect(calculateContentBlueId(node)).not.toBe(
      textField(spec, 'expectedOriginalBlueId'),
    );
  }
}

function runRuntimeRegistryPreprocessingEnvironmentFixture(
  spec: ContractsFixtureSpec,
): void {
  const environment = recordField(spec, 'preprocessingEnvironment');
  expect(environment.coreRegistry).toBe('blue-language-1.0');
  expect(environment.runtimeRegistry).toBe('blue-contracts-1.0');
  const runtimeIds = Object.values(RUNTIME_TYPE_KEY_TO_NAME).map(
    (name) => blueIds[name],
  );
  expect(new Set(runtimeIds)).toHaveLength(runtimeIds.length);
}

function runRegistryNodeHashesFixture(spec: ContractsFixtureSpec): void {
  readRegistryNode(textField(spec, 'registryPath'));
  expect(runtimeBlueIdForRegistryKey(textField(spec, 'registryKey'))).toBe(
    textField(spec, 'expectedBlueId'),
  );
}

function runRegistryFieldUsesTextBlueIdStringFixture(
  spec: ContractsFixtureSpec,
): void {
  const fields = spec.fields;
  if (!Array.isArray(fields)) {
    throw new Error('fields must be a list');
  }
  for (const fieldSpec of fields) {
    if (!isRecord(fieldSpec)) {
      throw new Error('field specs must be objects');
    }
    const node = readRegistryNode(textField(fieldSpec, 'registryPath'));
    const fieldNode = nodeAt(node, textField(fieldSpec, 'fieldPath'));
    expect(fieldNode).toBeInstanceOf(BlueNode);
    const type = fieldNode?.getType();
    const rawType =
      type?.getValue() != null ? String(type.getValue()) : type?.getBlueId();
    const actualType =
      rawType == null
        ? rawType
        : (blue.getTypeAliasByBlueId(rawType) ?? rawType);
    expect(actualType).toBe(textField(fieldSpec, 'expectedType'));
    expect(fieldNode?.getDescription() ?? '').toContain(
      textField(fieldSpec, 'expectedDescriptionContains'),
    );
  }
}

function runtimeBlueIdForRegistryKey(registryKey: string): string | undefined {
  const typeName =
    RUNTIME_TYPE_KEY_TO_NAME[registryKey] ??
    RUNTIME_TYPE_KEY_TO_NAME[toRuntimeTypeKey(registryKey)];
  expect(typeName, `Unknown runtime type key ${registryKey}`).toBeDefined();
  return typeName == null ? undefined : blueIds[typeName];
}

function toRuntimeTypeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

function runPointerFixture(spec: ContractsFixtureSpec): void {
  expect(
    descendantOrEqual(textField(spec, 'path'), textField(spec, 'ancestor')),
  ).toBe(Boolean(spec.expectedDescendantOrEqual));
}

function runPointerValidationFixture(spec: ContractsFixtureSpec): void {
  const pointer = String(spec.pointer ?? '');
  const expectedValid = Boolean(spec.expectedValid);
  try {
    assertValidRuntimePointer(pointer);
    expect(expectedValid).toBe(true);
  } catch (error) {
    if (expectedValid) {
      throw error;
    }
    assertFailureReasonContains(spec, (error as Error).message, null);
  }
}

async function runProcessFixture(spec: ContractsFixtureSpec): Promise<void> {
  const initialDocument = readNode(requireField(spec, 'initialDocument'));
  const originalDocument = initialDocument.clone();
  const scriptedRuntime = new ScriptedContractsRuntime(
    spec.mockRuntime,
    spec.typeGraph,
  );
  const discoveredTypes = discoverMockTypeBlueIds(spec, initialDocument);
  const registry = ContractProcessorRegistryBuilder.create()
    .registerDefaults()
    .register(
      new MockExternalChannelProcessor(
        scriptedRuntime,
        discoveredTypes.channels,
      ),
    )
    .register(
      new MockHandlerProcessor(scriptedRuntime, discoveredTypes.handlers),
    )
    .build();
  const processor = new DocumentProcessor({
    blue,
    registry,
    runtimeHooks: scriptedRuntime,
  });
  const event =
    spec.event == null ? readNode({ value: 'event' }) : readNode(spec.event);
  let result: DocumentProcessingResult;
  try {
    result = await processor.processDocument(initialDocument, event);
  } catch (error) {
    if (error instanceof ProcessorFatalError) {
      throw new Error(
        `ProcessorFatalError escaped fixture run: ${error.message}`,
      );
    }
    throw error;
  }
  assertProcessResult(spec, originalDocument, result);
}

class ScriptedContractsRuntime implements ProcessorRuntimeHooks {
  private readonly channelCalls = new Map<string, ChannelCall[]>();
  private readonly handlerCalls = new Map<string, HandlerCall[]>();
  private readonly pendingHandlerCalls = new Map<string, HandlerCall>();
  private readonly childEmissions = new Map<string, BlueNode[]>();
  private readonly bridgeMutations: BridgeMutation[] = [];
  private readonly fixtureTypes = new Map<string, FixtureType>();
  private readonly embeddedDeliveries: Array<{
    emission: BlueNode;
    channels: readonly string[];
  }> = [];
  private forcedFatalValue: ForcedFatal | null = null;

  constructor(mockRuntime: unknown, typeGraph?: unknown) {
    this.readTypeGraph(typeGraph);
    if (!isRecord(mockRuntime)) {
      return;
    }
    this.readChannelCalls(mockRuntime.channels);
    this.readHandlerCalls(mockRuntime.handlers);
    this.readChildEmissions(mockRuntime.childEmissions);
    this.readBridgeMutations(mockRuntime.bridgeMutations);
    this.readForcedFatal(mockRuntime.forcedFatal);
  }

  forcedFatal(): ForcedFatal | null {
    const current = this.forcedFatalValue;
    this.forcedFatalValue = null;
    return current;
  }

  typeGraphProvider(): TypeGraphProvider | null {
    if (this.fixtureTypes.size === 0) {
      return null;
    }
    return new StaticTypeGraphProvider(
      this.fixtureTypes.values(),
      blue,
      productionGeneralizationNodeAt,
    );
  }

  hasChannelScript(contractPath: string): boolean {
    return (this.channelCalls.get(contractPath)?.length ?? 0) > 0;
  }

  evaluateChannel(
    contractPath: string,
    context: ChannelEvaluationContext,
  ): ChannelMatch {
    const call = this.channelCalls
      .get(contractPath)
      ?.find((candidate) => !candidate.consumed && candidate.matches(context));
    if (!call) {
      return { matches: false };
    }
    call.consumed = true;
    if (!call.accepted) {
      return { matches: false };
    }
    return {
      matches: true,
      checkpointIdentityMode: call.checkpointIdentityModeValue(),
      eventNode: call.payload?.clone() ?? context.event?.clone() ?? null,
    };
  }

  hasHandlerScript(contractPath: string): boolean {
    return (this.handlerCalls.get(contractPath)?.length ?? 0) > 0;
  }

  matchesHandler(
    contractPath: string,
    context: ContractProcessorContext,
    channelKey: string,
  ): boolean {
    const call = this.handlerCalls
      .get(contractPath)
      ?.find(
        (candidate) =>
          !candidate.consumed && candidate.matches(context, channelKey),
      );
    if (!call) {
      this.pendingHandlerCalls.delete(contractPath);
      return false;
    }
    this.pendingHandlerCalls.set(contractPath, call);
    return true;
  }

  async executeHandler(
    contractPath: string,
    context: ContractProcessorContext,
  ): Promise<void> {
    const call = this.pendingHandlerCalls.get(contractPath);
    this.pendingHandlerCalls.delete(contractPath);
    if (!call) {
      return;
    }
    call.consumed = true;
    if (call.hostApiCalls.length > 0) {
      await executeHostApiCalls(call.hostApiCalls, context);
      return;
    }
    await executeResult(call.result, context);
  }

  afterEmbeddedChildProcessed(
    childScope: string,
    runtime: DocumentProcessingRuntime,
  ): void {
    const emissions = this.childEmissions.get(childScope);
    if (!emissions || emissions.length === 0) {
      return;
    }
    for (const emission of emissions) {
      runtime.scope(childScope).recordBridgeable(emission.clone());
    }
  }

  recordEmbeddedBridgeDelivery(
    emission: BlueNode,
    channels: readonly string[],
  ): void {
    this.embeddedDeliveries.push({
      emission: emission.clone(),
      channels: [...channels],
    });
  }

  afterBridgeEmission(
    scopePath: string,
    runtime: DocumentProcessingRuntime,
    emission: BlueNode,
  ): void {
    if (this.bridgeMutations.length === 0) {
      return;
    }
    const emissionId = emission.getProperties()?.id?.getValue();
    if (emissionId == null) {
      return;
    }
    for (const mutation of this.bridgeMutations) {
      if (mutation.applied || mutation.duringEmission !== String(emissionId)) {
        continue;
      }
      mutation.applied = true;
      if (mutation.addChannelKey) {
        const patchPath = contractPathFor(scopePath, mutation.addChannelKey);
        const channelNode = blue.jsonValueToNode({
          type: { blueId: blueIds['Embedded Node Channel'] },
          ...(mutation.childPath ? { childPath: mutation.childPath } : {}),
        });
        const exists = nodeAt(runtime.document(), patchPath) != null;
        runtime.applyPatch(scopePath, {
          op: exists ? 'REPLACE' : 'ADD',
          path: patchPath,
          val: channelNode,
        });
      }
      if (mutation.removeChannelKey) {
        const patchPath = contractPathFor(scopePath, mutation.removeChannelKey);
        if (nodeAt(runtime.document(), patchPath) != null) {
          runtime.applyPatch(scopePath, {
            op: 'REMOVE',
            path: patchPath,
          });
        }
      }
    }
  }

  private readChannelCalls(channels: unknown): void {
    if (channels == null) {
      return;
    }
    if (!Array.isArray(channels)) {
      throw new Error('mockRuntime.channels must be a list');
    }
    for (const channel of channels) {
      if (!isRecord(channel) || !Array.isArray(channel.calls)) {
        throw new Error('mockRuntime channel calls must be a list');
      }
      const calls = this.channelCalls.get(textField(channel, 'contract')) ?? [];
      for (const call of channel.calls) {
        if (!isRecord(call)) {
          throw new Error('mockRuntime channel call must be an object');
        }
        calls.push(
          new ChannelCall(
            call,
            optionalText(channel, 'checkpointIdentityMode'),
          ),
        );
      }
      this.channelCalls.set(textField(channel, 'contract'), calls);
    }
  }

  private readHandlerCalls(handlers: unknown): void {
    if (handlers == null) {
      return;
    }
    if (!Array.isArray(handlers)) {
      throw new Error('mockRuntime.handlers must be a list');
    }
    for (const handler of handlers) {
      if (!isRecord(handler) || !Array.isArray(handler.calls)) {
        throw new Error('mockRuntime handler calls must be a list');
      }
      const calls = this.handlerCalls.get(textField(handler, 'contract')) ?? [];
      for (const call of handler.calls) {
        if (!isRecord(call)) {
          throw new Error('mockRuntime handler call must be an object');
        }
        calls.push(new HandlerCall(call));
      }
      this.handlerCalls.set(textField(handler, 'contract'), calls);
    }
  }

  private readChildEmissions(raw: unknown): void {
    if (raw == null) {
      return;
    }
    if (!isRecord(raw)) {
      throw new Error('mockRuntime.childEmissions must be an object');
    }
    for (const [scopePath, emissions] of Object.entries(raw)) {
      if (!Array.isArray(emissions)) {
        throw new Error('mockRuntime.childEmissions entries must be lists');
      }
      this.childEmissions.set(
        scopePath,
        emissions.map((emission) => readNode(emission)),
      );
    }
  }

  private readBridgeMutations(raw: unknown): void {
    if (raw == null) {
      return;
    }
    if (!Array.isArray(raw)) {
      throw new Error('mockRuntime.bridgeMutations must be a list');
    }
    for (const mutation of raw) {
      if (!isRecord(mutation)) {
        throw new Error('mockRuntime.bridgeMutations entries must be objects');
      }
      this.bridgeMutations.push({
        duringEmission: textField(mutation, 'duringEmission'),
        addChannelKey: optionalText(mutation, 'addChannelKey') ?? undefined,
        removeChannelKey:
          optionalText(mutation, 'removeChannelKey') ?? undefined,
        childPath: optionalText(mutation, 'childPath') ?? undefined,
        applied: false,
      });
    }
  }

  private readForcedFatal(raw: unknown): void {
    if (raw == null) {
      return;
    }
    if (!isRecord(raw)) {
      throw new Error('mockRuntime.forcedFatal must be an object');
    }
    this.forcedFatalValue = {
      scope: optionalText(raw, 'scope') ?? '/',
      reason: optionalText(raw, 'reason') ?? 'forced fatal',
    };
  }

  private readTypeGraph(raw: unknown): void {
    if (raw == null) {
      return;
    }
    if (!isRecord(raw)) {
      throw new Error('typeGraph must be an object');
    }
    const idsByName = new Map<string, string>();
    for (const [name, spec] of Object.entries(raw)) {
      if (!isRecord(spec)) {
        throw new Error('typeGraph entries must be objects');
      }
      idsByName.set(name, textField(spec, 'blueId'));
    }
    for (const [name, spec] of Object.entries(raw)) {
      if (!isRecord(spec)) {
        continue;
      }
      const type = new FixtureType(name, spec, idsByName);
      this.fixtureTypes.set(type.blueId, type);
    }
  }
}

interface ForcedFatal {
  readonly scope: string | null;
  readonly reason: string | null;
}

interface BridgeMutation {
  readonly duringEmission: string;
  readonly addChannelKey?: string;
  readonly removeChannelKey?: string;
  readonly childPath?: string;
  applied: boolean;
}

class FixtureType {
  readonly blueId: string;
  readonly parentBlueId: string | null;
  readonly fixedValues = new Map<string, BlueNode>();
  readonly fieldTypes = new Map<string, string>();

  constructor(
    readonly name: string,
    spec: ContractsFixtureSpec,
    idsByName: ReadonlyMap<string, string>,
  ) {
    this.blueId = textField(spec, 'blueId');
    const parentName = optionalText(spec, 'parent');
    this.parentBlueId = parentName ? (idsByName.get(parentName) ?? null) : null;
    if (isRecord(spec.fixedValues)) {
      for (const [pathValue, fixedValue] of Object.entries(spec.fixedValues)) {
        this.fixedValues.set(
          normalizeRuntimePointer(pathValue),
          readNode(fixedValue),
        );
      }
    }
    if (isRecord(spec.fields)) {
      for (const [pathValue, fieldSpec] of Object.entries(spec.fields)) {
        if (!isRecord(fieldSpec)) {
          continue;
        }
        const fieldTypeName = optionalText(fieldSpec, 'type');
        const fieldType = fieldTypeName ? idsByName.get(fieldTypeName) : null;
        if (fieldType) {
          this.fieldTypes.set(normalizeRuntimePointer(pathValue), fieldType);
        }
      }
    }
  }
}

class ChannelCall {
  readonly accepted: boolean;
  readonly payload: BlueNode | null;
  consumed = false;

  constructor(
    private readonly call: ContractsFixtureSpec,
    private readonly checkpointIdentityMode: string | null,
  ) {
    this.accepted = this.call.accepted === true;
    this.payload =
      this.call.payload == null ? null : readNode(this.call.payload);
  }

  matches(context: ChannelEvaluationContext): boolean {
    if (this.checkpointIdentityMode === 'nodeBlueId') {
      try {
        if (context.event) {
          calculateContentBlueId(context.event);
        }
      } catch (error) {
        throw new ProcessorFatalError(
          `CheckpointError: nodeBlueId mode requires valid BlueId Input: ${
            (error as Error).message
          }`,
          ProcessorErrors.runtimeFatal('CheckpointError'),
          ProcessorErrorCategory.CheckpointError,
        );
      }
    }
    const when = this.call.when;
    if (!isRecord(when)) {
      return true;
    }
    if (when.event != null && !matchesNode(when.event, context.event)) {
      return false;
    }
    if (when.eventContentBlueId != null && context.event) {
      const expected = String(when.eventContentBlueId);
      if (expected.startsWith('same-as-lastEvents.')) {
        const key = expected.slice('same-as-lastEvents.'.length);
        const marker = context.markers.get('checkpoint') as
          | { lastEvents?: Record<string, BlueNode> }
          | undefined;
        const stored = marker?.lastEvents?.[key] ?? null;
        return (
          stored != null &&
          calculateContentBlueId(stored) ===
            calculateContentBlueId(context.event)
        );
      }
      return calculateContentBlueId(context.event) === expected;
    }
    return true;
  }

  checkpointIdentityModeValue(): ChannelMatch['checkpointIdentityMode'] {
    switch (this.checkpointIdentityMode) {
      case 'contentBlueId':
      case 'nodeBlueId':
      case 'eventId':
      case 'channelDefined':
        return this.checkpointIdentityMode;
      default:
        return undefined;
    }
  }
}

class HandlerCall {
  readonly when: unknown;
  readonly result: unknown;
  readonly hostApiCalls: readonly unknown[];
  consumed = false;

  constructor(call: ContractsFixtureSpec) {
    this.when = call.when;
    this.result = call.result;
    this.hostApiCalls = Array.isArray(call.hostApiCalls)
      ? call.hostApiCalls
      : [];
  }

  matches(context: ContractProcessorContext, channelKey: string): boolean {
    if (!isRecord(this.when)) {
      return true;
    }
    if (this.when.channelKey != null && this.when.channelKey !== channelKey) {
      return false;
    }
    const event = context.event();
    if (this.when.payload != null && !matchesNode(this.when.payload, event)) {
      return false;
    }
    return this.when.event == null || matchesNode(this.when.event, event);
  }
}

class MockExternalChannelProcessor implements ChannelProcessor<MockChannel> {
  readonly kind = 'channel' as const;
  readonly blueIds: readonly string[];
  readonly schema = mockChannelSchema;

  constructor(
    private readonly scriptedRuntime: ScriptedContractsRuntime,
    extraBlueIds: readonly string[],
  ) {
    this.blueIds = [
      MOCK_EXTERNAL_CHANNEL,
      LEGACY_MOCK_EXTERNAL_CHANNEL,
      ...extraBlueIds,
    ];
  }

  matches(contract: MockChannel, context: ChannelEvaluationContext): boolean {
    return this.evaluate(contract, context).matches;
  }

  evaluate(
    contract: MockChannel,
    context: ChannelEvaluationContext,
  ): ChannelMatch {
    const contractPath = contractPathFor(context.scopePath, context.bindingKey);
    if (this.scriptedRuntime.hasChannelScript(contractPath)) {
      return this.scriptedRuntime.evaluateChannel(contractPath, context);
    }
    if (contract.accept === false) {
      return { matches: false };
    }
    return {
      matches: true,
      eventNode: contract.payload?.clone() ?? context.event?.clone() ?? null,
    };
  }
}

class MockHandlerProcessor implements HandlerProcessor<MockHandler> {
  readonly kind = 'handler' as const;
  readonly blueIds: readonly string[];
  readonly schema = mockHandlerSchema;

  constructor(
    private readonly scriptedRuntime: ScriptedContractsRuntime,
    extraBlueIds: readonly string[],
  ) {
    this.blueIds = [MOCK_HANDLER, LEGACY_MOCK_HANDLER, ...extraBlueIds];
  }

  deriveChannel(contract: MockHandler): string | null | undefined {
    return contract.channel;
  }

  matches(
    contract: MockHandler,
    context: ContractProcessorContext,
    metadata?: HandlerExecutionMetadata,
  ): boolean {
    const contractKey = metadata?.contractKey;
    if (contractKey) {
      const contractPath = contractPathFor(context.scopePath, contractKey);
      if (this.scriptedRuntime.hasHandlerScript(contractPath)) {
        return this.scriptedRuntime.matchesHandler(
          contractPath,
          context,
          contract.channel ?? '',
        );
      }
    }
    if (contract.event == null) {
      return true;
    }
    const event = context.event();
    return event != null && context.blue.isTypeOfNode(event, contract.event);
  }

  async execute(
    contract: MockHandler,
    context: ContractProcessorContext,
    metadata?: HandlerExecutionMetadata,
  ): Promise<void> {
    const contractKey = metadata?.contractKey;
    if (contractKey) {
      const contractPath = contractPathFor(context.scopePath, contractKey);
      if (this.scriptedRuntime.hasHandlerScript(contractPath)) {
        await this.scriptedRuntime.executeHandler(contractPath, context);
        return;
      }
    }
    if (contract.failure === 'beforeEffects') {
      throw new Error('Mock handler failure before effects');
    }
    if (typeof contract.gasConsumed === 'number') {
      context.consumeGas(contract.gasConsumed);
    }
    for (const patch of contract.patches ?? []) {
      await context.applyPatch(toJsonPatch(patch));
    }
    if (contract.addDocumentUpdateChannelAt) {
      await context.applyPatch({
        op: 'ADD',
        path: context.resolvePointer(contract.addDocumentUpdateChannelAt),
        val: blue.jsonValueToNode({
          type: { blueId: blueIds['Document Update Channel'] },
          path:
            contract.documentUpdatePath ?? contract.addDocumentUpdateChannelAt,
        }),
      });
    }
    for (const event of contract.triggeredEvents ?? []) {
      context.emitEvent(event.clone());
    }
    if (contract.emitInvalidEvent === true) {
      await context.terminateFatally(
        'Invalid emitted event: fixture invalid event',
      );
      return;
    }
    if (contract.termination === 'fatal') {
      await context.terminateFatally(contract.terminationReason ?? null);
    } else if (contract.termination === 'graceful') {
      await context.terminateGracefully(contract.terminationReason ?? null);
    }
    if (contract.failure === 'afterBuffering') {
      throw new Error('Mock handler failure after buffering');
    }
  }
}

async function executeHostApiCalls(
  calls: readonly unknown[],
  context: ContractProcessorContext,
): Promise<void> {
  const patches: JsonPatch[] = [];
  const emissions: BlueNode[] = [];
  let pendingTermination: unknown = null;
  for (const call of calls) {
    if (!isRecord(call)) {
      continue;
    }
    if (typeof call.consumeGas === 'number') {
      context.consumeGas(call.consumeGas);
    } else if (call.applyPatch != null) {
      patches.push(toJsonPatch(call.applyPatch));
    } else if (call.emitEvent != null) {
      emissions.push(readNode(call.emitEvent));
    } else if (call.terminate != null) {
      pendingTermination = call.terminate;
    } else if (isRecord(call.throw)) {
      const category =
        optionalText(call.throw, 'category') ?? 'HandlerExecutionError';
      throw new ProcessorFatalError(
        category,
        ProcessorErrors.runtimeFatal(category),
      );
    }
  }
  for (const patch of patches) {
    await context.applyPatch(patch);
  }
  for (const emission of emissions) {
    context.emitEvent(emission);
  }
  if (pendingTermination != null) {
    await terminate(pendingTermination, context);
  }
}

async function executeResult(
  result: unknown,
  context: ContractProcessorContext,
): Promise<void> {
  if (!isRecord(result)) {
    return;
  }
  if (typeof result.gasConsumed === 'number') {
    context.consumeGas(result.gasConsumed);
  }
  if (Array.isArray(result.patches)) {
    for (const patch of result.patches) {
      await context.applyPatch(toJsonPatch(patch));
    }
  }
  if (Array.isArray(result.triggeredEvents)) {
    for (const event of result.triggeredEvents) {
      context.emitEvent(readNode(event));
    }
  }
  if (result.termination != null) {
    await terminate(result.termination, context);
  }
}

async function terminate(
  rawTermination: unknown,
  context: ContractProcessorContext,
): Promise<void> {
  const cause = isRecord(rawTermination)
    ? (optionalText(rawTermination, 'cause') ?? 'graceful')
    : rawTermination == null
      ? 'graceful'
      : String(rawTermination);
  const reason = isRecord(rawTermination)
    ? optionalText(rawTermination, 'reason')
    : null;
  if (cause === 'fatal') {
    await context.terminateFatally(reason);
  } else {
    await context.terminateGracefully(reason);
  }
}

function assertProcessResult(
  spec: ContractsFixtureSpec,
  originalDocument: BlueNode,
  result: DocumentProcessingResult,
): void {
  if (spec.expectedStatus != null) {
    expect(result.status).toBe(spec.expectedStatus);
  }
  if (spec.expectedErrorCategory != null) {
    expect(result.errorCategory).toBe(spec.expectedErrorCategory);
  }
  if (Array.isArray(spec.expectedErrorCategories)) {
    expect(spec.expectedErrorCategories).toContain(result.errorCategory);
  }
  if (spec.expectedCapabilityFailure != null) {
    expect(result.capabilityFailure).toBe(
      Boolean(spec.expectedCapabilityFailure),
    );
  }
  assertFailureReasonContains(spec, result.failureReason, result.document);
  if (spec.expectedNoDocumentMutation === true) {
    expect(
      nodeJson(withoutProcessorManagedMutationMarkers(result.document)),
    ).toEqual(
      nodeJson(withoutProcessorManagedMutationMarkers(originalDocument)),
    );
  }
  if (spec.expectedDocument != null) {
    assertNodeEquals(
      readNode(spec.expectedDocument),
      result.document,
      'Document',
    );
  }
  if (typeof spec.expectedExactGas === 'number') {
    expect(result.totalGas).toBe(spec.expectedExactGas);
  }
  if (typeof spec.expectedTotalGas === 'number') {
    expect(result.totalGas).toBe(spec.expectedTotalGas);
  }
  if (typeof spec.expectedTotalGasMin === 'number') {
    expect(result.totalGas).toBeGreaterThanOrEqual(spec.expectedTotalGasMin);
  }
  assertRootEvents(spec, result.triggeredEvents);
  assertDocumentPaths(spec, result.document);
  assertCheckpointLastEvents(spec, result.document);
  assertInitializationContentBlueIdInput(
    spec,
    originalDocument,
    result.document,
  );
}

function assertRootEvents(
  spec: ContractsFixtureSpec,
  rootEvents: readonly BlueNode[],
): void {
  if (typeof spec.expectedRootEventCount === 'number') {
    expect(rootEvents).toHaveLength(spec.expectedRootEventCount);
  }
  if (Array.isArray(spec.expectedRootEvents)) {
    expect(rootEvents).toHaveLength(spec.expectedRootEvents.length);
    spec.expectedRootEvents.forEach((event, index) => {
      assertNodeEquals(
        readNode(event),
        rootEvents[index],
        `Root event ${index}`,
      );
    });
  }
  if (Array.isArray(spec.expectedRootEventSuffix)) {
    const offset = rootEvents.length - spec.expectedRootEventSuffix.length;
    expect(offset).toBeGreaterThanOrEqual(0);
    spec.expectedRootEventSuffix.forEach((event, index) => {
      assertNodeEquals(
        readNode(event),
        rootEvents[offset + index],
        `Root event suffix ${index}`,
      );
    });
  }
  if (Array.isArray(spec.expectedRootEventTypes)) {
    expect(
      rootEvents.map((event) => event.getType()?.getBlueId() ?? null),
    ).toEqual(spec.expectedRootEventTypes);
  }
}

function assertDocumentPaths(
  spec: ContractsFixtureSpec,
  document: BlueNode,
): void {
  if (Array.isArray(spec.expectedDocumentPathExists)) {
    for (const pointer of spec.expectedDocumentPathExists) {
      expect(nodeAt(document, String(pointer)), String(pointer)).toBeInstanceOf(
        BlueNode,
      );
    }
  }
  if (Array.isArray(spec.expectedAbsentDocumentPaths)) {
    for (const pointer of spec.expectedAbsentDocumentPaths) {
      expect(nodeAt(document, String(pointer)), String(pointer)).toBeNull();
    }
  }
  if (isRecord(spec.expectedDocumentPaths)) {
    for (const [pointer, expected] of Object.entries(
      spec.expectedDocumentPaths,
    )) {
      assertNodeEquals(readNode(expected), nodeAt(document, pointer), pointer);
    }
  }
  if (Array.isArray(spec.expectedDocumentPathValues)) {
    for (const assertion of spec.expectedDocumentPathValues) {
      if (!isRecord(assertion)) {
        throw new Error('expectedDocumentPathValues entries must be objects');
      }
      assertNodeEquals(
        readNode(requireField(assertion, 'value')),
        nodeAt(document, textField(assertion, 'path')),
        textField(assertion, 'path'),
      );
    }
  }
  if (Array.isArray(spec.expectedAbsentDocumentPathValues)) {
    for (const assertion of spec.expectedAbsentDocumentPathValues) {
      if (!isRecord(assertion)) {
        throw new Error(
          'expectedAbsentDocumentPathValues entries must be objects',
        );
      }
      const actual = nodeAt(document, textField(assertion, 'path'));
      if (actual == null) {
        continue;
      }
      expect(nodeJson(actual)).not.toEqual(
        nodeJson(readNode(requireField(assertion, 'value'))),
      );
    }
  }
}

function assertCheckpointLastEvents(
  spec: ContractsFixtureSpec,
  document: BlueNode,
): void {
  if (!isRecord(spec.expectedCheckpointLastEvents)) {
    return;
  }
  for (const [channelKey, expected] of Object.entries(
    spec.expectedCheckpointLastEvents,
  )) {
    const pointer = `/contracts/checkpoint/lastEvents/${escapePointerSegment(channelKey)}`;
    assertNodeEquals(readNode(expected), nodeAt(document, pointer), pointer);
  }
}

function assertInitializationContentBlueIdInput(
  spec: ContractsFixtureSpec,
  originalDocument: BlueNode,
  document: BlueNode,
): void {
  if (!isRecord(spec.expectedInitializationContentBlueIdInput)) {
    return;
  }
  const excludesPath = optionalText(
    spec.expectedInitializationContentBlueIdInput,
    'excludesPath',
  );
  if (excludesPath) {
    expect(nodeAt(originalDocument, excludesPath)).toBeNull();
  }
  const documentId = nodeAt(document, '/contracts/initialized/documentId');
  expect(documentId?.getValue()).toBe(calculateContentBlueId(originalDocument));
}

function assertFailureReasonContains(
  spec: ContractsFixtureSpec,
  actualReason: string | null,
  document: BlueNode | null,
): void {
  if (spec.expectedFailureReasonContains == null) {
    return;
  }
  const expected = String(spec.expectedFailureReasonContains);
  const documentDebug = document ? JSON.stringify(nodeJson(document)) : '';
  expect(`${actualReason ?? ''}\n${documentDebug}`).toContain(expected);
}

function readRegistryNode(registryPath: string): BlueNode {
  const normalized = registryPath.startsWith('/')
    ? registryPath.slice(1)
    : registryPath;
  const relative = normalized.startsWith('registry/')
    ? normalized.slice('registry/'.length)
    : normalized;
  return blue.yamlToNode(
    fs.readFileSync(path.join(REGISTRY_ROOT, relative), 'utf8'),
  );
}

function readNode(value: unknown): BlueNode {
  if (value instanceof BlueNode) {
    return value.clone();
  }
  const unwrapped = unwrapObjectValueWrappers(value);
  const node = blue.jsonValueToNodeUnchecked(unwrapped as JsonBlueValue);
  restoreEmptyObjectNodes(unwrapped, node);
  return node;
}

function unwrapObjectValueWrappers(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => unwrapObjectValueWrappers(item));
  }
  if (!isRecord(value)) {
    return value;
  }
  if (
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, 'value') &&
    (Array.isArray(value.value) || isRecord(value.value))
  ) {
    return unwrapObjectValueWrappers(value.value);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      unwrapObjectValueWrappers(nested),
    ]),
  );
}

function restoreEmptyObjectNodes(source: unknown, node: BlueNode): void {
  if (Array.isArray(source)) {
    const items = node.getItems() ?? [];
    source.forEach((item, index) => {
      const child = items[index];
      if (child) {
        restoreEmptyObjectNodes(item, child);
      }
    });
    return;
  }
  if (!isRecord(source)) {
    return;
  }
  if (Object.keys(source).length === 0 && node.getProperties() == null) {
    node.setProperties({});
    return;
  }
  const properties = { ...(node.getProperties() ?? {}) };
  let changed = false;
  for (const [key, nested] of Object.entries(source)) {
    if (BLUE_RESERVED_FIELDS.has(key)) {
      continue;
    }
    if (!isRecord(nested) && !Array.isArray(nested)) {
      continue;
    }
    let child = properties[key];
    if (!child) {
      child = new BlueNode();
      properties[key] = child;
      changed = true;
    }
    restoreEmptyObjectNodes(nested, child);
  }
  if (changed || Object.keys(properties).length > 0) {
    node.setProperties(properties);
  }
}

const BLUE_RESERVED_FIELDS = new Set([
  'blue',
  'blueId',
  'description',
  'itemType',
  'items',
  'keyType',
  'name',
  'schema',
  'type',
  'value',
  'valueType',
]);

function toJsonPatch(rawPatch: unknown): JsonPatch {
  if (!isRecord(rawPatch)) {
    throw new Error('Patch must be an object');
  }
  if (isRecord(rawPatch.val) && rawPatch.val.blue != null) {
    throw new ProcessorFatalError(
      'Invalid patch value: root blue directive is not allowed',
      ProcessorErrors.runtimeFatal('InvalidPatchValue'),
      ProcessorErrorCategory.InvalidPatchValue,
    );
  }
  const op = textField(rawPatch, 'op').toUpperCase();
  if (op !== 'ADD' && op !== 'REPLACE' && op !== 'REMOVE') {
    throw new Error(`Unsupported patch op: ${op}`);
  }
  return {
    op,
    path: textField(rawPatch, 'path'),
    ...(op === 'REMOVE' ? {} : { val: readNode(rawPatch.val) }),
  } as JsonPatch;
}

function discoverMockTypeBlueIds(
  spec: ContractsFixtureSpec,
  document: BlueNode,
): { channels: string[]; handlers: string[] } {
  const channels = new Set<string>();
  const handlers = new Set<string>();
  const mockRuntime = spec.mockRuntime;
  if (isRecord(mockRuntime)) {
    if (Array.isArray(mockRuntime.channels)) {
      for (const channel of mockRuntime.channels) {
        if (!isRecord(channel)) {
          continue;
        }
        const node = nodeAt(document, textField(channel, 'contract'));
        const blueId = node?.getType()?.getBlueId();
        if (blueId) {
          channels.add(blueId);
        }
      }
    }
    if (Array.isArray(mockRuntime.handlers)) {
      for (const handler of mockRuntime.handlers) {
        if (!isRecord(handler)) {
          continue;
        }
        const node = nodeAt(document, textField(handler, 'contract'));
        const blueId = node?.getType()?.getBlueId();
        if (blueId) {
          handlers.add(blueId);
        }
      }
    }
  }
  return { channels: [...channels], handlers: [...handlers] };
}

function contractPathFor(scopePath: string, contractKey: string): string {
  const prefix = scopePath === '/' ? '' : scopePath;
  return `${prefix}/contracts/${escapePointerSegment(contractKey)}`;
}

function nodeAt(root: BlueNode | null, pointer: string): BlueNode | null {
  if (!root) {
    return null;
  }
  try {
    return ProcessorEngine.nodeAt(root, pointer, {
      calculateBlueId: calculateContentBlueId,
    });
  } catch {
    return null;
  }
}

function nodeJson(node: BlueNode): unknown {
  return blue.nodeToJson(node, 'simple');
}

function assertNodeEquals(
  expected: BlueNode | null,
  actual: BlueNode | null | undefined,
  message: string,
): void {
  expect(actual, message).toBeInstanceOf(BlueNode);
  expect(nodeJson(actual as BlueNode), message).toEqual(
    expected == null ? null : nodeJson(expected),
  );
}

function matchesNode(matcher: unknown, actual: BlueNode | null): boolean {
  if (matcher == null || matcher === 'any') {
    return true;
  }
  if (!actual) {
    return false;
  }
  return matchesValue(nodeJson(readNode(matcher)), nodeJson(actual));
}

function matchesValue(matcher: unknown, actual: unknown): boolean {
  if (isRecord(matcher) && isRecord(actual)) {
    return Object.entries(matcher).every(([key, value]) =>
      matchesValue(value, actual[key]),
    );
  }
  if (Array.isArray(matcher) && Array.isArray(actual)) {
    return (
      matcher.length === actual.length &&
      matcher.every((item, index) => matchesValue(item, actual[index]))
    );
  }
  return Object.is(matcher, actual);
}

function withoutProcessorManagedMutationMarkers(document: BlueNode): BlueNode {
  const copy = document.clone();
  stripProcessorManagedMarkers(copy);
  return copy;
}

function stripProcessorManagedMarkers(node: BlueNode): void {
  const contracts = node.getContractsNode();
  if (contracts) {
    contracts.removeProperty('initialized');
    contracts.removeProperty('checkpoint');
    contracts.removeProperty('terminated');
    for (const child of Object.values(contracts.getProperties() ?? {})) {
      stripProcessorManagedMarkers(child);
    }
  }
  for (const child of Object.values(node.getProperties() ?? {})) {
    stripProcessorManagedMarkers(child);
  }
  for (const child of node.getItems() ?? []) {
    stripProcessorManagedMarkers(child);
  }
}

function descendantOrEqual(pathValue: string, ancestorValue: string): boolean {
  const pathSegments = splitPointer(pathValue);
  const ancestorSegments = splitPointer(ancestorValue);
  if (ancestorSegments.length > pathSegments.length) {
    return false;
  }
  return ancestorSegments.every(
    (segment, index) => segment === pathSegments[index],
  );
}

function assertValidRuntimePointer(pointer: string): string {
  if (pointer.length === 0) {
    throw new Error('Runtime pointer must not be empty');
  }
  if (!pointer.startsWith('/')) {
    throw new Error(`Runtime pointer must be absolute: ${pointer}`);
  }
  if (pointer.length > 1 && pointer.endsWith('/')) {
    throw new Error(
      `Runtime pointer must not have a trailing slash: ${pointer}`,
    );
  }
  if (pointer === '/') {
    return pointer;
  }
  for (const segment of pointer.slice(1).split('/')) {
    if (segment.length === 0) {
      throw new Error(
        `Runtime pointer must not contain empty segments: ${pointer}`,
      );
    }
    for (let i = 0; i < segment.length; i += 1) {
      if (segment[i] !== '~') {
        continue;
      }
      const next = segment[i + 1];
      if (next !== '0' && next !== '1') {
        throw new Error(`Runtime pointer contains bad '~' escape: ${pointer}`);
      }
      i += 1;
    }
  }
  return pointer;
}

function splitPointer(pointer: string): string[] {
  assertValidRuntimePointer(pointer);
  if (pointer === '/') {
    return [];
  }
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function requireField(record: ContractsFixtureSpec, field: string): unknown {
  const value = record[field];
  if (value == null) {
    throw new Error(`Fixture field "${field}" is required.`);
  }
  return value;
}

function recordField(
  record: ContractsFixtureSpec,
  field: string,
): ContractsFixtureSpec {
  const value = requireField(record, field);
  if (!isRecord(value)) {
    throw new Error(`Fixture field "${field}" must be an object.`);
  }
  return value;
}

function textField(record: ContractsFixtureSpec, field: string): string {
  const value = requireField(record, field);
  return String(value);
}

function optionalText(
  record: ContractsFixtureSpec,
  field: string,
): string | null {
  const value = record[field];
  return value == null ? null : String(value);
}

function isRecord(value: unknown): value is ContractsFixtureSpec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
