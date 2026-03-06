package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class SequentialWorkflowHandlerProcessorIntegrationParityTest {

    @Test
    void emitsEventsDefinedByTriggerEventSteps() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Sequential Workflow Document\n" +
                "contracts:\n" +
                "  timelineChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: alice\n" +
                "  emitNotification:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: timelineChannel\n" +
                "    steps:\n" +
                "      - name: EmitGreeting\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: Workflow says hi\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        DocumentProcessingResult result = blue.processDocument(
                initialized.document().clone(),
                timelineEntryEvent(blue, "alice", "Conversation/Chat Message", "hello"));

        assertFalse(result.capabilityFailure());
        List<Node> chatEvents = result.triggeredEvents().stream()
                .filter(event -> "Conversation/Chat Message".equals(typeBlueId(event)))
                .toList();
        assertEquals(1, chatEvents.size());
        assertEquals("Workflow says hi", String.valueOf(chatEvents.get(0).getProperties().get("message").getValue()));
    }

    @Test
    void respectsEventFiltersWhenProvided() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Sequential Workflow Document\n" +
                "contracts:\n" +
                "  timelineChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: alice\n" +
                "  emitNotification:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: timelineChannel\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Conversation/Chat Message\n" +
                "    steps:\n" +
                "      - name: EmitGreeting\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: Workflow says hi\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        DocumentProcessingResult matching = blue.processDocument(
                initialized.document().clone(),
                timelineEntryEvent(blue, "alice", "Conversation/Chat Message", "eligible"));
        assertEquals(1, matching.triggeredEvents().size());

        DocumentProcessingResult nonMatching = blue.processDocument(
                matching.document().clone(),
                timelineEntryEvent(blue, "alice", "Conversation/Request", "req-123"));
        assertEquals(0, nonMatching.triggeredEvents().size());
    }

    @Test
    void runsForAllChannelMatchedEventsWhenNoEventFilterIsProvided() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Sequential Workflow Document\n" +
                "contracts:\n" +
                "  timelineChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: alice\n" +
                "  emitNotification:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: timelineChannel\n" +
                "    steps:\n" +
                "      - name: EmitGreeting\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: Workflow says hi\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        DocumentProcessingResult chatResult = blue.processDocument(
                initialized.document().clone(),
                timelineEntryEvent(blue, "alice", "Conversation/Chat Message", "eligible"));
        assertEquals(1, chatResult.triggeredEvents().size());

        DocumentProcessingResult requestResult = blue.processDocument(
                chatResult.document().clone(),
                timelineEntryEvent(blue, "alice", "Conversation/Request", "accept-me"));
        assertEquals(1, requestResult.triggeredEvents().size());
    }

    @Test
    void requiresEventsToSatisfyBothChannelAndWorkflowFilters() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Sequential Workflow With Combined Filters\n" +
                "contracts:\n" +
                "  timelineChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: alice\n" +
                "    event:\n" +
                "      message:\n" +
                "        type:\n" +
                "          blueId: Conversation/Chat Message\n" +
                "  emitNotification:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: timelineChannel\n" +
                "    event:\n" +
                "      message:\n" +
                "        message: eligible\n" +
                "    steps:\n" +
                "      - name: EmitGreeting\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: Workflow says hi\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        DocumentProcessingResult matching = blue.processDocument(
                initialized.document().clone(),
                timelineEntryEvent(blue, "alice", "Conversation/Chat Message", "eligible"));
        assertEquals(1, matching.triggeredEvents().size());

        DocumentProcessingResult nonMatching = blue.processDocument(
                matching.document().clone(),
                timelineEntryEvent(blue, "alice", "Conversation/Chat Message", "ignored"));
        assertEquals(0, nonMatching.triggeredEvents().size());
    }

    private Node timelineEntryEvent(Blue blue, String timelineId, String messageTypeBlueId, String payloadValue) {
        String payloadProperty = "Conversation/Request".equals(messageTypeBlueId) ? "requestId" : "message";
        return blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "timeline:\n" +
                "  timelineId: " + timelineId + "\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: " + messageTypeBlueId + "\n" +
                "  " + payloadProperty + ": " + payloadValue + "\n");
    }

    private String typeBlueId(Node node) {
        if (node == null) {
            return null;
        }
        if (node.getType() != null && node.getType().getBlueId() != null) {
            return node.getType().getBlueId();
        }
        if (node.getProperties() != null && node.getProperties().get("type") != null) {
            Node type = node.getProperties().get("type");
            if (type.getProperties() != null && type.getProperties().get("blueId") != null) {
                Object value = type.getProperties().get("blueId").getValue();
                return value != null ? String.valueOf(value) : null;
            }
            if (type.getValue() != null) {
                return String.valueOf(type.getValue());
            }
        }
        return null;
    }
}
