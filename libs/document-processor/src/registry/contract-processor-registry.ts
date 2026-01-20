import type { Blue, BlueNode } from '@blue-labs/language';

import {
  AnyContractProcessor,
  ChannelProcessor,
  ContractProcessor,
  HandlerProcessor,
  MarkerProcessor,
} from './types.js';

function assertBlueIds(processor: ContractProcessor<unknown>): void {
  if (!Array.isArray(processor.blueIds) || processor.blueIds.length === 0) {
    throw new Error('Contract processors must declare at least one BlueId');
  }
  for (const blueId of processor.blueIds) {
    if (typeof blueId !== 'string' || blueId.trim().length === 0) {
      throw new Error('Contract processor BlueIds must be non-empty strings');
    }
  }
}

function registerBlueIds<T extends ContractProcessor<unknown>>(
  source: T,
  target: Map<string, T>,
): void {
  assertBlueIds(source);
  for (const blueId of source.blueIds) {
    target.set(blueId, source);
  }
}

export class ContractProcessorRegistry {
  private readonly processorsByBlueId = new Map<string, AnyContractProcessor>();
  private readonly handlerProcessors = new Map<
    string,
    HandlerProcessor<unknown>
  >();
  private readonly channelProcessors = new Map<
    string,
    ChannelProcessor<unknown>
  >();
  private readonly markerProcessors = new Map<
    string,
    MarkerProcessor<unknown>
  >();

  registerHandler<T>(processor: HandlerProcessor<T>): void {
    registerBlueIds(processor, this.handlerProcessors);
    this.registerProcessorMap(processor);
  }

  registerChannel<T>(processor: ChannelProcessor<T>): void {
    registerBlueIds(processor, this.channelProcessors);
    this.registerProcessorMap(processor);
  }

  registerMarker<T>(processor: MarkerProcessor<T>): void {
    registerBlueIds(processor, this.markerProcessors);
    this.registerProcessorMap(processor);
  }

  register(processor: AnyContractProcessor): void {
    switch (processor.kind) {
      case 'handler':
        this.registerHandler(processor);
        break;
      case 'channel':
        this.registerChannel(processor);
        break;
      case 'marker':
        this.registerMarker(processor);
        break;
      default:
        throw new Error(
          `Unsupported processor kind: ${String(
            (processor as ContractProcessor<unknown>).kind,
          )}`,
        );
    }
  }

  lookupHandler(blueId: string): HandlerProcessor<unknown> | undefined {
    return this.handlerProcessors.get(blueId);
  }

  lookupHandlerForNode(
    blue: Blue,
    node: BlueNode,
  ): HandlerProcessor<unknown> | undefined {
    return this.lookupProcessorForNode(blue, node, this.handlerProcessors);
  }

  lookupChannel(blueId: string): ChannelProcessor<unknown> | undefined {
    return this.channelProcessors.get(blueId);
  }

  lookupChannelForNode(
    blue: Blue,
    node: BlueNode,
  ): ChannelProcessor<unknown> | undefined {
    return this.lookupProcessorForNode(blue, node, this.channelProcessors);
  }

  lookupMarker(blueId: string): MarkerProcessor<unknown> | undefined {
    return this.markerProcessors.get(blueId);
  }

  lookupMarkerForNode(
    blue: Blue,
    node: BlueNode,
  ): MarkerProcessor<unknown> | undefined {
    return this.lookupProcessorForNode(blue, node, this.markerProcessors);
  }

  processors(): Map<string, AnyContractProcessor> {
    return new Map(this.processorsByBlueId);
  }

  private registerProcessorMap(processor: AnyContractProcessor): void {
    registerBlueIds(processor, this.processorsByBlueId);
  }

  private lookupProcessorForNode<T extends AnyContractProcessor>(
    blue: Blue,
    node: BlueNode,
    processors: Map<string, T>,
  ): T | undefined {
    const blueId = node.getType()?.getBlueId();
    if (blueId) {
      const exact = processors.get(blueId);
      if (exact) {
        return exact;
      }
    }

    for (const processor of this.uniqueProcessors(processors)) {
      if (this.matchesProcessorType(blue, node, processor.blueIds)) {
        return processor;
      }
    }

    return undefined;
  }

  private *uniqueProcessors<T extends AnyContractProcessor>(
    processors: Map<string, T>,
  ): Iterable<T> {
    const seen = new Set<T>();
    for (const processor of processors.values()) {
      if (seen.has(processor)) {
        continue;
      }
      seen.add(processor);
      yield processor;
    }
  }

  private matchesProcessorType(
    blue: Blue,
    node: BlueNode,
    blueIds: readonly string[],
  ): boolean {
    for (const blueId of blueIds) {
      if (blue.isTypeOfBlueId(node, blueId)) {
        return true;
      }
    }
    return false;
  }
}
