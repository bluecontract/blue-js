package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ProcessProtectedPathRemovalTerminatesRootIntegrationTest {

    @Test
    void terminatesRootScopeWhenRemovingEmbeddedPathAtRuntime() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Toggle Embedded Doc\n" +
                "child:\n" +
                "  count: 0\n" +
                "  contracts:\n" +
                "    childTimeline:\n" +
                "      type:\n" +
                "        blueId: Conversation/Timeline Channel\n" +
                "      timelineId: child\n" +
                "    incrementChild:\n" +
                "      type:\n" +
                "        blueId: Conversation/Sequential Workflow\n" +
                "      channel: childTimeline\n" +
                "      steps:\n" +
                "        - name: IncrementChild\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /count\n" +
                "              val: \"${document('count') + 1}\"\n" +
                "contracts:\n" +
                "  rootTimeline:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: root\n" +
                "  embedded:\n" +
                "    type:\n" +
                "      blueId: Process Embedded\n" +
                "    paths:\n" +
                "      - /child\n" +
                "  removeEmbeddedPath:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: rootTimeline\n" +
                "    order: 1\n" +
                "    steps:\n" +
                "      - name: RemoveMarker\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REMOVE\n" +
                "            path: /contracts/embedded/paths/0\n" +
                "  rootWriteAttempt:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: rootTimeline\n" +
                "    order: 2\n" +
                "    steps:\n" +
                "      - name: RootIncrement\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /child/count\n" +
                "            val: \"${document('/child/count') + 1}\"\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        assertFalse(initialized.capabilityFailure(), "Initialization should succeed");

        DocumentProcessingResult afterToggle = blue.processDocument(
                initialized.document(),
                timelineEntry("evt-protected-removal", "root", "remove embedded path"));
        assertFalse(afterToggle.capabilityFailure(), "Processing should succeed");

        Node termination = ProcessorEngine.nodeAt(afterToggle.document(), "/contracts/terminated");
        assertNotNull(termination, "Root termination marker should exist");
        assertEquals("fatal", String.valueOf(ProcessorEngine.nodeAt(afterToggle.document(), "/contracts/terminated/cause").getValue()));
        assertEquals(new BigInteger("0"), ProcessorEngine.nodeAt(afterToggle.document(), "/child/count").getValue());
    }

    private Node timelineEntry(String eventId, String timelineId, String messageText) {
        return new Node()
                .type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("eventId", new Node().value(eventId))
                .properties("timeline", new Node().properties("timelineId", new Node().value(timelineId)))
                .properties("message", new Node()
                        .type(new Node().blueId("Conversation/Chat Message"))
                        .properties("text", new Node().value(messageText)));
    }
}
