import {
  ProcessEmbeddedProcessor,
  EmbeddedNodeChannelProcessor,
  DocumentUpdateChannelProcessor,
  TimelineChannelProcessor,
  MyOSTimelineChannelProcessor,
  MyOSAgentChannelProcessor,
  CompositeTimelineChannelProcessor,
  OperationProcessor,
  SequentialWorkflowProcessor,
  SequentialWorkflowOperationProcessor,
  LifecycleEventChannelProcessor,
  InitializedMarkerProcessor,
} from './processors';
import { ContractProcessor } from './types';

export const defaultProcessors: ContractProcessor[] = [
  new ProcessEmbeddedProcessor(),

  // channels
  new EmbeddedNodeChannelProcessor(),
  new DocumentUpdateChannelProcessor(),
  new TimelineChannelProcessor(),
  new MyOSTimelineChannelProcessor(),
  new MyOSAgentChannelProcessor(),
  new CompositeTimelineChannelProcessor(),
  new LifecycleEventChannelProcessor(),
  new OperationProcessor(),

  // sequential workflows
  new SequentialWorkflowProcessor(),
  new SequentialWorkflowOperationProcessor(),

  // markers
  new InitializedMarkerProcessor(),
];
