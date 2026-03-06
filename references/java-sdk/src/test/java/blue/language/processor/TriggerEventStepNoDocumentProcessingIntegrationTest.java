package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TriggerEventStepNoDocumentProcessingIntegrationTest {

    @Test
    void doesNotProcessNestedDocumentContractsInsideTriggerEventPayload() {
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
