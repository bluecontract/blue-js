package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.contracts.TestEventChannelProcessor;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CompositeTimelineChannelIntegrationParityTest {

    @Test
    void exposesCompositeSourceChannelKeyToJavaScriptWorkflowSteps() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());

        Node document = blue.yamlToNode("name: Composite JS Workflow Doc\n" +
                "contracts:\n" +
                "  childA:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "    eventType: TestEvent\n" +
                "  childB:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "    eventType: TestEvent\n" +
                "  compositeChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Composite Timeline Channel\n" +
                "    channels: [childA, childB]\n" +
                "  workflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: compositeChannel\n" +
                "    steps:\n" +
                "      - name: Branch\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          const raw = event.meta?.compositeSourceChannelKey;\n" +
                "          if (raw === 'childA') {\n" +
                "            return {\n" +
                "              events: [\n" +
                "                {\n" +
                "                  type: 'Conversation/Chat Message',\n" +
                "                  message: 'from childA'\n" +
                "                }\n" +
                "              ]\n" +
                "            };\n" +
                "          }\n" +
                "          if (raw === 'childB') {\n" +
                "            return {\n" +
                "              events: [\n" +
                "                {\n" +
                "                  type: 'Conversation/Chat Message',\n" +
                "                  message: 'from childB'\n" +
                "                }\n" +
                "              ]\n" +
                "            };\n" +
                "          }\n" +
                "          return { events: [] };\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-meta-check\n" +
                "kind: meta-check\n");

        DocumentProcessingResult result = blue.processDocument(initialized.document().clone(), event);

        assertFalse(result.capabilityFailure());
        List<String> messages = result.triggeredEvents().stream()
                .filter(entry -> "Conversation/Chat Message".equals(typeBlueId(entry)))
                .map(entry -> String.valueOf(entry.getProperties().get("message").getValue()))
                .collect(Collectors.toList());

        assertEquals(2, messages.size());
        assertTrue(messages.contains("from childA"));
        assertTrue(messages.contains("from childB"));
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
