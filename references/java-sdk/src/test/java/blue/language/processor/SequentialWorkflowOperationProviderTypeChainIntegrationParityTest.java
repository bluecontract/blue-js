package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SequentialWorkflowOperationProviderTypeChainIntegrationParityTest {

    @Test
    void operationRequestTypeMatchingSupportsProviderBackedTypeChains() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (!"Custom/Derived Request".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node();
                definition.type(new Node().blueId("Custom/Base Request"));
                return Collections.singletonList(definition);
            }
        };

        Blue blue = new Blue(provider);
        Node document = blue.yamlToNode("name: Provider Request Type Chain Operation Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Conversation/Operation\n" +
                "    channel: ownerChannel\n" +
                "    request:\n" +
                "      type:\n" +
                "        blueId: Custom/Base Request\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.message.request.payload}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-request-type\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  request:\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Request\n" +
                "    payload: 12\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("12"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void operationRequestTypeMatchingSupportsProviderBackedPropertyBlueIdChains() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (!"Custom/Derived Request".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node().properties("blueId", new Node().value("Custom/Base Request"));
                return Collections.singletonList(definition);
            }
        };

        Blue blue = new Blue(provider);
        Node document = blue.yamlToNode("name: Provider Request Property BlueId Chain Operation Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Conversation/Operation\n" +
                "    channel: ownerChannel\n" +
                "    request:\n" +
                "      type:\n" +
                "        blueId: Custom/Base Request\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.message.request.payload}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-request-property-blueid\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  request:\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Request\n" +
                "    payload: 15\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("15"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void operationRequestTypeMatchingSupportsProviderBackedValueBlueIdChains() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (!"Custom/Derived Request".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node().value("Custom/Base Request");
                return Collections.singletonList(definition);
            }
        };

        Blue blue = new Blue(provider);
        Node document = blue.yamlToNode("name: Provider Request Value BlueId Chain Operation Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Conversation/Operation\n" +
                "    channel: ownerChannel\n" +
                "    request:\n" +
                "      type:\n" +
                "        blueId: Custom/Base Request\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.message.request.payload}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-request-value-blueid\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  request:\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Request\n" +
                "    payload: 18\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("18"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void operationDefinitionTypeMatchingSupportsProviderBackedTypeChains() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (!"Custom/Derived Operation".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node();
                definition.type(new Node().blueId("Conversation/Operation"));
                return Collections.singletonList(definition);
            }
        };

        Blue blue = new Blue(provider);
        Node document = blue.yamlToNode("name: Provider Operation Type Chain Operation Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Operation\n" +
                "    channel: ownerChannel\n" +
                "    request:\n" +
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.message.request}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-operation-type\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  request: 14\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("14"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void operationDefinitionTypeMatchingSupportsProviderBackedValueBlueIdChains() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (!"Custom/Derived Operation".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node().value("Conversation/Operation");
                return Collections.singletonList(definition);
            }
        };

        Blue blue = new Blue(provider);
        Node document = blue.yamlToNode("name: Provider Operation Value BlueId Chain Operation Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Operation\n" +
                "    channel: ownerChannel\n" +
                "    request:\n" +
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.message.request}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-operation-value-blueid\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  request: 16\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("16"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void operationMarkerLookupSupportsProviderBackedTypeChainsForDerivedChannelResolution() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (!"Custom/Derived Operation Marker".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node();
                definition.type(new Node().blueId("Conversation/Operation"));
                return Collections.singletonList(definition);
            }
        };

        Blue blue = new Blue(provider);
        Node document = blue.yamlToNode("name: Provider Marker Type Chain Operation Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Operation Marker\n" +
                "    channel: ownerChannel\n" +
                "    request:\n" +
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${currentContract.channel}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-marker-type\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  request: 1\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("ownerChannel", String.valueOf(result.document().getProperties().get("counter").getValue()));
    }

    @Test
    void operationMarkerLookupSupportsProviderBackedValueBlueIdChainsForDerivedChannelResolution() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (!"Custom/Derived Operation Marker".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node().value("Conversation/Operation");
                return Collections.singletonList(definition);
            }
        };

        Blue blue = new Blue(provider);
        Node document = blue.yamlToNode("name: Provider Marker Value BlueId Chain Operation Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Operation Marker\n" +
                "    channel: ownerChannel\n" +
                "    request:\n" +
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${currentContract.channel}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-marker-value-blueid\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  request: 1\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("ownerChannel", String.valueOf(result.document().getProperties().get("counter").getValue()));
    }

}
