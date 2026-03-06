package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class SharedTimelineCheckpointIntegrationTest {

    @Test
    void reprocessesEventsWhenChannelCheckpointIsCleared() {
        Blue blue = new Blue();
        String timelineId = "checkpoint-reset-timeline";
        Node document = blue.yamlToNode("name: Checkpoint Reset Doc\n" +
                "counter: 0\n" +
                "contracts:\n" +
                "  timelineChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: " + timelineId + "\n" +
                "  counterWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: timelineChannel\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${document('counter') + 1}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node processed = processEntries(blue, initialized, timelineId, "entry", 3);
        assertEquals(new BigInteger("3"), processed.getProperties().get("counter").getValue());

        Node reset = processed.clone();
        clearCheckpoint(reset, "/contracts/checkpoint", "timelineChannel");

        Node replayed = processEntries(blue, reset, timelineId, "entry", 3);
        assertEquals(new BigInteger("6"), replayed.getProperties().get("counter").getValue());
    }

    @Test
    void clearingChildCheckpointReplaysSharedTimelineOnlyInChildScope() {
        Blue blue = new Blue();
        String timelineId = "shared-checkpoint-scope-isolation";
        Node document = blue.yamlToNode("name: Shared Checkpoint Isolation Doc\n" +
                "rootCounter: 0\n" +
                "child:\n" +
                "  childCounter: 0\n" +
                "  contracts:\n" +
                "    childChannel:\n" +
                "      type:\n" +
                "        blueId: Conversation/Timeline Channel\n" +
                "      timelineId: " + timelineId + "\n" +
                "    childWorkflow:\n" +
                "      type:\n" +
                "        blueId: Conversation/Sequential Workflow\n" +
                "      channel: childChannel\n" +
                "      steps:\n" +
                "        - type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /childCounter\n" +
                "              val: \"${document('childCounter') + 1}\"\n" +
                "contracts:\n" +
                "  processEmbedded:\n" +
                "    type:\n" +
                "      blueId: Process Embedded\n" +
                "    paths:\n" +
                "      - /child\n" +
                "  rootChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: " + timelineId + "\n" +
                "  rootWorkflow:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: rootChannel\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /rootCounter\n" +
                "            val: \"${document('rootCounter') + 1}\"\n");

        Node initialized = blue.initializeDocument(document).document();
        Node processed = processEntries(blue, initialized, timelineId, "shared-entry", 3);
        assertEquals(new BigInteger("3"), processed.getProperties().get("rootCounter").getValue());
        assertEquals(new BigInteger("3"), processed.getProperties().get("child")
                .getProperties().get("childCounter").getValue());

        Node resetChildOnly = processed.clone();
        clearCheckpoint(resetChildOnly, "/child/contracts/checkpoint", "childChannel");
        Node childLastSignatures = ProcessorEngine.nodeAt(resetChildOnly, "/child/contracts/checkpoint/lastSignatures/childChannel");
        Node rootLastSignatures = ProcessorEngine.nodeAt(resetChildOnly, "/contracts/checkpoint/lastSignatures/rootChannel");
        assertNull(childLastSignatures);
        assertNotNull(rootLastSignatures);

        Node replayed = processEntries(blue, resetChildOnly, timelineId, "shared-entry", 3);
        assertEquals(new BigInteger("3"), replayed.getProperties().get("rootCounter").getValue());
        assertEquals(new BigInteger("6"), replayed.getProperties().get("child")
                .getProperties().get("childCounter").getValue());
    }

    private Node processEntries(Blue blue, Node startDocument, String timelineId, String idPrefix, int count) {
        Node document = startDocument;
        for (int i = 0; i < count; i++) {
            Node entry = timelineEntry(timelineId, idPrefix + "-" + i, i);
            document = blue.processDocument(document.clone(), entry).document();
        }
        return document;
    }

    private Node timelineEntry(String timelineId, String eventId, int sequence) {
        Node event = new Node().type(new Node().blueId("Conversation/Timeline Entry"));
        event.properties("eventId", new Node().value(eventId));
        event.properties("sequence", new Node().value(sequence));
        event.properties("timeline", new Node().properties("timelineId", new Node().value(timelineId)));
        event.properties("message", new Node()
                .type(new Node().blueId("Conversation/Chat Message"))
                .properties("message", new Node().value("1")));
        return event;
    }

    private void clearCheckpoint(Node document, String checkpointPointer, String channelKey) {
        Node checkpoint = ProcessorEngine.nodeAt(document, checkpointPointer);
        if (checkpoint == null || checkpoint.getProperties() == null) {
            return;
        }
        Node lastEvents = checkpoint.getProperties().get("lastEvents");
        if (lastEvents != null && lastEvents.getProperties() != null) {
            Map<String, Node> updated = new java.util.LinkedHashMap<>(lastEvents.getProperties());
            updated.remove(channelKey);
            lastEvents.properties(updated);
        }
        Node lastSignatures = checkpoint.getProperties().get("lastSignatures");
        if (lastSignatures != null && lastSignatures.getProperties() != null) {
            Map<String, Node> updated = new java.util.LinkedHashMap<>(lastSignatures.getProperties());
            updated.remove(channelKey);
            lastSignatures.properties(updated);
        }
    }
}
