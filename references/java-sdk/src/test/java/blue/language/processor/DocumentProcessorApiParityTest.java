package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.contracts.TestEventChannelProcessor;
import blue.language.processor.model.MarkerContract;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

class DocumentProcessorApiParityTest {

    @Test
    void initializesAndProcessesDocumentThroughApiSurface() {
        Blue blue = new Blue();
        DocumentProcessor processor = new DocumentProcessor();
        processor.registerContractProcessor(new TestEventChannelProcessor());

        Node original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());
        DocumentProcessingResult init = processor.initializeDocument(original);
        assertFalse(init.capabilityFailure());
        assertTrue(processor.isInitialized(init.document()));
        assertEquals(1, init.triggeredEvents().size());
        assertEquals("Document Processing Initiated",
                String.valueOf(init.triggeredEvents().get(0).getProperties().get("type").getValue()));
        assertEquals(new BigInteger("1"), init.document().getProperties().get("initialized").getValue());

        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-1\n");
        DocumentProcessingResult processed = processor.processDocument(init.document(), event);
        assertFalse(processed.capabilityFailure());
        assertEquals(new BigInteger("5"), processed.document().getProperties().get("processed").getValue());
        assertEquals(0, processed.triggeredEvents().size());
    }

    @Test
    void apiGuardsInitializationStateAndExposesMarkers() {
        Blue blue = new Blue();
        DocumentProcessor processor = new DocumentProcessor();
        processor.registerContractProcessor(new TestEventChannelProcessor());

        Node original = blue.yamlToNode(documentWithLifecycleAndEventHandlers());
        Node event = blue.yamlToNode("type:\n" +
                "  blueId: TestEvent\n" +
                "eventId: evt-uninitialized\n");

        RuntimeException uninitializedError = assertThrows(
                RuntimeException.class,
                () -> processor.processDocument(original.clone(), event));
        assertTrue(String.valueOf(uninitializedError.getMessage()).contains("Document not initialized"));

        DocumentProcessingResult initialized = processor.initializeDocument(original.clone());
        RuntimeException alreadyInitializedError = assertThrows(
                RuntimeException.class,
                () -> processor.initializeDocument(initialized.document()));
        assertTrue(String.valueOf(alreadyInitializedError.getMessage()).contains("Document already initialized"));

        Map<String, MarkerContract> markers = processor.markersFor(initialized.document(), "/");
        assertTrue(markers.containsKey("initialized"));
    }

    @Test
    void returnsCapabilityFailureWhenContractsAreNotUnderstood() {
        Blue blue = new Blue();
        DocumentProcessor processor = new DocumentProcessor();
        String yaml = "name: Capability Failure Doc\n" +
                "contracts:\n" +
                "  lifecycleChannel:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  onLifecycle:\n" +
                "    channel: lifecycleChannel\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /x\n" +
                "    propertyValue: 1\n";

        Node original = blue.yamlToNode(yaml);
        String originalJson = blue.nodeToJson(original.clone());
        DocumentProcessingResult result = processor.initializeDocument(original);

        assertTrue(result.capabilityFailure());
        assertFalse(result.failureReason() == null || result.failureReason().trim().isEmpty());
        assertEquals("0", String.valueOf(result.totalGas()));
        assertEquals(0, result.triggeredEvents().size());
        assertEquals(originalJson, blue.nodeToJson(result.document()));
    }

    @Test
    void returnsCapabilityFailureForUnknownContractTypeBlueId() {
        Blue blue = new Blue();
        DocumentProcessor processor = new DocumentProcessor();
        String yaml = "name: Unknown Contract Type Doc\n" +
                "contracts:\n" +
                "  mysteryChannel:\n" +
                "    type:\n" +
                "      blueId: UnknownChannelType\n";

        Node original = blue.yamlToNode(yaml);
        String originalJson = blue.nodeToJson(original.clone());
        DocumentProcessingResult result = processor.initializeDocument(original);

        assertTrue(result.capabilityFailure());
        assertTrue(String.valueOf(result.failureReason()).contains("Unsupported contract type"));
        assertEquals("0", String.valueOf(result.totalGas()));
        assertEquals(0, result.triggeredEvents().size());
        assertEquals(originalJson, blue.nodeToJson(result.document()));
    }

    private String documentWithLifecycleAndEventHandlers() {
        return "name: API Parity Doc\n" +
                "contracts:\n" +
                "  lifecycleChannel:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  onLifecycle:\n" +
                "    channel: lifecycleChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /initialized\n" +
                "            val: 1\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  onTestEvent:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    steps:\n" +
                "      - type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /processed\n" +
                "            val: 5\n";
    }
}
