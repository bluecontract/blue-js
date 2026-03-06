package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class ProcessMultiPathsIntegrationTest {

    private static final String MULTI_PATH_BASE_YAML = "name: Multi Path Protected\n" +
            "childA:\n" +
            "  count: 0\n" +
            "  contracts:\n" +
            "    alphaTimeline:\n" +
            "      type:\n" +
            "        blueId: Conversation/Timeline Channel\n" +
            "      timelineId: alpha\n" +
            "    incrementA:\n" +
            "      type:\n" +
            "        blueId: Conversation/Sequential Workflow\n" +
            "      channel: alphaTimeline\n" +
            "      steps:\n" +
            "        - name: IncrementA\n" +
            "          type:\n" +
            "            blueId: Conversation/Update Document\n" +
            "          changeset:\n" +
            "            - op: REPLACE\n" +
            "              path: /count\n" +
            "              val: \"${document('count') + 1}\"\n" +
            "childB:\n" +
            "  count: 0\n" +
            "  contracts:\n" +
            "    betaTimeline:\n" +
            "      type:\n" +
            "        blueId: Conversation/Timeline Channel\n" +
            "      timelineId: beta\n" +
            "    incrementB:\n" +
            "      type:\n" +
            "        blueId: Conversation/Sequential Workflow\n" +
            "      channel: betaTimeline\n" +
            "      steps:\n" +
            "        - name: IncrementB\n" +
            "          type:\n" +
            "            blueId: Conversation/Update Document\n" +
            "          changeset:\n" +
            "            - op: REPLACE\n" +
            "              path: /count\n" +
            "              val: \"${document('count') + 1}\"\n" +
            "contracts:\n" +
            "  embedded:\n" +
            "    type:\n" +
            "      blueId: Process Embedded\n" +
            "    paths:\n" +
            "      - /childA\n" +
            "      - /childB\n";

    @Test
    void runsEmbeddedChildrenIndependentlyWhileBothPathsAreProtected() {
        Blue blue = new Blue();
        DocumentProcessingResult initialized = blue.initializeDocument(blue.yamlToNode(MULTI_PATH_BASE_YAML));
        assertFalse(initialized.capabilityFailure(), "Initialization should succeed");

        DocumentProcessingResult afterAlpha = blue.processDocument(
                initialized.document(),
                timelineEntry("evt-multi-alpha", "alpha", "event for childA"));
        assertFalse(afterAlpha.capabilityFailure(), "Alpha event processing should succeed");
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(afterAlpha.document(), "/childA/count").getValue());
        assertEquals(new BigInteger("0"), ProcessorEngine.nodeAt(afterAlpha.document(), "/childB/count").getValue());
        assertNull(ProcessorEngine.nodeAt(afterAlpha.document(), "/contracts/terminated"));

        DocumentProcessingResult afterBeta = blue.processDocument(
                afterAlpha.document().clone(),
                timelineEntry("evt-multi-beta", "beta", "event for childB"));
        assertFalse(afterBeta.capabilityFailure(), "Beta event processing should succeed");
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(afterBeta.document(), "/childA/count").getValue());
        assertEquals(new BigInteger("1"), ProcessorEngine.nodeAt(afterBeta.document(), "/childB/count").getValue());
        assertNull(ProcessorEngine.nodeAt(afterBeta.document(), "/contracts/terminated"));
    }

    @Test
    void terminatesRootScopeWhenWritingIntoEitherProtectedSubtree() {
        assertRootTerminationOnProtectedWrite("childA");
        assertRootTerminationOnProtectedWrite("childB");
    }

    @Test
    void removesEmbeddedChildRootWithoutTerminatingParent() {
        Blue blue = new Blue();
        String yaml = MULTI_PATH_BASE_YAML +
                "  rootTimeline:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: root\n" +
                "  rootWrite:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: rootTimeline\n" +
                "    steps:\n" +
                "      - name: RootRemoveChild\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REMOVE\n" +
                "            path: /childA\n";

        DocumentProcessingResult initialized = blue.initializeDocument(blue.yamlToNode(yaml));
        assertFalse(initialized.capabilityFailure(), "Initialization should succeed");

        DocumentProcessingResult result = blue.processDocument(
                initialized.document(),
                timelineEntry("evt-multi-remove-child", "root", "remove childA"));
        assertFalse(result.capabilityFailure(), "Processing should succeed");

        assertNull(ProcessorEngine.nodeAt(result.document(), "/contracts/terminated"));
        assertNull(ProcessorEngine.nodeAt(result.document(), "/childA"));
        assertNotNull(ProcessorEngine.nodeAt(result.document(), "/childB"));
    }

    private void assertRootTerminationOnProtectedWrite(String target) {
        Blue blue = new Blue();
        String yaml = MULTI_PATH_BASE_YAML +
                "  rootTimeline:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: root\n" +
                "  rootWrite:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: rootTimeline\n" +
                "    steps:\n" +
                "      - name: RootWrite\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /" + target + "/count\n" +
                "            val: \"${document('/" + target + "/count') + 1}\"\n";

        DocumentProcessingResult initialized = blue.initializeDocument(blue.yamlToNode(yaml));
        assertFalse(initialized.capabilityFailure(), "Initialization should succeed for " + target);

        DocumentProcessingResult result = blue.processDocument(
                initialized.document(),
                timelineEntry("evt-multi-root-write-" + target, "root", "write " + target));
        assertFalse(result.capabilityFailure(), "Processing should succeed for " + target);

        Node termination = ProcessorEngine.nodeAt(result.document(), "/contracts/terminated");
        assertNotNull(termination, "Root termination marker should exist for " + target);
        assertEquals("fatal", String.valueOf(ProcessorEngine.nodeAt(result.document(), "/contracts/terminated/cause").getValue()));
        assertEquals(new BigInteger("0"), ProcessorEngine.nodeAt(result.document(), "/" + target + "/count").getValue());
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
