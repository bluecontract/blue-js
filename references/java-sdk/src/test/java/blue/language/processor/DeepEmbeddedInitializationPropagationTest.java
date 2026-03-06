package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DeepEmbeddedInitializationPropagationTest {

    @Test
    void initializationPropagatesDeepEmbeddedDocumentUpdateAcrossScopes() {
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
                "            - type:\n" +
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
                "            - type:\n" +
                "                blueId: Conversation/Update Document\n" +
                "              changeset:\n" +
                "                - op: REPLACE\n" +
                "                  path: /observed\n" +
                "                  val: \"${(document('observed') ?? 0) + 1}\"\n" +
                "            - type:\n" +
                "                blueId: Conversation/Update Document\n" +
                "              changeset:\n" +
                "                - op: REPLACE\n" +
                "                  path: /lastPath\n" +
                "                  val: \"${event.path}\"\n" +
                "            - type:\n" +
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
                "          - type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /observed\n" +
                "                val: \"${(document('observed') ?? 0) + 1}\"\n" +
                "          - type:\n" +
                "              blueId: Conversation/Update Document\n" +
                "            changeset:\n" +
                "              - op: REPLACE\n" +
                "                path: /lastPath\n" +
                "                val: \"${event.path}\"\n" +
                "          - type:\n" +
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
                "        - type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /observed\n" +
                "              val: \"${(document('observed') ?? 0) + 1}\"\n" +
                "        - type:\n" +
                "            blueId: Conversation/Update Document\n" +
                "          changeset:\n" +
                "            - op: REPLACE\n" +
                "              path: /lastPath\n" +
                "              val: \"${event.path}\"\n" +
                "        - type:\n" +
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
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /observed\n" +
                "            val: \"${(document('observed') ?? 0) + 1}\"\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /lastPath\n" +
                "            val: \"${event.path}\"\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /lastOp\n" +
                "            val: \"${event.op}\"\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        Node result = initialized.document();

        assertEquals(new BigInteger("1"), result.getProperties().get("observed").getValue());
        assertEquals("/branch/sub/leaf/value", String.valueOf(result.getProperties().get("lastPath").getValue()));
        assertEquals("replace", String.valueOf(result.getProperties().get("lastOp").getValue()));
    }
}
