package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.contracts.IncrementPropertyContractProcessor;
import blue.language.processor.contracts.TestEventChannelProcessor;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ScopeExecutorParityTest {

    @Test
    void initializesScopeAndRecordsInitializationMarkerAndLifecycleEvent() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Scope Executor Init Doc\n");

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        assertFalse(initialized.capabilityFailure(), "Initialization should succeed");

        Node marker = ProcessorEngine.nodeAt(initialized.document(), "/contracts/initialized");
        assertNotNull(marker, "Initialization marker must be written");
        assertNotNull(marker.getType());
        assertEquals("InitializationMarker", marker.getType().getBlueId());
        assertNotNull(ProcessorEngine.nodeAt(initialized.document(), "/contracts/initialized/documentId"));

        assertEquals(1, initialized.triggeredEvents().size());
        Node lifecycle = initialized.triggeredEvents().get(0);
        assertEquals("Document Processing Initiated",
                String.valueOf(ProcessorEngine.nodeAt(lifecycle, "/type").getValue()));
        assertNotNull(ProcessorEngine.nodeAt(lifecycle, "/documentId"));
    }

    @Test
    void processesExternalEventsViaChannelRunnerForUnmanagedChannels() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        Node document = blue.yamlToNode("name: Scope Executor External Event Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /observed\n");

        Node initialized = blue.initializeDocument(document).document();
        DocumentProcessingResult processed = blue.processDocument(
                initialized,
                blue.yamlToNode("type:\n" +
                        "  blueId: TestEvent\n" +
                        "eventId: evt-scope-external\n" +
                        "kind: test\n"));

        assertFalse(processed.capabilityFailure(), "Processing should succeed");
        Node observed = ProcessorEngine.nodeAt(processed.document(), "/observed");
        assertNotNull(observed);
        assertEquals(BigInteger.ONE, observed.getValue());
    }

    @Test
    void entersFatalTerminationWhenPatchViolatesEmbeddedBoundary() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Scope Executor Boundary Doc\n" +
                "child:\n" +
                "  count: 0\n" +
                "contracts:\n" +
                "  embedded:\n" +
                "    type:\n" +
                "      blueId: Process Embedded\n" +
                "    paths:\n" +
                "      - /child\n" +
                "  rootTimeline:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: root\n" +
                "  rootWrite:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: rootTimeline\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /child/count\n" +
                "            val: 1\n");

        Node initialized = blue.initializeDocument(document).document();
        DocumentProcessingResult processed = blue.processDocument(
                initialized,
                timelineEntry("evt-boundary", "root", "try violating boundary"));

        assertFalse(processed.capabilityFailure(), "Processing should complete with fatal marker");
        Node termination = ProcessorEngine.nodeAt(processed.document(), "/contracts/terminated");
        assertNotNull(termination, "Root termination marker must be present");
        assertEquals("fatal", String.valueOf(ProcessorEngine.nodeAt(processed.document(), "/contracts/terminated/cause").getValue()));
        assertEquals(BigInteger.ZERO, ProcessorEngine.nodeAt(processed.document(), "/child/count").getValue());
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
