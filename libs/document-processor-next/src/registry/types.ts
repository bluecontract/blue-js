import type { ZodType } from 'zod';
import { BlueNode } from '@blue-labs/language';
import type { Blue } from '@blue-labs/language';

import type { JsonPatch } from '../model/shared/json-patch.js';
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
  event(): BlueNode | null;
  applyPatch(patch: JsonPatch): void;
  emitEvent(emission: BlueNode): void;
  consumeGas(units: number): void;
  throwFatal(reason: string): never;
  resolvePointer(relativePointer: string): string;
  documentAt(absolutePointer: string): BlueNode | null;
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
  readonly event: BlueNode | null;
  readonly markers: ReadonlyMap<string, MarkerContract>;
}

export interface ChannelProcessor<TContract>
  extends ContractProcessor<TContract> {
  readonly kind: 'channel';
  matches(
    contract: TContract,
    context: ChannelEvaluationContext
  ): boolean | Promise<boolean>;
  /**
   * Optional: Provide a channelized event for handlers without mutating the inbound event.
   * When provided, the engine will deliver this node to handlers while computing
   * checkpoint signatures and storage from the original external event.
   */
  channelize?(
    contract: TContract,
    context: ChannelEvaluationContext
  ): BlueNode | null | undefined;
}

export interface MarkerProcessor<TContract>
  extends ContractProcessor<TContract> {
  readonly kind: 'marker';
}

export type AnyContractProcessor =
  | HandlerProcessor<unknown>
  | ChannelProcessor<unknown>
  | MarkerProcessor<unknown>;
