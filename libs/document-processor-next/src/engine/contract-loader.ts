import { Blue, BlueNode } from '@blue-labs/language';
import { blueIds } from '@blue-repository/core';
import { ZodError, ZodType } from 'zod';

import {
  documentUpdateChannelSchema,
  embeddedNodeChannelSchema,
  lifecycleChannelSchema,
  triggeredEventChannelSchema,
  processEmbeddedMarkerSchema,
  initializationMarkerSchema,
  processingTerminatedMarkerSchema,
  channelEventCheckpointSchema,
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
  MarkerContract,
  ProcessEmbeddedMarker,
} from '../model/index.js';
import { ProcessorErrors } from '../types/errors.js';
import { MustUnderstandFailure } from './must-understand-failure.js';
import { ProcessorFatalError } from './processor-fatal-error.js';

const DOCUMENT_UPDATE_CHANNEL_BLUE_ID = blueIds['Document Update Channel'];
const EMBEDDED_NODE_CHANNEL_BLUE_ID = blueIds['Embedded Node Channel'];
const LIFECYCLE_EVENT_CHANNEL_BLUE_ID = blueIds['Lifecycle Event Channel'];
const TRIGGERED_EVENT_CHANNEL_BLUE_ID = blueIds['Triggered Event Channel'];
const PROCESS_EMBEDDED_BLUE_ID = blueIds['Process Embedded'];
const PROCESSING_INITIALIZED_MARKER_BLUE_ID =
  blueIds['Processing Initialized Marker'];
const PROCESSING_TERMINATED_MARKER_BLUE_ID =
  blueIds['Processing Terminated Marker'];
const CHANNEL_EVENT_CHECKPOINT_BLUE_ID = blueIds['Channel Event Checkpoint'];

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

    const builtinChannelSchema = BUILTIN_CHANNEL_SCHEMAS.get(blueId);
    if (builtinChannelSchema) {
      this.handleChannel(builder, key, node, builtinChannelSchema, blueId);
      return;
    }

    const channelProcessor = this.registry.lookupChannel(blueId);
    if (channelProcessor) {
      this.handleChannel(
        builder,
        key,
        node,
        channelProcessor.schema as ZodType<ChannelContract>,
        blueId,
      );
      return;
    }

    const handlerProcessor = this.registry.lookupHandler(blueId);
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

    const markerProcessor = this.registry.lookupMarker(blueId);
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

  private handleProcessEmbedded(
    builder: ContractBundleBuilder,
    key: string,
    node: BlueNode,
  ): void {
    try {
      const embedded = this.convert(
        node,
        processEmbeddedMarkerSchema,
      ) as ProcessEmbeddedMarker;
      builder.setEmbedded({ ...embedded, key });
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
  ): void {
    try {
      const contract = this.convert(node, schema) as ChannelContract;
      builder.addChannel(key, { ...contract, key }, blueId);
    } catch (error) {
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

  private handleMarker(
    builder: ContractBundleBuilder,
    key: string,
    node: BlueNode,
    schema: ZodType<MarkerContract>,
    blueId: string,
  ): void {
    try {
      const marker = this.convert(node, schema) as MarkerContract;
      builder.addMarker(key, { ...marker, key }, blueId);
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

  private convert<T>(node: BlueNode, schema: ZodType<T>): T {
    return this.blue.nodeToSchemaOutput(node, schema);
  }
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
