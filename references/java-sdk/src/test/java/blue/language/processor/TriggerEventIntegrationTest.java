package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class TriggerEventIntegrationTest {

    @Test
    void triggerEventNestedDocumentPayloadIsNotProcessedAsDocument() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Trigger Event Nested Document\n" +
                "contracts:\n" +
                "  timeline:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: admin\n" +
                "  triggered:\n" +
                "    type:\n" +
                "      blueId: Triggered Event Channel\n" +
                "  onTimeline:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: timeline\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Conversation/Chat Message\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: start\n" +
                "          document:\n" +
                "            name: Child Worker Session\n" +
                "            contracts:\n" +
                "              nestedTimeline:\n" +
                "                type:\n" +
                "                  blueId: Conversation/Timeline Channel\n" +
                "                timelineId: child\n" +
                "              nestedWorkflow:\n" +
                "                type:\n" +
                "                  blueId: Conversation/Sequential Workflow\n" +
                "                channel: nestedTimeline\n" +
                "                steps: []\n");

        Node initialized = blue.initializeDocument(document).document();
        Node externalTimelineEvent = blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "timeline:\n" +
                "  timelineId: admin\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: Conversation/Chat Message\n" +
                "  message: hello\n");

        DocumentProcessingResult processed = blue.processDocument(initialized, externalTimelineEvent);
        assertTrue(processed.triggeredEvents().size() > 0);
        long chatEvents = processed.triggeredEvents().stream()
                .filter(event -> "Conversation/Chat Message".equals(typeBlueId(event)))
                .count();
        assertEquals(1L, chatEvents);
    }

    @Test
    void triggerEventNestedDocumentPayloadPreservesExpressions() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Trigger Event Nested Document Expression Preserved Doc\n" +
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
                "          kind: start-session\n" +
                "          document:\n" +
                "            name: Child Session\n" +
                "            counter: 0\n" +
                "            contracts:\n" +
                "              increment:\n" +
                "                type:\n" +
                "                  blueId: Conversation/Operation\n" +
                "                request:\n" +
                "                  type: Integer\n" +
                "              incrementImpl:\n" +
                "                type:\n" +
                "                  blueId: Conversation/Sequential Workflow Operation\n" +
                "                operation: increment\n" +
                "                steps:\n" +
                "                  - type:\n" +
                "                      blueId: Conversation/Update Document\n" +
                "                    changeset:\n" +
                "                      - op: REPLACE\n" +
                "                        path: /counter\n" +
                "                        val: \"${document('counter') + event.request.value}\"\n");

        blue.registerContractProcessor(new blue.language.processor.contracts.TestEventChannelProcessor());
        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-trigger-nested\n" +
                "kind: TestEvent\n");

        DocumentProcessingResult processed = blue.processDocument(initialized, event);
        Node emitted = findTriggeredEventByKind(processed, "start-session");
        assertNotNull(emitted, "Expected emitted start-session event");

        Node expressionNode = ProcessorEngine.nodeAt(
                emitted,
                "/document/contracts/incrementImpl/steps/0/changeset/0/val");
        assertNotNull(expressionNode);
        assertEquals("${document('counter') + event.request.value}", String.valueOf(expressionNode.getValue()));
    }

    @Test
    void triggerEventSnapshotPayloadPreservesNestedDocumentExpressions() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Trigger Event Snapshot Expression Preserved Doc\n" +
                "eventToTrigger:\n" +
                "  type:\n" +
                "    blueId: Conversation/Chat Message\n" +
                "  kind: start-session\n" +
                "  document:\n" +
                "    name: Child Session\n" +
                "    counter: 0\n" +
                "    contracts:\n" +
                "      increment:\n" +
                "        type:\n" +
                "          blueId: Conversation/Operation\n" +
                "        request:\n" +
                "          type: Integer\n" +
                "      incrementImpl:\n" +
                "        type:\n" +
                "          blueId: Conversation/Sequential Workflow Operation\n" +
                "        operation: increment\n" +
                "        steps:\n" +
                "          - type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /counter\n" +
                "                val: \"${document('counter') + event.request.value}\"\n" +
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
                "        event: \"${document('/eventToTrigger')}\"\n");

        blue.registerContractProcessor(new blue.language.processor.contracts.TestEventChannelProcessor());
        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-trigger-snapshot\n" +
                "kind: TestEvent\n");

        DocumentProcessingResult processed = blue.processDocument(initialized, event);
        Node emitted = findTriggeredEventByKind(processed, "start-session");
        assertNotNull(emitted, "Expected emitted start-session event");

        Node expressionNode = ProcessorEngine.nodeAt(
                emitted,
                "/document/contracts/incrementImpl/steps/0/changeset/0/val");
        assertNotNull(expressionNode);
        assertEquals("${document('counter') + event.request.value}", String.valueOf(expressionNode.getValue()));
    }

    private Node findTriggeredEventByKind(DocumentProcessingResult result, String kind) {
        for (Node event : result.triggeredEvents()) {
            Node kindNode = event != null && event.getProperties() != null
                    ? event.getProperties().get("kind")
                    : null;
            if (kindNode == null || kindNode.getValue() == null) {
                continue;
            }
            if (kind.equals(String.valueOf(kindNode.getValue()))) {
                return event;
            }
        }
        return null;
    }

    private String typeBlueId(Node node) {
        if (node == null || node.getType() == null) {
            return null;
        }
        if (node.getType().getBlueId() != null) {
            return node.getType().getBlueId();
        }
        if (node.getType().getProperties() != null && node.getType().getProperties().get("blueId") != null) {
            Object value = node.getType().getProperties().get("blueId").getValue();
            return value != null ? String.valueOf(value) : null;
        }
        return null;
    }
}
