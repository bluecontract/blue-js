package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DeepEmbeddedPropagationIntegrationTest {

    @Test
    void routesDocumentUpdateEventsThroughSequentialWorkflowsInNestedScopes() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Deep Embedded Doc\n" +
                "observed: 0\n" +
                "lastPath: none\n" +
                "lastOp: none\n" +
                "branch:\n" +
                "  observed: 0\n" +
                "  lastPath: none\n" +
                "  lastOp: none\n" +
                "  sub:\n" +
                "    observed: 0\n" +
                "    lastPath: none\n" +
                "    lastOp: none\n" +
                "    leaf:\n" +
                "      observed: 0\n" +
                "      lastPath: none\n" +
                "      lastOp: none\n" +
                "      contracts:\n" +
                "        life:\n" +
                "          type:\n" +
                "            blueId: Lifecycle Event Channel\n" +
                "        initializeLeaf:\n" +
                "          type:\n" +
                "            blueId: Conversation/Sequential Workflow\n" +
                "          channel: life\n" +
                "          event:\n" +
                "            type:\n" +
                "              blueId: Document Processing Initiated\n" +
                "          steps:\n" +
                "            - name: SeedLeaf\n" +
                "              type:\n" +
                "                blueId: Conversation/Update Document\n" +
                "              changeset:\n" +
                "                - op: REPLACE\n" +
                "                  path: /value\n" +
                "                  val: 1\n" +
                "        leafUpdates:\n" +
                "          type:\n" +
                "            blueId: Document Update Channel\n" +
                "          path: /value\n" +
                "        leafWatcher:\n" +
                "          type:\n" +
                "            blueId: Conversation/Sequential Workflow\n" +
                "          channel: leafUpdates\n" +
                "          steps:\n" +
                "            - name: IncrementLeaf\n" +
                "              type:\n" +
                "                blueId: Conversation/Update Document\n" +
                "              changeset:\n" +
                "                - op: REPLACE\n" +
                "                  path: /observed\n" +
                "                  val: \"${(document('observed') ?? 0) + 1}\"\n" +
                "            - name: RecordLeafPath\n" +
                "              type:\n" +
                "                blueId: Conversation/Update Document\n" +
                "              changeset:\n" +
                "                - op: REPLACE\n" +
                "                  path: /lastPath\n" +
                "                  val: \"${event.path}\"\n" +
                "            - name: RecordLeafOp\n" +
                "              type:\n" +
                "                blueId: Conversation/Update Document\n" +
                "              changeset:\n" +
                "                - op: REPLACE\n" +
                "                  path: /lastOp\n" +
                "                  val: \"${event.op}\"\n" +
                "    contracts:\n" +
                "      embedded:\n" +
                "        type:\n" +
                "          blueId: Process Embedded\n" +
                "        paths:\n" +
                "          - /leaf\n" +
                "      subLeafUpdates:\n" +
                "        type:\n" +
                "          blueId: Document Update Channel\n" +
                "        path: /leaf/value\n" +
                "      subWatcher:\n" +
                "        type:\n" +
                "          blueId: Conversation/Sequential Workflow\n" +
                "        channel: subLeafUpdates\n" +
                "        steps:\n" +
                "          - name: IncrementSub\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /observed\n" +
                "                val: \"${(document('observed') ?? 0) + 1}\"\n" +
                "          - name: RecordSubPath\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /lastPath\n" +
                "                val: \"${event.path}\"\n" +
                "          - name: RecordSubOp\n" +
                "            type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /lastOp\n" +
                "                val: \"${event.op}\"\n" +
                "  contracts:\n" +
                "    embedded:\n" +
                "      type:\n" +
                "        blueId: Process Embedded\n" +
                "      paths:\n" +
                "        - /sub\n" +
                "    branchLeafUpdates:\n" +
                "      type:\n" +
                "        blueId: Document Update Channel\n" +
                "      path: /sub/leaf/value\n" +
                "    branchWatcher:\n" +
                "      type:\n" +
                "        blueId: Conversation/Sequential Workflow\n" +
                "      channel: branchLeafUpdates\n" +
                "      steps:\n" +
                "        - name: IncrementBranch\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /observed\n" +
                "              val: \"${(document('observed') ?? 0) + 1}\"\n" +
                "        - name: RecordBranchPath\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /lastPath\n" +
                "              val: \"${event.path}\"\n" +
                "        - name: RecordBranchOp\n" +
                "          type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /lastOp\n" +
                "              val: \"${event.op}\"\n" +
                "contracts:\n" +
                "  embedded:\n" +
                "    type:\n" +
                "      blueId: Process Embedded\n" +
                "    paths:\n" +
                "      - /branch\n" +
                "  rootLeafUpdates:\n" +
                "    type:\n" +
                "      blueId: Document Update Channel\n" +
                "    path: /branch/sub/leaf/value\n" +
                "  rootWatcher:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: rootLeafUpdates\n" +
                "    steps:\n" +
                "      - name: IncrementRoot\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /observed\n" +
                "            val: \"${(document('observed') ?? 0) + 1}\"\n" +
                "      - name: RecordRootPath\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /lastPath\n" +
                "            val: \"${event.path}\"\n" +
                "      - name: RecordRootOp\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /lastOp\n" +
                "            val: \"${event.op}\"\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        assertFalse(initialized.capabilityFailure(), "Initialization should succeed");
        assertEquals(1, initialized.triggeredEvents().size());

        Node initEvent = initialized.triggeredEvents().get(0);
        assertNotNull(initEvent);
        assertEquals("Document Processing Initiated",
                String.valueOf(ProcessorEngine.nodeAt(initEvent, "/type").getValue()));
        assertNotNull(ProcessorEngine.nodeAt(initEvent, "/documentId"));

        Node initializedDocument = initialized.document();
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(initializedDocument, "/observed").getValue());
        assertEquals("/branch/sub/leaf/value", String.valueOf(ProcessorEngine.nodeAt(initializedDocument, "/lastPath").getValue()));
        assertEquals("replace", String.valueOf(ProcessorEngine.nodeAt(initializedDocument, "/lastOp").getValue()));

        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(initializedDocument, "/branch/observed").getValue());
        assertEquals("/sub/leaf/value", String.valueOf(ProcessorEngine.nodeAt(initializedDocument, "/branch/lastPath").getValue()));
        assertEquals("replace", String.valueOf(ProcessorEngine.nodeAt(initializedDocument, "/branch/lastOp").getValue()));

        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(initializedDocument, "/branch/sub/observed").getValue());
        assertEquals("/leaf/value", String.valueOf(ProcessorEngine.nodeAt(initializedDocument, "/branch/sub/lastPath").getValue()));
        assertEquals("replace", String.valueOf(ProcessorEngine.nodeAt(initializedDocument, "/branch/sub/lastOp").getValue()));

        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(initializedDocument, "/branch/sub/leaf/observed").getValue());
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(initializedDocument, "/branch/sub/leaf/value").getValue());
        assertEquals("/value", String.valueOf(ProcessorEngine.nodeAt(initializedDocument, "/branch/sub/leaf/lastPath").getValue()));
        assertEquals("replace", String.valueOf(ProcessorEngine.nodeAt(initializedDocument, "/branch/sub/leaf/lastOp").getValue()));
    }
}
