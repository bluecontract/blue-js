package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DynamicWorkflowRegistrationIntegrationTest {

    @Test
    void executesDynamicallyAddedWorkflowOnlyInLaterProcessingCycle() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Dynamic Workflow Doc\n" +
                "counter: 0\n" +
                "dynamicRan: 0\n" +
                "staticRan: 0\n" +
                "contracts:\n" +
                "  timeline:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: alpha\n" +
                "  counterUpdate:\n" +
                "    type:\n" +
                "      blueId: Document Update Channel\n" +
                "    path: /counter\n" +
                "  staticWatcher:\n" +
                "    channel: counterUpdate\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /staticRan\n" +
                "            val: 1\n" +
                "  mutateContracts:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: timeline\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: ADD\n" +
                "            path: /contracts/newWorkflow\n" +
                "            val:\n" +
                "              type:\n" +
                "                blueId: Conversation/Sequential Workflow\n" +
                "              channel: counterUpdate\n" +
                "              steps:\n" +
                "                - type:\n" +
                "                    blueId: Conversation/Update Document\n" +
                "                  changeset:\n" +
                "                    - op: REPLACE\n" +
                "                      path: /dynamicRan\n" +
                "                      val: 1\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${document('/counter') + 1}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        DocumentProcessingResult afterFirst = blue.processDocument(initialized.clone(), timelineEntry("evt-1", "mutate contracts"));

        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(afterFirst.document(), "/counter").getValue());
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(afterFirst.document(), "/staticRan").getValue());
        assertEquals(new BigInteger("0"), ProcessorEngine.nodeAt(afterFirst.document(), "/dynamicRan").getValue());
        assertNotNull(ProcessorEngine.nodeAt(afterFirst.document(), "/contracts/newWorkflow"));

        DocumentProcessingResult afterSecond = blue.processDocument(afterFirst.document().clone(), timelineEntry("evt-2", "mutate contracts again"));
        assertEquals(new BigInteger("2"), ProcessorEngine.nodeAt(afterSecond.document(), "/counter").getValue());
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(afterSecond.document(), "/staticRan").getValue());
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(afterSecond.document(), "/dynamicRan").getValue());
    }

    private Node timelineEntry(String eventId, String messageText) {
        return new Node()
                .type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("eventId", new Node().value(eventId))
                .properties("timeline", new Node().properties("timelineId", new Node().value("alpha")))
                .properties("message", new Node()
                        .type(new Node().blueId("Conversation/Chat Message"))
                        .properties("text", new Node().value(messageText)));
    }
}
