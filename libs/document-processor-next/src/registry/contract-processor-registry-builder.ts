import { ContractProcessorRegistry } from './contract-processor-registry.js';
import { TimelineChannelProcessor } from './processors/timeline-channel-processor.js';
import { AnyContractProcessor } from './types.js';

export class ContractProcessorRegistryBuilder {
  private constructor(private readonly registry: ContractProcessorRegistry) {}

  static create(): ContractProcessorRegistryBuilder {
    return new ContractProcessorRegistryBuilder(new ContractProcessorRegistry());
  }

  registerDefaults(): ContractProcessorRegistryBuilder {
    this.registry.register(new TimelineChannelProcessor());
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
