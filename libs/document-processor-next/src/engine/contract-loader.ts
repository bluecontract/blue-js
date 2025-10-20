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
import { err, ok, type Result } from '../types/result.js';
import {
  ProcessorErrors,
  type ProcessorError,
} from '../types/errors.js';

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

  load(scopeNode: Node, scopePath: string): Result<ContractBundle, ProcessorError> {
    try {
      const builder = ContractBundle.builder();
      const contractsNode = scopeNode.getProperties()?.contracts;
      const contractEntries = contractsNode?.getProperties();
      if (!contractEntries) {
        return ok(builder.build());
      }

      for (const [key, contractNode] of Object.entries(contractEntries)) {
        if (!contractNode) {
          continue;
        }
        const result = this.processContract(builder, key, contractNode);
        if (!result.ok) {
          return result;
        }
      }

      return ok(builder.build());
    } catch (error) {
      return err(
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
  ): Result<void, ProcessorError> {
    const blueId = node.getType()?.getBlueId();
    if (!blueId) {
      return ok(undefined);
    }

    if (blueId === 'ProcessEmbedded') {
      return this.handleProcessEmbedded(builder, key, node);
    }

    const builtinMarkerSchema = BUILTIN_MARKER_SCHEMAS.get(blueId);
    if (builtinMarkerSchema) {
      return this.handleMarker(builder, key, node, builtinMarkerSchema, blueId);
    }

    const builtinChannelSchema = BUILTIN_CHANNEL_SCHEMAS.get(blueId);
    if (builtinChannelSchema) {
      return this.handleChannel(builder, key, node, builtinChannelSchema, blueId);
    }

    const channelProcessor = this.registry.lookupChannel(blueId);
    if (channelProcessor) {
      return this.handleChannel(builder, key, node, channelProcessor.schema as ZodType<ChannelContract>, blueId);
    }

    const handlerProcessor = this.registry.lookupHandler(blueId);
    if (handlerProcessor) {
      return this.handleHandler(builder, key, node, handlerProcessor.schema as ZodType<HandlerContract>, blueId);
    }

    const markerProcessor = this.registry.lookupMarker(blueId);
    if (markerProcessor) {
      return this.handleMarker(builder, key, node, markerProcessor.schema as ZodType<MarkerContract>, blueId);
    }

    if (isProcessorManagedChannelBlueId(blueId)) {
      return err(
        ProcessorErrors.invalidContract(
          blueId,
          'Built-in processor-managed channel is missing schema registration',
          key,
        ),
      );
    }

    return err(
      ProcessorErrors.capabilityFailure(
        'ContractProcessor',
        `Unsupported contract type: ${blueId}`,
      ),
    );
  }

  private handleProcessEmbedded(
    builder: ContractBundleBuilder,
    key: string,
    node: Node,
  ): Result<void, ProcessorError> {
    try {
      const embedded = this.convert(node, processEmbeddedMarkerSchema) as ProcessEmbeddedMarker;
      builder.setEmbedded({ ...embedded, key });
      return ok(undefined);
    } catch (error) {
      if (isZodError(error)) {
        return err(
          ProcessorErrors.invalidContract('ProcessEmbedded', 'Failed to parse ProcessEmbedded marker', key, error),
        );
      }
      return err(ProcessorErrors.illegalState((error as Error).message ?? 'Failed to register ProcessEmbedded marker'));
    }
  }

  private handleChannel(
    builder: ContractBundleBuilder,
    key: string,
    node: Node,
    schema: ZodType<ChannelContract>,
    blueId: string,
  ): Result<void, ProcessorError> {
    try {
      const contract = this.convert(node, schema) as ChannelContract;
      builder.addChannel(key, { ...contract, key }, blueId);
      return ok(undefined);
    } catch (error) {
      if (isZodError(error)) {
        return err(
          ProcessorErrors.invalidContract(blueId, 'Failed to parse channel contract', key, error),
        );
      }
      return err(ProcessorErrors.illegalState((error as Error).message ?? 'Failed to register channel contract'));
    }
  }

  private handleHandler(
    builder: ContractBundleBuilder,
    key: string,
    node: Node,
    schema: ZodType<HandlerContract>,
    blueId: string,
  ): Result<void, ProcessorError> {
    try {
      const contract = this.convert(node, schema) as HandlerContract;
      const channelKey = contract.channelKey ?? contract.channel;
      if (!channelKey) {
        return err(
          ProcessorErrors.illegalState(`Handler ${key} must declare channel`),
        );
      }
      builder.addHandler(key, { ...contract, key }, blueId);
      return ok(undefined);
    } catch (error) {
      if (isZodError(error)) {
        return err(
          ProcessorErrors.invalidContract(blueId, 'Failed to parse handler contract', key, error),
        );
      }
      return err(ProcessorErrors.illegalState((error as Error).message ?? 'Failed to register handler contract'));
    }
  }

  private handleMarker(
    builder: ContractBundleBuilder,
    key: string,
    node: Node,
    schema: ZodType<MarkerContract>,
    blueId: string,
  ): Result<void, ProcessorError> {
    try {
      const marker = this.convert(node, schema) as MarkerContract;
      builder.addMarker(key, { ...marker, key }, blueId);
      return ok(undefined);
    } catch (error) {
      if (isZodError(error)) {
        return err(
          ProcessorErrors.invalidContract(blueId, 'Failed to parse marker contract', key, error),
        );
      }
      return err(ProcessorErrors.illegalState((error as Error).message ?? 'Failed to register marker contract'));
    }
  }

  private convert<T>(node: Node, schema: ZodType<T>): T {
    return this.blue.nodeToSchemaOutput(node, schema);
  }
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
