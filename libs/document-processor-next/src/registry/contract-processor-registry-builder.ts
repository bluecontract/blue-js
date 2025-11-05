import { ContractProcessorRegistry } from './contract-processor-registry.js';
import { MyOSTimelineChannelProcessor } from './processors/myos-timeline-channel-processor.js';
import { TimelineChannelProcessor } from './processors/timeline-channel-processor.js';
import { SequentialWorkflowHandlerProcessor } from './processors/sequential-workflow-processor.js';
import { OperationMarkerProcessor } from './processors/operation-marker-processor.js';
import { SequentialWorkflowOperationProcessor } from './processors/sequential-workflow-operation-processor.js';
import { AnyContractProcessor } from './types.js';

export class ContractProcessorRegistryBuilder {
  private constructor(private readonly registry: ContractProcessorRegistry) {}

  static create(): ContractProcessorRegistryBuilder {
    return new ContractProcessorRegistryBuilder(
      new ContractProcessorRegistry(),
    );
  }

  registerDefaults(): ContractProcessorRegistryBuilder {
    this.registry.register(new MyOSTimelineChannelProcessor());
    this.registry.register(new TimelineChannelProcessor());
    this.registry.register(new SequentialWorkflowHandlerProcessor());
    this.registry.register(new OperationMarkerProcessor());
    this.registry.register(new SequentialWorkflowOperationProcessor());
    return this;
  }

  register(processor: AnyContractProcessor): ContractProcessorRegistryBuilder {
    this.registry.register(processor);
    return this;
  }

  build(): ContractProcessorRegistry {
    return this.registry;
  }
}
