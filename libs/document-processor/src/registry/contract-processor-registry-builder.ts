import { ContractProcessorRegistry } from './contract-processor-registry.js';
import { ActorPolicyMarkerProcessor } from './processors/actor-policy-marker-processor.js';
import { CompositeTimelineChannelProcessor } from './processors/composite-timeline-channel-processor.js';
import { MyOSTimelineChannelProcessor } from './processors/myos-timeline-channel-processor.js';
import { TimelineChannelProcessor } from './processors/timeline-channel-processor.js';
import { SequentialWorkflowHandlerProcessor } from './processors/sequential-workflow-processor.js';
import { GenericMarkerProcessor } from './processors/generic-marker-processor.js';
import { JavaScriptModuleMarkerProcessor } from './processors/javascript-module-marker-processor.js';
import { OperationMarkerProcessor } from './processors/operation-marker-processor.js';
import { SequentialWorkflowOperationProcessor } from './processors/sequential-workflow-operation-processor.js';
import { AnyContractProcessor } from './types.js';
import { BlueQuickJsEngine } from '../util/expression/javascript-evaluation-engine.js';
import type { DocumentJavaScriptExecutionPolicyOptions } from '../util/expression/javascript-execution-policy.js';
import { createDefaultStepExecutors } from './processors/workflow/step-runner.js';

export interface DefaultContractProcessorOptions {
  readonly javascript?: DocumentJavaScriptExecutionPolicyOptions;
}

export class ContractProcessorRegistryBuilder {
  private constructor(private readonly registry: ContractProcessorRegistry) {}

  static create(): ContractProcessorRegistryBuilder {
    return new ContractProcessorRegistryBuilder(
      new ContractProcessorRegistry(),
    );
  }

  registerDefaults(
    options: DefaultContractProcessorOptions = {},
  ): ContractProcessorRegistryBuilder {
    const javascriptEngine = new BlueQuickJsEngine(options.javascript);
    const stepExecutors = createDefaultStepExecutors(javascriptEngine);

    this.registry.register(new CompositeTimelineChannelProcessor());
    this.registry.register(new MyOSTimelineChannelProcessor());
    this.registry.register(new TimelineChannelProcessor());
    this.registry.register(
      new SequentialWorkflowHandlerProcessor(stepExecutors),
    );
    this.registry.register(new ActorPolicyMarkerProcessor());
    this.registry.register(new JavaScriptModuleMarkerProcessor());
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
