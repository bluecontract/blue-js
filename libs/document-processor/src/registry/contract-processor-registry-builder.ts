import type { BexEngine } from '@blue-labs/bex';

import { ContractProcessorRegistry } from './contract-processor-registry.js';
import { ActorPolicyMarkerProcessor } from './processors/actor-policy-marker-processor.js';
import { CompositeTimelineChannelProcessor } from './processors/composite-timeline-channel-processor.js';
import { MyOSTimelineChannelProcessor } from './processors/myos-timeline-channel-processor.js';
import { TimelineChannelProcessor } from './processors/timeline-channel-processor.js';
import { SequentialWorkflowHandlerProcessor } from './processors/sequential-workflow-processor.js';
import { GenericMarkerProcessor } from './processors/generic-marker-processor.js';
import { OperationMarkerProcessor } from './processors/operation-marker-processor.js';
import { SequentialWorkflowOperationProcessor } from './processors/sequential-workflow-operation-processor.js';
import { AnyContractProcessor } from './types.js';
import { createDefaultStepExecutors } from './processors/workflow/step-runner.js';

export interface ContractProcessorRegistryBuilderOptions {
  readonly bexEngine?: BexEngine;
}

export class ContractProcessorRegistryBuilder {
  private constructor(
    private readonly registry: ContractProcessorRegistry,
    private readonly options: ContractProcessorRegistryBuilderOptions = {},
  ) {}

  static create(
    options: ContractProcessorRegistryBuilderOptions = {},
  ): ContractProcessorRegistryBuilder {
    return new ContractProcessorRegistryBuilder(
      new ContractProcessorRegistry(),
      options,
    );
  }

  registerDefaults(): ContractProcessorRegistryBuilder {
    const stepExecutors = createDefaultStepExecutors({
      bexEngine: this.options.bexEngine,
    });
    this.registry.register(new CompositeTimelineChannelProcessor());
    this.registry.register(new MyOSTimelineChannelProcessor());
    this.registry.register(new TimelineChannelProcessor());
    this.registry.register(
      new SequentialWorkflowHandlerProcessor(stepExecutors),
    );
    this.registry.register(new ActorPolicyMarkerProcessor());
    this.registry.register(new OperationMarkerProcessor());
    this.registry.register(new GenericMarkerProcessor());
    this.registry.register(
      new SequentialWorkflowOperationProcessor(stepExecutors),
    );
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
