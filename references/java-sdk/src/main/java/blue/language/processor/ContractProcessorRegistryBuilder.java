package blue.language.processor;

import blue.language.processor.model.Contract;
import blue.language.processor.registry.processors.CompositeTimelineChannelProcessor;
import blue.language.processor.registry.processors.MyOSTimelineChannelProcessor;
import blue.language.processor.registry.processors.OperationMarkerProcessor;
import blue.language.processor.registry.processors.SequentialWorkflowHandlerProcessor;
import blue.language.processor.registry.processors.SequentialWorkflowOperationProcessor;
import blue.language.processor.registry.processors.TimelineChannelProcessor;

import java.util.Objects;

/**
 * Builder utility concentrated around contract processor registration.
 */
public final class ContractProcessorRegistryBuilder {

    private final ContractProcessorRegistry registry;

    private ContractProcessorRegistryBuilder(ContractProcessorRegistry registry) {
        this.registry = registry;
    }

    public static ContractProcessorRegistryBuilder create() {
        return new ContractProcessorRegistryBuilder(new ContractProcessorRegistry());
    }

    public ContractProcessorRegistryBuilder registerDefaults() {
        registry.registerChannel(new TimelineChannelProcessor());
        registry.registerChannel(new CompositeTimelineChannelProcessor());
        registry.registerChannel(new MyOSTimelineChannelProcessor());
        registry.registerHandler(new SequentialWorkflowHandlerProcessor());
        registry.registerHandler(new SequentialWorkflowOperationProcessor());
        registry.registerMarker(new OperationMarkerProcessor());
        return this;
    }

    public ContractProcessorRegistryBuilder register(ContractProcessor<? extends Contract> processor) {
        Objects.requireNonNull(processor, "processor");
        registry.register(processor);
        return this;
    }

    public ContractProcessorRegistry build() {
        return registry;
    }
}
