package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TriggerEventStepLeakageReproIntegrationTest {

    @Test
    void doesNotEvaluateExpressionsInsideNestedDocumentInTriggerEventPayload() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Leakage Repro Doc\n" +
                "counter: 0\n" +
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
                "      - name: EmitStartWithChildDoc\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: start-session\n" +
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
                "                  - name: IncreaseCounter\n" +
                "                    type:\n" +
                "                      blueId: Conversation/Update Document\n" +
                "                    changeset:\n" +
                "                      - op: replace\n" +
                "                        path: /counter\n" +
                "                        val: \"${document('counter') + event.request.value}\"\n");

        DocumentProcessingResult result = blue.initializeDocument(document);
        assertFalse(result.capabilityFailure(), "Initialization should succeed");

        List<Node> emissions = result.triggeredEvents();
        assertTrue(emissions.size() > 0);
        List<Node> chatEvents = emissions.stream()
                .filter(e -> "Conversation/Chat Message".equals(typeBlueId(e)))
                .toList();
        assertEquals(1, chatEvents.size());

        Node expressionNode = ProcessorEngine.nodeAt(
                chatEvents.get(0),
                "/document/contracts/incrementImpl/steps/0/changeset/0/val");
        assertNotNull(expressionNode);
        assertEquals("${document('counter') + event.request.value}", String.valueOf(expressionNode.getValue()));
    }

    @Test
    void doesNotEvaluateExpressionsWhenTriggerEventPayloadComesFromDocumentSnapshot() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Leakage Repro Doc With Root Event\n" +
                "counter: 0\n" +
                "eventToTrigger:\n" +
                "  type:\n" +
                "    blueId: Conversation/Chat Message\n" +
                "  message: start-session\n" +
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
                "          - name: IncreaseCounter\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: replace\n" +
                "                path: /counter\n" +
                "                val: \"${document('counter') + event.request.value}\"\n" +
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
                "      - name: EmitStartWithSnapshot\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event: \"${document('/eventToTrigger')}\"\n");

        DocumentProcessingResult result = blue.initializeDocument(document);
        assertFalse(result.capabilityFailure(), "Initialization should succeed");

        List<Node> emissions = result.triggeredEvents();
        assertTrue(emissions.size() > 0);
        List<Node> chatEvents = emissions.stream()
                .filter(e -> "Conversation/Chat Message".equals(typeBlueId(e)))
                .toList();
        assertEquals(1, chatEvents.size());

        Node expressionNode = ProcessorEngine.nodeAt(
                chatEvents.get(0),
                "/document/contracts/incrementImpl/steps/0/changeset/0/val");
        assertNotNull(expressionNode);
        assertEquals("${document('counter') + event.request.value}", String.valueOf(expressionNode.getValue()));
    }

    private String typeBlueId(Node node) {
        if (node == null || node.getType() == null) {
            return typeBlueIdFromTypeNode(node != null && node.getProperties() != null
                    ? node.getProperties().get("type")
                    : null);
        }
        String fromType = typeBlueIdFromTypeNode(node.getType());
        return fromType != null ? fromType : typeBlueIdFromTypeNode(node.getProperties() != null
                ? node.getProperties().get("type")
                : null);
    }

    private String typeBlueIdFromTypeNode(Node typeNode) {
        if (typeNode == null) {
            return null;
        }
        if (typeNode.getBlueId() != null) {
            return typeNode.getBlueId();
        }
        if (typeNode.getValue() != null) {
            return String.valueOf(typeNode.getValue());
        }
        if (typeNode.getProperties() != null && typeNode.getProperties().get("blueId") != null) {
            Object value = typeNode.getProperties().get("blueId").getValue();
            if (value != null) {
                return String.valueOf(value);
            }
        }
        return null;
    }
}
