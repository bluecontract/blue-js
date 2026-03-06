package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.blueid.BlueIdCalculator;
import blue.language.model.Node;
import blue.language.processor.contracts.SetPropertyOnEventContractProcessor;
import blue.language.processor.contracts.TestEventChannelProcessor;
import blue.language.processor.model.SequentialWorkflowOperation;
import blue.language.processor.registry.processors.SequentialWorkflowOperationProcessor;
import blue.language.processor.model.TestEvent;
import blue.language.utils.Properties;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.Collections;
import java.util.List;

import static blue.language.utils.Properties.INTEGER_TYPE_BLUE_ID;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SequentialWorkflowProcessorTest {

    @Test
    void sequentialWorkflowExecutesUpdateAndTriggerEventSteps() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new SetPropertyOnEventContractProcessor());

        Node document = blue.yamlToNode("name: Workflow Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  triggered:\n" +
                "    type:\n" +
                "      blueId: TriggeredEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: ADD\n" +
                "            path: /count\n" +
                "            val: 3\n" +
                "      - type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: TriggeredFromWorkflow\n" +
                "          kind: emitted\n" +
                "  observeTrigger:\n" +
                "    channel: triggered\n" +
                "    type:\n" +
                "      blueId: SetPropertyOnEvent\n" +
                "    expectedKind: emitted\n" +
                "    propertyKey: /emitted\n" +
                "    propertyValue: 1\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-1").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node processed = result.document();
        assertEquals(new BigInteger("3"), processed.getProperties().get("count").getValue());
        assertEquals(new BigInteger("1"), processed.getProperties().get("emitted").getValue());
        assertNotNull(result.triggeredEvents().stream()
                .filter(node -> node.getProperties() != null)
                .filter(node -> node.getProperties().get("kind") != null)
                .filter(node -> "emitted".equals(node.getProperties().get("kind").getValue()))
                .findFirst()
                .orElse(null));
    }

    @Test
    void sequentialWorkflowSupportsInlineDerivedWorkflowTypeBlueId() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Derived Workflow Type Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Sequential Workflow\n" +
                "      type:\n" +
                "        blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /count\n" +
                "            val: 9\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-derived-workflow").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("9"), result.document().getProperties().get("count").getValue());
    }

    @Test
    void sequentialWorkflowSupportsProviderDerivedWorkflowTypeBlueId() {
        NodeProvider provider = new NodeProvider() {
            @Override
            public java.util.List<Node> fetchByBlueId(String blueId) {
                if (!"Custom/Repository Derived Sequential Workflow".equals(blueId)) {
                    return Collections.emptyList();
                }
                Node definition = new Node();
                definition.type(new Node().blueId("Conversation/Sequential Workflow"));
                return Collections.singletonList(definition);
            }
        };
        Blue blue = new Blue(provider);
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Provider Derived Workflow Type Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Custom/Repository Derived Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /count\n" +
                "            val: 13\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-provider-derived-workflow").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("13"), result.document().getProperties().get("count").getValue());
    }

    @Test
    void sequentialWorkflowOperationDerivesChannelFromOperationMarker() {
        Blue blue = new Blue();
        Node document = operationWorkflowDocument(null, "ownerChannel");

        Node initialized = blue.initializeDocument(document).document();
        String documentBlueId = storedDocumentBlueId(initialized);
        Node event = operationRequestEvent(blue, "increment", 1, false, documentBlueId, "owner-42");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("1"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationExposesDerivedChannelInCurrentContractBindings() {
        Blue blue = new Blue();
        Node document = operationWorkflowDocumentAdvanced(
                null,
                "ownerChannel",
                "Conversation/Sequential Workflow Operation",
                "Conversation/Operation",
                "type: Integer",
                null,
                "${currentContract.channel}");

        Node initialized = blue.initializeDocument(document).document();
        String documentBlueId = storedDocumentBlueId(initialized);
        Node event = operationRequestEvent(blue, "increment", 1, false, documentBlueId, "owner-42");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("ownerChannel", String.valueOf(result.document().getProperties().get("counter").getValue()));
    }

    @Test
    void sequentialWorkflowOperationSupportsInlineDerivedHandlerTypeBlueId() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Derived Operation Workflow Doc\n" +
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
                "      blueId: Custom/Derived Sequential Workflow Operation\n" +
                "      type:\n" +
                "        blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.message.request}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = operationRequestEvent(blue, "increment", 8, true, null, "owner-42");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("8"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSupportsInlineDerivedMarkerTypeBlueId() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Derived Operation Marker Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: Custom/Derived Operation Marker\n" +
                "      type:\n" +
                "        blueId: Conversation/Operation\n" +
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
        Node event = operationRequestEvent(blue, "increment", 6, true, null, "owner-42");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("6"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSkipsWhenOperationKeyDiffers() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        Node event = operationRequestEvent(blue, "otherOperation", 5, true, null, "owner-42");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSkipsWhenRequestTypeMismatches() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        Node event = operationRequestEvent(blue, "increment", "oops", true, null, "owner-42");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSkipsWhenTimelineMessageTypeIsNotOperationRequest() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        String storedBlueId = storedDocumentBlueId(initialized);

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-op-non-request-message\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Chat Message\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request: 9\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSkipsWhenTimelineMessageTypeIsMissing() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        String storedBlueId = storedDocumentBlueId(initialized);

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-op-missing-message-type\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request: 9\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSkipsNonTimelineEventsEvenWhenMessageLooksLikeOperationRequest() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        String storedBlueId = storedDocumentBlueId(initialized);

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: RandomEvent\n" +
                "eventId: evt-op-non-timeline-envelope\n" +
                "message:\n" +
                "  type: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request: 9\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationAcceptsTimelineMessageTypeDeclaredAsScalarValue() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        String storedBlueId = storedDocumentBlueId(initialized);

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-op-scalar-message-type\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request: 3\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("3"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationAcceptsTimelineMessageTypeAlias() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        String storedBlueId = storedDocumentBlueId(initialized);

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-op-alias-message-type\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Operation Request\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request: 4\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("4"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationAcceptsTimelineEntryAliasEnvelope() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        String storedBlueId = storedDocumentBlueId(initialized);

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TimelineEntry\n" +
                "eventId: evt-op-timeline-alias-envelope\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request: 8\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("8"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationAcceptsProviderDerivedTimelineMessageOperationRequestType() {
        NodeProvider provider = blueId -> {
            if (!"Custom/Derived Operation Request".equals(blueId)) {
                return Collections.emptyList();
            }
            Node definition = new Node()
                    .properties("blueId", new Node().value("Conversation/Operation Request"));
            return Collections.singletonList(definition);
        };
        Blue blue = new Blue(provider);
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        String storedBlueId = storedDocumentBlueId(initialized);

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-op-provider-message-type\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Custom/Derived Operation Request\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request: 5\n");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("5"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSkipsDirectOperationRequestEventShapeByDefault() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Direct Operation Request Doc\n" +
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
                "            val: \"${event.request}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-op-direct\n" +
                "kind: TestEvent\n" +
                "operation: increment\n" +
                "request: 4\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationDirectRequestIsRejectedEvenWhenAllowNewerDefaults() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Direct Operation Request AllowNewer Default Doc\n" +
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
                "            val: \"${event.request}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-op-direct-allow-default\n" +
                "kind: TestEvent\n" +
                "operation: increment\n" +
                "document:\n" +
                "  blueId: stale-document-id\n" +
                "request: 9\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationDirectRequestSkipsWhenPinnedDocumentDiffers() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Direct Operation Request Pinned Mismatch Doc\n" +
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
                "            val: \"${event.request}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-op-direct-pinned-mismatch\n" +
                "kind: TestEvent\n" +
                "operation: increment\n" +
                "allowNewerVersion: false\n" +
                "document:\n" +
                "  blueId: stale-document-id\n" +
                "request: 9\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationDirectRequestDoesNotMatchHandlerEventFiltersByDefault() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Direct Operation Request Event Filter Doc\n" +
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
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    operation: increment\n" +
                "    event:\n" +
                "      allowNewerVersion: false\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${event.request}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node matching = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-op-direct-filter-match\n" +
                "kind: TestEvent\n" +
                "operation: increment\n" +
                "allowNewerVersion: false\n" +
                "request: 4\n");
        DocumentProcessingResult matched = blue.processDocument(initialized, matching);
        assertEquals(new BigInteger("0"), matched.document().getProperties().get("counter").getValue());

        Node nonMatching = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-op-direct-filter-skip\n" +
                "kind: TestEvent\n" +
                "operation: increment\n" +
                "allowNewerVersion: true\n" +
                "request: 9\n");
        DocumentProcessingResult skipped = blue.processDocument(matched.document(), nonMatching);
        assertEquals(new BigInteger("0"), skipped.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationDirectRequestSkipsWhenOperationKeyDiffers() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Direct Operation Request Key Mismatch Doc\n" +
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
                "            val: \"${event.request}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-op-direct-key-mismatch\n" +
                "kind: TestEvent\n" +
                "operation: otherOperation\n" +
                "request: 9\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSkipsWhenPinnedDocumentDiffers() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        Node event = operationRequestEvent(blue, "increment", 5, false, "stale-document-id", "owner-42");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationDefaultsAllowNewerVersionWhenFlagMissing() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        Node event = operationRequestEventWithOptionalAllowNewer(
                blue, "increment", 5, null, "stale-document-id", "owner-42");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("5"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationFallsBackToComputedDocumentIdWhenMarkerIdMissing() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();
        Node withoutMarkerDocumentId = initialized.clone();
        Node initializedMarker = withoutMarkerDocumentId.getProperties()
                .get("contracts")
                .getProperties()
                .get("initialized");
        assertNotNull(initializedMarker);
        assertNotNull(initializedMarker.getProperties());
        initializedMarker.getProperties().remove("documentId");

        SequentialWorkflowOperation contract = new SequentialWorkflowOperation();
        contract.setOperation("increment");
        contract.setChannelKey("ownerChannel");

        String pinnedBlueId = BlueIdCalculator.calculateSemanticBlueId(withoutMarkerDocumentId.clone());
        Node matchingEvent = operationRequestEvent(blue, "increment", 5, false, pinnedBlueId, "owner-42");

        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, withoutMarkerDocumentId);
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                matchingEvent,
                false,
                false);

        SequentialWorkflowOperationProcessor processor = new SequentialWorkflowOperationProcessor();
        assertTrue(processor.matches(contract, context));
    }

    @Test
    void sequentialWorkflowOperationCompatModeAllowsDirectRequestShape() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Direct Operation Request Compat Doc\n" +
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
                "      type: Integer\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow Operation\n" +
                "    channel: testChannel\n" +
                "    operation: increment\n");
        Node initialized = blue.initializeDocument(document).document();

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-op-direct-compat\n" +
                "kind: TestEvent\n" +
                "operation: increment\n" +
                "request: 4\n");

        SequentialWorkflowOperation contract = new SequentialWorkflowOperation();
        contract.setOperation("increment");
        contract.setChannelKey("testChannel");

        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, initialized);
        execution.loadBundles("/");
        ProcessorExecutionContext context = execution.createContext(
                "/",
                execution.bundleForScope("/"),
                event,
                false,
                false);

        SequentialWorkflowOperationProcessor strict = new SequentialWorkflowOperationProcessor(false);
        SequentialWorkflowOperationProcessor compat = new SequentialWorkflowOperationProcessor(true);

        assertFalse(strict.matches(contract, context));
        assertTrue(compat.matches(contract, context));
    }

    @Test
    void sequentialWorkflowOperationSkipsWhenHandlerAndOperationChannelsConflict() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument("ownerChannel", "otherChannel")).document();
        Node event = operationRequestEvent(blue, "increment", 5, true, null, "owner-42");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("0"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationSupportsChangeWorkflowAliases() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(
                null,
                "ownerChannel",
                "Conversation/Change Workflow",
                "Conversation/Change Operation")).document();
        String documentBlueId = storedDocumentBlueId(initialized);
        Node event = operationRequestEvent(blue, "increment", 6, false, documentBlueId, "owner-42");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("6"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationWithoutDeclaredOrDerivedChannelFailsInitialization() {
        Blue blue = new Blue();
        Node document = operationWorkflowDocument(null, null);

        assertThrows(IllegalStateException.class, () -> blue.initializeDocument(document));
    }

    @Test
    void sequentialWorkflowOperationKeepsOperationMarkerContractType() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument(null, "ownerChannel")).document();

        Node operationContract = initialized.getProperties()
                .get("contracts")
                .getProperties()
                .get("increment");
        assertNotNull(operationContract);
        assertNotNull(operationContract.getType());
        assertEquals("Conversation/Operation", operationContract.getType().getBlueId());
    }

    @Test
    void sequentialWorkflowOperationHonorsOperationChannelMetadata() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocument("ownerChannel", "ownerChannel")).document();
        String storedBlueId = storedDocumentBlueId(initialized);
        Node event = operationRequestEvent(blue, "increment", 7, false, storedBlueId, "owner-42");

        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("7"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationAppliesHandlerEventPattern() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocumentAdvanced(
                null,
                "ownerChannel",
                "Conversation/Sequential Workflow Operation",
                "Conversation/Operation",
                "type: Integer",
                "message:\n  allowNewerVersion: false",
                "${event.message.request + document('/counter')}")).document();

        String storedBlueId = storedDocumentBlueId(initialized);
        Node matchingEvent = operationRequestEvent(blue, "increment", 2, false, storedBlueId, "owner-42");
        DocumentProcessingResult matched = blue.processDocument(initialized, matchingEvent);
        assertEquals(new BigInteger("2"), matched.document().getProperties().get("counter").getValue());

        Node nonMatchingEvent = operationRequestEvent(blue, "increment", 5, true, storedBlueId, "owner-42");
        DocumentProcessingResult skipped = blue.processDocument(matched.document(), nonMatchingEvent);
        assertEquals(new BigInteger("2"), skipped.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationHandlesComplexRequestStructures() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocumentAdvanced(
                null,
                "ownerChannel",
                "Conversation/Sequential Workflow Operation",
                "Conversation/Operation",
                "type: Dictionary\nentries:\n  amount:\n    type: Integer\n  metadata:\n    type: Dictionary\n    entries:\n      note:\n        type: Text",
                null,
                "${event.message.request.amount + document('/counter')}")).document();

        String storedBlueId = storedDocumentBlueId(initialized);
        Node complexEvent = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-op-complex\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request:\n" +
                "    amount: 3\n" +
                "    metadata:\n" +
                "      note: boost\n");

        DocumentProcessingResult result = blue.processDocument(initialized, complexEvent);

        assertEquals(new BigInteger("3"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationMatchesProviderDefinitionPropertyAndScalarTypeChainsInRequestSchema() {
        NodeProvider provider = blueId -> {
            if ("Custom/Derived Payload".equals(blueId)) {
                return Collections.singletonList(new Node()
                        .properties("blueId", new Node().value("Custom/Base Payload")));
            }
            if ("Custom/Derived Item".equals(blueId)) {
                return Collections.singletonList(new Node().value("Custom/Base Item"));
            }
            return Collections.emptyList();
        };
        Blue blue = new Blue(provider);
        Node initialized = blue.initializeDocument(operationWorkflowDocumentAdvanced(
                null,
                "ownerChannel",
                "Conversation/Sequential Workflow Operation",
                "Conversation/Operation",
                "type: Dictionary\nentries:\n  payload:\n    type:\n      blueId: Custom/Base Payload\n  items:\n    type: List\n    itemType:\n      type:\n        blueId: Custom/Base Item",
                null,
                "${event.message.request.payload.value + event.message.request.items[0].value}")).document();

        String storedBlueId = storedDocumentBlueId(initialized);
        Node requestPayload = new Node()
                .type(new Node().blueId("Custom/Derived Payload"))
                .properties("value", new Node().value(4));
        Node requestItems = new Node().items(
                new Node()
                        .type(new Node().blueId("Custom/Derived Item"))
                        .properties("value", new Node().value(3)));
        Node request = new Node()
                .properties("payload", requestPayload)
                .properties("items", requestItems);
        Node event = new Node()
                .type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("eventId", new Node().value("evt-op-provider-request-chain"))
                .properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")))
                .properties("message", new Node()
                        .type(new Node().blueId("Conversation/Operation Request"))
                        .properties("operation", new Node().value("increment"))
                        .properties("allowNewerVersion", new Node().value(false))
                        .properties("document", new Node().properties("blueId", new Node().value(storedBlueId)))
                        .properties("request", request));

        DocumentProcessingResult result = blue.processDocument(initialized, event);
        assertEquals(new BigInteger("7"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void sequentialWorkflowOperationExecutesDerivedChangeWorkflow() {
        Blue blue = new Blue();
        Node initialized = blue.initializeDocument(operationWorkflowDocumentAdvanced(
                null,
                "ownerChannel",
                "Conversation/Change Workflow",
                "Conversation/Change Operation",
                "type: Conversation/Change Request",
                null,
                "${event.message.request.changeset[0].val}")).document();

        String storedBlueId = storedDocumentBlueId(initialized);
        Node changeEvent = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: evt-op-change\n" +
                "timeline:\n" +
                "  timelineId: owner-42\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Operation Request\n" +
                "  operation: increment\n" +
                "  allowNewerVersion: false\n" +
                "  document:\n" +
                "    blueId: " + storedBlueId + "\n" +
                "  request:\n" +
                "    type:\n" +
                "      blueId: Conversation/Change Request\n" +
                "    changeset:\n" +
                "      - op: REPLACE\n" +
                "        path: /counter\n" +
                "        val: 11\n");

        DocumentProcessingResult result = blue.processDocument(initialized, changeEvent);

        assertEquals(new BigInteger("11"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void javaScriptCodeStepCanApplyChangesetAndEmitEvents() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new SetPropertyOnEventContractProcessor());

        Node document = blue.yamlToNode("name: JavaScript Step Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  triggered:\n" +
                "    type:\n" +
                "      blueId: TriggeredEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/jsValue', val: 9 }], events: [{ kind: 'js' }] });\"\n" +
                "  observeJsEmission:\n" +
                "    channel: triggered\n" +
                "    type:\n" +
                "      blueId: SetPropertyOnEvent\n" +
                "    expectedKind: js\n" +
                "    propertyKey: /jsObserved\n" +
                "    propertyValue: 1\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-3").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("9"), result.document().getProperties().get("jsValue").getValue());
        assertEquals(new BigInteger("1"), result.document().getProperties().get("jsObserved").getValue());
    }

    @Test
    void javaScriptCodeStepHasCurrentContractBindings() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Contract Binding Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/contractChannel', val: currentContract.channel }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-bind").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("testChannel", result.document().getProperties().get("contractChannel").getValue());
    }

    @Test
    void javaScriptCodeStepHasCanonicalCurrentContractBindings() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Contract Canonical Binding Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/contractSimple', val: currentContract.channel }, { op: 'ADD', path: '/contractCanonical', val: currentContractCanonical.channel.value }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-bind-canonical").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("testChannel", result.document().getProperties().get("contractSimple").getValue());
        assertEquals("testChannel", result.document().getProperties().get("contractCanonical").getValue());
    }

    @Test
    void javaScriptCodeStepErrorsBecomeFatalTermination() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Error Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"throw new Error('boom')\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-err").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node terminated = result.document()
                .getProperties().get("contracts")
                .getProperties().get("terminated");
        assertNotNull(terminated);
        assertEquals("fatal", String.valueOf(terminated.getProperties().get("cause").getValue()));
        assertTrue(String.valueOf(terminated.getProperties().get("reason").getValue()).contains("Failed to evaluate code block"));
    }

    @Test
    void javaScriptCodeStepRejectsAsyncAwaitSyntax() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Async Await Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"const value = await Promise.resolve(11); ({ changeset: [{ op: 'ADD', path: '/value', val: value }] })\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-await").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node terminated = result.document()
                .getProperties().get("contracts")
                .getProperties().get("terminated");
        assertNotNull(terminated);
        assertEquals("fatal", String.valueOf(terminated.getProperties().get("cause").getValue()));
        assertTrue(String.valueOf(terminated.getProperties().get("reason").getValue()).contains("Failed to evaluate code block"));
    }

    @Test
    void javaScriptCodeStepRunawayLoopBecomesFatalTermination() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Runaway Loop Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"while (true) {}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-loop").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node terminated = result.document()
                .getProperties().get("contracts")
                .getProperties().get("terminated");
        assertNotNull(terminated);
        assertEquals("fatal", String.valueOf(terminated.getProperties().get("cause").getValue()));
        assertTrue(String.valueOf(terminated.getProperties().get("reason").getValue()).contains("Failed to evaluate code block"));
    }

    @Test
    void javaScriptCodeStepSupportsEmitCallbackStyle() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Emit Callback Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  triggered:\n" +
                "    type:\n" +
                "      blueId: TriggeredEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"emit({ kind: 'js-callback' }); return ({ changeset: [{ op: 'ADD', path: '/callbackHit', val: 11 }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-callback").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("11"), result.document().getProperties().get("callbackHit").getValue());
        assertTrue(result.triggeredEvents().stream()
                .anyMatch(emitted -> emitted != null
                        && emitted.getProperties() != null
                        && emitted.getProperties().get("kind") != null
                        && "js-callback".equals(String.valueOf(emitted.getProperties().get("kind").getValue()))));
    }

    @Test
    void javaScriptCodeStepCanonicalDocumentReadIncludesTypeMetadata() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Canonical Read Doc\n" +
                "base: 5\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/canonicalType', val: document.canonical('/base').type.blueId }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-canon").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(INTEGER_TYPE_BLUE_ID, result.document().getProperties().get("canonicalType").getValue());
    }

    @Test
    void javaScriptCodeStepSupportsDocumentGetAliases() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Document Alias API Doc\n" +
                "base: 5\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/plainAlias', val: document.get('/base') }, { op: 'ADD', path: '/canonicalAlias', val: document.getCanonical('/base').type.blueId }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-document-alias").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("5"), result.document().getProperties().get("plainAlias").getValue());
        assertEquals(INTEGER_TYPE_BLUE_ID, result.document().getProperties().get("canonicalAlias").getValue());
    }

    @Test
    void javaScriptCodeStepExposesEventCanonicalAndCanonHelpers() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Event Canonical Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          return ({ changeset: [\n" +
                "            { op: 'ADD', path: '/eventPlain', val: event.payload.id },\n" +
                "            { op: 'ADD', path: '/eventCanonical', val: canon.unwrap(canon.at(eventCanonical, '/payload/id')) }\n" +
                "          ] });\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-canon-event\n" +
                "kind: TestEvent\n" +
                "payload:\n" +
                "  id: evt-123\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("evt-123", result.document().getProperties().get("eventPlain").getValue());
        assertEquals("evt-123", result.document().getProperties().get("eventCanonical").getValue());
    }

    @Test
    void javaScriptCodeStepCanonUnwrapSupportsDeepAndShallowModes() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Canon Unwrap Modes Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          return ({ changeset: [\n" +
                "            { op: 'ADD', path: '/eventIdDeep', val: canon.unwrap(eventCanonical).payload.id },\n" +
                "            { op: 'ADD', path: '/eventIdShallow', val: canon.unwrap(eventCanonical, false).payload.id.value },\n" +
                "            { op: 'ADD', path: '/eventTagDeep', val: canon.unwrap(eventCanonical).payload.tags[0] },\n" +
                "            { op: 'ADD', path: '/eventTagShallow', val: canon.unwrap(eventCanonical, false).payload.tags.items[0].value }\n" +
                "          ] });\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-canon-unwrap\n" +
                "kind: TestEvent\n" +
                "payload:\n" +
                "  id: evt-123\n" +
                "  tags:\n" +
                "    - a\n" +
                "    - b\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("evt-123", result.document().getProperties().get("eventIdDeep").getValue());
        assertEquals("evt-123", result.document().getProperties().get("eventIdShallow").getValue());
        assertEquals("a", result.document().getProperties().get("eventTagDeep").getValue());
        assertEquals("a", result.document().getProperties().get("eventTagShallow").getValue());
    }

    @Test
    void javaScriptCodeStepDoesNotExposeDateGlobal() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Deterministic Globals Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/dateType', val: typeof Date }, { op: 'ADD', path: '/processType', val: typeof process }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-deterministic").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("undefined", result.document().getProperties().get("dateType").getValue());
        assertEquals("undefined", result.document().getProperties().get("processType").getValue());
    }

    @Test
    void javaScriptCodeStepDocumentBlueIdPathReturnsComputedBlueId() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Document BlueId Doc\n" +
                "prop:\n" +
                "  value: 7\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/propBlueId', val: document('/prop/blueId') }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        String expectedBlueId = blue.calculateBlueId(initialized.getProperties().get("prop"));
        Node event = blue.objectToNode(new TestEvent().eventId("evt-prop-blueid").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(expectedBlueId, result.document().getProperties().get("propBlueId").getValue());
    }

    @Test
    void javaScriptCodeStepSupportsSpecialDocumentSegments() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Special Document Segments Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/nameVal', val: document('/prop/name') }, { op: 'ADD', path: '/descriptionVal', val: document('/prop/description') }, { op: 'ADD', path: '/valueVal', val: document('/prop/value') }, { op: 'ADD', path: '/blueIdVal', val: document('/prop/blueId') }, { op: 'ADD', path: '/canonicalNameVal', val: document.canonical('/prop/name') }, { op: 'ADD', path: '/canonicalDescriptionVal', val: document.canonical('/prop/description') }, { op: 'ADD', path: '/canonicalValueVal', val: document.canonical('/prop/value') }, { op: 'ADD', path: '/canonicalBlueIdVal', val: document.canonical('/prop/blueId') }] });\"\n");
        document.properties("prop", new Node()
                .name("Prop A")
                .description("Desc")
                .type(new Node().name("TypeX"))
                .value(7));

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-special-segments").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node resultDocument = result.document();
        assertEquals("Prop A", resultDocument.getProperties().get("nameVal").getValue());
        assertEquals("Desc", resultDocument.getProperties().get("descriptionVal").getValue());
        assertEquals(new BigInteger("7"), resultDocument.getProperties().get("valueVal").getValue());
        assertEquals("Prop A", resultDocument.getProperties().get("canonicalNameVal").getValue());
        assertEquals("Desc", resultDocument.getProperties().get("canonicalDescriptionVal").getValue());
        assertEquals(new BigInteger("7"), resultDocument.getProperties().get("canonicalValueVal").getValue());

        Object blueId = resultDocument.getProperties().get("blueIdVal").getValue();
        assertNotNull(blueId);
        assertEquals(blueId, resultDocument.getProperties().get("canonicalBlueIdVal").getValue());
    }

    @Test
    void javaScriptCodeStepCanReadPreviousStepResults() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Previous Step Results Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - name: Compute\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ value: 12 });\"\n" +
                "      - name: Finalize\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/total', val: steps.Compute.value + 8 }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-steps").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("20"), result.document().getProperties().get("total").getValue());
    }

    @Test
    void javaScriptCodeStepPreservesExplicitNullResultsInStepBindings() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Null Step Result Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - name: Nuller\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return null;\"\n" +
                "      - name: Finalize\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/nullSeen', val: steps.Nuller === null }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-null-step").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(Boolean.TRUE, result.document().getProperties().get("nullSeen").getValue());
    }

    @Test
    void javaScriptCodeStepSkipsUndefinedResultsInStepBindings() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: JavaScript Undefined Step Result Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - name: Maybe\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"const v = 1;\"\n" +
                "      - name: Finalize\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: \"return ({ changeset: [{ op: 'ADD', path: '/undefinedSeen', val: typeof steps.Maybe === 'undefined' }] });\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-undefined-step").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(Boolean.TRUE, result.document().getProperties().get("undefinedSeen").getValue());
    }

    @Test
    void updateDocumentStepResolvesExpressionValues() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Update Expression Doc\n" +
                "base: 2\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: ADD\n" +
                "            path: /computed\n" +
                "            val: \"${event.count + document('/base')}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-4\n" +
                "kind: TestEvent\n" +
                "count: 3\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("5"), result.document().getProperties().get("computed").getValue());
    }

    @Test
    void updateDocumentStepSupportsTemplateExpressionsInPath() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Update Path Template Doc\n" +
                "entries:\n" +
                "  - first\n" +
                "  - second\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: \"/entries/${event.payload.index}\"\n" +
                "            val: selected\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-path-template\n" +
                "kind: TestEvent\n" +
                "payload:\n" +
                "  index: 1\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node first = ProcessorEngine.nodeAt(result.document(), "/entries/0");
        Node second = ProcessorEngine.nodeAt(result.document(), "/entries/1");
        assertNotNull(first);
        assertNotNull(second);
        assertEquals("first", first.getValue());
        assertEquals("selected", second.getValue());
    }

    @Test
    void updateDocumentStepSupportsExpressionChangesetArrays() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Update Changeset Expression Doc\n" +
                "flag: nope\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset: \"${[{ op: 'REPLACE', path: '/flag', val: event.payload.flag }]}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-changeset-expression\n" +
                "kind: TestEvent\n" +
                "payload:\n" +
                "  flag: yep\n");
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals("yep", result.document().getProperties().get("flag").getValue());
    }

    @Test
    void updateDocumentStepUnsupportedOperationBecomesFatalTermination() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Update Unsupported Op Doc\n" +
                "value: base\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: UPSERT\n" +
                "            path: /value\n" +
                "            val: nope\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-unsupported-op").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node terminated = result.document()
                .getProperties().get("contracts")
                .getProperties().get("terminated");
        assertNotNull(terminated);
        assertEquals("fatal", String.valueOf(terminated.getProperties().get("cause").getValue()));
        assertTrue(String.valueOf(terminated.getProperties().get("reason").getValue())
                .contains("Unsupported Update Document operation"));
    }

    @Test
    void unsupportedWorkflowStepTypeUsesTypeNameInFatalReason() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Unsupported Step Type Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Custom/Unknown Step\n" +
                "          name: Friendly Unknown Step\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-unsupported-step-type").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node terminated = result.document()
                .getProperties().get("contracts")
                .getProperties().get("terminated");
        assertNotNull(terminated);
        assertEquals("fatal", String.valueOf(terminated.getProperties().get("cause").getValue()));
        assertTrue(String.valueOf(terminated.getProperties().get("reason").getValue())
                .contains("Friendly Unknown Step"));
    }

    @Test
    void triggerEventStepResolvesEventExpressions() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new SetPropertyOnEventContractProcessor());

        Node document = blue.yamlToNode("name: Trigger Expression Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  triggered:\n" +
                "    type:\n" +
                "      blueId: TriggeredEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          kind: \"${event.kind}\"\n" +
                "  observer:\n" +
                "    channel: triggered\n" +
                "    type:\n" +
                "      blueId: SetPropertyOnEvent\n" +
                "    expectedKind: TestEvent\n" +
                "    propertyKey: /triggerResolved\n" +
                "    propertyValue: 1\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-5").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertEquals(new BigInteger("1"), result.document().getProperties().get("triggerResolved").getValue());
    }

    @Test
    void triggerEventStepEmitsProvidedPayload() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Trigger Event Payload Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: Hello World\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-trigger-payload").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        assertTrue(result.triggeredEvents().stream().anyMatch(emitted -> {
            if (emitted == null || emitted.getProperties() == null) {
                return false;
            }
            Node message = emitted.getProperties().get("message");
            if (message == null || !"Hello World".equals(String.valueOf(message.getValue()))) {
                return false;
            }
            Node type = emitted.getProperties().get("type");
            if (type == null) {
                return true;
            }
            if ("Conversation/Chat Message".equals(String.valueOf(type.getValue()))) {
                return true;
            }
            return type.getProperties() != null
                    && type.getProperties().get("blueId") != null
                    && "Conversation/Chat Message".equals(String.valueOf(type.getProperties().get("blueId").getValue()));
        }));
    }

    @Test
    void triggerEventStepMissingPayloadBecomesFatalTermination() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Trigger Missing Payload Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  workflow:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Trigger Event\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-trigger-missing").kind("TestEvent"));
        DocumentProcessingResult result = blue.processDocument(initialized, event);

        Node terminated = result.document()
                .getProperties().get("contracts")
                .getProperties().get("terminated");
        assertNotNull(terminated);
        assertEquals("fatal", String.valueOf(terminated.getProperties().get("cause").getValue()));
        assertNotNull(terminated.getProperties().get("reason"));
    }

    private Node operationWorkflowDocument(String handlerChannel, String operationChannel) {
        return operationWorkflowDocument(
                handlerChannel,
                operationChannel,
                "Conversation/Sequential Workflow Operation",
                "Conversation/Operation");
    }

    private Node operationWorkflowDocument(String handlerChannel,
                                           String operationChannel,
                                           String handlerTypeBlueId,
                                           String operationTypeBlueId) {
        return operationWorkflowDocumentAdvanced(
                handlerChannel,
                operationChannel,
                handlerTypeBlueId,
                operationTypeBlueId,
                "type: Integer",
                null,
                "${event.message.request}");
    }

    private Node operationWorkflowDocumentAdvanced(String handlerChannel,
                                                   String operationChannel,
                                                   String handlerTypeBlueId,
                                                   String operationTypeBlueId,
                                                   String requestTypeYaml,
                                                   String handlerEventYaml,
                                                   String stepExpression) {
        String handlerChannelYaml = handlerChannel != null
                ? "    channel: " + handlerChannel + "\n"
                : "";
        String operationChannelYaml = operationChannel != null
                ? "    channel: " + operationChannel + "\n"
                : "";
        String handlerEventSection = handlerEventYaml != null && !handlerEventYaml.trim().isEmpty()
                ? "    event:\n" + indent(handlerEventYaml, 6) + "\n"
                : "";
        Blue blue = new Blue();
        return blue.yamlToNode("name: Workflow Operation Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  ownerChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: owner-42\n" +
                "  otherChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: other-42\n" +
                "  increment:\n" +
                "    type:\n" +
                "      blueId: " + operationTypeBlueId + "\n" +
                operationChannelYaml +
                "    request:\n" +
                indent(requestTypeYaml, 6) + "\n" +
                "  operationWorkflow:\n" +
                "    type:\n" +
                "      blueId: " + handlerTypeBlueId + "\n" +
                handlerChannelYaml +
                "    operation: increment\n" +
                handlerEventSection +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"" + stepExpression + "\"\n");
    }

    private Node operationRequestEvent(Blue blue,
                                       String operation,
                                       Object request,
                                       boolean allowNewerVersion,
                                       String documentBlueId,
                                       String timelineId) {
        return operationRequestEventWithOptionalAllowNewer(
                blue, operation, request, Boolean.valueOf(allowNewerVersion), documentBlueId, timelineId);
    }

    private Node operationRequestEventWithOptionalAllowNewer(Blue blue,
                                                             String operation,
                                                             Object request,
                                                             Boolean allowNewerVersion,
                                                             String documentBlueId,
                                                             String timelineId) {
        Node message = new Node().type(new Node().blueId("Conversation/Operation Request"))
                .properties("operation", new Node().value(operation))
                .properties("request", requestNode(request));
        if (allowNewerVersion != null) {
            message.properties("allowNewerVersion", new Node().value(allowNewerVersion.booleanValue()));
        }
        if (documentBlueId != null) {
            message.properties("document", new Node().properties("blueId", new Node().value(documentBlueId)));
        }

        return new Node().type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("eventId", new Node().value("evt-op"))
                .properties("timeline", new Node().properties("timelineId", new Node().value(timelineId)))
                .properties("message", message);
    }

    private Node requestNode(Object request) {
        Node node = new Node().value(request);
        if (request instanceof Number) {
            node.type(new Node().blueId(Properties.INTEGER_TYPE_BLUE_ID));
        } else if (request instanceof String) {
            node.type(new Node().blueId(Properties.TEXT_TYPE_BLUE_ID));
        } else if (request instanceof Boolean) {
            node.type(new Node().blueId(Properties.BOOLEAN_TYPE_BLUE_ID));
        }
        return node;
    }

    private String storedDocumentBlueId(Node document) {
        return String.valueOf(document.getProperties()
                .get("contracts")
                .getProperties()
                .get("initialized")
                .getProperties()
                .get("documentId")
                .getValue());
    }

    private String indent(String block, int spaces) {
        StringBuilder builder = new StringBuilder();
        String prefix = new String(new char[spaces]).replace('\0', ' ');
        String[] lines = block.split("\\r?\\n");
        for (int i = 0; i < lines.length; i++) {
            if (i > 0) {
                builder.append('\n');
            }
            builder.append(prefix).append(lines[i]);
        }
        return builder.toString();
    }
}
