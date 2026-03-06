package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JavaScriptCodeStepExecutorIntegrationParityTest {

    @Test
    void runsJavaScriptCodeOnLifecycleInitAndEmitsEventPayload() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: JS Code Workflow Doc\n" +
                "contracts:\n" +
                "  life:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  onInit:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: life\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - name: Compute\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          return { value: 12 };\n" +
                "      - name: Emit\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          const result = steps.Compute.value + 8;\n" +
                "          return {\n" +
                "            events: [\n" +
                "              {\n" +
                "                type: 'Conversation/Chat Message',\n" +
                "                message: 'Result is ' + result\n" +
                "              }\n" +
                "            ]\n" +
                "          };\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        List<Node> chatEvents = result.triggeredEvents().stream()
                .filter(event -> "Conversation/Chat Message".equals(typeBlueId(event)))
                .toList();
        assertEquals(1, chatEvents.size());
        assertEquals("Result is 20", String.valueOf(chatEvents.get(0).getProperties().get("message").getValue()));
    }

    @Test
    void wrapsThrownErrorsFromJavaScriptStepAsFatalTermination() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: JS Code Workflow Doc Error\n" +
                "contracts:\n" +
                "  life:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  onInit:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: life\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - name: Boom\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          throw new Error('boom');\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        Node terminated = result.document().getProperties().get("contracts").getProperties().get("terminated");
        assertNotNull(terminated);
        assertEquals("fatal", String.valueOf(terminated.getProperties().get("cause").getValue()));
        assertTrue(String.valueOf(terminated.getProperties().get("reason").getValue())
                .contains("Failed to evaluate code block"));

        List<Node> terminationEvents = result.triggeredEvents().stream()
                .filter(event -> "Document Processing Terminated".equals(typeBlueId(event)))
                .toList();
        assertEquals(1, terminationEvents.size());
        assertEquals("fatal", String.valueOf(terminationEvents.get(0).getProperties().get("cause").getValue()));
        assertTrue(String.valueOf(terminationEvents.get(0).getProperties().get("reason").getValue())
                .contains("Failed to evaluate code block"));
    }

    @Test
    void deliversJavaScriptEmittedEventsToTriggeredEventChannelConsumers() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: JS Code Triggers Triggered Channel\n" +
                "contracts:\n" +
                "  life:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  trig:\n" +
                "    type:\n" +
                "      blueId: Triggered Event Channel\n" +
                "  producer:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: life\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - name: EmitStatus\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          return {\n" +
                "            events: [\n" +
                "              { type: 'Conversation/Status Completed' }\n" +
                "            ]\n" +
                "          };\n" +
                "  consumer:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: trig\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Conversation/Status Completed\n" +
                "    steps:\n" +
                "      - name: EmitChat\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          return {\n" +
                "            events: [\n" +
                "              {\n" +
                "                type: 'Conversation/Chat Message',\n" +
                "                message: 'Triggered via Triggered Event Channel'\n" +
                "              }\n" +
                "            ]\n" +
                "          };\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        long completedCount = result.triggeredEvents().stream()
                .filter(event -> "Conversation/Status Completed".equals(typeBlueId(event)))
                .count();
        assertEquals(1, completedCount);

        List<Node> chatEvents = result.triggeredEvents().stream()
                .filter(event -> "Conversation/Chat Message".equals(typeBlueId(event)))
                .toList();
        assertEquals(1, chatEvents.size());
        assertEquals("Triggered via Triggered Event Channel",
                String.valueOf(chatEvents.get(0).getProperties().get("message").getValue()));
    }

    private String typeBlueId(Node node) {
        if (node == null) {
            return null;
        }
        if (node.getType() != null) {
            if (node.getType().getBlueId() != null) {
                return node.getType().getBlueId();
            }
            if (node.getType().getProperties() != null && node.getType().getProperties().get("blueId") != null) {
                Object value = node.getType().getProperties().get("blueId").getValue();
                return value != null ? String.valueOf(value) : null;
            }
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
