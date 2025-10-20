import type { ZodType } from 'zod';
import type { Blue } from '@blue-labs/language';

import type { JsonPatch } from '../model/shared/json-patch.js';
import type { Node } from '../types/index.js';
import type { MarkerContract } from '../model/index.js';

export type ContractProcessorKind = 'handler' | 'channel' | 'marker';

export interface ContractProcessor<TContract> {
  readonly kind: ContractProcessorKind;
  readonly blueIds: readonly string[];
  readonly schema: ZodType<TContract>;
}

export interface ContractProcessorContext {
  readonly scopePath: string;
  readonly blue: Blue;
  event(): Node | null;
  applyPatch(patch: JsonPatch): void;
  emitEvent(emission: Node): void;
  consumeGas(units: number): void;
  throwFatal(reason: string): never;
  resolvePointer(relativePointer: string): string;
  documentAt(absolutePointer: string): Node | null;
  documentContains(absolutePointer: string): boolean;
  terminateGracefully(reason: string | null): void;
  terminateFatally(reason: string | null): void;
}

export interface HandlerProcessor<TContract>
  extends ContractProcessor<TContract> {
  readonly kind: 'handler';
  execute(
    contract: TContract,
    context: ContractProcessorContext
  ): void | Promise<void>;
}

export interface ChannelEvaluationContext {
  readonly scopePath: string;
  readonly blue: Blue;
  /**
   * Mutable clone of the inbound event. Channel processors may adapt it in-place.
   */
  readonly event: Node | null;
  /**
   * Lazily materialised object view of {@link event}. Optional for processors that require DTOs.
   */
  readonly eventObject: unknown;
  readonly markers: ReadonlyMap<string, MarkerContract>;
}

export interface ChannelProcessor<TContract>
  extends ContractProcessor<TContract> {
  readonly kind: 'channel';
  matches(
    contract: TContract,
    context: ChannelEvaluationContext
  ): boolean | Promise<boolean>;
  eventId?(
    contract: TContract,
    context: ChannelEvaluationContext
  ): string | null | undefined | Promise<string | null | undefined>;
}

export interface MarkerProcessor<TContract>
  extends ContractProcessor<TContract> {
  readonly kind: 'marker';
}

export type AnyContractProcessor =
  | HandlerProcessor<unknown>
  | ChannelProcessor<unknown>
  | MarkerProcessor<unknown>;
