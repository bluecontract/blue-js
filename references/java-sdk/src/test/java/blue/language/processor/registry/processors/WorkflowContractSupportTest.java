package blue.language.processor.registry.processors;

import blue.language.NodeProvider;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkflowContractSupportTest {

    @Test
    void matchesEventFilterResolvesProviderBackedTypeChains() {
        Node event = new Node()
                .type(new Node().blueId("Custom/Derived Event"))
                .properties("kind", new Node().value("alpha"));
        Node filter = new Node()
                .type(new Node().blueId("Custom/Base Event"))
                .properties("kind", new Node().value("alpha"));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Event".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node();
            definition.type(new Node().blueId("Custom/Base Event"));
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesEventFilter(event, filter));
        assertTrue(WorkflowContractSupport.matchesEventFilter(event, filter, provider));
    }

    @Test
    void matchesTypeRequirementResolvesProviderBackedEntryTypeChains() {
        Node candidate = new Node().properties("payload",
                new Node().type(new Node().blueId("Custom/Derived Payload")).value("ok"));
        Node requirement = new Node()
                .type(new Node().blueId("Dictionary"))
                .properties("entries",
                        new Node().properties("payload",
                                new Node().type(new Node().blueId("Custom/Base Payload"))));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Payload".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node();
            definition.type(new Node().blueId("Custom/Base Payload"));
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement));
        assertTrue(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement, provider));
    }

    @Test
    void matchesTypeRequirementSupportsCandidateTypeNodesUsingPropertyBlueIdChains() {
        Node candidate = new Node()
                .type(new Node().properties("blueId", new Node().value("Custom/Derived Payload")))
                .value("ok");
        Node requirement = new Node()
                .type(new Node().blueId("Custom/Base Payload"));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Payload".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node().type(new Node().blueId("Custom/Base Payload"));
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement));
        assertTrue(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement, provider));
    }

    @Test
    void matchesTypeRequirementSupportsCandidateTypeNodesUsingScalarValueChains() {
        Node candidate = new Node()
                .type(new Node().value("Custom/Derived Payload"))
                .value("ok");
        Node requirement = new Node()
                .type(new Node().blueId("Custom/Base Payload"));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Payload".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node().value("Custom/Base Payload");
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement));
        assertTrue(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement, provider));
    }

    @Test
    void matchesTypeRequirementSupportsRequirementTypeNodesUsingPropertyBlueId() {
        Node candidate = new Node().type(new Node().blueId("Custom/Base Payload")).value("ok");
        Node requirement = new Node()
                .type(new Node().properties("blueId", new Node().value("Custom/Base Payload")));
        Node mismatched = new Node().type(new Node().blueId("Custom/Other Payload")).value("ok");

        assertTrue(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement));
        assertFalse(WorkflowContractSupport.matchesTypeRequirement(mismatched, requirement));
    }

    @Test
    void matchesTypeRequirementSupportsRequirementTypeNodesUsingScalarValue() {
        Node candidate = new Node().type(new Node().blueId("Custom/Base Payload")).value("ok");
        Node requirement = new Node()
                .type(new Node().value("Custom/Base Payload"));
        Node mismatched = new Node().type(new Node().blueId("Custom/Other Payload")).value("ok");

        assertTrue(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement));
        assertFalse(WorkflowContractSupport.matchesTypeRequirement(mismatched, requirement));
    }

    @Test
    void matchesTypeRequirementResolvesProviderDefinitionPropertyBlueIdChainsForEntries() {
        Node candidate = new Node().properties("payload",
                new Node().type(new Node().blueId("Custom/Derived Payload")).value("ok"));
        Node requirement = new Node()
                .type(new Node().blueId("Dictionary"))
                .properties("entries",
                        new Node().properties("payload",
                                new Node().type(new Node().blueId("Custom/Base Payload"))));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Payload".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node()
                    .properties("blueId", new Node().value("Custom/Base Payload"));
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement));
        assertTrue(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement, provider));
    }

    @Test
    void matchesTypeRequirementResolvesProviderDefinitionScalarBlueIdChainsForItemType() {
        Node candidate = new Node().items(
                new Node().type(new Node().blueId("Custom/Derived Item")).value("first"),
                new Node().type(new Node().blueId("Custom/Derived Item")).value("second"));
        Node requirement = new Node()
                .type(new Node().blueId("List"))
                .properties("itemType", new Node().type(new Node().blueId("Custom/Base Item")));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Item".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node().value("Custom/Base Item");
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement));
        assertTrue(WorkflowContractSupport.matchesTypeRequirement(candidate, requirement, provider));
    }

    @Test
    void matchesEventFilterResolvesProviderBackedBlueIdPropertyChains() {
        Node event = new Node().properties("payload", new Node().blueId("Custom/Derived Payload"));
        Node filter = new Node().properties("payload",
                new Node().properties("blueId", new Node().value("Custom/Base Payload")));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Payload".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node();
            definition.type(new Node().blueId("Custom/Base Payload"));
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesEventFilter(event, filter));
        assertTrue(WorkflowContractSupport.matchesEventFilter(event, filter, provider));
    }

    @Test
    void matchesEventFilterSupportsCandidatePropertyBlueIdField() {
        Node event = new Node().properties(
                "payload",
                new Node().properties("blueId", new Node().value("Custom/Derived Payload")));
        Node filter = new Node().properties(
                "payload",
                new Node().properties("blueId", new Node().value("Custom/Base Payload")));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Payload".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node();
            definition.type(new Node().blueId("Custom/Base Payload"));
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesEventFilter(event, filter));
        assertTrue(WorkflowContractSupport.matchesEventFilter(event, filter, provider));
    }

    @Test
    void matchesEventFilterResolvesProviderDefinitionPropertyBlueIdChains() {
        Node event = new Node().properties("payload", new Node().blueId("Custom/Derived Payload"));
        Node filter = new Node().properties("payload",
                new Node().properties("blueId", new Node().value("Custom/Base Payload")));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Payload".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node().properties("blueId", new Node().value("Custom/Base Payload"));
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesEventFilter(event, filter));
        assertTrue(WorkflowContractSupport.matchesEventFilter(event, filter, provider));
    }

    @Test
    void matchesEventFilterResolvesProviderDefinitionScalarBlueIdChains() {
        Node event = new Node().properties("payload", new Node().blueId("Custom/Derived Payload"));
        Node filter = new Node().properties("payload",
                new Node().properties("blueId", new Node().value("Custom/Base Payload")));

        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Payload".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node().value("Custom/Base Payload");
            return Collections.singletonList(definition);
        };

        assertFalse(WorkflowContractSupport.matchesEventFilter(event, filter));
        assertTrue(WorkflowContractSupport.matchesEventFilter(event, filter, provider));
    }
}
