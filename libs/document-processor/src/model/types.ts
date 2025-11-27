import type { ChannelContractBase } from './shared/channel-contract-base.js';
import type { HandlerContractBase } from './shared/handler-contract-base.js';
import type { MarkerContractBase } from './shared/marker-contract-base.js';
import type {
  ChannelEventCheckpoint,
  InitializationMarker,
  ProcessEmbeddedMarker,
  ProcessingTerminatedMarker,
  DocumentAnchorsMarker,
  DocumentLinksMarker,
} from './markers/index.js';
import type {
  DocumentUpdateChannel,
  EmbeddedNodeChannel,
  LifecycleChannel,
  TriggeredEventChannel,
  TimelineChannel,
  MyOSTimelineChannel,
} from './channels/index.js';
import type { SequentialWorkflow } from './handlers/index.js';

export type GenericHandlerContract = HandlerContractBase &
  Record<string, unknown>;

export type GenericMarkerContract = MarkerContractBase &
  Record<string, unknown>;

export type GenericChannelContract = ChannelContractBase &
  Record<string, unknown>;

export type MarkerContract =
  | ProcessEmbeddedMarker
  | InitializationMarker
  | ProcessingTerminatedMarker
  | ChannelEventCheckpoint
  | DocumentAnchorsMarker
  | DocumentLinksMarker
  | GenericMarkerContract;

export type ChannelContract =
  | DocumentUpdateChannel
  | EmbeddedNodeChannel
  | LifecycleChannel
  | TriggeredEventChannel
  | TimelineChannel
  | MyOSTimelineChannel
  | GenericChannelContract;

export type HandlerContract = SequentialWorkflow | GenericHandlerContract;
