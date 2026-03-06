package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class EmbeddedRoutingBridgeIntegrationTest {

    @Test
    void routesSharedTimelineEntriesThroughEmbeddedWorkflowsAndBridgesEmittedEvents() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Timeline Routing Doc\n" +
                "x: 0\n" +
                "sub1:\n" +
                "  name: Sub Workflow Doc\n" +
                "  x: 1\n" +
                "  contracts:\n" +
                "    alice:\n" +
                "      type:\n" +
                "        blueId: Conversation/Timeline Channel\n" +
                "      timelineId: alice\n" +
                "    subWorkflow:\n" +
                "      type:\n" +
                "        blueId: Conversation/Sequential Workflow\n" +
                "      channel: alice\n" +
                "      steps:\n" +
                "        - name: UpdateSubX\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /x\n" +
                "              val: 2\n" +
                "        - name: EmitPayment\n" +
                "          type:\n" +
                "            blueId: Conversation/Trigger Event\n" +
                "          event:\n" +
                "            type:\n" +
                "              blueId: Conversation/Chat Message\n" +
                "            message: Payment Succeeded for Alice\n" +
                "sub2:\n" +
                "  y: 1\n" +
                "contracts:\n" +
                "  embeddedSub1:\n" +
                "    type:\n" +
                "      blueId: Process Embedded\n" +
                "    paths:\n" +
                "      - /sub1\n" +
                "  sub1Bridge:\n" +
                "    type:\n" +
                "      blueId: Embedded Node Channel\n" +
                "    childPath: /sub1\n" +
                "  alice:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: alice\n" +
                "  workflowRootSetOne:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: alice\n" +
                "    order: 0\n" +
                "    steps:\n" +
                "      - name: SetRootOne\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /x\n" +
                "            val: 1\n" +
                "  workflowRootSetFive:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: alice\n" +
                "    order: 1\n" +
                "    steps:\n" +
                "      - name: SetRootFive\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /x\n" +
                "            val: 5\n" +
                "  workflowFromSub:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: sub1Bridge\n" +
                "    steps:\n" +
                "      - name: SetRootTen\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /x\n" +
                "            val: 10\n" +
                "      - name: ReEmitPayment\n" +
                "        type:\n" +
                "          blueId: Conversation/Trigger Event\n" +
                "        event:\n" +
                "          type:\n" +
                "            blueId: Conversation/Chat Message\n" +
                "          message: Payment Succeeded for Alice\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        assertFalse(initialized.capabilityFailure(), "Initialization should succeed");

        DocumentProcessingResult processed = blue.processDocument(
                initialized.document().clone(),
                timelineEntry("evt-routing-1", "alice", "External trigger for alice"));

        assertFalse(processed.capabilityFailure(), "Processing should succeed");
        assertEquals(new BigInteger("10"), ProcessorEngine.nodeAt(processed.document(), "/x").getValue());
        assertEquals(new BigInteger("2"), ProcessorEngine.nodeAt(processed.document(), "/sub1/x").getValue());
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(processed.document(), "/sub2/y").getValue());

        assertEquals(1, processed.triggeredEvents().size());
        Node emitted = processed.triggeredEvents().get(0);
        assertNotNull(emitted);
        assertEquals("Conversation/Chat Message", typeBlueId(emitted));
        assertEquals("Payment Succeeded for Alice", ProcessorEngine.nodeAt(emitted, "/message").getValue());
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
