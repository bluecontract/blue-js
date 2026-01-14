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
  MyOSParticipantsOrchestrationMarker,
  MyOSSessionInteractionMarker,
  MyOSWorkerAgencyMarker,
} from './markers/index.js';
import type {
  DocumentUpdateChannel,
  EmbeddedNodeChannel,
  LifecycleChannel,
  TriggeredEventChannel,
  TimelineChannel,
  MyOSTimelineChannel,
  CompositeTimelineChannel,
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
  | MyOSParticipantsOrchestrationMarker
  | MyOSSessionInteractionMarker
  | MyOSWorkerAgencyMarker
  | GenericMarkerContract;

export type ChannelContract =
  | DocumentUpdateChannel
  | EmbeddedNodeChannel
  | LifecycleChannel
  | TriggeredEventChannel
  | TimelineChannel
  | MyOSTimelineChannel
  | CompositeTimelineChannel
  | GenericChannelContract;

export type HandlerContract = SequentialWorkflow | GenericHandlerContract;
