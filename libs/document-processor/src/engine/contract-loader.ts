import { Blue, BlueNode } from '@blue-labs/language';
import { blueIds } from '@blue-repository/types/packages/core/blue-ids';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as myosBlueIds } from '@blue-repository/types/packages/myos/blue-ids';
import { AnyZodObject, ZodError, ZodType, ZodTypeAny } from 'zod';

import {
  documentUpdateChannelSchema,
  embeddedNodeChannelSchema,
  lifecycleChannelSchema,
  triggeredEventChannelSchema,
  processEmbeddedMarkerSchema,
  initializationMarkerSchema,
  processingTerminatedMarkerSchema,
  channelEventCheckpointSchema,
  documentAnchorsMarkerSchema,
  documentLinksMarkerSchema,
  myosParticipantsOrchestrationMarkerSchema,
  myosSessionInteractionMarkerSchema,
  myosWorkerAgencyMarkerSchema,
} from '../model/index.js';
import { isProcessorManagedChannelBlueId } from '../constants/processor-contract-constants.js';
import { ContractBundle, ContractBundleBuilder } from './contract-bundle.js';
import { ContractProcessorRegistry } from '../registry/contract-processor-registry.js';
import { HandlerRegistrationService } from './handler-registration-service.js';
import type {
  ScopeContractEntry,
  ScopeContractsIndex,
} from '../types/scope-contracts.js';
import type {
  ChannelContract,
  CompositeTimelineChannel,
  MarkerContract,
  ProcessEmbeddedMarker,
} from '../model/index.js';
import { ProcessorErrors } from '../types/errors.js';
import { MustUnderstandFailure } from './must-understand-failure.js';
import { ProcessorFatalError } from './processor-fatal-error.js';
import { assertCompositeChannelIsAcyclic } from './composite-channel-validation.js';

const DOCUMENT_UPDATE_CHANNEL_BLUE_ID = blueIds['Core/Document Update Channel'];
const EMBEDDED_NODE_CHANNEL_BLUE_ID = blueIds['Core/Embedded Node Channel'];
const LIFECYCLE_EVENT_CHANNEL_BLUE_ID = blueIds['Core/Lifecycle Event Channel'];
const TRIGGERED_EVENT_CHANNEL_BLUE_ID = blueIds['Core/Triggered Event Channel'];
const PROCESS_EMBEDDED_BLUE_ID = blueIds['Core/Process Embedded'];
const PROCESSING_INITIALIZED_MARKER_BLUE_ID =
  blueIds['Core/Processing Initialized Marker'];
const PROCESSING_TERMINATED_MARKER_BLUE_ID =
  blueIds['Core/Processing Terminated Marker'];
const CHANNEL_EVENT_CHECKPOINT_BLUE_ID =
  blueIds['Core/Channel Event Checkpoint'];
const DOCUMENT_ANCHORS_BLUE_ID = myosBlueIds['MyOS/Document Anchors'];
const DOCUMENT_LINKS_BLUE_ID = myosBlueIds['MyOS/Document Links'];
const MYOS_PARTICIPANTS_ORCHESTRATION_BLUE_ID =
  myosBlueIds['MyOS/MyOS Participants Orchestration'];
const MYOS_SESSION_INTERACTION_BLUE_ID =
  myosBlueIds['MyOS/MyOS Session Interaction'];
const MYOS_WORKER_AGENCY_BLUE_ID = myosBlueIds['MyOS/MyOS Worker Agency'];
const COMPOSITE_TIMELINE_CHANNEL_BLUE_ID =
  conversationBlueIds['Conversation/Composite Timeline Channel'];

const BUILTIN_CHANNEL_SCHEMAS: ReadonlyMap<
  string,
  ZodType<ChannelContract>
> = new Map([
  [
    DOCUMENT_UPDATE_CHANNEL_BLUE_ID,
    documentUpdateChannelSchema as ZodType<ChannelContract>,
  ],
  [
    EMBEDDED_NODE_CHANNEL_BLUE_ID,
    embeddedNodeChannelSchema as ZodType<ChannelContract>,
  ],
  [
    LIFECYCLE_EVENT_CHANNEL_BLUE_ID,
    lifecycleChannelSchema as ZodType<ChannelContract>,
  ],
  [
    TRIGGERED_EVENT_CHANNEL_BLUE_ID,
    triggeredEventChannelSchema as ZodType<ChannelContract>,
  ],
]);

const BUILTIN_MARKER_SCHEMAS: ReadonlyMap<
  string,
  ZodType<MarkerContract>
> = new Map([
  [
    PROCESSING_INITIALIZED_MARKER_BLUE_ID,
    initializationMarkerSchema as ZodType<MarkerContract>,
  ],
  [
    PROCESSING_TERMINATED_MARKER_BLUE_ID,
    processingTerminatedMarkerSchema as ZodType<MarkerContract>,
  ],
  [
    CHANNEL_EVENT_CHECKPOINT_BLUE_ID,
    channelEventCheckpointSchema as ZodType<MarkerContract>,
  ],
  [
    DOCUMENT_ANCHORS_BLUE_ID,
    documentAnchorsMarkerSchema as ZodType<MarkerContract>,
  ],
  [
    DOCUMENT_LINKS_BLUE_ID,
    documentLinksMarkerSchema as ZodType<MarkerContract>,
  ],
  [
    MYOS_PARTICIPANTS_ORCHESTRATION_BLUE_ID,
    myosParticipantsOrchestrationMarkerSchema as ZodType<MarkerContract>,
  ],
  [
    MYOS_SESSION_INTERACTION_BLUE_ID,
    myosSessionInteractionMarkerSchema as ZodType<MarkerContract>,
  ],
  [
    MYOS_WORKER_AGENCY_BLUE_ID,
    myosWorkerAgencyMarkerSchema as ZodType<MarkerContract>,
  ],
]);

export class ContractLoader {
  private readonly handlerRegistration: HandlerRegistrationService;

  constructor(
    private readonly registry: ContractProcessorRegistry,
    private readonly blue: Blue,
  ) {
    this.handlerRegistration = new HandlerRegistrationService(
      this.blue,
      this.registry,
      BUILTIN_CHANNEL_SCHEMAS,
    );
  }

  load(scopeNode: BlueNode, scopePath: string): ContractBundle {
    try {
      const builder = ContractBundle.builder();
      const contractEntries = scopeNode.getContracts();
      if (!contractEntries) {
        return builder.build();
      }

      const scopeContracts = this.buildScopeContractsIndex(contractEntries);

      for (const [key, contractNode] of Object.entries(contractEntries)) {
        if (!contractNode) {
          continue;
        }
        this.processContract(builder, key, contractNode, scopeContracts);
      }

      return builder.build();
    } catch (error) {
      if (
        error instanceof MustUnderstandFailure ||
        error instanceof ProcessorFatalError
      ) {
        throw error;
      }
      const reason =
        (error as Error | undefined)?.message ?? 'Failed to load contracts';
      throw new ProcessorFatalError(
        `Failed to load contracts for scope ${scopePath}: ${reason}`,
        ProcessorErrors.runtimeFatal(
          `Failed to load contracts for scope ${scopePath}`,
          error,
        ),
      );
    }
  }

  private processContract(
    builder: ContractBundleBuilder,
    key: string,
    node: BlueNode,
    scopeContracts: ScopeContractsIndex,
  ): void {
    const blueId = node.getType()?.getBlueId();
    if (!blueId) {
      return;
    }

    if (blueId === PROCESS_EMBEDDED_BLUE_ID) {
      this.handleProcessEmbedded(builder, key, node);
      return;
    }

    const builtinMarkerSchema = BUILTIN_MARKER_SCHEMAS.get(blueId);
    if (builtinMarkerSchema) {
      this.handleMarker(builder, key, node, builtinMarkerSchema, blueId);
      return;
    }

    const derivedMarkerSchema = this.findSchemaMatch(
      BUILTIN_MARKER_SCHEMAS,
      node,
    );
    if (derivedMarkerSchema) {
      this.handleMarker(
        builder,
        key,
        node,
        derivedMarkerSchema.schema,
        derivedMarkerSchema.blueId,
      );
      return;
    }

    const builtinChannelSchema = BUILTIN_CHANNEL_SCHEMAS.get(blueId);
    if (builtinChannelSchema) {
      this.handleChannel(
        builder,
        key,
        node,
        builtinChannelSchema,
        blueId,
        scopeContracts,
      );
      return;
    }

    const derivedChannelSchema = this.findSchemaMatch(
      BUILTIN_CHANNEL_SCHEMAS,
      node,
    );
    if (derivedChannelSchema) {
      this.handleChannel(
        builder,
        key,
        node,
        derivedChannelSchema.schema,
        derivedChannelSchema.blueId,
      );
      return;
    }

    const channelProcessor =
      this.registry.lookupChannel(blueId) ??
      this.findProcessorByTypeChain(node, (id) =>
        this.registry.lookupChannel(id),
      );
    if (channelProcessor) {
      this.handleChannel(
        builder,
        key,
        node,
        channelProcessor.schema as ZodType<ChannelContract>,
        blueId,
        scopeContracts,
      );
      return;
    }

    const handlerProcessor =
      this.registry.lookupHandler(blueId) ??
      this.findProcessorByTypeChain(node, (id) =>
        this.registry.lookupHandler(id),
      );
    if (handlerProcessor) {
      this.handlerRegistration.register({
        builder,
        key,
        node,
        processor: handlerProcessor,
        blueId,
        scopeContracts,
      });
      return;
    }

    const markerProcessor =
      this.registry.lookupMarker(blueId) ??
      this.findProcessorByTypeChain(node, (id) =>
        this.registry.lookupMarker(id),
      );
    if (markerProcessor) {
      this.handleMarker(
        builder,
        key,
        node,
        markerProcessor.schema as ZodType<MarkerContract>,
        blueId,
      );
      return;
    }

    if (isProcessorManagedChannelBlueId(blueId)) {
      throw new ProcessorFatalError(
        'Built-in processor-managed channel is missing schema registration',
        ProcessorErrors.invalidContract(
          blueId,
          'Built-in processor-managed channel is missing schema registration',
          key,
        ),
      );
    }

    throw new MustUnderstandFailure(`Unsupported contract type: ${blueId}`);
  }

  private matchesSchema(node: BlueNode, schema: ZodTypeAny): boolean {
    return this.blue.isTypeOf(node, schema as AnyZodObject, {
      checkSchemaExtensions: true,
    });
  }

  private findSchemaMatch<T>(
    schemas: ReadonlyMap<string, ZodType<T>>,
    node: BlueNode,
  ): { blueId: string; schema: ZodType<T> } | null {
    const nodeType = node.getType();
    if (nodeType) {
      const nodeProvider = this.blue.getNodeProvider();
      const visited = new Set<string>();
      let currentType: BlueNode | null = nodeType;
      while (currentType) {
        const blueId =
          currentType.getBlueId() ?? this.blue.calculateBlueIdSync(currentType);
        if (blueId) {
          if (visited.has(blueId)) {
            break;
          }
          visited.add(blueId);
          const schema = schemas.get(blueId);
          if (schema) {
            return { blueId, schema };
          }
        }
        currentType = this.resolveSuperType(currentType, nodeProvider);
      }
    }
    for (const [blueId, schema] of schemas.entries()) {
      if (this.matchesSchema(node, schema)) {
        return { blueId, schema };
      }
    }
    return null;
  }

  private findProcessorByTypeChain<T>(
    node: BlueNode,
    lookup: (blueId: string) => T | undefined,
  ): T | undefined {
    const nodeType = node.getType();
    if (!nodeType) {
      return undefined;
    }
    const nodeProvider = this.blue.getNodeProvider();
    const visited = new Set<string>();
    let currentType: BlueNode | null = nodeType;
    while (currentType) {
      const blueId =
        currentType.getBlueId() ?? this.blue.calculateBlueIdSync(currentType);
      if (blueId) {
        if (visited.has(blueId)) {
          break;
        }
        visited.add(blueId);
        const processor = lookup(blueId);
        if (processor) {
          return processor;
        }
      }
      currentType = this.resolveSuperType(currentType, nodeProvider);
    }
    return undefined;
  }

  private resolveSuperType(
    typeNode: BlueNode,
    nodeProvider: ReturnType<Blue['getNodeProvider']>,
  ): BlueNode | null {
    const directType = typeNode.getType();
    if (directType) {
      return directType;
    }
    const blueId = typeNode.getBlueId();
    if (!blueId) {
      return null;
    }
    const fetched = nodeProvider.fetchByBlueId(blueId);
    if (!fetched || fetched.length === 0) {
      return null;
    }
    return fetched[0].getType() ?? null;
  }

  private handleProcessEmbedded(
    builder: ContractBundleBuilder,
    key: string,
    node: BlueNode,
  ): void {
    try {
      const embedded = this.blue.nodeToSchemaOutput(
        node,
        processEmbeddedMarkerSchema,
      ) as ProcessEmbeddedMarker;
      builder.setEmbedded(embedded);
    } catch (error) {
      if (isZodError(error)) {
        throw new ProcessorFatalError(
          'Failed to parse ProcessEmbedded marker',
          ProcessorErrors.invalidContract(
            PROCESS_EMBEDDED_BLUE_ID,
            'Failed to parse ProcessEmbedded marker',
            key,
            error,
          ),
        );
      }
      throw new ProcessorFatalError(
        (error as Error | undefined)?.message ??
          'Failed to register ProcessEmbedded marker',
        ProcessorErrors.illegalState(
          (error as Error | undefined)?.message ??
            'Failed to register ProcessEmbedded marker',
        ),
      );
    }
  }

  private handleChannel(
    builder: ContractBundleBuilder,
    key: string,
    node: BlueNode,
    schema: ZodType<ChannelContract>,
    blueId: string,
    scopeContracts: ScopeContractsIndex,
  ): void {
    try {
      const contract = this.blue.nodeToSchemaOutput(
        node,
        schema,
      ) as ChannelContract;
      if (blueId === COMPOSITE_TIMELINE_CHANNEL_BLUE_ID) {
        this.validateCompositeChannel(
          key,
          contract as CompositeTimelineChannel,
          scopeContracts,
          blueId,
        );
      }
      builder.addChannel(key, contract, blueId);
    } catch (error) {
      if (
        error instanceof ProcessorFatalError ||
        error instanceof MustUnderstandFailure
      ) {
        throw error;
      }
      if (isZodError(error)) {
        throw new ProcessorFatalError(
          'Failed to parse channel contract',
          ProcessorErrors.invalidContract(
            blueId,
            'Failed to parse channel contract',
            key,
            error,
          ),
        );
      }
      const reason =
        (error as Error | undefined)?.message ??
        'Failed to register channel contract';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
  }

  private validateCompositeChannel(
    compositeKey: string,
    contract: CompositeTimelineChannel,
    scopeContracts: ScopeContractsIndex,
    blueId: string,
  ): void {
    const childKeys = contract.channels ?? [];
    if (childKeys.length === 0) {
      return;
    }

    for (const childKey of childKeys) {
      const childEntry = scopeContracts.get(childKey);
      if (!childEntry) {
        throw new ProcessorFatalError(
          `Composite channel ${compositeKey} references unknown channel '${childKey}'`,
          ProcessorErrors.invalidContract(
            blueId,
            `Channel '${childKey}' is not declared in this scope`,
            `/contracts/${childKey}`,
          ),
        );
      }

      if (!this.isRegisteredChannel(childEntry.nodeTypeBlueId)) {
        throw new ProcessorFatalError(
          `Contract '${childKey}' is not a channel`,
          ProcessorErrors.invalidContract(
            childEntry.nodeTypeBlueId,
            `Contract '${childKey}' is not a channel`,
            `/contracts/${childKey}`,
          ),
        );
      }
    }

    assertCompositeChannelIsAcyclic({
      compositeKey,
      contract,
      scopeContracts,
      blueId,
      blue: this.blue,
      compositeChannelBlueId: COMPOSITE_TIMELINE_CHANNEL_BLUE_ID,
    });
  }

  private isRegisteredChannel(nodeTypeBlueId: string): boolean {
    if (BUILTIN_CHANNEL_SCHEMAS.has(nodeTypeBlueId)) {
      return true;
    }
    return this.registry.lookupChannel(nodeTypeBlueId) != null;
  }

  private handleMarker(
    builder: ContractBundleBuilder,
    key: string,
    node: BlueNode,
    schema: ZodType<MarkerContract>,
    blueId: string,
  ): void {
    try {
      const marker = this.blue.nodeToSchemaOutput(
        node,
        schema,
      ) as MarkerContract;
      builder.addMarker(key, marker, blueId);
    } catch (error) {
      if (isZodError(error)) {
        throw new ProcessorFatalError(
          'Failed to parse marker contract',
          ProcessorErrors.invalidContract(
            blueId,
            'Failed to parse marker contract',
            key,
            error,
          ),
        );
      }
      const reason =
        (error as Error | undefined)?.message ??
        'Failed to register marker contract';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
  }

  private buildScopeContractsIndex(
    entries: Record<string, BlueNode | undefined>,
  ): ScopeContractsIndex {
    const map = new Map<string, ScopeContractEntry>();
    for (const [entryKey, entryNode] of Object.entries(entries)) {
      if (!entryNode) {
        continue;
      }
      const entryBlueId = entryNode.getType()?.getBlueId();
      if (typeof entryBlueId === 'string' && entryBlueId.trim().length > 0) {
        map.set(entryKey, { node: entryNode, nodeTypeBlueId: entryBlueId });
      }
    }
    return map;
  }
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
