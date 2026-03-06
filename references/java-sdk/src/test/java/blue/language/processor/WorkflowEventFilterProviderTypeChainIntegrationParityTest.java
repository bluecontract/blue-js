package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.processor.contracts.TestEventChannelProcessor;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WorkflowEventFilterProviderTypeChainIntegrationParityTest {

    @Test
    void sequentialWorkflowEventFilterSupportsProviderDerivedMessageTypeChains() {
        Blue blue = new Blue(providerWithTypeChains(
                typeChain("Custom/Derived Message", "Custom/Base Message")));

        Node document = blue.yamlToNode("name: Provider Derived Workflow Event Filter Doc\n" +
                "count: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  workflow:\n" +
                "    channel: ownerChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Custom/Base Message\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /count\n" +
                "            val: 1\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-derived-message\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Message\n" +
                "  text: hello\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("1"), result.document().getProperties().get("count").getValue());
    }

    @Test
    void sequentialWorkflowEventFilterSupportsProviderDerivedMessagePropertyBlueIdChains() {
        Blue blue = new Blue(providerWithTypeChains(
                propertyChain("Custom/Derived Message", "Custom/Base Message")));

        Node document = blue.yamlToNode("name: Provider Derived Workflow Event Filter Property BlueId Doc\n" +
                "count: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  workflow:\n" +
                "    channel: ownerChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Custom/Base Message\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /count\n" +
                "            val: 1\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-derived-message-property-blueid\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Message\n" +
                "  text: hello\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("1"), result.document().getProperties().get("count").getValue());
    }

    @Test
    void sequentialWorkflowEventFilterSupportsProviderDerivedMessageValueBlueIdChains() {
        Blue blue = new Blue(providerWithTypeChains(
                valueChain("Custom/Derived Message", "Custom/Base Message")));

        Node document = blue.yamlToNode("name: Provider Derived Workflow Event Filter Value BlueId Doc\n" +
                "count: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  workflow:\n" +
                "    channel: ownerChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Custom/Base Message\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /count\n" +
                "            val: 1\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-provider-derived-message-value-blueid\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Message\n" +
                "  text: hello\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("1"), result.document().getProperties().get("count").getValue());
    }

    @Test
    void sequentialWorkflowOperationEventFilterSkipsProviderDerivedRequestTypeChainsWhenEnvelopeTypeIsNotOperationRequest() {
        Blue blue = new Blue(providerWithTypeChains(
                typeChain("Custom/Derived Operation Request", "Custom/Base Operation Request")));
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Provider Derived Operation Event Filter Doc\n" +
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
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Custom/Base Operation Request\n" +
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
                "eventId: evt-provider-derived-op-message\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Operation Request\n" +
                "  operation: increment\n" +
                "  request: 9\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationEventFilterSkipsProviderDerivedRequestPropertyBlueIdChainsWhenEnvelopeTypeIsNotOperationRequest() {
        Blue blue = new Blue(providerWithTypeChains(
                propertyChain("Custom/Derived Operation Request", "Custom/Base Operation Request")));
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Provider Derived Operation Event Filter Property BlueId Doc\n" +
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
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Custom/Base Operation Request\n" +
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
                "eventId: evt-provider-derived-op-message-property-blueid\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Operation Request\n" +
                "  operation: increment\n" +
                "  request: 10\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationEventFilterSkipsProviderDerivedRequestValueBlueIdChainsWhenEnvelopeTypeIsNotOperationRequest() {
        Blue blue = new Blue(providerWithTypeChains(
                valueChain("Custom/Derived Operation Request", "Custom/Base Operation Request")));
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Provider Derived Operation Event Filter Value BlueId Doc\n" +
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
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Custom/Base Operation Request\n" +
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
                "eventId: evt-provider-derived-op-message-value-blueid\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Operation Request\n" +
                "  operation: increment\n" +
                "  request: 11\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationDirectEventFilterSkipsProviderDerivedRequestPropertyBlueIdChainsByDefault() {
        Blue blue = new Blue(providerWithTypeChains(
                propertyChain("Custom/Derived Operation Request", "Custom/Base Operation Request")));
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Provider Derived Direct Operation Event Filter Property BlueId Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Conversation/Operation\n" +
                "    channel: testChannel\n" +
                "    request:\n" +
                "      type:\n" +
                "        blueId: Custom/Base Operation Request\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    event:\n" +
                "      request:\n" +
                "        type:\n" +
                "          blueId: Custom/Base Operation Request\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.request.payload}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-provider-derived-direct-op-message-property-blueid\n" +
                "kind: TestEvent\n" +
                "operation: increment\n" +
                "request:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Operation Request\n" +
                "  payload: 14\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationDirectEventFilterSkipsProviderDerivedRequestValueBlueIdChainsByDefault() {
        Blue blue = new Blue(providerWithTypeChains(
                valueChain("Custom/Derived Operation Request", "Custom/Base Operation Request")));
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Provider Derived Direct Operation Event Filter Value BlueId Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Conversation/Operation\n" +
                "    channel: testChannel\n" +
                "    request:\n" +
                "      type:\n" +
                "        blueId: Custom/Base Operation Request\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    event:\n" +
                "      request:\n" +
                "        type:\n" +
                "          blueId: Custom/Base Operation Request\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.request.payload}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-provider-derived-direct-op-message-value-blueid\n" +
                "kind: TestEvent\n" +
                "operation: increment\n" +
                "request:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Operation Request\n" +
                "  payload: 15\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    private static NodeProvider providerWithTypeChains(final Map<String, Node> definitions) {
        return new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (blueId == null || blueId.trim().isEmpty()) {
                    return Collections.emptyList();
                }
                Node definition = definitions.get(blueId.trim());
                if (definition == null) {
                    return Collections.emptyList();
                }
                List<Node> result = new ArrayList<>();
                result.add(definition.clone());
                return result;
            }
        };
    }

    private static Map<String, Node> typeChain(String derivedBlueId, String baseBlueId) {
        Map<String, Node> map = new LinkedHashMap<>();
        Node definition = new Node();
        definition.blueId(derivedBlueId);
        definition.type(new Node().blueId(baseBlueId));
        map.put(derivedBlueId, definition);
        return map;
    }

    private static Map<String, Node> propertyChain(String derivedBlueId, String baseBlueId) {
        Map<String, Node> map = new LinkedHashMap<>();
        Node definition = new Node();
        definition.blueId(derivedBlueId);
        definition.properties("blueId", new Node().value(baseBlueId));
        map.put(derivedBlueId, definition);
        return map;
    }

    private static Map<String, Node> valueChain(String derivedBlueId, String baseBlueId) {
        Map<String, Node> map = new LinkedHashMap<>();
        Node definition = new Node();
        definition.blueId(derivedBlueId);
        definition.value(baseBlueId);
        map.put(derivedBlueId, definition);
        return map;
    }
}
