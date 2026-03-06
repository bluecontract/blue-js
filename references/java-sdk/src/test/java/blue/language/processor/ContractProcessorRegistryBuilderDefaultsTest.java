package blue.language.processor;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ContractProcessorRegistryBuilderDefaultsTest {

    @Test
    void registerDefaultsIncludesTimelineWorkflowAndOperationProcessors() {
        ContractProcessorRegistry registry = ContractProcessorRegistryBuilder.create()
                .registerDefaults()
                .build();

        assertTrue(registry.lookupChannel("Conversation/Timeline Channel").isPresent());
        assertTrue(registry.lookupChannel("Conversation/Composite Timeline Channel").isPresent());
        assertTrue(registry.lookupChannel("MyOS/MyOS Timeline Channel").isPresent());
        assertTrue(registry.lookupHandler("Conversation/Sequential Workflow").isPresent());
        assertTrue(registry.lookupHandler("Conversation/Sequential Workflow Operation").isPresent());
        assertTrue(registry.lookupMarker("Conversation/Operation").isPresent());
        assertTrue(registry.lookupMarker("Operation").isPresent());
        assertTrue(registry.lookupMarker("Conversation/Change Operation").isPresent());
        assertTrue(registry.lookupMarker("ChangeOperation").isPresent());
    }
}
