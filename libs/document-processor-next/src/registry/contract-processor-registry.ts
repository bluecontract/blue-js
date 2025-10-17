import {
  AnyContractProcessor,
  ChannelProcessor,
  ContractProcessor,
  ContractProcessorKind,
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
  private readonly handlerProcessors = new Map<string, HandlerProcessor<unknown>>();
  private readonly channelProcessors = new Map<string, ChannelProcessor<unknown>>();
  private readonly markerProcessors = new Map<string, MarkerProcessor<unknown>>();

  registerHandler<T>(processor: HandlerProcessor<T>): void {
    registerBlueIds(processor, this.handlerProcessors as Map<string, HandlerProcessor<unknown>>);
    this.registerProcessorMap(processor);
  }

  registerChannel<T>(processor: ChannelProcessor<T>): void {
    registerBlueIds(processor, this.channelProcessors as Map<string, ChannelProcessor<unknown>>);
    this.registerProcessorMap(processor);
  }

  registerMarker<T>(processor: MarkerProcessor<T>): void {
    registerBlueIds(processor, this.markerProcessors as Map<string, MarkerProcessor<unknown>>);
    this.registerProcessorMap(processor);
  }

  register(processor: AnyContractProcessor): void {
    switch (processor.kind as ContractProcessorKind) {
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
        throw new Error(`Unsupported processor kind: ${String((processor as ContractProcessor<unknown>).kind)}`);
    }
  }

  lookupHandler(blueId: string): HandlerProcessor<unknown> | undefined {
    return this.handlerProcessors.get(blueId);
  }

  lookupChannel(blueId: string): ChannelProcessor<unknown> | undefined {
    return this.channelProcessors.get(blueId);
  }

  lookupMarker(blueId: string): MarkerProcessor<unknown> | undefined {
    return this.markerProcessors.get(blueId);
  }

  processors(): Map<string, AnyContractProcessor> {
    return new Map(this.processorsByBlueId);
  }

  private registerProcessorMap(processor: AnyContractProcessor): void {
    registerBlueIds(processor, this.processorsByBlueId as Map<string, AnyContractProcessor>);
  }
}
