package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class TriggerEventStepExecutorIntegrationParityTest {

    @Test
    void emitsEventsDuringInitializationWorkflows() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Trigger Event Workflow\n" +
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
                "      - name: EmitWelcome\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: Welcome!\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        List<Node> chatEvents = result.triggeredEvents().stream()
                .filter(event -> "Conversation/Chat Message".equals(typeBlueId(event)))
                .toList();
        assertEquals(1, chatEvents.size());
        assertEquals("Welcome!", String.valueOf(chatEvents.get(0).getProperties().get("message").getValue()));
    }

    @Test
    void deliversTriggerEventPayloadsToTriggeredEventChannelConsumers() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Trigger Event produces and consumes triggered events\n" +
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
                "      - name: EmitCompleted\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Status Completed\n" +
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
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: Triggered via Triggered Event Channel\n");

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

    @Test
    void resolvesExpressionsWithinTriggerEventPayloads() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Trigger Event resolves expressions\n" +
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
                "      - name: PreparePayment\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          return {\n" +
                "            amount: 125,\n" +
                "            description: 'Subscription renewal'\n" +
                "          };\n" +
                "      - name: EmitPayment\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: \"${steps.PreparePayment.description} for ${steps.PreparePayment.amount} USD\"\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        List<Node> chatEvents = result.triggeredEvents().stream()
                .filter(event -> "Conversation/Chat Message".equals(typeBlueId(event)))
                .toList();
        assertEquals(1, chatEvents.size());
        assertEquals("Subscription renewal for 125 USD",
                String.valueOf(chatEvents.get(0).getProperties().get("message").getValue()));
    }

    @Test
    void exposesCurrentContractForTriggerEventExpressions() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Trigger Event uses current contract\n" +
                "contracts:\n" +
                "  life:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  onInit:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: life\n" +
                "    description: Init workflow\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - name: EmitFromContract\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: \"${currentContract.description}\"\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        List<Node> chatEvents = result.triggeredEvents().stream()
                .filter(event -> "Conversation/Chat Message".equals(typeBlueId(event)))
                .toList();
        assertEquals(1, chatEvents.size());
        assertEquals("Init workflow", String.valueOf(chatEvents.get(0).getProperties().get("message").getValue()));
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
        if (node.getProperties() == null || node.getProperties().get("type") == null) {
            return null;
        }
        Node type = node.getProperties().get("type");
        if (type.getProperties() != null && type.getProperties().get("blueId") != null) {
            return String.valueOf(type.getProperties().get("blueId").getValue());
        }
        return type.getValue() != null ? String.valueOf(type.getValue()) : null;
    }
}
