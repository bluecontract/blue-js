package blue.language.processor.model;

import blue.language.Blue;
import blue.language.mapping.NodeToObjectConverter;
import blue.language.model.Node;
import blue.language.utils.TypeClassResolver;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContractModelsParityTest {

    private final Blue blue = new Blue();
    private final NodeToObjectConverter converter = new NodeToObjectConverter(new TypeClassResolver("blue.language.processor.model"));

    @Test
    void convertsDocumentAndEmbeddedChannelContracts() {
        Node documentUpdateNode = blue.yamlToNode("type:\n" +
                "  blueId: Document Update Channel\n" +
                "path: /documents/foo\n" +
                "order: 7\n");
        Contract documentUpdate = converter.convertWithType(documentUpdateNode, Contract.class, false);
        assertTrue(documentUpdate instanceof DocumentUpdateChannel);
        assertEquals("/documents/foo", ((DocumentUpdateChannel) documentUpdate).getPath());
        assertEquals(Integer.valueOf(7), documentUpdate.getOrder());

        Node embeddedNode = blue.yamlToNode("type:\n" +
                "  blueId: Embedded Node Channel\n" +
                "childPath: /child/alpha\n");
        Contract embedded = converter.convertWithType(embeddedNode, Contract.class, false);
        assertTrue(embedded instanceof EmbeddedNodeChannel);
        assertEquals("/child/alpha", ((EmbeddedNodeChannel) embedded).getChildPath());
    }

    @Test
    void convertsLifecycleTriggeredAndMarkerContracts() {
        Contract lifecycle = converter.convertWithType(
                blue.yamlToNode("type:\n  blueId: Lifecycle Event Channel\n"),
                Contract.class,
                false);
        Contract triggered = converter.convertWithType(
                blue.yamlToNode("type:\n  blueId: Triggered Event Channel\n"),
                Contract.class,
                false);
        assertTrue(lifecycle instanceof LifecycleChannel);
        assertTrue(triggered instanceof TriggeredEventChannel);

        Contract processEmbedded = converter.convertWithType(
                blue.yamlToNode("type:\n" +
                        "  blueId: Process Embedded\n" +
                        "paths:\n" +
                        "  - /child/a\n" +
                        "  - /child/b\n"),
                Contract.class,
                false);
        assertTrue(processEmbedded instanceof ProcessEmbedded);
        assertEquals(Arrays.asList("/child/a", "/child/b"), ((ProcessEmbedded) processEmbedded).getPaths());

        Contract initialized = converter.convertWithType(
                blue.yamlToNode("type:\n" +
                        "  blueId: Processing Initialized Marker\n" +
                        "documentId: doc-123\n"),
                Contract.class,
                false);
        assertTrue(initialized instanceof InitializationMarker);
        assertEquals("doc-123", ((InitializationMarker) initialized).getDocumentId());

        Contract terminated = converter.convertWithType(
                blue.yamlToNode("type:\n" +
                        "  blueId: Processing Terminated Marker\n" +
                        "cause: BoundaryViolation\n" +
                        "reason: Test\n"),
                Contract.class,
                false);
        assertTrue(terminated instanceof ProcessingTerminatedMarker);
        assertEquals("BoundaryViolation", ((ProcessingTerminatedMarker) terminated).getCause());
        assertEquals("Test", ((ProcessingTerminatedMarker) terminated).getReason());
    }

    @Test
    void convertsCheckpointMarkerPreservingEventNodes() {
        Contract checkpointContract = converter.convertWithType(
                blue.yamlToNode("type:\n" +
                        "  blueId: Channel Event Checkpoint\n" +
                        "lastEvents:\n" +
                        "  channelA:\n" +
                        "    payload: data\n" +
                        "lastSignatures:\n" +
                        "  channelA: sig-123\n"),
                Contract.class,
                false);
        assertTrue(checkpointContract instanceof ChannelEventCheckpoint);
        ChannelEventCheckpoint checkpoint = (ChannelEventCheckpoint) checkpointContract;

        assertEquals("sig-123", checkpoint.lastSignature("channelA"));
        Node event = checkpoint.lastEvent("channelA");
        assertNotNull(event);
        assertEquals("data", String.valueOf(event.getProperties().get("payload").getValue()));
        assertEquals(1, checkpoint.getLastEvents().size());
    }

    @Test
    void convertsMyosMarkerContracts() {
        Contract anchors = converter.convertWithType(
                blue.yamlToNode("type:\n  blueId: MyOS/Document Anchors\n"),
                Contract.class,
                false);
        Contract links = converter.convertWithType(
                blue.yamlToNode("type:\n  blueId: MyOS/Document Links\n"),
                Contract.class,
                false);
        Contract participants = converter.convertWithType(
                blue.yamlToNode("type:\n  blueId: MyOS/MyOS Participants Orchestration\n"),
                Contract.class,
                false);
        Contract session = converter.convertWithType(
                blue.yamlToNode("type:\n  blueId: MyOS/MyOS Session Interaction\n"),
                Contract.class,
                false);
        Contract worker = converter.convertWithType(
                blue.yamlToNode("type:\n  blueId: MyOS/MyOS Worker Agency\n"),
                Contract.class,
                false);

        assertTrue(anchors instanceof DocumentAnchorsMarker);
        assertTrue(links instanceof DocumentLinksMarker);
        assertTrue(participants instanceof MyOSParticipantsOrchestrationMarker);
        assertTrue(session instanceof MyOSSessionInteractionMarker);
        assertTrue(worker instanceof MyOSWorkerAgencyMarker);
    }
}
