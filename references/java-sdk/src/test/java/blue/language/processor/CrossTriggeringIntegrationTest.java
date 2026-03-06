package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

class CrossTriggeringIntegrationTest {

    @Test
    void propagatesNestedUpdatesThroughDocumentUpdateChannelsWithoutBoundaryBreaches() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Cross Trigger Doc\n" +
                "rootCounter: 0\n" +
                "rootLastPath: none\n" +
                "groupA:\n" +
                "  counter: 0\n" +
                "  lastTriggered: none\n" +
                "  subA:\n" +
                "    score: 2\n" +
                "    lastEvent: none\n" +
                "    contracts:\n" +
                "      subTimeline:\n" +
                "        type:\n" +
                "          blueId: Conversation/Timeline Channel\n" +
                "        timelineId: sub-a\n" +
                "      subWorkflow:\n" +
                "        type:\n" +
                "          blueId: Conversation/Sequential Workflow\n" +
                "        channel: subTimeline\n" +
                "        steps:\n" +
                "          - name: IncrementScore\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /score\n" +
                "                val: \"${document('score') + 2}\"\n" +
                "          - name: RecordHandled\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /lastEvent\n" +
                "                val: handled\n" +
                "  contracts:\n" +
                "    embeddedSubA:\n" +
                "      type:\n" +
                "        blueId: Process Embedded\n" +
                "      paths:\n" +
                "        - /subA\n" +
                "    subAScoreUpdates:\n" +
                "      type:\n" +
                "        blueId: Document Update Channel\n" +
                "      path: /subA/score\n" +
                "    onSubAScoreUpdate:\n" +
                "      type:\n" +
                "        blueId: Conversation/Sequential Workflow\n" +
                "      channel: subAScoreUpdates\n" +
                "      steps:\n" +
                "        - name: IncrementGroupCounter\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /counter\n" +
                "              val: \"${(document('counter') ?? 0) + 1}\"\n" +
                "        - name: RecordGroupPath\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /lastTriggered\n" +
                "              val: \"${event.path}\"\n" +
                "groupB:\n" +
                "  totalUpdates: 0\n" +
                "  lastFromNested: none\n" +
                "  nestedB:\n" +
                "    x: 1\n" +
                "    y: 0\n" +
                "    yChanges: 0\n" +
                "    contracts:\n" +
                "      nestedTimeline:\n" +
                "        type:\n" +
                "          blueId: Conversation/Timeline Channel\n" +
                "        timelineId: nested-b\n" +
                "      nestedWorkflow:\n" +
                "        type:\n" +
                "          blueId: Conversation/Sequential Workflow\n" +
                "        channel: nestedTimeline\n" +
                "        steps:\n" +
                "          - name: IncrementX\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /x\n" +
                "                val: \"${document('x') + 1}\"\n" +
                "          - name: AdjustY\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /y\n" +
                "                val: \"${document('y') + document('x')}\"\n" +
                "      nestedYUpdates:\n" +
                "        type:\n" +
                "          blueId: Document Update Channel\n" +
                "        path: /y\n" +
                "      onNestedYUpdate:\n" +
                "        type:\n" +
                "          blueId: Conversation/Sequential Workflow\n" +
                "        channel: nestedYUpdates\n" +
                "        steps:\n" +
                "          - name: CountYChanges\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /yChanges\n" +
                "                val: \"${(document('yChanges') ?? 0) + 1}\"\n" +
                "  contracts:\n" +
                "    embeddedNestedB:\n" +
                "      type:\n" +
                "        blueId: Process Embedded\n" +
                "      paths:\n" +
                "        - /nestedB\n" +
                "    nestedBXUpdates:\n" +
                "      type:\n" +
                "        blueId: Document Update Channel\n" +
                "      path: /nestedB/x\n" +
                "    onNestedBXUpdate:\n" +
                "      type:\n" +
                "        blueId: Conversation/Sequential Workflow\n" +
                "      channel: nestedBXUpdates\n" +
                "      steps:\n" +
                "        - name: IncrementTotalUpdates\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /totalUpdates\n" +
                "              val: \"${(document('totalUpdates') ?? 0) + 1}\"\n" +
                "        - name: RecordNestedPath\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /lastFromNested\n" +
                "              val: \"${event.path}\"\n" +
                "contracts:\n" +
                "  embedded:\n" +
                "    type:\n" +
                "      blueId: Process Embedded\n" +
                "    paths:\n" +
                "      - /groupA\n" +
                "      - /groupB\n" +
                "  rootNestedBXUpdates:\n" +
                "    type:\n" +
                "      blueId: Document Update Channel\n" +
                "    path: /groupB/nestedB/x\n" +
                "  onRootNestedBXUpdate:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: rootNestedBXUpdates\n" +
                "    steps:\n" +
                "      - name: IncrementRootCounter\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /rootCounter\n" +
                "            val: \"${(document('rootCounter') ?? 0) + 1}\"\n" +
                "      - name: RecordRootPath\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /rootLastPath\n" +
                "            val: \"${event.path}\"\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        assertFalse(initialized.capabilityFailure(), "Initialization should succeed");
        assertEquals(new BigInteger("0"), ProcessorEngine.nodeAt(initialized.document(), "/rootCounter").getValue());
        assertEquals("none", String.valueOf(ProcessorEngine.nodeAt(initialized.document(), "/rootLastPath").getValue()));

        DocumentProcessingResult afterGroupA = blue.processDocument(
                initialized.document(),
                timelineEntry("evt-cross-sub-a", "sub-a", "update group A"));
        assertFalse(afterGroupA.capabilityFailure(), "Sub-A event processing should succeed");
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(afterGroupA.document(), "/groupA/counter").getValue());
        assertEquals("/subA/score", String.valueOf(ProcessorEngine.nodeAt(afterGroupA.document(), "/groupA/lastTriggered").getValue()));
        assertEquals(new BigInteger("4"), ProcessorEngine.nodeAt(afterGroupA.document(), "/groupA/subA/score").getValue());
        assertEquals("handled", String.valueOf(ProcessorEngine.nodeAt(afterGroupA.document(), "/groupA/subA/lastEvent").getValue()));
        assertEquals(new BigInteger("0"), ProcessorEngine.nodeAt(afterGroupA.document(), "/rootCounter").getValue());
        assertEquals("none", String.valueOf(ProcessorEngine.nodeAt(afterGroupA.document(), "/rootLastPath").getValue()));

        DocumentProcessingResult afterNestedB = blue.processDocument(
                afterGroupA.document(),
                timelineEntry("evt-cross-nested-b", "nested-b", "update group B"));
        assertFalse(afterNestedB.capabilityFailure(), "Nested-B event processing should succeed");

        Node finalDocument = afterNestedB.document();
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(finalDocument, "/rootCounter").getValue());
        assertEquals("/groupB/nestedB/x", String.valueOf(ProcessorEngine.nodeAt(finalDocument, "/rootLastPath").getValue()));
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(finalDocument, "/groupA/counter").getValue());
        assertEquals("/subA/score", String.valueOf(ProcessorEngine.nodeAt(finalDocument, "/groupA/lastTriggered").getValue()));
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(finalDocument, "/groupB/totalUpdates").getValue());
        assertEquals("/nestedB/x", String.valueOf(ProcessorEngine.nodeAt(finalDocument, "/groupB/lastFromNested").getValue()));
        assertEquals(new BigInteger("2"), ProcessorEngine.nodeAt(finalDocument, "/groupB/nestedB/x").getValue());
        assertEquals(new BigInteger("2"), ProcessorEngine.nodeAt(finalDocument, "/groupB/nestedB/y").getValue());
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(finalDocument, "/groupB/nestedB/yChanges").getValue());

        assertNull(ProcessorEngine.nodeAt(finalDocument, "/contracts/terminated"));
        assertNull(ProcessorEngine.nodeAt(finalDocument, "/groupA/contracts/terminated"));
        assertNull(ProcessorEngine.nodeAt(finalDocument, "/groupB/contracts/terminated"));
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
