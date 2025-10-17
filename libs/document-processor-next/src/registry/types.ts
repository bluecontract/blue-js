import type { ZodType } from 'zod';

import type { Node } from '../types/index.js';

export type ContractProcessorKind = 'handler' | 'channel' | 'marker';

export interface ContractProcessor<TContract> {
  readonly kind: ContractProcessorKind;
  readonly blueIds: readonly string[];
  readonly schema: ZodType<TContract>;
}

export interface ProcessorExecutionContext {
  // Placeholder for execution context to be ported from Java runtime.
  readonly scopePath: string;
}

export interface HandlerProcessor<TContract> extends ContractProcessor<TContract> {
  readonly kind: 'handler';
  execute(contract: TContract, context: ProcessorExecutionContext): void | Promise<void>;
}

export interface ChannelEvaluationContext {
  readonly scopePath: string;
  /**
   * Mutable clone of the inbound event. Channel processors may adapt it in-place.
   */
  readonly event: Node | null;
  /**
   * Lazily materialised object view of {@link event}. Optional for processors that require DTOs.
   */
  readonly eventObject?: unknown;
  readonly markers: ReadonlyMap<string, unknown>;
}

export interface ChannelProcessor<TContract> extends ContractProcessor<TContract> {
  readonly kind: 'channel';
  matches(contract: TContract, context: ChannelEvaluationContext): boolean | Promise<boolean>;
  eventId?(contract: TContract, context: ChannelEvaluationContext): string | null | undefined | Promise<string | null | undefined>;
}

export interface MarkerProcessor<TContract> extends ContractProcessor<TContract> {
  readonly kind: 'marker';
}

export type AnyContractProcessor =
  | HandlerProcessor<unknown>
  | ChannelProcessor<unknown>
  | MarkerProcessor<unknown>;
