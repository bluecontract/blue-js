import { Blue } from '@blue-labs/language';
import { ZodError, ZodType } from 'zod';

import {
  documentUpdateChannelSchema,
  embeddedNodeChannelSchema,
  lifecycleChannelSchema,
  triggeredEventChannelSchema,
  processEmbeddedMarkerSchema,
  initializationMarkerSchema,
  processingFailureMarkerSchema,
  processingTerminatedMarkerSchema,
  channelEventCheckpointSchema,
} from '../model/index.js';
import { isProcessorManagedChannelBlueId } from '../constants/processor-contract-constants.js';
import type { Node } from '../types/index.js';
import { ContractBundle, ContractBundleBuilder } from './contract-bundle.js';
import { ContractProcessorRegistry } from '../registry/contract-processor-registry.js';
import type {
  ChannelContract,
  HandlerContract,
  MarkerContract,
  ProcessEmbeddedMarker,
} from '../model/index.js';
import { ProcessorErrors } from '../types/errors.js';
import { MustUnderstandFailure } from './must-understand-failure.js';
import { ProcessorFatalError } from './processor-fatal-error.js';

const BUILTIN_CHANNEL_SCHEMAS: ReadonlyMap<string, ZodType<ChannelContract>> =
  new Map([
    ['DocumentUpdateChannel', documentUpdateChannelSchema as ZodType<ChannelContract>],
    ['EmbeddedNodeChannel', embeddedNodeChannelSchema as ZodType<ChannelContract>],
    ['LifecycleChannel', lifecycleChannelSchema as ZodType<ChannelContract>],
    ['TriggeredEventChannel', triggeredEventChannelSchema as ZodType<ChannelContract>],
  ]);

const BUILTIN_MARKER_SCHEMAS: ReadonlyMap<string, ZodType<MarkerContract>> =
  new Map([
    ['InitializationMarker', initializationMarkerSchema as ZodType<MarkerContract>],
    ['ProcessingFailureMarker', processingFailureMarkerSchema as ZodType<MarkerContract>],
    ['ProcessingTerminatedMarker', processingTerminatedMarkerSchema as ZodType<MarkerContract>],
    ['ChannelEventCheckpoint', channelEventCheckpointSchema as ZodType<MarkerContract>],
  ]);

export class ContractLoader {
  constructor(
    private readonly registry: ContractProcessorRegistry,
    private readonly blue: Blue,
  ) {}

  load(scopeNode: Node, scopePath: string): ContractBundle {
    try {
      const builder = ContractBundle.builder();
      const contractsNode = scopeNode.getProperties()?.contracts;
      const contractEntries = contractsNode?.getProperties();
      if (!contractEntries) {
        return builder.build();
      }

      for (const [key, contractNode] of Object.entries(contractEntries)) {
        if (!contractNode) {
          continue;
        }
        this.processContract(builder, key, contractNode);
      }

      return builder.build();
    } catch (error) {
      if (error instanceof MustUnderstandFailure || error instanceof ProcessorFatalError) {
        throw error;
      }
      const reason =
        (error as Error | undefined)?.message ??
        'Failed to load contracts';
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
    node: Node,
  ): void {
    const blueId = node.getType()?.getBlueId();
    if (!blueId) {
      return;
    }

    if (blueId === 'ProcessEmbedded') {
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
      this.handleChannel(builder, key, node, channelProcessor.schema as ZodType<ChannelContract>, blueId);
      return;
    }

    const handlerProcessor = this.registry.lookupHandler(blueId);
    if (handlerProcessor) {
      this.handleHandler(builder, key, node, handlerProcessor.schema as ZodType<HandlerContract>, blueId);
      return;
    }

    const markerProcessor = this.registry.lookupMarker(blueId);
    if (markerProcessor) {
      this.handleMarker(builder, key, node, markerProcessor.schema as ZodType<MarkerContract>, blueId);
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
    node: Node,
  ): void {
    try {
      const embedded = this.convert(node, processEmbeddedMarkerSchema) as ProcessEmbeddedMarker;
      builder.setEmbedded({ ...embedded, key });
    } catch (error) {
      if (isZodError(error)) {
        throw new ProcessorFatalError(
          'Failed to parse ProcessEmbedded marker',
          ProcessorErrors.invalidContract('ProcessEmbedded', 'Failed to parse ProcessEmbedded marker', key, error),
        );
      }
      throw new ProcessorFatalError(
        (error as Error | undefined)?.message ?? 'Failed to register ProcessEmbedded marker',
        ProcessorErrors.illegalState(
          (error as Error | undefined)?.message ?? 'Failed to register ProcessEmbedded marker',
        ),
      );
    }
  }

  private handleChannel(
    builder: ContractBundleBuilder,
    key: string,
    node: Node,
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
          ProcessorErrors.invalidContract(blueId, 'Failed to parse channel contract', key, error),
        );
      }
      const reason =
        (error as Error | undefined)?.message ?? 'Failed to register channel contract';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
  }

  private handleHandler(
    builder: ContractBundleBuilder,
    key: string,
    node: Node,
    schema: ZodType<HandlerContract>,
    blueId: string,
  ): void {
    try {
      const contract = this.convert(node, schema) as HandlerContract;
      const channelKey = contract.channelKey ?? contract.channel;
      if (!channelKey) {
        throw new ProcessorFatalError(
          `Handler ${key} must declare channel`,
          ProcessorErrors.illegalState(`Handler ${key} must declare channel`),
        );
      }
      builder.addHandler(key, { ...contract, key }, blueId);
    } catch (error) {
      if (isZodError(error)) {
        throw new ProcessorFatalError(
          'Failed to parse handler contract',
          ProcessorErrors.invalidContract(blueId, 'Failed to parse handler contract', key, error),
        );
      }
      const reason =
        (error as Error | undefined)?.message ?? 'Failed to register handler contract';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
  }

  private handleMarker(
    builder: ContractBundleBuilder,
    key: string,
    node: Node,
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
          ProcessorErrors.invalidContract(blueId, 'Failed to parse marker contract', key, error),
        );
      }
      const reason =
        (error as Error | undefined)?.message ?? 'Failed to register marker contract';
      throw new ProcessorFatalError(
        reason,
        ProcessorErrors.illegalState(reason),
      );
    }
  }

  private convert<T>(node: Node, schema: ZodType<T>): T {
    return this.blue.nodeToSchemaOutput(node, schema);
  }
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
