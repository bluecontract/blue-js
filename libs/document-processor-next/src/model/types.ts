import type { ContractBase } from './shared/contract-base.js';
import type { ChannelContractBase } from './shared/channel-contract-base.js';
import type { HandlerContractBase } from './shared/handler-contract-base.js';
import type { MarkerContractBase } from './shared/marker-contract-base.js';
import type {
  ChannelEventCheckpoint,
  InitializationMarker,
  ProcessEmbeddedMarker,
  ProcessingFailureMarker,
  ProcessingTerminatedMarker,
} from './markers/index.js';
import type {
  DocumentUpdateChannel,
  EmbeddedNodeChannel,
  LifecycleChannel,
  TriggeredEventChannel,
} from './channels/index.js';

export type BaseContract = ContractBase;

export type GenericHandlerContract = HandlerContractBase & Record<string, unknown>;

export type GenericMarkerContract = MarkerContractBase & Record<string, unknown>;

export type GenericChannelContract = ChannelContractBase & Record<string, unknown>;

export type MarkerContract =
  | ProcessEmbeddedMarker
  | InitializationMarker
  | ProcessingFailureMarker
  | ProcessingTerminatedMarker
  | ChannelEventCheckpoint
  | GenericMarkerContract;

export type ChannelContract =
  | DocumentUpdateChannel
  | EmbeddedNodeChannel
  | LifecycleChannel
  | TriggeredEventChannel
  | GenericChannelContract;

export type HandlerContract = GenericHandlerContract;
